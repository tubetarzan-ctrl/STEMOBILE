-- =============================================================================
-- DEV SEED — realistic sample data for local development only.
-- Every stock/money change goes through the real RPCs, so the seed itself is an
-- end-to-end exercise of the ledger. Never run against production.
-- =============================================================================
select setseed(0.42);

-- --- Settings -------------------------------------------------------------------
insert into public.settings (key, value) values
  ('business', '{"name":"StarTech Electronics","tagline":"Genuine parts. Honest repairs. Since 2003.","address":"Shop # 1F, Sarena Family Market and Mobile Mall, Roundabout, Sakhi Hassan, Sector 15-A-1, Buffer Zone, Karachi","phone":"+923322142141","whatsapp":"+923322142141","email":"","hours":"Mon–Sat 1:00 PM – 12:00 AM · Sun closed","years":22,"map_url":"https://www.google.com/maps/search/?api=1&query=Sarena+Family+Market+and+Mobile+Mall+Sakhi+Hassan+Buffer+Zone+Karachi"}'),
  ('loyalty', '{"enabled":true,"points_per_100":1,"paisa_per_point":100}'),
  ('cod', '{"confirm_hours":4,"high_value_paisa":2500000,"advance_threshold":60}'),
  ('delivery', '{"default_fee":25000,"free_over":1500000}'),
  ('delivery_zones', '[{"city":"Karachi","fee":20000,"days":"Same / next day"},{"city":"Lahore","fee":35000,"days":"2–3 days"},{"city":"Islamabad","fee":35000,"days":"2–3 days"}]'),
  ('orders', '{"expiry_hours":24}'),
  ('closing', '{"time":"23:59","email_to":["owner@startech.pk"],"accountant":"accounts@startech.pk"}'),
  ('alerts', '{"cash_variance_paisa":100000,"discount_pct":15,"payment_proof_hours":2}');

insert into public.search_synonyms (term, canonical) values
  ('pannel','panel'),('panal','panel'),('lcd','screen'),('display','screen'),('panel','screen'),('screan','screen'),
  ('bettery','battery'),('betry','battery'),('battry','battery'),('cel','battery'),
  ('charjer','charger'),('chargr','charger'),('cover','case'),('pouch','case'),('glas','glass'),
  ('protector','glass'),('handsfree','earphones'),('hf','earphones'),('data','cable'),('wire','cable'),
  ('i phone','iphone'),('ifone','iphone'),('samsng','samsung'),('redme','redmi'),('port','charging');

insert into public.price_tiers (key, name, discount_pct) values
  ('retail','Retail',0),('trade','Trade',12),('trade_gold','Trade Gold',18);

-- --- Brands, devices ----------------------------------------------------------------
insert into public.brands (name, slug, sort) values
  ('Apple','apple',1),('Samsung','samsung',2),('Xiaomi','xiaomi',3),('Oppo','oppo',4),('Vivo','vivo',5),
  ('Infinix','infinix',6),('Tecno','tecno',7),('Realme','realme',8),('Google','google',9),('Generic','generic',99)
on conflict (name) do update set sort = excluded.sort;

insert into public.devices (brand_id, name, slug, model_numbers, release_year)
select b.id, d.name, d.slug, d.models, d.yr from (values
  ('Apple','iPhone 11','iphone-11','{A2221,A2111}'::text[],2019),
  ('Apple','iPhone 12','iphone-12','{A2403,A2172}',2020),
  ('Apple','iPhone 13','iphone-13','{A2633,A2482}',2021),
  ('Apple','iPhone 13 Pro','iphone-13-pro','{A2638,A2483}',2021),
  ('Apple','iPhone 14','iphone-14','{A2882,A2649}',2022),
  ('Apple','iPhone 14 Pro Max','iphone-14-pro-max','{A2894,A2651}',2022),
  ('Apple','iPhone 15','iphone-15','{A3090,A2846}',2023),
  ('Apple','iPhone 15 Pro Max','iphone-15-pro-max','{A3106,A2849}',2023),
  ('Samsung','Galaxy A14','galaxy-a14','{SM-A145F}',2023),
  ('Samsung','Galaxy A24','galaxy-a24','{SM-A245F}',2023),
  ('Samsung','Galaxy A34','galaxy-a34','{SM-A346E}',2023),
  ('Samsung','Galaxy A54','galaxy-a54','{SM-A546E,SM-A546B}',2023),
  ('Samsung','Galaxy A55','galaxy-a55','{SM-A556E}',2024),
  ('Samsung','Galaxy S21','galaxy-s21','{SM-G991B}',2021),
  ('Samsung','Galaxy S22 Ultra','galaxy-s22-ultra','{SM-S908E,SM-S908B}',2022),
  ('Samsung','Galaxy S23','galaxy-s23','{SM-S911B}',2023),
  ('Xiaomi','Redmi Note 12','redmi-note-12','{23021RAAEG}',2023),
  ('Xiaomi','Redmi Note 13','redmi-note-13','{23129RAA4G}',2024),
  ('Xiaomi','Redmi 13C','redmi-13c','{23100RN82L}',2023),
  ('Xiaomi','Poco X6 Pro','poco-x6-pro','{2311DRK48G}',2024),
  ('Oppo','A78','oppo-a78','{CPH2565}',2023),
  ('Oppo','Reno 10','oppo-reno-10','{CPH2531}',2023),
  ('Vivo','Y36','vivo-y36','{V2247}',2023),
  ('Vivo','V29','vivo-v29','{V2250}',2023),
  ('Infinix','Hot 40','infinix-hot-40','{X6836}',2023),
  ('Infinix','Note 30','infinix-note-30','{X6833B}',2023),
  ('Tecno','Spark 20','tecno-spark-20','{KJ5}',2023),
  ('Tecno','Camon 20','tecno-camon-20','{CK6n}',2023),
  ('Realme','C55','realme-c55','{RMX3710}',2023),
  ('Google','Pixel 7','pixel-7','{GVU6C,GQML3}',2022)
) as d(brand, name, slug, models, yr) join public.brands b on b.name = d.brand
on conflict (brand_id, name) do update set slug = excluded.slug, model_numbers = excluded.model_numbers, release_year = excluded.release_year;

