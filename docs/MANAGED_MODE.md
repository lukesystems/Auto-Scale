# Managed Mode

AutoScale V1.1 defaults to **Managed Mode** for non-technical founders.

## What it means

- AutoScale uses server-side environment variables for OpenRouter, Postiz, and (future) Fal.
- Users do not enter API keys during onboarding or day-to-day use.
- Missing AI keys fail loudly with the real configuration error. Scheduling still supports the local/manual export path.

## Provider modes

| Mode | Who brings keys | Default |
|------|-----------------|---------|
| `managed` | AutoScale (env vars) | Yes |
| `byok` | User (Advanced settings) | No |

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

Optional: `FAL_KEY` (foundation only — media generation not active).

## User flow

1. Sign up / sign in
2. Redirect to `/onboarding` if `onboarding_completed = false`
3. Choose Managed (default) or Advanced
4. AutoBrief → project created → workspace

## Settings

- `/settings/providers` — redacted status, model routing summary, warnings
- `/settings/postiz` — "Managed by AutoScale" in Managed Mode; BYOK form in Advanced Mode

See also: [MODEL_ROUTING.md](./MODEL_ROUTING.md), [PROVIDER_SECURITY.md](./PROVIDER_SECURITY.md).
