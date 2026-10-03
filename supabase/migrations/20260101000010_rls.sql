-- =============================================================================
-- 0010 Row Level Security, table grants, function execute grants
-- Model:
--  * RLS on every table. No INSERT/UPDATE/DELETE policies on ledger, stock or
--    sales tables: those change only through SECURITY DEFINER RPCs.
--  * anon/authenticated get column-limited SELECT on storefront tables, so the
--    storefront can never read cost, min price, margin or supplier data.
--  * Staff panels read through server actions (service role) after
--    requirePermission(); staff policies below are defence in depth.
-- =============================================================================

do $$ declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;
grant usage on all sequences in schema public to service_role;
revoke all on all tables in schema public from anon, authenticated;  -- views too

-- ---------------------------------------------------------------------------
-- Storefront (anon + authenticated) read access
-- ---------------------------------------------------------------------------
create or replace function public._public_read(p_table text, p_cols text, p_using text)
returns void language plpgsql as $$
begin
  execute format('grant select (%s) on public.%I to anon, authenticated', p_cols, p_table);
  execute format('create policy %I on public.%I for select to anon, authenticated using (%s)',
                 'public_read_' || p_table, p_table, p_using);
end $$;

select public._public_read('categories', 'id, parent_id, name, name_ur, slug, kind, image_url, sort, is_active', 'is_active');
select public._public_read('brands', 'id, name, slug, sort', 'true');
select public._public_read('devices', 'id, brand_id, name, slug, model_numbers, release_year, is_active', 'is_active');
select public._public_read('products', 'id, name, name_ur, slug, category_id, brand_id, description, description_ur, warranty_days, is_online, is_active, created_at', 'is_active and is_online');
select public._public_read('product_variants', 'id, product_id, sku, barcode, grade, attributes, sale_price, warranty_days, is_active, is_serialized', 'is_active');
select public._public_read('product_images', 'id, product_id, url, alt, sort', 'true');
select public._public_read('part_compat', 'variant_id, device_id, confidence, note', 'true');
select public._public_read('bundles', 'id, name, slug, description, discount, is_active', 'is_active');
select public._public_read('bundle_items', 'bundle_id, variant_id, qty', 'true');
select public._public_read('search_synonyms', 'term, canonical', 'true');
select public._public_read('repair_price_list', 'id, device_id, issue, grade, labour, part_price, est_minutes, warranty_days, is_active', 'is_active');
select public._public_read('site_pages', 'id, slug, page_type, title_en, title_ur, seo_title, seo_description, status, published_at', 'status = ''published'' and deleted_at is null');
select public._public_read('page_sections', 'id, page_id, type, published, published_sort, published_visible, starts_at, ends_at',
  'deleted_at is null and published is not null and coalesce(published_visible, false) and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now())');
select public._public_read('content_blocks', 'key, en, ur', 'true');
select public._public_read('media_assets', 'id, type, source, url, external_id, poster, duration, width, height, focus_x, focus_y, captions, alt, product_tags, placements, sort', 'is_active');
select public._public_read('hero_settings', 'id, mode, media_id, settings', 'true');
select public._public_read('site_themes', 'key, name, tokens, is_dark, is_active, sort', 'true');
select public._public_read('theme_overrides', 'id, tokens, logo_url, favicon_url, fonts', 'true');
select public._public_read('faqs', 'id, page_slug, q_en, q_ur, a_en, a_ur, sort', 'visible');
select public._public_read('announcements', 'id, text_en, text_ur, link, starts_at, ends_at, sort', 'is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now())');
select public._public_read('offers', 'id, title_en, title_ur, subtitle, image_url, link, product_id, sort', 'is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now())');
select public._public_read('repair_stories', 'id, device_label, problem, replaced, grade, time_taken, quote, customer_name, before_url, after_url, video_url, pages, sort', 'visible');
select public._public_read('portfolio_items', 'id, kind, title, before_url, after_url, image_url, device_id, part_tag, repair_tag, link, sort', 'visible');
select public._public_read('reviews', 'id, source, rating, title, text, author_name, product_id, verified, featured, sort, owner_reply, owner_reply_at, created_at', 'status = ''published''');
select public._public_read('review_media', 'id, review_id, type, url, poster, sort', 'exists (select 1 from public.reviews r where r.id = review_id and r.status = ''published'')');
select public._public_read('google_reviews', 'google_review_id, author, author_photo, rating, text, time, reply', 'true');
select public._public_read('blog_categories', 'id, name, slug', 'true');
select public._public_read('blog_posts', 'id, slug, title_en, title_ur, excerpt, body_en, body_ur, cover_url, category_id, author_name, seo_title, seo_description, published_at', 'status = ''published''');
select public._public_read('social_posts', 'id, caption, hashtags, instagram_url, media, published_at', 'status = ''published''');
select public._public_read('social_post_products', 'post_id, product_id', 'true');
drop function public._public_read(text, text, text);

