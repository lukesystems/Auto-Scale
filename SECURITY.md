# AutoScale Security

## Secrets

- Never commit `.env.local`, service-role keys, LLM keys, Post Bridge keys, or media provider keys.
- Browser code may use only explicitly public variables such as `NEXT_PUBLIC_SUPABASE_URL` and the Supabase anon/publishable key.
- Server-only credentials belong in deployment environment variables.
- BYOK Post Bridge keys are AES-256-GCM encrypted with `POSTBRIDGE_CREDENTIAL_ENCRYPTION_KEY` before database storage.

## If a Secret Was Committed

1. Revoke or rotate it at the provider immediately.
2. Replace it in local and deployment environment settings.
3. Search all branches and tags for the exposed value.
4. Rewrite history using a reviewed replacement file:

```bash
git filter-repo --replace-text replacements.txt --force
```

Example `replacements.txt`:

```txt
literal:EXPOSED_SECRET==>***REMOVED***
```

5. Coordinate a force push and require collaborators to re-clone.

Deleting a file in a later commit does not remove its earlier contents. A commit-message callback does not scrub file contents.

## Supabase

- Apply all migrations in order.
- Keep RLS enabled for every user-owned table.
- Use the service-role key only in trusted server code.
- The `project-assets` bucket is private; policies require the first path segment to match `auth.uid()`.
- Cross-project relationships are enforced by composite foreign keys.

## URL Ingestion

TrendWatch accepts only HTTP(S), resolves all DNS answers, rejects private/reserved addresses, validates each redirect, permits at most three redirects, times out after eight seconds, accepts HTML, and streams at most 1MB.

This reduces SSRF risk but does not make arbitrary web scraping legally or operationally unrestricted. Respect platform terms and robots/access controls.
