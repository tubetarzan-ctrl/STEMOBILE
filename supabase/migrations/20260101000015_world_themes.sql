-- =============================================================================
-- 0015 Eight more storefront themes, each inspired by the colour language of a
-- well-known product website (original palettes, no brand assets). Switchable
-- from Super Admin → Appearance. Body text ≥ 4.5:1 contrast on every surface.
-- =============================================================================
insert into public.site_themes (key, name, is_dark, is_active, sort, tokens) values
  -- clean Apple-store style: white, soft grey, signature blue
  ('cupertino-light', 'Cupertino Light', false, false, 10, '{"bg":"#FBFBFD","surface-1":"#FFFFFF","surface-2":"#F5F5F7","line":"#E2E2E7","ink":"#1D1D1F","ink-2":"#424245","ink-3":"#6E6E73","accent":"#0071E3","accent-ink":"#FFFFFF","trust":"#1A7F37","warn":"#B25000","danger":"#D70015"}'),
  -- Apple Pro product pages: pure black, graphite, bright blue
  ('graphite-pro', 'Graphite Pro', true, false, 11, '{"bg":"#000000","surface-1":"#111113","surface-2":"#1C1C1E","line":"#2C2C2E","ink":"#F5F5F7","ink-2":"#C7C7CC","ink-3":"#8E8E93","accent":"#2997FF","accent-ink":"#00142B","trust":"#30D158","warn":"#FFD60A","danger":"#FF453A"}'),
  -- fintech style (Stripe-like): airy light, deep navy text, indigo
  ('indigo-wave', 'Indigo Wave', false, false, 12, '{"bg":"#F6F9FC","surface-1":"#FFFFFF","surface-2":"#EEF2F8","line":"#DCE3EC","ink":"#0A2540","ink-2":"#425466","ink-3":"#5B6B7D","accent":"#635BFF","accent-ink":"#FFFFFF","trust":"#0E7A4E","warn":"#B4540A","danger":"#C0123C"}'),
  -- modern SaaS dark (Linear-like): near-black, violet
  ('dusk-violet', 'Dusk Violet', true, false, 13, '{"bg":"#08090A","surface-1":"#101113","surface-2":"#17181B","line":"#26272B","ink":"#F7F8F8","ink-2":"#B4B6BC","ink-3":"#8A8F98","accent":"#7C83F2","accent-ink":"#0B0D2A","trust":"#4CB782","warn":"#F2C94C","danger":"#EB5757"}'),
  -- industrial monochrome (Nothing-like): black & white with a red signal
  ('mono-signal', 'Mono Signal', true, false, 14, '{"bg":"#000000","surface-1":"#0D0D0D","surface-2":"#1A1A1A","line":"#2B2B2B","ink":"#FFFFFF","ink-2":"#C8C8C8","ink-3":"#8F8F8F","accent":"#E3202A","accent-ink":"#FFFFFF","trust":"#3DDC84","warn":"#FFC400","danger":"#FF5A5A"}'),
  -- electronics flagship (Samsung-like): deep ocean navy, electric blue
  ('ocean-navy', 'Ocean Navy', true, false, 15, '{"bg":"#050B1E","surface-1":"#0B1430","surface-2":"#111D40","line":"#1E2B55","ink":"#EEF2FF","ink-2":"#B3BEDB","ink-3":"#8593B8","accent":"#4C8DFF","accent-ink":"#04102B","trust":"#3DD598","warn":"#FFC542","danger":"#FF6B6B"}'),
  -- developer-platform noir (Vercel-like): black, white accent, minimal
  ('noir', 'Noir', true, false, 16, '{"bg":"#000000","surface-1":"#0A0A0A","surface-2":"#141414","line":"#262626","ink":"#EDEDED","ink-2":"#A1A1A1","ink-3":"#8F8F8F","accent":"#FFFFFF","accent-ink":"#000000","trust":"#50E3C2","warn":"#F5A623","danger":"#FF4D4D"}'),
  -- music-app energy (Spotify-like): charcoal with neon green
  ('neon-pulse', 'Neon Pulse', true, false, 17, '{"bg":"#0A0A0A","surface-1":"#121212","surface-2":"#1E1E1E","line":"#2A2A2A","ink":"#FFFFFF","ink-2":"#B3B3B3","ink-3":"#8C8C8C","accent":"#1ED760","accent-ink":"#04210F","trust":"#1ED760","warn":"#FFA42B","danger":"#F15E6C"}')
on conflict (key) do nothing;
