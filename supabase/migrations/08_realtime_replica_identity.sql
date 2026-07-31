-- =====================================================================
-- 08_realtime_replica_identity.sql
-- event_state / matches の Realtime フィルタ配信を安定させる
-- （UPDATE で old/new が欠けると Display がシーン更新を取りこぼす）
-- =====================================================================

alter table public.event_state replica identity full;
alter table public.matches replica identity full;
alter table public.teams replica identity full;
alter table public.team_members replica identity full;

-- publication 再確認
do $$
declare t text;
begin
  foreach t in array array['event_state', 'matches', 'teams', 'team_members', 'participants']
  loop
    if to_regclass(format('public.%I', t)) is null then
      continue;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
