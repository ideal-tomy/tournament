-- Saved pairs live beside the bracket. Deleting a person dissolves only that pair.
CREATE TABLE entry_teams (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_entry_teams_event ON entry_teams(event_id, position);

CREATE TABLE entry_team_members (
  team_id TEXT NOT NULL REFERENCES entry_teams(id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position IN (1, 2)),
  PRIMARY KEY (team_id, participant_id)
);
CREATE UNIQUE INDEX idx_entry_member_once ON entry_team_members(participant_id);

CREATE TRIGGER entry_team_keep_pair AFTER DELETE ON entry_team_members
BEGIN
  DELETE FROM entry_teams WHERE id = OLD.team_id
    AND (SELECT COUNT(*) FROM entry_team_members WHERE team_id = OLD.team_id) <> 2;
END;
