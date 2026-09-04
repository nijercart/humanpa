import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { createCheckoutSession, createPortalSession, getBillingSummary } from "@/lib/billing.functions";

export const Route = createFileRoute("/_authenticated/plans")({
  head: () => ({
    meta: [
      { title: "Plans & credits — HumanOS" },
      {
        name: "description",
        content:
          "Choose a HumanOS plan, top up research credits and manage your subscription and billing.",
      },
      { property: "og:title", content: "Plans & credits — HumanOS" },
      { property: "og:description", content: "Monthly research credits, deep research and saved cases." },
    ],
  }),
  component: PlansPage,
});

function money(cents: number) {
  return cents === 0 ? "$0" : `$${Math.round(cents / 100)}`;
}

function PlansPage() {
  const fetchSummary = useServerFn(getBillingSummary);
  const checkout = useServerFn(createCheckoutSession);
  const portal = useServerFn(createPortalSession);

  const summary = useQuery({
    queryKey: ["billing-summary"],
    queryFn: () => fetchSummary({ data: undefined }),
  });

  const subscribe = useMutation({
    mutationFn: (planCode: string) =>
      checkout({ data: { planCode, origin: window.location.origin } }),
    onSuccess: (result) => {
      if (result.url) window.location.href = result.url;
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Couldn't start checkout."),
  });

  const manage = useMutation({
    mutationFn: () => portal({ data: { origin: window.location.origin } }),
    onSuccess: (result) => {
      if (result.url) window.location.href = result.url;
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Couldn't open billing."),
  });

  const entitlements = summary.data?.entitlements;

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl px-6 py-12">
        <h1 className="font-display text-4xl leading-tight text-foreground">Plans &amp; credits</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          One credit runs one live web research. Answers we already have saved are always free.
        </p>

        {entitlements ? (
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-rule bg-paper p-5">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Current plan
              </p>
              <p className="mt-1 font-display text-2xl text-foreground">{entitlements.planName}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {entitlements.balance} of {entitlements.monthlyCredits} credits left this month ·{" "}
                {entitlements.savedCaseLimit === null
                  ? "unlimited saved cases"
                  : `${entitlements.savedCaseLimit} saved cases`}
              </p>
            </div>
            {entitlements.planCode !== "free" ? (
              <Button variant="outline" onClick={() => manage.mutate()} disabled={manage.isPending}>
                Manage billing
              </Button>
            ) : null}
          </div>
        ) : null}

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {(summary.data?.plans ?? []).map((plan) => {
            const current = entitlements?.planCode === plan.code;
            return (
              <div
                key={plan.code}
                className={`flex flex-col rounded-lg border p-5 ${
                  current ? "border-primary bg-paper" : "border-rule"
                }`}
              >
                <p className="font-display text-xl text-foreground">{plan.name}</p>
                <p className="mt-1 font-display text-3xl text-foreground">
                  {money(plan.price_cents)}
                  <span className="text-sm text-muted-foreground"> /month</span>
                </p>
                <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                  <li>{plan.monthly_credits} research credits</li>
                  <li>{plan.deep_research ? "Deep research" : "Standard research"}</li>
                  <li>Source citations</li>
                  <li>
                    {plan.saved_case_limit === null
                      ? "Unlimited saved cases"
                      : `${plan.saved_case_limit} saved cases`}
                  </li>
                  {plan.priority_processing ? <li>Priority processing</li> : null}
                  {plan.api_access ? <li>API access</li> : null}
                  {plan.team_features ? <li>Team features</li> : null}
                </ul>
                <div className="mt-5 pt-1">
                  {current ? (
                    <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
                      Your plan
                    </p>
                  ) : plan.price_cents === 0 ? (
                    <p className="text-xs text-muted-foreground">Included by default</p>
                  ) : (
                    <Button
                      className="w-full"
                      onClick={() => subscribe.mutate(plan.code)}
                      disabled={subscribe.isPending}
                    >
                      Choose {plan.name}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {summary.data?.ledger?.length ? (
          <section className="mt-12">
            <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Credit history
            </h2>
            <ul className="mt-4 divide-y divide-rule border-t border-rule text-sm">
              {summary.data.ledger.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between py-2.5">
                  <span className="text-muted-foreground">{entry.reason}</span>
                  <span className="font-mono text-foreground">
                    {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </div>
  );
}
