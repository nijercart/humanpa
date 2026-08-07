import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { AppHeader } from "@/components/AppHeader";
import { ActionPlan } from "@/components/need/ActionPlan";
import { OptionsGrid } from "@/components/need/OptionsGrid";
import { SourceList } from "@/components/need/SourceList";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getNeed, getResearchQuota, runResearch, updateProblem } from "@/lib/needs.functions";

type ClarifyingQuestion = { id: string; question: string; why: string };

export const Route = createFileRoute("/_authenticated/need/$needId")({
  head: () => ({
    meta: [
      { title: "Working it out — HumanOS" },
      {
        name: "description",
        content:
          "The restated problem, the sources HumanOS read, the options compared and your action plan.",
      },
      { property: "og:title", content: "Working it out — HumanOS" },
      { property: "og:description", content: "Researched options and a plan you can act on." },
    ],
  }),
  component: NeedDetail,
});

const RESEARCH_NOTES = [
  "Reading the primary sources…",
  "Checking what this actually costs…",
  "Looking for deadlines and catches…",
  "Comparing the realistic routes…",
  "Writing your plan…",
];

function ResearchProgress() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % RESEARCH_NOTES.length), 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="border-t border-rule py-16 text-center">
      <div className="mx-auto h-1 w-40 overflow-hidden rounded-full bg-rule">
        <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
      </div>
      <p className="mt-5 text-sm text-muted-foreground">{RESEARCH_NOTES[index]}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        This usually takes a minute or two. Stay on the page.
      </p>
    </div>
  );
}

function NeedDetail() {
  const { needId } = Route.useParams();
  const queryClient = useQueryClient();

  const fetchNeed = useServerFn(getNeed);
  const research = useServerFn(runResearch);
  const saveProblem = useServerFn(updateProblem);

  const query = useQuery({
    queryKey: ["need", needId],
    queryFn: () => fetchNeed({ data: { needId } }),
  });

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [problemDraft, setProblemDraft] = useState("");

  const researchMutation = useMutation({
    mutationFn: () => research({ data: { needId, answers } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["need", needId] }),
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: ["need", needId] });
      toast.error(error instanceof Error ? error.message : "Research failed.");
    },
  });

  const problemMutation = useMutation({
    mutationFn: (restatedProblem: string) => saveProblem({ data: { needId, restatedProblem } }),
    onSuccess: () => {
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["need", needId] });
    },
  });

  if (query.isLoading) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <p className="mx-auto max-w-3xl px-6 py-20 text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <div className="mx-auto max-w-3xl px-6 py-20">
          <p className="text-sm text-muted-foreground">We couldn't load this one.</p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/needs">Back to your needs</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { need, sources, options, steps } = query.data;
  const questions = (need.clarifying_questions ?? []) as ClarifyingQuestion[];
  const assumptions = (need.assumptions ?? []) as string[];
  const researching = need.status === "researching" || researchMutation.isPending;

  return (
    <div className="min-h-screen">
      <AppHeader />

      <main className="mx-auto w-full max-w-3xl px-6 py-12">
        <Link to="/needs" className="font-mono text-xs text-muted-foreground hover:text-foreground">
          ← All needs
        </Link>

        <p className="mt-8 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          You said
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{need.raw_input}</p>

        <h1 className="mt-8 font-display text-4xl leading-[1.15] text-foreground">
          {need.title ?? "Working it out"}
        </h1>

        {need.status === "error" ? (
          <div className="mt-6 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm">
            <p className="font-medium text-foreground">That didn't go through.</p>
            <p className="mt-1 text-muted-foreground">{need.error_message}</p>
            {need.restated_problem ? (
              <Button
                className="mt-3"
                size="sm"
                onClick={() => researchMutation.mutate()}
                disabled={researchMutation.isPending}
              >
                Try the research again
              </Button>
            ) : null}
          </div>
        ) : null}

        {need.restated_problem ? (
          <section className="mt-8 rounded-lg border border-rule bg-paper p-5">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
              The real problem
            </p>
            {editing ? (
              <div className="mt-3">
                <Textarea
                  rows={4}
                  value={problemDraft}
                  onChange={(event) => setProblemDraft(event.target.value)}
                  className="resize-none border-rule bg-background"
                />
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => problemMutation.mutate(problemDraft)}
                    disabled={problemMutation.isPending}
                  >
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="mt-3 text-lg leading-relaxed text-foreground">
                  {need.restated_problem}
                </p>
                {need.status !== "ready" && !researching ? (
                  <button
                    type="button"
                    className="mt-3 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                    onClick={() => {
                      setProblemDraft(need.restated_problem ?? "");
                      setEditing(true);
                    }}
                  >
                    That's not quite it — let me fix it
                  </button>
                ) : null}
              </>
            )}

            {assumptions.length ? (
              <ul className="mt-4 space-y-1 border-t border-rule pt-3 text-sm text-muted-foreground">
                {assumptions.map((assumption) => (
                  <li key={assumption}>· {assumption}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}

        {need.status === "clarified" && !researching ? (
          <section className="mt-10">
            <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
              A few things that change the answer
            </h2>
            <div className="mt-5 space-y-6">
              {questions.map((question) => (
                <div key={question.id}>
                  <label
                    htmlFor={question.id}
                    className="block font-medium leading-snug text-foreground"
                  >
                    {question.question}
                  </label>
                  <p className="mt-0.5 text-xs text-muted-foreground">{question.why}</p>
                  <Textarea
                    id={question.id}
                    rows={2}
                    value={answers[question.id] ?? ""}
                    onChange={(event) =>
                      setAnswers((prev) => ({ ...prev, [question.id]: event.target.value }))
                    }
                    placeholder="Skip if you don't know"
                    className="mt-2 resize-none border-rule bg-paper"
                  />
                </div>
              ))}
            </div>
            <Button
              className="mt-6"
              onClick={() => researchMutation.mutate()}
              disabled={researchMutation.isPending}
            >
              Research this
            </Button>
          </section>
        ) : null}

        {researching ? <ResearchProgress /> : null}

        {need.recommendation ? (
          <section className="mt-10 border-l-2 border-primary pl-5">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
              What I'd do
            </p>
            <p className="mt-2 font-display text-2xl leading-snug text-foreground">
              {need.recommendation}
            </p>
          </section>
        ) : null}

        <div className="mt-10">
          <ActionPlan steps={steps} needId={needId} />
          <OptionsGrid options={options} />
          <SourceList sources={sources} />
        </div>

        {need.status === "ready" ? (
          <p className="border-t border-rule pt-6 text-xs text-muted-foreground">
            Researched information, not legal, medical or financial advice. Check anything with a
            deadline against the official source.
          </p>
        ) : null}
      </main>
    </div>
  );
}
