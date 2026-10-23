-- Synthetic names only; idempotent. Not an import of production data.
INSERT INTO events (id, title, status, environment)
VALUES ('cf-rehearsal-001', 'Cloudflare接続確認用大会', 'draft', 'rehearsal')
ON CONFLICT(id) DO NOTHING;

INSERT INTO event_state (event_id, scene, awaiting_operator)
VALUES ('cf-rehearsal-001', 'idle', 1)
ON CONFLICT(event_id) DO NOTHING;

INSERT INTO participants (id, event_id, entry_no, display_name, rating)
VALUES ('cf-sample-player-001', 'cf-rehearsal-001', 1, 'サンプル選手A', 5.5)
ON CONFLICT(id) DO NOTHING;

INSERT INTO participants (id, event_id, entry_no, display_name, rating)
VALUES ('cf-sample-player-002', 'cf-rehearsal-001', 2, 'サンプル選手B', 6.0)
ON CONFLICT(id) DO NOTHING;
