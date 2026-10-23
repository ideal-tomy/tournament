-- Read-only checks. See runbook for expected results.
SELECT name FROM sqlite_master
WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'
ORDER BY name;

SELECT e.id, e.title, e.environment, s.scene, s.version, s.scene_seq
FROM events e JOIN event_state s ON s.event_id = e.id
WHERE e.id = 'cf-rehearsal-001';

SELECT COUNT(*) AS sample_participant_count
FROM participants WHERE event_id = 'cf-rehearsal-001';

PRAGMA foreign_key_check;

SELECT e.id AS missing_state_event_id FROM events e
LEFT JOIN event_state s ON s.event_id = e.id WHERE s.event_id IS NULL;
