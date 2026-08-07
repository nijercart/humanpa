import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createNeed, deleteNeed, getResearchQuota, listNeeds } from "@/lib/needs.functions";

export const Route = createFileRoute("/_authenticated/needs")({
  head: () => ({
    meta: [
      { title: "Your needs — HumanOS" },
      {
        name: "description",
        content: "Describe what you need and revisit every plan HumanOS has researched for you.",
      },
      { property: "og:title", content: "Your needs — HumanOS" },
      { property: "og:description", content: "Describe what you need. Get a researched plan." },
    ],
  }),
  component: NeedsPage,
});

const EXAMPLES = [
  "My landlord won't return my deposit and stopped replying.",
  "I need to move to Portugal for a year and don't know which visa fits.",
  "My car failed its inspection on emissions and I have three weeks.",
  "I was offered a settlement after a bike accident and don't know if it's fair.",
];

const STATUS_LABEL: Record<string, string> = {
  clarifying: "Reading",
  clarified: "Needs your answers",
  researching: "Researching",
  ready: "Plan ready",
  error: "Failed",
};

function NeedsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");

  const list = useServerFn(listNeeds);
  const create = useServerFn(createNeed);
  const remove = useServerFn(deleteNeed);
  const fetchQuota = useServerFn(getResearchQuota);

  const needs = useQuery({ queryKey: ["needs"], queryFn: () => list({ data: undefined }) });
  const quota = useQuery({
    queryKey: ["research-quota"],
    queryFn: () => fetchQuota({ data: undefined }),
  });


  const createMutation = useMutation({
    mutationFn: (rawInput: string) => create({ data: { rawInput } }),
    onSuccess: ({ needId }) => {
      setInput("");
      queryClient.invalidateQueries({ queryKey: ["needs"] });
      navigate({ to: "/need/$needId", params: { needId } });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not start that."),
  });

  const deleteMutation = useMutation({
    mutationFn: (needId: string) => remove({ data: { needId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["needs"] }),
  });

  return (
    <div className="min-h-screen">
      <AppHeader />

      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <h1 className="font-display text-4xl leading-tight text-foreground sm:text-5xl">
          Tell me what you need.
        </h1>
        <p className="mt-3 text-muted-foreground">
          Plain words are fine. Messy is fine. Start anywhere.
        </p>

        <form
          className="mt-8"
          onSubmit={(event) => {
            event.preventDefault();
            if (input.trim().length < 10) {
              toast.error("Give me a sentence or two to work with.");
              return;
            }
            createMutation.mutate(input.trim());
          }}
        >
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            rows={5}
            autoFocus
            placeholder="I need…"
            className="resize-none border-rule bg-paper text-base leading-relaxed"
          />
          <div className="mt-3 flex items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              Don't include passwords, ID numbers or account details.
              {quota.data ? (
                <>
                  {" "}
                  <span className="text-foreground">
                    {quota.data.remaining} of {quota.data.limit} researches left today.
                  </span>
                </>
              ) : null}
            </p>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Reading…" : "Work it out"}
            </Button>
          </div>

        </form>

        <div className="mt-6 flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setInput(example)}
              className="rounded-full border border-rule px-3 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
            >
              {example}
            </button>
          ))}
        </div>

        <section className="mt-16">
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Your problems
          </h2>

          {needs.isError ? (
            <div
              data-testid="needs-error"
              className="mt-4 rounded-md border border-rule bg-paper p-5 text-sm leading-relaxed"
            >
              We couldn&apos;t load your problems — your session may have expired.{" "}
              <Link to="/auth" search={{ redirect: "/needs" }} className="underline underline-offset-4">
                Sign in again
              </Link>
              .
            </div>
          ) : needs.isLoading ? (
            <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
          ) : needs.data?.length ? (

            <ul className="mt-4 divide-y divide-rule border-t border-rule">
              {needs.data.map((need) => (
                <li key={need.id} className="group flex items-center gap-4 py-4">
                  <Link
                    to="/need/$needId"
                    params={{ needId: need.id }}
                    className="min-w-0 flex-1"
                  >
                    <p className="truncate font-medium text-foreground">
                      {need.title ?? need.raw_input}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {STATUS_LABEL[need.status] ?? need.status} ·{" "}
                      {new Date(need.created_at).toLocaleDateString()}
                    </p>
                  </Link>
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate(need.id)}
                    className="shrink-0 text-xs text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Nothing yet. The first thing you type above will show up here.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
