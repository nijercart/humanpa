import { stepCountIs, streamText, tool } from "ai";
import { z } from "zod";

import { createLovableAiGatewayProvider, HUMANOS_MODEL, requireLovableApiKey } from "./ai-gateway.server";
import { generateJson } from "./ai-json.server";
import {
  hasCoverage,
  ingestResults,
  passagesToSources,
  retrieveKnowledge,
  type KnowledgePassage,
} from "./knowledge.server";
import { webSearch, type WebResult } from "./web-search.server";

const clarifySchema = z.object({
  title: z.string(),
  restatedProblem: z.string(),
  assumptions: z.array(z.string()),
  questions: z.array(z.object({ id: z.string(), question: z.string(), why: z.string() })),
});

export type ClarifyResult = z.infer<typeof clarifySchema>;

const synthesisSchema = z.object({
  recommendation: z.string(),
  options: z.array(
    z.object({
      name: z.string(),
      summary: z.string(),
      cost: z.string(),
      timeRequired: z.string(),
      effort: z.string(),
      risk: z.string(),
      bestFor: z.string(),
      pros: z.array(z.string()),
      cons: z.array(z.string()),
      sourceUrls: z.array(z.string()),
      recommended: z.boolean(),
    }),
  ),
  steps: z.array(
    z.object({
      title: z.string(),
      detail: z.string(),
      linkUrl: z.string().nullable(),
      linkLabel: z.string().nullable(),
    }),
  ),
});

export type SynthesisResult = z.infer<typeof synthesisSchema>;

/** Models drift: coerce whatever came back into the shape the app needs. */
function str(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function strArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => str(item)).filter(Boolean);
}

function nullableStr(value: unknown): string | null {
  const text = str(value);
  return text ? text : null;
}

function normalizeClarify(raw: unknown, rawInput: string): ClarifyResult {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const questions = Array.isArray(obj["questions"]) ? (obj["questions"] as unknown[]) : [];
  return {
    title: str(obj["title"], rawInput.slice(0, 60)),
    restatedProblem: str(obj["restatedProblem"], rawInput),
    assumptions: strArray(obj["assumptions"]),
    questions: questions
      .map((item, index) => {
        const q = (item ?? {}) as Record<string, unknown>;
        return {
          id: str(q["id"], `q${index + 1}`),
          question: str(q["question"]),
          why: str(q["why"]),
        };
      })
      .filter((q) => q.question),
  };
}

function normalizeSynthesis(raw: unknown): SynthesisResult {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const options = Array.isArray(obj["options"]) ? (obj["options"] as unknown[]) : [];
  const steps = Array.isArray(obj["steps"]) ? (obj["steps"] as unknown[]) : [];
  return {
    recommendation: str(obj["recommendation"]),
    options: options
      .map((item) => {
        const o = (item ?? {}) as Record<string, unknown>;
        return {
          name: str(o["name"]),
          summary: str(o["summary"]),
          cost: str(o["cost"], "Unclear"),
          timeRequired: str(o["timeRequired"], "Unclear"),
          effort: str(o["effort"], "Unclear"),
          risk: str(o["risk"], "Unclear"),
          bestFor: str(o["bestFor"], "Unclear"),
          pros: strArray(o["pros"]),
          cons: strArray(o["cons"]),
          sourceUrls: strArray(o["sourceUrls"]),
          recommended: o["recommended"] === true,
        };
      })
      .filter((o) => o.name),
    steps: steps
      .map((item) => {
        const s = (item ?? {}) as Record<string, unknown>;
        return {
          title: str(s["title"]),
          detail: str(s["detail"]),
          linkUrl: nullableStr(s["linkUrl"]),
          linkLabel: nullableStr(s["linkLabel"]),
        };
      })
      .filter((s) => s.title),
  };
}


/** Every user-visible string must come back in the language the person wrote in. */
const LANGUAGE_RULE =
  "Write every user-visible string in the SAME language the person used in their own words. " +
  "Detect it from their original message and match it exactly (including script and formality). " +
  "Keep URLs, proper nouns and JSON keys unchanged. Only fall back to English if their language is genuinely unclear.";




