# HumanOS plans and buyable credits

Today every account gets 2 free live researches per UTC day and cached Knowledge Flywheel answers are free. This replaces that with monthly subscription plans people can buy from their dashboard, each granting a monthly credit allowance plus feature access.

## Plans

| | Free | Starter | Pro (highlighted) | Expert | Business |
| --- | --- | --- | --- | --- | --- |
| Monthly | $0 | $19 | $49 | $129 | $349 |
| Credits / month | 10 | 150 | 500 | 1,500 | 5,000 |
| Research | Limited | yes | yes | yes | yes |
| Deep Research | — | yes | yes | yes | yes |
| Source citations | yes | yes | yes | yes | yes |
| Saved cases | 3 | 20 | 100 | Unlimited | Unlimited |
| Priority processing | — | — | yes | yes | yes |
| API access | — | — | — | yes | yes |
| Team features | — | — | — | — | yes |

## How it works for the user

- Every account starts on Free with 10 credits.
- A live web research costs 1 credit. A cached (flywheel) answer stays free — no credit, no limit.
- Credits refill to the plan allowance at the start of each billing month; unused credits do not roll over.
- "Saved cases" caps how many problems can be kept; at the cap the app asks the user to delete one or upgrade.
- "Deep Research" is the current multi-step agentic search loop. Free is "Limited": a single shallow search pass, no deep loop.
- "Priority processing" puts Pro and above ahead of Free/Starter when several researches run at once.
- API access and Team features are gated flags shown on the plan but built later — the plan page marks them as included, and the app enforces the flag when those surfaces exist.
- New "Plans & credits" page on the dashboard: current plan, credits left this month, upgrade/downgrade, and billing history. Buying opens Stripe Checkout; managing or cancelling opens the Stripe billing portal.

## Research gating

```text
research requested
  -> cached answer covers it? yes -> free, no credit
  -> credits left this month? no  -> "Out of credits" + link to Plans
  -> deep research allowed on plan? yes -> agentic loop, else single-pass search
  -> on success -> deduct 1 credit and log it
```

A credit is only deducted after the research succeeds; failures cost nothing.

## Technical plan

**Database (one migration, GRANTs + RLS in the same file)**
- `plans` — code, name, price cents, stripe price id, monthly credits, saved case limit (null = unlimited), booleans for deep research / priority / api / team, sort order, active. Readable by `anon` and `authenticated`; seeded with the five rows above.
- `user_subscriptions` — user_id (PK), plan code (default `free`), status, stripe customer id, stripe subscription id, current period start/end. Owner-only SELECT, no client writes.
- `user_credits` — user_id (PK), balance, period_start. Owner-only SELECT, server writes only.
- `credit_transactions` — user_id, delta, reason (`plan_grant` | `research` | `adjustment`), need_id, stripe_event_id (unique), created_at. Owner-only SELECT.
- Security-definer functions: `spend_credit(user, need)` (atomic, cannot overspend), `apply_plan_grant(user, plan, period_start, event_id)` (idempotent monthly refill), `current_entitlements(user)` returning the merged plan + balance.
- Trigger on new accounts creates the Free subscription, 10 credits, and the ledger row; one-time backfill for existing accounts.
- `research_runs` stays as the historical log; the daily 2-per-day cap is removed in favour of credits.

**Payments (Stripe, your own keys — your stated choice)**
- Secrets: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
- `src/lib/billing.functions.ts` behind `requireSupabaseAuth`: `getBillingSummary`, `createCheckoutSession` (price resolved server-side from the `plans` row, never from the client), `createPortalSession`.
- `src/routes/api/public/stripe-webhook.ts`: verifies the signature, then handles `checkout.session.completed`, `customer.subscription.updated/deleted`, and `invoice.paid` (monthly credit refill), all keyed on the Stripe event id so replays cannot double-credit.

**App logic**
- `src/lib/entitlements.server.ts` — one place that loads a user's plan, credits and limits.
- `src/lib/needs.functions.ts` — replace the daily-quota check with the credit/entitlement check above; pass a `deepResearch` flag into `researchNeed`; enforce the saved-case cap in `createNeed`; deduct a credit only on a successful live run.
- `src/lib/humanos.server.ts` — honour the `deepResearch` flag: full agentic loop when allowed, one search pass and synthesis when not.

**UI**
- New route `src/routes/_authenticated/plans.tsx`: current plan, credits remaining, the comparison table above, upgrade buttons, portal link, billing history, and its own `head()` metadata.
- Header shows credits remaining and links to Plans.
- `needs.tsx` / `need.$needId.tsx`: replace "researches left today" with "N credits left"; blocked states link to Plans; saved-case cap shows an upgrade prompt.

**Note on Stripe:** Lovable's built-in payments would avoid handling keys but requires a paid workspace plan; per your choice this uses your own Stripe keys.

## Verification before hand-off

- RLS checked from a signed-in session: users read only their own subscription, credits and ledger; no client-side balance writes.
- Stripe test mode: checkout, plan change, cancellation, and a replayed webhook (no double credit).
- Research: cached answer costs nothing, live run deducts exactly 1 credit, zero balance blocks with the upgrade prompt, Free account gets the single-pass path while Pro gets the deep loop.
- Saved-case cap enforced server-side, not just hidden in the UI.

## Follow-ups (tracked in roadmap.md at build time)

- API access surface (keys, rate limits) for Expert and Business.
- Team features (shared workspace, seats) for Business.
