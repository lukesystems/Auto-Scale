# Media Provider Plan (Fal)

V1.1 adds **Fal foundation only** — no full image/video generation pipeline yet.

## Current state

- `FAL_KEY` read server-side in `services/media/fal-config.ts`
- `isFalConfigured()`, `getFalProviderStatus()`, `assertFalConfigured()`
- Placeholder methods throw with clear "not implemented" messages
- UI shows Fal as "Coming soon" on `/settings/providers`

## Planned stages (post-V1.1)

### Stage 1 — Carousel PNG renderer

- Render slide text to PNG locally or via simple template engine
- Keep text editable in DB — do not bake copy into images as source of truth

### Stage 2 — Fal image generation

- Optional AI backgrounds / illustrations via Fal
- Link assets to `generated_posts` / export pack

### Stage 3 — Fal video generation

- Founder-style or faceless short video clips
- Heavy quality gates before auto-scheduling

### Stage 4 — Experiment linkage

- Attach generated media to experiments
- Track which visual variants win

## Design rules

- Text remains editable in structured post data
- Important copy must not live only inside rasterized images
- Fal is optional; text-first workflow always works without it

See [MANAGED_MODE.md](./MANAGED_MODE.md) for env setup.
