-- =============================================================================
-- 0005 Customers, trade accounts, cash drawers, POS sales, payments, returns
-- =============================================================================

create table public.customers (
  id            uuid primary key default gen_random_uuid(),
  phone         text unique not null check (phone ~ '^\+?[0-9]{10,15}$'),
  name          text,
  email         text,
  auth_user_id  uuid unique references auth.users(id),
  city          text,
  notes         text,
  rto_count     int not null default 0,
  is_blocked    boolean not null default false,
  whatsapp_opt_out boolean not null default false,
  created_at    timestamptz not null default now()
);

create table public.customer_devices (
  customer_id uuid references public.customers(id) on delete cascade,
  device_id   uuid references public.devices(id),
  nickname    text,
  created_at  timestamptz not null default now(),
  primary key (customer_id, device_id)
);

create table public.addresses (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  label       text,
  line1       text not null,
  area        text,
  city        text not null default 'Karachi',
  is_default  boolean not null default false
);

create table public.trade_accounts (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid unique not null references public.customers(id),
  shop_name    text not null,
  city         text,
  location     text,
  cnic_masked  text,              -- DECISION: only masked CNIC stored; image in private bucket
  tier_id      uuid references public.price_tiers(id),
  credit_limit bigint not null default 0,
  terms_days   int not null default 15,
  status       text not null default 'pending' check (status in ('pending','approved','suspended','rejected')),
  approved_by  uuid,
  approved_at  timestamptz,
  created_at   timestamptz not null default now()
);
create trigger audit_trade_accounts after update on public.trade_accounts
  for each row execute function public._audit_trigger();

create or replace function public.khata_balance(p_customer uuid)
returns bigint language sql stable security definer set search_path = public as $$
  select public.party_balance(11000, 'customer', p_customer::text)
$$;
create or replace function public.wallet_balance(p_customer uuid)
returns bigint language sql stable security definer set search_path = public as $$
  select -public.party_balance(20300, 'customer', p_customer::text)
$$;

-- Find-or-create customer by phone (normalised to +92...).
create or replace function public.normalize_phone(p text)
returns text language sql immutable as $$
  select case
    when x ~ '^03[0-9]{9}$' then '+92' || substr(x, 2)
    when x ~ '^92[0-9]{10}$' then '+' || x
    when x ~ '^3[0-9]{9}$' then '+92' || x
    else x end
  from (select regexp_replace(coalesce(p, ''), '[^0-9+]', '', 'g') as x) s
$$;

