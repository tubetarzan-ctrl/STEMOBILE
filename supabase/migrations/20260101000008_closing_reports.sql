-- =============================================================================
-- 0008 Daily closing, month/year close, fixed assets, bank rec, reports
-- Reports are formula-driven from account type/subtype — no hard-coded lists.
-- =============================================================================

-- --- Daily closing -----------------------------------------------------------
create or replace function public.daily_summary(p_date date)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'date', p_date,
    'sales_by_channel', coalesce((select jsonb_object_agg(channel, t) from (
        select channel, sum(total) t from public.sales where business_date = p_date group by channel) x), '{}'),
    'sales_count', (select count(*) from public.sales where business_date = p_date),
    'revenue', (select coalesce(sum(total), 0) from public.sales where business_date = p_date),
    'gross_profit', (select coalesce(sum(total - delivery_fee - cost_total), 0) from public.sales where business_date = p_date),
    'payments_by_method', coalesce((select jsonb_object_agg(method, t) from (
        select pm.method, sum(pm.amount) t from public.payments pm
        where public.business_date(pm.created_at) = p_date and pm.status = 'verified' group by pm.method) x), '{}'),
    'repairs_delivered', (select count(*) from public.repair_jobs where public.business_date(delivered_at) = p_date),
    'repairs_received', (select count(*) from public.repair_jobs where public.business_date(created_at) = p_date),
    'expenses', (select coalesce(sum(amount), 0) from public.expenses where expense_date = p_date),
    'drawers', coalesce((select jsonb_agg(jsonb_build_object('drawer', d.name, 'status', s.status,
        'expected', s.expected, 'counted', s.counted, 'variance', s.variance, 'not_counted', s.not_counted))
        from public.drawer_sessions s join public.cash_drawers d on d.id = s.drawer_id where s.business_date = p_date), '[]'),
    'khata_movement', (select coalesce(sum(jl.debit - jl.credit), 0) from public.journal_lines jl
        join public.journal_entries je on je.id = jl.entry_id where jl.account_code = 11000 and je.entry_date = p_date),
    'top_items', coalesce((select jsonb_agg(x) from (
        select si.description as name, sum(si.qty) as qty, sum(si.line_total) as amount
        from public.sale_items si join public.sales s on s.id = si.sale_id
        where s.business_date = p_date group by si.description order by sum(si.line_total) desc limit 5) x), '[]'),
    'open_stock_alerts', (select count(*) from public.stock_alerts where status = 'open'),
    'discounts_given', (select coalesce(sum(discount_total), 0) from public.sales where business_date = p_date),
    'returns', (select coalesce(sum(refund_total), 0) from public.returns where public.business_date(created_at) = p_date))
$$;

