-- =============================================================================
-- 0002 Accounting engine: chart of accounts, journals (balanced, immutable),
--      periods & day locks, posting helper, reversal, manual journals.
-- =============================================================================

-- 5-digit blocks: 1xxxx assets · 2xxxx liabilities · 3xxxx equity
--                 4xxxx revenue · 5xxxx cost of sales · 6xxxx opex
create table public.accounts (
  code        int primary key check (code between 10000 and 69999),
  name        text not null,
  name_ur     text,
  type        text generated always as (
                case when code < 20000 then 'asset'
                     when code < 30000 then 'liability'
                     when code < 40000 then 'equity'
                     when code < 50000 then 'income'
                     else 'expense' end) stored,
  subtype     text not null check (subtype in (
                'cash','bank','ar','inventory','fixed_asset','contra_asset',
                'ap','deposit','accrued','capital','drawings','retained_earnings',
                'revenue','other_income','cogs','opex')),
  is_active   boolean not null default true,
  is_system   boolean not null default false,
  description text,
  created_at  timestamptz not null default now()
);

-- Debit-normal accounts: assets and expenses (incl. drawings, a contra-equity).
create or replace function public.account_sign(p_code int)
returns int language sql immutable as $$
  select case when p_code < 20000 or p_code >= 50000 then 1 else -1 end
$$;

create table public.business_days (
  date        date primary key,
  status      text not null default 'open' check (status in ('open','closed','verified')),
  closed_at   timestamptz,
  closed_by   uuid,
  verified_at timestamptz,
  verified_by uuid,
  summary     jsonb
);

create table public.accounting_periods (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('month','year')),
  starts_on    date not null,
  ends_on      date not null,
  status       text not null default 'open' check (status in ('open','closed','final')),
  closed_at    timestamptz,
  closed_by    uuid,
  checks       jsonb,
  closing_entry_id uuid,
  unique (kind, starts_on)
);

create table public.journal_entries (
  id                uuid primary key default gen_random_uuid(),
  entry_no          bigserial unique,
  entry_date        date not null default public.business_date(),
  memo              text,
  source_type       text not null,          -- 'pos_sale','grn','repair', 'manual', ...
  source_id         text,
  reversal_of       uuid references public.journal_entries(id),
  reversed_by       uuid references public.journal_entries(id),
  drawer_session_id uuid,
  is_closing        boolean not null default false,   -- year-end closing entries
  created_by        uuid default auth.uid(),
  created_at        timestamptz not null default now()
);
create index on public.journal_entries (source_type, source_id);
create index on public.journal_entries (entry_date);
create index on public.journal_entries (drawer_session_id);

create table public.journal_lines (
  id           bigserial primary key,
  entry_id     uuid not null references public.journal_entries(id) on delete restrict,
  account_code int  not null references public.accounts(code),
  debit        bigint not null default 0 check (debit >= 0),
  credit       bigint not null default 0 check (credit >= 0),
  memo         text,
  party_type   text,   -- 'customer' | 'supplier' | 'courier' | 'staff' : sub-ledgers (khata, wallet, AP)
  party_id     text,
  check ((debit > 0 and credit = 0) or (credit > 0 and debit = 0))
);
create index on public.journal_lines (entry_id);
create index on public.journal_lines (account_code);
create index on public.journal_lines (party_type, party_id);

-- --- Integrity: balanced, >= 2 lines (deferred to commit) --------------------
create or replace function public._check_entry_balanced()
returns trigger language plpgsql as $$
declare v_entry uuid; v_dr bigint; v_cr bigint; v_n int;
begin
  v_entry := case when tg_table_name = 'journal_entries' then (to_jsonb(new)->>'id')::uuid else (to_jsonb(new)->>'entry_id')::uuid end;
  select coalesce(sum(debit),0), coalesce(sum(credit),0), count(*)
    into v_dr, v_cr, v_n from public.journal_lines where entry_id = v_entry;
  if v_n < 2 or v_dr <> v_cr then
    raise exception 'journal_unbalanced: entry % debit % credit % lines %', v_entry, v_dr, v_cr, v_n
      using errcode = '23514';
  end if;
  return null;
end $$;

create constraint trigger journal_entry_balanced
  after insert on public.journal_entries deferrable initially deferred
  for each row execute function public._check_entry_balanced();
create constraint trigger journal_lines_balanced
  after insert on public.journal_lines deferrable initially deferred
  for each row execute function public._check_entry_balanced();

