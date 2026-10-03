-- =============================================================================
-- 0004 Purchasing: suppliers, POs, GRNs (partial), landed cost, supplier bills
-- Foreign amounts are stored in minor units (cents / fen). Because PKR also has
-- 100 minor units, paisa = foreign_minor * fx_rate (PKR per 1 unit of currency).
-- =============================================================================

create table public.suppliers (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  phone          text,
  city           text,
  country        text not null default 'Pakistan',
  currency       text not null default 'PKR',
  lead_time_days int not null default 7,
  notes          text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

create table public.purchase_orders (
  id          uuid primary key default gen_random_uuid(),
  po_no       bigserial unique,
  supplier_id uuid not null references public.suppliers(id),
  status      text not null default 'draft'
              check (status in ('draft','approved','partially_received','received','cancelled')),
  currency    text not null default 'PKR',
  fx_rate     numeric(14,4) not null default 1 check (fx_rate > 0),
  expected_on date,
  notes       text,
  is_suggested boolean not null default false,  -- created by smart reorder
  created_by  uuid default auth.uid(),
  approved_by uuid,
  created_at  timestamptz not null default now()
);

create table public.po_lines (
  id            uuid primary key default gen_random_uuid(),
  po_id         uuid not null references public.purchase_orders(id) on delete cascade,
  variant_id    uuid not null references public.product_variants(id),
  qty           int not null check (qty > 0),
  unit_cost_fc  bigint not null check (unit_cost_fc >= 0),
  received_qty  int not null default 0
);

create table public.grns (
  id               uuid primary key default gen_random_uuid(),
  grn_no           bigserial unique,
  supplier_id      uuid not null references public.suppliers(id),
  po_id            uuid references public.purchase_orders(id),
  location_id      int not null references public.locations(id),
  currency         text not null default 'PKR',
  fx_rate          numeric(14,4) not null default 1,
  supplier_bill_no text,
  idempotency_key  text unique,
  base_total       bigint not null default 0,   -- paisa
  charges_total    bigint not null default 0,
  journal_entry_id uuid references public.journal_entries(id),
  received_at      timestamptz not null default now(),
  created_by       uuid default auth.uid(),
  notes            text
);

create table public.grn_lines (
  id                uuid primary key default gen_random_uuid(),
  grn_id            uuid not null references public.grns(id),
  po_line_id        uuid references public.po_lines(id),
  variant_id        uuid not null references public.product_variants(id),
  qty               int not null check (qty > 0),
  unit_cost_fc      bigint not null,
  base_pkr          bigint not null,
  allocated_charges bigint not null default 0,
  landed_unit_cost  bigint not null
);

create table public.landed_cost_charges (
  id          uuid primary key default gen_random_uuid(),
  grn_id      uuid not null references public.grns(id),
  kind        text not null check (kind in ('freight','customs','clearing','other')),
  amount      bigint not null check (amount >= 0),
  allocate_by text not null default 'value' check (allocate_by in ('value','qty')),
  credit_account int not null default 20410 references public.accounts(code),
  vendor      text
);

create table public.supplier_bills (
  id          uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id),
  grn_id      uuid references public.grns(id),
  bill_no     text,
  bill_date   date not null default public.business_date(),
  currency    text not null default 'PKR',
  fx_rate     numeric(14,4) not null default 1,
  amount_fc   bigint not null,
  amount_pkr  bigint not null,
  paid_pkr    bigint not null default 0,
  due_date    date,
  status      text not null default 'unpaid' check (status in ('unpaid','partial','paid'))
);

create table public.supplier_payments (
  id               uuid primary key default gen_random_uuid(),
  supplier_id      uuid not null references public.suppliers(id),
  bill_id          uuid references public.supplier_bills(id),
  ap_settled       bigint not null,     -- AP value cleared (at booked rate)
  amount_paid      bigint not null,     -- PKR actually paid
  paid_from        int not null references public.accounts(code),
  reference        text,
  paid_on          date not null default public.business_date(),
  journal_entry_id uuid references public.journal_entries(id),
  created_by       uuid default auth.uid()
);

