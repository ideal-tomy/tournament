import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, ApiError, scopedUrl, type Participant } from './api';
import type { CeremonyStep, CourtBoard, DrawState, FlowMatch } from './DrawControl';
import { useTournamentState } from './useTournamentState';
import { makeBalancedTeams } from '../features/draw/draw';
import { generatedTeamName, VENUE_TEAM_NAME_MAX } from '../features/draw/teamName';
import { formatLabel } from './eventFormat';

type Command = { path: string; body: Record<string, unknown> };
type Team = DrawState['teams'][number];

function Face({ person, size = 48 }: { person?: Participant; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (!person) return null;
  return <span className="op-face" style={{ width: size, height: size }}>
    {failed ? <span>{person.name.slice(0, 2)}</span> : <img src={`${person.portraitUrl}?version=${person.version}`} alt="" width={size} height={size} onError={() => setFailed(true)} />}
  </span>;
}

function TeamNameField({ stored, memberNames, busy, onSave, onDraft }: { stored: string; memberNames: string[]; busy: boolean; onSave(name: string): void; onDraft(name: string | null): void }) {
  const saved = stored === generatedTeamName(memberNames) ? '' : stored;
  const [value, setValue] = useState(saved);
  useEffect(() => setValue(saved), [saved]);
  function change(next: string) {
    setValue(next);
    onDraft(next.trim() === saved ? null : next);
  }
  return <label className="op-venue-field">
    <input value={value} maxLength={VENUE_TEAM_NAME_MAX} placeholder="店舗名だけ" aria-label="会場に出すチーム名" disabled={busy} onChange={event => change(event.target.value)} />
    <button type="button" disabled={busy || value.trim() === saved} onClick={() => onSave(value)}>保存</button>
  </label>;
}

function PairRow({ index, members, byId, onRemove, bare = false }: { index: number; members: string[]; byId: Map<string, Participant>; onRemove?(): void; bare?: boolean }) {
  const Tag = bare ? 'div' : 'li';
  return <Tag className="op-pair">
    <span className="op-pair-no">{index + 1}</span>
    {members.map(id => <span key={id} className="op-pair-member"><Face person={byId.get(id)} size={36} /><span>{byId.get(id)?.name}</span></span>)}
    {onRemove && <button type="button" className="op-pair-remove" aria-label={`${index + 1}組目を外す`} onClick={onRemove}>×</button>}
  </Tag>;
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

function MatchCard({ state, match = state.flow!.currentMatch!, choose, chosen }: { state: DrawState; match?: FlowMatch; choose?(slot: 0 | 1): void; chosen?: 0 | 1 | null }) {
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

const boardStage: Record<CourtBoard['stage'], string> = { idle: '空き', call: '呼び出し中', live: '試合中', result: '勝者確定' };

function BoardCard({ state, board, busy, pick, onPick, onCommand }: {
  state: DrawState; board: CourtBoard; busy: boolean; pick?: 0 | 1;
  onPick(slot: 0 | 1): void; onCommand(action: 'court-start' | 'court-winner' | 'court-next', extra?: Record<string, unknown>): void;
}) {
  const match = board.match;
  const teamName = (id: string | null | undefined) => state.teams.find(team => team.id === id)?.name ?? '';
  const settled = board.stage === 'result' && match ? (board.winnerTeamId === match.teamA ? 0 : 1) : null;
  return <section className={`op-board is-${board.stage}`} aria-label={`台 ${board.board}`}>
    <header className="op-board-head"><strong>台 {board.board}</strong><span>{boardStage[board.stage]}</span></header>
    {match
      ? <MatchCard state={state} match={match} chosen={board.stage === 'live' ? pick ?? null : settled} choose={board.stage === 'live' ? onPick : undefined} />
      : <p className="op-note">下の段の試合が終わると、次の試合が入ります</p>}
    {board.stage === 'call' && <button className="primary" disabled={busy} onClick={() => onCommand('court-start')}>試合開始</button>}
    {board.stage === 'live' && match && (board.showing
      ? <button className="primary" disabled>会場でVS演出中…</button>
      : pick == null
        ? <button className="primary" disabled>勝ったチームをタップ</button>
        : <button className="primary" disabled={busy} onClick={() => onCommand('court-winner', { winnerSlot: pick })}>{teamName(pick === 0 ? match.teamA : match.teamB)} の勝利で確定</button>)}
    {board.stage === 'result' && <button className="primary" disabled={busy || board.showing} onClick={() => onCommand('court-next')}>{board.showing ? '会場で勝者演出中…' : 'この台に次の試合'}</button>}
  </section>;
}

const ceremonyLabel: Record<CeremonyStep, string> = { third: '3位', second: '2位', champion: '優勝', podium: '表彰台' };

function phase(state: DrawState) {
  if (state.checkinStatus === 'open') return '受付中';
  if (!state.session) return '組み合わせ';
  if (state.flow?.phase === 'bracket_update') return '勝ち上がり';
  return ({ idle: '発表前', draw: 'ペア発表', bracket: 'ブラケット', interval: `${state.flow?.courts?.count ?? ''}台で進行`, vs_card: 'VS', match_live: '試合中', result: '勝者発表', award: '表彰', finished: '大会終了' } as Record<string, string>)[state.scene] ?? state.scene;
}

export default function OperatorPage({ onAuthRequired, sessionVersion }: { onAuthRequired(): void; sessionVersion: number }) {
  const { state, setState, error, refresh } = useTournamentState(onAuthRequired, sessionVersion, { portraits: false });
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const [winner, setWinner] = useState<0 | 1 | null>(null);
  const [picks, setPicks] = useState<Partial<Record<number, 0 | 1>>>({});
  const pending = useRef<Command | null>(null);
  const nameDrafts = useRef(new Map<string, string>());
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
  const flow = (action: 'advance' | 'game-start' | 'start' | 'winner' | 'courts-open' | 'court-start' | 'court-winner' | 'court-next' | 'courts-view', extra: Record<string, unknown> = {}) => send(`/api/tournament/${action}`, extra);

  if (!state) return <section className="op"><p className="op-loading" role="status">{error || '大会を読み込んでいます…'}</p></section>;
  const current = state;
  const byId = new Map(current.participants.map(p => [p.id, p]));
  const teamName = (id: string | null | undefined) => current.teams.find(team => team.id === id)?.name ?? '';
  async function publishPairs() {
    if (busy) return;
    setBusy(true); setFailure('');
    try {
      let version = current.version;
      let latest: DrawState = current;
      for (const [teamId, name] of nameDrafts.current) {
        if (!current.teams.some(team => team.id === teamId)) continue;
        latest = await api<DrawState>('/api/draw/team-name', { method: 'POST', body: JSON.stringify({ requestId: crypto.randomUUID(), expectedVersion: version, teamId, name }) });
        version = latest.version;
      }
      latest = await api<DrawState>('/api/draw/start', { method: 'POST', body: JSON.stringify({ requestId: crypto.randomUUID(), expectedVersion: version }) });
      nameDrafts.current.clear();
      setState(latest);
      refresh();
    } catch (reason) {
      setFailure(reason instanceof Error ? reason.message : '処理できませんでした。');
      if (reason instanceof ApiError) {
        if (reason.status === 401) onAuthRequired();
        else if (reason.status < 500) refresh();
      }
    } finally { setBusy(false); }
  }
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
    body = <>
      <p className="op-name-note">会場に出す名前は店舗名だけにしてください。空欄のままなら、今までどおり個人名が並びます。</p>
      <ol className="op-pairs">{state.teams.map((team, index) => <li key={team.id} className="op-pair op-named">
        <PairRow bare index={index} members={team.memberIds} byId={byId} />
        <TeamNameField stored={team.name} memberNames={team.memberIds.map(id => byId.get(id)?.name ?? '')} busy={busy} onDraft={name => { if (name == null) nameDrafts.current.delete(team.id); else nameDrafts.current.set(team.id, name); }} onSave={name => void send('/api/draw/team-name', { teamId: team.id, name })} />
      </li>)}</ol>
    </>;
    bar = <ActionBar>
      <ArmedButton label="ペア発表開始" armedLabel="もう一度押すと会場で発表" disabled={busy} onFire={() => void publishPairs()} />
      <ArmedButton className="op-secondary" label="組み直す" armedLabel="もう一度押すと組み直す" disabled={busy} onFire={() => void send('/api/draw/pairs/reset', {})} />
    </ActionBar>;
  } else if (state.scene === 'draw') {
    body = <p className="op-note">会場でペアを発表しています</p>;
    bar = gate(f?.canAdvance, 'ブラケットを表示', 'ペア発表中…', () => void flow('advance'));
  } else if (state.scene === 'bracket' && f?.phase !== 'bracket_update') {
    body = <p className="op-note">会場にブラケットを表示しています</p>;
    bar = !f?.canGameStart ? <Waiting label="まもなく押せます" /> : <ActionBar>
      {!f.completedMatches && [2, 3].map(count => <button key={count} className="primary" disabled={busy} onClick={() => void flow('courts-open', { count })}>{count}台で開始</button>)}
      <button className={f.completedMatches ? 'primary' : 'op-secondary'} disabled={busy} onClick={() => void flow('game-start')}>ゲームスタート</button>
    </ActionBar>;
  } else if (state.scene === 'interval' && f?.courts) {
    const courts = f.courts;
    body = <div className="op-boards">
      <button className="op-link-button" disabled={busy} onClick={() => void flow('courts-view', { show: !courts.showBracket })}>{courts.showBracket ? '会場を台の表示に戻す' : '会場にトーナメント表を出す'}</button>
      {courts.boards.map(board => <BoardCard key={board.board} state={state} board={board} busy={busy}
        pick={board.match ? picks[board.match.id] : undefined}
        onPick={slot => board.match && setPicks(value => ({ ...value, [board.match!.id]: value[board.match!.id] === slot ? undefined : slot }))}
        onCommand={(action, extra) => void flow(action, { board: board.board, ...extra })} />)}
    </div>;
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
    const step = f?.ceremony ?? 'champion', places = f?.placements;
    const shown = step === 'third' ? places?.third : step === 'second' ? places?.second : step === 'champion' ? [f?.championTeamId ?? ''] : [];
    const next = step === 'third' ? (places?.second.length ? '2位へ' : '優勝へ') : step === 'second' ? '優勝へ' : step === 'champion' ? '表彰台へ' : '大会を終える';
    body = step === 'podium'
      ? <ol className="op-pairs" aria-label="表彰台">{([[1, [places?.first ?? f?.championTeamId ?? '']], [2, places?.second ?? []], [3, places?.third ?? []]] as const).filter(([, ids]) => ids.length).map(([rank, ids]) => <li key={rank} className="op-pair"><span className="op-pair-no">{rank}</span><span>{ids.map(teamName).join(' ／ ')}</span></li>)}</ol>
      : <div className="op-big"><span>{ceremonyLabel[step]}</span><strong className="op-team-name">{(shown ?? []).map(teamName).join(' ／ ')}</strong></div>;
    bar = gate(f?.canAdvance, next, `${ceremonyLabel[step]}の演出中…`, () => void flow('advance'));
  } else if (state.scene === 'finished') {
    body = <div className="op-big"><span>大会終了 · 優勝</span><strong className="op-team-name">{teamName(f?.championTeamId)}</strong></div>;
    bar = <ActionBar>
      {state.official
        ? <ArmedButton label="受付からやり直す" armedLabel="もう一度押すと受付に戻す" disabled={busy} onFire={() => void send('/api/tournament/reopen', {})} />
        : <ArmedButton label="最初からやり直す" armedLabel="もう一度押すと最初に戻す" disabled={busy} onFire={() => void send('/api/tournament/replay', {})} />}
      <a className="button op-secondary" href="/start">大会を選ぶ</a>
    </ActionBar>;
  }
  const replayable = !!state.session && state.scene !== 'idle' && state.scene !== 'finished' && !state.official;
  const showRestart = !!state.official && state.scene !== 'finished' && (state.checkinStatus === 'closed' || state.scene !== 'idle');

  return <section className="op" data-op-scene={state.scene}>
    <p className="op-event">{[state.title, formatLabel(state.format)].filter(Boolean).join(' · ')}</p>
    <header className="op-head">
      <span className="op-phase">{phase(state)}</span>
      <span className="op-meta">{state.participants.length}名{state.teams.length ? ` · ${state.teams.length}組` : ''}{f?.completedMatches ? ` · ${f.completedMatches}試合済` : ''}</span>
    </header>
    {showRestart && <ArmedButton className="op-restart" label="受付からやり直す" armedLabel="もう一度押すと受付に戻す" disabled={busy} onFire={() => void send('/api/tournament/reopen', {})} />}
    <div className="op-body">{body}</div>
    {(failure || error) && <div className="op-error" role="alert"><p>{failure || error}</p>{pending.current && !busy ? <button onClick={() => void send(pending.current!.path, {})}>同じ操作を再試行</button> : <button onClick={refresh}>更新</button>}</div>}
    <details className="op-more"><summary>その他</summary>
      <a className="button" href={scopedUrl('/display')} target="_blank" rel="noreferrer">会場モニターを開く</a>
      <a className="button" href={scopedUrl('/checkin')}>受付を開く</a>
      <a className="button" href={scopedUrl('/rehearsal')}>演出の確認</a>
      {replayable && <ArmedButton className="op-secondary" label="最初からやり直す（結果は消えます）" armedLabel="もう一度押すと最初に戻す" disabled={busy} onFire={() => void send('/api/tournament/replay', {})} />}
    </details>
    {bar}
  </section>;
}
