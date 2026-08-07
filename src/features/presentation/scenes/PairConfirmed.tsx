import { TOURNAMENT_EFFECTS as FX } from '../../../lib/tournamentEffects';
import type { DrawRevealParticipant } from '../../draw/drawApi';

interface PairConfirmedProps {
  teamNumber: number;
  members: DrawRevealParticipant[];
}

export default function PairConfirmed({ teamNumber, members }: PairConfirmedProps) {
  const isPair = members.length === 2;

  return (
    <section className="draw-pair-stage invisible pointer-events-none absolute inset-0 z-40 flex items-center justify-center px-8">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px]" />
      <img
        src={FX.effects.goldenSparks}
        alt=""
        className="absolute left-1/2 top-1/2 h-[72vh] w-[72vh] -translate-x-1/2 -translate-y-1/2 object-contain opacity-25"
      />

      <div className="relative flex w-full max-w-6xl flex-col items-center">
        <p className="text-sm font-black tracking-[0.5em] text-amber-300">
          TEAM {String(teamNumber).padStart(2, '0')}
        </p>
        <h2 className="mt-2 text-4xl font-black tracking-[0.18em] text-white drop-shadow-[0_0_24px_rgba(251,191,36,.75)] md:text-5xl">
          {isPair ? 'PAIR CONFIRMED' : 'TEAM CONFIRMED'}
        </h2>

        <div className={`mt-8 grid w-full items-center justify-center gap-5 ${members.length >= 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {members.map((member) => (
            <div
              key={member.id}
              className="relative mx-auto aspect-[2/3] h-[min(50vh,470px)] max-w-full overflow-hidden rounded-2xl"
            >
              <img src={FX.cards.front} alt="" className="absolute inset-0 h-full w-full object-contain" />
              <div className="absolute inset-[14%_13%_22%] flex items-center justify-center">
                {member.faceUrl ? (
                  <img
                    src={member.faceUrl}
                    alt={member.displayName}
                    className="h-full w-full rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-xl bg-slate-800 text-5xl text-slate-400">
                    ?
                  </div>
                )}
              </div>
              <div className="absolute bottom-[8%] left-[14%] right-[14%]">
                <img
                  src={FX.frames.nameplate}
                  alt=""
                  className="absolute inset-0 h-full w-full object-fill opacity-85"
                />
                <p className="relative truncate px-4 py-3 text-center text-lg font-black text-white drop-shadow-lg md:text-xl">
                  {member.displayName}
                </p>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-5 text-sm font-bold tracking-[0.3em] text-cyan-100/85">
          NEXT DRAW COMING UP
        </p>
      </div>
    </section>
  );
}
