-- =============================================================================
-- 0007 Repairs (price list, jobs, live tracker), warranties, buyback
-- DECISION: parts consumed on a job post Dr COGS / Cr Inventory immediately
-- (so every stock change carries a journal); labour + parts revenue is posted
-- at handover.
-- =============================================================================

create type public.repair_status as enum (
  'booked','received','diagnosing','awaiting_approval','awaiting_parts','in_repair',
  'quality_check','ready','delivered','cancelled','returned_unrepaired');

create table public.repair_price_list (
  id              uuid primary key default gen_random_uuid(),
  device_id       uuid not null references public.devices(id),
  issue           text not null check (issue in ('screen','battery','charging_port','camera','back_glass',
                                                 'speaker','microphone','face_id','water_damage','software','other')),
  grade           public.part_grade not null default 'NA',
  labour          bigint not null default 0,
  part_variant_id uuid references public.product_variants(id),
  part_price      bigint not null default 0,
  est_minutes     int not null default 60,
  warranty_days   int not null default 30,
  is_active       boolean not null default true,
  unique (device_id, issue, grade)
);

create sequence public.repair_no_seq;
create table public.repair_jobs (
  id              uuid primary key default gen_random_uuid(),
  job_no          text unique not null default ('RJ-' || lpad(nextval('public.repair_no_seq')::text, 6, '0')),
  tracking_ref    text unique not null default upper(encode(gen_random_bytes(5), 'hex')),
  approval_token  text unique not null default encode(gen_random_bytes(16), 'hex'),
  customer_id     uuid not null references public.customers(id),
  device_id       uuid references public.devices(id),
  device_label    text,
  imei            text,
  issues          text[] not null default '{}',
  condition       jsonb not null default '{}',
  passcode_enc    text,               -- AES-GCM ciphertext from the app layer; purged on handover
  estimate        bigint not null default 0,
  revised_estimate bigint,
  estimate_approved boolean,
  advance         bigint not null default 0,
  labour          bigint not null default 0,
  status          public.repair_status not null default 'booked',
  promised_at     timestamptz,
  technician_id   uuid references public.profiles(id),
  warranty_days   int not null default 30,
  warranty_of     uuid references public.repair_jobs(id),   -- warranty claim of an earlier job
  location_id     int references public.locations(id) default 1,
  sale_id         uuid references public.sales(id),
  notes           text,
  created_by      uuid default auth.uid(),
  created_at      timestamptz not null default now(),
  ready_at        timestamptz,
  delivered_at    timestamptz
);
create index on public.repair_jobs (status);
create index on public.repair_jobs (customer_id);

create table public.repair_status_history (
  id      bigserial primary key,
  job_id  uuid not null references public.repair_jobs(id),
  status  public.repair_status not null,
  note    text,
  by_user uuid default auth.uid(),
  at      timestamptz not null default now()
);
create table public.repair_checklists (
  job_id  uuid references public.repair_jobs(id),
  kind    text check (kind in ('intake','qc')),
  items   jsonb not null,      -- {"screen":"ok","face_id":"fail",...}
  by_user uuid default auth.uid(),
  at      timestamptz not null default now(),
  primary key (job_id, kind)
);
create table public.repair_parts (
  id             uuid primary key default gen_random_uuid(),
  job_id         uuid not null references public.repair_jobs(id),
  variant_id     uuid not null references public.product_variants(id),
  qty            int not null check (qty > 0),
  unit_price     bigint not null,
  unit_cost      bigint not null,
  grade          public.part_grade,
  serial_unit_id uuid references public.serial_units(id),
  journal_entry_id uuid references public.journal_entries(id),
  created_at     timestamptz not null default now()
);
create table public.repair_photos (
  id         uuid primary key default gen_random_uuid(),
  job_id     uuid not null references public.repair_jobs(id),
  stage      text not null check (stage in ('check_in','in_repair','handover')),
  path       text not null,          -- private bucket
  is_public  boolean not null default false,   -- shown on live tracker
  created_at timestamptz not null default now()
);

create table public.warranties (
  id             uuid primary key default gen_random_uuid(),
  source_type    text not null check (source_type in ('sale','repair')),
  source_id      text not null,
  customer_id    uuid not null references public.customers(id),
  variant_id     uuid references public.product_variants(id),
  serial_unit_id uuid references public.serial_units(id),
  starts_on      date not null,
  ends_on        date not null,
  status         text not null default 'active' check (status in ('active','claimed','expired','void')),
  terms          text,
  created_at     timestamptz not null default now()
);
create index on public.warranties (customer_id);

