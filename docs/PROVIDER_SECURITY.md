# Provider Security

## Principles

1. **Server-only keys** — OpenRouter, Post Bridge, Fal, and future search/provider keys live in server environment variables or protected storage.
2. **Never expose to client** — No API keys in React props, API responses, or browser storage.
3. **Never log raw keys** — Use `redactSecret()` from `services/providers/config.ts` when logging credential presence.
4. **Redacted status only** — UI uses safe status objects: configured boolean, provider name, warnings, no secrets.
5. **Evidence honesty** — failed or low-confidence source discovery must stay visibly failed/low-confidence.

## Managed Mode

| Secret | Location | Client exposure |
|--------|----------|-----------------|
| `OPENROUTER_API_KEY` | Server env | None |
| `POST_BRIDGE_API_KEY` | Server env | None |
| `FAL_KEY` | Server env | None |
| Future search/provider keys | Server env | None |

Schedule action resolves credentials via `resolvePublishingCredentials()` and never returns keys to the client.

## BYOK Mode (Advanced)

- Post Bridge: `postbridge_connections` table, RLS owner-only
- Form masks saved keys as `**********`
- Future: encrypted at-rest storage for supported BYOK credentials

## SSRF and source fetch safety

Website/source fetch uses safe fetch behavior:

- HTTP/HTTPS only
- private/loopback IP protection
- redirect validation
- timeout limits
- body-size limits
- content-type checks

This applies to:

- AutoBrief product-site fetch
- TrendWatch source URL fetch
- future Scraping Engine public-source fetch

## Scraping Engine security rules

The Scraping Engine must operate only on public, accessible sources and respect platform access limits.

Required controls:

1. Normalize and validate every URL before fetch.
2. Reject unsafe hosts and private IP ranges.
3. Use adapter-specific rate limits.
4. Store fetch status and fetch error instead of hiding failures.
5. Store the discovery adapter and discovery query for auditability.
6. Avoid collecting private personal data.
7. Do not store more raw page text than needed for product intelligence.
8. Do not expose raw provider responses containing secrets or internal diagnostics.
9. Label candidate/unverified sources clearly.
10. Keep source attribution attached to downstream insights.

## Data stored for discovery

Allowed discovery metadata:

```txt
source_url
canonical_url
platform
account_handle
account_type
discovery_query
discovery_adapter
discovery_reason
fetch_status
fetch_error
fetched_text snippet
fetch_metadata
confidence_score
signal_score
scoring_reasons
```

Avoid storing unnecessary personal data or full raw archives.

## Audit

- All AI calls should be logged to `ai_runs` with provider, model, input summary, parsed output, validation errors, and status.
- Post Bridge responses are stored on `scheduled_posts.postbridge_response` without echoing API keys.
- Scraping Engine runs should store discovery plan, candidate counts, fetch counts, failed counts, confidence, and run notes.
- Every downstream TrendWatch insight should be traceable to a source, a run, or a low-confidence caveat.
