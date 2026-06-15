# Skill: Postiz Scheduler

## Purpose

Push approved posts to Postiz for actual publishing. Fall back to manual export when Postiz is unavailable, offline, or unconfigured.

## Inputs

- An approved post (with slides, caption, CTA)
- A target channel (string the Postiz workspace recognizes)
- A scheduled timestamp (ISO 8601)
- User's Postiz connection (`postiz_connections` row: api_url, api_key)

## Workflow

1. Validate post is `status = approved`.
2. Build a `PostizSchedulePayload` (services/postiz/client.ts).
3. Insert `scheduled_posts` row with `status = pending`.
4. Call `sendToPostiz()`.
5. Update `scheduled_posts.status` with one of: `scheduled`, `failed`, `queued_local`.
6. Auto-create `experiments` row tied to the scheduled post.
7. Mark `generated_posts.status = scheduled` only when Postiz accepted.

## Output / response shape

```ts
{
  ok: boolean,
  status: "scheduled" | "failed" | "pending" | "queued_local",
  remoteId?: string,
  error?: string,
  raw?: unknown,
}
```

## Quality rules

- Never block scheduling on Postiz being available. Always fall back to `queued_local`.
- Store `postiz_response` verbatim so we can debug platform-specific errors later.
- Don't overwrite the `postiz_payload` after the call — keep the original for audit.
- Don't silently retry — surface the error to the founder so they can decide.

## Failure cases

- No connection → `queued_local` with explanatory `error_message`.
- 4xx from Postiz → `failed`, manual export still available.
- Network error → `failed` with retryable error message.

## Future (V1.2+)

- Channel sync (read available channels from Postiz on demand).
- Bulk scheduling with gap-aware spacing (no two carousel-style posts within 6h on the same channel).
- Auto-reschedule failed posts with exponential backoff.
- Status sync (poll Postiz for posted state).
- Postiz analytics ingestion where available.
