"""Run from any directory: python3 cloudflare/checks/validate_schema.py.

Uses a temporary in-memory SQLite database. Does not access Cloudflare.
"""
from pathlib import Path
import sqlite3

root = Path(__file__).resolve().parents[1]
db = sqlite3.connect(':memory:')
db.execute('PRAGMA foreign_keys = ON')
for migration in sorted((root / 'migrations').glob('*.sql')):
    db.executescript(migration.read_text())
    print(f'OK: {migration.name}')

seed = (root / 'seeds/rehearsal.sql').read_text()
db.executescript(seed)
db.executescript(seed)
assert db.execute('SELECT COUNT(*) FROM events').fetchone()[0] == 1
assert db.execute('SELECT COUNT(*) FROM participants').fetchone()[0] == 2
assert db.execute('PRAGMA foreign_key_check').fetchall() == []
assert db.execute('SELECT COUNT(*) FROM event_state').fetchone()[0] == 1

def rejects(sql):
    try:
        db.execute(sql)
    except sqlite3.IntegrityError:
        return
    raise AssertionError(f'Expected rejection: {sql}')

rejects("INSERT INTO participants (id,event_id,display_name) VALUES ('bad','missing','sample')")
rejects("UPDATE event_state SET presentation_mode='invalid'")
rejects("UPDATE event_state SET version=-1")
rejects("UPDATE event_state SET scene_payload='invalid JSON'")
rejects("UPDATE event_state SET audio_enabled=2")

receipt = """INSERT INTO command_receipts
  (event_id,request_id,actor_id,action,request_hash,expected_version,committed_version,response_json)
  VALUES ('cf-rehearsal-001','request-001','sample-admin','CONFIRM_RESULT','sample-hash',0,1,'{}')"""
db.execute(receipt)
rejects(receipt)
rejects(receipt.replace('request-001', 'request-002'))

tables = {row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
assert len(tables) == 15, tables
db.executescript((root / 'checks/verify.sql').read_text())
print('OK: 15 tables, seed repeated safely, foreign keys, JSON, booleans, versions, duplicate receipts')
db.close()
