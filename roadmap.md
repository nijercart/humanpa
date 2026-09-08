# Roadmap

## Blocked (needs user action)
- [ ] Stripe keys (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) must be added before live checkout/portal works. Approval was declined; re-request when ready.

## Open
- [ ] API access surface (keys, rate limits) for Expert and Business plans.
- [ ] Team features (shared workspace, seats) for Business plan.
- [ ] Priority processing queue for Pro and above.

## Done
- [x] Plans & credits: DB schema, entitlements, credit-gated research, Plans page with Stripe checkout plumbing.
- [x] Live credits/quota status panel with exact monthly balance and upgrade CTA.
- [x] Free limited (single-pass) research and paid deep (agentic) research branching.
- [x] Knowledge Flywheel cached-answer path verified (repeat run served from cache, no quota spent).
- [x] Friendly "out of AI credits" error message instead of raw "Payment Required".
