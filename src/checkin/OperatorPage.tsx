import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, ApiError, scopedUrl, type Participant } from './api';
import type { DrawState } from './DrawControl';
import { useTournamentState } from './useTournamentState';
import { makeBalancedTeams } from '../features/draw/draw';

type Command = { path: string; body: Record<string, unknown> };
type Team = DrawState['teams'][number];

function Face({ person, size = 48 }: { person?: Participant; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (!person) return null;
  return <span className="op-face" style={{ width: size, height: size }}>
    {failed ? <span>{person.name.slice(0, 2)}</span> : <img src={`${person.portraitUrl}?version=${person.version}`} alt="" width={size} height={size} onError={() => setFailed(true)} />}
  </span>;
}

function PairRow({ index, members, byId, onRemove }: { index: number; members: string[]; byId: Map<string, Participant>; onRemove?(): void }) {
  return <li className="op-pair">
    <span className="op-pair-no">{index + 1}</span>
    {members.map(id => <span key={id} className="op-pair-member"><Face person={byId.get(id)} size={36} /><span>{byId.get(id)?.name}</span></span>)}
    {onRemove && <button type="button" className="op-pair-remove" aria-label={`${index + 1}組目を外す`} onClick={onRemove}>×</button>}
  </li>;
}

function Pairing({ state, busy, onConfirm }: { state: DrawState; busy: boolean; onConfirm(mode: 'auto' | 'manual', pairs: string[][]): void }) {
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [pairs, setPairs] = useState<string[][]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const byId = useMemo(() => new Map(state.participants.map(p => [p.id, p])), [state.participants]);
  const rated = (people: Participant[]) => people.map(p => ({ id: p.id, rating: p.rating ?? 0 }));
  const automatic = useMemo(() => makeBalancedTeams(rated(state.participants), 'trio'), [state.participants]);
  const used = new Set(pairs.flat());
  const rest = state.participants.filter(p => !used.has(p.id));
  const complete = rest.length === 0 && pairs.length > 0;
  function pick(id: string) {
    if (!picked) { setPicked(id); return; }
    if (picked === id) { setPicked(null); return; }
    setPairs(value => [...value, [picked, id]]); setPicked(null);
  }
  return <>
    <div className="segmented" role="radiogroup" aria-label="組み方">
      <button type="button" role="radio" aria-checked={mode === 'auto'} className={mode === 'auto' ? 'is-on' : undefined} onClick={() => setMode('auto')}>自動で組む</button>
      <button type="button" role="radio" aria-checked={mode === 'manual'} className={mode === 'manual' ? 'is-on' : undefined} onClick={() => setMode('manual')}>自分で組む</button>
    </div>
    {mode === 'auto' ? <ol className="op-pairs">{automatic.map((members, index) => <PairRow key={members.join()} index={index} members={members} byId={byId} />)}</ol> : <>
      {pairs.length > 0 && <ol className="op-pairs">{pairs.map((members, index) => <PairRow key={members.join()} index={index} members={members} byId={byId} onRemove={() => setPairs(value => value.filter((_, i) => i !== index))} />)}</ol>}
      {rest.length > 0 && <>
        <p className="op-hint">{picked ? `${byId.get(picked)?.name} の相手をタップ` : '2人タップで1組'}</p>
        <div className="op-pick">{rest.map(person => <button type="button" key={person.id} className={picked === person.id ? 'is-picked' : undefined} aria-pressed={picked === person.id} onClick={() => pick(person.id)}><Face person={person} size={44} /><span>{person.name}</span></button>)}</div>
        {rest.length >= 2 && <button type="button" className="op-link-button" onClick={() => { setPairs(value => [...value, ...makeBalancedTeams(rated(rest), 'trio')]); setPicked(null); }}>残りを自動で組む</button>}
      </>}
    </>}
    <ActionBar>
      {mode === 'auto'
        ? <button className="primary" disabled={busy} onClick={() => onConfirm('auto', automatic)}>この組み合わせで確定</button>
        : <button className="primary" disabled={busy || !complete} onClick={() => onConfirm('manual', pairs)}>{complete ? 'この組み合わせで確定' : `あと ${rest.length} 人`}</button>}
    </ActionBar>
  </>;
}

function ActionBar({ children }: { children: ReactNode }) {
  return <div className="op-actionbar">{children}</div>;
}

function Waiting({ label }: { label: string }) {
  return <ActionBar><button className="primary" disabled>{label}</button></ActionBar>;
}

/** Two taps for anything the venue sees immediately; no browser dialog on phones. */
function ArmedButton({ label, armedLabel, disabled, onFire, className = 'primary' }: { label: string; armedLabel: string; disabled?: boolean; onFire(): void; className?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const timer = setTimeout(() => setArmed(false), 4000); return () => clearTimeout(timer); }, [armed]);
  return <button className={`${className}${armed ? ' is-armed' : ''}`} disabled={disabled} onClick={() => { if (armed) { setArmed(false); onFire(); } else setArmed(true); }}>{armed ? armedLabel : label}</button>;
}

