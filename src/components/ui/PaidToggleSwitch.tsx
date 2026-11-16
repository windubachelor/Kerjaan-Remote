import React from 'react';
import { BadgeCheck, DollarSign, RotateCcw } from 'lucide-react';
import { Task } from '../../types';
import { cn } from '../../lib/utils';

interface PaidToggleSwitchProps {
  task: Task;
  onTogglePaid: (taskId: string, nextPaid: boolean) => void;
  compact?: boolean;
}

/**
 * Only renders when the task has reached 'Reviewed', is currently 'isPaid',
 * or was returned from Paid into 'clientRevision'.
 */
export const PaidToggleSwitch: React.FC<PaidToggleSwitchProps> = ({
  task,
  onTogglePaid,
  compact = false,
}) => {
  const isEligible =
    task.status === 'Reviewed' ||
    Boolean(task.isPaid) ||
    Boolean(task.clientRevision);

  if (!isEligible) return null;

  const isPaid = Boolean(task.isPaid);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isPaid}
      onClick={(e) => {
        e.stopPropagation();
        onTogglePaid(task.id, !isPaid);
      }}
      title={
        isPaid
          ? 'Sudah Dibayar (Paid). Klik untuk menonaktifkan & kembalikan ke Worksheet dengan status Revisi Klien.'
          : task.clientRevision
          ? 'Status Revisi Klien. Klik untuk mengaktifkan kembali & pindahkan ke halaman Paid.'
          : 'Task sudah Reviewed. Klik untuk tandai Paid (Sudah Dibayar) & pindahkan ke halaman Paid.'
      }
      className={cn(
        'inline-flex items-center gap-2 rounded-[8px] border font-semibold transition-all duration-150 cursor-pointer select-none whitespace-nowrap',
        compact ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-xs',
        isPaid
          ? 'bg-[var(--sage)] text-[var(--sage-ink)] border-[var(--sage-border)] hover:opacity-90'
          : task.clientRevision
          ? 'bg-[var(--rose)]/70 text-[var(--rose-ink)] border-[var(--rose-border)] hover:bg-[var(--rose)]'
          : 'bg-[var(--surface)] text-[var(--ink)] border-[var(--border-strong)] hover:bg-[var(--surface-muted)]'
      )}
    >
      {/* Switch Track */}
      <span
        className={cn(
          'relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors duration-150',
          isPaid
            ? 'bg-[var(--sage-ink)]'
            : task.clientRevision
            ? 'bg-[var(--rose-ink)]/60'
            : 'bg-[var(--border-strong)]'
        )}
      >
        <span
          className={cn(
            'inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-150 shadow-2xs',
            isPaid ? 'translate-x-3.5' : 'translate-x-0.5'
          )}
        />
      </span>

      <span className="inline-flex items-center gap-1">
        {isPaid ? (
          <>
            <BadgeCheck className="w-3.5 h-3.5 shrink-0" strokeWidth={2.2} />
            <span>Paid (Lunas)</span>
          </>
        ) : task.clientRevision ? (
          <>
            <RotateCcw className="w-3 h-3 shrink-0" strokeWidth={2.2} />
            <span>Revisi Klien → Paid</span>
          </>
        ) : (
          <>
            <DollarSign className="w-3 h-3 shrink-0" strokeWidth={2.2} />
            <span>Tandai Paid</span>
          </>
        )}
      </span>
    </button>
  );
};