-- Cron (default 23:59 PKT). Auto-closes open drawers (flagged not counted),
-- locks the day and stores the summary for the PDF/email/WhatsApp job.
create or replace function public.run_daily_closing(p_date date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_date date := coalesce(p_date, public.business_date()); s record; v_summary jsonb;
begin
  perform public.require_permission('accounts.period.close');
  for s in select * from public.drawer_sessions where status = 'open' and business_date <= v_date for update loop
    update public.drawer_sessions set status = 'auto_closed', closed_at = now(), not_counted = true,
           expected = public.drawer_expected(s.id) where id = s.id;
  end loop;
  v_summary := public.daily_summary(v_date);
  insert into public.business_days (date, status, closed_at, closed_by, summary)
  values (v_date, 'closed', now(), auth.uid(), v_summary)
  on conflict (date) do update set status = case when business_days.status = 'verified' then 'verified' else 'closed' end,
     closed_at = now(), closed_by = auth.uid(), summary = excluded.summary;
  return v_summary;
end $$;

create or replace function public.verify_business_day(p_date date)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_permission('accounts.period.close');
  update public.business_days set status = 'verified', verified_at = now(), verified_by = auth.uid()
   where date = p_date and status = 'closed';
  if not found then raise exception 'day_not_closed'; end if;
end $$;

create or replace function public.reopen_business_day(p_date date, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_permission('accounts.period.reopen');
  update public.business_days set status = 'open' where date = p_date;
  perform public._audit('reopen_day', 'business_days', p_date::text, null, jsonb_build_object('reason', p_reason));
end $$;

-- --- Reports -------------------------------------------------------------------
create or replace function public.report_trial_balance(p_as_of date default null)
returns table (code int, name text, type text, subtype text, debit bigint, credit bigint, balance bigint)
language sql stable security definer set search_path = public as $$
  select a.code, a.name, a.type, a.subtype,
         coalesce(sum(jl.debit), 0)::bigint, coalesce(sum(jl.credit), 0)::bigint,
         (public.account_sign(a.code) * coalesce(sum(jl.debit - jl.credit), 0))::bigint
  from public.accounts a
  left join public.journal_lines jl on jl.account_code = a.code
       and exists (select 1 from public.journal_entries je where je.id = jl.entry_id
                   and (p_as_of is null or je.entry_date <= p_as_of))
  group by a.code having coalesce(sum(jl.debit), 0) <> 0 or coalesce(sum(jl.credit), 0) <> 0
  order by a.code
$$;

-- P&L excludes year-end closing entries so it always shows real activity.
create or replace function public.report_profit_loss(p_from date, p_to date)
returns table (code int, name text, subtype text, amount bigint)
language sql stable security definer set search_path = public as $$
  select a.code, a.name, a.subtype, sum(jl.credit - jl.debit)::bigint
    -- income positive, expense negative
  from public.journal_lines jl
  join public.journal_entries je on je.id = jl.entry_id and not je.is_closing
  join public.accounts a on a.code = jl.account_code
  where a.type in ('income','expense') and je.entry_date between p_from and p_to
  group by a.code order by a.code
$$;

create or replace function public.net_profit(p_from date, p_to date)
returns bigint language sql stable as $$
  select coalesce(sum(amount), 0)::bigint from public.report_profit_loss(p_from, p_to)
$$;

-- Balance sheet: assets / liabilities / equity, with unclosed earnings shown as
-- "Current period earnings" so it always balances.
create or replace function public.report_balance_sheet(p_as_of date)
returns table (section text, code int, name text, subtype text, amount bigint)
language sql stable security definer set search_path = public as $$
  with bal as (
    select a.code, a.name, a.type, a.subtype, sum(jl.debit - jl.credit) as dr
    from public.journal_lines jl join public.journal_entries je on je.id = jl.entry_id
    join public.accounts a on a.code = jl.account_code
    where je.entry_date <= p_as_of group by a.code
  )
  select type, code, name, subtype, (public.account_sign(code) * dr)::bigint
    from bal where type in ('asset','liability','equity') and dr <> 0
  union all
  select 'equity', null, 'Current period earnings (unclosed)', 'retained_earnings',
         coalesce(-sum(dr), 0)::bigint from bal where type in ('income','expense')
  order by 1, 2 nulls last
$$;

-- Cash flow, indirect method. Cash = subtypes cash + bank.
create or replace function public.report_cash_flow(p_from date, p_to date)
returns table (section text, line text, amount bigint)
language sql stable security definer set search_path = public as $$
  with mv as (
    select a.subtype, a.type, sum(jl.debit - jl.credit) as dr
    from public.journal_lines jl join public.journal_entries je on je.id = jl.entry_id and not je.is_closing
    join public.accounts a on a.code = jl.account_code
    where je.entry_date between p_from and p_to group by a.subtype, a.type
  ), x as (
    select 'operating' s, 'Net profit' l, coalesce(-sum(dr), 0) amt, 1 o from mv where type in ('income','expense')
    union all select 'operating', 'Depreciation & contra assets', coalesce(-sum(dr), 0), 2 from mv where subtype = 'contra_asset'
    union all select 'operating', 'Change in receivables', coalesce(-sum(dr), 0), 3 from mv where subtype = 'ar'
    union all select 'operating', 'Change in inventory', coalesce(-sum(dr), 0), 4 from mv where subtype = 'inventory'
    union all select 'operating', 'Change in payables & accruals', coalesce(-sum(dr), 0), 5 from mv where subtype in ('ap','accrued')
    union all select 'operating', 'Change in customer deposits & wallet', coalesce(-sum(dr), 0), 6 from mv where subtype = 'deposit'
    union all select 'investing', 'Fixed assets', coalesce(-sum(dr), 0), 7 from mv where subtype = 'fixed_asset'
    union all select 'financing', 'Owner capital', coalesce(-sum(dr), 0), 8 from mv where subtype in ('capital')
    union all select 'financing', 'Owner drawings', coalesce(-sum(dr), 0), 9 from mv where subtype = 'drawings'
    union all select 'financing', 'Retained earnings adjustments', coalesce(-sum(dr), 0), 10 from mv where subtype = 'retained_earnings'
    union all select 'net', 'Net change in cash', coalesce(sum(dr), 0), 11 from mv where subtype in ('cash','bank')
  )
  select s, l, amt::bigint from x order by o
$$;

create or replace function public.report_changes_in_equity(p_from date, p_to date)
returns jsonb language sql stable security definer set search_path = public as $$
  with eq as (
    select a.subtype, je.entry_date < p_from as before, je.is_closing, sum(jl.credit - jl.debit) cr
    from public.journal_lines jl join public.journal_entries je on je.id = jl.entry_id
    join public.accounts a on a.code = jl.account_code
    where a.type = 'equity' and je.entry_date <= p_to group by 1, 2, 3
  ), pl_before as (
    select coalesce(sum(jl.credit - jl.debit), 0) v from public.journal_lines jl
    join public.journal_entries je on je.id = jl.entry_id join public.accounts a on a.code = jl.account_code
    where a.type in ('income','expense') and je.entry_date < p_from
  )
  select jsonb_build_object(
    'opening_equity', (select coalesce(sum(cr), 0) from eq where before) + (select v from pl_before),
    'capital_introduced', (select coalesce(sum(cr), 0) from eq where not before and subtype = 'capital'),
    'drawings', (select coalesce(sum(cr), 0) from eq where not before and subtype = 'drawings'),
    'net_profit', public.net_profit(p_from, p_to),
    'other', (select coalesce(sum(cr), 0) from eq where not before and subtype = 'retained_earnings' and not is_closing),
    'closing_equity', (select coalesce(sum(cr), 0) from eq) + (select coalesce(sum(jl.credit - jl.debit), 0)
        from public.journal_lines jl join public.journal_entries je on je.id = jl.entry_id
        join public.accounts a on a.code = jl.account_code where a.type in ('income','expense') and je.entry_date <= p_to))
$$;

create or replace view public.v_trial_balance as select * from public.report_trial_balance(null);
create or replace view public.v_general_ledger as
  select je.entry_date, je.entry_no, je.memo, je.source_type, je.source_id, jl.account_code, a.name as account_name,
         jl.debit, jl.credit, jl.party_type, jl.party_id, je.reversal_of, je.reversed_by, je.id as entry_id
  from public.journal_lines jl join public.journal_entries je on je.id = jl.entry_id
  join public.accounts a on a.code = jl.account_code;
create or replace view public.v_profit_loss as
  select date_trunc('month', je.entry_date)::date as month, a.code, a.name, a.subtype,
         sum(jl.credit - jl.debit)::bigint as amount   -- income +, expense -
  from public.journal_lines jl join public.journal_entries je on je.id = jl.entry_id and not je.is_closing
  join public.accounts a on a.code = jl.account_code where a.type in ('income','expense')
  group by 1, a.code;
create or replace view public.v_balance_sheet as select * from public.report_balance_sheet(public.business_date());

create or replace view public.v_stock_on_hand as
  select v.id as variant_id, v.sku, p.name, v.grade, c.name as category, l.code as location, sl.on_hand,
         v.avg_cost, sl.on_hand::bigint * v.avg_cost as value, v.reorder_level
  from public.stock_levels sl join public.product_variants v on v.id = sl.variant_id
  join public.products p on p.id = v.product_id join public.categories c on c.id = p.category_id
  join public.locations l on l.id = sl.location_id where sl.on_hand <> 0;

create or replace view public.v_khata_aging as
  with lines as (
    select jl.party_id::uuid as customer_id, je.entry_date, jl.debit - jl.credit as amt
    from public.journal_lines jl join public.journal_entries je on je.id = jl.entry_id
    where jl.account_code = 11000 and jl.party_type = 'customer'
  )
  select c.id as customer_id, c.name, c.phone, ta.shop_name, ta.credit_limit, ta.terms_days,
         sum(amt)::bigint as balance,
         -- DECISION: FIFO-free approximation — debits bucketed by age, payments
         -- reduce the oldest bucket first via the overall balance cap.
         least(sum(amt), sum(amt) filter (where amt > 0 and entry_date >= public.business_date() - 30))::bigint as d0_30,
         greatest(least(sum(amt) - coalesce(sum(amt) filter (where amt > 0 and entry_date >= public.business_date() - 30), 0),
                        coalesce(sum(amt) filter (where amt > 0 and entry_date between public.business_date() - 60 and public.business_date() - 31), 0)), 0)::bigint as d31_60,
         greatest(sum(amt) - coalesce(sum(amt) filter (where amt > 0 and entry_date >= public.business_date() - 60), 0), 0)::bigint as d60_plus,
         max(entry_date) filter (where amt < 0) as last_payment
  from lines join public.customers c on c.id = lines.customer_id
  left join public.trade_accounts ta on ta.customer_id = c.id
  group by c.id, ta.id having sum(amt) <> 0;

create or replace view public.v_payables_aging as
  select s.id as supplier_id, s.name, sum(b.amount_pkr - b.paid_pkr)::bigint as outstanding,
         sum(b.amount_pkr - b.paid_pkr) filter (where b.due_date < public.business_date())::bigint as overdue
  from public.supplier_bills b join public.suppliers s on s.id = b.supplier_id
  where b.status <> 'paid' group by s.id;

create or replace view public.v_dead_stock as
  select v.id as variant_id, v.sku, p.name, v.grade, public.on_hand(v.id) as on_hand,
         public.on_hand(v.id)::bigint * v.avg_cost as value_at_cost,
         (select max(created_at) from public.stock_movements sm where sm.variant_id = v.id and sm.type = 'sale') as last_sold,
         case when (select max(created_at) from public.stock_movements sm where sm.variant_id = v.id and sm.type = 'sale') is null
                then 'never'
              when (select max(created_at) from public.stock_movements sm where sm.variant_id = v.id and sm.type = 'sale') < now() - interval '180 days' then '180+'
              when (select max(created_at) from public.stock_movements sm where sm.variant_id = v.id and sm.type = 'sale') < now() - interval '90 days' then '90+'
              else '60+' end as bucket
  from public.product_variants v join public.products p on p.id = v.product_id
  where public.on_hand(v.id) > 0
    and not exists (select 1 from public.stock_movements sm where sm.variant_id = v.id and sm.type = 'sale'
                    and sm.created_at > now() - interval '60 days');

create or replace view public.v_daily_summary as
  select date, status, summary from public.business_days order by date desc;

-- Per-cashier risk signals (Owner Copilot + anomaly watch).
create or replace view public.v_cashier_risk as
  select s.cashier_id, pr.full_name, s.business_date,
         count(*) as sales, sum(s.discount_total)::bigint as discounts,
         round(100.0 * sum(s.discount_total) / nullif(sum(s.subtotal), 0), 2) as discount_pct,
         (select count(*) from public.returns r join public.sales s2 on s2.id = r.sale_id
           where r.created_by = s.cashier_id and public.business_date(r.created_at) = s.business_date) as returns,
         (select coalesce(sum(ds.variance), 0) from public.drawer_sessions ds
           where ds.opened_by = s.cashier_id and ds.business_date = s.business_date)::bigint as cash_variance
  from public.sales s left join public.profiles pr on pr.id = s.cashier_id
  where s.channel in ('pos','trade') group by s.cashier_id, pr.full_name, s.business_date;

-- --- Month / year close ------------------------------------------------------------
create or replace function public.close_month(p_month date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_start date := date_trunc('month', p_month)::date; v_end date; v_checks jsonb; v_ok boolean;
begin
  perform public.require_permission('accounts.period.close');
  v_end := (v_start + interval '1 month' - interval '1 day')::date;
  v_checks := jsonb_build_object(
    'trial_balance_balanced', (select coalesce(sum(debit), 0) = coalesce(sum(credit), 0) from public.report_trial_balance(v_end)),
    'unverified_payments', (select count(*) from public.payments where status = 'pending' and public.business_date(created_at) <= v_end),
    'pending_adjustments', (select count(*) from public.stock_adjustments where status = 'pending' and public.business_date(requested_at) <= v_end),
    'open_drawers', (select count(*) from public.drawer_sessions where status = 'open' and business_date <= v_end));
  v_ok := (v_checks->>'trial_balance_balanced')::boolean and (v_checks->>'unverified_payments')::int = 0
          and (v_checks->>'pending_adjustments')::int = 0 and (v_checks->>'open_drawers')::int = 0;
  if not v_ok then return jsonb_build_object('closed', false, 'checks', v_checks); end if;
  insert into public.accounting_periods (kind, starts_on, ends_on, status, closed_at, closed_by, checks)
  values ('month', v_start, v_end, 'closed', now(), auth.uid(), v_checks)
  on conflict (kind, starts_on) do update set status = 'closed', closed_at = now(), closed_by = auth.uid(), checks = v_checks;
  return jsonb_build_object('closed', true, 'checks', v_checks);
end $$;

-- Year-end: move all income/expense balances for the year into Retained Earnings.
-- Reversible (reopen_year) until finalised.
create or replace function public.close_year(p_year_end date)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_start date := (p_year_end - interval '1 year' + interval '1 day')::date; v_lines jsonb; v_net bigint; v_je uuid;
begin
  perform public.require_permission('accounts.period.close');
  if exists (select 1 from public.accounting_periods where kind = 'year' and starts_on = v_start and status <> 'open') then
    raise exception 'year_already_closed';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('account', a.code, 'debit', -sum_dr)), '[]'), coalesce(sum(sum_dr), 0)
    into v_lines, v_net
    from (select jl.account_code as code, sum(jl.debit - jl.credit) as sum_dr
          from public.journal_lines jl join public.journal_entries je on je.id = jl.entry_id and not je.is_closing
          join public.accounts a on a.code = jl.account_code
          where a.type in ('income','expense') and je.entry_date between v_start and p_year_end
          group by jl.account_code having sum(jl.debit - jl.credit) <> 0) a;
  v_lines := v_lines || jsonb_build_array(jsonb_build_object('account', 30300, 'debit', v_net));
  perform set_config('startech.override_lock', 'on', true);
  v_je := public._post_journal(p_year_end, 'Year-end closing ' || extract(year from p_year_end), 'year_close', p_year_end::text,
                               v_lines, null, true);
  perform set_config('startech.override_lock', 'off', true);
  insert into public.accounting_periods (kind, starts_on, ends_on, status, closed_at, closed_by, closing_entry_id)
  values ('year', v_start, p_year_end, 'closed', now(), auth.uid(), v_je)
  on conflict (kind, starts_on) do update set status = 'closed', closed_at = now(), closing_entry_id = v_je;
  perform public._audit('close_year', 'accounting_periods', p_year_end::text, null, jsonb_build_object('entry', v_je));
  return v_je;
end $$;

create or replace function public.reopen_year(p_year_end date, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare ap public.accounting_periods; v_rev uuid;
begin
  perform public.require_permission('accounts.period.reopen');
  select * into ap from public.accounting_periods where kind = 'year' and ends_on = p_year_end for update;
  if ap.status = 'final' then raise exception 'year_is_final'; end if;
  if ap.status <> 'closed' then raise exception 'year_not_closed'; end if;
  perform set_config('startech.override_lock', 'on', true);
  v_rev := public._post_journal(p_year_end, 'Reopen year ' || extract(year from p_year_end) || ': ' || p_reason, 'year_reopen',
     ap.closing_entry_id::text,
     (select jsonb_agg(jsonb_build_object('account', account_code, 'debit', credit, 'credit', debit))
        from public.journal_lines where entry_id = ap.closing_entry_id), null, true, ap.closing_entry_id);
  perform set_config('startech.override_lock', 'off', true);
  update public.journal_entries set reversed_by = v_rev where id = ap.closing_entry_id;
  update public.accounting_periods set status = 'open', closing_entry_id = null where id = ap.id;
  perform public._audit('reopen_year', 'accounting_periods', ap.id::text, to_jsonb(ap), jsonb_build_object('reason', p_reason));
end $$;

create or replace function public.finalize_year(p_year_end date)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_permission('accounts.period.reopen');
  update public.accounting_periods set status = 'final' where kind = 'year' and ends_on = p_year_end and status = 'closed';
  if not found then raise exception 'year_not_closed'; end if;
end $$;

-- --- Fixed assets & depreciation -------------------------------------------------
create table public.fixed_assets (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  category        text,
  acquired_on     date not null,
  cost            bigint not null check (cost > 0),
  salvage         bigint not null default 0,
  life_months     int not null check (life_months > 0),
  asset_account   int not null default 15000 references public.accounts(code),
  accum_account   int not null default 15900 references public.accounts(code),
  expense_account int not null default 61300 references public.accounts(code),
  status          text not null default 'active' check (status in ('active','disposed','fully_depreciated')),
  disposed_on     date,
  created_at      timestamptz not null default now()
);
create table public.depreciation_runs (
  asset_id         uuid references public.fixed_assets(id),
  period           date not null,   -- first day of month
  amount           bigint not null,
  journal_entry_id uuid references public.journal_entries(id),
  primary key (asset_id, period)
);

-- Register an asset bought with cash/bank (or capitalised with p_paid_from = 30100 for owner-contributed).
create or replace function public.add_fixed_asset(p_name text, p_category text, p_acquired date, p_cost bigint,
                                                  p_salvage bigint, p_life_months int, p_paid_from int)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.require_permission('accounts.fixed_assets');
  insert into public.fixed_assets (name, category, acquired_on, cost, salvage, life_months)
  values (p_name, p_category, p_acquired, p_cost, p_salvage, p_life_months) returning id into v_id;
  perform public._post_journal(p_acquired, 'Fixed asset: ' || p_name, 'fixed_asset', v_id::text, jsonb_build_array(
    jsonb_build_object('account', 15000, 'debit', p_cost), jsonb_build_object('account', p_paid_from, 'credit', p_cost)));
  return v_id;
end $$;

-- Straight-line monthly depreciation (idempotent per asset x month).
create or replace function public.run_depreciation(p_month date)
returns int language plpgsql security definer set search_path = public as $$
declare a public.fixed_assets; v_period date := date_trunc('month', p_month)::date; v_done bigint; v_amt bigint; n int := 0;
        v_je uuid; v_month_end date;
begin
  perform public.require_permission('accounts.fixed_assets');
  v_month_end := (v_period + interval '1 month' - interval '1 day')::date;
  for a in select * from public.fixed_assets where status = 'active' and acquired_on <= v_month_end loop
    continue when exists (select 1 from public.depreciation_runs where asset_id = a.id and period = v_period);
    select coalesce(sum(amount), 0) into v_done from public.depreciation_runs where asset_id = a.id;
    v_amt := least(round((a.cost - a.salvage)::numeric / a.life_months), a.cost - a.salvage - v_done);
    if v_amt <= 0 then
      update public.fixed_assets set status = 'fully_depreciated' where id = a.id;
      continue;
    end if;
    v_je := public._post_journal(v_month_end, 'Depreciation ' || a.name || ' ' || to_char(v_period, 'Mon YYYY'),
      'depreciation', a.id::text, jsonb_build_array(
        jsonb_build_object('account', a.expense_account, 'debit', v_amt),
        jsonb_build_object('account', a.accum_account, 'credit', v_amt)));
    insert into public.depreciation_runs values (a.id, v_period, v_amt, v_je);
    n := n + 1;
  end loop;
  return n;
end $$;

-- --- Bank reconciliation -------------------------------------------------------------
create table public.bank_statements (
  id           uuid primary key default gen_random_uuid(),
  account_code int not null references public.accounts(code),
  period_from  date not null,
  period_to    date not null,
  opening      bigint,
  closing      bigint,
  imported_at  timestamptz not null default now()
);
create table public.bank_statement_lines (
  id           uuid primary key default gen_random_uuid(),
  statement_id uuid not null references public.bank_statements(id) on delete cascade,
  txn_date     date not null,
  description  text,
  reference    text,
  amount       bigint not null    -- + deposit, - withdrawal
);
create table public.bank_matches (
  statement_line_id uuid primary key references public.bank_statement_lines(id) on delete cascade,
  journal_line_id   bigint unique not null references public.journal_lines(id),
  matched_by        text not null default 'auto',
  matched_at        timestamptz not null default now()
);

create or replace function public.auto_match_bank_statement(p_statement uuid, p_days int default 3)
returns int language plpgsql security definer set search_path = public as $$
declare st public.bank_statements; l record; v_jl bigint; n int := 0;
begin
  perform public.require_permission('accounts.bank_rec');
  select * into st from public.bank_statements where id = p_statement;
  for l in select * from public.bank_statement_lines bsl where statement_id = p_statement
           and not exists (select 1 from public.bank_matches m where m.statement_line_id = bsl.id) order by txn_date loop
    select jl.id into v_jl from public.journal_lines jl join public.journal_entries je on je.id = jl.entry_id
     where jl.account_code = st.account_code and (jl.debit - jl.credit) = l.amount
       and je.entry_date between l.txn_date - p_days and l.txn_date + p_days
       and not exists (select 1 from public.bank_matches m where m.journal_line_id = jl.id)
     order by abs(je.entry_date - l.txn_date) limit 1;
    if v_jl is not null then
      insert into public.bank_matches (statement_line_id, journal_line_id) values (l.id, v_jl);
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

create table public.financial_notes (
  id         uuid primary key default gen_random_uuid(),
  period_from date not null,
  period_to   date not null,
  section     text not null,
  content     jsonb,
  owner_commentary text,
  updated_at  timestamptz not null default now(),
  unique (period_from, period_to, section)
);
