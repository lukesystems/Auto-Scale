# Provider Security

## Principles

1. **Server-only keys** — OpenRouter, Postiz, and Fal keys live in server environment variables (Managed Mode) or Supabase RLS-protected rows (BYOK Postiz).
2. **Never expose to client** — No API keys in React props, API responses, or browser storage.
3. **Never log raw keys** — Use `redactSecret()` from `services/providers/config.ts` if logging credential presence.
4. **Redacted status only** — UI uses `getClientSafeProviderStatus()` (configured: boolean, no secrets).

## Managed Mode

| Secret | Location | Client exposure |
|--------|----------|-----------------|
| `OPENROUTER_API_KEY` | Server env | None |
| `POSTIZ_API_KEY` | Server env | None |
| `FAL_KEY` | Server env | None |

Schedule action resolves credentials via `resolvePostizCredentials()` — never returns keys to the client.

## BYOK Mode (Advanced)

- Postiz: `postiz_connections` table, RLS owner-only
- Form masks saved keys as `**********`
- Future: encrypted at-rest storage

## SSRF (AutoBrief fetch)

Website fetch uses `safeFetchUrl`:

- Blocks private/loopback IPs
- HTTP/HTTPS only
- Timeout and size limits

## Audit

- All AI calls logged to `ai_runs` (provider, model, raw/parsed output, validation errors)
- Postiz responses stored on `scheduled_posts.postiz_response` without echoing API keys
