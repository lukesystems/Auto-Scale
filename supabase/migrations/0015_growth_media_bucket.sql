-- Public bucket for rendered Growth Run media (slides, MP4s, audio).
-- Postiz and founders need fetchable URLs; scheduling uploads to Postiz separately.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'growth-media',
  'growth-media',
  true,
  104857600,
  array['image/png', 'image/jpeg', 'video/mp4', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'text/plain', 'application/x-subrip']
)
on conflict (id) do nothing;

-- Service-role uploads bypass RLS. Authenticated owners may read via public URLs.
drop policy if exists "growth media public read" on storage.objects;
create policy "growth media public read" on storage.objects
  for select using (bucket_id = 'growth-media');

drop policy if exists "growth media owner insert" on storage.objects;
create policy "growth media owner insert" on storage.objects
  for insert with check (
    bucket_id = 'growth-media'
    and exists (
      select 1 from public.projects p
      where p.id::text = (storage.foldername(name))[2]
        and p.owner_id = auth.uid()
    )
  );