-- --- Integrity: immutable once posted ----------------------------------------
create or replace function public._journal_immutable()
returns trigger language plpgsql as $$
begin
  if tg_table_name = 'journal_lines' and tg_op = 'INSERT' then
    -- lines may only be added by _post_journal while it is posting this entry
    -- (transaction-local marker; robust inside subtransactions)
    if coalesce(current_setting('startech.posting_entry', true), '') <> new.entry_id::text then
      raise exception 'journal_immutable: cannot add lines to posted entry %', new.entry_id;
    end if;
    return new;
  end if;
  if tg_table_name = 'journal_entries' and tg_op = 'UPDATE' then
    if to_jsonb(old)->>'reversed_by' is null and to_jsonb(new)->>'reversed_by' is not null
       and (to_jsonb(old) - 'reversed_by') = (to_jsonb(new) - 'reversed_by') then
      return new;  -- the only permitted change: marking an entry reversed
    end if;
  end if;
  raise exception 'journal_immutable: posted journals are corrected by reversal only';
end $$;

create trigger journal_entries_immutable before update or delete on public.journal_entries
  for each row execute function public._journal_immutable();
create trigger journal_lines_immutable before insert or update or delete on public.journal_lines
  for each row execute function public._journal_immutable();

-- --- Period / day locks -------------------------------------------------------
create or replace function public.is_date_locked(p_date date)
returns boolean language sql stable as $$
  select exists (select 1 from public.business_days where date = p_date and status <> 'open')
      or exists (select 1 from public.accounting_periods
                 where p_date between starts_on and ends_on and status <> 'open')
$$;

create or replace function public._check_period_open()
returns trigger language plpgsql as $$
begin
  if public.is_date_locked(new.entry_date)
     and coalesce(current_setting('startech.override_lock', true), '') <> 'on' then
    raise exception 'period_locked: % is closed; post an owner-approved adjustment', new.entry_date
      using errcode = '55000';
  end if;
  return new;
end $$;

create trigger journal_entries_period_open before insert on public.journal_entries
  for each row execute function public._check_period_open();

