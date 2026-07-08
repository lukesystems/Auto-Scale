# AutoScale Testing

## Automated

```bash
npm install
npm run lint
npm run typecheck
npm run test
npm run build
```

Coverage currently includes pipeline state, Quality Gate enforcement, cross-project chain checks, auth redirect safety, credential encryption, SSRF IP ranges, null-aware scoring, source classification, Post Bridge payloads, and official array response parsing.

## Local Setup

1. Copy `.env.example` to `.env.local`.
2. Add Supabase URL and anon key.
3. Apply all migrations in order from `supabase/migrations/0001_init.sql` through the latest migration.
4. Use mock/local provider settings only for non-AI UI checks.
5. Use real provider keys when testing AutoBrief, TrendWatch, or future Scraping Engine AI calls.
6. Run `npm run dev`.

## Critical Browser Workflow

1. Sign in and open onboarding.
2. Paste a product URL.
3. Generate AutoBrief.
4. Confirm the brief is editable and confidence is visible.
5. Save the brief and confirm a project is created.
6. Add a source with a caption, metrics, and optional screenshot.
7. Confirm fetch status, signal score, confidence, and classification appear.
8. Run TrendWatch and confirm insights link to sources.
9. Generate ideas and posts.
10. Confirm a failing or sub-70% post cannot be approved.
11. Approve a passing post.
12. Export the pack and confirm `slides/README.txt` says no PNGs are included.
13. Configure Post Bridge, test the connection, sync channels, and schedule with a discovered integration.
14. Enter experiment metrics, mark a winner, and generate variants.

## Scraping Engine test plan

When implementing the Scraping Engine, add tests before broad integrations.

### Unit tests

Test:

- discovery query generation from Product Brief fields
- source candidate normalization
- canonical URL deduplication
- platform detection
- adapter result validation
- empty/failed adapter results
- fetch status handling
- source classification from discovered snippets
- low-confidence labeling
- Pattern Miner schema validation

### Fixtures

Create fixtures under a future directory such as:

```txt
fixtures/scraping/
  product-brief-ai-saas.json
  web-search-results.json
  social-source-candidates.json
  duplicate-candidates.json
  failed-fetch-source.json
  low-confidence-source.json
```

### Integration workflow

A useful Scraping Engine run should prove this chain:

```txt
Product Brief
→ Discovery Plan
→ Source Candidates
→ Enriched Sources
→ Source Classifications
→ Pattern Brief
→ TrendWatch Insights
```

### Assertions

Assert that:

1. Every discovered source stores `discovery_adapter` and `discovery_reason` when those fields exist.
2. Failed fetches remain failed and do not become invented insights.
3. Low-confidence sources are visible to the user.
4. TrendWatch output includes caveats when source confidence is weak.
5. No generated content is created without a source-backed insight or explicit low-confidence label.

## RLS Verification

Using two test users, verify:

- User A cannot select or mutate User B's projects or child records.
- User A cannot upload/read objects below User B's `project-assets` folder.
- User A cannot read User B's `postbridge_connections`, `postbridge_channels`, or `ai_runs`.
- A generated post cannot reference an insight/content idea from another project.
- Future Scraping Engine source candidates, runs, and source maps are scoped to the owning project/user.

RLS tests should run inside a transaction with `role authenticated` and `request.jwt.claim.sub` set to the test user UUID.