create or replace function public._upsert_customer(p_phone text, p_name text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_phone text := public.normalize_phone(p_phone);
begin
  if v_phone is null or v_phone = '' then return null; end if;
  insert into public.customers (phone, name) values (v_phone, p_name)
  on conflict (phone) do update set name = coalesce(customers.name, excluded.name)
  returning id into v_id;
  return v_id;
end $$;

-- -----------------------------------------------------------------------------
-- Drawers
-- -----------------------------------------------------------------------------
create table public.cash_drawers (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  location_id  int not null references public.locations(id),
  cash_account int not null references public.accounts(code),
  is_active    boolean not null default true
);
insert into public.cash_drawers (name, location_id, cash_account)
values ('Counter 1', (select id from public.locations where code = 'COUNTER'), 10100);

create table public.drawer_sessions (
  id            uuid primary key default gen_random_uuid(),
  drawer_id     uuid not null references public.cash_drawers(id),
  business_date date not null default public.business_date(),
  opened_by     uuid default auth.uid(),
  opened_at     timestamptz not null default now(),
  opening_float bigint not null default 0,
  status        text not null default 'open' check (status in ('open','closed','auto_closed')),
  closed_by     uuid,
  closed_at     timestamptz,
  expected      bigint,
  counted       bigint,
  variance      bigint,
  denominations jsonb,
  not_counted   boolean not null default false
);
create unique index one_open_session_per_drawer on public.drawer_sessions (drawer_id) where status = 'open';

create or replace function public.open_drawer(p_drawer uuid, p_opening_float bigint)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.require_permission('pos.drawer');
  insert into public.drawer_sessions (drawer_id, opening_float) values (p_drawer, p_opening_float) returning id into v_id;
  return v_id;
end $$;

-- Expected cash = opening float + net movement of the drawer's cash account in
-- every journal tagged with this session (sales, refunds, receipts, expenses).
create or replace function public.drawer_expected(p_session uuid)
returns bigint language sql stable security definer set search_path = public as $$
  select s.opening_float + coalesce((
    select sum(jl.debit - jl.credit) from public.journal_lines jl
    join public.journal_entries je on je.id = jl.entry_id
    where je.drawer_session_id = s.id and jl.account_code = d.cash_account
      and je.source_type <> 'cash_variance'), 0)
  from public.drawer_sessions s join public.cash_drawers d on d.id = s.drawer_id
  where s.id = p_session
$$;

create or replace function public.close_drawer(p_session uuid, p_counted bigint, p_denominations jsonb default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.drawer_sessions; d public.cash_drawers; v_exp bigint; v_var bigint;
begin
  perform public.require_permission('pos.drawer');
  select * into s from public.drawer_sessions where id = p_session for update;
  if s.status <> 'open' then raise exception 'session_not_open'; end if;
  select * into d from public.cash_drawers where id = s.drawer_id;
  v_exp := public.drawer_expected(p_session);
  v_var := p_counted - v_exp;
  if v_var <> 0 then
    perform public._post_journal(s.business_date, 'Cash ' || case when v_var > 0 then 'over' else 'short' end || ' – ' || d.name,
      'cash_variance', p_session::text,
      case when v_var > 0 then jsonb_build_array(
             jsonb_build_object('account', d.cash_account, 'debit', v_var),
             jsonb_build_object('account', 41000, 'credit', v_var))
           else jsonb_build_array(
             jsonb_build_object('account', 60900, 'debit', -v_var),
             jsonb_build_object('account', d.cash_account, 'credit', -v_var)) end,
      p_session);
  end if;
  update public.drawer_sessions set status = 'closed', closed_by = auth.uid(), closed_at = now(),
    expected = v_exp, counted = p_counted, variance = v_var, denominations = p_denominations
  where id = p_session;
  return jsonb_build_object('expected', v_exp, 'counted', p_counted, 'variance', v_var);
end $$;

-- -----------------------------------------------------------------------------
-- Sales
-- -----------------------------------------------------------------------------
create table public.sales (
  id                uuid primary key default gen_random_uuid(),
  sale_no           bigserial unique,
  channel           text not null check (channel in ('pos','online','repair','trade')),
  customer_id       uuid references public.customers(id),
  location_id       int references public.locations(id),
  drawer_session_id uuid references public.drawer_sessions(id),
  cashier_id        uuid default auth.uid(),
  subtotal          bigint not null default 0,
  discount_total    bigint not null default 0,
  delivery_fee      bigint not null default 0,
  total             bigint not null default 0,
  cost_total        bigint not null default 0,
  status            text not null default 'completed'
                    check (status in ('completed','partially_returned','returned')),
  idempotency_key   text unique,
  client_id         text,
  is_offline        boolean not null default false,
  sold_at           timestamptz not null default now(),
  business_date     date not null default public.business_date(),
  journal_entry_id  uuid references public.journal_entries(id),
  order_id          uuid,
  repair_job_id     uuid,
  discount_code     text,
  notes             text,
  created_at        timestamptz not null default now()
);
create index on public.sales (business_date);
create index on public.sales (customer_id);

create table public.sale_items (
  id              uuid primary key default gen_random_uuid(),
  sale_id         uuid not null references public.sales(id),
  variant_id      uuid references public.product_variants(id),
  description     text,
  qty             int not null check (qty > 0),
  unit_price      bigint not null,
  discount        bigint not null default 0,      -- line discount total
  line_total      bigint not null,                -- qty*unit_price - discount
  cost_at_sale    bigint not null default 0,      -- unit cost
  grade_at_sale   public.part_grade,
  serial_unit_id  uuid references public.serial_units(id),
  revenue_account int not null references public.accounts(code),
  returned_qty    int not null default 0
);
create index on public.sale_items (sale_id);
create index on public.sale_items (variant_id);

create table public.payments (
  id              uuid primary key default gen_random_uuid(),
  sale_id         uuid references public.sales(id),
  order_id        uuid,
  repair_job_id   uuid,
  customer_id     uuid references public.customers(id),
  method          text not null check (method in
                  ('cash','card','raast','jazzcash','easypaisa','bank_transfer','wallet','khata','cod')),
  amount          bigint not null check (amount > 0),
  status          text not null default 'verified' check (status in ('pending','verified','rejected','refunded')),
  provider        text,
  provider_ref    text,
  reference       text,
  proof_path      text,       -- private bucket path
  idempotency_key text unique,
  verified_by     uuid,
  verified_at     timestamptz,
  created_at      timestamptz not null default now()
);

create table public.payment_webhooks (
  id          bigserial primary key,
  provider    text not null,
  event_id    text not null,
  payload     jsonb not null,
  signature_ok boolean not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error       text,
  unique (provider, event_id)
);

create table public.sync_conflicts (
  id         bigserial primary key,
  sale_id    uuid references public.sales(id),
  kind       text not null,
  details    jsonb,
  status     text not null default 'open' check (status in ('open','resolved')),
  created_at timestamptz not null default now()
);

create table public.returns (
  id               uuid primary key default gen_random_uuid(),
  sale_id          uuid not null references public.sales(id),
  reason           text,
  refund_method    text not null,
  refund_total     bigint not null,
  journal_entry_id uuid references public.journal_entries(id),
  created_by       uuid default auth.uid(),
  created_at       timestamptz not null default now()
);
create table public.return_items (
  return_id    uuid references public.returns(id),
  sale_item_id uuid references public.sale_items(id),
  qty          int not null check (qty > 0),
  restock      boolean not null default true,
  primary key (return_id, sale_item_id)
);

create table public.loyalty_ledger (
  id          bigserial primary key,
  customer_id uuid not null references public.customers(id),
  points      int not null,
  reason      text not null,
  ref_type    text,
  ref_id      text,
  created_at  timestamptz not null default now()
);

-- Payment method -> ledger account.
create or replace function public._payment_account(p_method text, p_session uuid default null)
returns int language sql stable as $$
  select case p_method
    when 'cash' then coalesce((select d.cash_account from public.drawer_sessions s
                               join public.cash_drawers d on d.id = s.drawer_id where s.id = p_session), 10100)
    when 'card' then 10300 when 'raast' then 10300
    when 'jazzcash' then 10400 when 'easypaisa' then 10400
    when 'bank_transfer' then 10200
    when 'wallet' then 20300
    when 'khata' then 11000
    when 'cod' then 11100
  end
$$;

-- Validates wallet / khata capacity. Returns the journal line for the payment.
create or replace function public._payment_line(p_method text, p_amount bigint, p_customer uuid, p_session uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare ta public.trade_accounts;
begin
  if p_method = 'wallet' then
    if p_customer is null then raise exception 'wallet_requires_customer'; end if;
    if public.wallet_balance(p_customer) < p_amount then raise exception 'insufficient_wallet_credit'; end if;
    return jsonb_build_object('account', 20300, 'debit', p_amount, 'party_type', 'customer', 'party_id', p_customer);
  elsif p_method = 'khata' then
    select * into ta from public.trade_accounts where customer_id = p_customer;
    if not found or ta.status <> 'approved' then raise exception 'khata_requires_approved_trade_account'; end if;
    if public.khata_balance(p_customer) + p_amount > ta.credit_limit
       and not public.has_permission('trade.credit_limit.override') then
      raise exception 'credit_limit_exceeded: limit %, balance %', ta.credit_limit, public.khata_balance(p_customer);
    end if;
    return jsonb_build_object('account', 11000, 'debit', p_amount, 'party_type', 'customer', 'party_id', p_customer);
  end if;
  return jsonb_build_object('account', public._payment_account(p_method, p_session), 'debit', p_amount);
end $$;

-- Effective selling price for a customer (trade tier aware).
create or replace function public.price_for(p_variant uuid, p_customer uuid default null)
returns bigint language sql stable security definer set search_path = public as $$
  select coalesce(
    (select vtp.price from public.trade_accounts ta
       join public.variant_tier_prices vtp on vtp.tier_id = ta.tier_id and vtp.variant_id = p_variant
      where ta.customer_id = p_customer and ta.status = 'approved'),
    (select round(v.sale_price * (1 - pt.discount_pct / 100))::bigint from public.trade_accounts ta
       join public.price_tiers pt on pt.id = ta.tier_id
       join public.product_variants v on v.id = p_variant
      where ta.customer_id = p_customer and ta.status = 'approved'),
    (select sale_price from public.product_variants where id = p_variant))
$$;

-- -----------------------------------------------------------------------------
-- Core sale writer (internal): sale + items + stock + journal in one go.
-- p: { channel, customer_id, location_id, drawer_session_id, idempotency_key, client_id,
--      offline, sold_at, items:[{variant_id, qty, unit_price, discount, serial_unit_id}],
--      payments:[{method, amount, reference}], delivery_fee, notes, order_id,
--      deposit_applied, deposit_account }
-- -----------------------------------------------------------------------------
create or replace function public._write_sale(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_sale uuid; v_no bigint; v_customer uuid := (p->>'customer_id')::uuid;
  v_loc int := coalesce((p->>'location_id')::int, public.location_id('COUNTER'));
  v_session uuid := (p->>'drawer_session_id')::uuid;
  v_offline boolean := coalesce((p->>'offline')::boolean, false);
  v_channel text := coalesce(p->>'channel', 'pos');
  v_sold_at timestamptz := coalesce((p->>'sold_at')::timestamptz, now());
  v_date date := public.business_date(coalesce((p->>'sold_at')::timestamptz, now()));
  it jsonb; pay jsonb; v_var record; v_unit_price bigint; v_disc bigint; v_line bigint; v_cost bigint;
  v_subtotal bigint := 0; v_disc_total bigint := 0; v_cost_total bigint := 0; v_total bigint;
  v_paid bigint := 0; v_fee bigint := coalesce((p->>'delivery_fee')::bigint, 0);
  v_lines jsonb := '[]'; v_rev jsonb := '{}'; v_je uuid; v_conflicts jsonb := '[]'; v_onhand int;
  v_deposit bigint := coalesce((p->>'deposit_applied')::bigint, 0); k text; v_si uuid; v_warranty int;
  v_rev_override int := (p->>'revenue_account')::int;
  v_trusted boolean := coalesce((p->>'trusted_pricing')::boolean, false);
begin
  if v_date < public.business_date() and public.is_date_locked(v_date) then
    -- DECISION: offline sales whose day was already closed post into today.
    v_date := public.business_date();
  end if;

  insert into public.sales (channel, customer_id, location_id, drawer_session_id, idempotency_key, client_id,
                            is_offline, sold_at, business_date, notes, order_id, discount_code, delivery_fee)
  values (v_channel, v_customer, v_loc, v_session, p->>'idempotency_key', p->>'client_id', v_offline,
          v_sold_at, v_date, p->>'notes', (p->>'order_id')::uuid, p->>'discount_code', v_fee)
  returning id, sale_no into v_sale, v_no;

  for it in select * from jsonb_array_elements(p->'items') loop
    select v.*, c.revenue_account, pr.name as product_name, coalesce(v.warranty_days, pr.warranty_days) as wdays
      into v_var
      from public.product_variants v join public.products pr on pr.id = v.product_id
      join public.categories c on c.id = pr.category_id
     where v.id = (it->>'variant_id')::uuid;
    if not found then raise exception 'variant_not_found: %', it->>'variant_id'; end if;

    v_unit_price := coalesce((it->>'unit_price')::bigint, public.price_for(v_var.id, v_customer));
    v_disc := coalesce((it->>'discount')::bigint, 0);
    v_line := (it->>'qty')::int * v_unit_price - v_disc;
    if v_line < 0 then raise exception 'negative_line_total'; end if;
    -- Discount / min-price guardrails
    -- (trusted_pricing: prices/discounts already validated server-side, e.g. online orders)
    if v_disc > 0 and not v_trusted and not public.has_permission('pos.discount') then raise exception 'permission_denied: pos.discount'; end if;
    if v_line < (it->>'qty')::int * v_var.min_price and not v_trusted and not public.has_permission('pos.discount.above_limit') then
      raise exception 'below_min_price: % (min %)', v_var.sku, v_var.min_price using errcode = '42501';
    end if;

    -- Offline sync: never drop a sale; allow negative stock and flag it.
    v_onhand := public.on_hand(v_var.id, v_loc);
    if v_onhand < (it->>'qty')::int and v_offline then
      v_conflicts := v_conflicts || jsonb_build_object('variant_id', v_var.id, 'sku', v_var.sku,
                                                      'on_hand', v_onhand, 'qty', (it->>'qty')::int);
    end if;

    v_cost := v_var.avg_cost;
    insert into public.sale_items (sale_id, variant_id, description, qty, unit_price, discount, line_total,
                                   cost_at_sale, grade_at_sale, serial_unit_id, revenue_account)
    values (v_sale, v_var.id, v_var.product_name, (it->>'qty')::int, v_unit_price, v_disc, v_line, v_cost,
            v_var.grade, (it->>'serial_unit_id')::uuid, coalesce(v_rev_override, v_var.revenue_account))
    returning id into v_si;

    if it->>'serial_unit_id' is not null then
      update public.serial_units set status = 'sold', sold_sale_id = v_sale, sold_at = v_sold_at,
        customer_phone = (select phone from public.customers where id = v_customer),
        warranty_ends = v_date + coalesce(v_var.wdays, 0)
      where id = (it->>'serial_unit_id')::uuid and status = 'in_stock';
      if not found then raise exception 'serial_not_available'; end if;
    end if;
    if coalesce(v_var.wdays, 0) > 0 and v_customer is not null then
      insert into public.warranties (source_type, source_id, customer_id, variant_id, serial_unit_id, starts_on, ends_on)
      values ('sale', v_si::text, v_customer, v_var.id, (it->>'serial_unit_id')::uuid, v_date, v_date + v_var.wdays);
    end if;

    k := coalesce(v_rev_override, v_var.revenue_account)::text;
    v_rev := jsonb_set(v_rev, array[k], to_jsonb(coalesce((v_rev->>k)::bigint, 0) + (it->>'qty')::int * v_unit_price));
    v_subtotal := v_subtotal + (it->>'qty')::int * v_unit_price;
    v_disc_total := v_disc_total + v_disc;
    v_cost_total := v_cost_total + (it->>'qty')::int * v_cost;
  end loop;

  v_total := v_subtotal - v_disc_total + v_fee;

  -- Payments (Dr side)
  if v_deposit > 0 then
    v_lines := v_lines || jsonb_build_object('account', coalesce((p->>'deposit_account')::int, 20200), 'debit', v_deposit,
                                             'party_type', 'customer', 'party_id', v_customer);
    v_paid := v_deposit;
  end if;
  for pay in select * from jsonb_array_elements(coalesce(p->'payments', '[]')) loop
    continue when coalesce((pay->>'amount')::bigint, 0) = 0;
    v_lines := v_lines || public._payment_line(pay->>'method', (pay->>'amount')::bigint, v_customer, v_session);
    insert into public.payments (sale_id, order_id, customer_id, method, amount, reference, provider)
    values (v_sale, (p->>'order_id')::uuid, v_customer, pay->>'method', (pay->>'amount')::bigint, pay->>'reference', pay->>'provider');
    v_paid := v_paid + (pay->>'amount')::bigint;
  end loop;
  if v_paid <> v_total then
    raise exception 'payment_mismatch: total % paid %', v_total, v_paid;
  end if;

  -- Revenue (gross) / discounts / delivery / COGS
  for k in select jsonb_object_keys(v_rev) loop
    v_lines := v_lines || jsonb_build_object('account', k::int, 'credit', (v_rev->>k)::bigint);
  end loop;
  v_lines := v_lines
    || jsonb_build_object('account', 40900, 'debit', v_disc_total)
    || jsonb_build_object('account', 40500, 'credit', v_fee)
    || jsonb_build_object('account', 50100, 'debit', v_cost_total)
    || jsonb_build_object('account', 12000, 'credit', v_cost_total);

  v_je := public._post_journal(v_date, initcap(v_channel) || ' sale #' || v_no, v_channel || '_sale', v_sale::text,
                               v_lines, v_session);

  update public.sales set subtotal = v_subtotal, discount_total = v_disc_total, total = v_total,
         cost_total = v_cost_total, journal_entry_id = v_je where id = v_sale;
  -- Stock leaves after the journal exists so every movement links to it.
  for v_var in select si.variant_id, si.qty, si.serial_unit_id from public.sale_items si where si.sale_id = v_sale loop
    perform public._move_stock(v_var.variant_id, v_loc, -v_var.qty, 'sale', 'sale', v_sale::text,
                               null, v_offline, v_je, v_var.serial_unit_id);
  end loop;

  if jsonb_array_length(v_conflicts) > 0 then
    insert into public.sync_conflicts (sale_id, kind, details) values (v_sale, 'oversold_offline', v_conflicts);
  end if;

  -- Loyalty points (points per Rs 100, from settings)
  if v_customer is not null and v_channel in ('pos','online') then
    insert into public.loyalty_ledger (customer_id, points, reason, ref_type, ref_id)
    select v_customer, (v_total / 10000 * coalesce((public.setting('loyalty') ->> 'points_per_100')::int, 1))::int,
           'earn', 'sale', v_sale::text
    where v_total >= 10000 and coalesce((public.setting('loyalty') ->> 'enabled')::boolean, true);
  end if;

  return jsonb_build_object('sale_id', v_sale, 'sale_no', v_no, 'total', v_total, 'conflicts', v_conflicts);
end $$;

-- -----------------------------------------------------------------------------
-- Public POS RPCs
-- -----------------------------------------------------------------------------
create or replace function public.post_pos_sale(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_existing record; v_customer uuid; v_channel text;
begin
  perform public.require_permission('pos.sell');
  if p->>'idempotency_key' is null then raise exception 'idempotency_key_required'; end if;
  select id, sale_no, total into v_existing from public.sales where idempotency_key = p->>'idempotency_key';
  if found then
    return jsonb_build_object('sale_id', v_existing.id, 'sale_no', v_existing.sale_no, 'total', v_existing.total,
                              'duplicate', true, 'conflicts', '[]'::jsonb);
  end if;
  v_customer := coalesce((p->>'customer_id')::uuid, public._upsert_customer(p->>'customer_phone', p->>'customer_name'));
  v_channel := case when exists (select 1 from jsonb_array_elements(coalesce(p->'payments','[]')) x where x->>'method' = 'khata')
                    then 'trade' else 'pos' end;
  return public._write_sale(p || jsonb_build_object('customer_id', v_customer, 'channel', v_channel)
                              || case when v_channel = 'trade' then jsonb_build_object('revenue_account', 40300) else '{}'::jsonb end);
end $$;

-- Offline queue: posts each queued sale in order; one failure never blocks the rest.
create or replace function public.sync_offline_sales(p_sales jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s jsonb; v_res jsonb := '[]'; r jsonb;
begin
  perform public.require_permission('pos.sell');
  for s in select * from jsonb_array_elements(p_sales) order by (value->>'sold_at') loop
    begin
      r := public.post_pos_sale(s || jsonb_build_object('offline', true));
      v_res := v_res || jsonb_build_object('idempotency_key', s->>'idempotency_key', 'ok', true, 'result', r);
    exception when others then
      v_res := v_res || jsonb_build_object('idempotency_key', s->>'idempotency_key', 'ok', false, 'error', sqlerrm);
    end;
  end loop;
  return v_res;
end $$;

-- Sales return: Dr Sales (+ restock Dr Inventory / Cr COGS) / Cr refund account.
-- Unrestockable (defective) items: Dr Shrinkage / Cr COGS.
-- p: { sale_id, reason, refund_method, drawer_session_id, items:[{sale_item_id, qty, restock}] }
create or replace function public.post_sales_return(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_ret uuid; s public.sales; it jsonb; si public.sale_items; v_lines jsonb := '[]';
        v_refund bigint := 0; v_amt bigint; v_cost bigint; v_je uuid; v_session uuid := (p->>'drawer_session_id')::uuid;
        v_method text := coalesce(p->>'refund_method', 'cash');
begin
  perform public.require_permission('pos.void');
  select * into s from public.sales where id = (p->>'sale_id')::uuid for update;
  if not found then raise exception 'sale_not_found'; end if;
  insert into public.returns (sale_id, reason, refund_method, refund_total)
  values (s.id, p->>'reason', v_method, 0) returning id into v_ret;

  for it in select * from jsonb_array_elements(p->'items') loop
    select * into si from public.sale_items where id = (it->>'sale_item_id')::uuid and sale_id = s.id for update;
    if not found then raise exception 'sale_item_not_found'; end if;
    if si.returned_qty + (it->>'qty')::int > si.qty then raise exception 'return_exceeds_sold'; end if;
    -- refund the net price actually paid for these units
    v_amt := round(si.line_total::numeric * (it->>'qty')::int / si.qty);
    v_cost := si.cost_at_sale * (it->>'qty')::int;
    v_refund := v_refund + v_amt;
    v_lines := v_lines
      || jsonb_build_object('account', si.revenue_account, 'debit', v_amt)
      || jsonb_build_object('account', case when coalesce((it->>'restock')::boolean, true) then 12000 else 61000 end, 'debit', v_cost)
      || jsonb_build_object('account', 50100, 'credit', v_cost);
    insert into public.return_items (return_id, sale_item_id, qty, restock)
    values (v_ret, si.id, (it->>'qty')::int, coalesce((it->>'restock')::boolean, true));
    update public.sale_items set returned_qty = returned_qty + (it->>'qty')::int where id = si.id;
  end loop;

  if v_method = 'wallet' then
    if s.customer_id is null then raise exception 'wallet_refund_requires_customer'; end if;
    v_lines := v_lines || jsonb_build_object('account', 20300, 'credit', v_refund, 'party_type', 'customer', 'party_id', s.customer_id);
  elsif v_method = 'khata' then
    v_lines := v_lines || jsonb_build_object('account', 11000, 'credit', v_refund, 'party_type', 'customer', 'party_id', s.customer_id);
  else
    v_lines := v_lines || jsonb_build_object('account', public._payment_account(v_method, v_session), 'credit', v_refund);
  end if;

  v_je := public._post_journal(null, 'Return on sale #' || s.sale_no, 'sales_return', v_ret::text, v_lines, v_session);

  for it in select * from jsonb_array_elements(p->'items') loop
    if coalesce((it->>'restock')::boolean, true) then
      select * into si from public.sale_items where id = (it->>'sale_item_id')::uuid;
      perform public._move_stock(si.variant_id, coalesce(s.location_id, public.location_id('COUNTER')), (it->>'qty')::int,
                                 'return_in', 'return', v_ret::text, si.cost_at_sale, false, v_je);
      if si.serial_unit_id is not null then
        update public.serial_units set status = 'returned' where id = si.serial_unit_id;
      end if;
    end if;
  end loop;

  update public.returns set refund_total = v_refund, journal_entry_id = v_je where id = v_ret;
  update public.sales set status = case when exists (select 1 from public.sale_items where sale_id = s.id and returned_qty < qty)
                                        then 'partially_returned' else 'returned' end where id = s.id;
  perform public._audit('return', 'sales', s.id::text, null, p);
  return v_ret;
end $$;

-- Trade (khata) payment received: Dr Cash/Bank / Cr AR – Trade.
create or replace function public.post_trade_payment(p_customer uuid, p_amount bigint, p_method text,
                                                     p_reference text default null, p_session uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_pay uuid;
begin
  perform public.require_permission('trade.manage');
  if p_method in ('khata','wallet','cod') then raise exception 'invalid_method'; end if;
  insert into public.payments (customer_id, method, amount, reference) values (p_customer, p_method, p_amount, p_reference)
  returning id into v_pay;
  perform public._post_journal(null, 'Khata payment received', 'trade_payment', v_pay::text, jsonb_build_array(
    jsonb_build_object('account', public._payment_account(p_method, p_session), 'debit', p_amount),
    jsonb_build_object('account', 11000, 'credit', p_amount, 'party_type', 'customer', 'party_id', p_customer)), p_session);
  return v_pay;
end $$;

-- Expenses (cash from drawer or bank).
create table public.expenses (
  id               uuid primary key default gen_random_uuid(),
  expense_account  int not null references public.accounts(code),
  amount           bigint not null check (amount > 0),
  paid_from        int not null references public.accounts(code),
  drawer_session_id uuid references public.drawer_sessions(id),
  memo             text not null,
  expense_date     date not null default public.business_date(),
  receipt_path     text,
  journal_entry_id uuid references public.journal_entries(id),
  created_by       uuid default auth.uid(),
  created_at       timestamptz not null default now()
);

create or replace function public.post_expense(p_account int, p_amount bigint, p_paid_from int, p_memo text,
                                               p_session uuid default null, p_date date default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_je uuid;
begin
  perform public.require_permission('accounts.expense');
  if (select subtype from public.accounts where code = p_account) not in ('opex','cogs') then
    raise exception 'not_an_expense_account';
  end if;
  insert into public.expenses (expense_account, amount, paid_from, drawer_session_id, memo, expense_date)
  values (p_account, p_amount, p_paid_from, p_session, p_memo, coalesce(p_date, public.business_date())) returning id into v_id;
  v_je := public._post_journal(p_date, p_memo, 'expense', v_id::text, jsonb_build_array(
    jsonb_build_object('account', p_account, 'debit', p_amount),
    jsonb_build_object('account', p_paid_from, 'credit', p_amount)), p_session);
  update public.expenses set journal_entry_id = v_je where id = v_id;
  return v_id;
end $$;

-- Loyalty redemption -> wallet credit (Dr Marketing & Loyalty / Cr Wallet Credit).
create or replace function public.redeem_loyalty(p_customer uuid, p_points int)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_bal int; v_value bigint;
begin
  perform public.require_permission('pos.sell');
  select coalesce(sum(points), 0) into v_bal from public.loyalty_ledger where customer_id = p_customer;
  if p_points <= 0 or p_points > v_bal then raise exception 'insufficient_points'; end if;
  v_value := p_points::bigint * coalesce((public.setting('loyalty') ->> 'paisa_per_point')::bigint, 100);
  insert into public.loyalty_ledger (customer_id, points, reason) values (p_customer, -p_points, 'redeem');
  perform public._post_journal(null, 'Loyalty redemption', 'loyalty', p_customer::text, jsonb_build_array(
    jsonb_build_object('account', 60800, 'debit', v_value),
    jsonb_build_object('account', 20300, 'credit', v_value, 'party_type', 'customer', 'party_id', p_customer)));
  return v_value;
end $$;
