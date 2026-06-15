# V1.1 Managed Mode + AutoBrief + OpenRouter Routing

## Goal

Ship Managed Mode as the default experience for non-technical founders, AutoBrief onboarding, and task-based OpenRouter model routing — without V2 features.

## Files to change

### Database
- `supabase/migrations/0004_user_settings.sql` — new `user_settings` table + signup trigger
- `lib/supabase/types.ts` — add `user_settings` types

### Provider mode foundation
- `lib/provider-mode.ts` — getProviderModeForUser/Project, isManagedMode, isByokMode
- `services/providers/config.ts` — server-only env config
- `services/providers/status.ts` — redacted provider status for UI
- `lib/postiz-credentials.ts` — resolve managed vs BYOK Postiz credentials

### AI / OpenRouter
- `services/ai/types.ts` — add `AITaskType`, `taskType` param
- `services/ai/model-router.ts` — task → model routing
- `services/ai/runtime.ts` — integrate model router + managed provider resolution
- `services/ai/adapters/openai.ts` — OpenRouter headers, correct provider label
- `services/product-brief/generate.ts` — taskType `autobrief`
- `services/trendwatch/generate.ts` — taskType `trendwatch`
- `services/content-conveyor/generate.ts` — taskType `content`
- `services/compound/generate.ts` — taskType `compound`
- `services/autobrief/*` — fetch, generate, schema, create-project
- `services/ai/adapters/mock.ts` — `[[autobrief]]` mock response

### Onboarding
- `app/(app)/onboarding/layout.tsx`
- `app/(app)/onboarding/page.tsx`
- `app/(app)/onboarding/actions.ts`
- `app/(app)/onboarding/onboarding-wizard.tsx`
- `middleware.ts` — onboarding redirect
- `app/(app)/layout.tsx` — optional onboarding guard

### Settings / Postiz
- `app/(app)/settings/providers/page.tsx`
- `app/(app)/settings/page.tsx` — link to providers
- `app/(app)/settings/postiz/page.tsx` — managed vs BYOK UI
- `app/(app)/projects/[id]/schedule/actions.ts` — managed Postiz path

### Media foundation
- `services/media/fal-config.ts`

### Docs
- `docs/MANAGED_MODE.md`
- `docs/AUTOBRIEF.md`
- `docs/MODEL_ROUTING.md`
- `docs/PROVIDER_SECURITY.md`
- `docs/MEDIA_PROVIDER_PLAN.md`
- `README.md`, `.env.example`

### Tests
- `__tests__/v1-1-managed-mode.test.ts`

## Migrations

`0004_user_settings.sql`:
- `user_settings` with `provider_mode`, `onboarding_completed`, `preferred_llm_mode`, `default_project_id`
- RLS owner-only
- Extend `handle_new_user` to seed row

## Routes / components

| Route | Purpose |
|-------|---------|
| `/onboarding` | Provider mode → URL → AutoBrief → review → create project |
| `/settings/providers` | Managed/Advanced status, model routing summary |

## Provider architecture

```
User (managed) → user_settings.provider_mode = managed
                 → services/providers/config.ts reads env keys
                 → AI via OpenRouter + task router
                 → Postiz via env POSTIZ_*

User (byok)      → user_settings.provider_mode = byok
                 → AI via user's future keys (scaffold)
                 → Postiz via postiz_connections table
```

Server-only keys. Client receives `getProviderStatus()` redacted payload only.

## Tests

- Provider mode defaults to managed
- Status redacts keys
- Model router task mapping
- AutoBrief schema validation
- Fetch failure → manual fallback flag
- Managed Postiz uses env
- BYOK Postiz uses user row
- Missing managed keys → warnings, no key leak

## Acceptance criteria

1. Incomplete onboarding → `/onboarding`
2. Managed Mode default
3. URL paste → safe fetch → AutoBrief → review → project created
4. Provider mode stored
5. Task-based OpenRouter routing
6. Managed keys server-only
7. Managed Postiz scheduling works; BYOK preserved
8. Fal foundation only
9. Docs updated
10. typecheck, lint, test, build pass