-- --- Categories ---------------------------------------------------------------------
insert into public.categories (name, name_ur, slug, kind, revenue_account, sort) values
  ('Displays','ڈسپلے','displays','part',40200,1),
  ('Batteries','بیٹریاں','batteries','part',40200,2),
  ('Back Glass','بیک گلاس','back-glass','part',40200,3),
  ('Charging Ports','چارجنگ پورٹ','charging-ports','part',40200,4),
  ('Cameras','کیمرے','cameras','part',40200,5),
  ('Cases','کیسز','cases','accessory',40100,10),
  ('Screen Protectors','اسکرین پروٹیکٹر','screen-protectors','accessory',40100,11),
  ('Chargers','چارجرز','chargers','accessory',40100,12),
  ('Cables','کیبلز','cables','accessory',40100,13),
  ('Audio','آڈیو','audio','accessory',40100,14),
  ('Power Banks','پاور بینک','power-banks','accessory',40100,15),
  ('Tools','اوزار','tools','tool',40100,20);

-- --- Products & variants (8 per device = 240) ----------------------------------------
do $$
declare d record; v_tier numeric; v_prod uuid; g text; v_mult numeric; v_price bigint; n int := 0; v_var uuid;
begin
  for d in select dv.*, b.name as brand from public.devices dv join public.brands b on b.id = dv.brand_id order by b.sort, dv.name loop
    v_tier := case d.brand when 'Apple' then 3.0 when 'Samsung' then 2.0 when 'Google' then 2.2 else 1.0 end
              * (1 + (coalesce(d.release_year, 2022) - 2021) * 0.08);

    -- Display: graded variants
    insert into public.products (name, slug, category_id, brand_id, description, warranty_days)
    values (d.brand || ' ' || d.name || ' Display Assembly', d.slug || '-display',
            (select id from public.categories where slug = 'displays'), d.brand_id,
            'Complete display assembly (screen + digitizer) for ' || d.name || '. Pre-installed adhesive. Tested before dispatch.', 90)
    returning id into v_prod;
    foreach g in array (case when d.brand in ('Apple','Samsung','Google') then array['ORIG_NEW','OEM','PREMIUM','STANDARD']
                        else array['OEM','PREMIUM','STANDARD'] end) loop
      v_mult := case g when 'ORIG_NEW' then 1.7 when 'OEM' then 1.0 when 'PREMIUM' then 0.7 else 0.45 end;
      v_price := (round(900000 * v_tier * v_mult / 5000) * 5000)::bigint;
      insert into public.product_variants (product_id, sku, barcode, grade, sale_price, min_price, reorder_level, reorder_qty,
                                           is_serialized, is_critical, warranty_days)
      values (v_prod, upper(replace(d.slug, '-', '')) || '-DSP-' || g, '89' || lpad((1000000 + n)::text, 10, '0'),
              g::public.part_grade, v_price, round(v_price * 0.88), 2, 5, g in ('ORIG_NEW','OEM'), d.brand = 'Apple',
              case g when 'ORIG_NEW' then 180 when 'OEM' then 90 when 'PREMIUM' then 30 else 7 end)
      returning id into v_var;
      insert into public.part_compat values (v_var, d.id, 'exact', null);
      n := n + 1;
    end loop;

    -- Battery
    insert into public.products (name, slug, category_id, brand_id, description, warranty_days)
    values (d.brand || ' ' || d.name || ' Battery', d.slug || '-battery', (select id from public.categories where slug = 'batteries'),
            d.brand_id, 'Replacement battery for ' || d.name || ' with adhesive strips. Zero cycle count.', 90)
    returning id into v_prod;
    foreach g in array array['OEM','PREMIUM'] loop
      v_price := (round(250000 * v_tier * case g when 'OEM' then 1.0 else 0.7 end / 5000) * 5000)::bigint;
      insert into public.product_variants (product_id, sku, barcode, grade, sale_price, min_price, reorder_level, reorder_qty, warranty_days)
      values (v_prod, upper(replace(d.slug, '-', '')) || '-BAT-' || g, '89' || lpad((1000000 + n)::text, 10, '0'),
              g::public.part_grade, v_price, round(v_price * 0.88), 3, 6, case g when 'OEM' then 90 else 30 end)
      returning id into v_var;
      insert into public.part_compat values (v_var, d.id, 'exact', null);
      n := n + 1;
    end loop;

    -- Charging port flex
    insert into public.products (name, slug, category_id, brand_id, description, warranty_days)
    values (d.brand || ' ' || d.name || ' Charging Port Flex', d.slug || '-charging-port', (select id from public.categories where slug = 'charging-ports'),
            d.brand_id, 'Charging port flex with microphone for ' || d.name || '.', 30) returning id into v_prod;
    insert into public.product_variants (product_id, sku, barcode, grade, sale_price, min_price, reorder_level, warranty_days)
    values (v_prod, upper(replace(d.slug, '-', '')) || '-CHP-OEM', '89' || lpad((1000000 + n)::text, 10, '0'), 'OEM',
            (round(120000 * v_tier / 5000) * 5000)::bigint, (round(100000 * v_tier / 5000) * 5000)::bigint, 1, 30)
    returning id into v_var;
    insert into public.part_compat values (v_var, d.id, 'exact', null);
    n := n + 1;

    -- Case + tempered glass (accessories)
    insert into public.products (name, slug, category_id, brand_id, description, warranty_days)
    values (d.name || ' Shockproof Case', d.slug || '-case', (select id from public.categories where slug = 'cases'),
            (select id from public.brands where name = 'Generic'), 'Military-grade drop protection with raised camera lip.', 0)
    returning id into v_prod;
    insert into public.product_variants (product_id, sku, barcode, sale_price, min_price, reorder_level, attributes)
    values (v_prod, upper(replace(d.slug, '-', '')) || '-CASE-BLK', '89' || lpad((1000000 + n)::text, 10, '0'), 120000, 90000, 3,
            '{"colour":"Black"}') returning id into v_var;
    insert into public.part_compat values (v_var, d.id, 'exact', null);
    n := n + 1;

    insert into public.products (name, slug, category_id, brand_id, description, warranty_days)
    values (d.name || ' Tempered Glass 9H', d.slug || '-glass', (select id from public.categories where slug = 'screen-protectors'),
            (select id from public.brands where name = 'Generic'), 'Full-glue edge-to-edge 9H glass, oleophobic coating.', 0)
    returning id into v_prod;
    insert into public.product_variants (product_id, sku, barcode, sale_price, min_price, reorder_level)
    values (v_prod, upper(replace(d.slug, '-', '')) || '-GLS', '89' || lpad((1000000 + n)::text, 10, '0'), 50000, 35000, 5)
    returning id into v_var;
    insert into public.part_compat values (v_var, d.id, 'exact', null);
    n := n + 1;
  end loop;
