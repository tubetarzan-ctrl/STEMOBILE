-- Feedback round 1: custom POS lines, tracking by phone, opening balances, reset.

-- Custom amount line (no barcode): posts revenue, no stock movement.
do $$
declare r jsonb; v_moves int;
begin
  r := public.post_pos_sale(jsonb_build_object('idempotency_key', 'custom-1',
        'items', jsonb_build_array(jsonb_build_object('description', 'Software flashing', 'qty', 1, 'unit_price', 150000, 'revenue_account', 40400)),
        'payments', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 150000))));
  select count(*) into v_moves from public.stock_movements where ref_id = r->>'sale_id';
  if v_moves <> 0 then raise exception 'custom line moved stock'; end if;
  if (select sum(credit) from public.journal_lines jl join public.sales s on s.journal_entry_id = jl.entry_id
      where s.id = (r->>'sale_id')::uuid and jl.account_code = 40400) <> 150000 then raise exception 'custom line revenue wrong'; end if;
end $$;

-- Tracking: needs the right number AND the matching phone.
do $$
declare v_no text; v_phone text;
begin
  select ord.order_no, c.phone into v_no, v_phone from public.orders ord join public.customers c on c.id = ord.customer_id limit 1;
  if public.track_lookup(v_no, v_phone) is null then raise exception 'track_lookup failed for own order'; end if;
  if public.track_lookup(v_no, '03009999999') is not null then raise exception 'track_lookup leaked to wrong phone'; end if;
  if jsonb_array_length(public.track_by_phone(v_phone, v_no)->'orders') < 1 then raise exception 'track_by_phone empty'; end if;
end $$;

-- Opening balances balance against Opening Balance Equity.
do $$
declare v_je uuid;
begin
  v_je := public.post_opening_balances(jsonb_build_object('cash', 5000000, 'bank', 20000000,
    'customers', jsonb_build_array(jsonb_build_object('name', 'Old Khata Shop', 'phone', '03111234567', 'amount', 3000000)),
    'suppliers', jsonb_build_array(jsonb_build_object('name', 'Old Supplier', 'amount', 1000000))));
  if (select sum(debit) - sum(credit) from public.journal_lines where entry_id = v_je) <> 0 then raise exception 'opening unbalanced'; end if;
  if (select credit from public.journal_lines where entry_id = v_je and account_code = 30900) <> 27000000 then raise exception 'opening equity wrong'; end if;
end $$;

-- Import creates products + opening stock; delete archives items with history.
do $$
declare r jsonb;
begin
  r := public.import_products(jsonb_build_array(
    jsonb_build_object('name', 'Test Import Cable', 'category', 'Cables', 'brand', 'Anker', 'sku', 'IMP-1', 'price', 120000, 'cost', 60000, 'qty', 5),
    jsonb_build_object('name', 'Test Import Case', 'category', 'cases', 'sku', 'IMP-2', 'price', 50000)));
  if (r->>'created')::int <> 2 then raise exception 'import created %', r; end if;
  if (select sum(qty) from public.stock_movements m join public.product_variants v on v.id = m.variant_id where v.sku = 'IMP-1') <> 5 then raise exception 'opening stock missing'; end if;
  r := public.delete_products(array[(select product_id from public.product_variants where sku = 'IMP-1'), (select product_id from public.product_variants where sku = 'IMP-2')]);
  if (r->>'archived')::int <> 1 or (r->>'deleted')::int <> 1 then raise exception 'delete result %', r; end if;
end $$;

-- Paying a supplier settles the oldest bill first.
do $$
declare v_sup uuid;
begin
  select id into v_sup from public.suppliers where name = 'Old Supplier';
  perform public.pay_supplier_simple(v_sup, 400000, 10100);
  if (select paid_pkr from public.supplier_bills where supplier_id = v_sup and bill_no = 'OPENING') <> 400000 then raise exception 'supplier bill not reduced'; end if;
end $$;

-- Reset wipes all transactions (keeps catalogue), books start at zero.
do $$
begin
  begin
    perform public.reset_business_data(true, 'yes');
    raise exception 'expected confirmation_text_mismatch';
  exception when others then if sqlerrm not like 'confirmation_text_mismatch%' then raise; end if; end;
  perform public.reset_business_data(true, 'DELETE ALL TEST DATA');
  if exists (select 1 from public.journal_lines) or exists (select 1 from public.stock_movements) or exists (select 1 from public.sales) then
    raise exception 'reset left transactions behind';
  end if;
  if not exists (select 1 from public.products) then raise exception 'reset removed the catalogue'; end if;
  if not exists (select 1 from public.devices) then raise exception 'reset removed phone models'; end if;
end $$;
