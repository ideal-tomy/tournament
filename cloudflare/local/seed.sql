-- Local-only, additive and repeatable. Never run against the published database.
INSERT OR IGNORE INTO events(id,title,environment,team_size,status)
VALUES('cf-local-control','ローカル検証コントロール','rehearsal',2,'draft');
INSERT OR IGNORE INTO events(id,title,environment,team_size,status)
VALUES('cf-local-entry','ローカル受付サンプル元','rehearsal',2,'draft');