end $$;

-- "Fits — check version" examples (siblings share some parts)
insert into public.part_compat (variant_id, device_id, confidence, note)
select v.id, d2.id, 'check_version', 'Fits ' || d2.name || ' units with the same model number range — confirm before ordering'
from public.product_variants v join public.products p on p.id = v.product_id
join public.devices d2 on (p.slug = 'galaxy-a34-glass' and d2.slug = 'galaxy-a54')
                       or (p.slug = 'iphone-14-glass' and d2.slug = 'iphone-13')
                       or (p.slug = 'redmi-note-12-battery' and d2.slug = 'redmi-note-13')
on conflict do nothing;

-- Generic accessories & tools (~60 variants)
do $$
declare r record; v_prod uuid; k int; n int := 5000;
begin
  for r in select * from (values
    ('20W USB-C Fast Charger','chargers','PD 3.0 fast charger. Charges an iPhone to 50% in 30 minutes.',250000,3,'{"White","Black"}'::text[]),
    ('25W Super Fast Charger','chargers','Samsung PPS compatible 25W charger.',280000,2,'{"White","Black"}'),
    ('33W Turbo Charger','chargers','33W charger for Xiaomi/Poco turbo charging.',300000,2,'{"White"}'),
    ('65W GaN Dual Charger','chargers','Compact GaN, charges phone + laptop together.',650000,2,'{"Grey"}'),
    ('USB-C to USB-C Braided Cable 1m','cables','60W braided cable, 10,000+ bend tested.',90000,6,'{"1m","2m"}'),
    ('USB-C to Lightning Cable 1m','cables','MFi-grade chip, supports fast charging.',120000,6,'{"1m","2m"}'),
    ('Micro USB Cable 1m','cables','2.4A charging for older phones.',40000,6,'{"1m"}'),
    ('True Wireless Earbuds Pro','audio','ENC calls, 30h total battery.',450000,2,'{"White","Black"}'),
    ('Wired Earphones 3.5mm','audio','In-line mic, deep bass.',60000,4,'{"Black"}'),
    ('USB-C Wired Earphones','audio','DAC built-in, works with all USB-C phones.',90000,4,'{"White"}'),
    ('10,000mAh Power Bank 22.5W','power-banks','Slim, fast-charge both ways.',550000,2,'{"Black","Blue"}'),
    ('20,000mAh Power Bank PD','power-banks','PD 20W + QC 3.0, LED display.',850000,2,'{"Black"}'),
    ('Magnetic Car Holder','power-banks','Dashboard magnetic mount.',150000,2,'{"Black"}'),
    ('Precision Screwdriver Kit 24-in-1','tools','Pentalobe, Tri-wing, Phillips, Torx bits.',350000,1,'{"Standard"}'),
    ('Heat Gun 858D Station','tools','Hot air rework station for screen separation.',1200000,1,'{"220V"}'),
    ('B-7000 Adhesive 50ml','tools','Industrial adhesive for frames and glass.',35000,10,'{"50ml"}'),
    ('Opening Picks & Spudger Set','tools','Anti-static spudgers + 6 picks.',25000,6,'{"Set"}'),
    ('LCD Separator Machine','tools','7-inch rotary separator with vacuum.',2800000,1,'{"7in"}'),
    ('UV Glue + Lamp Kit','tools','LOCA UV glue with curing lamp.',180000,3,'{"Kit"}'),
    ('Battery Health Tester','tools','Reads cycle count and health on iPhone batteries.',950000,1,'{"Standard"}')
  ) as t(name, cat, descr, price, reorder, opts) loop
    insert into public.products (name, slug, category_id, brand_id, description, warranty_days)
    values (r.name, lower(regexp_replace(r.name, '[^A-Za-z0-9]+', '-', 'g')), (select id from public.categories where slug = r.cat),
            (select id from public.brands where name = 'Generic'), r.descr, case when r.cat in ('chargers','power-banks','audio') then 180 else 0 end)
    returning id into v_prod;
    for k in 1..array_length(r.opts, 1) loop
      insert into public.product_variants (product_id, sku, barcode, sale_price, min_price, reorder_level, attributes)
      values (v_prod, 'ACC-' || n || '-' || upper(regexp_replace(r.opts[k], '[^A-Za-z0-9]', '', 'g')), '89' || lpad(n::text, 10, '0'),
              r.price + (k - 1) * 10000, round((r.price + (k - 1) * 10000) * 0.85), r.reorder,
              jsonb_build_object('option', r.opts[k]));
      n := n + 1;
    end loop;
  end loop;
end $$;

-- Pad accessory colours so the catalogue reaches ~300 variants.
insert into public.product_variants (product_id, sku, barcode, sale_price, min_price, reorder_level, attributes)
select v.product_id, replace(v.sku, '-BLK', '-' || c.code), null, v.sale_price, v.min_price, 1, jsonb_build_object('colour', c.name)
from public.product_variants v cross join (values ('CLR','Clear'),('BLU','Navy Blue')) c(code, name)
where v.sku like '%-CASE-BLK';

-- --- Owner capital, fixed assets, suppliers -----------------------------------------------
select public.post_manual_journal(public.business_date() - 10, 'Owner capital introduced at go-live',
  '[{"account":10200,"debit":250000000},{"account":30100,"credit":250000000}]');
select public.post_manual_journal(public.business_date() - 10, 'Opening drawer float',
  '[{"account":10100,"debit":2000000},{"account":10200,"credit":2000000}]');
