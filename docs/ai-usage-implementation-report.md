# MUN Prep AI daily token allowance — implementation report

**Status: CODE COMPLETE AND DEPLOYED; FULL PRODUCTION ENFORCEMENT NOT READY UNTIL THE SUPABASE MIGRATION IS APPLIED.**

## Delivered implementation

The application now reserves and settles AI tokens on the server for the single discovered AI entrypoint, `POST /api/ai/research`. All visible AI workspaces continue to use the shared route, so the control applies across research, country profiles, position papers, speeches, POIs, and resolutions. The authenticated Supabase UID is obtained from the existing server-side session validation; no browser-supplied UID, front-end counter, cookie, or local state is trusted for accounting. The existing paid-access gate remains unchanged, so the allowance applies to authenticated requests that are otherwise entitled to use AI, plus the existing verified administrator testing path.

The new migration creates `ai_usage_daily`, keyed by `(uid, usage_date)`, and `ai_usage_reservations`, keyed by a server-generated UUID. The reserve RPC locks the current UTC-day counter and atomically admits a reservation only when used plus reserved plus requested tokens is within the configured limit. Reconcile and release lock the reservation and counter, transition the reservation only once from `pending` to `settled` or `released`, and treat duplicate finalization as a no-op. This prevents concurrent requests from oversubscribing the allowance and prevents duplicate stream cleanup from double-charging or releasing another request's reservation. The UTC date is selected inside Postgres, so a new UTC date naturally starts a new row without a reset job.

The server reserves before invoking NVIDIA or OpenRouter. NVIDIA and OpenRouter adapters normalize OpenAI-compatible usage events. OpenRouter's current documentation says usage is included automatically in the final streaming chunk; its deprecated `stream_options.include_usage` flag was removed from that adapter. When provider usage is present, the server settles the reported total. When usage metadata is absent but provider bytes were received, it conservatively settles the entire reservation rather than undercounting. Provider failures before any stream data release the reservation, while stream errors and client cancellation perform one best-effort settlement. Completed transcripts retain the existing Storage/database persistence and multi-turn context behavior.

The authenticated `GET /api/me/ai-usage` endpoint exposes a private, no-store usage snapshot for the current user. The shared workspace displays used, limit, and remaining tokens, refreshes after successful generations, and rolls back speculative user turns on limit, entitlement, provider, and cancellation failures while retaining the prompt for retry. The optional administrator panel reads a server-generated usage summary and does not accept a client UID.

## Validation completed

| Check | Result |
|---|---:|
| `pnpm install --frozen-lockfile` | Passed |
| `pnpm lint` | Passed |
| `pnpm typecheck` | Passed |
| `pnpm test` | Passed |
| `pnpm build` | Passed |
| `git diff --check` | Passed |
| `pnpm audit --prod` | Passed; 0 info/low/moderate/high/critical findings |
| Focused source scan for browser bypasses and provider-secret exposure | Passed; provider keys remain server-only references |
| Deterministic unit tests | Passed; usage normalization, fallback safety, reservation bounds, prior-context accounting, UTC migration contract, RLS denial, UUID reservations, and terminal-state protection covered |

The repository is clean after commit `c22d7f69cf4675b1172d02c90de915ecdca8735f` (`Enforce daily AI token usage limits`), pushed to `main` with author email `sahajgangwani@gmail.com`.

## Deployment and smoke tests

The Git-linked Vercel production deployment is READY:

| Item | Value |
|---|---|
| Vercel project | `mun-ai-app` |
| Deployment | `dpl_85t6WmfzRMyPB2KQWZVzxR1meRed` |
| Commit | `c22d7f69cf4675b1172d02c90de915ecdca8735f` |
| Production alias | [mun-ai-app.vercel.app](https://mun-ai-app.vercel.app) |
| Deployment state | `READY` |

Anonymous production checks returned the expected protection behavior: `/` returned `200`; `GET /api/me/ai-usage` returned `401`; `POST /api/ai/research` returned `401`; and `GET /api/admin/ai-usage` returned `401`. A `GET` to the POST-only research endpoint returned `405`, as expected. These checks do not prove authenticated token accounting because the database migration is not yet present in the production project.

## Required Supabase operator action

The Supabase management connector was checked but is unavailable in this session (`server not found`), and no authorized SQL-management connection is available. Therefore, **the migration has not been applied and must not be represented as applied**. An authorized Supabase operator must run the complete file `supabase/migrations/20260826_ai_usage_daily.sql` in the production project's SQL editor or through an authenticated Supabase migration workflow, after the existing core data-contract migrations. The same production project must contain `auth.users`, `public.users`, and the previously required `ai_generations`/entitlement schema before testing.

After applying it, verify that both usage tables have RLS enabled and no `anon`/`authenticated` table grants, that only `service_role` can execute the three RPCs, and that the RPC signatures are the UUID-reservation versions. Then use a dedicated authorized test account to confirm a successful generation, provider-usage settlement, failed/empty-stream release, client cancellation settlement, duplicate-finalization no-op, concurrent reservations near the boundary, a `daily_token_limit_reached` HTTP 429 response with `limit`, `used`, `remaining`, and `resetAt`, and fresh allowance behavior after the next UTC date. Until those steps pass, production AI enforcement should be considered **pending migration activation**; the deployed route may fail closed when it cannot find the usage table/RPCs rather than silently bypassing the cap.

## References

[1]: https://docs.nvidia.com/nim/large-language-models/latest/api-reference.html "NVIDIA NIM API Reference"
[2]: https://openrouter.ai/docs/cookbook/administration/usage-accounting "OpenRouter Usage Accounting"
[3]: https://openrouter.ai/docs/api_reference/streaming "OpenRouter Streaming"

NVIDIA's API reference describes `/v1/chat/completions` as an OpenAI-compatible streaming endpoint.[1] OpenRouter documents automatic usage information in the final streaming chunk, deprecates `stream_options.include_usage`, and documents streaming cancellation and mid-stream error behavior.[2] [3]