function MatchCard({ state, choose, chosen }: { state: DrawState; choose?(slot: 0 | 1): void; chosen?: 0 | 1 | null }) {
  const match = state.flow!.currentMatch!;
  const byId = new Map(state.participants.map(p => [p.id, p]));
  const sides = [match.teamA, match.teamB].map(id => state.teams.find(team => team.id === id));
  const side = (team: Team | undefined, slot: 0 | 1) => {
    const body = <>
      <span className="op-side-label">{slot === 0 ? 'A' : 'B'}</span>
      <span className="op-side-faces">{team?.memberIds.map(id => <Face key={id} person={byId.get(id)} size={52} />)}</span>
      <span className="op-side-names">{team?.memberIds.map(id => byId.get(id)?.name).join(' & ')}</span>
    </>;
    return choose
      ? <button type="button" className={`op-side${chosen === slot ? ' is-chosen' : ''}`} aria-pressed={chosen === slot} onClick={() => choose(slot)}>{body}</button>
      : <div className="op-side">{body}</div>;
  };
  return <section className="op-match" aria-label="現在の試合">
    <p className="op-match-round">{match.final ? 'FINAL' : match.roundName ?? `Round ${match.round}`} · Match {match.id + 1}</p>
    <div className="op-match-sides">{side(sides[0], 0)}<span className="op-vs">VS</span>{side(sides[1], 1)}</div>
  </section>;
}

function phase(state: DrawState) {
  if (state.checkinStatus === 'open') return '受付中';
  if (!state.session) return '組み合わせ';
  if (state.flow?.phase === 'bracket_update') return '勝ち上がり';
  return ({ idle: '発表前', draw: 'ペア発表', bracket: 'ブラケット', vs_card: 'VS', match_live: '試合中', result: '勝者発表', award: '表彰', finished: '大会終了' } as Record<string, string>)[state.scene] ?? state.scene;
}