-- Receive goods. Payload:
-- { supplier_id, po_id?, location_id?, currency, fx_rate, bill_no, idempotency_key,
--   lines:[{variant_id, po_line_id?, qty, unit_cost_fc, serials?:[..]}],
--   charges:[{kind, amount, allocate_by, credit_account?, vendor?}] }
-- Journal: Dr Inventory (landed) / Cr AP (goods, party=supplier) / Cr accrued charges.
create or replace function public.receive_grn(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_grn uuid; v_fx numeric := coalesce((p->>'fx_rate')::numeric, 1);
  v_loc int := coalesce((p->>'location_id')::int, public.location_id('BACK'));
  v_base_total bigint := 0; v_qty_total bigint := 0; v_charges_total bigint := 0;
  v_inv_total bigint := 0; v_round bigint; v_je uuid;
  l jsonb; c jsonb; r record; v_alloc bigint; v_remaining bigint; v_n int; v_i int;
  v_line_total bigint; v_unit bigint; v_lines jsonb := '[]'; s text; v_su uuid; k int;
begin
  perform public.require_permission('inventory.receive');
  if p ? 'idempotency_key' then
    select id into v_grn from public.grns where idempotency_key = p->>'idempotency_key';
    if found then return v_grn; end if;
  end if;
  if jsonb_array_length(coalesce(p->'lines', '[]')) = 0 then raise exception 'grn_no_lines'; end if;

  insert into public.grns (supplier_id, po_id, location_id, currency, fx_rate, supplier_bill_no, idempotency_key, notes)
  values ((p->>'supplier_id')::uuid, (p->>'po_id')::uuid, v_loc, coalesce(p->>'currency','PKR'), v_fx,
          p->>'bill_no', p->>'idempotency_key', p->>'notes')
  returning id into v_grn;

  create temp table _gl (idx int, variant_id uuid, po_line_id uuid, qty int, unit_fc bigint,
                         base bigint, alloc bigint default 0, serials jsonb) on commit drop;
  v_i := 0;
  for l in select * from jsonb_array_elements(p->'lines') loop
    v_i := v_i + 1;
    insert into _gl values (v_i, (l->>'variant_id')::uuid, (l->>'po_line_id')::uuid, (l->>'qty')::int,
                            (l->>'unit_cost_fc')::bigint,
                            round((l->>'qty')::numeric * (l->>'unit_cost_fc')::numeric * v_fx)::bigint,
                            0, l->'serials');
  end loop;
  select sum(base), sum(qty), count(*) into v_base_total, v_qty_total, v_n from _gl;

  -- Allocate each charge across lines; the last line takes the rounding remainder.
  for c in select * from jsonb_array_elements(coalesce(p->'charges', '[]')) loop
    insert into public.landed_cost_charges (grn_id, kind, amount, allocate_by, credit_account, vendor)
    values (v_grn, c->>'kind', (c->>'amount')::bigint, coalesce(c->>'allocate_by','value'),
            coalesce((c->>'credit_account')::int, 20410), c->>'vendor');
    v_charges_total := v_charges_total + (c->>'amount')::bigint;
    v_remaining := (c->>'amount')::bigint;
    for r in select * from _gl order by idx loop
      if r.idx = v_n then v_alloc := v_remaining;
      elsif coalesce(c->>'allocate_by','value') = 'qty' or v_base_total = 0 then
        v_alloc := round((c->>'amount')::numeric * r.qty / v_qty_total);
      else
        v_alloc := round((c->>'amount')::numeric * r.base / v_base_total);
      end if;
      v_remaining := v_remaining - v_alloc;
      update _gl set alloc = alloc + v_alloc where idx = r.idx;
    end loop;
  end loop;

  -- Journal first (movements reference it).
  select coalesce(sum(round((base + alloc)::numeric / qty) * qty), 0) into v_inv_total from _gl;
  v_round := v_inv_total - (v_base_total + v_charges_total);
  -- DECISION: per-unit rounding of landed cost (a few paisa) goes to Misc Expense.
  v_lines := jsonb_build_array(
    jsonb_build_object('account', 12000, 'debit', v_inv_total),
    jsonb_build_object('account', 20100, 'credit', v_base_total, 'party_type', 'supplier', 'party_id', p->>'supplier_id'),
    jsonb_build_object('account', 69900, 'credit', v_round));
  for c in select jsonb_build_object('account', credit_account, 'credit', sum(amount)) j
             from public.landed_cost_charges where grn_id = v_grn group by credit_account loop
    v_lines := v_lines || c;
  end loop;
  v_je := public._post_journal(null, 'GRN received', 'grn', v_grn::text, v_lines);

  for r in select * from _gl order by idx loop
    v_line_total := r.base + r.alloc;
    v_unit := round(v_line_total::numeric / r.qty);
    insert into public.grn_lines (grn_id, po_line_id, variant_id, qty, unit_cost_fc, base_pkr, allocated_charges, landed_unit_cost)
    values (v_grn, r.po_line_id, r.variant_id, r.qty, r.unit_fc, r.base, r.alloc, v_unit);
    perform public._move_stock(r.variant_id, v_loc, r.qty, 'purchase', 'grn', v_grn::text, v_unit, false, v_je);
    if r.po_line_id is not null then
      update public.po_lines set received_qty = received_qty + r.qty where id = r.po_line_id;
    end if;
    -- Genuine Proof serials for serialized variants
    if (select is_serialized from public.product_variants where id = r.variant_id) then
      for k in 1..r.qty loop
        s := r.serials ->> (k - 1);
        insert into public.serial_units (variant_id, serial_or_imei, proof_code, location_id)
        values (r.variant_id, s, public._gen_proof_code(), v_loc);
      end loop;
    end if;
  end loop;

  update public.grns set base_total = v_base_total, charges_total = v_charges_total, journal_entry_id = v_je where id = v_grn;

  insert into public.supplier_bills (supplier_id, grn_id, bill_no, currency, fx_rate, amount_fc, amount_pkr, due_date)
  select (p->>'supplier_id')::uuid, v_grn, p->>'bill_no', coalesce(p->>'currency','PKR'), v_fx,
         (select sum(qty::bigint * unit_fc) from _gl), v_base_total,
         public.business_date() + coalesce((select lead_time_days from public.suppliers where id = (p->>'supplier_id')::uuid), 0);

  if p->>'po_id' is not null then
    update public.purchase_orders po set status = case
      when not exists (select 1 from public.po_lines pl where pl.po_id = po.id and pl.received_qty < pl.qty) then 'received'
      else 'partially_received' end
    where id = (p->>'po_id')::uuid;
  end if;
  drop table _gl;
  return v_grn;
end $$;

-- Pay a supplier. FX difference between AP booked and PKR paid -> FX gain/loss.
create or replace function public.record_supplier_payment(
  p_supplier uuid, p_bill uuid, p_ap_settled bigint, p_amount_paid bigint, p_paid_from int, p_reference text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_je uuid; v_diff bigint := p_amount_paid - p_ap_settled;
begin
  perform public.require_permission('purchases.pay');
  if (select subtype from public.accounts where code = p_paid_from) not in ('cash','bank') then
    raise exception 'pay_from_must_be_cash_or_bank';
  end if;
  insert into public.supplier_payments (supplier_id, bill_id, ap_settled, amount_paid, paid_from, reference)
  values (p_supplier, p_bill, p_ap_settled, p_amount_paid, p_paid_from, p_reference) returning id into v_id;
  v_je := public._post_journal(null, 'Supplier payment', 'supplier_payment', v_id::text, jsonb_build_array(
    jsonb_build_object('account', 20100, 'debit', p_ap_settled, 'party_type', 'supplier', 'party_id', p_supplier),
    jsonb_build_object('account', p_paid_from, 'credit', p_amount_paid),
    jsonb_build_object('account', case when v_diff > 0 then 61200 else 41100 end, 'debit', v_diff)));
  update public.supplier_payments set journal_entry_id = v_je where id = v_id;
  if p_bill is not null then
    update public.supplier_bills set paid_pkr = paid_pkr + p_ap_settled,
      status = case when paid_pkr + p_ap_settled >= amount_pkr then 'paid' else 'partial' end
    where id = p_bill;
  end if;
  return v_id;
end $$;

-- Smart reorder: velocity (last 30 days) x lead time + safety stock (reorder_level).
create or replace view public.v_reorder_suggestions as
with velocity as (
  select sm.variant_id, -sum(sm.qty)::numeric / 30 as per_day
  from public.stock_movements sm
  where sm.type in ('sale','repair_consume') and sm.created_at > now() - interval '30 days'
  group by sm.variant_id
)
select v.id as variant_id, v.sku, p.name, v.grade,
       public.on_hand(v.id) as on_hand, coalesce(vel.per_day, 0) as per_day, v.lead_time_days, v.reorder_level,
       greatest(ceil(coalesce(vel.per_day, 0) * v.lead_time_days + v.reorder_level - public.on_hand(v.id)), 0)::int as suggested_qty
from public.product_variants v
join public.products p on p.id = v.product_id
left join velocity vel on vel.variant_id = v.id
where v.is_active
  and public.on_hand(v.id) <= coalesce(vel.per_day, 0) * v.lead_time_days + v.reorder_level
  and (vel.per_day > 0 or v.reorder_level > 0);
