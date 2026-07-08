# Post Bridge Integration

## What V1 Supports

- Managed server credentials (`POST_BRIDGE_API_KEY`) or encrypted BYOK credentials.
- Connection test via `GET /v1/social-accounts`.
- Account sync → `postbridge_channels` + `connected_accounts` (opaque remote account IDs).
- Scheduling via `POST /v1/posts` with uploaded media IDs.
- Status polling via `GET /v1/posts/{id}` for autopilot sync.
- Local queue and export fallback when Post Bridge is unavailable.

## Setup

### Managed mode

```env
PUBLISHING_PROVIDER=postbridge
POST_BRIDGE_API_KEY=pb_live_...
# Optional override (default https://api.post-bridge.com/v1)
POST_BRIDGE_API_URL=https://api.post-bridge.com/v1
```

### BYOK (Advanced mode)

```env
PUBLISHING_PROVIDER=postbridge
POSTBRIDGE_CREDENTIAL_ENCRYPTION_KEY=a-long-random-server-secret
```

In AutoScale, open **Settings → Publishing** (`/settings/publishing`), save your `pb_live_...` key, test the connection, then sync channels.

## API assumptions

- Auth: `Authorization: Bearer {apiKey}`.
- Media: Post Bridge requires `POST /v1/media/create-upload-url` + `PUT` upload before scheduling. AutoScale fetches public `mediaUrls` / `imageUrls` and uploads them automatically.
- Posts body: `{ caption, scheduled_at, social_accounts: [id], media: [media_id] }`.
- Status mapping: `published`/`posted` → posted; `failed`/`error` → failed; `scheduled`/`pending` → scheduled.

## Stored Data

- `postbridge_connections`: encrypted BYOK API key, status.
- `postbridge_channels` / `connected_accounts`: remote account IDs.
- `schedule_items.postbridge_post_id`: opaque remote post ID.

API keys never reach client components.

## Cutover notes (Phase 1)

1. Set `PUBLISHING_PROVIDER=postbridge` on staging.
2. Configure `POST_BRIDGE_API_KEY` (managed) or BYOK in settings.
3. Sync channels and verify Growth Run schedule + autopilot status sync.
4. Post Bridge is the only live publishing provider; the retired Postiz integration has been fully removed.

## Failure behavior

- No credentials: schedules save locally as `queued`.
- Invalid API response: `failed` status + normalized error.
- Disabled account: block scheduling.
- Export-only: `PUBLISHING_PROVIDER=export_only` bypasses remote APIs.

## Smoke test (optional)

```bash
POST_BRIDGE_SMOKE_TEST=1 \
POST_BRIDGE_API_KEY=pb_live_... \
POST_BRIDGE_SMOKE_ACCOUNT_ID=... \
POST_BRIDGE_SMOKE_VIDEO_URL=https://example.com/sample.mp4 \
npm run smoke:postbridge
```