/** Step 1 — restate the real problem and ask the few questions that actually change the answer. */
export async function clarifyNeed(rawInput: string): Promise<ClarifyResult> {
  const gateway = createLovableAiGatewayProvider(requireLovableApiKey());

  const prompt = [
    "A person described something they need help with. Work out what the real problem is.",
    "",
    `Their words: """${rawInput}"""`,
    "",
    "Return:",
    "- title: a short label for this need, at most 6 words.",
    "- restatedProblem: two or three sentences naming the underlying problem, not just echoing them.",
    "- assumptions: 2-4 short assumptions you are making that they should correct if wrong.",
    "- questions: 2 to 4 sharp clarifying questions whose answers would genuinely change the recommendation.",
    "  Each has a short stable id (slug), the question text, and 'why' — one short line on why it matters.",
    "Never ask for personal identifiers, passwords, or financial account details.",
    "",
    LANGUAGE_RULE,
  ].join("\n");

  const raw = await generateJson(gateway(HUMANOS_MODEL), { prompt });
  const clarified = normalizeClarify(raw, rawInput);
  if (!clarified.questions.length) {
    clarified.questions = [
      { id: "context", question: "Anything else we should know before researching?", why: "Fills the gaps." },
    ];
  }
  return clarified;

}

export type ResearchOutcome = {
  briefing: string;
  sources: WebResult[];
  synthesis: SynthesisResult;
};

/** Step 2 — research the problem on the live web, then compare options and build an action plan. */
export async function researchNeed(input: {
  rawInput: string;
  restatedProblem: string;
  answers: { question: string; answer: string }[];
}): Promise<ResearchOutcome> {
  const gateway = createLovableAiGatewayProvider(requireLovableApiKey());
  const collected = new Map<string, WebResult>();

  const context = [
    `Original request: """${input.rawInput}"""`,
    `Restated problem: ${input.restatedProblem}`,
    input.answers.length
      ? `Their answers:\n${input.answers.map((a) => `- ${a.question} -> ${a.answer || "(no answer)"}`).join("\n")}`
      : "They did not answer the clarifying questions.",
    `Today's date: ${new Date().toISOString().slice(0, 10)}`,
  ].join("\n");

  const research = streamText({
    model: gateway(HUMANOS_MODEL),
    stopWhen: stepCountIs(50),
    system: [
      "You are HumanOS, a research operator for real-life problems.",
      "Use the web_search tool repeatedly until you can answer with confidence.",
      "Prefer official, institutional and primary sources; corroborate anything that costs money or has a deadline.",
      "Never invent facts, prices, deadlines or URLs. If something cannot be verified, say so plainly.",
      "Finish with a compact briefing: what is true, what the realistic routes are, what it costs, and what to watch out for. Cite URLs inline.",
      "Search in whichever language finds the best sources, but write the briefing itself in the same language the person used.",
      LANGUAGE_RULE,
    ].join(" "),
    prompt: `${context}\n\nResearch this thoroughly, then write the briefing.`,
    tools: {
      web_search: tool({
        description: "Search the live web for current, citable information.",
        inputSchema: z.object({ query: z.string() }),
        execute: async ({ query }) => {
          const results = await webSearch(query);
          for (const result of results) collected.set(result.url, result);
          return results.map((r) => ({
            title: r.title,
            url: r.url,
            snippet: r.snippet,
            official: r.isOfficial,
          }));
        },
      }),
    },
  });

  const briefing = await research.text;
  const sources = [...collected.values()];

  const synthesisPrompt = [
    context,
    "",
    "Research briefing:",
    briefing,
    "",
    "Available sources (cite by exact URL):",
    sources.map((s) => `- ${s.title} | ${s.url}`).join("\n") || "- (none)",
    "",
    "Now produce:",
    "- recommendation: 1-2 sentences on which route you would take and why.",
    "- options: 2 to 4 genuinely different realistic routes. Fill cost, timeRequired, effort, risk and bestFor with short concrete phrases (use 'Unclear' rather than guessing). Give 2-3 pros and 2-3 cons each, sourceUrls drawn only from the list above, and mark exactly one as recommended.",
    "- steps: 4 to 8 ordered actions the person can start today. Each has a short title, one sentence of detail, and linkUrl/linkLabel pointing at the exact page or form when one exists (otherwise null).",
    "Keep every string short and plain-spoken. No markdown.",
    "",
    LANGUAGE_RULE,
    "That includes cost/time/effort/risk/bestFor placeholders: write the local-language equivalent of 'Unclear' instead of the English word.",
  ].join("\n");

  const parsed = normalizeSynthesis(
    await generateJson(gateway(HUMANOS_MODEL), { prompt: synthesisPrompt }),
  );


  // Enforce the prompt's limits in code rather than in the schema.
  parsed.options = parsed.options.slice(0, 4);
  parsed.steps = parsed.steps.slice(0, 10);
  if (parsed.options.length && !parsed.options.some((o) => o.recommended)) {
    parsed.options[0]!.recommended = true;
  }

  return { briefing, sources, synthesis: parsed };
}
