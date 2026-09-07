# Finish HumanOS core MVP

The app already has auth, the Knowledge Flywheel, saved cases, plans/credits schema, entitlements, a Plans page and a live credits panel. To mark the core MVP complete we need to clean up the legacy daily-quota UI, make the Free plan truly "limited" (single-pass research), activate Stripe checkout, and run a full end-to-end verification. API access, team features and priority processing stay post-MVP.

## What is in scope for core MVP

- Credit-based research gating (monthly credits, no daily cap).
- Free plan = standard/single-pass research; paid plans = deep agentic research.
- Stripe subscription checkout + billing portal + webhook-driven credit grants.
- Saved-case limits enforced server-side.
- Cached Knowledge Flywheel answers remain free and unlimited.
- Live credits panel shows exact remaining credits and a clear upgrade CTA.

## What is out of scope (post-MVP)

- API access surface (keys, rate limits) for Expert/Business.
- Team workspace/seats for Business.
- Priority processing queue.

## Steps

### 1. Remove legacy daily-quota messaging

The credit system replaces the old "2 researches per UTC day" cap, but the UI still shows a daily counter.

- Update `getResearchQuota` in `src/lib/needs.functions.ts` to stop returning `dailyLimit`, `dailyUsed`, `dailyRemaining` and `resetsAt`.
- Update `useCreditStatus` return type through the React Query hook.
- Simplify `CreditsPanel` to show only: plan name, `remaining / limit` credits, progress bar, saved-case usage, and the "Buy more credits" button.
- Update `needs.tsx` and `need.$needId.tsx` helper text to credit-only messaging.

### 2. Implement Free "Limited" single-pass research

Currently every live run uses the deep agentic loop. The plan promises Free users a single shallow search pass.

- Add a `deepResearch: boolean` argument to `researchNeed` in `src/lib/humanos.server.ts`.
- Pass `deepResearch` from `runResearch` in `src/lib/needs.functions.ts` based on `entitlements.deepResearch`.
- When `deepResearch` is false:
  - Run one `webSearch` call with a query derived from the restated problem + answers.
  - Ingest the results into the flywheel.
  - Synthesize options/steps/recommendation from those sources only.
- When `deepResearch` is true, keep the existing multi-step `streamText` + `web_search` tool loop.
- Ensure the credit is still spent only after a successful live run, and cached answers still cost nothing.

### 3. Activate Stripe checkout

Checkout code exists but cannot run without secrets.

- Add `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` via the secrets tool (requires your approval).
- Confirm `src/routes/api/public/stripe-webhook.ts` handles:
  - `checkout.session.completed` -> create subscription + grant credits.
  - `customer.subscription.updated/deleted` -> update plan/status.
  - `invoice.paid` -> idempotent monthly refill using `grant_plan_credits`.
- Add a small admin helper (server-only, not exposed to the UI) so we can manually grant/test a plan when Stripe is in test mode or while keys are pending.

### 4. Polish the Plans page

- Highlight the current plan clearly.
- Show "Your plan" vs "Choose" buttons correctly.
- Add a one-line explanation that cached/saved answers are free.
- Keep credit history list but format reasons as readable labels (`plan_grant`, `research`, etc.).

### 5. End-to-end verification

Run these checks from a signed-in session:

1. **Cached answer is free:** run a known problem twice; second run has `usedLiveSearch: false`, balance unchanged.
2. **Live research spends exactly 1 credit:** new problem with no cache -> balance drops by 1, `credit_transactions` records `research -1`.
3. **Free plan is single-pass:** inspect sources count / briefing depth on a Free account; it should be smaller than deep research on Pro.
4. **Saved-case cap blocks creation:** fill the Free limit (3), confirm `createNeed` throws the upgrade-or-delete message.
5. **Out-of-credits state:** set balance to 0, request a new uncached problem, confirm the inline "Upgrade your plan" message appears and no credit is deducted.
6. **Stripe test checkout (once keys are added):** complete a test subscription, verify `user_subscriptions` and `user_credits` update, portal opens, cancellation updates status.

## Acceptance criteria

- `bunx tsgo --noEmit` passes.
- No runtime errors on `/needs`, `/need/:id`, or `/plans`.
- A Free user can sign up, ask a problem, get a single-pass researched plan, and see credits decrement from 10 to 9.
- A repeat of the same problem returns the cached answer at no cost.
- A paid test checkout upgrades the plan and credits in the database.
- API/team/priority features are not built yet and are documented as follow-ups.
