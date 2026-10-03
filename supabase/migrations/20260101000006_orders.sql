-- =============================================================================
-- 0006 Online orders, reservations, COD confirmation, payments, courier & COD
-- DECISION: revenue is recognised at delivery (stock leaves the RESERVED
-- location then). Prepaid money sits in Customer Deposits until delivery, so an
-- RTO before delivery never needs a sales reversal — only the shipping loss.
-- =============================================================================

create type public.order_status as enum (
  'pending_payment','payment_submitted','confirmed','packed','dispatched','delivered',
  'cancelled','returned','rto');

create table public.discount_codes (
  id            uuid primary key default gen_random_uuid(),
  code          text unique not null,
  kind          text not null check (kind in ('percent','fixed')),
  value         bigint not null check (value > 0),         -- percent (whole number) or paisa
  category_ids  uuid[],
  product_ids   uuid[],
  channels      text[] not null default '{online,pos}',
  min_order     bigint not null default 0,
  max_uses      int,
  per_customer  int,
  used_count    int not null default 0,
  starts_at     timestamptz,
  ends_at       timestamptz,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);
create table public.discount_redemptions (
  id          bigserial primary key,
  code_id     uuid not null references public.discount_codes(id),
  customer_id uuid references public.customers(id),
  order_id    uuid,
  sale_id     uuid,
  amount      bigint not null,
  created_at  timestamptz not null default now()
);

create sequence public.orders_no_seq;

create table public.orders (
  id              uuid primary key default gen_random_uuid(),
  order_no        text unique not null default ('ST-' || lpad(nextval('public.orders_no_seq'::regclass)::text, 6, '0')),
  customer_id     uuid not null references public.customers(id),
  status          public.order_status not null default 'pending_payment',
  payment_method  text not null check (payment_method in ('cod','gateway','bank_transfer','pay_at_pickup')),
  delivery_method text not null check (delivery_method in ('pickup','rider','courier')),
  address         jsonb,
  city            text,
  subtotal        bigint not null default 0,
  discount_total  bigint not null default 0,
  delivery_fee    bigint not null default 0,
  total           bigint not null default 0,
  paid_amount     bigint not null default 0,      -- held in Customer Deposits
  risk_score      int not null default 0,
  risk_flags      text[] not null default '{}',
  requires_advance boolean not null default false,
  discount_code   text,
  idempotency_key text unique,
  expires_at      timestamptz,
  sale_id         uuid references public.sales(id),
  tracking_token  text unique not null default encode(gen_random_bytes(9), 'hex'),
  notes           text,
  created_at      timestamptz not null default now(),
  confirmed_at    timestamptz,
  dispatched_at   timestamptz,
  delivered_at    timestamptz
);
create index on public.orders (status);
create index on public.orders (customer_id);

create table public.order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id),
  qty        int not null check (qty > 0),
  unit_price bigint not null,
  discount   bigint not null default 0,
  line_total bigint not null
);

create table public.order_events (
  id       bigserial primary key,
  order_id uuid not null references public.orders(id),
  status   text not null,
  note     text,
  by_user  uuid default auth.uid(),
  at       timestamptz not null default now()
);

create table public.cod_confirmations (
  order_id     uuid primary key references public.orders(id),
  sent_at      timestamptz,
  channel      text not null default 'whatsapp',
  responded_at timestamptz,
  response     text check (response in ('confirmed','cancelled')),
  call_queue   boolean not null default false,
  call_notes   text
);

create table public.shipments (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id),
  provider      text not null,
  tracking_no   text unique,
  label_url     text,
  status        text not null default 'booked',
  cod_amount    bigint not null default 0,
  charges       bigint not null default 0,
  booked_at     timestamptz not null default now(),
  last_polled_at timestamptz,
  events        jsonb not null default '[]'
);

create table public.courier_remittances (
  id               uuid primary key default gen_random_uuid(),
  provider         text not null,
  reference        text not null,
  remitted_on      date not null,
  gross            bigint not null default 0,
  charges          bigint not null default 0,
  net              bigint not null default 0,
  issues           int not null default 0,
  journal_entry_id uuid references public.journal_entries(id),
  created_at       timestamptz not null default now(),
  unique (provider, reference)
);
create table public.courier_remittance_lines (
  id             bigserial primary key,
  remittance_id  uuid not null references public.courier_remittances(id),
  tracking_no    text,
  order_id       uuid references public.orders(id),
  cod_amount     bigint not null,
  charge         bigint not null default 0,
  expected       bigint,
  issue          text      -- 'unmatched' | 'short_paid' | null
);

