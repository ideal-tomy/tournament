import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import type { PresentationMode } from '../../../types';
import placeholder from '../../../assets/placeholder_face.svg';
import { postMatchTiming } from './timing';
import './postMatch.css';

export interface StageControls {
  play(): void;
  pause(): void;
  seek(time: number): void;
  skip(): void;
}

interface Props {
  mode: PresentationMode;
  onProgress(time: number, playing: boolean): void;
  winnerTeam?: { name: string; members: string[]; faces: string[] };
  opponentTeam?: { name: string; members: string[]; faces: string[] };
}

/** Sample-only stage. No event IDs, API imports, or persistent scene transitions. */
const PostMatchStage = forwardRef<StageControls, Props>(function PostMatchStage({ mode, onProgress, winnerTeam, opponentTeam }, ref) {
  const root = useRef<HTMLDivElement>(null);
  const timeline = useRef<gsap.core.Timeline>();
  useImperativeHandle(ref, () => ({
    play() { const tl = timeline.current; if (tl) { tl.play(); onProgress(tl.time(), tl.time() < tl.duration()); } },
    pause() { const tl = timeline.current; if (tl) { tl.pause(); onProgress(tl.time(), false); } },
    seek(time) { const tl = timeline.current; if (tl) { tl.pause().seek(time, true); onProgress(tl.time(), false); } },
    skip() { const tl = timeline.current; if (tl) { tl.pause().seek(tl.duration(), true); onProgress(tl.time(), false); } },
  }), [onProgress]);

  useLayoutEffect(() => {
    const t = postMatchTiming(mode);
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ paused: true, onUpdate: () => onProgress(tl.time(), !tl.paused() && tl.time() < tl.duration()) });
      timeline.current = tl;
      tl.set('.pm-opponent, .pm-bracket, .pm-vs, .pm-next, .pm-impact', { autoAlpha: 0 })
        .set('.pm-line', { strokeDashoffset: 1 })
        .set('.pm-winner', { xPercent: -50, yPercent: -50, left: '50%', top: '52%' })
        .set('.pm-opponent', { xPercent: -50, yPercent: -50, left: '86%', top: '52%' })
        .fromTo('.pm-winner', { scale: 0.9 }, { scale: 1.08, duration: 0.7 }, 0)
        .to('.pm-bracket', { autoAlpha: 1, duration: 0.5 }, t.advance)
        .to('.pm-win', { autoAlpha: 0, duration: 0.4 }, t.advance)
        .to('.pm-winner', { left: '22%', top: '52%', scale: 0.65, duration: 0.6 }, t.advance)
        .to('.pm-line', { strokeDashoffset: 0, duration: t.approach - t.advance - 0.6, ease: 'none' }, t.advance + 0.6)
        .to('.pm-winner', { left: '35%', scale: 1, duration: t.impact - t.approach, ease: 'power2.inOut' }, t.approach)
        .to('.pm-opponent', { autoAlpha: 1, left: '65%', duration: t.impact - t.approach, ease: 'power2.inOut' }, t.approach)
        .to('.pm-bracket', { autoAlpha: 0.18, duration: 0.4 }, t.approach);
      if (mode !== 'lite') {
        tl.fromTo('.pm-impact', { autoAlpha: 0, scale: 0.2 }, { autoAlpha: 0.7, scale: 1, duration: 0.12 }, t.impact)
          .to('.pm-impact', { autoAlpha: 0, scale: 1.3, duration: 0.5 }, t.impact + 0.12);
      }
      tl.fromTo('.pm-vs', { autoAlpha: 0, scale: 0.7 }, { autoAlpha: 1, scale: 1, duration: 0.4 }, t.impact + 0.12)
        .to('.pm-next', { autoAlpha: 1, duration: 0.4 }, t.impact + 0.5)
        .to({}, { duration: t.hold }, 0);
      onProgress(0, false);
    }, root);
    return () => { ctx.revert(); timeline.current = undefined; };
  }, [mode, onProgress]);

  const leftName = winnerTeam?.name ?? 'BLUE ARROWS';
  const rightName = opponentTeam?.name ?? 'GOLD STARS';
  return <div ref={root} className="pm-stage" aria-label={`${leftName}の勝利から次試合への連続演出`}>
    <div className="pm-title">DARTS TOURNAMENT <span>サンプル大会</span></div>
    <div className="pm-win">WINNER <small>{leftName} 勝利</small></div>
    <svg className="pm-bracket" viewBox="0 0 1600 900" aria-label="勝者が決勝へ進出">
      <path d="M180 320 H350 V470 H800 M180 620 H350 V470 M1420 320 H1250 V470 H800 M1420 620 H1250 V470" fill="none" stroke="#334155" strokeWidth="4" />
      <path className="pm-line" pathLength="1" strokeDasharray="1" d="M350 470 H800" fill="none" stroke="#fbbf24" strokeWidth="8" />
      <text x="700" y="390" fill="#fbbf24" fontSize="28">{winnerTeam ? 'ADVANCE' : 'FINAL'}</text>
    </svg>
    <Team className="pm-winner" name={leftName} members={winnerTeam?.members ?? ['青木 翔', '佐藤 蓮']} faces={winnerTeam?.faces} />
    <Team className="pm-opponent" name={rightName} members={opponentTeam?.members ?? ['高橋 凛', '田中 光']} faces={opponentTeam?.faces} />
    <div className="pm-impact" />
    <div className="pm-vs">VS</div>
    <div className="pm-next">NEXT MATCH <small>{leftName} vs {rightName}</small></div>
  </div>;
});

function Team({ className, name, members, faces }: { className: string; name: string; members: string[]; faces?: string[] }) {
  return <div className={`pm-team ${className}`}>
    <div className="pm-faces">{members.map((member, index) => <div key={`${member}-${index}`}><img src={faces?.[index] ?? placeholder} alt={member} /><p>{member}</p></div>)}</div>
    <h2>{name}</h2>
  </div>;
}

export default PostMatchStage;
