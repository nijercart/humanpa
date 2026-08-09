import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * Provider helper for the Lovable AI Gateway.
 * Server-only: the API key must never reach the browser.
 */
export function createLovableAiGatewayProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "lovable-ai-gateway",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: { "Lovable-API-Key": apiKey },
  });
}

export function requireLovableApiKey(): string {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI is not configured for this app yet.");
  return key;
}

export const HUMANOS_MODEL = "google/gemini-3.5-flash";

/** Turn a gateway/provider failure into a message worth showing a person. */
export function describeAiError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes("429") || /rate.?limit/i.test(raw)) {
    return "The AI service is busy right now. Wait a moment and try again — your need is saved.";
  }
  if (raw.includes("402") || /not enough credits|payment_required/i.test(raw)) {
    return "This workspace is out of AI credits, so the research couldn't run. Top up the AI credits and try again — your problem and answers are saved.";
  }
  return raw.slice(0, 400) || "The AI service returned an unexpected error.";
}
