import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { useCreditStatus } from "@/hooks/use-credit-status";

/** Always-current view of the plan, credits left and saved-case usage. */
export function CreditsPanel({ compact = false }: { compact?: boolean }) {
  const status = useCreditStatus();
  const countdown = useCountdown(status.data?.resetsAt);

  if (status.isLoading || !status.data) {
    return (
      <div
        data-testid="credits-panel"
        className="rounded-lg border border-rule bg-paper p-4 text-xs text-muted-foreground"
      >
        Checking your credits…
      </div>
    );
  }

  const {
    planName,
    remaining,
    limit,
    savedCases,
    savedCaseLimit,
    deepResearch,
    dailyLimit,
    dailyRemaining,
  } = status.data;
  const used = Math.max(0, limit - remaining);
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 100;
  const empty = remaining <= 0;


  return (
    <div data-testid="credits-panel" className="rounded-lg border border-rule bg-paper p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {planName} plan
        </p>
        <p className="font-mono text-xs text-muted-foreground">
          {status.isFetching ? "updating…" : "live"}
        </p>
      </div>

      <p className="mt-2 font-display text-3xl leading-none text-foreground">
        <span data-testid="credits-remaining">{remaining}</span>
        <span className="text-base text-muted-foreground"> / {limit} credits left</span>
      </p>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-rule">
        <div
          className={`h-full rounded-full ${empty ? "bg-destructive" : "bg-primary"}`}
          style={{ width: `${100 - pct}%` }}
        />
      </div>

      <div
        data-testid="daily-quota"
        className="mt-3 flex items-baseline justify-between gap-3 rounded-md border border-rule/70 bg-background/60 px-3 py-2"
      >
        <p className="text-xs text-muted-foreground">
          Today:{" "}
          <span className="font-medium text-foreground">
            {dailyRemaining} of {dailyLimit}
          </span>{" "}
          researches left
        </p>
        <p className="font-mono text-xs text-muted-foreground" title="Resets at midnight UTC">
          resets in {countdown}
        </p>
      </div>

      {!compact ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {savedCases} saved{" "}
          {savedCaseLimit === null ? "cases (unlimited)" : `of ${savedCaseLimit} cases`} ·{" "}
          {deepResearch ? "deep research on" : "standard research"} · saved answers are free
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button asChild size="sm" variant={empty || dailyRemaining <= 0 ? "default" : "outline"}>
          <Link to="/plans">Buy more credits</Link>
        </Button>
        {empty ? (
          <p className="text-xs text-muted-foreground">
            You're out of credits for new live research.
          </p>
        ) : dailyRemaining <= 0 ? (
          <p className="text-xs text-muted-foreground">
            Daily research limit reached — resets in {countdown}.
          </p>
        ) : null}
      </div>

    </div>
  );
}
