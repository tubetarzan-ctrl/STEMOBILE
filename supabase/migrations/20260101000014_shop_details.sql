-- =============================================================================
-- 0014 Real shop details (address, phone, hours, services) for databases that
-- already hold the earlier placeholder values. Idempotent.
-- =============================================================================
insert into public.content_blocks (key, en) values
  ('business.address', 'Shop # 1F, Sarena Family Market and Mobile Mall, Roundabout, Sakhi Hassan, Sector 15-A-1, Buffer Zone, Karachi'),
  ('business.phone', '+923322142141'),
  ('business.whatsapp', '+923322142141'),
  ('business.email', ''),
  ('business.hours', 'Mon–Sat 1:00 PM – 12:00 AM · Sun closed'),
  ('business.map_url', 'https://www.google.com/maps/search/?api=1&query=Sarena+Family+Market+and+Mobile+Mall+Sakhi+Hassan+Buffer+Zone+Karachi')
on conflict (key) do update set en = excluded.en, updated_at = now();

update public.settings
   set value = value || jsonb_build_object(
     'address', 'Shop # 1F, Sarena Family Market and Mobile Mall, Roundabout, Sakhi Hassan, Sector 15-A-1, Buffer Zone, Karachi', 'phone', '+923322142141', 'whatsapp', '+923322142141', 'email', '',
     'hours', 'Mon–Sat 1:00 PM – 12:00 AM · Sun closed', 'map_url', 'https://www.google.com/maps/search/?api=1&query=Sarena+Family+Market+and+Mobile+Mall+Sakhi+Hassan+Buffer+Zone+Karachi')
 where key = 'business';

update public.faqs
   set a_en = 'Shop # 1F, Sarena Family Market and Mobile Mall, Roundabout, Sakhi Hassan, Sector 15-A-1, Buffer Zone, Karachi. Open Monday to Saturday, 1:00 PM to 12:00 AM; closed Sunday. Call or WhatsApp +92 332 2142141.',
       keywords = '{location,address,where,timing,hours,open,time}'
 where q_en = 'Where is the shop?';

insert into public.faqs (q_en, a_en, keywords, sort)
select 'What repairs do you do?',
       'iPhone and Android repairs, screen replacements, battery and charging-port fixes, and complex hardware troubleshooting such as Wi-Fi IC repairs. Use the Instant Repair Quote on the homepage to see the price before you visit.',
       '{repair,repairs,services,wifi,ic,hardware,screen,android,iphone}', 11
 where not exists (select 1 from public.faqs where q_en = 'What repairs do you do?');

update public.page_sections
   set draft = jsonb_set(draft, '{body_en}', to_jsonb('iPhone and Android repairs, screen replacements and complex hardware faults like Wi-Fi IC repair. Book a repair, shop parts, or just ask on WhatsApp — we reply fast.'::text)),
       published = jsonb_set(published, '{body_en}', to_jsonb('iPhone and Android repairs, screen replacements and complex hardware faults like Wi-Fi IC repair. Book a repair, shop parts, or just ask on WhatsApp — we reply fast.'::text))
 where type = 'final_cta' and published is not null;
