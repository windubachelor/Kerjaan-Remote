import React, { useEffect, useState } from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

interface StatCardProps {
  label: string;
  numericValue: number;
  formatValue?: (val: number) => string;
  suffix?: string;
  prefix?: string;
  sublabel?: string;
  icon?: LucideIcon;
  accentTone?: 'sage' | 'butter' | 'lavender' | 'sky' | 'peach' | 'rose' | 'neutral';
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  numericValue,
  formatValue,
  suffix = '',
  prefix = '',
  sublabel,
  icon: Icon,
  accentTone = 'neutral',
  className,
}) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let animationFrame: number;
    const duration = 350; // subtle count-up animation
    const startTime = performance.now();
    const startVal = 0;

    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(startVal + (numericValue - startVal) * eased);
      if (progress < 1) {
        animationFrame = requestAnimationFrame(step);
      } else {
        setDisplayValue(numericValue);
      }
    };

    animationFrame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrame);
  }, [numericValue]);

  const toneBadgeClasses: Record<NonNullable<StatCardProps['accentTone']>, string> = {
    sage: 'bg-[var(--sage)] text-[var(--sage-ink)]',
    butter: 'bg-[var(--butter)] text-[var(--butter-ink)]',
    lavender: 'bg-[var(--lavender)] text-[var(--lavender-ink)]',
    sky: 'bg-[var(--sky)] text-[var(--sky-ink)]',
    peach: 'bg-[var(--peach)] text-[var(--peach-ink)]',
    rose: 'bg-[var(--rose)] text-[var(--rose-ink)]',
    neutral: 'bg-[var(--surface-muted)] text-[var(--ink)]',
  };

  const formatted = formatValue
    ? formatValue(displayValue)
    : Number.isInteger(numericValue)
    ? Math.round(displayValue).toString()
    : displayValue.toFixed(1);

  return (
    <div
      className={cn(
        'bg-[var(--surface)] border border-[var(--border)] rounded-[12px] p-4 flex flex-col justify-between transition-colors duration-150 hover:border-[var(--border-strong)]',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[13px] font-medium text-[var(--muted-text)] truncate">
          {label}
        </span>
        {Icon && (
          <span
            className={cn(
              'w-7 h-7 rounded-[8px] flex items-center justify-center shrink-0',
              toneBadgeClasses[accentTone]
            )}
          >
            <Icon className="w-4 h-4" strokeWidth={1.5} />
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="font-display text-[28px] leading-tight font-semibold tracking-tight text-[var(--ink)] tabular-nums">
          {prefix}
          {formatted}
          {suffix}
        </span>
      </div>

      {sublabel && (
        <p className="mt-1.5 text-xs text-[var(--muted-text)] truncate">{sublabel}</p>
      )}
    </div>
  );
};
