import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { getResearchHistory } from "@/lib/history.functions";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "Research history — HumanOS" },
      {
        name: "description",
        content:
          "Review every past HumanOS research run: the topic, how many sources it used, credits spent and whether the answer came from saved knowledge.",
      },
      { property: "og:title", content: "Research history — HumanOS" },
      {
        property: "og:description",
        content: "Track past research runs, sources, credits used and cached answers.",
      },
    ],
  }),
  component: HistoryPage,
});

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function HistoryPage() {
  const fetchHistory = useServerFn(getResearchHistory);
  const history = useQuery({
    queryKey: ["research-history"],
    queryFn: () => fetchHistory({ data: undefined }),
  });

  const rows = history.data?.rows ?? [];
  const totals = history.data?.totals;

  return (
    <div className="min-h-dvh">
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <h1 className="font-display text-3xl">Research history</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Everything you've worked on, with the sources found, credits used and whether the answer
          came from saved knowledge.
        </p>

        {totals ? (
          <div className="mt-6 flex flex-wrap gap-6 rounded-lg border border-rule p-4 text-sm">
            <span>
              <strong className="font-display text-lg">{totals.runs}</strong>{" "}
              <span className="text-muted-foreground">runs</span>
            </span>
            <span>
              <strong className="font-display text-lg">{totals.credits}</strong>{" "}
              <span className="text-muted-foreground">credits used</span>
            </span>
            <span>
              <strong className="font-display text-lg">{totals.cached}</strong>{" "}
              <span className="text-muted-foreground">from saved knowledge</span>
            </span>
          </div>
        ) : null}

        {history.isPending ? (
          <p className="mt-8 text-sm text-muted-foreground">Loading your history…</p>
        ) : history.isError ? (
          <p className="mt-8 text-sm text-destructive">
            {history.error instanceof Error ? history.error.message : "Couldn't load your history."}
          </p>
        ) : rows.length === 0 ? (
          <div className="mt-8 rounded-lg border border-rule p-6">
            <p className="text-sm text-muted-foreground">Nothing here yet.</p>
            <Button asChild size="sm" className="mt-4">
              <Link to="/needs">Start your first one</Link>
            </Button>
          </div>
        ) : (
          <ul className="mt-8 divide-y divide-rule border-y border-rule">
            {rows.map((row) => (
              <li key={row.needId} className="py-4">
                <Link
                  to="/need/$needId"
                  params={{ needId: row.needId }}
                  className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-foreground">{row.topic}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {formatDate(row.createdAt)} · {row.status}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                    <span>{row.sources} sources</span>
                    <span>
                      {row.creditsUsed} credit{row.creditsUsed === 1 ? "" : "s"}
                    </span>
                    <span
                      className={
                        row.cached
                          ? "rounded-full border border-rule px-2 py-0.5 text-foreground"
                          : "rounded-full border border-rule px-2 py-0.5"
                      }
                    >
                      {row.cached ? "Saved knowledge" : "Live search"}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
