import { streamText } from "ai";

import { createLovableAiGatewayProvider } from "./ai-gateway.server";

/** Pull the first JSON object out of a model response, tolerating code fences and prose. */
export function extractJson(text: string | undefined): unknown {
  if (!text) return null;
  const cleaned = text.replace(/```(?:json)?/gi, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Read a streamed response, surfacing the real provider failure.
 * `result.text` alone collapses gateway errors (402, 429, …) into a useless
 * "No output generated" message, so we capture the stream error and rethrow it.
 */
export async function readStreamText(result: {
  text: PromiseLike<string>;
}, captured: { error?: unknown }): Promise<string> {
  try {
    const text = await result.text;
    if (captured.error) throw captured.error;
    return text;
  } catch (error) {
    if (captured.error) {
      const inner = captured.error;
      throw inner instanceof Error ? inner : new Error(String(inner));
    }
    throw error;
  }
}

/**
 * Ask for JSON as plain text and normalize it ourselves.
 * Structured-output validation was rejecting perfectly usable answers.
 */
export async function generateJson(
  model: ReturnType<ReturnType<typeof createLovableAiGatewayProvider>>,
  args: { system?: string; prompt: string },
): Promise<unknown> {
  const captured: { error?: unknown } = {};
  const result = streamText({
    model,
    ...(args.system ? { system: args.system } : {}),
    prompt: `${args.prompt}\n\nReply with a single JSON object only. No markdown, no commentary.`,
    onError: ({ error }) => {
      captured.error = error;
    },
  });
  return extractJson(await readStreamText(result, captured));
}

