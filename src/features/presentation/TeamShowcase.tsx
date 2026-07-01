import placeholderFace from '../../assets/placeholder_face.svg';

export interface TeamShowcaseProps {
  label: string;
  faces: string[];
  accent: 'cyan' | 'rose' | 'gold';
  size?: 'md' | 'lg' | 'xl';
  className?: string;
  /** 顔写真のみ（枠・ラベルなし） */
  facesOnly?: boolean;
}

const ACCENT = {
  cyan: {
    border: 'border-cyan-400 shadow-cyan-500/50',
    glow: 'drop-shadow-[0_0_20px_rgba(34,211,238,0.7)]',
    text: 'text-cyan-200',
  },
  rose: {
    border: 'border-rose-400 shadow-rose-500/50',
    glow: 'drop-shadow-[0_0_20px_rgba(244,114,182,0.7)]',
    text: 'text-rose-200',
  },
  gold: {
    border: 'border-yellow-300 shadow-yellow-400/60',
    glow: 'drop-shadow-[0_0_24px_rgba(250,204,21,0.85)]',
    text: 'text-yellow-100',
  },
} as const;

const SIZE = {
  md: { face: 'w-20 h-20 md:w-24 md:h-24', label: 'text-xl md:text-2xl' },
  lg: { face: 'w-24 h-24 md:w-32 md:h-32', label: 'text-2xl md:text-4xl' },
  xl: { face: 'w-28 h-28 md:w-36 md:h-36', label: 'text-3xl md:text-5xl' },
} as const;

export default function TeamShowcase({
  label,
  faces,
  accent,
  size = 'lg',
  className = '',
  facesOnly = false,
}: TeamShowcaseProps) {
  const theme = ACCENT[accent];
  const dim = SIZE[size];
  const urls = faces.length > 0 ? faces : [placeholderFace];

  if (facesOnly) {
    return (
      <div className={`flex flex-col items-center ${className}`}>
        <div className={`flex flex-col gap-2 items-center ${theme.glow}`}>
          {urls.map((url) => (
            <img
              key={url}
              src={url}
              alt=""
              className={`${dim.face} rounded-xl object-cover shadow-2xl`}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      <div className={`flex gap-2 justify-center ${theme.glow}`}>
        {urls.map((url) => (
          <img
            key={url}
            src={url}
            alt=""
            className={`${dim.face} rounded-xl object-cover border-[3px] ${theme.border} shadow-2xl`}
          />
        ))}
      </div>
      <p
        className={`${dim.label} font-black text-center max-w-md leading-tight ${theme.text}`}
      >
        {label}
      </p>
    </div>
  );
}