-- --- Posting helper (internal) -----------------------------------------------
-- p_lines: [{"account":10100,"debit":1000}, {"account":40100,"credit":1000,"party_type":"customer","party_id":"..."}]
-- Zero lines are skipped; a negative debit becomes a credit (and vice versa).
create or replace function public._post_journal(
  p_date date, p_memo text, p_source_type text, p_source_id text,
  p_lines jsonb, p_drawer_session uuid default null, p_is_closing boolean default false,
  p_reversal_of uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; l jsonb; v_dr bigint; v_cr bigint; v_amt bigint;
begin
  insert into public.journal_entries (entry_date, memo, source_type, source_id, drawer_session_id, is_closing, reversal_of)
  values (coalesce(p_date, public.business_date()), p_memo, p_source_type, p_source_id,
          p_drawer_session, p_is_closing, p_reversal_of)
  returning id into v_id;
  perform set_config('startech.posting_entry', v_id::text, true);

  for l in select * from jsonb_array_elements(p_lines) loop
    v_amt := coalesce((l->>'debit')::bigint, 0) - coalesce((l->>'credit')::bigint, 0);
    continue when v_amt = 0;
    v_dr := greatest(v_amt, 0); v_cr := greatest(-v_amt, 0);
    insert into public.journal_lines (entry_id, account_code, debit, credit, memo, party_type, party_id)
    values (v_id, (l->>'account')::int, v_dr, v_cr, l->>'memo', l->>'party_type', l->>'party_id');
  end loop;
  perform set_config('startech.posting_entry', '', true);
  return v_id;
end $$;

-- Sub-ledger balance (debit-positive) for a party on an account, e.g. khata = 11000.
create or replace function public.party_balance(p_account int, p_party_type text, p_party_id text)
returns bigint language sql stable security definer set search_path = public as $$
  select coalesce(sum(debit - credit), 0)::bigint from public.journal_lines
  where account_code = p_account and party_type = p_party_type and party_id = p_party_id
$$;

-- --- Public RPCs ---------------------------------------------------------------
create or replace function public.reverse_journal(p_entry uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_old public.journal_entries; v_new uuid; v_lines jsonb;
begin
  perform public.require_permission('accounts.journal.create');
  select * into v_old from public.journal_entries where id = p_entry for update;
  if not found then raise exception 'journal_not_found'; end if;
  if v_old.reversed_by is not null then raise exception 'journal_already_reversed'; end if;
  if v_old.reversal_of is not null then raise exception 'cannot_reverse_a_reversal'; end if;

  select jsonb_agg(jsonb_build_object('account', account_code, 'debit', credit, 'credit', debit,
                   'memo', memo, 'party_type', party_type, 'party_id', party_id))
    into v_lines from public.journal_lines where entry_id = p_entry;

  v_new := public._post_journal(public.business_date(), 'Reversal of #' || v_old.entry_no || ': ' || p_reason,
                                'reversal', p_entry::text, v_lines, v_old.drawer_session_id, false, p_entry);
  update public.journal_entries set reversed_by = v_new where id = p_entry;
  perform public._audit('reverse', 'journal_entries', p_entry::text, to_jsonb(v_old), jsonb_build_object('reversal', v_new, 'reason', p_reason));
  return v_new;
end $$;

create or replace function public.post_manual_journal(p_date date, p_memo text, p_lines jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.require_permission('accounts.journal.create');
  if coalesce(trim(p_memo), '') = '' then raise exception 'memo_required'; end if;
  v_id := public._post_journal(p_date, p_memo, 'manual', null, p_lines);
  perform public._audit('create', 'journal_entries', v_id::text, null, jsonb_build_object('lines', p_lines, 'date', p_date));
  return v_id;
end $$;

-- Owner-approved adjustment into a locked period.
create or replace function public.post_adjustment_in_locked_period(p_date date, p_memo text, p_lines jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.require_permission('accounts.period.reopen');
  perform set_config('startech.override_lock', 'on', true);
  v_id := public._post_journal(p_date, '[Locked-period adjustment] ' || p_memo, 'manual_locked', null, p_lines);
  perform set_config('startech.override_lock', 'off', true);
  perform public._audit('locked_period_adjustment', 'journal_entries', v_id::text, null, jsonb_build_object('date', p_date, 'lines', p_lines));
  return v_id;
end $$;

-- -----------------------------------------------------------------------------
-- Chart of accounts seed
-- -----------------------------------------------------------------------------
insert into public.accounts (code, name, subtype, is_system) values
  (10100, 'Cash in Hand – Counter 1',       'cash', true),
  (10110, 'Cash in Hand – Counter 2',       'cash', false),
  (10200, 'Bank – Main Account',            'bank', true),
  (10300, 'Gateway Clearing (PayFast/Safepay)', 'bank', true),
  (10400, 'Mobile Wallets (JazzCash/Easypaisa)', 'bank', true),
  (11000, 'Accounts Receivable – Trade (Khata)', 'ar', true),
  (11100, 'COD Receivable – Courier',       'ar', true),
  (11200, 'Advances to Suppliers',          'ar', true),
  (12000, 'Inventory',                      'inventory', true),
  (12100, 'Inventory in Transit',           'inventory', true),
  (15000, 'Fixed Assets',                   'fixed_asset', true),
  (15900, 'Accumulated Depreciation',       'contra_asset', true),
  (20100, 'Accounts Payable',               'ap', true),
  (20200, 'Customer Deposits',              'deposit', true),
  (20300, 'Customer Wallet Credit',         'deposit', true),
  (20400, 'Accrued Expenses',               'accrued', true),
  (20410, 'Accrued Freight, Customs & Clearing', 'accrued', true),
  (20500, 'Technician Commission Payable',  'accrued', true),
  (30100, 'Owner''s Capital',               'capital', true),
  (30200, 'Owner''s Drawings',              'drawings', true),
  (30300, 'Retained Earnings',              'retained_earnings', true),
  (30900, 'Opening Balance Equity',         'capital', true),
  (40100, 'Sales – Accessories',            'revenue', true),
  (40200, 'Sales – Parts',                  'revenue', true),
  (40300, 'Sales – Trade',                  'revenue', true),
  (40400, 'Repair Labour Income',           'revenue', true),
  (40500, 'Delivery Income',                'revenue', true),
  (40900, 'Sales Discounts',                'revenue', true),
  (41000, 'Cash Over',                      'other_income', true),
  (41100, 'FX Gain',                        'other_income', true),
  (50100, 'Cost of Goods Sold',             'cogs', true),
  (60100, 'Rent',                           'opex', true),
  (60200, 'Salaries',                       'opex', true),
  (60300, 'Commissions',                    'opex', true),
  (60400, 'Utilities',                      'opex', true),
  (60500, 'Courier Charges',                'opex', true),
  (60600, 'Gateway Fees',                   'opex', true),
  (60700, 'Bank Charges',                   'opex', true),
  (60800, 'Marketing & Loyalty',            'opex', true),
  (60900, 'Cash Short',                     'opex', true),
  (61000, 'Inventory Shrinkage',            'opex', true),
  (61100, 'RTO Losses',                     'opex', true),
  (61200, 'FX Loss',                        'opex', true),
  (61300, 'Depreciation',                   'opex', true),
  (69900, 'Miscellaneous Expense',          'opex', true);