create table public.buyback_requests (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references public.customers(id),
  device_id       uuid references public.devices(id),
  part_type       text not null,       -- 'lcd','oled','device'
  condition       text,
  photos          text[] not null default '{}',
  indicative_price bigint,
  final_price     bigint,
  status          text not null default 'requested' check (status in ('requested','received','tested','paid','rejected')),
  payout_method   text check (payout_method in ('cash','wallet','khata','bank_transfer')),
  variant_id      uuid references public.product_variants(id),
  journal_entry_id uuid references public.journal_entries(id),
  created_at      timestamptz not null default now()
);

create or replace function public._repair_event(p_job uuid, p_status public.repair_status, p_note text)
returns void language sql security definer set search_path = public as $$
  insert into public.repair_status_history (job_id, status, note) values (p_job, p_status, p_note)
$$;

-- Instant Quote (public).
create or replace function public.repair_quote(p_device uuid, p_issue text)
returns table (grade public.part_grade, total bigint, labour bigint, part_price bigint, est_minutes int,
               warranty_days int, in_stock boolean)
language sql stable security definer set search_path = public as $$
  select rp.grade, rp.labour + coalesce(nullif(rp.part_price, 0), v.sale_price, 0), rp.labour,
         coalesce(nullif(rp.part_price, 0), v.sale_price, 0), rp.est_minutes, rp.warranty_days,
         rp.part_variant_id is null or public.on_hand(rp.part_variant_id) > 0
  from public.repair_price_list rp left join public.product_variants v on v.id = rp.part_variant_id
  where rp.device_id = p_device and rp.issue = p_issue and rp.is_active
  order by array_position(array['ORIG_NEW','ORIG_PULL','OEM','PREMIUM','STANDARD','NA']::public.part_grade[], rp.grade)
$$;

