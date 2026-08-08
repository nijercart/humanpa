import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CreateNeedInput = z.object({ rawInput: z.string().min(3) });
const NeedIdInput = z.object({ needId: z.string().uuid() });
const AnswersInput = z.object({
  needId: z.string().uuid(),
  answers: z.record(z.string(), z.string()),
});
const RestateInput = z.object({
  needId: z.string().uuid(),
  restatedProblem: z.string().min(3),
});
const ToggleStepInput = z.object({ stepId: z.string().uuid(), done: z.boolean() });

export type ClarifyingQuestion = { id: string; question: string; why: string };

/** How many successful researches one account can run per calendar day (UTC). */
export const DAILY_RESEARCH_LIMIT = 2;

function startOfUtcDay(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

/** How many researches the signed-in user has left today. */
export const getResearchQuota = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count, error } = await context.supabase
      .from("research_runs")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfUtcDay());
    if (error) throw new Error(error.message);
    const used = count ?? 0;
    return {
      used,
      limit: DAILY_RESEARCH_LIMIT,
      remaining: Math.max(0, DAILY_RESEARCH_LIMIT - used),
    };
  });


/** Create a need and immediately restate the problem + ask clarifying questions. */
export const createNeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateNeedInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: need, error } = await supabase
      .from("needs")
      .insert({ user_id: userId, raw_input: data.rawInput, status: "clarifying" })
      .select("id")
      .single();
    if (error || !need) throw new Error(error?.message ?? "Could not save your need.");

    const { clarifyNeed } = await import("@/lib/humanos.server");
    const { classifyIntent } = await import("@/lib/intent.server");
    const { describeAiError } = await import("@/lib/ai-gateway.server");

    try {
      const [clarified, intent] = await Promise.all([
        clarifyNeed(data.rawInput),
        classifyIntent(data.rawInput),
      ]);
      const { error: updateError } = await supabase
        .from("needs")
        .update({
          title: clarified.title,
          restated_problem: clarified.restatedProblem,
          assumptions: clarified.assumptions,
          clarifying_questions: clarified.questions,
          intent_domain: intent.domain,
          intent_locale: intent.locale,
          freshness_days: intent.freshnessDays,
          needs_live_data: intent.needsLiveData,
          status: "clarified",
          error_message: null,
        })
        .eq("id", need.id);
      if (updateError) throw new Error(updateError.message);
    } catch (aiError) {
      const message = describeAiError(aiError);
      await supabase.from("needs").update({ status: "error", error_message: message }).eq("id", need.id);
    }

    return { needId: need.id as string };
  });

/** Save the user's clarifying answers, research the web, and build the plan. */
export const runResearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AnswersInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { count: usedToday, error: quotaError } = await supabase
      .from("research_runs")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfUtcDay());
    if (quotaError) throw new Error(quotaError.message);
    // A run only costs quota when it has to hit the live web; answers served
    // from the shared knowledge base are free.
    const allowLiveSearch = (usedToday ?? 0) < DAILY_RESEARCH_LIMIT;

    const { data: need, error } = await supabase
      .from("needs")
      .select("id, raw_input, restated_problem, clarifying_questions, intent_locale, freshness_days, needs_live_data")
      .eq("id", data.needId)
      .single();
    if (error || !need) throw new Error("Need not found.");


    await supabase
      .from("needs")
      .update({ clarifying_answers: data.answers, status: "researching", error_message: null })
      .eq("id", need.id);

    const questions = (need.clarifying_questions ?? []) as ClarifyingQuestion[];
    const answers = questions.map((q) => ({
      question: q.question,
      answer: data.answers[q.id] ?? "",
    }));

    const { researchNeed } = await import("@/lib/humanos.server");
    const { describeAiError } = await import("@/lib/ai-gateway.server");

    try {
      const outcome = await researchNeed({
        rawInput: need.raw_input,
        restatedProblem: need.restated_problem ?? need.raw_input,
        answers,
        allowLiveSearch,
        intent: {
          ...(need.intent_locale ? { locale: need.intent_locale } : {}),
          ...(typeof need.freshness_days === "number" ? { freshnessDays: need.freshness_days } : {}),
          needsLiveData: need.needs_live_data !== false,
        },
      });

      await Promise.all([
        supabase.from("need_sources").delete().eq("need_id", need.id),
        supabase.from("need_options").delete().eq("need_id", need.id),
        supabase.from("need_steps").delete().eq("need_id", need.id),
      ]);

      if (outcome.sources.length) {
        const { error: sourceError } = await supabase.from("need_sources").insert(
          outcome.sources.map((source, index) => ({
            need_id: need.id,
            user_id: userId,
            title: source.title,
            url: source.url,
            domain: source.domain,
            snippet: source.snippet,
            published_date: source.publishedDate,
            is_official: source.isOfficial,
            position: index,
          })),
        );
        if (sourceError) throw new Error(sourceError.message);
      }

      if (outcome.synthesis.options.length) {
        const { error: optionError } = await supabase.from("need_options").insert(
          outcome.synthesis.options.map((option, index) => ({
            need_id: need.id,
            user_id: userId,
            name: option.name,
            summary: option.summary,
            cost: option.cost,
            time_required: option.timeRequired,
            effort: option.effort,
            risk: option.risk,
            best_for: option.bestFor,
            pros: option.pros,
            cons: option.cons,
            source_urls: option.sourceUrls,
            recommended: option.recommended,
            position: index,
          })),
        );
        if (optionError) throw new Error(optionError.message);
      }

      if (outcome.synthesis.steps.length) {
        const { error: stepError } = await supabase.from("need_steps").insert(
          outcome.synthesis.steps.map((step, index) => ({
            need_id: need.id,
            user_id: userId,
            title: step.title,
            detail: step.detail,
            link_url: step.linkUrl,
            link_label: step.linkLabel,
            position: index,
          })),
        );
        if (stepError) throw new Error(stepError.message);
      }

      const { error: doneError } = await supabase
        .from("needs")
        .update({
          recommendation: outcome.synthesis.recommendation,
          status: "ready",
          error_message: null,
        })
        .eq("id", need.id);
      if (doneError) throw new Error(doneError.message);

      // Only successful researches count against the daily allowance.
      await supabase.from("research_runs").insert({ user_id: userId, need_id: need.id });

      return { ok: true as const };

    } catch (aiError) {
      const message = describeAiError(aiError);
      await supabase.from("needs").update({ status: "error", error_message: message }).eq("id", need.id);
      throw new Error(message);
    }
  });

/** Correct the restated problem before researching. */
export const updateProblem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RestateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("needs")
      .update({ restated_problem: data.restatedProblem })
      .eq("id", data.needId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const listNeeds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("needs")
      .select("id, title, raw_input, status, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getNeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => NeedIdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [need, sources, options, steps] = await Promise.all([
      supabase.from("needs").select("*").eq("id", data.needId).maybeSingle(),
      supabase.from("need_sources").select("*").eq("need_id", data.needId).order("position"),
      supabase.from("need_options").select("*").eq("need_id", data.needId).order("position"),
      supabase.from("need_steps").select("*").eq("need_id", data.needId).order("position"),
    ]);

    if (need.error) throw new Error(need.error.message);
    if (!need.data) throw new Error("Need not found.");

    return {
      need: need.data,
      sources: sources.data ?? [],
      options: options.data ?? [],
      steps: steps.data ?? [],
    };
  });

export const toggleStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ToggleStepInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("need_steps")
      .update({ done: data.done })
      .eq("id", data.stepId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteNeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => NeedIdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("needs").delete().eq("id", data.needId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
