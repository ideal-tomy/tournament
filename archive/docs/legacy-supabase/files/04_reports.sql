-- =====================================================================
-- 04_reports.sql  集計クエリ集（参照のみ）
-- スポンサー報告・大会後の振り返りに使う
-- =====================================================================

-- ---------------------------------------------------------------------
-- (1) スポンサー別の広告表示回数（1 大会分）
--     店舗への報告に使う
-- ---------------------------------------------------------------------
select
  coalesce(sp.shop_name, sp.name, '(未設定)') as sponsor,
  ma.title                                    as media_title,
  count(*)                                    as impressions,
  count(*) filter (where ai.is_completed)     as completed,
  round(sum(ai.duration_ms) / 1000.0, 1)      as total_seconds
from public.ad_impressions ai
left join public.media_assets ma on ma.id = ai.media_id
left join public.sponsors    sp on sp.id = coalesce(ai.sponsor_id, ma.sponsor_id)
where ai.event_id = :event_id
group by 1, 2
order by impressions desc;


-- ---------------------------------------------------------------------
-- (2) スポンサー別の年間累計
-- ---------------------------------------------------------------------
select
  coalesce(sp.shop_name, sp.name) as sponsor,
  count(distinct ai.event_id)     as events,
  count(*)                        as impressions
from public.ad_impressions ai
left join public.media_assets ma on ma.id = ai.media_id
left join public.sponsors    sp on sp.id = coalesce(ai.sponsor_id, ma.sponsor_id)
where ai.shown_at >= date_trunc('year', now())
group by 1
order by impressions desc;


-- ---------------------------------------------------------------------
-- (3) 大会の進行実績（1 試合あたりの所要時間）
--     次回の進行計画に使う
-- ---------------------------------------------------------------------
select
  m.bracket,
  m.round,
  count(*)                                                          as matches,
  round(avg(extract(epoch from (m.finished_at - m.started_at))/60), 1) as avg_minutes,
  round(max(extract(epoch from (m.finished_at - m.started_at))/60), 1) as max_minutes
from public.matches m
where m.event_id = :event_id
  and m.started_at is not null
  and m.finished_at is not null
group by m.bracket, m.round
order by m.bracket, m.round;


-- ---------------------------------------------------------------------
-- (4) 当日の操作履歴（トラブル検証用）
-- ---------------------------------------------------------------------
select
  ol.created_at,
  ol.action,
  ol.target_table,
  ol.target_id,
  case when ol.undone_at is not null then '取消済' else '有効' end as state
from public.operation_log ol
where ol.event_id = :event_id
order by ol.id desc
limit 200;


-- ---------------------------------------------------------------------
-- (5) 1 手戻す対象（最新の有効な操作）
--     アプリ側の実装が参照する形と同じ
-- ---------------------------------------------------------------------
select *
from public.operation_log
where event_id = :event_id
  and undone_at is null
order by id desc
limit 1;


-- ---------------------------------------------------------------------
-- (6) 抽選結果の整合性チェック
--     reveal_order を team_size 人ずつ組にすると確定チームが再現されるか
--     （不一致が出たら commitDraw の実装バグ）
-- ---------------------------------------------------------------------
with ds as (
  select d.id, d.event_id, e.team_size, d.reveal_order
  from public.draw_sessions d
  join public.events e on e.id = d.event_id
  where d.event_id = :event_id and d.committed_at is not null
  order by d.created_at desc
  limit 1
),
expanded as (
  select
    ds.id as draw_id,
    (value #>> '{}')::uuid as participant_id,
    ((ordinality - 1) / ds.team_size) as expected_group
  from ds, jsonb_array_elements(ds.reveal_order) with ordinality as t(value, ordinality)
),
actual as (
  select tm.participant_id, tm.team_id
  from public.team_members tm
  join public.teams t on t.id = tm.team_id
  where t.event_id = :event_id
)
select
  e.expected_group,
  count(distinct a.team_id) as distinct_teams_in_group   -- 1 なら正常
from expanded e
join actual a on a.participant_id = e.participant_id
group by e.expected_group
having count(distinct a.team_id) <> 1
order by e.expected_group;