select public.add_fixed_asset('Shop counters & glass display', 'Fit-out', public.business_date() - 10, 45000000, 0, 60, 10200);
select public.add_fixed_asset('Repair bench + microscope', 'Equipment', public.business_date() - 10, 18000000, 1000000, 36, 10200);
select public.add_fixed_asset('POS laptop + thermal printer', 'IT', public.business_date() - 10, 15000000, 0, 36, 10200);

insert into public.suppliers (name, phone, city, country, currency, lead_time_days) values
  ('Shenzhen Huaqiang Parts Co.', '+8613800000000', 'Shenzhen', 'China', 'USD', 14),
  ('Hall Road Wholesale (Lahore)', '+923001111111', 'Lahore', 'Pakistan', 'PKR', 3),
  ('Saddar Accessories Traders', '+923002222222', 'Karachi', 'Pakistan', 'PKR', 1);

-- --- Opening stock (non-serialized) at cost ≈ 58–68% of price ------------------------------
do $$
declare v_lines jsonb;
begin
  select jsonb_agg(jsonb_build_object('variant_id', v.id, 'qty', 2 + floor(random() * 10)::int,
                                      'unit_cost', round(v.sale_price * (0.58 + random() * 0.10))))
    into v_lines
  from public.product_variants v where not v.is_serialized;
  perform public.post_opening_stock(v_lines, public.location_id('COUNTER'));
end $$;

-- --- Import GRN in USD with freight + customs (landed cost), creates Genuine Proof codes --
do $$
declare v_lines jsonb;
begin
  select jsonb_agg(jsonb_build_object('variant_id', v.id, 'qty', 3,
                                      'unit_cost_fc', round(v.sale_price * 0.55 / 280)))  -- USD cents at Rs 280
    into v_lines
  from public.product_variants v where v.is_serialized;
  perform public.receive_grn(jsonb_build_object(
    'supplier_id', (select id from public.suppliers where currency = 'USD'),
    'location_id', public.location_id('COUNTER'), 'currency', 'USD', 'fx_rate', 280, 'bill_no', 'HQ-2026-0912',
    'idempotency_key', 'seed-grn-1', 'lines', v_lines,
    'charges', jsonb_build_array(
      jsonb_build_object('kind', 'freight', 'amount', 4500000, 'allocate_by', 'value', 'vendor', 'TCS Cargo'),
      jsonb_build_object('kind', 'customs', 'amount', 9800000, 'allocate_by', 'value'),
      jsonb_build_object('kind', 'clearing', 'amount', 1200000, 'allocate_by', 'qty'))));
end $$;

-- --- Trade accounts ------------------------------------------------------------------------------
do $$
declare c uuid; r record;
begin
  for r in select * from (values
    ('+923331234567','Bilal Mobile Clinic','Saddar','trade_gold', 50000000),
    ('+923451112233','Fix It Point','Gulshan','trade', 20000000),
    ('+923219876543','Aamir Repair Lab','Korangi','trade', 15000000)) t(phone, shop, area, tier, lim) loop
    c := public._upsert_customer(r.phone, r.shop);
    insert into public.trade_accounts (customer_id, shop_name, city, location, tier_id, credit_limit, terms_days, status, approved_at)
    values (c, r.shop, 'Karachi', r.area, (select id from public.price_tiers where key = r.tier), r.lim, 15, 'approved', now());
  end loop;
end $$;

-- --- A week of counter + trade sales with daily closing ----------------------------------------
do $$
declare
  d int; v_date date; v_sess uuid; i int; n int; it jsonb; v_items jsonb; v_total bigint; v_method text;
  v_drawer uuid := (select id from public.cash_drawers limit 1); r record; v_disc bigint; v_phone text;
  v_trade uuid; v_counter int := public.location_id('COUNTER');
begin
  for d in reverse 7..1 loop
    v_date := public.business_date() - d;
    insert into public.drawer_sessions (drawer_id, business_date, opened_at, opening_float)
    values (v_drawer, v_date, (v_date + time '11:00') at time zone 'Asia/Karachi', 2000000) returning id into v_sess;
    n := 8 + floor(random() * 8)::int;
    for i in 1..n loop
      v_items := '[]'; v_total := 0;
      for r in select sl.variant_id, v.sale_price, v.min_price, v.is_serialized
                 from public.stock_levels sl join public.product_variants v on v.id = sl.variant_id
                where sl.location_id = v_counter and sl.on_hand >= 2 and not v.is_serialized
                order by random() limit 1 + floor(random() * 3)::int loop
        v_disc := case when random() < 0.25 then least(round(r.sale_price * 0.05 / 1000) * 1000, r.sale_price - r.min_price) else 0 end;
        v_items := v_items || jsonb_build_object('variant_id', r.variant_id, 'qty', 1, 'unit_price', r.sale_price, 'discount', v_disc);
        v_total := v_total + r.sale_price - v_disc;
      end loop;
      continue when v_total = 0;
      v_method := (array['cash','cash','cash','raast','card','jazzcash'])[1 + floor(random() * 6)::int];
      v_phone := case when random() < 0.6 then '+92300' || lpad(floor(random() * 9999999)::text, 7, '0') end;
      perform public.post_pos_sale(jsonb_build_object(
        'idempotency_key', 'seed-' || d || '-' || i, 'drawer_session_id', v_sess, 'customer_phone', v_phone,
        'sold_at', ((v_date + time '12:00') + (i * interval '35 minutes')) at time zone 'Asia/Karachi',
        'items', v_items, 'payments', jsonb_build_array(jsonb_build_object('method', v_method, 'amount', v_total))));
    end loop;

    -- one trade (khata) order every other day
    if d % 2 = 1 then
      v_trade := (select customer_id from public.trade_accounts order by random() limit 1);
      v_items := '[]'; v_total := 0;
      for r in select sl.variant_id, public.price_for(sl.variant_id, v_trade) as price
                 from public.stock_levels sl join public.product_variants v on v.id = sl.variant_id
                 join public.products p on p.id = v.product_id join public.categories c on c.id = p.category_id
                where sl.location_id = v_counter and sl.on_hand >= 3 and c.kind = 'part' and not v.is_serialized
                order by random() limit 3 loop
        v_items := v_items || jsonb_build_object('variant_id', r.variant_id, 'qty', 2, 'unit_price', r.price);
        v_total := v_total + 2 * r.price;
      end loop;
      perform public.post_pos_sale(jsonb_build_object('idempotency_key', 'seed-trade-' || d, 'drawer_session_id', v_sess,
        'customer_id', v_trade, 'sold_at', ((v_date + time '16:00') at time zone 'Asia/Karachi'),
        'items', v_items, 'payments', jsonb_build_array(jsonb_build_object('method', 'khata', 'amount', v_total))));
    end if;

    -- a cash expense from the drawer
    if d % 3 = 0 then
      perform public.post_expense(60400, 350000, 10100, 'Generator fuel (load-shedding)', v_sess, v_date);
    end if;

    -- close drawer with a small realistic variance, then close the day
    perform public.close_drawer(v_sess, public.drawer_expected(v_sess) + (array[0, 0, -5000, 10000, -20000])[1 + floor(random() * 5)::int]);
    perform public.run_daily_closing(v_date);
  end loop;
