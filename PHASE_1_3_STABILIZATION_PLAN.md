# AutoScale Phase 1–3 Stabilization & Security Plan

This implementation plan details the security, stability, core loop, and API refactoring tasks to get AutoScale V1 ready for local development, testing, and staging.

## Components & Files to Change

### 1. Secret Cleanup (Phase 1)
*   **`.env.example`**: Remove Supabase anon and service-role keys. Add warning comments.
*   **`.gitignore`**: Ensure `.env.production` and local secret variants are ignored.
*   **`SECURITY.md`**: Guide on rotating compromised keys in Supabase, purging past secrets from git history using `git filter-repo` or BFG, and preventing key leaks.

### 2. Fix the Project Route Crash (Phase 1)
*   **`lib/project-pipeline.ts`**: Move `PipelineStep` type and `buildPipelineSteps` here.
*   **`app/(app)/projects/[id]/layout.tsx`**: Import `buildPipelineSteps` from the new clean module.
*   **`components/app/project-nav.tsx`**: Import types and helper from `lib/project-pipeline.ts` instead of inline definition.

### 3. Configure Linting (Phase 1)
*   **`.eslintrc.json`**: Created to configure ESLint non-interactively using `extends: "next/core-web-vitals"`.

### 4. Test Infrastructure (Phase 1)
*   **`package.json`**: Install `vitest`, add `"test"` and `"test:unit"` scripts.
*   **`__tests__/`**: Unit/service tests for:
    *   Pipeline steps builder
    *   Quality Gate checks
    *   Postiz payload builder
    *   TrendWatch URL safe fetcher and SSRF check
    *   Chain integrity validations

### 5. Quality Gate Enforcement (Phase 1)
*   **`app/(app)/projects/[id]/content/actions.ts`**:
    *   Block approval server-side in `updatePostStatusAction` if the post does not meet criteria: `quality_status === 'pass'`, score >= 0.70, hook/hypothesis/metric_to_watch/CTA exist, and belongs to same project.
*   **`app/(app)/projects/[id]/content/post-card.tsx`**:
    *   Render a warning or disable the "Approve" button if Quality Gate check fails.

### 6. Project-Chain Integrity (Phase 1)
*   **`lib/chain-integrity.ts`**: Build validators for related resources (source -> insight -> idea -> post -> scheduled -> experiment).
*   **Actions (`*actions.ts`)**: Integrate chain validation in actions (generate post, approve post, schedule post, etc.).
*   **`supabase/migrations/0002_chain_constraints.sql`**: Composite unique/foreign constraints to enforce project boundary at the database level.

### 7. Real TrendWatch Ingestion (Phase 2)
*   **`services/trendwatch/ingestion.ts`**: Safe server-side URL fetcher, timeout (8s), max size (1MB), SSRF check (reject local/private IPs), redirect limit (3).
*   **`services/trendwatch/scoring.ts`**: Null-aware scoring, confidence score, and clear explanations.
*   **Screenshot Ingestion**: Setup mock screenshot OCR and direct asset linkage.
*   **`app/(app)/projects/[id]/trendwatch/actions.ts`**: Load ingested sources and pass actual normalized text to LLM.

### 8. Real Distribution / Postiz V1 (Phase 3)
*   **`services/postiz/client.ts`**:
    *   Public API V1 compatibility (header `Authorization: <api-key>`, base URL `https://api.postiz.com/public/v1`).
    *   Rewrite payload compiler for public `POST /posts` schema.
*   **Settings & Scheduling Flow**:
    *   Map integrations/channels, store scheduled status, and provide ZIP/CSV manual export fallbacks.
