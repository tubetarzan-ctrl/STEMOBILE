-- =============================================================================
-- Ledger & stock integrity tests (run after seed). CI fails on any exception.
-- Run: npm run db:test   (PGlite)   or   psql -f against a Supabase database.
-- =============================================================================

-- 1. Trial balance balances; every entry balances.
do $$
declare v_dr bigint; v_cr bigint; v_bad int;
begin
  select sum(debit), sum(credit) into v_dr, v_cr from public.journal_lines;
  if v_dr <> v_cr then raise exception 'TB out of balance: dr % cr %', v_dr, v_cr; end if;
  select count(*) into v_bad from (select entry_id from public.journal_lines group by entry_id
                                   having sum(debit) <> sum(credit) or count(*) < 2) x;
  if v_bad > 0 then raise exception '% unbalanced journal entries', v_bad; end if;
  if exists (select 1 from public.journal_entries e where not exists (select 1 from public.journal_lines l where l.entry_id = e.id)) then
    raise exception 'journal entry without lines';
  end if;
end $$;

-- 2. Stock: cached levels equal the sum of movements.
do $$
declare v_bad int;
begin
  select count(*) into v_bad from (
    select coalesce(sl.variant_id, m.variant_id) v, coalesce(sl.on_hand, 0) cached, coalesce(m.q, 0) summed
    from public.stock_levels sl
    full join (select variant_id, location_id, sum(qty) q from public.stock_movements group by 1, 2) m
      on m.variant_id = sl.variant_id and m.location_id = sl.location_id
    where coalesce(sl.on_hand, 0) <> coalesce(m.q, 0)) x;
  if v_bad > 0 then raise exception 'stock_levels differ from movements for % rows', v_bad; end if;
end $$;

-- 3. Inventory GL ≈ Σ on_hand × avg_cost (weighted-average rounding tolerance:
--    1 paisa per unit on hand).
do $$
declare v_gl bigint; v_stock bigint; v_units bigint;
begin
  select coalesce(sum(debit - credit), 0) into v_gl from public.journal_lines where account_code in (12000, 12100);
  select coalesce(sum(sl.on_hand::bigint * v.avg_cost), 0), coalesce(sum(abs(sl.on_hand)), 0)
    into v_stock, v_units from public.stock_levels sl join public.product_variants v on v.id = sl.variant_id;
  if abs(v_gl - v_stock) > greatest(v_units, 100) then
    raise exception 'Inventory GL % vs stock value % (diff %, tolerance %)', v_gl, v_stock, v_gl - v_stock, v_units;
  end if;
end $$;

-- 4. Balance sheet balances: assets = liabilities + equity (incl. unclosed earnings).
do $$
declare a bigint; le bigint;
begin
  select coalesce(sum(amount) filter (where section = 'asset'), 0),
         coalesce(sum(amount) filter (where section in ('liability','equity')), 0)
    into a, le from public.report_balance_sheet(public.business_date());
  if a <> le then raise exception 'Balance sheet does not balance: assets % vs L+E %', a, le; end if;
end $$;

-- 5. Cash flow statement reconciles to the change in cash.
do $$
declare v_sections bigint; v_net bigint;
begin
  select sum(amount) filter (where section <> 'net'), sum(amount) filter (where section = 'net')
    into v_sections, v_net from public.report_cash_flow(public.business_date() - 365, public.business_date());
  if v_sections <> v_net then raise exception 'Cash flow % does not reconcile to net change in cash %', v_sections, v_net; end if;
end $$;

-- 6. Posted journals are immutable.
do $$
begin
  begin
    update public.journal_lines set debit = debit + 1 where id = (select min(id) from public.journal_lines);
    raise exception 'expected immutability error';
  exception when others then
    if sqlerrm not like 'journal_immutable%' then raise; end if;
  end;
  begin
    delete from public.journal_entries where id = (select id from public.journal_entries limit 1);
    raise exception 'expected immutability error';
  exception when others then
    if sqlerrm not like 'journal_immutable%' then raise; end if;
  end;
  begin
    update public.stock_movements set qty = 99 where id = (select min(id) from public.stock_movements);
    raise exception 'expected append-only error';
  exception when others then
    if sqlerrm not like '%append_only%' then raise; end if;
  end;
end $$;

-- 7. Unbalanced journals are rejected.
do $$
begin
  begin
    perform public._post_journal(null, 'bad', 'test', null,
      '[{"account":10100,"debit":100},{"account":40100,"credit":90}]');
    set constraints all immediate;
    raise exception 'expected journal_unbalanced';
  exception when others then
    if sqlerrm not like 'journal_unbalanced%' then raise; end if;
  end;
end $$;

-- 8. A closed day reopens when something posts into it; a closed month is locked.
do $$
declare v_day date;
begin
  select date into v_day from public.business_days where status <> 'open' order by date limit 1;
  if v_day is not null then
    perform public._post_journal(v_day, 'late', 'test', null, '[{"account":10100,"debit":100},{"account":40100,"credit":100}]');
    if (select status from public.business_days where date = v_day) <> 'open' then raise exception 'closed day did not reopen'; end if;
  end if;
  insert into public.accounting_periods (kind, starts_on, ends_on, status) values ('month', '2020-01-01', '2020-01-31', 'closed');
  begin
    perform public._post_journal('2020-01-15', 'late', 'test', null,
      '[{"account":10100,"debit":100},{"account":40100,"credit":100}]');
    raise exception 'expected period_locked';
  exception when others then
    if sqlerrm not like 'period_locked%' then raise; end if;
  end;
end $$;

