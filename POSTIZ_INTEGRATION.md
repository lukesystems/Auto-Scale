# Postiz Integration

## What V1 Supports

- Managed server credentials or encrypted BYOK credentials.
- Connection test via `GET /public/v1/is-connected`.
- Channel discovery via `GET /public/v1/integrations`.
- Scheduling via `POST /public/v1/posts`.
- Local queue and export fallback when Postiz is unavailable.

## Setup

Managed mode:

```env
POSTIZ_API_URL=https://api.postiz.com
POSTIZ_API_KEY=...
```

Advanced/BYOK mode also requires:

```env
POSTIZ_CREDENTIAL_ENCRYPTION_KEY=a-long-random-server-secret
```

In AutoScale, open **Settings -> Postiz**, test the connection, then sync channels. Scheduling must use the discovered integration ID.

## Stored Data

- `postiz_connections`: API URL, encrypted BYOK key, status.
- `postiz_channels`: integration ID, platform identifier, profile/name, disabled state, raw metadata.
- `scheduled_posts`: local payload, response, remote `postId`, status, error.

API keys never reach client components.

## Failure Behavior

- No credentials: save the schedule locally as `queued_local`.
- Invalid API response: store `failed` and the normalized error.
- Disabled channel: block scheduling.
- Configured credentials with an unknown channel: require channel sync.
