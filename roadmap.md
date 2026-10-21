# Roadmap

## Blocked (needs user action)
- [ ] Stripe keys (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) must be added before live checkout/portal works. Approval was declined; re-request when ready.

## Open
- [ ] Priority processing queue for Pro and above.
- [ ] Team & multi-seat workspaces (Business): shared cases, team billing, shared credit pools.

## In progress
- [ ] Search & categorization: full-text search and category tags across saved needs.

## Done
- [x] API access surface: developer keys (hashed, shown once), per-plan hourly rate limits, /api/public/v1/{me,needs,needs/:id} read-only endpoints, /api key management page with docs. Verified end-to-end: key create/revoke, 401/403/404/429 handling, Expert rate limit cut in at 301 requests; account restored to Pro afterwards.

## Done
- [x] Persisted checklist completion: step ticks save with completion timestamps and progress bars on saved problems (verified end-to-end: tick → reload → still ticked, and untick → saved).
- [x] Plans & credits: DB schema, entitlements, credit-gated research, Plans page with Stripe checkout plumbing.
- [x] Live credits/quota status panel with exact monthly balance and upgrade CTA.
- [x] Free limited (single-pass) research and paid deep (agentic) research branching.
- [x] Knowledge Flywheel cached-answer path verified (repeat run served from cache, no quota spent).
- [x] Friendly "out of AI credits" error message instead of raw "Payment Required".