grant select on public.v_review_stats to anon, authenticated;

-- Public stock status without exposing quantities beyond "only N left".
create or replace view public.v_public_stock as
  select v.id as variant_id,
         case when coalesce(sum(sl.on_hand) filter (where l.is_sellable), 0) <= 0 then 'out'
              when coalesce(sum(sl.on_hand) filter (where l.is_sellable), 0) <= 3 then 'low'
              else 'in' end as status,
         least(coalesce(sum(sl.on_hand) filter (where l.is_sellable), 0), 3)::int as low_qty
  from public.product_variants v
  left join public.stock_levels sl on sl.variant_id = v.id
  left join public.locations l on l.id = sl.location_id
  where v.is_active group by v.id;
grant select on public.v_public_stock to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Customers: their own records (authenticated via phone OTP)
-- ---------------------------------------------------------------------------
create or replace function public.my_customer_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.customers where auth_user_id = auth.uid()
$$;

grant select on public.customers, public.customer_devices, public.addresses, public.orders, public.order_items,
                public.order_events, public.warranties, public.loyalty_ledger to authenticated;
grant insert, delete on public.customer_devices to authenticated;
grant insert, update, delete on public.addresses to authenticated;
create policy own_customer on public.customers for select to authenticated using (auth_user_id = auth.uid() or public.is_staff());
create policy own_devices on public.customer_devices for all to authenticated
  using (customer_id = public.my_customer_id()) with check (customer_id = public.my_customer_id());
create policy own_addresses on public.addresses for all to authenticated
  using (customer_id = public.my_customer_id()) with check (customer_id = public.my_customer_id());
create policy own_orders on public.orders for select to authenticated using (customer_id = public.my_customer_id() or public.is_staff());
create policy own_order_items on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and (o.customer_id = public.my_customer_id() or public.is_staff())));
create policy own_order_events on public.order_events for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and (o.customer_id = public.my_customer_id() or public.is_staff())));
create policy own_warranties on public.warranties for select to authenticated using (customer_id = public.my_customer_id() or public.is_staff());
create policy own_loyalty on public.loyalty_ledger for select to authenticated using (customer_id = public.my_customer_id() or public.is_staff());

-- ---------------------------------------------------------------------------
-- Staff (authenticated + permission). Read policies, plus write policies only
-- for non-ledger master data / content tables.
-- ---------------------------------------------------------------------------
create or replace function public._staff_policy(p_table text, p_read text, p_write text default null)
returns void language plpgsql as $$
begin
  -- Never widen a storefront table's column-limited grant (it would expose cost
  -- columns to every signed-in customer). Staff read those columns server-side.
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = p_table
                 and policyname = 'public_read_' || p_table) then
    execute format('grant select on public.%I to authenticated', p_table);
  end if;
  execute format('create policy %I on public.%I for select to authenticated using (public.has_permission(%L))',
                 'staff_read_' || p_table, p_table, p_read);
  if p_write is not null then
    execute format('grant insert, update, delete on public.%I to authenticated', p_table);
    execute format('create policy %I on public.%I for all to authenticated using (public.has_permission(%L)) with check (public.has_permission(%L))',
                   'staff_write_' || p_table, p_table, p_write, p_write);
  end if;
end $$;

