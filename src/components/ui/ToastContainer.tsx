import React from 'react';
import { CheckCircle2, Info, RotateCcw, TriangleAlert, X } from 'lucide-react';
import { useTaskStore } from '../../store/useTaskStore';
import { cn } from '../../lib/utils';

export const ToastContainer: React.FC = () => {
  const toasts = useTaskStore((s) => s.toasts);
  const dismissToast = useTaskStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const isSuccess = toast.variant === 'success';
        const isDanger = toast.variant === 'danger';
        const isWarning = toast.variant === 'warning';

        return (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto flex items-start justify-between gap-3 p-3.5 rounded-[12px] border bg-[var(--surface)] shadow-sm transition-all duration-150',
              isSuccess && 'border-[var(--sage-border)]',
              isDanger && 'border-[var(--rose-border)]',
              isWarning && 'border-[var(--butter-border)]',
              !isSuccess && !isDanger && !isWarning && 'border-[var(--border-strong)]'
            )}
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <span
                className={cn(
                  'w-6 h-6 rounded-[6px] flex items-center justify-center shrink-0 mt-0.5',
                  isSuccess && 'bg-[var(--sage)] text-[var(--sage-ink)]',
                  isDanger && 'bg-[var(--rose)] text-[var(--rose-ink)]',
                  isWarning && 'bg-[var(--butter)] text-[var(--butter-ink)]',
                  !isSuccess &&
                    !isDanger &&
                    !isWarning &&
                    'bg-[var(--surface-muted)] text-[var(--ink)]'
                )}
              >
                {isSuccess ? (
                  <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                ) : isDanger || isWarning ? (
                  <TriangleAlert className="w-3.5 h-3.5" strokeWidth={1.5} />
                ) : (
                  <Info className="w-3.5 h-3.5" strokeWidth={1.5} />
                )}
              </span>

              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-[var(--ink)]">
                  {toast.title}
                </p>
                {toast.description && (
                  <p className="text-xs text-[var(--muted-text)] mt-0.5 leading-snug">
                    {toast.description}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {toast.undoAction && (
                <button
                  type="button"
                  onClick={() => {
                    toast.undoAction?.();
                    dismissToast(toast.id);
                  }}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-[6px] bg-[var(--surface-muted)] text-[var(--ink)] hover:bg-[var(--border)] transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" strokeWidth={1.5} />
                  Undo
                </button>
              )}
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="p-1 text-[var(--muted-text)] hover:text-[var(--ink)] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
