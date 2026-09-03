# Buyable research credits

Today every account gets 2 free live researches per UTC day (`research_runs` counts them) and cached Knowledge Flywheel answers are free. This adds a credit balance people can top up with a card, used only after the free daily allowance runs out.

## How it will work for the user

- Each account has a credit balance, starting at 10 free credits.
- A live web research costs 1 credit — but only after the 2 free daily researches are used.
- A cached (flywheel) answer stays free forever and never touches credits or the daily limit.
- A new "Credits" page on the dashboard shows the balance, recent activity, and the packs below.
- Buying opens Stripe Checkout; on success the credits land in the balance and the page shows the new total.
- Enterprise is a "Contact us" mailto link, not a checkout.

| Pack | Credits | Price |
| --- | --- | --- |
| Free (on signup) | 10 | — |
| Starter | 50 | $9 |
| Explorer | 150 | $19 |
| Pro (highlighted) | 500 | $49 |
| Expert | 1,500 | $129 |
| Power | 5,000 | $349 |
| Enterprise | Custom | Contact |

Credits never expire and are not refundable — stated on the page.

## What runs when someone researches

```text
research requested
  -> cached answer covers it?  yes -> free, no credit, no daily use
  -> free daily researches left? yes -> use one, no credit spent
  -> credit balance > 0?        yes -> spend 1 credit, run live research
  -> otherwise -> "Out of credits" with a link to the Credits page
```

A credit is only deducted after the research actually succeeds; failures cost nothing.

## Technical plan

**Database (one migration, with GRANTs and RLS)**
- `credit_packs` — id, name, credits, price cents, stripe price id, sort order, active. Readable by `anon`/`authenticated`; seeded with the six paid packs.
- `user_credits` — user_id (PK), balance int, updated_at. Owner-only SELECT; no client writes. A trigger on `auth.users` seeds 10 credits per new account, plus a one-time backfill for existing accounts.
- `credit_transactions` — user_id, delta, reason (`signup_grant` | `purchase` | `research`), need_id, stripe_session_id (unique), created_at. Owner-only SELECT; server writes only.
- `spend_credit(p_user_id, p_need_id)` and `grant_credits(...)` security-definer functions that update the balance and write the ledger atomically, so concurrent runs cannot overspend.

**Payments (Stripe, your own keys)**
- Secrets: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, requested via the secret tool.
- `src/lib/billing.functions.ts` — `getCreditSummary` (balance + free-daily remaining + ledger) and `createCheckoutSession`, both behind `requireSupabaseAuth`. Checkout is created server-side from the pack row, never from a client-sent price.
- `src/routes/api/public/stripe-webhook.ts` — verifies the Stripe signature, then on `checkout.session.completed` calls `grant_credits` keyed on the session id so replays cannot double-credit.

**Research flow (`src/lib/needs.functions.ts`)**
- Replace the current `allowLiveSearch = usedToday < DAILY_RESEARCH_LIMIT` check with: free-daily left, else balance > 0.
- After a successful run with `usedLiveSearch === true`: consume a free daily slot (`research_runs`) when one is left, otherwise call `spend_credit`.
- Cached runs stay untouched — no ledger row, no `research_runs` row.
- Replace `QUOTA_EXHAUSTED` messaging with an out-of-credits message pointing at the Credits page.

**UI**
- New route `src/routes/_authenticated/credits.tsx`: balance header, pack grid, purchase state from `?checkout=success|cancelled`, ledger table, own `head()` metadata.
- Header link to Credits, with the balance beside it.
- `needs.tsx` and `need.$needId.tsx`: quota line becomes "2 free today + N credits", and the disabled/blocked states link to Credits instead of only saying "resets at midnight UTC".

**Note on Stripe:** Lovable's built-in payments would avoid key handling but need a paid workspace plan; per your choice this uses your own Stripe keys, which works on the current plan.

## Verification before hand-off

- Migration applied, RLS checked from a signed-in session (own rows only, no client writes to balances).
- Stripe test-mode checkout end to end, webhook replay tested for double-credit safety.
- A live research with free days remaining consumes a `research_runs` row and no credit; with the daily limit used, it consumes exactly 1 credit; a cached answer consumes neither.