end $$;

-- Trade payment received + supplier payment + rent
select public.post_trade_payment((select customer_id from public.trade_accounts where shop_name = 'Bilal Mobile Clinic'), 1500000, 'raast', 'RAAST-88231');
select public.record_supplier_payment((select id from public.suppliers where currency = 'USD'),
  (select id from public.supplier_bills limit 1), (select amount_pkr / 2 from public.supplier_bills limit 1),
  (select amount_pkr / 2 + 85000 from public.supplier_bills limit 1), 10200, 'TT-Meezan-0091');
select public.post_expense(60100, 18000000, 10200, 'Shop rent – Sarena Mobile Mall');
select public.post_expense(60200, 24000000, 10200, 'Staff salaries');

-- --- Repairs -------------------------------------------------------------------------------------
do $$
declare j jsonb; v_dev uuid; v_part uuid; k int; r record; v_sess uuid;
begin
  insert into public.drawer_sessions (drawer_id, opening_float) values ((select id from public.cash_drawers limit 1), 2000000)
  returning id into v_sess;
  for r in select * from (values
    ('+923001234001','Sana Khan','iphone-13','screen','OEM',300000,'delivered'),
    ('+923001234002','Hamza Ali','galaxy-a54','battery','OEM',150000,'delivered'),
    ('+923001234003','Ayesha Siddiqui','iphone-12','screen','PREMIUM',300000,'ready'),
    ('+923001234004','Usman Tariq','redmi-note-12','charging_port','OEM',100000,'in_repair'),
    ('+923001234005','Fatima Noor','galaxy-s22-ultra','screen','ORIG_NEW',500000,'awaiting_approval'),
    ('+923001234006','Ali Raza','iphone-11','battery','PREMIUM',150000,'diagnosing'),
    ('+923001234007','Zainab Hussain','oppo-a78','screen','PREMIUM',200000,'received'),
    ('+923001234008','Kashif Mehmood','infinix-hot-40','screen','STANDARD',150000,'booked')
  ) t(phone, name, dev, issue, grade, labour, final) loop
    select id into v_dev from public.devices where slug = r.dev;
    j := public.create_repair_job(jsonb_build_object('phone', r.phone, 'name', r.name, 'device_id', v_dev,
      'issues', jsonb_build_array(r.issue), 'estimate', r.labour * 4, 'labour', r.labour,
      'advance', case when r.final = 'booked' then 0 else 200000 end, 'advance_method', 'cash', 'drawer_session_id', v_sess,
      'status', case when r.final = 'booked' then 'booked' else 'received' end,
      'promised_at', now() + interval '1 day',
      'condition', '{"screen":"cracked","body":"minor scratches","buttons":"ok","cameras":"ok","face_id":"ok","charging":"ok","water_damage":"no"}'));
    if r.final in ('delivered','ready','in_repair','awaiting_approval') then
      select v.id into v_part from public.product_variants v join public.part_compat pc on pc.variant_id = v.id
       join public.products p on p.id = v.product_id
       where pc.device_id = v_dev and pc.confidence = 'exact' and v.grade::text = r.grade
         and p.slug like '%' || case r.issue when 'screen' then 'display' when 'battery' then 'battery' else 'charging-port' end
         and public.on_hand(v.id, 1) > 0 and not v.is_serialized
       limit 1;
      if v_part is not null and r.final <> 'awaiting_approval' then
        perform public.consume_repair_part((j->>'job_id')::uuid, v_part, 1);
      end if;
      if r.final = 'awaiting_approval' then
        perform public.update_repair_status((j->>'job_id')::uuid, 'awaiting_approval', 'Frame bent — needs mid-frame too', 1350000);
      else
        perform public.update_repair_status((j->>'job_id')::uuid, 'in_repair', null);
      end if;
    end if;
    if r.final in ('delivered','ready') then
      insert into public.repair_checklists (job_id, kind, items)
      values ((j->>'job_id')::uuid, 'qc', '{"touch":"ok","true_tone":"ok","face_id":"ok","cameras":"ok","speaker":"ok","charging":"ok"}');
      perform public.update_repair_status((j->>'job_id')::uuid, 'ready', null);
    end if;
    if r.final = 'delivered' then
      perform public.deliver_repair_job((j->>'job_id')::uuid, jsonb_build_array(jsonb_build_object('method', 'cash',
        'amount', (select labour + coalesce((select sum(qty * unit_price) from public.repair_parts where job_id = (j->>'job_id')::uuid), 0) - advance
                   from public.repair_jobs where id = (j->>'job_id')::uuid))), v_sess);
    end if;
  end loop;
end $$;

-- Repair price list (powers Instant Quote): screen per grade, battery, charging port.
insert into public.repair_price_list (device_id, issue, grade, labour, part_variant_id, est_minutes, warranty_days)
select pc.device_id,
       case when p.slug like '%-display' then 'screen' when p.slug like '%-battery' then 'battery' else 'charging_port' end,
       v.grade,
       case when p.slug like '%-display' then 300000 when p.slug like '%-battery' then 150000 else 100000 end,
       v.id,
       case when p.slug like '%-display' then 60 when p.slug like '%-battery' then 30 else 45 end,
       coalesce(v.warranty_days, 30)
