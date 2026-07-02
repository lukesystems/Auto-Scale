# Supabase Cron Setup (pg_cron + pg_net)

AutoScale exposes secured HTTP cron routes on your deployed app:

| Route | Purpose | Suggested schedule |
|-------|---------|-------------------|
| `/api/cron/metrics-ingestion` | Pull Post Bridge metrics into `metrics_snapshots` | Daily `0 6 * * *` |
| `/api/cron/trendhop` | Run due TrendHop schedules | Hourly `0 * * * *` |

Both routes require the same secret in the `Authorization: Bearer <secret>` header (or `x-cron-secret`).

## 1. Set the secret in Vercel

1. Open your Vercel project → **Settings** → **Environment Variables**.
2. Add `AUTOSCALE_CRON_SECRET` (or `CRON_SECRET`) with a long random value.
3. Redeploy so API routes can read it.

Use the **same value** in Supabase cron SQL below.

## 2. Enable extensions in Supabase

**Dashboard:** Database → **Extensions** → enable:

- `pg_cron`
- `pg_net`

**Or SQL Editor:**

```sql
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;
```

## 3. Schedule HTTP calls from Postgres

Replace placeholders:

- `YOUR_APP_URL` → e.g. `https://your-app.vercel.app`
- `YOUR_CRON_SECRET` → same as Vercel env

### Metrics ingestion (daily)

```sql
select cron.schedule(
  'autoscale-metrics-ingestion',
  '0 6 * * *',
  $$
  select net.http_post(
    url := 'YOUR_APP_URL/api/cron/metrics-ingestion',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_CRON_SECRET',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

### TrendHop (hourly)

```sql
select cron.schedule(
  'autoscale-trendhop',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'YOUR_APP_URL/api/cron/trendhop',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_CRON_SECRET',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

## 4. Verify jobs

```sql
select * from cron.job order by jobid;
```

Trigger manually (optional):

```sql
select net.http_post(
  url := 'YOUR_APP_URL/api/cron/trendhop',
  headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET')
);
```

## 5. Alternative: Supabase Edge Function scheduler

If you prefer Edge Functions over `pg_cron`:

1. Create a scheduled Edge Function that `fetch()`es the cron URL with the Bearer header.
2. Set the same `AUTOSCALE_CRON_SECRET` in Edge Function secrets.
3. Use Supabase Dashboard → **Edge Functions** → **Schedules** (or `supabase functions deploy` with cron config).

## Notes

- Vercel Cron (`vercel.json`) also triggers these routes when deployed on Vercel; use **either** Vercel Cron **or** Supabase pg_cron to avoid duplicate runs unless intentional.
- Routes return `401` if the secret is wrong and `503` if Supabase is not configured in the app env.
- Local dev: call with `curl -H "Authorization: Bearer $AUTOSCALE_CRON_SECRET" http://localhost:3000/api/cron/trendhop`.
