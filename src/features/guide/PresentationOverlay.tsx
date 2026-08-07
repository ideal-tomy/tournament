import { useEffect, useLayoutEffect, useState } from 'react';
import type { PresentationStep } from './presentationSteps';

interface TargetRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export default function PresentationOverlay({ step }: { step: PresentationStep }) {
  const [rect, setRect] = useState<TargetRect | null>(null);

  useLayoutEffect(() => {
    const update = () => {
      const target = document.querySelector<HTMLElement>(`[data-guide="${step.target}"]`);
      if (!target) {
        setRect(null);
        return;
      }
      const next = target.getBoundingClientRect();
      setRect({ left: next.left, top: next.top, width: next.width, height: next.height });
    };
    const frame = window.requestAnimationFrame(update);
    window.addEventListener('resize', update);
    const observer = new ResizeObserver(update);
    const shell = document.querySelector<HTMLElement>('[data-guide-shell]');
    if (shell) observer.observe(shell);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', update);
      observer.disconnect();
    };
  }, [step.id, step.target]);

  useEffect(() => {
    const target = document.querySelector<HTMLElement>(`[data-guide="${step.target}"]`);
    target?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [step.id, step.target]);

  if (!rect) return null;
  const pad = 8;
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  return (
    <div className="pointer-events-none fixed inset-0 z-[80]" aria-hidden>
      <div
        className="guide-target-ring fixed rounded-xl"
        style={{
          left: rect.left - pad,
          top: rect.top - pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2,
        }}
      />
      <div
        key={step.id}
        className={`guide-cursor fixed ${step.action === 'click' ? 'guide-cursor-click' : ''}`}
        style={{ left: centerX, top: centerY }}
      >
        <span className="guide-cursor-ripple" />
      </div>
      <div
        className="guide-tooltip fixed max-w-64 rounded-lg border border-cyan-300/50 bg-slate-950/95 px-4 py-3 text-sm font-bold text-white shadow-2xl"
        style={tooltipPosition(rect, step.tooltipPlacement ?? 'bottom')}
      >
        {step.tooltip}
      </div>
    </div>
  );
}

function tooltipPosition(rect: TargetRect, placement: 'top' | 'bottom' | 'left' | 'right') {
  const margin = 18;
  if (placement === 'top') {
    return { left: Math.max(16, rect.left + rect.width / 2), top: Math.max(16, rect.top - margin), transform: 'translate(-50%, -100%)' };
  }
  if (placement === 'left') {
    return { left: Math.max(16, rect.left - margin), top: rect.top + rect.height / 2, transform: 'translate(-100%, -50%)' };
  }
  if (placement === 'right') {
    return { left: Math.min(window.innerWidth - 280, rect.left + rect.width + margin), top: rect.top + rect.height / 2, transform: 'translateY(-50%)' };
  }
  return { left: Math.max(16, rect.left + rect.width / 2), top: Math.min(window.innerHeight - 80, rect.top + rect.height + margin), transform: 'translateX(-50%)' };
}
