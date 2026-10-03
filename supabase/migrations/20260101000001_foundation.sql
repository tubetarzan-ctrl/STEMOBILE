-- =============================================================================
-- 0001 Foundation: extensions, helpers, identity & access, audit, settings
-- =============================================================================
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- Business day in Asia/Karachi (UTC+5). All "day" logic must use this.
create or replace function public.business_date(ts timestamptz default now())
returns date language sql stable as $$
  select (ts at time zone 'Asia/Karachi')::date
$$;

-- True when the caller is the database itself (cron, migrations, seed, tests)
-- or the service role. Anonymous / authenticated PostgREST callers always carry
-- a JWT role claim of 'anon' or 'authenticated'.
create or replace function public._is_system()
returns boolean language sql stable as $$
  select coalesce(
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
    'system'
  ) in ('system', 'service_role')
$$;

-- -----------------------------------------------------------------------------
-- Roles & permissions
-- -----------------------------------------------------------------------------
create table public.roles (
  key         text primary key,
  name        text not null,
  description text
);

create table public.permissions (
  key         text primary key,
  module      text not null,
  description text not null
);

create table public.role_permissions (
  role_key       text references public.roles(key) on delete cascade,
  permission_key text references public.permissions(key) on delete cascade,
  primary key (role_key, permission_key)
);

create table public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  full_name      text,
  phone          text unique,
  email          text,
  role_key       text references public.roles(key),
  is_staff       boolean not null default false,
  is_active      boolean not null default true,   -- deactivate, never delete
  pin_hash       text,                            -- bcrypt via pgcrypto crypt()
  commission_pct numeric(5,2) not null default 0,
  created_at     timestamptz not null default now()
);

create table public.employee_permissions (
  profile_id     uuid references public.profiles(id) on delete cascade,
  permission_key text references public.permissions(key) on delete cascade,
  granted        boolean not null,
  primary key (profile_id, permission_key)
);

create table public.attendance (
  id          bigserial primary key,
  profile_id  uuid not null references public.profiles(id),
  clock_in    timestamptz not null default now(),
  clock_out   timestamptz,
  business_date date not null default public.business_date()
);

create table public.audit_log (
  id         bigserial primary key,
  at         timestamptz not null default now(),
  actor      uuid,
  action     text not null,
  entity     text not null,
  entity_id  text,
  before     jsonb,
  after      jsonb
);
create index on public.audit_log (entity, entity_id);
create index on public.audit_log (actor, at desc);

create table public.settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create or replace function public.setting(p_key text, p_default jsonb default null)
returns jsonb language sql stable as $$
  select coalesce((select value from public.settings where key = p_key), p_default)
$$;

-- -----------------------------------------------------------------------------
-- Permission checks
-- -----------------------------------------------------------------------------
create or replace function public.has_permission(p_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select case when public._is_system() then true else exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active and p.is_staff and (
      p.role_key = 'super_admin'
      or exists (select 1 from public.employee_permissions ep
                 where ep.profile_id = p.id and ep.permission_key = p_key and ep.granted)
      or (exists (select 1 from public.role_permissions rp
                  where rp.role_key = p.role_key and rp.permission_key = p_key)
          and not exists (select 1 from public.employee_permissions ep
                          where ep.profile_id = p.id and ep.permission_key = p_key and not ep.granted))
    )
  ) end
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public._is_system() or exists (
    select 1 from public.profiles where id = auth.uid() and is_staff and is_active)
$$;

create or replace function public.require_permission(p_key text)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_permission(p_key) then
    raise exception 'permission_denied: %', p_key using errcode = '42501';
  end if;
end $$;

create or replace function public._audit(p_action text, p_entity text, p_entity_id text,
                                         p_before jsonb default null, p_after jsonb default null)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_log (actor, action, entity, entity_id, before, after)
  values (auth.uid(), p_action, p_entity, p_entity_id, p_before, p_after)
$$;

