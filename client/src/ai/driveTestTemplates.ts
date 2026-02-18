/**
 * Drive Test IA Templates — Prompt templates spécialisés pour les scénarios Drive Test Télécom.
 *
 * 1) PROMPT_DRIVE_PLAN_v1   → Plan de test drive (routes, KPI, devices, probes)
 * 2) PROMPT_DRIVE_GEN_v1    → Génération de scripts d'automatisation drive test
 * 3) PROMPT_DRIVE_REPAIR_v1 → Réparation de scripts drive test à partir d'artefacts terrain
 *
 * Ces templates étendent le système de prompts existant avec des sections spécifiques
 * au domaine télécom : métriques radio, handover, couverture, QoS.
 */
import type { AiScriptContext, PromptTemplate, ScriptPlanResult } from './types';

// ─── Helpers ──────────────────────────────────────────────────────────────

function jsonBlock(obj: unknown): string {
  return '```json\n' + JSON.stringify(obj, null, 2) + '\n```';
}

function formatSteps(steps: AiScriptContext['scenario']['steps']): string {
  return steps.map(s =>
    `  ${s.order}. [${s.action}] ${s.description}\n     Expected: ${s.expected_result}\n     Params: ${JSON.stringify(s.parameters)}`
  ).join('\n');
}

function formatDatasetKeys(merged: Record<string, unknown>, maskedKeys: string[]): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(merged)) {
    const isMasked = maskedKeys.some(mk => key.includes(mk) || mk.includes(key));
    lines.push(`  ${key}: ${isMasked ? '***MASKED***' : JSON.stringify(value)}`);
  }
  return lines.join('\n');
}

// ─── PROMPT_DRIVE_PLAN_v1 ────────────────────────────────────────────────

export const PROMPT_DRIVE_PLAN_v1: PromptTemplate = {
  id: 'PROMPT_DRIVE_PLAN_v1',
  version: '1.0.0',
  name: 'Drive Test Plan Generator',
  description: 'Génère un plan de test drive terrain avec routes, KPI cibles, devices et sondes.',
  buildPrompt: (ctx: AiScriptContext) => `You are an expert telecom drive test engineer and automation architect.

## TASK
Analyze the following drive test scenario and produce a **DriveTestPlanResult** JSON object.

## CONTEXT

### Project
- Name: ${ctx.project.name}
- ID: ${ctx.project.id}

### Profile
- Domain: ${ctx.profile.domain}
- Test Type: ${ctx.profile.test_type} (VABF=functional, VABE=performance/security, VSR=service/resilience)
- Profile Type: ${ctx.profile.profile_type}
- Runner Type: ${ctx.profile.runner_type}

### Scenario
- Title: ${ctx.scenario.title}
- Code: ${ctx.scenario.scenario_code || 'N/A'}
- Required Dataset Types: ${ctx.scenario.required_dataset_types.join(', ') || 'none'}
- Steps:
${formatSteps(ctx.scenario.steps)}

### Dataset (${ctx.dataset.env})
- Bundle: ${ctx.dataset.bundle.name} v${ctx.dataset.bundle.version}
- Available keys:
${formatDatasetKeys(ctx.dataset.resolved.merged_json, ctx.dataset.secrets_policy.masked_keys)}

### Generation Constraints
- Preferred Language: ${ctx.generation_constraints.code_language}
- Preferred Frameworks: ${ctx.generation_constraints.framework_preferences.join(', ')}
- Style Rules: ${ctx.generation_constraints.style_rules.join('; ')}
- Artifact Policy: ${ctx.generation_constraints.artifact_policy.join(', ')}

## DRIVE TEST SPECIFIC RULES
1. Identify the network type (4G/5G_SA/5G_NSA/IMS/IP) from dataset keys or scenario context.
2. Map each step to specific KPI measurements (RSRP, SINR, throughput, latency, jitter, packet_loss).
3. Define KPI thresholds based on test_type:
   - VABF: functional pass/fail (service accessible, call established, data session active)
   - VABE: performance thresholds (RSRP > -100dBm, DL > 10Mbps, latency < 50ms)
   - VSR: resilience criteria (handover success > 95%, recovery < 5s, failover works)
4. Plan probe configurations needed (PCAP, SIP_TRACE, DIAMETER, etc.)
5. Identify device requirements (diag_capable, specific tools like GNetTrack/QXDM)
6. Map route checkpoints to measurement points
7. NEVER invent IP addresses, cell IDs, or network parameters — use dataset keys only.

## OUTPUT FORMAT
Return ONLY a valid JSON object:
${jsonBlock({
  framework_choice: 'string',
  code_language: 'string',
  network_type: '4G|5G_SA|5G_NSA|IMS|IP',
  file_plan: [{ path: 'string', purpose: 'string', dependencies: ['string'] }],
  step_mapping: [{
    step_id: 'string', step_order: 0, action: 'string',
    target_file: 'string', target_function: 'string',
    dataset_keys_used: ['string'],
    kpi_measurements: ['RSRP', 'SINR', 'throughput_dl'],
    kpi_thresholds: { RSRP: '-100 dBm', throughput_dl: '10 Mbps' },
  }],
  probe_requirements: [{
    capture_type: 'PCAP|SIP_TRACE|DIAMETER|GTPU|NGAP|NAS',
    location: 'RUNNER_HOST|EDGE_VM|K8S_NODE|SPAN_PORT',
    purpose: 'string',
  }],
  device_requirements: {
    type: 'ANDROID|MODEM|CPE|LAPTOP',
    diag_capable: true,
    tools_needed: ['GNetTrack', 'QXDM'],
  },
  missing_inputs: [{ key: 'string', reason: 'string', severity: 'BLOCKING|WARNING' }],
  notes: 'string (optional)',
  warnings: ['string (optional)'],
})}

Return ONLY the JSON, no markdown fences, no explanation.`,
};

