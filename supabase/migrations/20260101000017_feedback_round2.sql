-- =============================================================================
-- 0017 Feedback round 2:
--  * website could not read reviews (review_media policy read a column anon
--    has no grant on → "permission denied for table reviews")
--  * a closed day no longer blocks sales: posting into it reopens the day
-- =============================================================================

-- --- Reviews: public photo policy via a definer helper ---------------------------
create or replace function public._review_is_published(p_review uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.reviews where id = p_review and status = 'published')
$$;
grant execute on function public._review_is_published(uuid) to anon, authenticated;
drop policy if exists public_read_review_media on public.review_media;
create policy public_read_review_media on public.review_media for select to anon, authenticated
  using (public._review_is_published(review_id));

-- --- Day locks ----------------------------------------------------------------------
-- DECISION: the shop trades until midnight and staff sometimes press "Close day"
-- early. A closed (or verified) day therefore never blocks a sale/expense: the new
-- entry reopens that day (audit-logged) so the next closing recounts it. Only a
-- closed month or year still blocks posting — that is the accountant's lock.
create or replace function public._check_period_open()
returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('startech.override_lock', true), '') = 'on' then return new; end if;
  if exists (select 1 from public.accounting_periods
              where new.entry_date between starts_on and ends_on and status <> 'open') then
    raise exception 'period_locked: % is in a closed month/year; post an owner-approved adjustment', new.entry_date
      using errcode = '55000';
  end if;
  update public.business_days set status = 'open', verified_at = null, verified_by = null
   where date = new.entry_date and status <> 'open';
  if found then
    perform public._audit('reopen_day', 'business_days', new.entry_date::text, null,
                          jsonb_build_object('reason', 'new entry after closing', 'memo', new.memo));
  end if;
  return new;
end $$;

-- Offline/late sales keep their own date unless the month is closed.
create or replace function public.is_date_locked(p_date date)
returns boolean language sql stable as $$
  select exists (select 1 from public.accounting_periods
                 where p_date between starts_on and ends_on and status <> 'open')
$$;

-- --- Social videos & posts on the website -----------------------------------------
alter table public.media_assets drop constraint if exists media_assets_source_check;
alter table public.media_assets add constraint media_assets_source_check
  check (source in ('upload','youtube','instagram','tiktok','facebook'));
