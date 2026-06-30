-- Add fal_image asset kind for Image → I2V pipeline.

alter table public.generated_assets
  drop constraint if exists generated_assets_kind_check;

alter table public.generated_assets
  add constraint generated_assets_kind_check
    check (kind in (
      'slide_image', 'fal_image', 'fal_clip', 'voiceover', 'subtitle', 'caption_ass', 'music', 'final_mp4', 'thumbnail'
    ));

comment on column public.generated_assets.kind is
  'Asset type: slide_image | fal_image (I2V frame) | fal_clip | voiceover | subtitle | caption_ass | music | final_mp4 | thumbnail';
