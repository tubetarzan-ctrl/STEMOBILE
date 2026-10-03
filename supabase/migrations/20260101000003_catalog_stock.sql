-- =============================================================================
-- 0003 Catalog, Fit Finder compatibility, Genuine Proof, stock movements
-- =============================================================================

create type public.part_grade as enum ('ORIG_NEW','ORIG_PULL','OEM','PREMIUM','STANDARD','NA');
create type public.compat_confidence as enum ('exact','check_version','no');
create type public.movement_type as enum (
  'opening','purchase','sale','online_reserve','online_release','return_in','return_out',
  'repair_consume','buyback_in','adjustment','transfer');

create table public.categories (
  id              uuid primary key default gen_random_uuid(),
  parent_id       uuid references public.categories(id),
  name            text not null,
  name_ur         text,
  slug            text unique not null,
  kind            text not null check (kind in ('accessory','part','tool')),
  revenue_account int not null references public.accounts(code),
  image_url       text,
  sort            int not null default 0,
  is_active       boolean not null default true
);

create table public.brands (
  id    uuid primary key default gen_random_uuid(),
  name  text unique not null,
  slug  text unique not null,
  sort  int not null default 0
);

create table public.devices (
  id            uuid primary key default gen_random_uuid(),
  brand_id      uuid not null references public.brands(id),
  name          text not null,
  slug          text unique not null,
  model_numbers text[] not null default '{}',
  release_year  int,
  is_active     boolean not null default true,
  unique (brand_id, name)
);
create index devices_name_trgm on public.devices using gin (name gin_trgm_ops);
create index devices_models on public.devices using gin (model_numbers);

create table public.products (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  name_ur       text,
  slug          text unique not null,
  category_id   uuid not null references public.categories(id),
  brand_id      uuid references public.brands(id),
  description   text,
  description_ur text,
  warranty_days int not null default 0,
  is_online     boolean not null default true,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  search        tsvector generated always as (
                  to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(description,''))) stored
);
create index products_search on public.products using gin (search);
create index products_name_trgm on public.products using gin (name gin_trgm_ops);

create table public.product_variants (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.products(id) on delete cascade,
  sku            text unique not null,
  barcode        text unique,
  grade          public.part_grade not null default 'NA',
  attributes     jsonb not null default '{}',
  sale_price     bigint not null check (sale_price >= 0),
  min_price      bigint not null default 0 check (min_price >= 0),
  avg_cost       bigint not null default 0 check (avg_cost >= 0),
  reorder_level  int not null default 0,
  reorder_qty    int not null default 0,
  lead_time_days int not null default 7,
  is_critical    boolean not null default false,
  is_serialized  boolean not null default false,
  warranty_days  int,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);
create index on public.product_variants (product_id);

create table public.product_images (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.products(id) on delete cascade,
  url            text not null,
  uploadthing_key text,
  alt            text,
  sort           int not null default 0
);

create table public.part_compat (
  variant_id uuid references public.product_variants(id) on delete cascade,
  device_id  uuid references public.devices(id) on delete cascade,
  confidence public.compat_confidence not null default 'exact',
  note       text,
  primary key (variant_id, device_id)
);
create index on public.part_compat (device_id);

create table public.price_tiers (
  id          uuid primary key default gen_random_uuid(),
  key         text unique not null,
  name        text not null,
  discount_pct numeric(5,2) not null default 0   -- % off sale_price when no explicit tier price
);
create table public.variant_tier_prices (
  variant_id uuid references public.product_variants(id) on delete cascade,
  tier_id    uuid references public.price_tiers(id) on delete cascade,
  price      bigint not null check (price >= 0),
  primary key (variant_id, tier_id)
);

create table public.bundles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique not null,
  description text,
  discount    bigint not null default 0,
  is_active   boolean not null default true
);
create table public.bundle_items (
  bundle_id  uuid references public.bundles(id) on delete cascade,
  variant_id uuid references public.product_variants(id),
  qty        int not null default 1,
  primary key (bundle_id, variant_id)
);

-- Roman-Urdu / misspelling tolerant search synonyms ("pannel" -> "panel").
create table public.search_synonyms (
  term      text primary key,
  canonical text not null
);

