/**
 * SSE Streaming route for LLM script generation.
 * POST /api/ai/stream-generate
 * 
 * Sends Server-Sent Events with chunks of generated code as the LLM produces them.
 * Auth: uses the same session cookie as tRPC.
 */
import { Router, Request, Response } from "express";
import { ENV } from "../_core/env";
import { sdk } from "../_core/sdk";
import { buildGeneratePrompt, GENERATE_JSON_SCHEMA } from "../routers/aiGeneration";

const router = Router();

const resolveApiUrl = () =>
  ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0
    ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`
    : "https://forge.manus.im/v1/chat/completions";

/**
 * POST /api/ai/stream-generate
 * Body: { context: AiScriptContext, plan: ScriptPlanResult }
 *   OR  { messages: Message[], response_format?: object }
 * Response: SSE stream with { type: "chunk" | "done" | "error", data: string }
 */
router.post("/api/ai/stream-generate", async (req: Request, res: Response) => {
  // 1. Auth check
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  } catch {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // 2. Build messages from context+plan or use raw messages
  let messages: any[];
  let response_format: any;

  if (req.body.context && req.body.plan) {
    // Build the prompt server-side from context + plan
    const prompt = buildGeneratePrompt(req.body.context, req.body.plan);
    messages = [
      { role: "system", content: "You are an expert test automation engineer. Return only valid JSON." },
      { role: "user", content: prompt },
    ];
    response_format = { type: "json_schema", json_schema: GENERATE_JSON_SCHEMA };
  } else if (req.body.messages && Array.isArray(req.body.messages)) {
    messages = req.body.messages;
    response_format = req.body.response_format;
  } else {
    res.status(400).json({ error: "context+plan or messages array required" });
    return;
  }

  // 3. Setup SSE
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const sendSSE = (type: string, data: string) => {
    res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
  };

  try {
    // 4. Call LLM with streaming
    const payload: Record<string, unknown> = {
      model: "gemini-2.5-flash",
      messages,
      stream: true,
      max_tokens: 32768,
      thinking: { budget_tokens: 128 },
    };

    if (response_format) {
      payload.response_format = response_format;
    }

    const response = await fetch(resolveApiUrl(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      sendSSE("error", `LLM error: ${response.status} ${errorText}`);
      res.end();
      return;
    }

    if (!response.body) {
      sendSSE("error", "No response body from LLM");
      res.end();
      return;
    }

    // 5. Stream the response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullContent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE lines from the LLM response
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === "data: [DONE]") {
          if (trimmed === "data: [DONE]") {
            sendSSE("done", fullContent);
          }
          continue;
        }

        if (trimmed.startsWith("data: ")) {
          try {
            const json = JSON.parse(trimmed.slice(6));
            const delta = json.choices?.[0]?.delta;
            if (delta?.content) {
              fullContent += delta.content;
              sendSSE("chunk", delta.content);
            }
            // Check for finish_reason
            if (json.choices?.[0]?.finish_reason === "stop") {
              sendSSE("done", fullContent);
            }
          } catch {
            // Skip unparseable lines
          }
        }
      }
    }

    // If we haven't sent done yet (buffer might have remaining data)
    if (buffer.trim()) {
      const trimmed = buffer.trim();
      if (trimmed.startsWith("data: ") && trimmed !== "data: [DONE]") {
        try {
          const json = JSON.parse(trimmed.slice(6));
          const delta = json.choices?.[0]?.delta;
          if (delta?.content) {
            fullContent += delta.content;
            sendSSE("chunk", delta.content);
          }
        } catch { /* skip */ }
      }
    }

    // Final done if not already sent
    sendSSE("done", fullContent);
    res.end();
  } catch (err: any) {
    sendSSE("error", err.message || "Stream error");
    res.end();
  }
});

export default router;
