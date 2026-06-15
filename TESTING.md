# AutoScale Testing

## Automated

```bash
npm install
npm run lint
npm run typecheck
npm run test
npm run build
```

Coverage includes pipeline state, Quality Gate enforcement, cross-project chain checks, auth redirect safety, credential encryption, SSRF IP ranges, null-aware scoring, source classification, Postiz payloads, and official array response parsing.

## Local Setup

1. Copy `.env.example` to `.env.local`.
2. Add Supabase URL and anon key.
3. Apply `supabase/migrations/0001_init.sql` through `0005_phase_1_3_completion.sql`.
4. Leave `AUTOSCALE_DEFAULT_PROVIDER=mock` to test without an LLM bill.
5. Run `npm run dev`.

## Critical Browser Workflow

1. Sign in and open a project.
2. Complete or generate the product brief.
3. Add a source with a caption, metrics, and optional screenshot.
4. Confirm fetch status, signal score, confidence, and classification appear.
5. Run TrendWatch and confirm insights link to sources.
6. Generate ideas and posts.
7. Confirm a failing or sub-70% post cannot be approved.
8. Approve a passing post.
9. Export the pack and confirm `slides/README.txt` says no PNGs are included.
10. Configure Postiz, test the connection, sync channels, and schedule with a discovered integration.
11. Enter experiment metrics, mark a winner, and generate variants.

## RLS Verification

Using two test users, verify:

- User A cannot select or mutate User B's projects or child records.
- User A cannot upload/read objects below User B's `project-assets` folder.
- User A cannot read User B's `postiz_connections`, `postiz_channels`, or `ai_runs`.
- A generated post cannot reference an insight/content idea from another project.

RLS tests should run inside a transaction with `role authenticated` and `request.jwt.claim.sub` set to the test user UUID.
