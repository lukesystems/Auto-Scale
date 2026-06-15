# TESTING.md - AutoScale Testing & RLS Verification

This document guides developers on running automated tests and executing manual security verifications to prove the stabilization of AutoScale V1.

## 1. Automated Tests
We use **Vitest** for running unit and service tests locally.

### Command
```bash
npm run test
```

### Coverage Areas
- **Pipeline Steps Builder**: Verifies correct rendering of progress based on stats.
- **Quality Gate checks**: Validates deterministic filters (length of hooks, presence of CTAs, hypotheses, etc.).
- **Chain integrity validation**: Tests cross-project boundary checks.
- **Postiz payload compiler**: Simulates generating payloads against the V1 public API specs.
- **TrendWatch safe URL fetching**: Confirms hostnames/IP ranges are validated for SSRF.

---

## 2. Row Level Security (RLS) Verification

If you are running Supabase locally or inside the Supabase SQL editor, you can run the following SQL queries to manually verify that RLS is working correctly and protecting user privacy.

### Setup Test Accounts
We simulate two different users:
- **User A**: `00000000-0000-0000-0000-00000000000a`
- **User B**: `00000000-0000-0000-0000-00000000000b`

### Test 1: User A cannot read User B's projects
1. Run as User A:
```sql
begin;
  -- Simulate authentication
  set local role authenticated;
  set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';

  -- Select all projects
  select * from public.projects;
commit;
```
*Verification: The result should only return User A's projects, never User B's.*

### Test 2: User A cannot insert into User B's project
```sql
begin;
  -- Simulate authentication
  set local role authenticated;
  set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';

  -- Attempt to create a source on User B's project
  insert into public.trendwatch_sources (project_id, platform, source_url)
  values ('USER_B_PROJECT_UUID_HERE', 'linkedin', 'https://linkedin.com/some-post');
commit;
```
*Verification: This operation must fail due to RLS with checking violation.*

### Test 3: User A cannot read User B's AI Runs or Postiz Connections
```sql
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';

  select * from public.postiz_connections;
  select * from public.ai_runs;
commit;
```
*Verification: Both queries should return 0 rows if User A does not own those connections/runs.*
