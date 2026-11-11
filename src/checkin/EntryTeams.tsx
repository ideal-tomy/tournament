import { useEffect, useState } from 'react';
import type { Participant } from './api';
import { generatedTeamName, VENUE_TEAM_NAME_MAX } from '../features/draw/teamName';

export interface EntryTeam { id: string; name: string; memberIds: string[] }

function label(person?: Participant) {
  return person ? `${person.name}${person.rating != null ? ` Rt.${person.rating}` : ''}` : '不明';
}

function TeamName({ team, members, busy, onSave }: { team: EntryTeam; members: string[]; busy: boolean; onSave(name: string): void }) {
  const [value, setValue] = useState(team.name);
  useEffect(() => setValue(team.name), [team.name]);
  return <label className="entry-name">
    <input value={value} maxLength={VENUE_TEAM_NAME_MAX} placeholder={generatedTeamName(members)} aria-label="チーム名" disabled={busy} onChange={event => setValue(event.target.value)} />
    <button type="button" disabled={busy || value.trim() === team.name} onClick={() => onSave(value)}>保存</button>
  </label>;
}

export default function EntryTeams({ participants, teams, locked, busy, onCommand }: {
  participants: Participant[]; teams: EntryTeam[]; locked: boolean; busy: boolean;
  onCommand(path: string, body: Record<string, unknown>): void;
}) {
  const [first, setFirst] = useState<string | null>(null);
  const [second, setSecond] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const byId = new Map(participants.map(person => [person.id, person]));
  const used = new Set(teams.flatMap(team => team.memberIds));
  const rest = participants.filter(person => !used.has(person.id));
  function pick(id: string) {
    if (!first || first === id) { setFirst(first === id ? null : id); setSecond(null); setDraftName(''); return; }
    if (second === id) { setSecond(null); setDraftName(''); return; }
    setSecond(id); setDraftName('');
  }
  function savePair() {
    if (!first || !second) return;
    onCommand('/api/entry-teams', { memberIds: [first, second], name: draftName });
    setFirst(null); setSecond(null); setDraftName('');
  }
  if (!participants.length) return null;
  return <section className="card entry-teams">
    <h2>保存済みのチーム</h2>
    {locked && <p>ペアを確定したあとは、ここから組み替えできません。</p>}
    {teams.length === 0 && <p>相手が決まった2人を保存すると、当日に組み直さずに使えます。</p>}
    {teams.map((team, index) => {
      const names = team.memberIds.map(id => byId.get(id)?.name ?? '');
      return <article className="entry-team" key={team.id}>
        <p className="entry-team-members"><span>{index + 1}</span><span>{team.memberIds.map(id => label(byId.get(id))).join(' / ')}</span></p>
        {locked
          ? <p>{team.name || generatedTeamName(names)}</p>
          : <TeamName team={team} members={names} busy={busy} onSave={name => onCommand('/api/entry-teams/rename', { teamId: team.id, name })} />}
        {!locked && <button type="button" disabled={busy} onClick={() => onCommand('/api/entry-teams/release', { teamId: team.id })}>この組を解除</button>}
      </article>;
    })}
    {!locked && rest.length > 0 && <>
      <h3>未所属 {rest.length}人</h3>
      {rest.length < 2 && <p>もう1人登録すると、チームを保存できます。</p>}
      {rest.length >= 2 && <>
        <p>{second ? 'チーム名を入れて保存します。空欄なら個人名のままです。' : first ? `${byId.get(first)?.name} の相手を選んでください。` : '2人を選んでチームにします。'}</p>
        <div className="entry-pick">{rest.map(person => <button type="button" key={person.id} className={first === person.id || second === person.id ? 'is-picked' : undefined} aria-pressed={first === person.id || second === person.id} disabled={busy} onClick={() => pick(person.id)}>{label(person)}</button>)}</div>
        {first && second && <label className="entry-name">
          <input value={draftName} maxLength={VENUE_TEAM_NAME_MAX} placeholder="チーム名" aria-label="新しいチーム名" disabled={busy} onChange={event => setDraftName(event.target.value)} />
          <button type="button" className="primary" disabled={busy} onClick={savePair}>この2人を保存</button>
        </label>}
      </>}
    </>}
  </section>;
}
