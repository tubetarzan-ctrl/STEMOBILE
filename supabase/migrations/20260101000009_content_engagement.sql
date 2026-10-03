-- =============================================================================
-- 0009 Website Content Manager, themes, media, reviews, stories, portfolio,
--      FAQ, blog, promotions, social posts, inbox, WhatsApp, notifications, AI
-- =============================================================================

-- --- Pages & sections (draft -> publish -> versions) --------------------------
create table public.site_pages (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,          -- '' = homepage
  page_type       text not null default 'landing' check (page_type in ('home','landing','policy','campaign','category','product','repair','model')),
  title_en        text not null,
  title_ur        text,
  seo_title       text,
  seo_description text,
  status          text not null default 'draft' check (status in ('draft','published')),
  is_system       boolean not null default false,  -- homepage etc. cannot be deleted
  deleted_at      timestamptz,                     -- 30-day trash
  updated_at      timestamptz not null default now(),
  published_at    timestamptz
);

-- `draft` is what editors change; `published` is what visitors see.
create table public.page_sections (
  id          uuid primary key default gen_random_uuid(),
  page_id     uuid not null references public.site_pages(id) on delete cascade,
  type        text not null check (type in (
                'hero','problem_solution','category_grid','product_row','repair_quote','case_studies',
                'testimonials','portfolio','reel_strip','genuine_proof','why_us','comparison_table',
                'technician_pro','faq','final_cta','text_image','rich_text','cta_band','map_hours','instagram_feed')),
  sort        int not null default 0,
  visible     boolean not null default true,
  draft       jsonb not null default '{}',
  published   jsonb,
  published_sort int,
  published_visible boolean,
  starts_at   timestamptz,       -- scheduling ("Eid banner 1st-3rd")
  ends_at     timestamptz,
  deleted_at  timestamptz,
  updated_by  uuid default auth.uid(),
  updated_at  timestamptz not null default now()
);
create index on public.page_sections (page_id, sort);

create table public.content_versions (
  id           uuid primary key default gen_random_uuid(),
  page_id      uuid not null references public.site_pages(id) on delete cascade,
  snapshot     jsonb not null,
  note         text,
  published_by uuid default auth.uid(),
  published_at timestamptz not null default now()
);

-- Global key/value copy (footer, announcement fallback, address, hours...).
create table public.content_blocks (
  key        text primary key,
  en         text,
  ur         text,
  draft_en   text,
  draft_ur   text,
  max_len    int,
  updated_at timestamptz not null default now()
);

create table public.media_assets (
  id          uuid primary key default gen_random_uuid(),
  type        text not null check (type in ('image','video','reel')),
  source      text not null check (source in ('upload','youtube','instagram')),
  url         text not null,
  uploadthing_key text,
  external_id text,              -- YouTube id / Instagram shortcode
  poster      text,
  duration    numeric,
  size_bytes  bigint,
  width       int,
  height      int,
  focus_x     numeric default 0.5,
  focus_y     numeric default 0.5,
  captions    text,
  alt         text,
  product_tags uuid[] not null default '{}',
  placements  text[] not null default '{}',   -- 'hero','reel_strip','product','repair'
  sort        int not null default 0,
  is_active   boolean not null default true,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now()
);

