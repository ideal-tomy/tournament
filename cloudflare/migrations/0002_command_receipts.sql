-- Persistence foundation only. Worker must authenticate, serialize per event,
-- validate expectedVersion, and commit all writes atomically before broadcast.
CREATE TABLE command_receipts (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  expected_version INTEGER NOT NULL CHECK (expected_version >= 0),
  committed_version INTEGER NOT NULL CHECK (committed_version = expected_version + 1),
  response_json TEXT NOT NULL CHECK (json_valid(response_json)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (event_id, request_id),
  UNIQUE (event_id, committed_version)
);

CREATE INDEX idx_operation_log_request ON operation_log(event_id, request_id);