create or replace function public._order_event(p_order uuid, p_status text, p_note text default null)
returns void language sql security definer set search_path = public as $$
  insert into public.order_events (order_id, status, note) values (p_order, p_status, p_note)
$$;

-- Discount code evaluation (shared by checkout and POS).
create or replace function public.evaluate_discount(p_code text, p_subtotal bigint, p_customer uuid, p_channel text)
returns bigint language plpgsql stable security definer set search_path = public as $$
declare d public.discount_codes; v_used int;
begin
  select * into d from public.discount_codes where upper(code) = upper(trim(p_code)) and is_active;
  if not found then raise exception 'invalid_discount_code'; end if;
  if (d.starts_at is not null and now() < d.starts_at) or (d.ends_at is not null and now() > d.ends_at) then
    raise exception 'discount_code_expired'; end if;
  if not (p_channel = any (d.channels)) then raise exception 'discount_code_not_valid_here'; end if;
  if p_subtotal < d.min_order then raise exception 'discount_min_order_not_met'; end if;
  if d.max_uses is not null and d.used_count >= d.max_uses then raise exception 'discount_code_used_up'; end if;
  if d.per_customer is not null and p_customer is not null then
    select count(*) into v_used from public.discount_redemptions where code_id = d.id and customer_id = p_customer;
    if v_used >= d.per_customer then raise exception 'discount_code_already_used'; end if;
  end if;
  return least(p_subtotal, case when d.kind = 'percent' then p_subtotal * d.value / 100 else d.value end);
end $$;