-- Generic row audit trigger for sensitive tables.
create or replace function public._audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_id text;
begin
  v_id := coalesce(to_jsonb(new) ->> 'id', to_jsonb(old) ->> 'id', to_jsonb(new) ->> 'key', to_jsonb(old) ->> 'key');
  perform public._audit(lower(tg_op), tg_table_name, v_id,
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

create trigger audit_profiles after insert or update or delete on public.profiles
  for each row execute function public._audit_trigger();
create trigger audit_employee_permissions after insert or update or delete on public.employee_permissions
  for each row execute function public._audit_trigger();
create trigger audit_role_permissions after insert or update or delete on public.role_permissions
  for each row execute function public._audit_trigger();
create trigger audit_settings after insert or update or delete on public.settings
  for each row execute function public._audit_trigger();

-- Staff PIN verification for fast POS switching / sensitive re-prompts.
create or replace function public.set_staff_pin(p_profile uuid, p_pin text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_profile <> auth.uid() then perform public.require_permission('staff.manage'); end if;
  if p_pin !~ '^\d{4,6}$' then raise exception 'pin_must_be_4_to_6_digits'; end if;
  update public.profiles set pin_hash = crypt(p_pin, gen_salt('bf')) where id = p_profile;
end $$;

create or replace function public.verify_staff_pin(p_profile uuid, p_pin text)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.profiles
                 where id = p_profile and is_active and pin_hash is not null
                   and pin_hash = crypt(p_pin, pin_hash))
$$;

-- -----------------------------------------------------------------------------
-- Seed: roles & permission keys (structural, so they live in the migration)
-- -----------------------------------------------------------------------------
insert into public.roles (key, name, description) values
  ('super_admin',     'Super Admin',     'Owner. Everything.'),
  ('manager',         'Manager',         'Runs the shop floor'),
  ('inventory_clerk', 'Inventory Clerk', 'Stock in, counts, labels'),
  ('cashier',         'Cashier',         'Counter sales and drawer'),
  ('accountant',      'Accountant',      'Books, closing, reports'),
  ('repair_tech',     'Repair Technician','Repair jobs'),
  ('social_media',    'Social Media',    'Instagram posts and reels'),
  ('content_editor',  'Content Editor',  'Website content'),
  ('order_handler',   'Order Handler',   'Online orders and delivery'),
  ('trade_manager',   'Trade Manager',   'Technician Pro accounts');

insert into public.permissions (key, module, description) values
  ('pos.sell',                    'pos',       'Ring up counter sales'),
  ('pos.discount',                'pos',       'Give discounts within limit'),
  ('pos.discount.above_limit',    'pos',       'Sell below minimum price'),
  ('pos.void',                    'pos',       'Void / refund sales'),
  ('pos.drawer',                  'pos',       'Open and close cash drawers'),
  ('inventory.view',              'inventory', 'View stock and costs'),
  ('inventory.edit',              'inventory', 'Create / edit products and variants'),
  ('inventory.receive',           'inventory', 'Receive goods (GRN)'),
  ('inventory.adjust',            'inventory', 'Request stock adjustments'),
  ('inventory.adjust.approve',    'inventory', 'Approve stock adjustments'),
  ('inventory.transfer',          'inventory', 'Transfer stock between locations'),
  ('purchases.manage',            'purchases', 'Purchase orders and supplier bills'),
  ('purchases.pay',               'purchases', 'Pay suppliers'),
  ('orders.view',                 'orders',    'View online orders'),
  ('orders.manage',               'orders',    'Pack, dispatch, deliver orders'),
  ('orders.verify_payment',       'orders',    'Verify manual payment proofs'),
  ('repairs.view',                'repairs',   'View repair jobs'),
  ('repairs.manage',              'repairs',   'Create and update repair jobs'),
  ('repairs.deliver',             'repairs',   'Hand over and invoice repairs'),
  ('repairs.pricelist',           'repairs',   'Edit repair price list'),
  ('buyback.manage',              'repairs',   'Process buyback requests'),
  ('trade.manage',                'trade',     'Approve and manage trade accounts'),
  ('trade.credit_limit.edit',     'trade',     'Change credit limits'),
  ('trade.credit_limit.override', 'trade',     'Sell over credit limit'),
  ('customers.view',              'customers', 'View customers'),
  ('accounts.journal.create',     'accounts',  'Manual journals and reversals'),
  ('accounts.expense',            'accounts',  'Record expenses'),
  ('accounts.period.close',       'accounts',  'Close days, months and years'),
  ('accounts.period.reopen',      'accounts',  'Reopen locked periods'),
  ('accounts.bank_rec',           'accounts',  'Bank reconciliation'),
  ('accounts.fixed_assets',       'accounts',  'Fixed asset register'),
  ('reports.financial.view',      'reports',   'Financial reports'),
  ('reports.sales.view',          'reports',   'Sales reports'),
  ('social.post.create',          'social',    'Create Instagram posts'),
  ('social.post.publish',         'social',    'Publish Instagram posts'),
  ('content.edit',                'content',   'Edit website drafts'),
  ('content.publish',             'content',   'Publish website changes'),
  ('content.delete',              'content',   'Delete pages and sections'),
  ('media.upload',                'content',   'Upload media'),
  ('reviews.moderate',            'reviews',   'Moderate reviews'),
  ('reviews.reply',               'reviews',   'Reply to reviews'),
  ('promotions.manage',           'content',   'Discount codes and promotions'),
  ('blog.publish',                'content',   'Publish blog posts'),
  ('appearance.manage',           'content',   'Change site theme'),
  ('inbox.manage',                'inbox',     'Inquiries, WhatsApp and email inbox'),
  ('staff.manage',                'staff',     'Staff, roles and permissions'),
  ('settings.manage',             'settings',  'Business settings'),
  ('audit.view',                  'staff',     'View audit log');

insert into public.role_permissions (role_key, permission_key)
select r, p from (values
  ('manager','pos.sell'),('manager','pos.discount'),('manager','pos.discount.above_limit'),('manager','pos.void'),
  ('manager','pos.drawer'),('manager','inventory.view'),('manager','inventory.edit'),('manager','inventory.receive'),
  ('manager','inventory.adjust'),('manager','inventory.adjust.approve'),('manager','inventory.transfer'),
  ('manager','purchases.manage'),('manager','orders.view'),('manager','orders.manage'),('manager','orders.verify_payment'),
  ('manager','repairs.view'),('manager','repairs.manage'),('manager','repairs.deliver'),('manager','repairs.pricelist'),
  ('manager','buyback.manage'),('manager','trade.manage'),('manager','customers.view'),('manager','accounts.expense'),
  ('manager','reports.sales.view'),('manager','reviews.moderate'),('manager','reviews.reply'),('manager','inbox.manage'),
  ('inventory_clerk','inventory.view'),('inventory_clerk','inventory.edit'),('inventory_clerk','inventory.receive'),
  ('inventory_clerk','inventory.adjust'),('inventory_clerk','inventory.transfer'),
  ('cashier','pos.sell'),('cashier','pos.discount'),('cashier','pos.drawer'),('cashier','customers.view'),
  ('accountant','accounts.journal.create'),('accountant','accounts.expense'),('accountant','accounts.period.close'),
  ('accountant','accounts.bank_rec'),('accountant','accounts.fixed_assets'),('accountant','reports.financial.view'),
  ('accountant','reports.sales.view'),('accountant','purchases.pay'),('accountant','orders.verify_payment'),
  ('accountant','inventory.view'),('accountant','customers.view'),
  ('repair_tech','repairs.view'),('repair_tech','repairs.manage'),('repair_tech','inventory.view'),
  ('social_media','social.post.create'),('social_media','media.upload'),
  ('content_editor','content.edit'),('content_editor','media.upload'),('content_editor','social.post.create'),
  ('order_handler','orders.view'),('order_handler','orders.manage'),('order_handler','customers.view'),
  ('order_handler','inbox.manage'),
  ('trade_manager','trade.manage'),('trade_manager','customers.view'),('trade_manager','pos.sell')
) as t(r, p);