-- Grade rules: required on parts; frozen once sold.
create or replace function public._variant_grade_rules()
returns trigger language plpgsql as $$
declare v_kind text;
begin
  select c.kind into v_kind from public.products p join public.categories c on c.id = p.category_id
  where p.id = new.product_id;
  if v_kind = 'part' and new.grade = 'NA' then
    raise exception 'grade_required: parts must carry a grade';
  end if;
  if tg_op = 'UPDATE' and new.grade <> old.grade
     and exists (select 1 from public.sale_items where variant_id = new.id) then
    raise exception 'grade_frozen: cannot change grade after the part has been sold';
  end if;
  return new;
end $$;
create trigger variant_grade_rules before insert or update on public.product_variants
  for each row execute function public._variant_grade_rules();
create trigger audit_variants after update or delete on public.product_variants
  for each row execute function public._audit_trigger();

-- -----------------------------------------------------------------------------
-- Stock
-- -----------------------------------------------------------------------------
create table public.locations (
  id          serial primary key,
  code        text unique not null,
  name        text not null,
  kind        text not null check (kind in ('shop','store','warehouse','virtual')),
  is_sellable boolean not null default true
);

insert into public.locations (code, name, kind, is_sellable) values
  ('COUNTER',   'Shop counter',            'shop',      true),
  ('BACK',      'Back store',              'store',     true),
  ('WAREHOUSE', 'Warehouse / home',        'warehouse', false),
  -- DECISION: online reservations are a transfer into this virtual location, so
  -- reserved stock stays in Inventory (no value change, no journal needed) but
  -- is never double-sold.
  ('RESERVED',  'Reserved for online orders', 'virtual', false);

create table public.serial_units (
  id             uuid primary key default gen_random_uuid(),
  variant_id     uuid not null references public.product_variants(id),
  serial_or_imei text,
  proof_code     text unique not null,
  status         text not null default 'in_stock'
                 check (status in ('in_stock','sold','returned','consumed','scrapped')),
  location_id    int references public.locations(id),
  sold_sale_id   uuid,
  sold_at        timestamptz,
  customer_phone text,
  warranty_ends  date,
  created_at     timestamptz not null default now()
);

create table public.stock_movements (
  id               bigserial primary key,
  variant_id       uuid not null references public.product_variants(id),
  location_id      int not null references public.locations(id),
  qty              int not null check (qty <> 0),
  unit_cost        bigint not null default 0,
  type             public.movement_type not null,
  ref_type         text,
  ref_id           text,
  serial_unit_id   uuid references public.serial_units(id),
  journal_entry_id uuid references public.journal_entries(id),
  created_by       uuid default auth.uid(),
  created_at       timestamptz not null default now()
);
create index on public.stock_movements (variant_id, location_id);
create index on public.stock_movements (ref_type, ref_id);
create index on public.stock_movements (created_at);

-- Cached on-hand per variant x location, maintained by trigger. Integrity tests
-- assert this always equals the sum of stock_movements.
create table public.stock_levels (
  variant_id  uuid references public.product_variants(id),
  location_id int references public.locations(id),
  on_hand     int not null default 0,
  primary key (variant_id, location_id)
);

create table public.stock_alerts (
  id            bigserial primary key,
  variant_id    uuid not null references public.product_variants(id),
  on_hand       int not null,
  reorder_level int not null,
  is_critical   boolean not null default false,
  status        text not null default 'open' check (status in ('open','resolved')),
  created_at    timestamptz not null default now(),
  notified_at   timestamptz,
  resolved_at   timestamptz
);
create unique index stock_alerts_one_open on public.stock_alerts (variant_id) where status = 'open';

create table public.stock_adjustments (
  id               uuid primary key default gen_random_uuid(),
  variant_id       uuid not null references public.product_variants(id),
  location_id      int not null references public.locations(id),
  qty              int not null check (qty <> 0),
  reason           text not null,
  status           text not null default 'pending' check (status in ('pending','approved','rejected')),
  stock_count_id   uuid,
  requested_by     uuid default auth.uid(),
  requested_at     timestamptz not null default now(),
  decided_by       uuid,
  decided_at       timestamptz,
  journal_entry_id uuid references public.journal_entries(id)
);

create table public.stock_counts (
  id          uuid primary key default gen_random_uuid(),
  location_id int not null references public.locations(id),
  scope       text,           -- shelf / category description
  status      text not null default 'draft' check (status in ('draft','submitted','posted')),
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  submitted_at timestamptz
);
create table public.stock_count_lines (
  count_id   uuid references public.stock_counts(id) on delete cascade,
  variant_id uuid references public.product_variants(id),
  expected   int not null,
  counted    int,
  primary key (count_id, variant_id)
);

