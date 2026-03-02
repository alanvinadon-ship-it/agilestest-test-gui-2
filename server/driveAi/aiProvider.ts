// ============================================================================
// DriveAI — LLM Provider + Job Handler
// Calls invokeLLM with structured JSON output, parses results, persists.
// ============================================================================

import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import {
  driveAiAnalyses, driveAiSegments,
} from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { buildDriveAIInput, computeInputHash, type DriveAIInput } from "./inputBuilder";
import { registerHandler, type JobPayload } from "../jobQueue";

// ── Output Schema (JSON Schema for structured response) ───────────────────

const AI_OUTPUT_JSON_SCHEMA = {
  name: "drive_ai_analysis",
  strict: true,
  schema: {
    type: "object",
    properties: {
      summaryMd: {
        type: "string",
        description: "Résumé Markdown de l'analyse du drive test (2-5 paragraphes). Inclure les points clés, les anomalies détectées et un verdict global.",
      },
      qualityScore: {
        type: "integer",
        description: "Score de qualité global du drive test de 0 à 100 (0=très mauvais, 100=excellent).",
      },
      segments: {
        type: "array",
        description: "Liste des segments problématiques détectés (0 à 15 max).",
        items: {
          type: "object",
          properties: {
            segmentType: {
              type: "string",
              enum: [
                "DROP_CALL", "LOW_THROUGHPUT", "HO_FAIL", "HIGH_LATENCY",
                "COVERAGE_HOLE", "INTERFERENCE", "BACKHAUL", "DNS", "GPS_GAP", "OTHER",
              ],
              description: "Type de problème détecté.",
            },
            startTs: {
              type: ["string", "null"],
              description: "Timestamp ISO 8601 du début du segment (null si non applicable).",
            },
            endTs: {
              type: ["string", "null"],
              description: "Timestamp ISO 8601 de fin du segment (null si non applicable).",
            },
            geoBbox: {
              type: ["object", "null"],
              description: "Bounding box géographique du segment.",
              properties: {
                minLat: { type: "number" },
                maxLat: { type: "number" },
                minLon: { type: "number" },
                maxLon: { type: "number" },
              },
              required: ["minLat", "maxLat", "minLon", "maxLon"],
              additionalProperties: false,
            },
            evidence: {
              type: "string",
              description: "Description factuelle des preuves (métriques, échantillons, événements).",
            },
            diagnosisMd: {
              type: "string",
              description: "Diagnostic Markdown détaillé pour ce segment.",
            },
            actions: {
              type: "array",
              description: "Actions correctives recommandées (1-3 par segment).",
              items: {
                type: "object",
                properties: {
                  action: { type: "string", description: "Action recommandée." },
                  priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
                },
                required: ["action", "priority"],
                additionalProperties: false,
              },
            },
            confidence: {
              type: "number",
              description: "Confiance dans le diagnostic (0.0 à 1.0).",
            },
          },
          required: ["segmentType", "startTs", "endTs", "geoBbox", "evidence", "diagnosisMd", "actions", "confidence"],
          additionalProperties: false,
        },
      },
    },
    required: ["summaryMd", "qualityScore", "segments"],
    additionalProperties: false,
  },
} as const;

// ── System Prompt ──────────────────────────────────────────────────────────

