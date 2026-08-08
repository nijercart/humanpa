import { createLovableAiGatewayProvider, HUMANOS_MODEL, requireLovableApiKey } from "./ai-gateway.server";
import { generateJson } from "./ai-json.server";

export type NeedIntent = {
  domain: string;
  locale: string;
  freshnessDays: number;
  needsLiveData: boolean;
};

const DEFAULT_INTENT: NeedIntent = {
  domain: "general",
  locale: "und",
  freshnessDays: 90,
  needsLiveData: true,
};

function clampDays(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_INTENT.freshnessDays;
  return Math.min(730, Math.max(1, Math.round(n)));
}

/** Step 0 — work out what kind of problem this is and how fresh the evidence must be. */
export async function classifyIntent(rawInput: string): Promise<NeedIntent> {
  try {
    const gateway = createLovableAiGatewayProvider(requireLovableApiKey());
    const raw = (await generateJson(gateway(HUMANOS_MODEL), {
      prompt: [
        "Classify this person's request so a research system can route it.",
        "",
        `Their words: """${rawInput}"""`,
        "",
        "Return:",
        "- domain: one lowercase word or short slug (e.g. immigration, health, housing, money, career, legal, tech, travel, education, general).",
        "- locale: BCP-47-ish tag for the language they wrote in, plus country when they clearly named one (e.g. 'en', 'bn-BD', 'de-DE'). Use 'und' if unclear.",
        "- freshnessDays: how old saved evidence may be and still be trustworthy for this question. Prices, fees, deadlines, laws, availability: 7-30. Stable how-to knowledge: 180-365.",
        "- needsLiveData: true when the answer depends on current prices, deadlines, rules or availability; false for evergreen knowledge.",
      ].join("\n"),
    })) as Record<string, unknown> | null;

    if (!raw) return DEFAULT_INTENT;
    return {
      domain: typeof raw["domain"] === "string" && raw["domain"] ? raw["domain"] : DEFAULT_INTENT.domain,
      locale: typeof raw["locale"] === "string" && raw["locale"] ? raw["locale"] : DEFAULT_INTENT.locale,
      freshnessDays: clampDays(raw["freshnessDays"]),
      needsLiveData: raw["needsLiveData"] !== false,
    };
  } catch (error) {
    console.error("Intent classification failed, falling back to live research:", error);
    return DEFAULT_INTENT;
  }
}
