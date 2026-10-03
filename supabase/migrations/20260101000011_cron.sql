-- =============================================================================
-- 0011 Scheduled jobs (pg_cron). Times are UTC; PKT = UTC+5.
-- Notification side-effects (email/WhatsApp/PDF) run in Next.js /api/cron/*
-- routes (Vercel Cron), which read what these jobs leave behind.
-- Guarded so the migration still applies where pg_cron is unavailable.
-- =============================================================================
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    -- 23:59 PKT daily closing
    perform cron.schedule('daily-closing', '59 18 * * *', 'select public.run_daily_closing()');
    -- every 15 min: expire unpaid orders, push unconfirmed COD to call queue
    perform cron.schedule('expire-orders', '*/15 * * * *', 'select public.expire_unpaid_orders()');
    -- 1st of month 00:30 PKT: depreciation for the previous month
    perform cron.schedule('depreciation', '30 19 1 * *',
      $c$select public.run_depreciation((date_trunc('month', now() at time zone 'Asia/Karachi') - interval '1 day')::date)$c$);
    -- daily 03:00 PKT: purge 30-day-old trash
    perform cron.schedule('purge-trash', '0 22 * * *', 'select public.purge_trash()');
  end if;
end $$;