function buildSystemPrompt(mode: "FAST" | "DEEP"): string {
  const depth = mode === "DEEP"
    ? "Effectue une analyse approfondie et détaillée. Examine chaque anomalie, corrèle les métriques GPS, KPI et événements. Fournis des diagnostics techniques précis."
    : "Effectue une analyse rapide et synthétique. Identifie les problèmes majeurs et fournis un résumé concis.";

  return `Tu es un expert en analyse de drive tests mobiles (4G/5G). Tu analyses les données de terrain collectées lors de tests de couverture et qualité réseau.

${depth}

Contexte technique :
- Les drive tests mesurent la qualité du réseau mobile en conditions réelles (voiture, piéton)
- Les métriques clés incluent : RSRP (puissance signal), RSRQ (qualité signal), SINR (rapport signal/bruit), débit DL/UL, latence, perte paquets
- Les anomalies GPS (gaps, arrêts) peuvent indiquer des problèmes de couverture ou de terminal
- Les événements ERROR sont souvent liés à des échecs de handover, des drops d'appel ou des problèmes de connectivité

Règles :
- Réponds UNIQUEMENT en JSON structuré selon le schéma fourni
- Le summaryMd doit être en français, formaté en Markdown
- Le qualityScore reflète la qualité globale du parcours (0-100)
- Chaque segment doit avoir des preuves factuelles basées sur les données fournies
- Ne fabrique PAS de données — base-toi uniquement sur ce qui est fourni
- Si les données sont insuffisantes, indique-le dans le résumé et attribue un score neutre (50)
- Les actions doivent être concrètes et réalisables par un ingénieur réseau`;
}

// ── User Prompt Builder ────────────────────────────────────────────────────

function buildUserPrompt(input: DriveAIInput): string {
  const parts: string[] = [];

  parts.push(`## Run: ${input.run.name ?? input.run.uid}`);
  parts.push(`- Statut: ${input.run.status}`);
  parts.push(`- Durée: ${input.summary.durationSec ? `${input.summary.durationSec}s` : "N/A"}`);
  parts.push(`- Distance: ${input.summary.distanceKm ? `${input.summary.distanceKm} km` : "N/A"}`);
  parts.push(`- Vitesse moyenne: ${input.summary.avgSpeedMps ? `${input.summary.avgSpeedMps} m/s` : "N/A"}`);
  parts.push(`- Points GPS: ${input.summary.totalGpsSamples}`);
  parts.push(`- Événements: ${input.summary.totalEvents}`);

  if (input.run.campaignName) {
    parts.push(`- Campagne: ${input.run.campaignName}`);
  }

  if (input.run.metaJson && Object.keys(input.run.metaJson).length > 0) {
    parts.push(`- Métadonnées: ${JSON.stringify(input.run.metaJson)}`);
  }

  // Heuristic anomalies
  if (input.heuristicAnomalies.length > 0) {
    parts.push("\n## Anomalies pré-détectées (heuristiques)");
    for (const a of input.heuristicAnomalies) {
      parts.push(`- [${a.severity}] ${a.type}: ${a.evidence}`);
    }
  }

  // KPI aggregates
  if (Object.keys(input.kpiAggregates).length > 0) {
    parts.push("\n## KPI Agrégés");
    for (const [name, stats] of Object.entries(input.kpiAggregates)) {
      parts.push(`- ${name}: avg=${stats.avg.toFixed(2)}, min=${stats.min.toFixed(2)}, max=${stats.max.toFixed(2)} (n=${stats.count})`);
    }
  }

  // GPS samples (downsampled for context)
  if (input.gpsSamples.length > 0) {
    const downsampledGps = downsample(input.gpsSamples, 200);
    parts.push(`\n## Échantillons GPS (${downsampledGps.length} sur ${input.gpsSamples.length})`);
    parts.push("ts,lat,lon,speed_mps,alt_m");
    for (const s of downsampledGps) {
      parts.push(`${s.ts},${s.lat},${s.lon},${s.speedMps ?? ""},${s.altitudeM ?? ""}`);
    }
  }

  // Events
  if (input.events.length > 0) {
    const limitedEvents = input.events.slice(0, 100);
    parts.push(`\n## Événements (${limitedEvents.length} sur ${input.events.length})`);
    for (const e of limitedEvents) {
      parts.push(`- [${e.ts}] ${e.type}/${e.severity}: ${e.message ?? "N/A"}`);
    }
  }

  // Artifacts
  if (input.artifactRefs.length > 0) {
    parts.push("\n## Artefacts associés");
    for (const a of input.artifactRefs) {
      parts.push(`- ${a.filename ?? a.uid} (${a.type ?? "unknown"}, ${a.sizeBytes ? `${Math.round(a.sizeBytes / 1024)} Ko` : "N/A"})`);
    }
  }

  return parts.join("\n");
}