-- Intake. p: { phone, name, device_id, device_label, imei, issues[], condition{}, passcode_enc,
--              estimate, advance, advance_method, drawer_session_id, promised_at, technician_id,
--              warranty_of, status ('booked' for online booking, else 'received') }
create or replace function public.create_repair_job(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_customer uuid; v_job public.repair_jobs; v_adv bigint := coalesce((p->>'advance')::bigint, 0);
        v_status public.repair_status := coalesce(p->>'status', 'received')::public.repair_status;
begin
  -- public online booking is allowed only as status 'booked' with no money
  if not (v_status = 'booked' and v_adv = 0) then perform public.require_permission('repairs.manage'); end if;
  v_customer := public._upsert_customer(p->>'phone', p->>'name');
  if v_customer is null then raise exception 'phone_required'; end if;
  insert into public.repair_jobs (customer_id, device_id, device_label, imei, issues, condition, passcode_enc,
     estimate, advance, status, promised_at, technician_id, warranty_of, notes, labour)
  values (v_customer, (p->>'device_id')::uuid, p->>'device_label', p->>'imei',
          coalesce(array(select jsonb_array_elements_text(p->'issues')), '{}'), coalesce(p->'condition', '{}'),
          p->>'passcode_enc', coalesce((p->>'estimate')::bigint, 0), v_adv, v_status,
          (p->>'promised_at')::timestamptz, (p->>'technician_id')::uuid, (p->>'warranty_of')::uuid, p->>'notes',
          case when p->>'warranty_of' is not null then 0 else coalesce((p->>'labour')::bigint, 0) end)
  returning * into v_job;
  if v_adv > 0 then
    perform public._post_journal(null, 'Repair advance ' || v_job.job_no, 'repair_advance', v_job.id::text, jsonb_build_array(
      public._payment_line(coalesce(p->>'advance_method', 'cash'), v_adv, v_customer, (p->>'drawer_session_id')::uuid),
      jsonb_build_object('account', 20200, 'credit', v_adv, 'party_type', 'customer', 'party_id', v_customer)),
      (p->>'drawer_session_id')::uuid);
  end if;
  if p->>'warranty_of' is not null then
    update public.warranties set status = 'claimed' where source_type = 'repair' and source_id = p->>'warranty_of' and status = 'active';
  end if;
  perform public._repair_event(v_job.id, v_status, 'Job created');
  return jsonb_build_object('job_id', v_job.id, 'job_no', v_job.job_no, 'tracking_ref', v_job.tracking_ref,
                            'approval_token', v_job.approval_token);
end $$;

create or replace function public.update_repair_status(p_job uuid, p_status public.repair_status, p_note text default null,
                                                       p_revised_estimate bigint default null)
returns void language plpgsql security definer set search_path = public as $$
declare j public.repair_jobs;
begin
  perform public.require_permission('repairs.manage');
  select * into j from public.repair_jobs where id = p_job for update;
  if j.status in ('delivered','cancelled','returned_unrepaired') then raise exception 'job_closed'; end if;
  if p_status = 'delivered' then raise exception 'use_deliver_repair_job'; end if;
  if p_status = 'ready' and not exists (select 1 from public.repair_checklists where job_id = p_job and kind = 'qc') then
    raise exception 'qc_checklist_required';
  end if;
  update public.repair_jobs set status = p_status,
    revised_estimate = coalesce(p_revised_estimate, revised_estimate),
    estimate_approved = case when p_status = 'awaiting_approval' then null else estimate_approved end,
    ready_at = case when p_status = 'ready' then now() else ready_at end
  where id = p_job;
  perform public._repair_event(p_job, p_status, p_note);
end $$;

-- Customer approves / declines revised estimate from WhatsApp link (public, token-gated).
create or replace function public.respond_repair_estimate(p_token text, p_approve boolean)
returns text language plpgsql security definer set search_path = public as $$
declare j public.repair_jobs;
begin
  select * into j from public.repair_jobs where approval_token = p_token for update;
  if not found or j.status <> 'awaiting_approval' then raise exception 'nothing_to_approve'; end if;
  update public.repair_jobs set estimate_approved = p_approve,
    estimate = case when p_approve then coalesce(revised_estimate, estimate) else estimate end,
    status = case when p_approve then 'in_repair'::public.repair_status else 'returned_unrepaired'::public.repair_status end
  where id = j.id;
  perform public._repair_event(j.id, case when p_approve then 'in_repair'::public.repair_status else 'returned_unrepaired'::public.repair_status end,
                               case when p_approve then 'Customer approved estimate' else 'Customer declined estimate' end);
  return j.job_no;
end $$;

-- Consume a part on a job: stock out + Dr COGS / Cr Inventory.
create or replace function public.consume_repair_part(p_job uuid, p_variant uuid, p_qty int,
                                                      p_unit_price bigint default null, p_serial uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare j public.repair_jobs; v public.product_variants; v_je uuid; v_id uuid; v_loc int;
begin
  perform public.require_permission('repairs.manage');
  select * into j from public.repair_jobs where id = p_job;
  if j.status in ('delivered','cancelled') then raise exception 'job_closed'; end if;
  select * into v from public.product_variants where id = p_variant;
  v_loc := coalesce(j.location_id, public.location_id('COUNTER'));
  v_je := public._post_journal(null, 'Part used on ' || j.job_no || ' (' || v.sku || ')', 'repair_consume', p_job::text,
    jsonb_build_array(jsonb_build_object('account', 50100, 'debit', v.avg_cost * p_qty),
                      jsonb_build_object('account', 12000, 'credit', v.avg_cost * p_qty)));
  perform public._move_stock(p_variant, v_loc, -p_qty, 'repair_consume', 'repair', p_job::text, null, false, v_je, p_serial);
  insert into public.repair_parts (job_id, variant_id, qty, unit_price, unit_cost, grade, serial_unit_id, journal_entry_id)
  values (p_job, p_variant, p_qty,
          -- warranty claims are free to the customer
          case when j.warranty_of is not null then 0 else coalesce(p_unit_price, v.sale_price) end,
          v.avg_cost, v.grade, p_serial, v_je)
  returning id into v_id;
  if p_serial is not null then update public.serial_units set status = 'consumed' where id = p_serial; end if;
  return v_id;
end $$;

-- Handover. Dr Customer Deposits (advance) + payments / Cr Labour + Parts revenue.
-- Excess advance -> wallet credit. Commission accrued. Warranty issued. Passcode purged.
create or replace function public.deliver_repair_job(p_job uuid, p_payments jsonb, p_session uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare j public.repair_jobs; v_parts bigint; v_total bigint; v_applied bigint; v_paid bigint := 0; pay jsonb;
        v_lines jsonb := '[]'; v_sale uuid; v_je uuid; v_comm bigint; v_pct numeric;
begin
  perform public.require_permission('repairs.deliver');
  select * into j from public.repair_jobs where id = p_job for update;
  if j.status not in ('ready','quality_check','in_repair') then raise exception 'job_not_ready: %', j.status; end if;

  select coalesce(sum(qty * unit_price), 0) into v_parts from public.repair_parts where job_id = p_job;
  v_total := j.labour + v_parts;
  v_applied := least(j.advance, v_total);

  insert into public.sales (channel, customer_id, location_id, drawer_session_id, subtotal, total, repair_job_id,
                            cost_total, idempotency_key)
  values ('repair', j.customer_id, j.location_id, p_session, v_total, v_total, j.id,
          (select coalesce(sum(qty * unit_cost), 0) from public.repair_parts where job_id = p_job), 'repair:' || j.id)
  returning id into v_sale;
  insert into public.sale_items (sale_id, variant_id, description, qty, unit_price, line_total, cost_at_sale, grade_at_sale, revenue_account)
  select v_sale, variant_id, 'Repair part', qty, unit_price, qty * unit_price, unit_cost, grade, 40200
  from public.repair_parts where job_id = p_job;
  if j.labour > 0 then
    insert into public.sale_items (sale_id, description, qty, unit_price, line_total, revenue_account)
    values (v_sale, 'Repair labour – ' || coalesce(j.device_label, ''), 1, j.labour, j.labour, 40400);
  end if;

  v_lines := v_lines || jsonb_build_object('account', 20200, 'debit', v_applied, 'party_type', 'customer', 'party_id', j.customer_id);
  for pay in select * from jsonb_array_elements(coalesce(p_payments, '[]')) loop
    continue when coalesce((pay->>'amount')::bigint, 0) = 0;
    v_lines := v_lines || public._payment_line(pay->>'method', (pay->>'amount')::bigint, j.customer_id, p_session);
    insert into public.payments (sale_id, repair_job_id, customer_id, method, amount, reference)
    values (v_sale, j.id, j.customer_id, pay->>'method', (pay->>'amount')::bigint, pay->>'reference');
    v_paid := v_paid + (pay->>'amount')::bigint;
  end loop;
  if v_applied + v_paid <> v_total then raise exception 'payment_mismatch: due %, paid %', v_total - v_applied, v_paid; end if;
  v_lines := v_lines || jsonb_build_object('account', 40400, 'credit', j.labour)
                     || jsonb_build_object('account', 40200, 'credit', v_parts);
  if j.advance > v_total then
    v_lines := v_lines
      || jsonb_build_object('account', 20200, 'debit', j.advance - v_total, 'party_type', 'customer', 'party_id', j.customer_id)
      || jsonb_build_object('account', 20300, 'credit', j.advance - v_total, 'party_type', 'customer', 'party_id', j.customer_id);
  end if;
  -- technician commission on labour
  select commission_pct into v_pct from public.profiles where id = j.technician_id;
  v_comm := round(j.labour * coalesce(v_pct, 0) / 100);
  v_lines := v_lines || jsonb_build_object('account', 60300, 'debit', v_comm)
                     || jsonb_build_object('account', 20500, 'credit', v_comm, 'party_type', 'staff', 'party_id', j.technician_id);

  v_je := public._post_journal(null, 'Repair delivered ' || j.job_no, 'repair_sale', v_sale::text, v_lines, p_session);
  update public.sales set journal_entry_id = v_je where id = v_sale;

  insert into public.warranties (source_type, source_id, customer_id, starts_on, ends_on, terms)
  values ('repair', j.id::text, j.customer_id, public.business_date(), public.business_date() + j.warranty_days,
          'Repair warranty: workmanship and parts fitted');
  update public.repair_jobs set status = 'delivered', delivered_at = now(), sale_id = v_sale, passcode_enc = null where id = p_job;
  perform public._repair_event(p_job, 'delivered', null);
  return jsonb_build_object('sale_id', v_sale, 'total', v_total, 'advance_applied', v_applied, 'paid', v_paid);
end $$;

-- Cancel / return unrepaired: refund advance to cash or wallet.
create or replace function public.close_repair_unrepaired(p_job uuid, p_refund_method text, p_session uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare j public.repair_jobs;
begin
  perform public.require_permission('repairs.deliver');
  select * into j from public.repair_jobs where id = p_job for update;
  if j.status in ('delivered','cancelled') then raise exception 'job_closed'; end if;
  if j.advance > 0 then
    perform public._post_journal(null, 'Advance refund ' || j.job_no, 'repair_refund', j.id::text, jsonb_build_array(
      jsonb_build_object('account', 20200, 'debit', j.advance, 'party_type', 'customer', 'party_id', j.customer_id),
      case when p_refund_method = 'wallet'
           then jsonb_build_object('account', 20300, 'credit', j.advance, 'party_type', 'customer', 'party_id', j.customer_id)
           else jsonb_build_object('account', public._payment_account(p_refund_method, p_session), 'credit', j.advance) end),
      p_session);
  end if;
  update public.repair_jobs set status = case when j.status = 'booked' then 'cancelled'::public.repair_status
                                              else 'returned_unrepaired'::public.repair_status end,
         passcode_enc = null where id = p_job;
  perform public._repair_event(p_job, 'returned_unrepaired', 'Closed without repair');
end $$;

-- Live tracker (public, by tracking ref). Never exposes passcode, cost or IMEI.
create or replace function public.track_repair(p_ref text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'job_no', j.job_no, 'device', coalesce(d.name, j.device_label), 'status', j.status,
    'issues', j.issues, 'promised_at', j.promised_at, 'estimate', coalesce(j.revised_estimate, j.estimate),
    'awaiting_approval', j.status = 'awaiting_approval',
    'history', (select jsonb_agg(jsonb_build_object('status', h.status, 'at', h.at) order by h.at)
                from public.repair_status_history h where h.job_id = j.id),
    'warranty_ends', (select max(ends_on) from public.warranties w where w.source_type = 'repair' and w.source_id = j.id::text))
  from public.repair_jobs j left join public.devices d on d.id = j.device_id
  where j.tracking_ref = upper(trim(p_ref))
$$;

-- Buyback payout: stock in at agreed price; Dr Inventory / Cr cash|wallet|khata.
create or replace function public.post_buyback(p_request uuid, p_final_price bigint, p_payout text,
                                               p_variant uuid, p_session uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare b public.buyback_requests; v_je uuid; v_credit jsonb;
begin
  perform public.require_permission('buyback.manage');
  select * into b from public.buyback_requests where id = p_request for update;
  if b.status in ('paid','rejected') then raise exception 'buyback_closed'; end if;
  v_credit := case p_payout
    when 'wallet' then jsonb_build_object('account', 20300, 'credit', p_final_price, 'party_type', 'customer', 'party_id', b.customer_id)
    when 'khata'  then jsonb_build_object('account', 11000, 'credit', p_final_price, 'party_type', 'customer', 'party_id', b.customer_id)
    else jsonb_build_object('account', public._payment_account(p_payout, p_session), 'credit', p_final_price) end;
  v_je := public._post_journal(null, 'Buyback', 'buyback', p_request::text,
    jsonb_build_array(jsonb_build_object('account', 12000, 'debit', p_final_price), v_credit), p_session);
  perform public._move_stock(p_variant, public.location_id('BACK'), 1, 'buyback_in', 'buyback', p_request::text,
                             p_final_price, false, v_je);
  update public.buyback_requests set status = 'paid', final_price = p_final_price, payout_method = p_payout,
         variant_id = p_variant, journal_entry_id = v_je where id = p_request;
  return v_je;
end $$;

-- Warranty wallet (customer's own, by customer id).
create or replace view public.v_warranty_wallet as
select w.*, coalesce(p.name, 'Repair ' || rj.job_no) as title, su.proof_code,
       w.ends_on >= public.business_date() and w.status = 'active' as is_active,
       greatest(w.ends_on - public.business_date(), 0) as days_left
from public.warranties w
left join public.product_variants v on v.id = w.variant_id
left join public.products p on p.id = v.product_id
left join public.serial_units su on su.id = w.serial_unit_id
left join public.repair_jobs rj on w.source_type = 'repair' and rj.id::text = w.source_id;