-- master data (writable by permission)
select public._staff_policy('categories', 'inventory.view', 'inventory.edit');
select public._staff_policy('brands', 'inventory.view', 'inventory.edit');
select public._staff_policy('devices', 'inventory.view', 'inventory.edit');
select public._staff_policy('products', 'inventory.view', 'inventory.edit');
select public._staff_policy('product_images', 'inventory.view', 'inventory.edit');
select public._staff_policy('part_compat', 'inventory.view', 'inventory.edit');
select public._staff_policy('price_tiers', 'inventory.view', 'inventory.edit');
select public._staff_policy('variant_tier_prices', 'inventory.view', 'inventory.edit');
select public._staff_policy('bundles', 'inventory.view', 'inventory.edit');
select public._staff_policy('bundle_items', 'inventory.view', 'inventory.edit');
select public._staff_policy('search_synonyms', 'inventory.view', 'inventory.edit');
select public._staff_policy('stock_counts', 'inventory.view', 'inventory.adjust');
select public._staff_policy('stock_count_lines', 'inventory.view', 'inventory.adjust');
select public._staff_policy('suppliers', 'purchases.manage', 'purchases.manage');
select public._staff_policy('purchase_orders', 'purchases.manage', 'purchases.manage');
select public._staff_policy('po_lines', 'purchases.manage', 'purchases.manage');
select public._staff_policy('repair_price_list', 'repairs.view', 'repairs.pricelist');
select public._staff_policy('repair_checklists', 'repairs.view', 'repairs.manage');
select public._staff_policy('repair_photos', 'repairs.view', 'repairs.manage');
select public._staff_policy('buyback_requests', 'buyback.manage', 'buyback.manage');
select public._staff_policy('trade_accounts', 'trade.manage', 'trade.manage');
select public._staff_policy('discount_codes', 'promotions.manage', 'promotions.manage');
select public._staff_policy('referral_codes', 'promotions.manage', 'promotions.manage');
select public._staff_policy('settings', 'settings.manage', 'settings.manage');
-- content
select public._staff_policy('site_pages', 'content.edit', 'content.edit');
select public._staff_policy('page_sections', 'content.edit', 'content.edit');
select public._staff_policy('content_blocks', 'content.edit', 'content.edit');
select public._staff_policy('content_versions', 'content.edit');
select public._staff_policy('media_assets', 'media.upload', 'media.upload');
select public._staff_policy('hero_settings', 'content.edit', 'content.publish');
select public._staff_policy('faqs', 'content.edit', 'content.edit');
select public._staff_policy('announcements', 'content.edit', 'promotions.manage');
select public._staff_policy('offers', 'content.edit', 'promotions.manage');
select public._staff_policy('repair_stories', 'content.edit', 'content.edit');
select public._staff_policy('portfolio_items', 'content.edit', 'content.edit');
select public._staff_policy('site_themes', 'appearance.manage', 'appearance.manage');
select public._staff_policy('theme_overrides', 'appearance.manage', 'appearance.manage');
select public._staff_policy('blog_categories', 'content.edit', 'blog.publish');
select public._staff_policy('blog_posts', 'content.edit', 'content.edit');
select public._staff_policy('social_posts', 'social.post.create', 'social.post.create');
select public._staff_policy('social_post_products', 'social.post.create', 'social.post.create');
select public._staff_policy('reviews', 'reviews.moderate', 'reviews.moderate');
select public._staff_policy('review_media', 'reviews.moderate', 'reviews.moderate');
select public._staff_policy('google_reviews', 'reviews.moderate');
select public._staff_policy('review_requests', 'reviews.moderate');
select public._staff_policy('inquiries', 'inbox.manage', 'inbox.manage');
select public._staff_policy('email_threads', 'inbox.manage', 'inbox.manage');
select public._staff_policy('whatsapp_threads', 'inbox.manage', 'inbox.manage');
select public._staff_policy('whatsapp_messages', 'inbox.manage');
-- staff & access
select public._staff_policy('roles', 'staff.manage', 'staff.manage');
select public._staff_policy('permissions', 'staff.manage');
select public._staff_policy('role_permissions', 'staff.manage', 'staff.manage');
select public._staff_policy('employee_permissions', 'staff.manage', 'staff.manage');
select public._staff_policy('attendance', 'staff.manage');
select public._staff_policy('audit_log', 'audit.view');
-- read-only operational (writes via RPC only)
select public._staff_policy('product_variants', 'inventory.view');
select public._staff_policy('locations', 'inventory.view');
select public._staff_policy('stock_movements', 'inventory.view');
select public._staff_policy('stock_levels', 'inventory.view');
select public._staff_policy('stock_alerts', 'inventory.view');
select public._staff_policy('stock_adjustments', 'inventory.view');
select public._staff_policy('transfers', 'inventory.view');
select public._staff_policy('serial_units', 'inventory.view');
select public._staff_policy('grns', 'inventory.receive');
select public._staff_policy('grn_lines', 'inventory.receive');
select public._staff_policy('landed_cost_charges', 'inventory.receive');
select public._staff_policy('supplier_bills', 'purchases.manage');
select public._staff_policy('supplier_payments', 'purchases.pay');
select public._staff_policy('cash_drawers', 'pos.drawer');
select public._staff_policy('drawer_sessions', 'pos.drawer');
select public._staff_policy('sales', 'reports.sales.view');
select public._staff_policy('sale_items', 'reports.sales.view');
select public._staff_policy('payments', 'orders.view');
select public._staff_policy('payment_webhooks', 'reports.financial.view');
select public._staff_policy('sync_conflicts', 'pos.void');
select public._staff_policy('returns', 'pos.void');
select public._staff_policy('return_items', 'pos.void');
select public._staff_policy('discount_redemptions', 'promotions.manage');
select public._staff_policy('cod_confirmations', 'orders.view');
select public._staff_policy('shipments', 'orders.view');
select public._staff_policy('courier_remittances', 'accounts.bank_rec');
select public._staff_policy('courier_remittance_lines', 'accounts.bank_rec');
select public._staff_policy('repair_jobs', 'repairs.view');
select public._staff_policy('repair_status_history', 'repairs.view');
select public._staff_policy('repair_parts', 'repairs.view');
select public._staff_policy('expenses', 'accounts.expense');
select public._staff_policy('accounts', 'reports.financial.view');
select public._staff_policy('journal_entries', 'reports.financial.view');
select public._staff_policy('journal_lines', 'reports.financial.view');
select public._staff_policy('business_days', 'accounts.period.close');
select public._staff_policy('accounting_periods', 'accounts.period.close');
select public._staff_policy('fixed_assets', 'accounts.fixed_assets');
select public._staff_policy('depreciation_runs', 'accounts.fixed_assets');
select public._staff_policy('bank_statements', 'accounts.bank_rec', 'accounts.bank_rec');
select public._staff_policy('bank_statement_lines', 'accounts.bank_rec', 'accounts.bank_rec');
select public._staff_policy('bank_matches', 'accounts.bank_rec');
select public._staff_policy('financial_notes', 'reports.financial.view', 'accounts.period.close');
select public._staff_policy('ai_usage_log', 'settings.manage');
drop function public._staff_policy(text, text, text);