create table public.hero_settings (
  id        int primary key default 1 check (id = 1),
  mode      text not null default '3d' check (mode in ('3d','3d_video','video','image','offers')),
  media_id  uuid references public.media_assets(id),
  settings  jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
insert into public.hero_settings (id) values (1);

create table public.site_themes (
  key        text primary key,
  name       text not null,
  tokens     jsonb not null,
  is_dark    boolean not null default true,
  is_active  boolean not null default false,
  sort       int not null default 0
);
create unique index one_active_theme on public.site_themes (is_active) where is_active;
create table public.theme_overrides (
  id        int primary key default 1 check (id = 1),
  tokens    jsonb not null default '{}',
  logo_url  text,
  favicon_url text,
  fonts     jsonb
);
insert into public.theme_overrides (id) values (1);

create table public.faqs (
  id        uuid primary key default gen_random_uuid(),
  page_slug text not null default '',
  q_en      text not null,
  q_ur      text,
  a_en      text not null,
  a_ur      text,
  keywords  text[] not null default '{}',   -- feeds the assistant's answer bank
  sort      int not null default 0,
  visible   boolean not null default true
);

create table public.announcements (
  id        uuid primary key default gen_random_uuid(),
  text_en   text not null,
  text_ur   text,
  link      text,
  starts_at timestamptz,
  ends_at   timestamptz,
  is_active boolean not null default true,
  sort      int not null default 0
);

create table public.offers (       -- hero offer carousel
  id         uuid primary key default gen_random_uuid(),
  title_en   text not null,
  title_ur   text,
  subtitle   text,
  image_url  text,
  link       text,
  product_id uuid references public.products(id),
  starts_at  timestamptz,
  ends_at    timestamptz,
  sort       int not null default 0,
  is_active  boolean not null default true
);

create table public.referral_codes (
  code        text primary key,
  customer_id uuid not null references public.customers(id),
  reward      bigint not null default 20000,
  uses        int not null default 0,
  created_at  timestamptz not null default now()
);

-- --- Repair stories & portfolio ----------------------------------------------------
create table public.repair_stories (
  id            uuid primary key default gen_random_uuid(),
  repair_job_id uuid references public.repair_jobs(id),
  device_label  text not null,
  problem       text not null,
  replaced      text,
  grade         public.part_grade,
  time_taken    text,
  quote         text,
  customer_name text,
  review_id     uuid,
  before_url    text,
  after_url     text,
  video_url     text,
  pages         text[] not null default '{home}',
  consent       boolean not null default false,
  visible       boolean not null default true,
  sort          int not null default 0,
  created_at    timestamptz not null default now(),
  check (repair_job_id is null or consent)
);

create table public.portfolio_items (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null default 'before_after' check (kind in ('before_after','shop','bench')),
  title       text,
  before_url  text,
  after_url   text,
  image_url   text,
  device_id   uuid references public.devices(id),
  part_tag    text,
  repair_tag  text,
  link        text,
  visible     boolean not null default true,
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);

-- --- Reviews ---------------------------------------------------------------------
create table public.reviews (
  id                    uuid primary key default gen_random_uuid(),
  source                text not null default 'onsite' check (source in ('onsite','google','admin')),
  rating                int not null check (rating between 1 and 5),
  title                 text,
  text                  text,
  author_name           text not null,
  customer_id           uuid references public.customers(id),
  phone                 text,
  sale_id               uuid references public.sales(id),
  repair_job_id         uuid references public.repair_jobs(id),
  product_id            uuid references public.products(id),
  verified              boolean not null default false,
  status                text not null default 'pending' check (status in ('published','pending','hidden','rejected')),
  featured              boolean not null default false,
  sort                  int not null default 0,
  owner_reply           text,
  owner_reply_at        timestamptz,
  flagged_reason        text,
  google_prompt_shown   boolean not null default false,
  google_prompt_clicked boolean not null default false,
  created_at            timestamptz not null default now()
);
create index on public.reviews (status, featured);
create index on public.reviews (product_id);

create table public.review_media (
  id             uuid primary key default gen_random_uuid(),
  review_id      uuid not null references public.reviews(id) on delete cascade,
  type           text not null check (type in ('image','video')),
  uploadthing_key text,
  url            text not null,
  poster         text,
  sort           int not null default 0
);

create table public.google_reviews (
  google_review_id text primary key,
  author           text,
  author_photo     text,
  rating           int,
  text             text,
  time             timestamptz,
  reply            text,
  reply_at         timestamptz,
  synced_at        timestamptz not null default now()
);

create table public.review_requests (
  id          bigserial primary key,
  customer_id uuid references public.customers(id),
  source_type text not null check (source_type in ('sale','repair','order')),
  source_id   text not null,
  token       text unique not null default encode(gen_random_bytes(12), 'hex'),
  sent_at     timestamptz,
  opened_at   timestamptz,
  review_id   uuid references public.reviews(id)
);

-- Public review submission (rules-based filter, no AI).
create or replace function public.submit_review(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_flag text; v_req public.review_requests; v_recent int; v_customer uuid; t text := coalesce(p->>'text', '');
        v_verified boolean := false; v_sale uuid; v_job uuid; m jsonb; i int := 0;
begin
  if (p->>'rating')::int not between 1 and 5 then raise exception 'invalid_rating'; end if;
  if p->>'request_token' is not null then
    select * into v_req from public.review_requests where token = p->>'request_token';
    if found then
      v_verified := true; v_customer := v_req.customer_id;
      if v_req.source_type = 'sale' then v_sale := v_req.source_id::uuid; end if;
      if v_req.source_type = 'repair' then v_job := v_req.source_id::uuid; end if;
    end if;
  end if;
  v_customer := coalesce(v_customer, (select id from public.customers where phone = public.normalize_phone(p->>'phone')));
  select count(*) into v_recent from public.reviews
   where phone = public.normalize_phone(p->>'phone') and created_at > now() - interval '7 days';

  v_flag := case
    when t ~* '(https?://|www\.|\.com\b)' then 'contains_link'
    when t ~* (public.setting('reviews.profanity_regex', '"\\m(fuck|shit|bitch|harami|kutta|kanjar|bhenchod|madarchod)\\M"') #>> '{}') then 'profanity'
    when t ~ '(.)\1{7,}' or t ~* '\m(\w+)\M(\s+\1\M){4,}' then 'repeated_text'
    when v_recent >= 3 then 'too_many_from_phone'
    when jsonb_array_length(coalesce(p->'media', '[]')) > 7 then 'too_much_media'
  end;

  insert into public.reviews (source, rating, title, text, author_name, customer_id, phone, sale_id, repair_job_id,
                              product_id, verified, status, flagged_reason, google_prompt_shown)
  values ('onsite', (p->>'rating')::int, p->>'title', nullif(t, ''), coalesce(nullif(p->>'name', ''), 'Customer'), v_customer,
          public.normalize_phone(p->>'phone'), v_sale, v_job, (p->>'product_id')::uuid, v_verified,
          case when v_flag is null then 'published' else 'pending' end, v_flag, true)
  returning id into v_id;

  for m in select * from jsonb_array_elements(coalesce(p->'media', '[]')) loop
    i := i + 1;
    insert into public.review_media (review_id, type, uploadthing_key, url, poster, sort)
    values (v_id, m->>'type', m->>'key', m->>'url', m->>'poster', i);
  end loop;
  if v_req.id is not null then update public.review_requests set review_id = v_id where id = v_req.id; end if;
  insert into public.notifications (kind, title, body, link, priority)
  values ('review', 'New ' || (p->>'rating') || '★ review', left(t, 140), '/admin/reviews',
          case when (p->>'rating')::int <= 3 then 'high' else 'normal' end);
  return jsonb_build_object('review_id', v_id, 'status', case when v_flag is null then 'published' else 'pending' end);
end $$;

create or replace function public.track_google_prompt_click(p_review uuid)
returns void language sql security definer set search_path = public as $$
  update public.reviews set google_prompt_clicked = true where id = p_review
$$;

create or replace view public.v_review_stats as
select (select round(avg(rating)::numeric, 2) from public.reviews where status = 'published') as onsite_avg,
       (select count(*) from public.reviews where status = 'published') as onsite_count,
       (select round(avg(rating)::numeric, 2) from public.google_reviews) as google_avg,
       (select count(*) from public.google_reviews) as google_count,
       (select count(*) from public.review_requests where sent_at is not null) as requests_sent,
       (select count(*) from public.review_requests where review_id is not null) as reviews_from_requests,
       (select count(*) from public.reviews where google_prompt_clicked) as google_clicks;

-- --- Blog --------------------------------------------------------------------------
create table public.blog_categories (
  id   uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null
);
create table public.blog_posts (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,
  title_en        text not null,
  title_ur        text,
  excerpt         text,
  body_en         text,
  body_ur         text,
  cover_url       text,
  category_id     uuid references public.blog_categories(id),
  author_id       uuid references public.profiles(id),
  author_name     text,
  seo_title       text,
  seo_description text,
  status          text not null default 'draft' check (status in ('draft','published')),
  published_at    timestamptz,
  created_at      timestamptz not null default now()
);

-- --- Instagram posts & reels ---------------------------------------------------------
create table public.social_posts (
  id            uuid primary key default gen_random_uuid(),
  caption       text,
  hashtags      text[] not null default '{}',
  instagram_url text,
  media         jsonb not null default '[]',    -- [{type,url,poster}]
  status        text not null default 'draft' check (status in ('draft','pending_approval','published','archived')),
  scheduled_for timestamptz,
  published_at  timestamptz,
  created_by    uuid default auth.uid(),
  approved_by   uuid,
  created_at    timestamptz not null default now()
);
create table public.social_post_products (
  post_id    uuid references public.social_posts(id) on delete cascade,
  product_id uuid references public.products(id),
  primary key (post_id, product_id)
);

-- --- Inbox, WhatsApp, email, notifications ----------------------------------------
create table public.inquiries (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('quick','trade','special_order','contact','chat','email','whatsapp')),
  name        text,
  phone       text,
  email       text,
  message     text not null,
  device_text text,
  meta        jsonb not null default '{}',
  status      text not null default 'new' check (status in ('new','open','waiting','closed')),
  priority    text not null default 'normal' check (priority in ('low','normal','high')),
  assigned_to uuid references public.profiles(id),
  notes       text,
  customer_id uuid references public.customers(id),
  created_at  timestamptz not null default now()
);

create table public.email_threads (
  id            uuid primary key default gen_random_uuid(),
  from_address  text not null,
  subject       text,
  body          text,
  classification text check (classification in ('notification','social','spam','general','complaint','refund','order','other')),
  auto_replied  boolean not null default false,
  reply_draft   text,
  inquiry_id    uuid references public.inquiries(id),
  received_at   timestamptz not null default now()
);

create table public.whatsapp_threads (
  id            uuid primary key default gen_random_uuid(),
  phone         text unique not null,
  customer_id   uuid references public.customers(id),
  assigned_to   uuid references public.profiles(id),
  last_message_at timestamptz,
  window_expires_at timestamptz,     -- 24h customer-service window
  status        text not null default 'open' check (status in ('open','closed')),
  unread        int not null default 0
);
create table public.whatsapp_messages (
  id          bigserial primary key,
  thread_id   uuid not null references public.whatsapp_threads(id),
  direction   text not null check (direction in ('in','out')),
  wa_message_id text unique,
  template    text,
  body        text,
  payload     jsonb,
  status      text,         -- sent / delivered / read / failed
  ref_type    text,         -- order / repair / khata ...
  ref_id      text,
  sent_by     uuid,
  created_at  timestamptz not null default now()
);

create table public.notifications (
  id         bigserial primary key,
  kind       text not null,
  title      text not null,
  body       text,
  link       text,
  priority   text not null default 'normal',
  recipient  uuid,            -- null = all staff with access
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create table public.ai_usage_log (
  id          bigserial primary key,
  feature     text not null,       -- assistant / copilot / content / anomaly
  provider    text,
  model       text,
  input_tokens  int,
  output_tokens int,
  cost_micro_usd bigint,
  answered_from text,              -- 'faq' | 'answer_bank' | 'model'
  question    text,
  created_at  timestamptz not null default now()
);

-- --- Publishing ---------------------------------------------------------------------
create or replace function public.publish_page(p_page uuid, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_ver uuid;
begin
  perform public.require_permission('content.publish');
  update public.page_sections set published = draft, published_sort = sort, published_visible = visible
   where page_id = p_page and deleted_at is null;
  update public.page_sections set published = null where page_id = p_page and deleted_at is not null;
  update public.site_pages set status = 'published', published_at = now(), updated_at = now() where id = p_page;
  insert into public.content_versions (page_id, snapshot, note)
  select p_page, jsonb_build_object('page', to_jsonb(sp), 'sections',
           coalesce((select jsonb_agg(to_jsonb(ps) order by ps.sort) from public.page_sections ps
                     where ps.page_id = p_page and ps.deleted_at is null), '[]')), p_note
  from public.site_pages sp where sp.id = p_page
  returning id into v_ver;
  perform public._audit('publish', 'site_pages', p_page::text, null, jsonb_build_object('version', v_ver));
  return v_ver;
end $$;

create or replace function public.rollback_page(p_version uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v public.content_versions; s jsonb;
begin
  perform public.require_permission('content.publish');
  select * into v from public.content_versions where id = p_version;
  update public.page_sections set deleted_at = now(), published = null where page_id = v.page_id;
  for s in select * from jsonb_array_elements(v.snapshot->'sections') loop
    insert into public.page_sections (id, page_id, type, sort, visible, draft, published, published_sort, published_visible, starts_at, ends_at)
    values ((s->>'id')::uuid, v.page_id, s->>'type', (s->>'sort')::int, (s->>'visible')::boolean, s->'draft', s->'draft',
            (s->>'sort')::int, (s->>'visible')::boolean, (s->>'starts_at')::timestamptz, (s->>'ends_at')::timestamptz)
    on conflict (id) do update set deleted_at = null, type = excluded.type, sort = excluded.sort, visible = excluded.visible,
      draft = excluded.draft, published = excluded.published, published_sort = excluded.published_sort,
      published_visible = excluded.published_visible;
  end loop;
  perform public._audit('rollback', 'site_pages', v.page_id::text, null, jsonb_build_object('version', p_version));
end $$;

create or replace function public.activate_theme(p_key text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_permission('appearance.manage');
  update public.site_themes set is_active = false where is_active;
  update public.site_themes set is_active = true where key = p_key;
  if not found then raise exception 'theme_not_found'; end if;
end $$;

-- Section trash purge (30 days) — called by cron.
create or replace function public.purge_trash()
returns int language sql security definer set search_path = public as $$
  with d as (delete from public.page_sections where deleted_at < now() - interval '30 days' returning 1)
  select count(*)::int from d
$$;
