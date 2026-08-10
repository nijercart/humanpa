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
 * "No output generated" message, so we drain the full stream first — that is
 * where the AI SDK emits `error` parts — and rethrow the real cause.
 */
export async function readStreamText(
  result: {
    text: PromiseLike<string>;
    fullStream?: AsyncIterable<{ type: string; error?: unknown }>;
  },
  captured: { error?: unknown },
): Promise<string> {
  const fail = (fallback: unknown): never => {
    const inner = captured.error ?? fallback;
    throw inner instanceof Error ? inner : new Error(describeUnknown(inner));
  };

  try {
    if (result.fullStream) {
      for await (const part of result.fullStream) {
        if (part.type === "error") captured.error = part.error;
      }
    }
    if (captured.error) fail(captured.error);
    const text = await result.text;
    if (captured.error) fail(captured.error);
    return text;
  } catch (error) {
    return fail(error);
  }
}

/** Provider errors often arrive as plain objects; keep their detail readable. */
function describeUnknown(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
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