create table public.transfers (
  id          uuid primary key default gen_random_uuid(),
  from_location int not null references public.locations(id),
  to_location   int not null references public.locations(id),
  lines       jsonb not null,
  note        text,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now()
);

-- Movements are append-only.
create or replace function public._append_only()
returns trigger language plpgsql as $$
begin raise exception '%_append_only', tg_table_name; end $$;
create trigger stock_movements_append_only before update or delete on public.stock_movements
  for each row execute function public._append_only();

-- Maintain stock_levels + shortage alerts.
create or replace function public._on_stock_movement()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_avail int; v_var public.product_variants;
begin
  insert into public.stock_levels (variant_id, location_id, on_hand)
  values (new.variant_id, new.location_id, new.qty)
  on conflict (variant_id, location_id) do update set on_hand = stock_levels.on_hand + excluded.on_hand;

  select * into v_var from public.product_variants where id = new.variant_id;
  select coalesce(sum(sl.on_hand), 0) into v_avail
    from public.stock_levels sl join public.locations l on l.id = sl.location_id
   where sl.variant_id = new.variant_id and l.is_sellable;

  if v_var.reorder_level > 0 and v_avail <= v_var.reorder_level then
    insert into public.stock_alerts (variant_id, on_hand, reorder_level, is_critical)
    values (new.variant_id, v_avail, v_var.reorder_level, v_var.is_critical)
    on conflict (variant_id) where status = 'open' do update set on_hand = excluded.on_hand;
  elsif v_avail > v_var.reorder_level then
    update public.stock_alerts set status = 'resolved', resolved_at = now()
     where variant_id = new.variant_id and status = 'open';
  end if;
  return new;
end $$;
create trigger stock_movement_levels after insert on public.stock_movements
  for each row execute function public._on_stock_movement();

create or replace function public.on_hand(p_variant uuid, p_location int default null)
returns int language sql stable security definer set search_path = public as $$
  select coalesce(sum(on_hand), 0)::int from public.stock_levels
  where variant_id = p_variant and (p_location is null or location_id = p_location)
$$;

create or replace function public.location_id(p_code text)
returns int language sql stable as $$ select id from public.locations where code = p_code $$;

