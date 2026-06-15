# AutoScale Phase 1-3 Stabilization Plan

## Goal

Ship a testable V1 loop while protecting:

`source -> insight -> content idea -> generated post -> scheduled post -> experiment -> winner -> variant`

## Phase 1: Stability and Security

- Keep secrets out of tracked files and encrypt BYOK Postiz credentials at rest.
- Validate auth redirect targets as local paths.
- Enforce Quality Gate approval on the server and in the UI.
- Enforce project ownership and cross-project relationships with RLS, action checks, and composite foreign keys.
- Keep lint, typecheck, unit tests, and production build green.

Acceptance:

- Approval requires `quality_status=pass`, score >= 0.70, an insight, a content idea, hook, hypothesis, metric, and CTA.
- Cross-project chain references fail.
- External/protocol-relative auth redirects fall back to `/projects`.
- `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build` pass.

## Phase 2: TrendWatch Ingestion

- Accept URL, caption/transcript, publish date, manual metrics, notes, and an optional screenshot.
- Fetch server-side with protocol checks, all-address DNS validation, private/reserved IP blocking, validated redirects, an 8-second timeout, HTML-only responses, and a 1MB streamed body limit.
- Store screenshots privately in Supabase Storage.
- Persist deterministic and AI-assisted source classification fields.
- Calculate null-aware signal and confidence scores without inventing metrics.
- Link generated insights to the strongest available source.

Acceptance:

- Failed fetches remain visible with reasons and low confidence.
- Manual metrics remain manual evidence and are never described as verified scraped metrics.
- Every sourced insight retains `source_id`.

## Phase 3: Postiz and Export

- Validate the Postiz connection through `GET /is-connected`.
- Discover channels through `GET /integrations` and persist integration IDs in `postiz_channels`.
- Schedule approved posts through `POST /posts` using raw `Authorization`.
- Store the remote `postId`, response, status, and errors.
- Queue locally when Postiz is not configured.
- Export CSV, JSON, captions, experiment tracker, and Postiz mapping previews.

Acceptance:

- Scheduling uses a discovered Postiz integration ID when credentials are configured.
- Every schedule links to a generated post and creates at most one experiment.
- Export documentation states that V1 does not render slide PNGs or videos.

## Required Migration

Apply migrations `0001` through `0005` in order. Migration `0005_phase_1_3_completion.sql` adds source metadata, screenshot storage policies, Postiz channels, remote schedule IDs, duplicate experiment protection, and corrected chain delete behavior.
