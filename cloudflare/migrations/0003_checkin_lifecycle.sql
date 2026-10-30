-- Additive lifecycle support. Existing participants, events and images are preserved.
ALTER TABLE participants ADD COLUMN checkin_version INTEGER NOT NULL DEFAULT 0 CHECK (checkin_version >= 0);

CREATE TABLE checkin_state (
  event_id TEXT PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  revision INTEGER NOT NULL DEFAULT 0,
  closed_at TEXT,
  closed_roster TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(closed_roster)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
INSERT INTO checkin_state(event_id) SELECT id FROM events WHERE environment = 'rehearsal';

CREATE TABLE checkin_receipts (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL,
  action TEXT NOT NULL,
  participant_id TEXT,
  request_hash TEXT NOT NULL,
  response_json TEXT NOT NULL CHECK (json_valid(response_json)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY(event_id,request_id)
);

CREATE TABLE checkin_object_gc (
  object_key TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('staged','ready','done')),
  expires_at INTEGER NOT NULL,
  checked_at INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_checkin_gc_event ON checkin_object_gc(event_id,phase,expires_at);

CREATE TRIGGER checkin_insert_guard BEFORE INSERT ON participants
WHEN NEW.note LIKE 'checkin-v1:%'
BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM events WHERE id=NEW.event_id AND environment='rehearsal' AND status IN ('draft','entry'))
    OR COALESCE((SELECT status FROM checkin_state WHERE event_id=NEW.event_id),'open') <> 'open'
    THEN RAISE(ABORT,'CHECKIN_CLOSED') END;
  SELECT CASE WHEN NEW.checkin_version>0 AND NOT EXISTS(SELECT 1 FROM checkin_object_gc WHERE object_key=NEW.photo_path AND event_id=NEW.event_id AND phase='staged' AND expires_at>unixepoch())
    THEN RAISE(ABORT,'UPLOAD_EXPIRED') END;
END;

CREATE TRIGGER checkin_update_guard BEFORE UPDATE ON participants
WHEN OLD.note LIKE 'checkin-v1:%'
BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM events WHERE id=OLD.event_id AND environment='rehearsal' AND status IN ('draft','entry'))
    OR COALESCE((SELECT status FROM checkin_state WHERE event_id=OLD.event_id),'open') <> 'open'
    THEN RAISE(ABORT,'CHECKIN_CLOSED') END;
  SELECT CASE WHEN NEW.photo_path IS NOT OLD.photo_path AND NOT EXISTS(SELECT 1 FROM checkin_object_gc WHERE object_key=NEW.photo_path AND event_id=NEW.event_id AND phase='staged' AND expires_at>unixepoch())
    THEN RAISE(ABORT,'UPLOAD_EXPIRED') END;
END;

CREATE TRIGGER checkin_delete_guard BEFORE DELETE ON participants
WHEN OLD.note LIKE 'checkin-v1:%'
BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM events WHERE id=OLD.event_id AND environment='rehearsal' AND status IN ('draft','entry'))
    OR COALESCE((SELECT status FROM checkin_state WHERE event_id=OLD.event_id),'open') <> 'open'
    THEN RAISE(ABORT,'CHECKIN_CLOSED') END;
END;

CREATE TRIGGER checkin_insert_commit AFTER INSERT ON participants
WHEN NEW.note LIKE 'checkin-v1:%'
BEGIN
  DELETE FROM checkin_object_gc WHERE object_key=NEW.photo_path AND phase='staged';
  INSERT INTO checkin_state(event_id,revision) VALUES(NEW.event_id,1)
    ON CONFLICT(event_id) DO UPDATE SET revision=revision+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now');
END;

CREATE TRIGGER checkin_update_commit AFTER UPDATE ON participants
WHEN OLD.note LIKE 'checkin-v1:%'
BEGIN
  INSERT OR IGNORE INTO checkin_object_gc(object_key,event_id,phase,expires_at)
    SELECT OLD.photo_path,OLD.event_id,'ready',unixepoch() WHERE OLD.photo_path IS NOT NULL AND OLD.photo_path IS NOT NEW.photo_path;
  DELETE FROM checkin_object_gc WHERE object_key=NEW.photo_path AND phase='staged';
  INSERT INTO checkin_state(event_id,revision) VALUES(NEW.event_id,1)
    ON CONFLICT(event_id) DO UPDATE SET revision=revision+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now');
END;

CREATE TRIGGER checkin_delete_commit AFTER DELETE ON participants
WHEN OLD.note LIKE 'checkin-v1:%'
BEGIN
  INSERT OR IGNORE INTO checkin_object_gc(object_key,event_id,phase,expires_at)
    SELECT OLD.photo_path,OLD.event_id,'ready',unixepoch() WHERE OLD.photo_path IS NOT NULL;
  INSERT INTO checkin_state(event_id,revision) VALUES(OLD.event_id,1)
    ON CONFLICT(event_id) DO UPDATE SET revision=revision+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now');
END;