export default function OperatorPage({ onAuthRequired, sessionVersion }: { onAuthRequired(): void; sessionVersion: number }) {
  const { state, setState, error, refresh } = useTournamentState(onAuthRequired, sessionVersion, { portraits: false });
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const [winner, setWinner] = useState<0 | 1 | null>(null);
  const pending = useRef<Command | null>(null);
  const [, setPendingVersion] = useState(0);
  const matchId = state?.flow?.currentMatch?.id;
  useEffect(() => setWinner(null), [matchId, state?.scene]);

  async function send(path: string, body: Record<string, unknown>) {
    if (!state || busy) return;
    pending.current ??= { path, body: { requestId: crypto.randomUUID(), expectedVersion: state.version, ...body } };
    setBusy(true); setFailure('');
    try {
      const next = await api<DrawState>(pending.current.path, { method: 'POST', body: JSON.stringify(pending.current.body) });
      pending.current = null;
      if (next && typeof next.version === 'number') setState(next);
      refresh();
    } catch (reason) {
      setFailure(reason instanceof Error ? reason.message : '処理できませんでした。');
      if (reason instanceof ApiError) {
        if (reason.status === 401) onAuthRequired();
        else if (reason.status < 500) { pending.current = null; refresh(); }
      }
    } finally { setBusy(false); setPendingVersion(v => v + 1); }
  }
  const flow = (action: 'advance' | 'game-start' | 'start' | 'winner', extra: Record<string, unknown> = {}) => send(`/api/tournament/${action}`, extra);

  if (!state) return <section className="op"><p className="op-loading" role="status">{error || '大会を読み込んでいます…'}</p></section>;
  const byId = new Map(state.participants.map(p => [p.id, p]));
  const teamName = (id: string | null | undefined) => state.teams.find(team => team.id === id)?.name ?? '';
  const f = state.flow;
  const gate = (allowed: boolean | undefined, label: string, wait: string, action: () => void) => allowed
    ? <ActionBar><button className="primary" disabled={busy} onClick={action}>{label}</button></ActionBar>
    : <Waiting label={wait} />;

  let body: ReactNode = null, bar: ReactNode = null;
  if (state.checkinStatus === 'open') {
    body = <div className="op-big"><strong>{state.participants.length}</strong><span>名 受付済み</span></div>;
    bar = <ActionBar><a className="button primary" href={scopedUrl('/checkin')}>受付を締めて組み合わせへ</a></ActionBar>;
  } else if (!state.session) {
    body = <Pairing state={state} busy={busy} onConfirm={(mode, pairs) => void send('/api/draw/pairs', mode === 'manual' ? { mode, pairs } : { mode })} />;
  } else if (state.scene === 'idle') {
    body = <ol className="op-pairs">{state.teams.map((team, index) => <PairRow key={team.id} index={index} members={team.memberIds} byId={byId} />)}</ol>;
    bar = <ActionBar>
      <ArmedButton label="ペア発表開始" armedLabel="もう一度押すと会場で発表" disabled={busy} onFire={() => void send('/api/draw/start', {})} />
      <ArmedButton className="op-secondary" label="組み直す" armedLabel="もう一度押すと組み直す" disabled={busy} onFire={() => void send('/api/draw/pairs/reset', {})} />
    </ActionBar>;
  } else if (state.scene === 'draw') {
    body = <p className="op-note">会場でペアを発表しています</p>;
    bar = gate(f?.canAdvance, 'ブラケットを表示', 'ペア発表中…', () => void flow('advance'));
  } else if (state.scene === 'bracket' && f?.phase !== 'bracket_update') {
    body = <p className="op-note">会場にブラケットを表示しています</p>;
    bar = gate(f?.canGameStart, 'ゲームスタート', 'まもなく押せます', () => void flow('game-start'));
  } else if (f?.phase === 'bracket_update') {
    body = <p className="op-note">勝ち上がりを表示しています</p>;
    bar = gate(f.canAdvance, '次の試合へ', '勝ち上がり表示中…', () => void flow('advance'));
  } else if (state.scene === 'vs_card' && f?.currentMatch) {
    body = <MatchCard state={state} />;
    bar = gate(f.canStart, '試合開始', 'VS演出中 · まもなく押せます', () => void flow('start'));
  } else if (state.scene === 'match_live' && f?.currentMatch) {
    body = <><p className="op-hint">勝ったチームをタップ</p><MatchCard state={state} chosen={winner} choose={slot => setWinner(value => value === slot ? null : slot)} /></>;
    const chosenId = winner == null ? null : winner === 0 ? f.currentMatch.teamA : f.currentMatch.teamB;
    bar = winner == null ? <Waiting label="勝者を選んでください" /> : <ActionBar>
      <button className="primary" disabled={busy} onClick={() => void flow('winner', { winnerSlot: winner })}>{teamName(chosenId)} の勝利で確定</button>
      <button className="op-secondary" disabled={busy} onClick={() => setWinner(null)}>やめる</button>
    </ActionBar>;
  } else if (state.scene === 'result') {
    body = <div className="op-big"><span>勝者</span><strong className="op-team-name">{teamName(f?.winnerTeamId)}</strong></div>;
    bar = gate(f?.canAdvance, '次へ', 'WINNER表示中…', () => void flow('advance'));
  } else if (state.scene === 'award') {
    body = <div className="op-big"><span>優勝</span><strong className="op-team-name">{teamName(f?.championTeamId)}</strong></div>;
    bar = gate(f?.canAdvance, '大会を終える', 'CHAMPION演出中…', () => void flow('advance'));
  } else if (state.scene === 'finished') {
    body = <div className="op-big"><span>大会終了 · 優勝</span><strong className="op-team-name">{teamName(f?.championTeamId)}</strong></div>;
    bar = <ActionBar><a className="button" href="/start">次の大会を作る</a></ActionBar>;
  }

  return <section className="op" data-op-scene={state.scene}>
    <header className="op-head">
      <span className="op-phase">{phase(state)}</span>
      <span className="op-meta">{state.participants.length}名{state.teams.length ? ` · ${state.teams.length}組` : ''}{f?.completedMatches ? ` · ${f.completedMatches}試合済` : ''}</span>
    </header>
    <div className="op-body">{body}</div>
    {(failure || error) && <div className="op-error" role="alert"><p>{failure || error}</p>{pending.current && !busy ? <button onClick={() => void send(pending.current!.path, {})}>同じ操作を再試行</button> : <button onClick={refresh}>更新</button>}</div>}
    <details className="op-more"><summary>その他</summary>
      <a className="button" href={scopedUrl('/display')} target="_blank" rel="noreferrer">会場モニターを開く</a>
      <a className="button" href={scopedUrl('/checkin')}>受付を開く</a>
      <a className="button" href={scopedUrl('/rehearsal')}>演出の確認</a>
    </details>
    {bar}
  </section>;
}