from public.product_variants v join public.products p on p.id = v.product_id
join public.part_compat pc on pc.variant_id = v.id and pc.confidence = 'exact'
where p.slug ~ '-(display|battery|charging-port)$';

-- --- Online orders ------------------------------------------------------------------------------
do $$
declare o jsonb; v_var uuid; v_var2 uuid;
begin
  select v.id into v_var from public.product_variants v join public.products p on p.id = v.product_id
   where p.slug = 'iphone-13-glass';
  select v.id into v_var2 from public.product_variants v join public.products p on p.id = v.product_id
   where p.slug like '20w-usb-c%' limit 1;

  -- guarantee stock for the demo orders (the random counter sales above may have sold these out)
  perform public.receive_grn(jsonb_build_object(
    'supplier_id', (select id from public.suppliers where currency = 'PKR' order by name limit 1),
    'location_id', public.location_id('COUNTER'), 'currency', 'PKR', 'fx_rate', 1, 'bill_no', 'SEED-TOPUP',
    'idempotency_key', 'seed-topup-orders',
    'lines', jsonb_build_array(
      jsonb_build_object('variant_id', v_var, 'qty', 10, 'unit_cost_fc', 30000),
      jsonb_build_object('variant_id', v_var2, 'qty', 10, 'unit_cost_fc', 150000))));

  -- COD via courier -> confirmed -> dispatched -> delivered -> remitted
  o := public.place_online_order(jsonb_build_object('idempotency_key', 'seed-ord-1', 'phone', '03011112222', 'name', 'Rizwan Ahmed',
        'city', 'Lahore', 'address', '{"line1":"House 12, Street 4, DHA Phase 5"}', 'payment_method', 'cod', 'delivery_method', 'courier',
        'items', jsonb_build_array(jsonb_build_object('variant_id', v_var, 'qty', 2), jsonb_build_object('variant_id', v_var2, 'qty', 1))));
  perform public.confirm_cod((o->>'order_id')::uuid, true, 'whatsapp');
  perform public.update_order_status((o->>'order_id')::uuid, 'packed');
  insert into public.shipments (order_id, provider, tracking_no, cod_amount, charges)
  values ((o->>'order_id')::uuid, 'mock', 'MOCK-100001', (o->>'total')::bigint, 25000);
  perform public.update_order_status((o->>'order_id')::uuid, 'dispatched');
  perform public.mark_order_delivered((o->>'order_id')::uuid);
  perform public.import_courier_remittance(jsonb_build_object('provider', 'mock', 'reference', 'REM-0001',
    'lines', jsonb_build_array(jsonb_build_object('tracking_no', 'MOCK-100001', 'cod_amount', (o->>'total')::bigint, 'charge', 25000),
                               jsonb_build_object('tracking_no', 'MOCK-UNKNOWN', 'cod_amount', 150000, 'charge', 0))));

  -- Gateway (Raast) paid, Karachi rider
  o := public.place_online_order(jsonb_build_object('idempotency_key', 'seed-ord-2', 'phone', '03213334444', 'name', 'Mehwish Iqbal',
        'city', 'Karachi', 'address', '{"line1":"Flat 7, Block 13-D, Gulshan-e-Iqbal"}', 'payment_method', 'gateway', 'delivery_method', 'rider',
        'items', jsonb_build_array(jsonb_build_object('variant_id', v_var2, 'qty', 1))));
  perform public.handle_gateway_webhook('mock', 'evt_seed_2', jsonb_build_object('status', 'paid', 'order_no', o->>'order_no',
        'amount', (o->>'total')::bigint, 'method', 'raast', 'transaction_id', 'RAAST-TXN-1'), true);
  perform public.handle_gateway_webhook('mock', 'evt_seed_2', '{}'::jsonb, true);  -- duplicate: ignored

  -- Bank transfer with proof awaiting verification
  o := public.place_online_order(jsonb_build_object('idempotency_key', 'seed-ord-3', 'phone', '03455556666', 'name', 'Imran Shah',
        'city', 'Karachi', 'payment_method', 'bank_transfer', 'delivery_method', 'pickup',
        'items', jsonb_build_array(jsonb_build_object('variant_id', v_var, 'qty', 1))));
  perform public.submit_payment_proof(o->>'order_no', (select tracking_token from public.orders where id = (o->>'order_id')::uuid),
        'payment-proofs/seed.jpg', 'IBFT-77812', (o->>'total')::bigint);

  -- Fresh COD awaiting WhatsApp confirmation
  perform public.place_online_order(jsonb_build_object('idempotency_key', 'seed-ord-4', 'phone', '03117778888', 'name', 'Nadia Perveen',
        'city', 'Karachi', 'address', '{"line1":"House 3, Nazimabad No. 2"}', 'payment_method', 'cod', 'delivery_method', 'rider',
        'items', jsonb_build_array(jsonb_build_object('variant_id', v_var, 'qty', 1))));
end $$;

-- A sales return to wallet, a stock adjustment, and depreciation for last month
do $$
declare s public.sales; si public.sale_items; a uuid;
begin
  select * into s from public.sales where channel = 'pos' and customer_id is not null order by sale_no desc limit 1;
  select * into si from public.sale_items where sale_id = s.id limit 1;
  perform public.post_sales_return(jsonb_build_object('sale_id', s.id, 'reason', 'Wrong model', 'refund_method', 'wallet',
     'items', jsonb_build_array(jsonb_build_object('sale_item_id', si.id, 'qty', 1, 'restock', true))));
  a := public.request_adjustment((select variant_id from public.stock_levels where on_hand > 3 limit 1), 1, -1, 'Damaged in display');
  perform public.approve_adjustment(a, true);
  perform public.run_depreciation(public.business_date());
end $$;

