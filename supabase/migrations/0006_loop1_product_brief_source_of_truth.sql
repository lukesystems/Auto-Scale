-- Loop 1: make Product Brief the richer source of truth for downstream agents.

alter table public.product_briefs
  add column if not exists source_url text,
  add column if not exists product_name text,
  add column if not exists one_line_description text,
  add column if not exists category text,
  add column if not exists product_type text,
  add column if not exists what_it_does text,
  add column if not exists target_audience jsonb not null default '[]'::jsonb,
  add column if not exists user_pain_points jsonb not null default '[]'::jsonb,
  add column if not exists key_features jsonb not null default '[]'::jsonb,
  add column if not exists key_benefits jsonb not null default '[]'::jsonb,
  add column if not exists likely_competitors jsonb not null default '[]'::jsonb,
  add column if not exists alternative_solutions jsonb not null default '[]'::jsonb,
  add column if not exists market_category text,
  add column if not exists content_angles jsonb not null default '[]'::jsonb,
  add column if not exists platform_recommendations jsonb not null default '[]'::jsonb,
  add column if not exists cta_suggestions jsonb not null default '[]'::jsonb,
  add column if not exists founder_led_opportunities jsonb not null default '[]'::jsonb,
  add column if not exists positioning_gaps jsonb not null default '[]'::jsonb,
  add column if not exists confidence jsonb not null default '{}'::jsonb,
  add column if not exists extraction_notes jsonb not null default '[]'::jsonb,
  add column if not exists raw_extracted_content jsonb not null default '{}'::jsonb,
  add column if not exists model_used text;

update public.product_briefs
set
  one_line_description = coalesce(one_line_description, product_summary),
  target_audience = case
    when target_audience = '[]'::jsonb and target_customer is not null then jsonb_build_array(target_customer)
    else target_audience
  end,
  content_angles = case
    when content_angles = '[]'::jsonb then positioning_angles
    else content_angles
  end,
  cta_suggestions = case
    when cta_suggestions = '[]'::jsonb and cta is not null then jsonb_build_array(cta)
    else cta_suggestions
  end,
  confidence = case
    when confidence = '{}'::jsonb then '{"overall":"medium","audience":"medium","features":"medium","competitors":"low","positioning":"medium"}'::jsonb
    else confidence
  end;
