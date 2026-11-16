import React from 'react';
import { cn, formatScore } from '../../lib/utils';

interface ScoreChipProps {
  score: number | null | undefined;
  prefix?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Score chips: color-coded by score range
 * - below 3.0: rose
 * - 3.0 to 3.9: butter
 * - 4.0 and above: sage
 */
export const ScoreChip: React.FC<ScoreChipProps> = ({
  score,
  prefix,
  size = 'sm',
  className,
}) => {
  if (score === null || score === undefined || Number.isNaN(score)) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 font-mono-num tabular-nums rounded-[8px] border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--muted-text)] whitespace-nowrap shrink-0',
          size === 'sm' && 'px-2 py-0.5 text-xs',
          size === 'md' && 'px-2.5 py-1 text-[13px]',
          size === 'lg' && 'px-3 py-1 text-sm',
          className
        )}
      >
        {prefix && <span className="font-sans-ui font-normal opacity-75">{prefix}</span>}
        <span>—</span>
      </span>
    );
  }

  let paletteClass = 'bg-[var(--sage)] text-[var(--sage-ink)] border-[var(--sage-border)]';
  if (score < 3.0) {
    paletteClass = 'bg-[var(--rose)] text-[var(--rose-ink)] border-[var(--rose-border)]';
  } else if (score < 4.0) {
    paletteClass = 'bg-[var(--butter)] text-[var(--butter-ink)] border-[var(--butter-border)]';
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-mono-num font-semibold tabular-nums rounded-[8px] border whitespace-nowrap shrink-0',
        size === 'sm' && 'px-2 py-0.5 text-xs',
        size === 'md' && 'px-2.5 py-1 text-[13px]',
        size === 'lg' && 'px-3 py-1 text-sm',
        paletteClass,
        className
      )}
    >
      {prefix && (
        <span className="font-sans-ui font-medium text-[11px] opacity-80">{prefix}</span>
      )}
      <span>{formatScore(score)}</span>
    </span>
  );
};
