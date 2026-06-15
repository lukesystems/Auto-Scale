# TrendWatch Ingestion

## Inputs

A source can contain:

- URL and platform
- Account handle/type and follower count
- Caption or transcript
- Publish date
- Views, likes, saves, shares, and comments
- Notes
- Private screenshot upload

## URL Safety

The server fetcher:

- Allows HTTP and HTTPS only.
- Resolves every DNS answer and rejects private/reserved IP ranges.
- Repeats validation for every redirect, with a maximum of three.
- Uses an eight-second request timeout.
- Accepts HTML/XHTML only.
- Streams at most 1MB.

Fetch failures are stored as evidence. They do not silently become successful or verified sources.

## Classification and Scoring

Deterministic classification provides a baseline. The configured AI runtime may refine format, hook, angle, CTA pattern, audience pain, adaptation guidance, and transferability. Zod validates the result and falls back to the deterministic baseline.

The model is explicitly forbidden from inventing metrics, follower counts, visuals, or performance. Signal scoring is null-aware and records both a score and confidence with human-readable reasons.

## Screenshots

Screenshots are limited to common image formats and 5MB. They are stored in the private `project-assets` bucket under:

`{user_id}/{project_id}/sources/...`

V1 stores and links screenshots but does not perform OCR or image generation.
