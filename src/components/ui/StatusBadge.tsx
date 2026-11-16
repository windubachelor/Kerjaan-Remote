import React from 'react';
import {
  BadgeCheck,
  CheckCircle2,
  Clock,
  Eye,
  Inbox,
  RotateCcw,
  Send,
  Slash,
} from 'lucide-react';
import { TaskStatus } from '../../types';
import { cn } from '../../lib/utils';

interface StatusBadgeProps {
  status: TaskStatus;
  revisionCount?: number;
  clientRevision?: boolean;
  isPaid?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  revisionCount = 0,
  clientRevision = false,
  isPaid = false,
  size = 'sm',
  className,
}) => {
  if (isPaid) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 font-semibold border rounded-[8px] whitespace-nowrap shrink-0 select-none bg-[var(--sage)] text-[var(--sage-ink)] border-[var(--sage-border)]',
          size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-[13px]',
          className
        )}
      >
        <BadgeCheck className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
        <span>Paid · Lunas</span>
      </span>
    );
  }

  const getConfig = (s: TaskStatus) => {
    switch (s) {
      case 'Available':
        return {
          bg: 'bg-[var(--sky)] text-[var(--sky-ink)] border-[var(--sky-border)]',
          icon: Inbox,
          label: 'Available',
        };
      case 'In Progress':
        return {
          bg: 'bg-[var(--butter)] text-[var(--butter-ink)] border-[var(--butter-border)]',
          icon: Clock,
          label: 'In Progress',
        };
      case 'Submitted':
        return {
          bg: 'bg-[var(--lavender)] text-[var(--lavender-ink)] border-[var(--lavender-border)]',
          icon: Send,
          label: 'Submitted',
        };
      case 'In QA':
        return {
          bg: 'bg-[var(--lavender)] text-[var(--lavender-ink)] border-[var(--lavender-border)]',
          icon: Eye,
          label: 'In QA',
        };
      case 'Revision':
        return {
          bg: 'bg-[var(--rose)] text-[var(--rose-ink)] border-[var(--rose-border)]',
          icon: RotateCcw,
          label: clientRevision
            ? 'Revisi Klien'
            : revisionCount > 1
            ? `Revision #${revisionCount}`
            : 'Revision',
        };
      case 'Reviewed':
        return {
          bg: 'bg-[var(--sage)] text-[var(--sage-ink)] border-[var(--sage-border)]',
          icon: CheckCircle2,
          label: 'Reviewed',
        };
      case 'Skipped':
      default:
        return {
          bg: 'bg-[var(--surface-muted)] text-[var(--muted-text)] border-[var(--border)]',
          icon: Slash,
          label: 'Skipped',
        };
    }
  };

  const config = getConfig(status);
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium border rounded-[8px] whitespace-nowrap shrink-0 select-none',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-[13px]',
        config.bg,
        className
      )}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.8} />
      <span>{config.label}</span>
    </span>
  );
};
