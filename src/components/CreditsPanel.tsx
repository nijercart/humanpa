import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useCreditStatus } from "@/hooks/use-credit-status";

function useCountdown(target?: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!target) return "";
  const ms = Math.max(0, new Date(target).getTime() - now);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

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

      {!compact ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {savedCases} saved{" "}
          {savedCaseLimit === null ? "cases (unlimited)" : `of ${savedCaseLimit} cases`} ·{" "}
          {deepResearch ? "deep research on" : "standard research"} · saved answers are free
        </p>
      ) : null}

      {empty ? (
        <div className="mt-4">
          <p className="text-xs text-muted-foreground">
            You're out of credits for new live research.
          </p>
          <Button asChild size="sm" className="mt-2">
            <Link to="/plans">Get more credits</Link>
          </Button>
        </div>
      ) : (
        <Link
          to="/plans"
          className="mt-3 inline-block text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Plans &amp; credits
        </Link>
      )}
    </div>
  );
}
