-- =============================================================================
-- 0013 Extension compatibility. On Supabase, pgcrypto lives in the `extensions`
-- schema, which SECURITY DEFINER functions (search_path = public) can't see.
-- Expose gen_random_bytes in public so defaults and RPCs work everywhere.
-- No-op where pgcrypto is already in public (local tests / plain Postgres).
-- =============================================================================
do $$
begin
  if to_regprocedure('public.gen_random_bytes(integer)') is null
     and to_regprocedure('extensions.gen_random_bytes(integer)') is not null then
    execute 'create function public.gen_random_bytes(integer) returns bytea language sql volatile as $f$ select extensions.gen_random_bytes($1) $f$';
  end if;
end $$;