-- COD risk score: new number, past RTOs, high value, city mismatch.
create or replace function public._cod_risk(p_customer uuid, p_total bigint, p_city text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_score int := 0; v_flags text[] := '{}'; c public.customers; v_prev int;
begin
  select * into c from public.customers where id = p_customer;
  select count(*) into v_prev from public.orders where customer_id = p_customer and status = 'delivered';
  if v_prev = 0 then v_score := v_score + 20; v_flags := array_append(v_flags, 'new_customer'); end if;
  if c.rto_count > 0 then v_score := v_score + 40 * c.rto_count; v_flags := array_append(v_flags, 'past_rto'); end if;
  if p_total > coalesce((public.setting('cod') ->> 'high_value_paisa')::bigint, 2500000) then
    v_score := v_score + 25; v_flags := array_append(v_flags, 'high_value'); end if;
  if c.city is not null and p_city is not null and lower(c.city) <> lower(p_city) then
    v_score := v_score + 15; v_flags := array_append(v_flags, 'city_mismatch'); end if;
  return jsonb_build_object('score', v_score, 'flags', to_jsonb(v_flags),
    'requires_advance', v_score >= coalesce((public.setting('cod') ->> 'advance_threshold')::int, 60));
end $$;

-- Reserve: move stock from the sellable location with most stock into RESERVED.
create or replace function public._reserve(p_variant uuid, p_qty int, p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_left int := p_qty; r record; v_take int;
begin
  for r in select sl.location_id, sl.on_hand from public.stock_levels sl join public.locations l on l.id = sl.location_id
           where sl.variant_id = p_variant and l.is_sellable and sl.on_hand > 0 order by sl.on_hand desc loop
    exit when v_left = 0;
    v_take := least(v_left, r.on_hand);
    perform public._move_stock(p_variant, r.location_id, -v_take, 'online_reserve', 'order', p_order::text);
    perform public._move_stock(p_variant, public.location_id('RESERVED'), v_take, 'online_reserve', 'order', p_order::text);
    v_left := v_left - v_take;
  end loop;
  if v_left > 0 then
    raise exception 'insufficient_stock: % short by %', (select sku from public.product_variants where id = p_variant), v_left;
  end if;
end $$;

create or replace function public._release(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select variant_id, qty from public.order_items where order_id = p_order loop
    perform public._move_stock(r.variant_id, public.location_id('RESERVED'), -r.qty, 'online_release', 'order', p_order::text);
    perform public._move_stock(r.variant_id, public.location_id('COUNTER'), r.qty, 'online_release', 'order', p_order::text);
  end loop;
end $$;

-- Checkout. Prices always come from the database, never the client.
-- p: { idempotency_key, phone, name, city, address, payment_method, delivery_method,
--      discount_code, items:[{variant_id, qty}] }
create or replace function public.place_online_order(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_order public.orders; v_customer uuid; it jsonb; v_price bigint; v_sub bigint := 0;
        v_disc bigint := 0; v_fee bigint := 0; v_risk jsonb; v_total bigint; v_zone jsonb;
begin
  if p->>'idempotency_key' is null then raise exception 'idempotency_key_required'; end if;
  select * into v_order from public.orders where idempotency_key = p->>'idempotency_key';
  if found then return jsonb_build_object('order_id', v_order.id, 'order_no', v_order.order_no,
                                          'tracking_token', v_order.tracking_token, 'duplicate', true); end if;
  if jsonb_array_length(coalesce(p->'items','[]')) = 0 then raise exception 'empty_cart'; end if;

  v_customer := public._upsert_customer(p->>'phone', p->>'name');
  if v_customer is null then raise exception 'phone_required'; end if;
  if (select is_blocked from public.customers where id = v_customer) then raise exception 'customer_blocked'; end if;
  update public.customers set city = coalesce(city, p->>'city') where id = v_customer;

  insert into public.orders (customer_id, payment_method, delivery_method, address, city, idempotency_key,
                             discount_code, notes, expires_at)
  values (v_customer, p->>'payment_method', p->>'delivery_method', p->'address', p->>'city', p->>'idempotency_key',
          nullif(p->>'discount_code', ''), p->>'notes',
          case when p->>'payment_method' in ('bank_transfer','gateway')
               then now() + make_interval(hours => coalesce((public.setting('orders') ->> 'expiry_hours')::int, 24)) end)
  returning * into v_order;

  for it in select * from jsonb_array_elements(p->'items') loop
    if (it->>'qty')::int <= 0 then raise exception 'invalid_qty'; end if;
    v_price := public.price_for((it->>'variant_id')::uuid, v_customer);
    if v_price is null or not exists (select 1 from public.product_variants v join public.products pr on pr.id = v.product_id
                                      where v.id = (it->>'variant_id')::uuid and v.is_active and pr.is_online) then
      raise exception 'variant_not_available';
    end if;
    insert into public.order_items (order_id, variant_id, qty, unit_price, line_total)
    values (v_order.id, (it->>'variant_id')::uuid, (it->>'qty')::int, v_price, (it->>'qty')::int * v_price);
    v_sub := v_sub + (it->>'qty')::int * v_price;
    perform public._reserve((it->>'variant_id')::uuid, (it->>'qty')::int, v_order.id);
  end loop;

  if nullif(p->>'discount_code', '') is not null then
    v_disc := public.evaluate_discount(p->>'discount_code', v_sub, v_customer, 'online');
  end if;
  if p->>'delivery_method' <> 'pickup' then
    select z into v_zone from jsonb_array_elements(coalesce(public.setting('delivery_zones'), '[]')) z
     where lower(z->>'city') = lower(coalesce(p->>'city', 'Karachi')) limit 1;
    v_fee := coalesce((v_zone->>'fee')::bigint, (public.setting('delivery') ->> 'default_fee')::bigint, 25000);
    if v_sub - v_disc >= coalesce((public.setting('delivery') ->> 'free_over')::bigint, 9999999999) then v_fee := 0; end if;
  end if;
  v_total := v_sub - v_disc + v_fee;

  v_risk := case when p->>'payment_method' = 'cod' then public._cod_risk(v_customer, v_total, p->>'city')
                 else '{"score":0,"flags":[],"requires_advance":false}'::jsonb end;

  update public.orders set subtotal = v_sub, discount_total = v_disc, delivery_fee = v_fee, total = v_total,
    risk_score = (v_risk->>'score')::int,
    risk_flags = array(select jsonb_array_elements_text(v_risk->'flags')),
    requires_advance = (v_risk->>'requires_advance')::boolean
  where id = v_order.id;

  if p->>'payment_method' = 'cod' then
    -- DECISION: COD orders sit in pending_payment until the customer taps
    -- Confirm on WhatsApp ("payment" for COD = confirmation).
    insert into public.cod_confirmations (order_id) values (v_order.id);
  end if;
  perform public._order_event(v_order.id, 'pending_payment', 'Order placed');
  return jsonb_build_object('order_id', v_order.id, 'order_no', v_order.order_no, 'total', v_total,
                            'tracking_token', v_order.tracking_token, 'risk', v_risk);
end $$;

create or replace function public.confirm_cod(p_order uuid, p_confirmed boolean, p_channel text default 'whatsapp')
returns void language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order for update;
  if o.payment_method <> 'cod' or o.status <> 'pending_payment' then raise exception 'order_not_awaiting_cod_confirmation'; end if;
  if o.requires_advance and p_confirmed and o.paid_amount = 0 then raise exception 'advance_required'; end if;
  update public.cod_confirmations set responded_at = now(), response = case when p_confirmed then 'confirmed' else 'cancelled' end,
         channel = p_channel, call_queue = false where order_id = p_order;
  if p_confirmed then
    update public.orders set status = 'confirmed', confirmed_at = now() where id = p_order;
    perform public._order_event(p_order, 'confirmed', 'COD confirmed via ' || p_channel);
  else
    perform public._release(p_order);
    update public.orders set status = 'cancelled' where id = p_order;
    perform public._order_event(p_order, 'cancelled', 'COD cancelled via ' || p_channel);
  end if;
end $$;

-- Customer uploads a bank-transfer proof (path in private bucket).
create or replace function public.submit_payment_proof(p_order_no text, p_token text, p_proof_path text,
                                                       p_reference text, p_amount bigint)
returns uuid language plpgsql security definer set search_path = public as $$
declare o public.orders; v_pay uuid;
begin
  select * into o from public.orders where order_no = p_order_no and tracking_token = p_token for update;
  if not found then raise exception 'order_not_found'; end if;
  if o.status not in ('pending_payment','payment_submitted') then raise exception 'order_not_awaiting_payment'; end if;
  insert into public.payments (order_id, customer_id, method, amount, status, reference, proof_path)
  values (o.id, o.customer_id, 'bank_transfer', p_amount, 'pending', p_reference, p_proof_path) returning id into v_pay;
  update public.orders set status = 'payment_submitted', expires_at = null where id = o.id;
  perform public._order_event(o.id, 'payment_submitted', 'Payment proof uploaded');
  return v_pay;
end $$;

-- Staff verifies a manual payment: Dr Bank / Cr Customer Deposits.
create or replace function public.verify_payment(p_payment uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare pay public.payments; o public.orders;
begin
  perform public.require_permission('orders.verify_payment');
  select * into pay from public.payments where id = p_payment for update;
  if pay.status <> 'pending' then raise exception 'payment_not_pending'; end if;
  select * into o from public.orders where id = pay.order_id for update;
  if not p_approve then
    update public.payments set status = 'rejected', verified_by = auth.uid(), verified_at = now() where id = p_payment;
    update public.orders set status = 'pending_payment', expires_at = now() + interval '12 hours' where id = o.id;
    perform public._order_event(o.id, 'pending_payment', coalesce(p_note, 'Payment proof rejected'));
    return;
  end if;
  perform public._post_journal(null, 'Payment for ' || o.order_no, 'order_payment', p_payment::text, jsonb_build_array(
    jsonb_build_object('account', public._payment_account(pay.method), 'debit', pay.amount),
    jsonb_build_object('account', 20200, 'credit', pay.amount, 'party_type', 'customer', 'party_id', o.customer_id)));
  update public.payments set status = 'verified', verified_by = auth.uid(), verified_at = now() where id = p_payment;
  update public.orders set paid_amount = paid_amount + pay.amount,
    status = case when paid_amount + pay.amount >= total or payment_method = 'cod' then 'confirmed'::order_status else status end,
    confirmed_at = coalesce(confirmed_at, now())
  where id = o.id;
  perform public._order_event(o.id, 'confirmed', 'Payment verified');
  perform public._audit('verify_payment', 'payments', p_payment::text, to_jsonb(pay), null);
end $$;

-- Gateway webhook (signature verified in the API route). Idempotent per event id.
-- Dr Gateway Clearing / Cr Customer Deposits.
create or replace function public.handle_gateway_webhook(p_provider text, p_event_id text, p_payload jsonb,
                                                         p_signature_ok boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_wh bigint; o public.orders; v_amount bigint; v_pay uuid;
begin
  insert into public.payment_webhooks (provider, event_id, payload, signature_ok)
  values (p_provider, p_event_id, p_payload, p_signature_ok)
  on conflict (provider, event_id) do nothing returning id into v_wh;
  if v_wh is null then return jsonb_build_object('status', 'duplicate'); end if;
  if not p_signature_ok then
    update public.payment_webhooks set error = 'bad_signature', processed_at = now() where id = v_wh;
    return jsonb_build_object('status', 'rejected');
  end if;
  if p_payload->>'status' <> 'paid' then
    update public.payment_webhooks set processed_at = now(), error = 'status_' || (p_payload->>'status') where id = v_wh;
    return jsonb_build_object('status', 'ignored');
  end if;

  select * into o from public.orders where order_no = p_payload->>'order_no' for update;
  if not found then
    update public.payment_webhooks set error = 'order_not_found', processed_at = now() where id = v_wh;
    return jsonb_build_object('status', 'order_not_found');
  end if;
  v_amount := (p_payload->>'amount')::bigint;
  insert into public.payments (order_id, customer_id, method, amount, status, provider, provider_ref, idempotency_key, verified_at)
  values (o.id, o.customer_id, coalesce(p_payload->>'method', 'raast'), v_amount, 'verified', p_provider,
          p_payload->>'transaction_id', p_provider || ':' || p_event_id, now())
  returning id into v_pay;
  perform public._post_journal(null, 'Gateway payment ' || o.order_no, 'gateway_payment', v_pay::text, jsonb_build_array(
    jsonb_build_object('account', 10300, 'debit', v_amount),
    jsonb_build_object('account', 20200, 'credit', v_amount, 'party_type', 'customer', 'party_id', o.customer_id)));
  update public.orders set paid_amount = paid_amount + v_amount, expires_at = null,
    status = case when status in ('pending_payment','payment_submitted') and (paid_amount + v_amount >= total or payment_method = 'cod')
                  then 'confirmed'::order_status else status end,
    confirmed_at = coalesce(confirmed_at, now())
  where id = o.id;
  perform public._order_event(o.id, 'payment', 'Paid via ' || p_provider);
  update public.payment_webhooks set processed_at = now() where id = v_wh;
  return jsonb_build_object('status', 'ok', 'payment_id', v_pay);
end $$;

-- Gateway settlement to bank: Dr Bank + Gateway Fees / Cr Gateway Clearing.
create or replace function public.post_gateway_settlement(p_gross bigint, p_fees bigint, p_reference text, p_date date default null)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  perform public.require_permission('accounts.bank_rec');
  return public._post_journal(p_date, 'Gateway settlement ' || coalesce(p_reference, ''), 'gateway_settlement', p_reference,
    jsonb_build_array(jsonb_build_object('account', 10200, 'debit', p_gross - p_fees),
                      jsonb_build_object('account', 60600, 'debit', p_fees),
                      jsonb_build_object('account', 10300, 'credit', p_gross)));
end $$;

create or replace function public.update_order_status(p_order uuid, p_status public.order_status, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  perform public.require_permission('orders.manage');
  select * into o from public.orders where id = p_order for update;
  if p_status not in ('packed','dispatched') then raise exception 'use_dedicated_rpc_for_%', p_status; end if;
  if (p_status = 'packed' and o.status <> 'confirmed') or (p_status = 'dispatched' and o.status <> 'packed') then
    raise exception 'invalid_transition: % -> %', o.status, p_status;
  end if;
  update public.orders set status = p_status, dispatched_at = case when p_status = 'dispatched' then now() else dispatched_at end
  where id = p_order;
  perform public._order_event(p_order, p_status::text, p_note);
end $$;

-- Delivered: sale from RESERVED. Debit = deposits held + COD (courier receivable
-- or cash collected by rider / at pickup).
create or replace function public.mark_order_delivered(p_order uuid, p_session uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare o public.orders; v_items jsonb; v_due bigint; v_payments jsonb := '[]'; r jsonb; v_code_id uuid;
begin
  perform public.require_permission('orders.manage');
  select * into o from public.orders where id = p_order for update;
  if o.status not in ('confirmed','packed','dispatched') then raise exception 'order_not_deliverable: %', o.status; end if;

  -- spread the order discount across lines proportionally (last line takes remainder)
  select jsonb_agg(jsonb_build_object('variant_id', variant_id, 'qty', qty, 'unit_price', unit_price,
           'discount', case when rn = cnt then o.discount_total - coalesce(sum_prev, 0)
                            else round(o.discount_total::numeric * line_total / nullif(o.subtotal, 0)) end))
    into v_items
    from (select oi.*, row_number() over (order by oi.id) rn, count(*) over () cnt,
                 sum(round(o.discount_total::numeric * oi.line_total / nullif(o.subtotal, 0)))
                   over (order by oi.id rows between unbounded preceding and 1 preceding) sum_prev
          from public.order_items oi where oi.order_id = o.id) x;

  v_due := o.total - o.paid_amount;
  if v_due > 0 then
    v_payments := jsonb_build_array(jsonb_build_object('method',
      case when o.delivery_method = 'courier' then 'cod' else 'cash' end, 'amount', v_due));
  end if;

  r := public._write_sale(jsonb_build_object(
    'channel', 'online', 'customer_id', o.customer_id, 'location_id', public.location_id('RESERVED'),
    'drawer_session_id', p_session, 'order_id', o.id, 'items', v_items, 'payments', v_payments,
    'delivery_fee', o.delivery_fee, 'deposit_applied', o.paid_amount, 'discount_code', o.discount_code,
    'idempotency_key', 'order:' || o.id, 'trusted_pricing', true));

  update public.orders set status = 'delivered', delivered_at = now(), sale_id = (r->>'sale_id')::uuid where id = o.id;
  if o.discount_code is not null then
    select id into v_code_id from public.discount_codes where upper(code) = upper(o.discount_code);
    insert into public.discount_redemptions (code_id, customer_id, order_id, sale_id, amount)
    values (v_code_id, o.customer_id, o.id, (r->>'sale_id')::uuid, o.discount_total);
    update public.discount_codes set used_count = used_count + 1 where id = v_code_id;
  end if;
  perform public._order_event(o.id, 'delivered', null);
  return (r->>'sale_id')::uuid;
end $$;

-- Returned to origin before delivery: release stock, book shipping loss,
-- refund deposits (if any) to wallet credit.
create or replace function public.mark_order_rto(p_order uuid, p_shipping_loss bigint default 0)
returns void language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  perform public.require_permission('orders.manage');
  select * into o from public.orders where id = p_order for update;
  if o.status not in ('confirmed','packed','dispatched') then raise exception 'order_not_in_transit'; end if;
  perform public._release(p_order);
  if p_shipping_loss > 0 then
    perform public._post_journal(null, 'RTO shipping loss ' || o.order_no, 'rto', o.id::text, jsonb_build_array(
      jsonb_build_object('account', 61100, 'debit', p_shipping_loss),
      jsonb_build_object('account', 20100, 'credit', p_shipping_loss, 'party_type', 'courier', 'party_id',
                         coalesce((select provider from public.shipments where order_id = o.id limit 1), 'courier'))));
  end if;
  if o.paid_amount > 0 then
    perform public._post_journal(null, 'RTO deposit to wallet ' || o.order_no, 'rto_refund', o.id::text, jsonb_build_array(
      jsonb_build_object('account', 20200, 'debit', o.paid_amount, 'party_type', 'customer', 'party_id', o.customer_id),
      jsonb_build_object('account', 20300, 'credit', o.paid_amount, 'party_type', 'customer', 'party_id', o.customer_id)));
  end if;
  update public.customers set rto_count = rto_count + 1 where id = o.customer_id;
  update public.orders set status = 'rto' where id = p_order;
  perform public._order_event(p_order, 'rto', null);
end $$;

create or replace function public.cancel_order(p_order uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  perform public.require_permission('orders.manage');
  select * into o from public.orders where id = p_order for update;
  if o.status not in ('pending_payment','payment_submitted','confirmed','packed') then raise exception 'order_not_cancellable'; end if;
  perform public._release(p_order);
  if o.paid_amount > 0 then
    perform public._post_journal(null, 'Cancelled order deposit to wallet ' || o.order_no, 'order_cancel', o.id::text, jsonb_build_array(
      jsonb_build_object('account', 20200, 'debit', o.paid_amount, 'party_type', 'customer', 'party_id', o.customer_id),
      jsonb_build_object('account', 20300, 'credit', o.paid_amount, 'party_type', 'customer', 'party_id', o.customer_id)));
  end if;
  update public.orders set status = 'cancelled' where id = p_order;
  perform public._order_event(p_order, 'cancelled', p_reason);
end $$;

-- Cron: expire unpaid prepaid orders; push unconfirmed COD to call queue.
create or replace function public.expire_unpaid_orders()
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record; n_exp int := 0; n_call int;
begin
  for r in select id from public.orders where status = 'pending_payment' and payment_method <> 'cod'
           and expires_at is not null and expires_at < now() for update skip locked loop
    perform public._release(r.id);
    update public.orders set status = 'cancelled' where id = r.id;
    perform public._order_event(r.id, 'cancelled', 'Expired unpaid');
    n_exp := n_exp + 1;
  end loop;
  update public.cod_confirmations c set call_queue = true
    from public.orders o
   where o.id = c.order_id and o.status = 'pending_payment' and c.response is null and not c.call_queue
     and o.created_at < now() - make_interval(hours => coalesce((public.setting('cod') ->> 'confirm_hours')::int, 4));
  get diagnostics n_call = row_count;
  return jsonb_build_object('expired', n_exp, 'to_call_queue', n_call);
end $$;

-- Courier COD remittance import + reconciliation.
-- p: { provider, reference, remitted_on, lines:[{tracking_no, cod_amount, charge}] }
-- Dr Bank (net) + Courier Charges / Cr COD Receivable (gross matched).
create or replace function public.import_courier_remittance(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; l jsonb; sh public.shipments; v_gross bigint := 0; v_charges bigint := 0; v_issues int := 0;
        v_expected bigint; v_issue text;
begin
  perform public.require_permission('accounts.bank_rec');
  if exists (select 1 from public.courier_remittances where provider = p->>'provider' and reference = p->>'reference') then
    raise exception 'remittance_already_imported';
  end if;
  insert into public.courier_remittances (provider, reference, remitted_on)
  values (p->>'provider', p->>'reference', coalesce((p->>'remitted_on')::date, public.business_date())) returning id into v_id;

  for l in select * from jsonb_array_elements(p->'lines') loop
    select * into sh from public.shipments where tracking_no = l->>'tracking_no';
    v_issue := null; v_expected := null;
    if not found then
      v_issue := 'unmatched';
    else
      v_expected := sh.cod_amount;
      if (l->>'cod_amount')::bigint < sh.cod_amount then v_issue := 'short_paid'; end if;
      v_gross := v_gross + (l->>'cod_amount')::bigint;
      v_charges := v_charges + coalesce((l->>'charge')::bigint, 0);
    end if;
    if v_issue is not null then v_issues := v_issues + 1; end if;
    insert into public.courier_remittance_lines (remittance_id, tracking_no, order_id, cod_amount, charge, expected, issue)
    values (v_id, l->>'tracking_no', sh.order_id, (l->>'cod_amount')::bigint, coalesce((l->>'charge')::bigint, 0), v_expected, v_issue);
  end loop;

  update public.courier_remittances set gross = v_gross, charges = v_charges, net = v_gross - v_charges, issues = v_issues,
    journal_entry_id = case when v_gross > 0 then public._post_journal(remitted_on, 'COD remittance ' || reference,
      'courier_remittance', v_id::text, jsonb_build_array(
        jsonb_build_object('account', 10200, 'debit', v_gross - v_charges),
        jsonb_build_object('account', 60500, 'debit', v_charges),
        jsonb_build_object('account', 11100, 'credit', v_gross))) end
  where id = v_id;
  return jsonb_build_object('remittance_id', v_id, 'gross', v_gross, 'charges', v_charges, 'issues', v_issues);
end $$;
