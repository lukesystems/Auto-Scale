# Managed Mode

AutoScale defaults to **Managed Mode** for non-technical founders.

Managed Mode means AutoScale owns the server-side provider configuration. Users should not need to bring OpenRouter or Postiz keys to complete onboarding and run the first growth loop.

## What it means

- AutoScale uses server-side environment variables for OpenRouter, Postiz, and future provider-backed services.
- Users do not enter API keys during onboarding or normal use.
- Missing AI keys fail loudly with the real configuration error.
- Scheduling still supports local/manual export when Postiz is not configured.

## Provider modes

| Mode | Who brings keys | Default |
|------|-----------------|---------|
| `managed` | AutoScale server env | Yes |
| `byok` | User / Advanced settings where supported | No |

Stored in `user_settings.provider_mode`.

## Required env vars (Managed Mode)

```env
AUTOSCALE_PROVIDER_MODE_DEFAULT=managed
OPENROUTER_API_KEY=
POSTIZ_API_URL=https://api.postiz.com/public/v1
POSTIZ_API_KEY=
AUTOSCALE_MODEL_AUTOBRIEF=
AUTOSCALE_MODEL_TRENDWATCH=
AUTOSCALE_MODEL_CONTENT=
AUTOSCALE_MODEL_QUALITY_GATE=
AUTOSCALE_MODEL_COMPOUND=
AUTOSCALE_MODEL_DEFAULT=
```

Optional: `FAL_KEY` for future media generation foundation.

## Scraping Engine direction

The Scraping Engine should also run in Managed Mode.

Founders should not need to configure scraping/search providers before value is proven. Server-side adapters should handle public discovery and source enrichment.

Future managed provider config may include:

```env
AUTOSCALE_SEARCH_PROVIDER=
AUTOSCALE_SEARCH_API_KEY=
AUTOSCALE_MODEL_SOURCE_DISCOVERY=
AUTOSCALE_MODEL_SOURCE_CLASSIFICATION=
AUTOSCALE_MODEL_PATTERN_MINING=
```

Do not make these required until implementation exists.

## User flow

1. Sign up / sign in.
2. Redirect to `/onboarding` if `onboarding_completed = false`.
3. Use Managed Mode by default.
4. AutoBrief reads the product URL and creates a Product Brief.
5. Scraping Engine discovers/enriches public competitor/source candidates.
6. TrendWatch analyzes enriched sources.
7. User generates experiments, exports/schedules, measures, and compounds.

## Settings

- `/settings/providers` — redacted status, model routing summary, warnings
- `/settings/postiz` — "Managed by AutoScale" in Managed Mode; BYOK form in Advanced Mode

Future scraping settings should show status only:

```txt
Search provider configured: yes/no
Discovery adapters enabled: web/search/manual/social adapter status
Last discovery run: timestamp/status
```

Never show raw provider keys to the client.

See also: [MODEL_ROUTING.md](./MODEL_ROUTING.md), [SCRAPING_ENGINE.md](./SCRAPING_ENGINE.md), [PROVIDER_SECURITY.md](./PROVIDER_SECURITY.md).
