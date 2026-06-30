-- 参加者レーティング（ダブルス編成の均等化に使用）
alter table public.participants
  add column if not exists rating numeric(6, 1);

comment on column public.participants.rating is '登録レーティング。抽選時にチーム平均の均等化に使用';
