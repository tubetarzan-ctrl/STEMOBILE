-- =============================================================================
-- 0016 Feedback round 1:
--  * missing foreign keys (online orders list could not load its payments)
--  * full phone catalogue (old + new models, all major brands)
--  * un-verify a closed day, edit repair job details, track by phone
--  * support agent role, opening balances wizard, reset test data
-- =============================================================================

-- --- Relationships ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'payments_order_id_fkey') then
    alter table public.payments add constraint payments_order_id_fkey foreign key (order_id) references public.orders(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'payments_repair_job_id_fkey') then
    alter table public.payments add constraint payments_repair_job_id_fkey foreign key (repair_job_id) references public.repair_jobs(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'sales_order_id_fkey') then
    alter table public.sales add constraint sales_order_id_fkey foreign key (order_id) references public.orders(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'sales_repair_job_id_fkey') then
    alter table public.sales add constraint sales_repair_job_id_fkey foreign key (repair_job_id) references public.repair_jobs(id);
  end if;
end $$;
create index if not exists payments_order_idx on public.payments (order_id);
create index if not exists payments_repair_idx on public.payments (repair_job_id);

-- Brands (new ones only)
insert into public.brands (name, slug, sort) values
  ('Apple', 'apple', 20),
  ('Samsung', 'samsung', 21),
  ('Xiaomi', 'xiaomi', 22),
  ('Oppo', 'oppo', 23),
  ('Vivo', 'vivo', 24),
  ('Realme', 'realme', 25),
  ('Infinix', 'infinix', 26),
  ('Tecno', 'tecno', 27),
  ('OnePlus', 'oneplus', 28),
  ('Google', 'google', 29),
  ('Huawei', 'huawei', 30),
  ('Honor', 'honor', 31),
  ('Motorola', 'motorola', 32),
  ('Nokia', 'nokia', 33),
  ('Nothing', 'nothing', 34),
  ('itel', 'itel', 35)
on conflict do nothing;