-- profiles: everyone reads their own; staff.manage reads all
grant select on public.profiles to authenticated;
create policy own_profile on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_permission('staff.manage'));
-- notifications: staff see broadcast + their own
grant select, update on public.notifications to authenticated;
create policy staff_notifications on public.notifications for select to authenticated
  using (public.is_staff() and (recipient is null or recipient = auth.uid()));
create policy staff_notifications_read on public.notifications for update to authenticated
  using (public.is_staff() and (recipient is null or recipient = auth.uid()));

-- ---------------------------------------------------------------------------
-- Function execution
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public;

do $$ declare f record;
begin
  -- every non-internal function is callable by signed-in users (each checks permissions itself)
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname not like '\_%' and p.prokind = 'f' loop
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;

-- the storefront's anonymous surface
grant execute on function public.business_date(timestamptz), public.normalize_phone(text),
  public.has_permission(text), public.is_staff(), public.my_customer_id(),
  public.verify_proof_code(text), public.resolve_device(text), public.search_products(text, uuid, int),
  public.repair_quote(uuid, text), public.track_repair(text), public.respond_repair_estimate(text, boolean),
  public.place_online_order(jsonb), public.submit_payment_proof(text, text, text, text, bigint),
  public.submit_review(jsonb), public.track_google_prompt_click(uuid)
to anon;

-- Online repair booking from the storefront (status 'booked', no money) is
-- allowed by create_repair_job itself.
grant execute on function public.create_repair_job(jsonb) to anon;
