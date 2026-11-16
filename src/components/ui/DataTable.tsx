import React from 'react';
import {
  ExternalLink,
  Play,
  RotateCcw,
  Send,
  Slash,
  Square,
} from 'lucide-react';
import { AppSettings, Task } from '../../types';
import {
  cn,
  formatMinutes,
  formatShortDate,
  getDeadlineUrgency,
} from '../../lib/utils';
import { StatusBadge } from './StatusBadge';
import { DifficultyTag } from './DifficultyTag';
import { ScoreChip } from './ScoreChip';
import { PaidToggleSwitch } from './PaidToggleSwitch';

interface DataTableProps {
  tasks: Task[];
  settings: AppSettings;
  activeTimerTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  onClaimTask: (taskId: string) => void;
  onSkipTask: (taskId: string) => void;
  onRestoreTask: (taskId: string) => void;
  onSubmitTask: (taskId: string) => void;
  onToggleTimer: (taskId: string) => void;
  onTogglePaid?: (taskId: string, paid: boolean) => void;
}

export const DataTable: React.FC<DataTableProps> = ({
  tasks,
  settings,
  activeTimerTaskId,
  onSelectTask,
  onClaimTask,
  onSkipTask,
  onRestoreTask,
  onSubmitTask,
  onToggleTimer,
  onTogglePaid,
}) => {
  return (
    <div className="space-y-3">
      {/* Mobile Card List (< md) for full responsiveness */}
      <div className="md:hidden space-y-2.5">
        {tasks.map((task) => {
          const filledCount = task.variations.filter((v) => v.filled).length;
          const totalSlots = task.variations.length;
          const isAllFilled = filledCount === totalSlots;
          const isTimerRunning = activeTimerTaskId === task.id;
          const urgency = getDeadlineUrgency(task.deadline, task.status);

          return (
            <div
              key={task.id}
              onClick={() => onSelectTask(task.id)}
              className={cn(
                'p-3.5 rounded-[12px] border border-[var(--border)] bg-[var(--surface)] space-y-2.5 cursor-pointer transition-colors',
                task.status === 'Revision' && 'border-[var(--rose-border)] bg-[var(--rose)]/15'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                  <span className="font-mono-num text-xs font-bold px-1.5 py-0.5 rounded bg-[var(--surface-muted)] text-[var(--ink)] border border-[var(--border)]">
                    {task.code}
                  </span>
                  <StatusBadge
                    status={task.status}
                    revisionCount={task.revisionCount}
                    clientRevision={task.clientRevision}
                    isPaid={task.isPaid}
                  />
                  <DifficultyTag
                    difficulty={task.difficulty}
                    rate={settings.rates[task.difficulty]}
                  />
                </div>
                <span className="font-mono-num text-xs text-[var(--muted-text)] shrink-0">
                  {formatMinutes(task.timeSpentMinutes)}
                </span>
              </div>

              <div>
                <h4 className="font-medium text-sm text-[var(--ink)] leading-snug">
                  {task.title}
                </h4>
                <p className="text-xs text-[var(--muted-text)] mt-0.5">
                  {task.batchName} ·{' '}
                  <span
                    className={cn(
                      urgency.isOverdue
                        ? 'text-[var(--rose-ink)] font-semibold'
                        : urgency.isUrgent
                        ? 'text-[var(--butter-ink)] font-medium'
                        : ''
                    )}
                  >
                    {task.deadline ? urgency.label : formatShortDate(task.claimedAt)}
                  </span>
                </p>
              </div>

              {task.status === 'Revision' && task.latestFeedback && (
                <div className="flex items-center gap-1.5 text-xs text-[var(--rose-ink)] bg-[var(--rose)]/30 px-2.5 py-1.5 rounded-[8px] border border-[var(--rose-border)]">
                  <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                  <span className="line-clamp-2">{task.latestFeedback}</span>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5">
                    {task.variations.map((v) => (
                      <span
                        key={v.slotNumber}
                        className={cn(
                          'w-1.5 h-3 rounded-[2px] border',
                          v.filled
                            ? 'bg-[var(--sage-ink)] border-[var(--sage-ink)]'
                            : 'bg-[var(--surface-muted)] border-[var(--border-strong)]'
                        )}
                      />
                    ))}
                  </div>
                  <span className="font-mono-num text-xs font-semibold text-[var(--ink)]">
                    {filledCount}/{totalSlots}
                  </span>
                </div>

                <div
                  className="flex flex-wrap items-center justify-end gap-1.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  {onTogglePaid && (
                    <PaidToggleSwitch
                      task={task}
                      onTogglePaid={onTogglePaid}
                      compact
                    />
                  )}
                  {task.status === 'Available' && (
                    <button
                      type="button"
                      onClick={() => onClaimTask(task.id)}
                      className="px-2.5 py-1 text-xs font-semibold rounded-[8px] bg-[var(--ink)] text-[var(--background)] cursor-pointer"
                    >
                      Claim
                    </button>
                  )}
                  {(task.status === 'In Progress' || task.status === 'Revision') && (
                    <>
                      <button
                        type="button"
                        onClick={() => onToggleTimer(task.id)}
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-[8px] border cursor-pointer',
                          isTimerRunning
                            ? 'bg-[var(--rose)] text-[var(--rose-ink)] border-[var(--rose-border)]'
                            : 'bg-[var(--surface)] text-[var(--ink)] border-[var(--border)]'
                        )}
                      >
                        {isTimerRunning ? (
                          <>
                            <Square className="w-3 h-3" />
                            <span>Stop</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3" />
                            <span>Timer</span>
                          </>
                        )}
                      </button>
                      {isAllFilled && (
                        <button
                          type="button"
                          onClick={() => onSubmitTask(task.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-[8px] bg-[var(--sage)] text-[var(--sage-ink)] border border-[var(--sage-border)] cursor-pointer"
                        >
                          <Send className="w-3 h-3" />
                          <span>Submit</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Table (md and up) */}
      <div className="hidden md:block bg-[var(--surface)] border border-[var(--border)] rounded-[12px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]/60 text-[12px] font-medium text-[var(--muted-text)]">
                <th className="py-2.5 pl-4 pr-3 font-medium whitespace-nowrap">Task</th>
                <th className="py-2.5 px-3 font-medium whitespace-nowrap">
                  Batch · Difficulty
                </th>
                <th className="py-2.5 px-3 font-medium whitespace-nowrap">Status</th>
                <th className="py-2.5 px-3 font-medium whitespace-nowrap">
                  10 Variations
                </th>
                <th className="py-2.5 px-3 font-medium text-right whitespace-nowrap">
                  QA LLM
                </th>
                <th className="py-2.5 px-3 font-medium text-right whitespace-nowrap">
                  QA Human
                </th>
                <th className="py-2.5 px-3 font-medium text-right whitespace-nowrap">
                  Time
                </th>
                <th className="py-2.5 px-3 font-medium whitespace-nowrap">Deadline</th>
                <th className="py-2.5 pl-3 pr-4 font-medium text-right whitespace-nowrap">
                  Paid / Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] text-[13px]">
              {tasks.map((task) => {
                const filledCount = task.variations.filter((v) => v.filled).length;
                const totalSlots = task.variations.length;
                const isAllFilled = filledCount === totalSlots;
                const isTimerRunning = activeTimerTaskId === task.id;
                const urgency = getDeadlineUrgency(task.deadline, task.status);

                return (
                  <tr
                    key={task.id}
                    onClick={() => onSelectTask(task.id)}
                    className={cn(
                      'group transition-colors duration-150 hover:bg-[var(--surface-muted)]/50 cursor-pointer',
                      task.status === 'Revision' && 'bg-[var(--rose)]/15'
                    )}
                  >
                    {/* Code + Title + Reviewer Feedback snippet */}
                    <td className="py-3 pl-4 pr-3 max-w-[300px]">
                      <div className="flex items-center gap-2">
                        <span className="font-mono-num text-xs font-medium text-[var(--muted-text)] shrink-0">
                          {task.code}
                        </span>
                        <span className="font-medium text-[var(--ink)] truncate group-hover:underline">
                          {task.title}
                        </span>
                      </div>
                      {task.status === 'Revision' && task.latestFeedback && (
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-[var(--rose-ink)] truncate">
                          <RotateCcw className="w-3 h-3 shrink-0" strokeWidth={1.5} />
                          <span className="truncate">{task.latestFeedback}</span>
                        </div>
                      )}
                    </td>

                    {/* Batch + Difficulty */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[var(--muted-text)]">
                          {task.batchName}
                        </span>
                        <DifficultyTag
                          difficulty={task.difficulty}
                          rate={settings.rates[task.difficulty]}
                        />
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <StatusBadge
                        status={task.status}
                        revisionCount={task.revisionCount}
                        clientRevision={task.clientRevision}
                        isPaid={task.isPaid}
                      />
                    </td>

                    {/* 10-Variation Tracker */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-0.5">
                          {task.variations.map((v) => (
                            <span
                              key={v.slotNumber}
                              className={cn(
                                'w-1.5 h-3.5 rounded-[2px] border',
                                v.filled
                                  ? 'bg-[var(--sage-ink)] border-[var(--sage-ink)]'
                                  : 'bg-[var(--surface-muted)] border-[var(--border-strong)]'
                              )}
                              title={`Slot ${v.slotNumber}: ${v.filled ? 'Filled' : 'Empty'}`}
                            />
                          ))}
                        </div>
                        <span className="font-mono-num text-xs text-[var(--muted-text)] tabular-nums">
                          {filledCount}/{totalSlots}
                        </span>
                      </div>
                    </td>

                    {/* QA LLM */}
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <ScoreChip score={task.qaLLM} />
                    </td>

                    {/* QA Human */}
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <ScoreChip score={task.qaHuman} />
                    </td>

                    {/* Time Spent */}
                    <td className="py-3 px-3 text-right font-mono-num text-xs tabular-nums whitespace-nowrap">
                      <span
                        className={cn(
                          isTimerRunning
                            ? 'text-[var(--butter-ink)] font-semibold bg-[var(--butter)] px-1.5 py-0.5 rounded-[6px]'
                            : 'text-[var(--ink)]'
                        )}
                      >
                        {formatMinutes(task.timeSpentMinutes)}
                      </span>
                    </td>

                    {/* Deadline */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={cn(
                          'text-xs font-mono-num tabular-nums',
                          urgency.isOverdue
                            ? 'text-[var(--rose-ink)] font-semibold'
                            : urgency.isUrgent
                            ? 'text-[var(--butter-ink)] font-medium'
                            : 'text-[var(--muted-text)]'
                        )}
                      >
                        {task.deadline ? urgency.label : formatShortDate(task.claimedAt)}
                      </span>
                    </td>

                    {/* Contextual Quick Actions + Paid Toggle */}
                    <td
                      className="py-3 pl-3 pr-4 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center justify-end gap-1.5">
                        {onTogglePaid && (
                          <PaidToggleSwitch
                            task={task}
                            onTogglePaid={onTogglePaid}
                            compact
                          />
                        )}

                        {task.status === 'Available' && (
                          <>
                            <button
                              type="button"
                              onClick={() => onClaimTask(task.id)}
                              className="px-2.5 py-1 text-xs font-medium rounded-[8px] bg-[var(--ink)] text-[var(--background)] hover:opacity-90 transition-opacity cursor-pointer whitespace-nowrap"
                            >
                              Claim
                            </button>
                            <button
                              type="button"
                              onClick={() => onSkipTask(task.id)}
                              className="p-1.5 rounded-[8px] border border-[var(--border)] text-[var(--muted-text)] hover:text-[var(--ink)] hover:bg-[var(--surface-muted)] transition-colors cursor-pointer"
                              title="Skip task"
                            >
                              <Slash className="w-3.5 h-3.5" strokeWidth={1.5} />
                            </button>
                          </>
                        )}

                        {task.status === 'Skipped' && (
                          <button
                            type="button"
                            onClick={() => onRestoreTask(task.id)}
                            className="px-2.5 py-1 text-xs font-medium rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-muted)] cursor-pointer whitespace-nowrap"
                          >
                            Restore
                          </button>
                        )}

                        {(task.status === 'In Progress' || task.status === 'Revision') && (
                          <>
                            <button
                              type="button"
                              onClick={() => onToggleTimer(task.id)}
                              className={cn(
                                'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-[8px] border transition-colors cursor-pointer whitespace-nowrap',
                                isTimerRunning
                                  ? 'bg-[var(--rose)] text-[var(--rose-ink)] border-[var(--rose-border)]'
                                  : 'bg-[var(--surface)] text-[var(--ink)] border-[var(--border)] hover:bg-[var(--surface-muted)]'
                              )}
                              title={isTimerRunning ? 'Stop timer' : 'Start timer'}
                            >
                              {isTimerRunning ? (
                                <>
                                  <Square className="w-3 h-3" strokeWidth={1.5} />
                                  <span>Stop</span>
                                </>
                              ) : (
                                <>
                                  <Play className="w-3 h-3" strokeWidth={1.5} />
                                  <span>Timer</span>
                                </>
                              )}
                            </button>

                            {isAllFilled && (
                              <button
                                type="button"
                                onClick={() => onSubmitTask(task.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-[8px] bg-[var(--sage)] text-[var(--sage-ink)] border border-[var(--sage-border)] hover:opacity-90 cursor-pointer whitespace-nowrap"
                              >
                                <Send className="w-3 h-3" strokeWidth={1.5} />
                                <span>Submit</span>
                              </button>
                            )}
                          </>
                        )}

                        <button
                          type="button"
                          onClick={() => onSelectTask(task.id)}
                          className="p-1.5 rounded-[8px] border border-[var(--border)] text-[var(--muted-text)] hover:text-[var(--ink)] hover:bg-[var(--surface-muted)] transition-colors cursor-pointer"
                          title="Open task detail drawer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