-- =============================================================================
-- Website content
-- =============================================================================
insert into public.site_themes (key, name, is_dark, is_active, sort, tokens) values
  ('midnight-lab','Midnight Lab',true,true,1,'{"bg":"#07080B","surface-1":"#0E1015","surface-2":"#151821","line":"#232733","ink":"#EEF0F3","ink-2":"#B7BDC7","ink-3":"#8A919C","accent":"#22D3EE","accent-ink":"#04181C","trust":"#34D399","warn":"#FBBF24","danger":"#F87171"}'),
  ('midnight-gold','Midnight Gold',true,false,2,'{"bg":"#09080A","surface-1":"#121014","surface-2":"#1A171C","line":"#2A262D","ink":"#F2EFEA","ink-2":"#C4BDB2","ink-3":"#948C80","accent":"#F5C04E","accent-ink":"#1E1606","trust":"#34D399","warn":"#FB923C","danger":"#F87171"}'),
  ('graphite-green','Graphite Green',true,false,3,'{"bg":"#0A0C0B","surface-1":"#111513","surface-2":"#181D1A","line":"#26302B","ink":"#ECF1EE","ink-2":"#B5C2BB","ink-3":"#86948C","accent":"#4ADE80","accent-ink":"#05170C","trust":"#22D3EE","warn":"#FBBF24","danger":"#F87171"}'),
  ('deep-navy','Deep Navy',true,false,4,'{"bg":"#060A14","surface-1":"#0C1220","surface-2":"#121A2C","line":"#1F2A40","ink":"#EAF0FA","ink-2":"#B0BCD2","ink-3":"#8290A8","accent":"#60A5FA","accent-ink":"#06142A","trust":"#34D399","warn":"#FBBF24","danger":"#F87171"}'),
  ('carbon-red','Carbon Red',true,false,5,'{"bg":"#0B0909","surface-1":"#141010","surface-2":"#1C1616","line":"#2E2424","ink":"#F3EDED","ink-2":"#C9B9B9","ink-3":"#9A8A8A","accent":"#F43F5E","accent-ink":"#FFFFFF","trust":"#34D399","warn":"#FBBF24","danger":"#FB7185"}'),
  ('daylight','Daylight',false,false,6,'{"bg":"#F7F8FA","surface-1":"#FFFFFF","surface-2":"#EEF1F5","line":"#DDE2EA","ink":"#0C1118","ink-2":"#3C4655","ink-3":"#5F6B7B","accent":"#0E7490","accent-ink":"#FFFFFF","trust":"#047857","warn":"#B45309","danger":"#B91C1C"}'),
  ('eid-emerald','Eid Emerald',true,false,7,'{"bg":"#04100C","surface-1":"#0A1A14","surface-2":"#10241C","line":"#1C3a2E","ink":"#EEF7F2","ink-2":"#B6CFC2","ink-3":"#87A496","accent":"#E8C766","accent-ink":"#1A1404","trust":"#34D399","warn":"#FBBF24","danger":"#F87171"}');

insert into public.site_pages (slug, page_type, title_en, title_ur, seo_title, seo_description, is_system) values
  ('', 'home', 'Home', 'ہوم', 'StarTech Electronics — Genuine phone parts & repairs in Karachi',
   'Genuine and graded phone parts that fit your exact model, instant repair quotes, live repair tracking and digital warranty. 22 years at Sarena Mobile Mall, Karachi.', true);

insert into public.page_sections (page_id, type, sort, draft)
select (select id from public.site_pages where slug = ''), t.type, t.sort, t.draft::jsonb from (values
 ('hero', 1, '{"eyebrow":"Sarena Mobile Mall · Since 2003","headline_en":"The inside of your phone, done right.","headline_ur":"آپ کے فون کا اندرونی حصہ، درست طریقے سے۔","sub_en":"Genuine and graded parts that fit your exact model, repairs you can track live, and a warranty that lives on your phone number.","sub_ur":"آپ کے ماڈل کے مطابق اصلی اور گریڈ شدہ پارٹس، لائیو ٹریک ہونے والی مرمت، اور آپ کے نمبر پر ڈیجیٹل وارنٹی۔","primary_cta":{"label_en":"Shop parts that fit","href":"/shop"},"secondary_cta":{"label_en":"See our repairs","href":"#portfolio"},"trust":[{"value":"22 yrs","label_en":"at Sarena Mobile Mall"},{"value":"Genuine Proof","label_en":"on every graded part"},{"value":"Live","label_en":"repair tracking"}]}'),
 ('problem_solution', 2, '{"title_en":"The mobile market has four problems. We fixed each one.","items":[{"problem_en":"\"Original\" parts that aren''t","solution_en":"Genuine Proof™ — every part graded, high-value parts carry a scannable authenticity code.","icon":"shield-check"},{"problem_en":"Parts that don''t fit your model","solution_en":"Fit Finder — set your phone once and the whole store shows only what fits.","icon":"smartphone"},{"problem_en":"Warranty on a paper slip you''ll lose","solution_en":"Warranty Wallet — every warranty lives under your phone number. Claim in two taps.","icon":"wallet"},{"problem_en":"No price until you visit","solution_en":"Instant Repair Quote — model + problem = price per grade, time and warranty.","icon":"zap"}]}'),
 ('category_grid', 3, '{"title_en":"Shop by part","subtitle_en":"Every part graded. Every grade explained."}'),
 ('product_row', 4, '{"title_en":"Picked for your phone","subtitle_en":"Set your device above and this row reshapes around it.","pinned":[]}'),
 ('repair_quote', 5, '{"title_en":"Instant repair quote","subtitle_en":"Tap where it hurts. Prices per grade, no shop visit needed."}'),
 ('case_studies', 6, '{"title_en":"Repair stories","subtitle_en":"Real devices from our bench, with the customer''s permission."}'),
 ('testimonials', 7, '{"title_en":"What Karachi says","show_google":true,"google_sort":"newest"}'),
 ('portfolio', 8, '{"title_en":"From the bench","subtitle_en":"Before and after, unfiltered.","show_reels":true}'),
 ('genuine_proof', 9, '{"title_en":"Genuine Proof™","subtitle_en":"Five grades. Fixed meanings. Scan any serialized part to verify it."}'),
 ('why_us', 10, '{"title_en":"Why StarTech","points":[{"title_en":"22 years, same mall","body_en":"We''ve been at Sarena Mobile Mall since 2003. We''ll be here when you need the warranty."},{"title_en":"We show the grade","body_en":"Original, pulled, OEM, premium or standard — written on the invoice and the QR code."},{"title_en":"Technicians buy from us","body_en":"Over a hundred Karachi repair shops stock their benches with our parts."}],"comparison":{"columns":["StarTech","Typical mall stall","Online marketplace"],"rows":[["Part grade disclosed","Yes, on invoice + QR","Rarely","Unclear"],["Fits-your-model check","Fit Finder","Ask the seller","No"],["Digital warranty","Yes, on your number","Paper slip","Varies"],["Repair tracking","Live, with photos","Call and ask","—"],["Price before visiting","Instant quote","No","Parts only"]]}}'),
 ('technician_pro', 11, '{"title_en":"Technician Pro","body_en":"Run a repair shop? Get trade pricing, a credit line with a digital khata, WhatsApp statements and quick reorder.","cta":{"label_en":"Apply for a trade account","href":"/trade/apply"}}'),
 ('faq', 12, '{"title_en":"Questions, answered"}'),
 ('final_cta', 13, '{"title_en":"Bring it in, or let us come to you.","body_en":"iPhone and Android repairs, screen replacements and complex hardware faults like Wi-Fi IC repair. Book a repair, shop parts, or just ask on WhatsApp — we reply fast.","actions":[{"label_en":"Book a repair","href":"/repair"},{"label_en":"Shop now","href":"/shop"},{"label_en":"WhatsApp us","href":"whatsapp"}]}')
) as t(type, sort, draft);

