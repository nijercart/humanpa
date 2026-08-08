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
 * Ask for JSON as plain text and normalize it ourselves.
 * Structured-output validation was rejecting perfectly usable answers.
 */
export async function generateJson(
  model: ReturnType<ReturnType<typeof createLovableAiGatewayProvider>>,
  args: { system?: string; prompt: string },
): Promise<unknown> {
  const result = streamText({
    model,
    ...(args.system ? { system: args.system } : {}),
    prompt: `${args.prompt}\n\nReply with a single JSON object only. No markdown, no commentary.`,
  });
  return extractJson(await result.text);
}