-- 9. Idempotent POS posting; reversal nets to zero.
do $$
declare v uuid; r1 jsonb; r2 jsonb; v_je uuid; v_rev uuid; v_bal bigint;
begin
  select sl.variant_id into v from public.stock_levels sl join public.product_variants pv on pv.id = sl.variant_id
   where sl.location_id = public.location_id('COUNTER') and sl.on_hand > 1 and not pv.is_serialized limit 1;
  r1 := public.post_pos_sale(jsonb_build_object('idempotency_key', 'test-idem-1',
          'items', jsonb_build_array(jsonb_build_object('variant_id', v, 'qty', 1)),
          'payments', jsonb_build_array(jsonb_build_object('method', 'cash',
                       'amount', (select sale_price from public.product_variants where id = v)))));
  r2 := public.post_pos_sale(jsonb_build_object('idempotency_key', 'test-idem-1', 'items', '[]', 'payments', '[]'));
  if (r1->>'sale_id') <> (r2->>'sale_id') or not (r2->>'duplicate')::boolean then raise exception 'idempotency failed'; end if;

  select journal_entry_id into v_je from public.sales where id = (r1->>'sale_id')::uuid;
  v_rev := public.reverse_journal(v_je, 'test');
  select sum(debit - credit) into v_bal from public.journal_lines where entry_id in (v_je, v_rev) and account_code = 10100;
  if v_bal <> 0 then raise exception 'reversal did not net to zero'; end if;
  begin
    perform public.reverse_journal(v_je, 'again');
    raise exception 'expected journal_already_reversed';
  exception when others then if sqlerrm not like 'journal_already_reversed%' then raise; end if; end;
end $$;

-- 10. Anonymous callers cannot post sales or journals; overselling online is blocked.
do $$
declare v uuid;
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin
    perform public.post_pos_sale('{"idempotency_key":"anon-1","items":[],"payments":[]}');
    raise exception 'expected permission_denied';
  exception when others then if sqlerrm not like 'permission_denied%' then raise; end if; end;
  begin
    perform public.post_manual_journal(null, 'x', '[]');
    raise exception 'expected permission_denied';
  exception when others then if sqlerrm not like 'permission_denied%' then raise; end if; end;

  select id into v from public.product_variants where not is_serialized order by sku limit 1;
  begin
    perform public.place_online_order(jsonb_build_object('idempotency_key', 'oversell-1', 'phone', '03000000001',
      'payment_method', 'cod', 'delivery_method', 'pickup',
      'items', jsonb_build_array(jsonb_build_object('variant_id', v, 'qty', 100000))));
    raise exception 'expected insufficient_stock';
  exception when others then if sqlerrm not like 'insufficient_stock%' then raise; end if; end;
  perform set_config('request.jwt.claims', '', true);
end $$;

-- 11. Offline oversell is posted (never dropped) and flagged as a conflict.
do $$
declare v uuid; r jsonb; v_have int;
begin
  select sl.variant_id, sl.on_hand into v, v_have from public.stock_levels sl join public.product_variants pv on pv.id = sl.variant_id
   where sl.location_id = public.location_id('COUNTER') and sl.on_hand between 1 and 5 and not pv.is_serialized limit 1;
  r := public.sync_offline_sales(jsonb_build_array(jsonb_build_object('idempotency_key', 'offline-1', 'sold_at', now(),
        'items', jsonb_build_array(jsonb_build_object('variant_id', v, 'qty', v_have + 2)),
        'payments', jsonb_build_array(jsonb_build_object('method', 'cash',
                     'amount', (v_have + 2) * (select sale_price from public.product_variants where id = v))))));
  if not (r->0->>'ok')::boolean then raise exception 'offline sale failed: %', r; end if;
  if not exists (select 1 from public.sync_conflicts where sale_id = (r->0->'result'->>'sale_id')::uuid) then
    raise exception 'offline oversell not flagged';
  end if;
end $$;

-- 12. Year-end close zeroes P&L accounts into Retained Earnings; reopen restores.
do $$
declare v_np bigint; v_re bigint; v_open bigint; v_ye date := public.business_date() + 1;
begin
  v_np := public.net_profit(v_ye - 364, v_ye);
  perform public.close_year(v_ye);
  select coalesce(sum(debit - credit), 0) into v_open from public.journal_lines jl join public.journal_entries je on je.id = jl.entry_id
   join public.accounts a on a.code = jl.account_code where a.type in ('income','expense') and je.entry_date <= v_ye;
  if v_open <> 0 then raise exception 'income/expense not zero after close: %', v_open; end if;
  select coalesce(sum(credit - debit), 0) into v_re from public.journal_lines where account_code = 30300;
  if v_re <> v_np then raise exception 'retained earnings % <> net profit %', v_re, v_np; end if;
  if public.net_profit(v_ye - 364, v_ye) <> v_np then raise exception 'P&L changed by closing entry'; end if;
  perform public.reopen_year(v_ye, 'test');
  select coalesce(sum(credit - debit), 0) into v_re from public.journal_lines where account_code = 30300;
  if v_re <> 0 then raise exception 'retained earnings not restored on reopen'; end if;
end $$;

-- 13. Genuine Proof codes exist, are random-looking and verify.
do $$
declare c text; r jsonb;
begin
  select proof_code into c from public.serial_units limit 1;
  if c is null then raise exception 'no proof codes generated'; end if;
  r := public.verify_proof_code(lower(c));
  if not (r->>'valid')::boolean then raise exception 'proof code did not verify'; end if;
  if (public.verify_proof_code('NOTACODE00')->>'valid')::boolean then raise exception 'bogus code verified'; end if;
end $$;

-- Re-check global balance after all scenario tests.
do $$
begin
  set constraints all immediate;
  if (select sum(debit) - sum(credit) from public.journal_lines) <> 0 then raise exception 'TB out of balance after tests'; end if;
end $$;