select public.publish_page((select id from public.site_pages where slug = ''), 'Initial homepage');

insert into public.faqs (q_en, a_en, keywords, sort) values
  ('What do the part grades mean?', 'Original (New) is a new manufacturer part. Original (Pulled) is a manufacturer part removed from another device and tested. OEM is made to manufacturer spec by a third party. Premium Copy is high-quality aftermarket; Standard Copy is budget aftermarket. The grade is printed on your invoice and, for serialized parts, on a scannable Genuine Proof code.', '{grade,original,copy,oem}', 1),
  ('How long is the warranty?', 'It depends on the grade: up to 180 days for Original (New) displays, 90 days for OEM, 30 days for Premium and 7 days for Standard. Repairs carry a separate workmanship warranty. Every warranty is saved under your phone number — no paper slip needed.', '{warranty,guarantee}', 2),
  ('How long does a screen replacement take?', 'Most screen and battery replacements are done in 30–60 minutes while you wait. Parts we need to order usually arrive in 1–3 days. You can track your repair live with the link we send on WhatsApp.', '{time,how long,screen}', 3),
  ('Do you offer cash on delivery?', 'Yes, across Pakistan. We confirm COD orders on WhatsApp before dispatch. Karachi orders can also be paid by Raast, card or bank transfer and delivered by our own rider.', '{cod,cash on delivery,delivery}', 4),
  ('How fast is delivery?', 'Karachi: same or next day by our rider. Other cities: 2–3 working days by courier. You''ll get tracking on WhatsApp.', '{delivery,shipping}', 5),
  ('Is my data safe during a repair?', 'We only ask for your passcode if a test truly needs it. It is encrypted and automatically deleted the moment you collect your phone. We never open your photos or apps.', '{data,privacy,passcode}', 6),
  ('How do I check if a part is genuine?', 'Scan the QR code on the part''s label or enter its code at startech.pk/verify. You''ll see the grade, sale date and remaining warranty.', '{genuine,verify,fake}', 7),
  ('Can repair shops buy at trade prices?', 'Yes. Apply for a Technician Pro account. Once approved you get tiered pricing, a credit limit with a digital khata, and WhatsApp statements.', '{trade,wholesale,technician}', 8),
  ('Do you buy broken screens?', 'Yes — we buy broken LCD/OLED panels and old devices. Get an indicative price online, drop it at the shop, and get paid in cash, store credit or khata credit after testing.', '{buyback,sell,broken}', 9),
  ('Where is the shop?', 'Shop # 1F, Sarena Family Market and Mobile Mall, Roundabout, Sakhi Hassan, Sector 15-A-1, Buffer Zone, Karachi. Open Monday to Saturday, 1:00 PM to 12:00 AM; closed Sunday. Call or WhatsApp +92 332 2142141.', '{location,address,where,timing,hours,open,time}', 10);

insert into public.repair_stories (device_label, problem, replaced, grade, time_taken, quote, customer_name, sort) values
  ('iPhone 13', 'Shattered display after a fall; Face ID still working.', 'Display assembly', 'OEM', '45 minutes', 'Watched the whole thing on the tracker. True Tone works perfectly.', 'Sana K.', 1),
  ('Galaxy S22 Ultra', 'Green line across the OLED and bent mid-frame.', 'Display + mid-frame', 'ORIG_NEW', '1 day', 'They called before doing the frame — no surprise charges.', 'Fatima N.', 2),
  ('Redmi Note 12', 'Phone stopped charging; port full of lint and corroded.', 'Charging port flex', 'OEM', '30 minutes', 'Fixed while I had chai downstairs.', 'Usman T.', 3);

insert into public.reviews (source, rating, text, author_name, verified, status, featured, sort) values
  ('admin', 5, 'Sample review for development. Replace with real customer reviews at launch.', 'Sample Customer', false, 'published', true, 1);

insert into public.announcements (text_en, text_ur, link, sort) values
  ('Free fitting on all Original & OEM displays this week', 'اس ہفتے تمام اوریجنل اور OEM ڈسپلے پر مفت فٹنگ', '/shop', 1);

insert into public.content_blocks (key, en, ur, max_len) values
  ('footer.about', 'StarTech Electronics — genuine phone parts, honest repairs and trade supply from Sarena Mobile Mall, Karachi, since 2003.', 'اسٹارٹیک الیکٹرانکس — ۲۰۰۳ سے سرینا موبائل مال، کراچی۔', 240),
  ('whatsapp.prefill', 'Hi StarTech! I need help with my phone.', 'السلام علیکم! مجھے اپنے فون کے بارے میں مدد چاہیے۔', 160);

insert into public.discount_codes (code, kind, value, min_order, max_uses, channels) values
  ('WELCOME10', 'percent', 10, 200000, 500, '{online}'),
  ('EIDFIT', 'fixed', 50000, 500000, null, '{online,pos}');