-- Phone models: old and new, all major brands sold in Pakistan (406 models)
insert into public.devices (brand_id, name, slug)
select b.id, v.name, v.slug from (values
  ('Apple', 'iPhone 6', 'iphone-6'),
  ('Apple', 'iPhone 6 Plus', 'iphone-6-plus'),
  ('Apple', 'iPhone 6s', 'iphone-6s'),
  ('Apple', 'iPhone 6s Plus', 'iphone-6s-plus'),
  ('Apple', 'iPhone SE (2016)', 'iphone-se-2016'),
  ('Apple', 'iPhone 7', 'iphone-7'),
  ('Apple', 'iPhone 7 Plus', 'iphone-7-plus'),
  ('Apple', 'iPhone 8', 'iphone-8'),
  ('Apple', 'iPhone 8 Plus', 'iphone-8-plus'),
  ('Apple', 'iPhone X', 'iphone-x'),
  ('Apple', 'iPhone XR', 'iphone-xr'),
  ('Apple', 'iPhone XS', 'iphone-xs'),
  ('Apple', 'iPhone XS Max', 'iphone-xs-max'),
  ('Apple', 'iPhone 11', 'iphone-11'),
  ('Apple', 'iPhone 11 Pro', 'iphone-11-pro'),
  ('Apple', 'iPhone 11 Pro Max', 'iphone-11-pro-max'),
  ('Apple', 'iPhone SE (2020)', 'iphone-se-2020'),
  ('Apple', 'iPhone 12 mini', 'iphone-12-mini'),
  ('Apple', 'iPhone 12', 'iphone-12'),
  ('Apple', 'iPhone 12 Pro', 'iphone-12-pro'),
  ('Apple', 'iPhone 12 Pro Max', 'iphone-12-pro-max'),
  ('Apple', 'iPhone 13 mini', 'iphone-13-mini'),
  ('Apple', 'iPhone 13', 'iphone-13'),
  ('Apple', 'iPhone 13 Pro', 'iphone-13-pro'),
  ('Apple', 'iPhone 13 Pro Max', 'iphone-13-pro-max'),
  ('Apple', 'iPhone SE (2022)', 'iphone-se-2022'),
  ('Apple', 'iPhone 14', 'iphone-14'),
  ('Apple', 'iPhone 14 Plus', 'iphone-14-plus'),
  ('Apple', 'iPhone 14 Pro', 'iphone-14-pro'),
  ('Apple', 'iPhone 14 Pro Max', 'iphone-14-pro-max'),
  ('Apple', 'iPhone 15', 'iphone-15'),
  ('Apple', 'iPhone 15 Plus', 'iphone-15-plus'),
  ('Apple', 'iPhone 15 Pro', 'iphone-15-pro'),
  ('Apple', 'iPhone 15 Pro Max', 'iphone-15-pro-max'),
  ('Apple', 'iPhone 16', 'iphone-16'),
  ('Apple', 'iPhone 16 Plus', 'iphone-16-plus'),
  ('Apple', 'iPhone 16 Pro', 'iphone-16-pro'),
  ('Apple', 'iPhone 16 Pro Max', 'iphone-16-pro-max'),
  ('Apple', 'iPhone 16e', 'iphone-16e'),
  ('Apple', 'iPhone 17', 'iphone-17'),
  ('Apple', 'iPhone Air', 'iphone-air'),
  ('Apple', 'iPhone 17 Pro', 'iphone-17-pro'),
  ('Apple', 'iPhone 17 Pro Max', 'iphone-17-pro-max'),
  ('Apple', 'iPhone 18 Pro', 'iphone-18-pro'),
  ('Apple', 'iPhone 18 Pro Max', 'iphone-18-pro-max'),
  ('Samsung', 'Galaxy S8', 'samsung-galaxy-s8'),
  ('Samsung', 'Galaxy S8+', 'samsung-galaxy-s8'),
  ('Samsung', 'Galaxy S9', 'samsung-galaxy-s9'),
  ('Samsung', 'Galaxy S9+', 'samsung-galaxy-s9'),
  ('Samsung', 'Galaxy S10e', 'samsung-galaxy-s10e'),
  ('Samsung', 'Galaxy S10', 'samsung-galaxy-s10'),
  ('Samsung', 'Galaxy S10+', 'samsung-galaxy-s10'),
  ('Samsung', 'Galaxy S20', 'samsung-galaxy-s20'),
  ('Samsung', 'Galaxy S20+', 'samsung-galaxy-s20'),
  ('Samsung', 'Galaxy S20 Ultra', 'samsung-galaxy-s20-ultra'),
  ('Samsung', 'Galaxy S20 FE', 'samsung-galaxy-s20-fe'),
  ('Samsung', 'Galaxy S21', 'samsung-galaxy-s21'),
  ('Samsung', 'Galaxy S21+', 'samsung-galaxy-s21'),
  ('Samsung', 'Galaxy S21 Ultra', 'samsung-galaxy-s21-ultra'),
  ('Samsung', 'Galaxy S21 FE', 'samsung-galaxy-s21-fe'),
  ('Samsung', 'Galaxy S22', 'samsung-galaxy-s22'),
  ('Samsung', 'Galaxy S22+', 'samsung-galaxy-s22'),
  ('Samsung', 'Galaxy S22 Ultra', 'samsung-galaxy-s22-ultra'),
  ('Samsung', 'Galaxy S23', 'samsung-galaxy-s23'),
  ('Samsung', 'Galaxy S23+', 'samsung-galaxy-s23'),
  ('Samsung', 'Galaxy S23 Ultra', 'samsung-galaxy-s23-ultra'),
  ('Samsung', 'Galaxy S23 FE', 'samsung-galaxy-s23-fe'),
  ('Samsung', 'Galaxy S24', 'samsung-galaxy-s24'),
  ('Samsung', 'Galaxy S24+', 'samsung-galaxy-s24'),
  ('Samsung', 'Galaxy S24 Ultra', 'samsung-galaxy-s24-ultra'),
  ('Samsung', 'Galaxy S24 FE', 'samsung-galaxy-s24-fe'),
  ('Samsung', 'Galaxy S25', 'samsung-galaxy-s25'),
  ('Samsung', 'Galaxy S25+', 'samsung-galaxy-s25'),
  ('Samsung', 'Galaxy S25 Ultra', 'samsung-galaxy-s25-ultra'),
  ('Samsung', 'Galaxy S25 Edge', 'samsung-galaxy-s25-edge'),
  ('Samsung', 'Galaxy S25 FE', 'samsung-galaxy-s25-fe'),
  ('Samsung', 'Galaxy S26', 'samsung-galaxy-s26'),
  ('Samsung', 'Galaxy S26+', 'samsung-galaxy-s26'),
  ('Samsung', 'Galaxy S26 Ultra', 'samsung-galaxy-s26-ultra'),
  ('Samsung', 'Galaxy Note 8', 'samsung-galaxy-note-8'),
  ('Samsung', 'Galaxy Note 9', 'samsung-galaxy-note-9'),
  ('Samsung', 'Galaxy Note 10', 'samsung-galaxy-note-10'),
  ('Samsung', 'Galaxy Note 10+', 'samsung-galaxy-note-10'),
  ('Samsung', 'Galaxy Note 20', 'samsung-galaxy-note-20'),
  ('Samsung', 'Galaxy Note 20 Ultra', 'samsung-galaxy-note-20-ultra'),
  ('Samsung', 'Galaxy Z Flip 3', 'samsung-galaxy-z-flip-3'),
  ('Samsung', 'Galaxy Z Flip 4', 'samsung-galaxy-z-flip-4'),
  ('Samsung', 'Galaxy Z Flip 5', 'samsung-galaxy-z-flip-5'),
  ('Samsung', 'Galaxy Z Flip 6', 'samsung-galaxy-z-flip-6'),
  ('Samsung', 'Galaxy Z Flip 7', 'samsung-galaxy-z-flip-7'),
  ('Samsung', 'Galaxy Z Fold 3', 'samsung-galaxy-z-fold-3'),
  ('Samsung', 'Galaxy Z Fold 4', 'samsung-galaxy-z-fold-4'),
  ('Samsung', 'Galaxy Z Fold 5', 'samsung-galaxy-z-fold-5'),
  ('Samsung', 'Galaxy Z Fold 6', 'samsung-galaxy-z-fold-6'),
  ('Samsung', 'Galaxy Z Fold 7', 'samsung-galaxy-z-fold-7'),
  ('Samsung', 'Galaxy A03', 'samsung-galaxy-a03'),
  ('Samsung', 'Galaxy A04', 'samsung-galaxy-a04'),
  ('Samsung', 'Galaxy A05', 'samsung-galaxy-a05'),
  ('Samsung', 'Galaxy A05s', 'samsung-galaxy-a05s'),
  ('Samsung', 'Galaxy A06', 'samsung-galaxy-a06'),
  ('Samsung', 'Galaxy A10', 'samsung-galaxy-a10'),
  ('Samsung', 'Galaxy A10s', 'samsung-galaxy-a10s'),
  ('Samsung', 'Galaxy A11', 'samsung-galaxy-a11'),
  ('Samsung', 'Galaxy A12', 'samsung-galaxy-a12'),
  ('Samsung', 'Galaxy A13', 'samsung-galaxy-a13'),
  ('Samsung', 'Galaxy A14', 'samsung-galaxy-a14'),
  ('Samsung', 'Galaxy A15', 'samsung-galaxy-a15'),
  ('Samsung', 'Galaxy A16', 'samsung-galaxy-a16'),
  ('Samsung', 'Galaxy A17', 'samsung-galaxy-a17'),
  ('Samsung', 'Galaxy A20', 'samsung-galaxy-a20'),
  ('Samsung', 'Galaxy A20s', 'samsung-galaxy-a20s'),
  ('Samsung', 'Galaxy A21s', 'samsung-galaxy-a21s'),
  ('Samsung', 'Galaxy A22', 'samsung-galaxy-a22'),
  ('Samsung', 'Galaxy A23', 'samsung-galaxy-a23'),
  ('Samsung', 'Galaxy A24', 'samsung-galaxy-a24'),
  ('Samsung', 'Galaxy A25', 'samsung-galaxy-a25'),
  ('Samsung', 'Galaxy A26', 'samsung-galaxy-a26'),
  ('Samsung', 'Galaxy A30', 'samsung-galaxy-a30'),
  ('Samsung', 'Galaxy A30s', 'samsung-galaxy-a30s'),
  ('Samsung', 'Galaxy A31', 'samsung-galaxy-a31'),
  ('Samsung', 'Galaxy A32', 'samsung-galaxy-a32'),
  ('Samsung', 'Galaxy A33', 'samsung-galaxy-a33'),
  ('Samsung', 'Galaxy A34', 'samsung-galaxy-a34'),
  ('Samsung', 'Galaxy A35', 'samsung-galaxy-a35'),
  ('Samsung', 'Galaxy A36', 'samsung-galaxy-a36'),
  ('Samsung', 'Galaxy A50', 'samsung-galaxy-a50'),
  ('Samsung', 'Galaxy A51', 'samsung-galaxy-a51'),
  ('Samsung', 'Galaxy A52', 'samsung-galaxy-a52'),
  ('Samsung', 'Galaxy A52s', 'samsung-galaxy-a52s'),
  ('Samsung', 'Galaxy A53', 'samsung-galaxy-a53'),
  ('Samsung', 'Galaxy A54', 'samsung-galaxy-a54'),
  ('Samsung', 'Galaxy A55', 'samsung-galaxy-a55'),
  ('Samsung', 'Galaxy A56', 'samsung-galaxy-a56'),
  ('Samsung', 'Galaxy M12', 'samsung-galaxy-m12'),
  ('Samsung', 'Galaxy M14', 'samsung-galaxy-m14'),
  ('Samsung', 'Galaxy M31', 'samsung-galaxy-m31'),
  ('Samsung', 'Galaxy M32', 'samsung-galaxy-m32'),
  ('Samsung', 'Galaxy M33', 'samsung-galaxy-m33'),
  ('Samsung', 'Galaxy M34', 'samsung-galaxy-m34'),
  ('Samsung', 'Galaxy M51', 'samsung-galaxy-m51'),
  ('Samsung', 'Galaxy M52', 'samsung-galaxy-m52'),
  ('Samsung', 'Galaxy M53', 'samsung-galaxy-m53'),
  ('Samsung', 'Galaxy M54', 'samsung-galaxy-m54'),
  ('Samsung', 'Galaxy M55', 'samsung-galaxy-m55'),
  ('Xiaomi', 'Redmi Note 8', 'xiaomi-redmi-note-8'),
  ('Xiaomi', 'Redmi Note 8 Pro', 'xiaomi-redmi-note-8-pro'),
  ('Xiaomi', 'Redmi Note 9', 'xiaomi-redmi-note-9'),
  ('Xiaomi', 'Redmi Note 9s', 'xiaomi-redmi-note-9s'),
  ('Xiaomi', 'Redmi Note 9 Pro', 'xiaomi-redmi-note-9-pro'),
  ('Xiaomi', 'Redmi Note 10', 'xiaomi-redmi-note-10'),
  ('Xiaomi', 'Redmi Note 10s', 'xiaomi-redmi-note-10s'),
  ('Xiaomi', 'Redmi Note 10 Pro', 'xiaomi-redmi-note-10-pro'),
  ('Xiaomi', 'Redmi Note 11', 'xiaomi-redmi-note-11'),
  ('Xiaomi', 'Redmi Note 11s', 'xiaomi-redmi-note-11s'),
  ('Xiaomi', 'Redmi Note 11 Pro', 'xiaomi-redmi-note-11-pro'),
  ('Xiaomi', 'Redmi Note 12', 'xiaomi-redmi-note-12'),
  ('Xiaomi', 'Redmi Note 12 Pro', 'xiaomi-redmi-note-12-pro'),
  ('Xiaomi', 'Redmi Note 13', 'xiaomi-redmi-note-13'),
  ('Xiaomi', 'Redmi Note 13 Pro', 'xiaomi-redmi-note-13-pro'),
  ('Xiaomi', 'Redmi Note 13 Pro+', 'xiaomi-redmi-note-13-pro'),
  ('Xiaomi', 'Redmi Note 14', 'xiaomi-redmi-note-14'),
  ('Xiaomi', 'Redmi Note 14 Pro', 'xiaomi-redmi-note-14-pro'),
  ('Xiaomi', 'Redmi Note 14 Pro+', 'xiaomi-redmi-note-14-pro'),
  ('Xiaomi', 'Redmi Note 15', 'xiaomi-redmi-note-15'),
  ('Xiaomi', 'Redmi Note 15 Pro', 'xiaomi-redmi-note-15-pro'),
  ('Xiaomi', 'Redmi Note 15 Pro+', 'xiaomi-redmi-note-15-pro'),
  ('Xiaomi', 'Redmi 9', 'xiaomi-redmi-9'),
  ('Xiaomi', 'Redmi 9A', 'xiaomi-redmi-9a'),
  ('Xiaomi', 'Redmi 9C', 'xiaomi-redmi-9c'),
  ('Xiaomi', 'Redmi 9T', 'xiaomi-redmi-9t'),
  ('Xiaomi', 'Redmi 10', 'xiaomi-redmi-10'),
  ('Xiaomi', 'Redmi 10A', 'xiaomi-redmi-10a'),
  ('Xiaomi', 'Redmi 10C', 'xiaomi-redmi-10c'),
  ('Xiaomi', 'Redmi 12', 'xiaomi-redmi-12'),
  ('Xiaomi', 'Redmi 12C', 'xiaomi-redmi-12c'),
  ('Xiaomi', 'Redmi 13', 'xiaomi-redmi-13'),
  ('Xiaomi', 'Redmi 13C', 'xiaomi-redmi-13c'),
  ('Xiaomi', 'Redmi 14C', 'xiaomi-redmi-14c'),
  ('Xiaomi', 'Redmi 15', 'xiaomi-redmi-15'),
  ('Xiaomi', 'Redmi 15C', 'xiaomi-redmi-15c'),
  ('Xiaomi', 'Redmi A3', 'xiaomi-redmi-a3'),
  ('Xiaomi', 'Redmi A5', 'xiaomi-redmi-a5'),
  ('Xiaomi', 'Poco X3 Pro', 'xiaomi-poco-x3-pro'),
  ('Xiaomi', 'Poco X4 Pro', 'xiaomi-poco-x4-pro'),
  ('Xiaomi', 'Poco X5 Pro', 'xiaomi-poco-x5-pro'),
  ('Xiaomi', 'Poco X6 Pro', 'xiaomi-poco-x6-pro'),
  ('Xiaomi', 'Poco X7 Pro', 'xiaomi-poco-x7-pro'),
  ('Xiaomi', 'Poco F5', 'xiaomi-poco-f5'),
  ('Xiaomi', 'Poco F6', 'xiaomi-poco-f6'),
  ('Xiaomi', 'Poco F7', 'xiaomi-poco-f7'),
  ('Xiaomi', 'Poco M6 Pro', 'xiaomi-poco-m6-pro'),
  ('Xiaomi', 'Xiaomi 12', 'xiaomi-xiaomi-12'),
  ('Xiaomi', 'Xiaomi 13', 'xiaomi-xiaomi-13'),
  ('Xiaomi', 'Xiaomi 13T', 'xiaomi-xiaomi-13t'),
  ('Xiaomi', 'Xiaomi 14', 'xiaomi-xiaomi-14'),
  ('Xiaomi', 'Xiaomi 14T', 'xiaomi-xiaomi-14t'),
  ('Xiaomi', 'Xiaomi 15', 'xiaomi-xiaomi-15'),
  ('Xiaomi', 'Xiaomi 15T', 'xiaomi-xiaomi-15t'),
  ('Oppo', 'A5s', 'oppo-a5s'),
  ('Oppo', 'A12', 'oppo-a12'),
  ('Oppo', 'A15', 'oppo-a15'),
  ('Oppo', 'A16', 'oppo-a16'),
  ('Oppo', 'A17', 'oppo-a17'),
  ('Oppo', 'A18', 'oppo-a18'),
  ('Oppo', 'A38', 'oppo-a38'),
  ('Oppo', 'A54', 'oppo-a54'),
  ('Oppo', 'A57', 'oppo-a57'),
  ('Oppo', 'A58', 'oppo-a58'),
  ('Oppo', 'A60', 'oppo-a60'),
  ('Oppo', 'A78', 'oppo-a78'),
  ('Oppo', 'A3', 'oppo-a3'),
  ('Oppo', 'A3x', 'oppo-a3x'),
  ('Oppo', 'A5', 'oppo-a5'),
  ('Oppo', 'Reno 5', 'oppo-reno-5'),
  ('Oppo', 'Reno 6', 'oppo-reno-6'),
  ('Oppo', 'Reno 7', 'oppo-reno-7'),
  ('Oppo', 'Reno 8', 'oppo-reno-8'),
  ('Oppo', 'Reno 8T', 'oppo-reno-8t'),
  ('Oppo', 'Reno 10', 'oppo-reno-10'),
  ('Oppo', 'Reno 11', 'oppo-reno-11'),
  ('Oppo', 'Reno 11F', 'oppo-reno-11f'),
  ('Oppo', 'Reno 12', 'oppo-reno-12'),
  ('Oppo', 'Reno 12F', 'oppo-reno-12f'),
  ('Oppo', 'Reno 13', 'oppo-reno-13'),
  ('Oppo', 'Reno 13F', 'oppo-reno-13f'),
  ('Oppo', 'Reno 14', 'oppo-reno-14'),
  ('Oppo', 'Reno 14F', 'oppo-reno-14f'),
  ('Oppo', 'F19', 'oppo-f19'),
  ('Oppo', 'F21 Pro', 'oppo-f21-pro'),
  ('Oppo', 'F25 Pro', 'oppo-f25-pro'),
  ('Oppo', 'F27', 'oppo-f27'),
  ('Oppo', 'F29', 'oppo-f29'),
  ('Vivo', 'Y11', 'vivo-y11'),
  ('Vivo', 'Y12', 'vivo-y12'),
  ('Vivo', 'Y15s', 'vivo-y15s'),
  ('Vivo', 'Y17s', 'vivo-y17s'),
  ('Vivo', 'Y20', 'vivo-y20'),
  ('Vivo', 'Y21', 'vivo-y21'),
  ('Vivo', 'Y22', 'vivo-y22'),
  ('Vivo', 'Y27', 'vivo-y27'),
  ('Vivo', 'Y28', 'vivo-y28'),
  ('Vivo', 'Y36', 'vivo-y36'),
  ('Vivo', 'Y03', 'vivo-y03'),
  ('Vivo', 'Y04', 'vivo-y04'),
  ('Vivo', 'Y18', 'vivo-y18'),
  ('Vivo', 'Y19', 'vivo-y19'),
  ('Vivo', 'Y29', 'vivo-y29'),
  ('Vivo', 'Y100', 'vivo-y100'),
  ('Vivo', 'V20', 'vivo-v20'),
  ('Vivo', 'V21', 'vivo-v21'),
  ('Vivo', 'V23', 'vivo-v23'),
  ('Vivo', 'V25', 'vivo-v25'),
  ('Vivo', 'V27', 'vivo-v27'),
  ('Vivo', 'V29', 'vivo-v29'),
  ('Vivo', 'V30', 'vivo-v30'),
  ('Vivo', 'V40', 'vivo-v40'),
  ('Vivo', 'V50', 'vivo-v50'),
  ('Vivo', 'V60', 'vivo-v60'),
  ('Vivo', 'S1', 'vivo-s1'),
  ('Realme', 'C11', 'realme-c11'),
  ('Realme', 'C15', 'realme-c15'),
  ('Realme', 'C21', 'realme-c21'),
  ('Realme', 'C25', 'realme-c25'),
  ('Realme', 'C30', 'realme-c30'),
  ('Realme', 'C31', 'realme-c31'),
  ('Realme', 'C33', 'realme-c33'),
  ('Realme', 'C35', 'realme-c35'),
  ('Realme', 'C51', 'realme-c51'),
  ('Realme', 'C53', 'realme-c53'),
  ('Realme', 'C55', 'realme-c55'),
  ('Realme', 'C61', 'realme-c61'),
  ('Realme', 'C63', 'realme-c63'),
  ('Realme', 'C65', 'realme-c65'),
  ('Realme', 'C67', 'realme-c67'),
  ('Realme', 'C71', 'realme-c71'),
  ('Realme', 'C75', 'realme-c75'),
  ('Realme', 'Note 50', 'realme-note-50'),
  ('Realme', 'Note 60', 'realme-note-60'),
  ('Realme', 'Realme 8', 'realme-realme-8'),
  ('Realme', 'Realme 9', 'realme-realme-9'),
  ('Realme', 'Realme 10', 'realme-realme-10'),
  ('Realme', 'Realme 11', 'realme-realme-11'),
  ('Realme', 'Realme 12', 'realme-realme-12'),
  ('Realme', 'Realme 13', 'realme-realme-13'),
  ('Realme', 'Realme 14', 'realme-realme-14'),
  ('Realme', 'GT Master', 'realme-gt-master'),
  ('Infinix', 'Hot 10', 'infinix-hot-10'),
  ('Infinix', 'Hot 11', 'infinix-hot-11'),
  ('Infinix', 'Hot 12', 'infinix-hot-12'),
  ('Infinix', 'Hot 20', 'infinix-hot-20'),
  ('Infinix', 'Hot 30', 'infinix-hot-30'),
  ('Infinix', 'Hot 40', 'infinix-hot-40'),
  ('Infinix', 'Hot 40i', 'infinix-hot-40i'),
  ('Infinix', 'Hot 40 Pro', 'infinix-hot-40-pro'),
  ('Infinix', 'Hot 50', 'infinix-hot-50'),
  ('Infinix', 'Hot 50 Pro', 'infinix-hot-50-pro'),
  ('Infinix', 'Hot 60', 'infinix-hot-60'),
  ('Infinix', 'Smart 6', 'infinix-smart-6'),
  ('Infinix', 'Smart 7', 'infinix-smart-7'),
  ('Infinix', 'Smart 8', 'infinix-smart-8'),
  ('Infinix', 'Smart 9', 'infinix-smart-9'),
  ('Infinix', 'Smart 10', 'infinix-smart-10'),
  ('Infinix', 'Note 10', 'infinix-note-10'),
  ('Infinix', 'Note 11', 'infinix-note-11'),
  ('Infinix', 'Note 12', 'infinix-note-12'),
  ('Infinix', 'Note 30', 'infinix-note-30'),
  ('Infinix', 'Note 40', 'infinix-note-40'),
  ('Infinix', 'Note 40 Pro', 'infinix-note-40-pro'),
  ('Infinix', 'Note 50', 'infinix-note-50'),
  ('Infinix', 'Note 50 Pro', 'infinix-note-50-pro'),
  ('Infinix', 'Zero 30', 'infinix-zero-30'),
  ('Infinix', 'Zero 40', 'infinix-zero-40'),
  ('Infinix', 'GT 20 Pro', 'infinix-gt-20-pro'),
  ('Tecno', 'Spark 7', 'tecno-spark-7'),
  ('Tecno', 'Spark 8', 'tecno-spark-8'),
  ('Tecno', 'Spark 8C', 'tecno-spark-8c'),
  ('Tecno', 'Spark 9', 'tecno-spark-9'),
  ('Tecno', 'Spark 10', 'tecno-spark-10'),
  ('Tecno', 'Spark 10 Pro', 'tecno-spark-10-pro'),
  ('Tecno', 'Spark 20', 'tecno-spark-20'),
  ('Tecno', 'Spark 20 Pro', 'tecno-spark-20-pro'),
  ('Tecno', 'Spark 30', 'tecno-spark-30'),
  ('Tecno', 'Spark 30C', 'tecno-spark-30c'),
  ('Tecno', 'Spark 40', 'tecno-spark-40'),
  ('Tecno', 'Camon 18', 'tecno-camon-18'),
  ('Tecno', 'Camon 19', 'tecno-camon-19'),
  ('Tecno', 'Camon 20', 'tecno-camon-20'),
  ('Tecno', 'Camon 20 Pro', 'tecno-camon-20-pro'),
  ('Tecno', 'Camon 30', 'tecno-camon-30'),
  ('Tecno', 'Camon 40', 'tecno-camon-40'),
  ('Tecno', 'Camon 40 Pro', 'tecno-camon-40-pro'),
  ('Tecno', 'Pova 5', 'tecno-pova-5'),
  ('Tecno', 'Pova 6', 'tecno-pova-6'),
  ('Tecno', 'Pova 7', 'tecno-pova-7'),
  ('Tecno', 'Pop 7', 'tecno-pop-7'),
  ('Tecno', 'Pop 8', 'tecno-pop-8'),
  ('Tecno', 'Pop 9', 'tecno-pop-9'),
  ('OnePlus', 'OnePlus 7T', 'oneplus-oneplus-7t'),
  ('OnePlus', 'OnePlus 8', 'oneplus-oneplus-8'),
  ('OnePlus', 'OnePlus 8T', 'oneplus-oneplus-8t'),
  ('OnePlus', 'OnePlus 9', 'oneplus-oneplus-9'),
  ('OnePlus', 'OnePlus 9 Pro', 'oneplus-oneplus-9-pro'),
  ('OnePlus', 'OnePlus 10 Pro', 'oneplus-oneplus-10-pro'),
  ('OnePlus', 'OnePlus 11', 'oneplus-oneplus-11'),
  ('OnePlus', 'OnePlus 12', 'oneplus-oneplus-12'),
  ('OnePlus', 'OnePlus 13', 'oneplus-oneplus-13'),
  ('OnePlus', 'Nord', 'oneplus-nord'),
  ('OnePlus', 'Nord 2', 'oneplus-nord-2'),
  ('OnePlus', 'Nord 3', 'oneplus-nord-3'),
  ('OnePlus', 'Nord 4', 'oneplus-nord-4'),
  ('OnePlus', 'Nord CE 2', 'oneplus-nord-ce-2'),
  ('OnePlus', 'Nord CE 3', 'oneplus-nord-ce-3'),
  ('OnePlus', 'Nord CE 4', 'oneplus-nord-ce-4'),
  ('Google', 'Pixel 4a', 'pixel-4a'),
  ('Google', 'Pixel 5', 'pixel-5'),
  ('Google', 'Pixel 6', 'pixel-6'),
  ('Google', 'Pixel 6 Pro', 'pixel-6-pro'),
  ('Google', 'Pixel 6a', 'pixel-6a'),
  ('Google', 'Pixel 7', 'pixel-7'),
  ('Google', 'Pixel 7 Pro', 'pixel-7-pro'),
  ('Google', 'Pixel 7a', 'pixel-7a'),
  ('Google', 'Pixel 8', 'pixel-8'),
  ('Google', 'Pixel 8 Pro', 'pixel-8-pro'),
  ('Google', 'Pixel 8a', 'pixel-8a'),
  ('Google', 'Pixel 9', 'pixel-9'),
  ('Google', 'Pixel 9 Pro', 'pixel-9-pro'),
  ('Google', 'Pixel 9 Pro XL', 'pixel-9-pro-xl'),
  ('Google', 'Pixel 9a', 'pixel-9a'),
  ('Google', 'Pixel 10', 'pixel-10'),
  ('Google', 'Pixel 10 Pro', 'pixel-10-pro'),
  ('Google', 'Pixel 10 Pro XL', 'pixel-10-pro-xl'),
  ('Huawei', 'P30', 'huawei-p30'),
  ('Huawei', 'P30 Lite', 'huawei-p30-lite'),
  ('Huawei', 'P30 Pro', 'huawei-p30-pro'),
  ('Huawei', 'P40', 'huawei-p40'),
  ('Huawei', 'Y7 Prime 2019', 'huawei-y7-prime-2019'),
  ('Huawei', 'Y9 Prime 2019', 'huawei-y9-prime-2019'),
  ('Huawei', 'Nova 7i', 'huawei-nova-7i'),
  ('Huawei', 'Nova 9', 'huawei-nova-9'),
  ('Huawei', 'Nova 11', 'huawei-nova-11'),
  ('Huawei', 'Mate 20 Pro', 'huawei-mate-20-pro'),
  ('Honor', 'X7', 'honor-x7'),
  ('Honor', 'X7a', 'honor-x7a'),
  ('Honor', 'X7b', 'honor-x7b'),
  ('Honor', 'X8', 'honor-x8'),
  ('Honor', 'X8a', 'honor-x8a'),
  ('Honor', 'X8b', 'honor-x8b'),
  ('Honor', 'X9b', 'honor-x9b'),
  ('Honor', 'X9c', 'honor-x9c'),
  ('Honor', 'Honor 90', 'honor-honor-90'),
  ('Honor', 'Honor 200', 'honor-honor-200'),
  ('Honor', 'Honor 400', 'honor-honor-400'),
  ('Honor', 'Magic 6 Pro', 'honor-magic-6-pro'),
  ('Motorola', 'Moto G54', 'motorola-moto-g54'),
  ('Motorola', 'Moto G84', 'motorola-moto-g84'),
  ('Motorola', 'Edge 40', 'motorola-edge-40'),
  ('Motorola', 'Edge 50', 'motorola-edge-50'),
  ('Nokia', 'G21', 'nokia-g21'),
  ('Nokia', 'C32', 'nokia-c32'),
  ('Nothing', 'Phone (1)', 'nothing-phone-1'),
  ('Nothing', 'Phone (2)', 'nothing-phone-2'),
  ('Nothing', 'Phone (2a)', 'nothing-phone-2a'),
  ('Nothing', 'Phone (3a)', 'nothing-phone-3a'),
  ('itel', 'A70', 'itel-a70'),
  ('itel', 'S23', 'itel-s23'),
  ('itel', 'P55', 'itel-p55')
) as v(brand, name, slug) join public.brands b on b.name = v.brand
on conflict do nothing;

