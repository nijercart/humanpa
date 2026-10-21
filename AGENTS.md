<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules

- Developer API keys are stored only as SHA-256 hashes in `public.api_keys`; the plaintext is returned once at creation and verified solely by `/api/public/v1/*` routes through `src/lib/api-auth.server.ts`. Why: routes under `api/public` bypass site auth, so the handler must be the security boundary.
- Per-plan API rate limits live in `plans.api_rate_limit_per_hour` and are enforced by the `bump_api_rate` security-definer function against hourly rows in `public.api_rate_buckets`. Why: workers are stateless, so limits must be counted in the database.