// ── LLM Call ───────────────────────────────────────────────────────────────

export interface AIAnalysisResult {
  summaryMd: string;
  qualityScore: number;
  segments: {
    segmentType: string;
    startTs: string | null;
    endTs: string | null;
    geoBbox: { minLat: number; maxLat: number; minLon: number; maxLon: number } | null;
    evidence: string;
    diagnosisMd: string;
    actions: { action: string; priority: string }[];
    confidence: number;
  }[];
}

export async function callDriveAI(
  input: DriveAIInput,
  mode: "FAST" | "DEEP",
): Promise<AIAnalysisResult> {
  const response = await invokeLLM({
    messages: [
      { role: "system", content: buildSystemPrompt(mode) },
      { role: "user", content: buildUserPrompt(input) },
    ],
    response_format: {
      type: "json_schema",
      json_schema: AI_OUTPUT_JSON_SCHEMA,
    },
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("LLM returned empty or non-string content");
  }

  const parsed = JSON.parse(content) as AIAnalysisResult;

  // Validate basic structure
  if (typeof parsed.summaryMd !== "string" || typeof parsed.qualityScore !== "number") {
    throw new Error("LLM output missing required fields (summaryMd, qualityScore)");
  }
  if (!Array.isArray(parsed.segments)) {
    parsed.segments = [];
  }

  // Clamp quality score
  parsed.qualityScore = Math.max(0, Math.min(100, Math.round(parsed.qualityScore)));

  return parsed;
}

// ── Job Handler ────────────────────────────────────────────────────────────

registerHandler("driveAiAnalyze", async (payload) => {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const { analysisUid, runUid, orgId, mode } = payload;

  // Mark as RUNNING
  await db.update(driveAiAnalyses).set({ status: "RUNNING" })
    .where(eq(driveAiAnalyses.uid, analysisUid));

  try {
    // 1. Build input
    const input = await buildDriveAIInput(runUid, orgId);
    const inputHash = computeInputHash(input);

    // 2. Call LLM
    const result = await callDriveAI(input, mode as "FAST" | "DEEP");

    // 3. Persist segments
    if (result.segments.length > 0) {
      const segmentValues = result.segments.map((seg) => ({
        uid: randomUUID(),
        orgId,
        analysisUid,
        segmentType: seg.segmentType as any,
        startTs: seg.startTs ? new Date(seg.startTs) : null,
        endTs: seg.endTs ? new Date(seg.endTs) : null,
        geoBboxJson: seg.geoBbox,
        evidenceJson: { evidence: seg.evidence },
        diagnosisMd: seg.diagnosisMd,
        actionsJson: seg.actions,
        confidence: seg.confidence,
      }));

      // Insert in batches
      const BATCH = 50;
      for (let i = 0; i < segmentValues.length; i += BATCH) {
        await db.insert(driveAiSegments).values(segmentValues.slice(i, i + BATCH));
      }
    }

    // 4. Update analysis record
    await db.update(driveAiAnalyses).set({
      status: "COMPLETED",
      summaryMd: result.summaryMd,
      qualityScore: result.qualityScore,
      outputJson: result,
      inputHash,
      model: "gemini-2.5-flash",
    }).where(eq(driveAiAnalyses.uid, analysisUid));

    return {
      analysisUid,
      qualityScore: result.qualityScore,
      segmentsCount: result.segments.length,
    };
  } catch (err: any) {
    await db.update(driveAiAnalyses).set({
      status: "FAILED",
      error: String(err?.message ?? err).substring(0, 2000),
    }).where(eq(driveAiAnalyses.uid, analysisUid));
    throw err;
  }
});

// ── Helpers ────────────────────────────────────────────────────────────────

function downsample<T>(arr: T[], maxLen: number): T[] {
  if (arr.length <= maxLen) return arr;
  const step = arr.length / maxLen;
  const result: T[] = [];
  for (let i = 0; i < maxLen; i++) {
    result.push(arr[Math.floor(i * step)]);
  }
  return result;
}
