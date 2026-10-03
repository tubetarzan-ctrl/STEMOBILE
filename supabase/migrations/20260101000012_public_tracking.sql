-- =============================================================================
-- 0012 Public order tracking (order number + secret token) and the public
-- business profile mirror used by the storefront footer/contact blocks.
-- =============================================================================

create or replace function public.track_order(p_order_no text, p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'order_no', o.order_no, 'status', o.status, 'payment_method', o.payment_method, 'delivery_method', o.delivery_method,
    'subtotal', o.subtotal, 'discount', o.discount_total, 'delivery_fee', o.delivery_fee, 'total', o.total, 'paid', o.paid_amount,
    'expires_at', o.expires_at, 'created_at', o.created_at,
    'items', (select jsonb_agg(jsonb_build_object('name', p.name, 'grade', v.grade, 'qty', oi.qty, 'line_total', oi.line_total))
              from public.order_items oi join public.product_variants v on v.id = oi.variant_id
              join public.products p on p.id = v.product_id where oi.order_id = o.id),
    'events', (select jsonb_agg(jsonb_build_object('status', e.status, 'note', e.note, 'at', e.at) order by e.at)
               from public.order_events e where e.order_id = o.id),
    'shipment', (select jsonb_build_object('provider', s.provider, 'tracking_no', s.tracking_no, 'status', s.status)
                 from public.shipments s where s.order_id = o.id order by s.booked_at desc limit 1))
  from public.orders o
  where o.order_no = upper(trim(p_order_no)) and o.tracking_token = p_token
$$;
grant execute on function public.track_order(text, text) to anon, authenticated;

-- Public business profile (settings are staff-only).
insert into public.content_blocks (key, en) values
  ('business.name', 'StarTech Electronics'),
  ('business.tagline', 'Genuine parts. Honest repairs. Since 2003.'),
  ('business.address', 'Shop # 1F, Sarena Family Market and Mobile Mall, Roundabout, Sakhi Hassan, Sector 15-A-1, Buffer Zone, Karachi'),
  ('business.phone', '+923322142141'),
  ('business.whatsapp', '+923322142141'),
  ('business.email', ''),
  ('business.hours', 'Mon–Sat 1:00 PM – 12:00 AM · Sun closed'),
  ('business.years', '22'),
  ('business.map_url', 'https://www.google.com/maps/search/?api=1&query=Sarena+Family+Market+and+Mobile+Mall+Sakhi+Hassan+Buffer+Zone+Karachi')
on conflict (key) do nothing;

-- Policy pages, editable in the CMS (rich_text sections).
insert into public.site_pages (slug, page_type, title_en, status, is_system, published_at) values
  ('warranty-policy', 'policy', 'Warranty policy', 'published', true, now()),
  ('returns', 'policy', 'Returns & refunds', 'published', true, now()),
  ('delivery', 'policy', 'Delivery', 'published', true, now()),
  ('privacy', 'policy', 'Privacy policy', 'published', true, now()),
  ('terms', 'policy', 'Terms of service', 'published', true, now())
on conflict (slug) do nothing;

insert into public.page_sections (page_id, type, sort, draft, published, published_sort, published_visible)
select p.id, 'rich_text', 1, jsonb_build_object('title_en', p.title_en, 'body_en', b.body), jsonb_build_object('title_en', p.title_en, 'body_en', b.body), 1, true
from public.site_pages p join (values
  ('warranty-policy', E'Every part carries the warranty shown for its grade on your invoice: Original (New) up to 180 days, OEM 90 days, Premium 30 days, Standard 7 days. Repairs carry a workmanship warranty shown on your job card.\n\nWarranty covers manufacturing defects and fitting faults. It does not cover physical or liquid damage after fitting.\n\nClaim from your Warranty Wallet or bring the part to the shop — your phone number is your receipt.'),
  ('returns', E'Unused items in original packaging can be returned within 7 days for store credit or refund to the original payment method. Parts that have been fitted can be returned under warranty only.'),
  ('delivery', E'Karachi: same or next day by our rider. Rest of Pakistan: 2–3 working days by courier. Cash on delivery orders are confirmed on WhatsApp before dispatch.'),
  ('privacy', E'We collect your name, phone number and address to fulfil orders and repairs. Repair passcodes are encrypted and deleted when you collect your phone. We never sell your data.'),
  ('terms', E'Prices are in PKR and may change without notice. Orders are confirmed when payment is verified or COD is confirmed on WhatsApp.')
) as b(slug, body) on b.slug = p.slug
where not exists (select 1 from public.page_sections s where s.page_id = p.id);

-- Private storage buckets (payment proofs, repair check-in photos, CNIC images).
-- Served only via short-lived signed URLs; no public policies. Guarded so the
-- migration also applies where the storage schema doesn't exist (tests).
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public) values
      ('payment-proofs', 'payment-proofs', false),
      ('repair-photos', 'repair-photos', false),
      ('cnic', 'cnic', false)
    on conflict (id) do nothing;
  end if;
end $$;