// ─── PROMPT_DRIVE_GEN_v1 ─────────────────────────────────────────────────

export const PROMPT_DRIVE_GEN_v1: PromptTemplate = {
  id: 'PROMPT_DRIVE_GEN_v1',
  version: '1.0.0',
  name: 'Drive Test Script Generator',
  description: 'Génère des scripts d\'automatisation drive test complets (mesures radio, QoS, handover).',
  buildPrompt: (ctx: AiScriptContext, extra?: Record<string, unknown>) => {
    const plan = extra?.plan as ScriptPlanResult | undefined;
    const planSection = plan
      ? `### Approved Plan\n${jsonBlock(plan)}`
      : '### Plan\nNo plan provided — generate files based on scenario steps directly.';

    return `You are an expert telecom drive test automation engineer.

## TASK
Generate complete, production-ready drive test automation scripts.

## CONTEXT

### Project: ${ctx.project.name}
### Profile
- Domain: ${ctx.profile.domain} | Test Type: ${ctx.profile.test_type}
- Runner: ${ctx.profile.runner_type}

### Scenario: ${ctx.scenario.title} (${ctx.scenario.scenario_code || ctx.scenario.id})
Steps:
${formatSteps(ctx.scenario.steps)}

### Dataset (${ctx.dataset.env}) — Bundle: ${ctx.dataset.bundle.name} v${ctx.dataset.bundle.version}
Available keys:
${formatDatasetKeys(ctx.dataset.resolved.merged_json, ctx.dataset.secrets_policy.masked_keys)}

${planSection}

### Generation Constraints
- Language: ${ctx.generation_constraints.code_language}
- Framework: ${plan?.framework_choice || ctx.generation_constraints.framework_preferences[0]}
- Style Rules: ${ctx.generation_constraints.style_rules.join('; ')}
- Artifacts: ${ctx.generation_constraints.artifact_policy.join(', ')}

## DRIVE TEST SPECIFIC RULES
1. For radio measurements: use dataset keys for expected thresholds (rsrp_min, sinr_min, etc.)
2. For throughput tests: generate iperf3 or speedtest commands with proper server/port from dataset
3. For latency tests: generate ping/traceroute commands with target hosts from dataset
4. For VoLTE/IMS: generate SIP REGISTER/INVITE sequences using dataset SIP credentials
5. For handover: generate mobility scripts that trigger cell reselection and measure continuity
6. Probe integration: include tcpdump/tshark commands for capture types specified in plan
7. Device integration: include adb commands for Android diag, AT commands for modems
8. KPI collection: generate structured JSON output for each measurement point
9. NEVER hardcode network parameters — use dataset keys via config import
10. Secret values (${ctx.dataset.secrets_policy.masked_keys.join(', ') || 'none'}) → use process.env

## FILE STRUCTURE CONVENTIONS
- config.ts: dataset import, env vars, KPI thresholds
- measurements.ts: KPI collection functions (RSRP, SINR, throughput, latency)
- probes.ts: capture start/stop/collect functions
- assertions.ts: KPI threshold validation
- report.ts: structured JSON report generation
- main test file(s): orchestration of steps

## OUTPUT FORMAT
Return ONLY a valid JSON object:
${jsonBlock({
  files: [{ path: 'string', content: 'string (full file content)', language: 'string' }],
  notes: 'string (optional)',
  warnings: ['string (optional)'],
  metadata: {
    framework: 'string',
    code_language: 'string',
    network_type: '4G|5G_SA|5G_NSA|IMS|IP',
    scenario_id: ctx.scenario.id,
    bundle_id: ctx.dataset.bundle.id,
    generated_at: 'ISO string',
    prompt_version: 'PROMPT_DRIVE_GEN_v1',
  },
})}

Return ONLY the JSON, no markdown fences, no explanation.`;
  },
};

