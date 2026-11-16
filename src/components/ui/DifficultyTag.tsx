import React from 'react';
import { Difficulty } from '../../types';
import { cn } from '../../lib/utils';

interface DifficultyTagProps {
  difficulty: Difficulty;
  rate?: number;
  className?: string;
}

export const DifficultyTag: React.FC<DifficultyTagProps> = ({
  difficulty,
  rate,
  className,
}) => {
  const styles: Record<Difficulty, string> = {
    Easy: 'bg-[var(--surface-muted)] text-[var(--ink)] border-[var(--border)]',
    Medium: 'bg-[var(--sky)]/60 text-[var(--sky-ink)] border-[var(--sky-border)]',
    Hard: 'bg-[var(--peach)] text-[var(--peach-ink)] border-[var(--peach-border)]',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-[8px] border whitespace-nowrap shrink-0',
        styles[difficulty],
        className
      )}
    >
      <span>{difficulty}</span>
      {rate !== undefined && (
        <span className="font-mono-num tabular-nums opacity-75">· ${rate}</span>
      )}
    </span>
  );
};
