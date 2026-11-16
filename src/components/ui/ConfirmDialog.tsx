import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fadeIn"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md bg-[var(--surface)] border border-[var(--border)] rounded-[12px] p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-[8px] bg-[var(--rose)] text-[var(--rose-ink)] flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4" strokeWidth={1.5} />
            </span>
            <h3 className="font-display text-base font-semibold text-[var(--ink)]">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded-[8px] text-[var(--muted-text)] hover:text-[var(--ink)] cursor-pointer"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <p className="text-[13px] text-[var(--muted-text)] leading-relaxed mb-6">
          {description}
        </p>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-medium rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-muted)] transition-colors cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onCancel();
            }}
            className={
              variant === 'danger'
                ? 'px-4 py-2 text-xs font-medium rounded-[8px] bg-[var(--rose)] text-[var(--rose-ink)] border border-[var(--rose-border)] hover:opacity-90 transition-opacity cursor-pointer'
                : 'px-4 py-2 text-xs font-medium rounded-[8px] bg-[var(--ink)] text-[var(--background)] hover:opacity-90 transition-opacity cursor-pointer'
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