// ─── PROMPT_DRIVE_REPAIR_v1 ──────────────────────────────────────────────

export const PROMPT_DRIVE_REPAIR_v1: PromptTemplate = {
  id: 'PROMPT_DRIVE_REPAIR_v1',
  version: '1.0.0',
  name: 'Drive Test Script Repair',
  description: 'Analyse les artefacts terrain (logs, traces, captures) et propose des patches de correction.',
  buildPrompt: (ctx: AiScriptContext, extra?: Record<string, unknown>) => {
    const errorLogs = (extra?.error_logs as string) || 'No logs provided.';
    const currentFiles = (extra?.current_files as Array<{ path: string; content: string }>) || [];
    const kpiResults = (extra?.kpi_results as Record<string, unknown>) || {};
    const captureAnalysis = (extra?.capture_analysis as string) || 'No capture analysis provided.';

    const filesSection = currentFiles.length > 0
      ? currentFiles.map(f => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``).join('\n\n')
      : 'No current files provided.';

    return `You are an expert telecom drive test debugger and network analyst.

## TASK
Analyze the drive test failure artifacts and produce targeted patches to fix the failing test.

## CONTEXT

### Scenario: ${ctx.scenario.title} (${ctx.scenario.scenario_code || ctx.scenario.id})
### Framework: ${ctx.generation_constraints.framework_preferences[0]}
### Dataset (${ctx.dataset.env}): ${ctx.dataset.bundle.name} v${ctx.dataset.bundle.version}

### Error Logs
\`\`\`
${errorLogs}
\`\`\`

### KPI Results (if available)
${Object.keys(kpiResults).length > 0 ? jsonBlock(kpiResults) : 'No KPI results available.'}

### Capture Analysis
${captureAnalysis}

### Current Script Files
${filesSection}

### Available Dataset Keys
${formatDatasetKeys(ctx.dataset.resolved.merged_json, ctx.dataset.secrets_policy.masked_keys)}

## DRIVE TEST REPAIR RULES
1. Follow: Observation → Hypotheses → Root Cause → Fix
2. Common drive test failure patterns:
   - Radio: RSRP/SINR below threshold → check measurement timing, antenna orientation
   - Throughput: iperf3 connection refused → check server address/port in dataset
   - Latency: timeout → check target host reachability, firewall rules
   - VoLTE: SIP 403/408 → check credentials, registration sequence, IMS config
   - Handover: cell reselection failure → check mobility parameters, timer values
   - Capture: pcap empty → check interface name, permissions, filter expression
3. NEVER invent network parameters — only use dataset keys
4. Patches must be minimal and targeted
5. If the issue is in the test environment (not the script), flag it as ENV_ISSUE

## OUTPUT FORMAT
Return ONLY a valid JSON object:
${jsonBlock({
  patches: [{
    file_path: 'string',
    original_snippet: 'string',
    patched_snippet: 'string',
    explanation: 'string',
    category: 'SCRIPT_BUG|CONFIG_ERROR|DATASET_MISMATCH|ENV_ISSUE|TIMING_ISSUE',
  }],
  root_cause: 'string',
  root_cause_category: 'SCRIPT_BUG|CONFIG_ERROR|DATASET_MISMATCH|ENV_ISSUE|TIMING_ISSUE|NETWORK_ISSUE',
  suggested_fix: 'string',
  kpi_analysis: 'string (analysis of KPI deviations if available)',
  confidence: 0.85,
  warnings: ['string (optional)'],
})}

Return ONLY the JSON, no markdown fences, no explanation.`;
  },
};

// ─── Export & Registry ───────────────────────────────────────────────────

export const DRIVE_PROMPT_TEMPLATES: Record<string, PromptTemplate> = {
  PROMPT_DRIVE_PLAN_v1,
  PROMPT_DRIVE_GEN_v1,
  PROMPT_DRIVE_REPAIR_v1,
};