-- Core stock primitive (internal). Returns the unit cost used.
-- Inbound movements carrying a cost (purchase / opening / buyback / return)
-- re-average the variant's weighted average cost across all locations.
create or replace function public._move_stock(
  p_variant uuid, p_location int, p_qty int, p_type public.movement_type,
  p_ref_type text, p_ref_id text, p_unit_cost bigint default null,
  p_allow_negative boolean default false, p_journal uuid default null, p_serial uuid default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_var public.product_variants; v_total int; v_cost bigint; v_here int;
begin
  select * into v_var from public.product_variants where id = p_variant for update;
  if not found then raise exception 'variant_not_found: %', p_variant; end if;

  if p_qty < 0 then
    v_here := public.on_hand(p_variant, p_location);
    if v_here + p_qty < 0 and not p_allow_negative then
      raise exception 'insufficient_stock: % (% available at location %, need %)',
        v_var.sku, v_here, p_location, -p_qty using errcode = 'P0001';
    end if;
    v_cost := coalesce(p_unit_cost, v_var.avg_cost);
  else
    v_cost := coalesce(p_unit_cost, v_var.avg_cost);
    if p_type in ('opening','purchase','buyback_in','return_in') and p_unit_cost is not null then
      v_total := public.on_hand(p_variant);
      if v_total <= 0 then
        update public.product_variants set avg_cost = p_unit_cost where id = p_variant;
      else
        update public.product_variants
           set avg_cost = round((v_total::numeric * v_var.avg_cost + p_qty::numeric * p_unit_cost) / (v_total + p_qty))
         where id = p_variant;
      end if;
    end if;
  end if;

  insert into public.stock_movements (variant_id, location_id, qty, unit_cost, type, ref_type, ref_id, journal_entry_id, serial_unit_id)
  values (p_variant, p_location, p_qty, v_cost, p_type, p_ref_type, p_ref_id, p_journal, p_serial);
  return v_cost;
end $$;

-- Random, non-sequential Genuine Proof codes (no ambiguous chars).
create or replace function public._gen_proof_code()
returns text language plpgsql as $$
declare chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; v text; i int;
begin
  loop
    v := '';
    for i in 1..10 loop
      v := v || substr(chars, 1 + (get_byte(gen_random_bytes(1), 0) % length(chars)), 1);
    end loop;
    exit when not exists (select 1 from public.serial_units where proof_code = v);
  end loop;
  return v;
end $$;

-- -----------------------------------------------------------------------------
-- Stock RPCs
-- -----------------------------------------------------------------------------
-- Opening stock at go-live: Dr Inventory / Cr Opening Balance Equity.
create or replace function public.post_opening_stock(p_lines jsonb, p_location int default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare l jsonb; v_je uuid; v_total bigint := 0; v_loc int := coalesce(p_location, public.location_id('COUNTER'));
begin
  perform public.require_permission('inventory.adjust.approve');
  select coalesce(sum((x->>'qty')::bigint * (x->>'unit_cost')::bigint), 0) into v_total from jsonb_array_elements(p_lines) x;
  v_je := public._post_journal(null, 'Opening stock', 'opening_stock', null, jsonb_build_array(
    jsonb_build_object('account', 12000, 'debit', v_total),
    jsonb_build_object('account', 30900, 'credit', v_total)));
  for l in select * from jsonb_array_elements(p_lines) loop
    perform public._move_stock((l->>'variant_id')::uuid, v_loc, (l->>'qty')::int, 'opening',
                               'opening', v_je::text, (l->>'unit_cost')::bigint, false, v_je);
  end loop;
  return v_je;
end $$;

create or replace function public.request_adjustment(p_variant uuid, p_location int, p_qty int, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.require_permission('inventory.adjust');
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason_required'; end if;
  insert into public.stock_adjustments (variant_id, location_id, qty, reason)
  values (p_variant, p_location, p_qty, p_reason) returning id into v_id;
  return v_id;
end $$;

-- Approve: shrinkage (qty<0) Dr 61000 / Cr 12000; found stock reverses it.
create or replace function public.approve_adjustment(p_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare a public.stock_adjustments; v_cost bigint; v_je uuid; v_val bigint;
begin
  perform public.require_permission('inventory.adjust.approve');
  select * into a from public.stock_adjustments where id = p_id for update;
  if a.status <> 'pending' then raise exception 'adjustment_not_pending'; end if;
  if not p_approve then
    update public.stock_adjustments set status = 'rejected', decided_by = auth.uid(), decided_at = now() where id = p_id;
    return;
  end if;
  select avg_cost into v_cost from public.product_variants where id = a.variant_id;
  v_val := abs(a.qty)::bigint * v_cost;
  v_je := public._post_journal(null, 'Stock adjustment: ' || a.reason, 'stock_adjustment', p_id::text,
    case when a.qty < 0 then jsonb_build_array(
           jsonb_build_object('account', 61000, 'debit', v_val), jsonb_build_object('account', 12000, 'credit', v_val))
         else jsonb_build_array(
           jsonb_build_object('account', 12000, 'debit', v_val), jsonb_build_object('account', 61000, 'credit', v_val)) end);
  perform public._move_stock(a.variant_id, a.location_id, a.qty, 'adjustment', 'stock_adjustment', p_id::text,
                             v_cost, false, v_je);
  update public.stock_adjustments set status = 'approved', decided_by = auth.uid(), decided_at = now(),
         journal_entry_id = v_je where id = p_id;
  perform public._audit('approve', 'stock_adjustments', p_id::text, to_jsonb(a), null);
end $$;

-- DECISION: transfers move stock between locations without a journal: the
-- Inventory account's value is unchanged, so the ledger is still correct.
create or replace function public.transfer_stock(p_from int, p_to int, p_lines jsonb, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; l jsonb;
begin
  perform public.require_permission('inventory.transfer');
  if p_from = p_to then raise exception 'same_location'; end if;
  insert into public.transfers (from_location, to_location, lines, note) values (p_from, p_to, p_lines, p_note) returning id into v_id;
  for l in select * from jsonb_array_elements(p_lines) loop
    perform public._move_stock((l->>'variant_id')::uuid, p_from, -(l->>'qty')::int, 'transfer', 'transfer', v_id::text);
    perform public._move_stock((l->>'variant_id')::uuid, p_to, (l->>'qty')::int, 'transfer', 'transfer', v_id::text);
  end loop;
  return v_id;
end $$;

-- Stock count -> pending adjustments for every variance.
create or replace function public.submit_stock_count(p_count uuid)
returns int language plpgsql security definer set search_path = public as $$
declare c public.stock_counts; r record; n int := 0;
begin
  perform public.require_permission('inventory.adjust');
  select * into c from public.stock_counts where id = p_count for update;
  if c.status <> 'draft' then raise exception 'count_not_draft'; end if;
  for r in select * from public.stock_count_lines where count_id = p_count and counted is not null loop
    if r.counted - public.on_hand(r.variant_id, c.location_id) <> 0 then
      insert into public.stock_adjustments (variant_id, location_id, qty, reason, stock_count_id)
      values (r.variant_id, c.location_id, r.counted - public.on_hand(r.variant_id, c.location_id),
              'Stock count variance', p_count);
      n := n + 1;
    end if;
  end loop;
  update public.stock_counts set status = 'submitted', submitted_at = now() where id = p_count;
  return n;
end $$;

-- Genuine Proof verification (public; rate limited in the API layer).
create or replace function public.verify_proof_code(p_code text)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((
    select jsonb_build_object(
      'valid', true, 'code', su.proof_code, 'status', su.status,
      'product', p.name, 'sku', v.sku, 'grade', v.grade,
      'sold_at', su.sold_at, 'warranty_ends', su.warranty_ends,
      'warranty_active', su.warranty_ends is not null and su.warranty_ends >= public.business_date(),
      'phone_hint', case when su.customer_phone is not null then '••••' || right(su.customer_phone, 3) end,
      'seller', 'StarTech Electronics, Sarena Mobile Mall, Karachi')
    from public.serial_units su
    join public.product_variants v on v.id = su.variant_id
    join public.products p on p.id = v.product_id
    where su.proof_code = upper(trim(p_code))), jsonb_build_object('valid', false))
$$;

-- Fit Finder: resolve "SM-A546E" or "galaxy a54" to a device.
create or replace function public.resolve_device(p_query text)
returns setof public.devices language sql stable as $$
  select d.* from public.devices d
  where d.is_active and (upper(trim(p_query)) = any (select upper(m) from unnest(d.model_numbers) m)
         or d.name ilike '%' || trim(p_query) || '%'
         or similarity(d.name, p_query) > 0.3)
  order by (upper(trim(p_query)) = any (select upper(m) from unnest(d.model_numbers) m)) desc,
           similarity(d.name, p_query) desc
  limit 10
$$;

-- Storefront search (Roman Urdu tolerant), optionally narrowed to a device.
create or replace function public.search_products(p_q text, p_device uuid default null, p_limit int default 24)
returns table (product_id uuid, name text, slug text, min_price bigint, fit public.compat_confidence, score real)
language sql stable security definer set search_path = public as $$
  with words as (
    select coalesce(s.canonical, w) as w
    from unnest(regexp_split_to_array(lower(trim(coalesce(p_q, ''))), '\s+')) w
    left join public.search_synonyms s on s.term = w
    where w <> ''
  ), q as (select string_agg(w, ' ') as text from words)
  select p.id, p.name, p.slug, min(v.sale_price),
         (select pc.confidence from public.part_compat pc join public.product_variants v2 on v2.id = pc.variant_id
           where v2.product_id = p.id and pc.device_id = p_device order by pc.confidence limit 1),
         max(greatest(similarity(p.name, q.text), ts_rank(p.search, plainto_tsquery('simple', q.text))))::real
  from public.products p join public.product_variants v on v.product_id = p.id and v.is_active, q
  where p.is_active and p.is_online
    and (q.text is null or p.search @@ plainto_tsquery('simple', q.text) or similarity(p.name, q.text) > 0.15
         or p.name ilike '%' || q.text || '%')
    and (p_device is null or exists (select 1 from public.part_compat pc join public.product_variants v3 on v3.id = pc.variant_id
                                     where v3.product_id = p.id and pc.device_id = p_device and pc.confidence <> 'no')
         or not exists (select 1 from public.part_compat pc join public.product_variants v4 on v4.id = pc.variant_id
                        where v4.product_id = p.id))
  group by p.id, q.text
  order by 6 desc nulls last
  limit p_limit
$$;