-- --- Daily closing: undo a "verified" mark ------------------------------------
create or replace function public.unverify_business_day(p_date date)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_permission('accounts.period.close');
  update public.business_days set status = 'closed', verified_at = null, verified_by = null
   where date = p_date and status = 'verified';
  if not found then raise exception 'day_not_verified'; end if;
  perform public._audit('unverify_day', 'business_days', p_date::text, null, null);
end $$;

-- --- Repairs: technician, labour, estimate, promised time, notes ---------------
create or replace function public.update_repair_job_details(p_job uuid, p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare j public.repair_jobs;
begin
  perform public.require_permission('repairs.manage');
  select * into j from public.repair_jobs where id = p_job for update;
  if not found then raise exception 'job_not_found'; end if;
  if j.status in ('delivered','cancelled','returned_unrepaired') then raise exception 'job_closed'; end if;
  update public.repair_jobs set
    technician_id = case when p ? 'technician_id' then nullif(p->>'technician_id', '')::uuid else technician_id end,
    labour        = coalesce((p->>'labour')::bigint, labour),
    estimate      = coalesce((p->>'estimate')::bigint, estimate),
    promised_at   = case when p ? 'promised_at' then nullif(p->>'promised_at', '')::timestamptz else promised_at end,
    imei          = coalesce(nullif(p->>'imei', ''), imei),
    notes         = case when p ? 'notes' then p->>'notes' else notes end
  where id = p_job;
  perform public._audit('update', 'repair_jobs', p_job::text, to_jsonb(j), p);
end $$;

-- --- Customer tracking without an account: number + phone ---------------------
create or replace function public.track_lookup(p_ref text, p_phone text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_phone text := public.normalize_phone(p_phone); v_ref text := upper(trim(p_ref)); r record;
begin
  if v_ref ~ '^ST-?\d+$' then
    select o.order_no, o.tracking_token into r from public.orders o join public.customers c on c.id = o.customer_id
     where o.order_no = 'ST-' || lpad(regexp_replace(v_ref, '\D', '', 'g'), 6, '0') and c.phone = v_phone;
    if found then return jsonb_build_object('kind', 'order', 'url', '/track/' || r.order_no || '?t=' || r.tracking_token); end if;
  else
    select j.tracking_ref into r from public.repair_jobs j join public.customers c on c.id = j.customer_id
     where (j.job_no = 'RJ-' || lpad(regexp_replace(v_ref, '\D', '', 'g'), 6, '0') or j.tracking_ref = v_ref) and c.phone = v_phone;
    if found then return jsonb_build_object('kind', 'repair', 'url', '/track/' || r.tracking_ref); end if;
  end if;
  return null;
end $$;

-- Everything a phone number has ordered / booked (most recent 10 of each).
create or replace function public.track_by_phone(p_phone text, p_ref text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_phone text := public.normalize_phone(p_phone);
begin
  -- the caller must also know one order/job number on that phone (stops number-guessing)
  if public.track_lookup(p_ref, p_phone) is null then return null; end if;
  return jsonb_build_object(
    'orders', coalesce((select jsonb_agg(jsonb_build_object('no', o.order_no, 'status', o.status, 'total', o.total, 'at', o.created_at,
                 'url', '/track/' || o.order_no || '?t=' || o.tracking_token) order by o.created_at desc)
               from (select o.* from public.orders o join public.customers c on c.id = o.customer_id where c.phone = v_phone order by o.created_at desc limit 10) o), '[]'),
    'repairs', coalesce((select jsonb_agg(jsonb_build_object('no', j.job_no, 'status', j.status, 'device', j.device_label, 'at', j.created_at,
                 'url', '/track/' || j.tracking_ref) order by j.created_at desc)
               from (select j.* from public.repair_jobs j join public.customers c on c.id = j.customer_id where c.phone = v_phone order by j.created_at desc limit 10) j), '[]'));
end $$;
grant execute on function public.track_lookup(text, text), public.track_by_phone(text, text) to anon, authenticated;

-- --- Customer support agent role ------------------------------------------------
insert into public.roles (key, name, description) values ('support_agent', 'Support Agent', 'Answers website chat, WhatsApp and inquiries')
on conflict (key) do nothing;
insert into public.role_permissions (role_key, permission_key) values
  ('support_agent', 'inbox.manage'), ('support_agent', 'orders.view'), ('support_agent', 'repairs.view'), ('support_agent', 'customers.view')
on conflict do nothing;

-- --- Opening balances (moving from old books) ------------------------------------
-- p: { date, cash, bank, customers:[{name, phone, amount}], suppliers:[{name, amount}], note }
-- Debits cash, bank and what customers owe; credits what we owe suppliers; the
-- difference goes to Opening Balance Equity. Stock is opened separately
-- (Inventory → Import), which also credits Opening Balance Equity.
create or replace function public.post_opening_balances(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_lines jsonb := '[]'; r jsonb; v_cust uuid; v_sup uuid; v_dr bigint := 0; v_cr bigint := 0; v_amt bigint; v_je uuid;
begin
  perform public.require_permission('accounts.journal.create');
  v_amt := coalesce((p->>'cash')::bigint, 0);
  if v_amt > 0 then v_lines := v_lines || jsonb_build_object('account', 10100, 'debit', v_amt, 'memo', 'Opening cash'); v_dr := v_dr + v_amt; end if;
  v_amt := coalesce((p->>'bank')::bigint, 0);
  if v_amt > 0 then v_lines := v_lines || jsonb_build_object('account', 10200, 'debit', v_amt, 'memo', 'Opening bank'); v_dr := v_dr + v_amt; end if;
  for r in select * from jsonb_array_elements(coalesce(p->'customers', '[]')) loop
    v_amt := (r->>'amount')::bigint;
    continue when coalesce(v_amt, 0) <= 0;
    v_cust := public._upsert_customer(r->>'phone', r->>'name');
    if v_cust is null then raise exception 'customer_phone_required: %', r->>'name'; end if;
    insert into public.trade_accounts (customer_id, shop_name, status, approved_at, credit_limit)
    values (v_cust, coalesce(nullif(r->>'name', ''), 'Customer'), 'approved', now(), v_amt * 2)
    on conflict (customer_id) do nothing;
    v_lines := v_lines || jsonb_build_object('account', 11000, 'debit', v_amt, 'party_type', 'customer', 'party_id', v_cust, 'memo', 'Opening khata: ' || coalesce(r->>'name', ''));
    v_dr := v_dr + v_amt;
  end loop;
  for r in select * from jsonb_array_elements(coalesce(p->'suppliers', '[]')) loop
    v_amt := (r->>'amount')::bigint;
    continue when coalesce(v_amt, 0) <= 0;
    select id into v_sup from public.suppliers where lower(name) = lower(trim(r->>'name')) limit 1;
    if v_sup is null then insert into public.suppliers (name) values (trim(r->>'name')) returning id into v_sup; end if;
    insert into public.supplier_bills (supplier_id, bill_no, amount_fc, amount_pkr, bill_date) values (v_sup, 'OPENING', v_amt, v_amt, coalesce((p->>'date')::date, public.business_date()));
    v_lines := v_lines || jsonb_build_object('account', 20100, 'credit', v_amt, 'party_type', 'supplier', 'party_id', v_sup, 'memo', 'Opening payable: ' || (r->>'name'));
    v_cr := v_cr + v_amt;
  end loop;
  if v_dr = 0 and v_cr = 0 then raise exception 'nothing_to_post'; end if;
  v_lines := v_lines || jsonb_build_object('account', 30900, 'credit', v_dr - v_cr, 'memo', 'Opening balance equity');
  v_je := public._post_journal(coalesce((p->>'date')::date, public.business_date()), coalesce(nullif(p->>'note', ''), 'Opening balances from old books'), 'opening_balances', null, v_lines);
  perform public._audit('opening_balances', 'journal_entries', v_je::text, null, p);
  return v_je;
end $$;

-- --- Reset test data (Super Admin only) ------------------------------------------
-- Wipes every transaction (sales, journals, stock, orders, repairs, customers…)
-- so real books start clean. Keeps settings, website content, themes, FAQs,
-- staff and phone models. p_keep_catalog = false also removes products/suppliers.
-- TRUNCATE bypasses the immutability triggers by design — this is the ONLY
-- sanctioned way to delete posted journals, and it is audit-logged.
create or replace function public.reset_business_data(p_keep_catalog boolean default true, p_confirm text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._is_system() and not exists (select 1 from public.profiles where id = auth.uid() and role_key = 'super_admin' and is_active) then
    raise exception 'permission_denied: only the owner can reset data' using errcode = '42501';
  end if;
  if p_confirm <> 'DELETE ALL TEST DATA' then raise exception 'confirmation_text_mismatch'; end if;
  set constraints all immediate;  -- run any queued balance checks before truncating

  truncate table
    public.journal_lines, public.journal_entries, public.stock_movements, public.stock_levels, public.stock_alerts,
    public.stock_adjustments, public.stock_count_lines, public.stock_counts, public.transfers, public.serial_units,
    public.sale_items, public.return_items, public.returns, public.payments, public.payment_webhooks, public.sync_conflicts,
    public.sales, public.loyalty_ledger, public.drawer_sessions, public.business_days, public.accounting_periods,
    public.order_items, public.order_events, public.cod_confirmations, public.shipments, public.courier_remittance_lines,
    public.courier_remittances, public.discount_redemptions, public.orders,
    public.repair_parts, public.repair_photos, public.repair_checklists, public.repair_status_history, public.warranties,
    public.buyback_requests, public.repair_stories, public.repair_jobs,
    public.grn_lines, public.landed_cost_charges, public.supplier_payments, public.supplier_bills, public.grns, public.po_lines, public.purchase_orders,
    public.expenses, public.depreciation_runs, public.fixed_assets, public.bank_matches, public.bank_statement_lines, public.bank_statements,
    public.financial_notes, public.inquiries, public.email_threads, public.whatsapp_messages, public.whatsapp_threads,
    public.notifications, public.review_requests, public.review_media, public.reviews, public.ai_usage_log,
    public.referral_codes, public.customer_devices, public.addresses, public.trade_accounts, public.customers
  restart identity cascade;

  if not p_keep_catalog then
    truncate table public.repair_price_list, public.bundle_items, public.bundles, public.variant_tier_prices, public.part_compat,
      public.product_images, public.product_variants, public.products, public.suppliers restart identity cascade;
  else
    update public.product_variants set avg_cost = 0;   -- no stock left → cost re-learns from the first receipt
  end if;
  alter sequence public.orders_no_seq restart with 1;
  alter sequence public.repair_no_seq restart with 1;
  perform public._audit('reset_business_data', 'database', null, null, jsonb_build_object('keep_catalog', p_keep_catalog));
  return jsonb_build_object('ok', true, 'keep_catalog', p_keep_catalog);
end $$;
revoke execute on function public.reset_business_data(boolean, text) from public, anon;
grant execute on function public.reset_business_data(boolean, text) to authenticated;

-- --- Easy Books: pay a supplier, oldest bills first ------------------------------
-- One transaction. DECISION: any amount beyond open bills posts as an unallocated
-- payment (debit to Payables for that supplier) — shown in the ledger, not in bill aging.
create or replace function public.pay_supplier_simple(p_supplier uuid, p_amount bigint, p_paid_from int, p_reference text default null)
returns int language plpgsql security definer set search_path = public as $$
declare b record; v_left bigint := p_amount; v_part bigint; v_n int := 0;
begin
  perform public.require_permission('purchases.pay');
  if p_amount is null or p_amount <= 0 then raise exception 'amount_must_be_positive'; end if;
  for b in select id, amount_pkr - paid_pkr as open from public.supplier_bills
            where supplier_id = p_supplier and status <> 'paid' and amount_pkr > paid_pkr
            order by bill_date, id for update loop
    exit when v_left = 0;
    v_part := least(v_left, b.open);
    perform public.record_supplier_payment(p_supplier, b.id, v_part, v_part, p_paid_from, p_reference);
    v_left := v_left - v_part; v_n := v_n + 1;
  end loop;
  if v_left > 0 then
    perform public.record_supplier_payment(p_supplier, null, v_left, v_left, p_paid_from, coalesce(p_reference, 'Advance'));
    v_n := v_n + 1;
  end if;
  return v_n;
end $$;

-- --- Inventory: delete / archive products ------------------------------------------
-- DECISION: a product that was ever stocked, sold, ordered or used in a repair is
-- archived (hidden everywhere, history kept so the books stay correct); a product
-- with no history at all is deleted outright. Returns {deleted, archived}.
create or replace function public.delete_products(p_ids uuid[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_del int := 0; v_arch int := 0;
begin
  perform public.require_permission('inventory.edit');
  foreach v_id in array p_ids loop
    if exists (select 1 from public.product_variants v where v.product_id = v_id and (
         exists (select 1 from public.stock_movements m where m.variant_id = v.id)
      or exists (select 1 from public.sale_items s where s.variant_id = v.id)
      or exists (select 1 from public.order_items o where o.variant_id = v.id)
      or exists (select 1 from public.repair_parts r where r.variant_id = v.id)
      or exists (select 1 from public.grn_lines g where g.variant_id = v.id)
      or exists (select 1 from public.po_lines pl where pl.variant_id = v.id))) then
      update public.products set is_active = false, is_online = false where id = v_id;
      update public.product_variants set is_active = false where product_id = v_id;
      v_arch := v_arch + 1;
    else
      delete from public.stock_levels where variant_id in (select id from public.product_variants where product_id = v_id);
      delete from public.stock_alerts where variant_id in (select id from public.product_variants where product_id = v_id);
      delete from public.products where id = v_id;
      if found then v_del := v_del + 1; end if;
    end if;
  end loop;
  perform public._audit('delete_products', 'products', null, null, jsonb_build_object('ids', p_ids, 'deleted', v_del, 'archived', v_arch));
  return jsonb_build_object('deleted', v_del, 'archived', v_arch);
end $$;

-- --- Inventory: bulk import (sheet / Excel / CSV) + opening stock ----------------------
-- rows: [{name, category, brand, sku, grade, price, min_price, cost, qty, barcode, image}]
-- Existing SKU: price/name updated (stock is NOT re-opened for it). New SKU: product
-- + variant created; qty > 0 posts opening stock at cost (Dr Inventory / Cr Opening equity).
create or replace function public.import_products(p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb; v_cat public.categories; v_brand uuid; v_prod uuid; v_var uuid; v_sku text; v_slug text; v_grade public.part_grade;
        v_new int := 0; v_upd int := 0; v_open jsonb := '[]'; v_n int := 0;
begin
  perform public.require_permission('inventory.edit');
  for r in select * from jsonb_array_elements(p_rows) loop
    v_n := v_n + 1;
    if coalesce(trim(r->>'name'), '') = '' then raise exception 'row_%: name_required', v_n; end if;
    if coalesce((r->>'price')::numeric, -1) < 0 then raise exception 'row_%: price_required', v_n; end if;
    v_sku := upper(coalesce(nullif(trim(r->>'sku'), ''), 'ST-' || upper(substr(md5(random()::text), 1, 8))));
    v_grade := coalesce(nullif(upper(trim(r->>'grade')), ''), 'NA')::public.part_grade;
    v_var := null;
    select id into v_var from public.product_variants where sku = v_sku;
    if v_var is not null then
      update public.product_variants set sale_price = (r->>'price')::bigint,
        min_price = coalesce((r->>'min_price')::bigint, min_price), is_active = true where id = v_var;
      update public.products set name = trim(r->>'name'), is_active = true
       where id = (select product_id from public.product_variants where id = v_var);
      v_upd := v_upd + 1;
      continue;
    end if;
    select * into v_cat from public.categories where lower(slug) = lower(trim(r->>'category')) or lower(name) = lower(trim(r->>'category')) limit 1;
    if not found then raise exception 'row_%: unknown_category %', v_n, coalesce(r->>'category', '(empty)'); end if;
    v_brand := null;
    if nullif(trim(r->>'brand'), '') is not null then
      select id into v_brand from public.brands where lower(name) = lower(trim(r->>'brand'));
      if v_brand is null then
        insert into public.brands (name, slug) values (trim(r->>'brand'), lower(regexp_replace(trim(r->>'brand'), '[^a-zA-Z0-9]+', '-', 'g'))) returning id into v_brand;
      end if;
    end if;
    -- same name + category: add as another variant (e.g. a second grade)
    v_prod := null;
    select id into v_prod from public.products where lower(name) = lower(trim(r->>'name')) and category_id = v_cat.id limit 1;
    if v_prod is null then
      v_slug := trim(both '-' from lower(regexp_replace(trim(r->>'name'), '[^a-zA-Z0-9]+', '-', 'g')));
      if exists (select 1 from public.products where slug = v_slug) then v_slug := v_slug || '-' || lower(substr(md5(random()::text), 1, 5)); end if;
      insert into public.products (name, slug, category_id, brand_id) values (trim(r->>'name'), v_slug, v_cat.id, v_brand) returning id into v_prod;
    end if;
    insert into public.product_variants (product_id, sku, barcode, grade, sale_price, min_price)
    values (v_prod, v_sku, nullif(trim(r->>'barcode'), ''), v_grade, (r->>'price')::bigint, coalesce((r->>'min_price')::bigint, 0))
    returning id into v_var;
    if nullif(trim(r->>'image'), '') is not null then
      insert into public.product_images (product_id, url, sort) values (v_prod, trim(r->>'image'), 0);
    end if;
    if coalesce((r->>'qty')::int, 0) > 0 then
      v_open := v_open || jsonb_build_object('variant_id', v_var, 'qty', (r->>'qty')::int, 'unit_cost', coalesce((r->>'cost')::bigint, 0));
    end if;
    v_new := v_new + 1;
  end loop;
  if jsonb_array_length(v_open) > 0 then perform public.post_opening_stock(v_open); end if;
  return jsonb_build_object('created', v_new, 'updated', v_upd, 'stocked', jsonb_array_length(v_open));
end $$;
