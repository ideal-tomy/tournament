import { bracketThemeCssVars, roundBannerText, themeForKey } from '../../../styles/bracketTheme';
import type { BracketThemeKey } from '../../../types';

interface VsCardSceneProps {
  teamALabel: string;
  teamBLabel: string;
  teamAFaces: string[];
  teamBFaces: string[];
  bracketKey: BracketThemeKey;
  round: number;
  awaitingOperator: boolean;
  restoreCompleted?: boolean;
}

export default function VsCardScene({
  teamALabel,
  teamBLabel,
  teamAFaces,
  teamBFaces,
  bracketKey,
  round,
  awaitingOperator,
}: VsCardSceneProps) {
  const theme = themeForKey(bracketKey);
  const vars = bracketThemeCssVars(bracketKey);

  return (
    <div
      className="relative flex h-full min-h-[60vh] flex-col items-center justify-center gap-8 px-8"
      style={{ ...vars, background: theme.fill }}
    >
      <div
        className="rounded px-6 py-2 text-sm font-black tracking-[0.3em]"
        style={{
          color: theme.labelColor,
          border:
            theme.frame === 'dashed'
              ? `2px dashed ${theme.accent}`
              : theme.frame === 'double'
                ? `4px double ${theme.accent}`
                : `2px solid ${theme.accent}`,
        }}
      >
        {roundBannerText(bracketKey, round)}
      </div>

      <div className="flex w-full max-w-5xl items-center justify-center gap-6">
        <TeamBlock label={teamALabel} faces={teamAFaces} accent={theme.accent} />
        <div className="text-5xl font-black text-white/90">VS</div>
        <TeamBlock label={teamBLabel} faces={teamBFaces} accent={theme.accent} />
      </div>

      {awaitingOperator && (
        <div className="absolute bottom-4 right-4 rounded bg-black/50 px-3 py-1 text-xs text-amber-200">
          操作待ち
        </div>
      )}
    </div>
  );
}

function TeamBlock({
  label,
  faces,
  accent,
}: {
  label: string;
  faces: string[];
  accent: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-3">
      <div className="flex gap-2">
        {faces.length > 0 ? (
          faces.map((url) => (
            <img
              key={url}
              src={url}
              alt=""
              className="h-28 w-28 rounded-lg object-cover"
              style={{ boxShadow: `0 0 24px ${accent}66` }}
            />
          ))
        ) : (
          <div
            className="flex h-28 w-28 items-center justify-center rounded-lg bg-slate-800 text-slate-400"
            style={{ boxShadow: `0 0 24px ${accent}66` }}
          >
            ?
          </div>
        )}
      </div>
      <p className="text-center text-xl font-bold text-white">{label}</p>
    </div>
  );
}
