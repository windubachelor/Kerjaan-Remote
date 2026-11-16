import React from 'react';
import { cn } from '../../lib/utils';

interface EmptyStateProps {
  title: string;
  description: string;
  illustration?: 'ledger' | 'variations' | 'search' | 'qa';
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  illustration = 'ledger',
  actionLabel,
  onAction,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center py-12 px-6 bg-[var(--surface)] border border-[var(--border)] rounded-[12px]',
        className
      )}
    >
      <div className="mb-4">
        {illustration === 'ledger' && (
          <svg
            width="88"
            height="72"
            viewBox="0 0 88 72"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <rect
              x="14"
              y="10"
              width="60"
              height="52"
              rx="6"
              fill="#F3EFE9"
              stroke="#26231F"
              strokeWidth="1.5"
            />
            <rect
              x="22"
              y="18"
              width="24"
              height="14"
              rx="3"
              fill="#CFE3D4"
              stroke="#26231F"
              strokeWidth="1.2"
            />
            <rect
              x="50"
              y="18"
              width="16"
              height="14"
              rx="3"
              fill="#F6EBB8"
              stroke="#26231F"
              strokeWidth="1.2"
            />
            <line
              x1="22"
              y1="40"
              x2="66"
              y2="40"
              stroke="#26231F"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            <line
              x1="22"
              y1="48"
              x2="52"
              y2="48"
              stroke="#7A736A"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            <circle
              cx="66"
              cy="52"
              r="10"
              fill="#DAD3F0"
              stroke="#26231F"
              strokeWidth="1.5"
            />
          </svg>
        )}

        {illustration === 'search' && (
          <svg
            width="88"
            height="72"
            viewBox="0 0 88 72"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <rect
              x="12"
              y="14"
              width="52"
              height="44"
              rx="6"
              fill="#CFE2F3"
              stroke="#26231F"
              strokeWidth="1.5"
            />
            <circle
              cx="54"
              cy="40"
              r="14"
              fill="#F6EBB8"
              stroke="#26231F"
              strokeWidth="1.5"
            />
            <line
              x1="64"
              y1="50"
              x2="74"
              y2="60"
              stroke="#26231F"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        )}

        {illustration === 'qa' && (
          <svg
            width="88"
            height="72"
            viewBox="0 0 88 72"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <rect
              x="16"
              y="12"
              width="56"
              height="48"
              rx="6"
              fill="#DAD3F0"
              stroke="#26231F"
              strokeWidth="1.5"
            />
            <path
              d="M32 36L40 44L56 28"
              stroke="#26231F"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle
              cx="66"
              cy="18"
              r="8"
              fill="#CFE3D4"
              stroke="#26231F"
              strokeWidth="1.5"
            />
          </svg>
        )}

        {illustration === 'variations' && (
          <svg
            width="88"
            height="72"
            viewBox="0 0 88 72"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <rect
              x="14"
              y="16"
              width="26"
              height="36"
              rx="4"
              fill="#F7D9C4"
              stroke="#26231F"
              strokeWidth="1.5"
            />
            <rect
              x="32"
              y="12"
              width="26"
              height="36"
              rx="4"
              fill="#CFE2F3"
              stroke="#26231F"
              strokeWidth="1.5"
            />
            <rect
              x="48"
              y="20"
              width="26"
              height="36"
              rx="4"
              fill="#CFE3D4"
              stroke="#26231F"
              strokeWidth="1.5"
            />
          </svg>
        )}
      </div>

      <h3 className="font-display text-base font-semibold text-[var(--ink)] mb-1">
        {title}
      </h3>
      <p className="text-[13px] text-[var(--muted-text)] max-w-md mb-4">
        {description}
      </p>

      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="px-4 py-2 text-xs font-medium rounded-[8px] bg-[var(--ink)] text-[var(--background)] hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
