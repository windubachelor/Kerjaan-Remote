import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  BadgeCheck,
  Filter,
  Kanban,
  Plus,
  RotateCcw,
  Search,
  Table as TableIcon,
} from 'lucide-react';
import { useTaskStore } from '../../store/useTaskStore';
import { Difficulty, Task, TaskStatus } from '../../types';
import { cn, formatMinutes, getDeadlineUrgency } from '../../lib/utils';
import { DataTable } from '../../components/ui/DataTable';
import { DifficultyTag } from '../../components/ui/DifficultyTag';
import { ScoreChip } from '../../components/ui/ScoreChip';
import { PaidToggleSwitch } from '../../components/ui/PaidToggleSwitch';

type LifecycleTab = 'all' | 'available' | 'in-progress' | 'completed' | 'reviewed';

const KANBAN_COLUMNS: { status: TaskStatus; title: string; subtitle: string }[] = [
  { status: 'Available', title: 'Available', subtitle: 'Batch queue' },
  { status: 'In Progress', title: 'In Progress', subtitle: '10 variation slots' },
  { status: 'Revision', title: 'Revision', subtitle: 'QA / Klien feedback' },
  { status: 'Submitted', title: 'Submitted', subtitle: 'Uploaded to tool' },
  { status: 'In QA', title: 'In QA', subtitle: 'LLM → Human review' },
  { status: 'Reviewed', title: 'Reviewed', subtitle: 'Passed QA (Siap Paid)' },
];

const KanbanCard: React.FC<{
  task: Task;
  rate: number;
  onSelect: () => void;
  onTogglePaid: (taskId: string, nextPaid: boolean) => void;
}> = ({ task, rate, onSelect, onTogglePaid }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });

  const filled = task.variations.filter((v) => v.filled).length;
  const urgency = getDeadlineUrgency(task.deadline, task.status);

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onSelect}
      className={cn(
        'p-3 rounded-[12px] border bg-[var(--surface)] transition-shadow select-none cursor-grab active:cursor-grabbing space-y-2',
        task.status === 'Revision'
          ? 'border-[var(--rose-border)] bg-[var(--rose)]/20'
          : 'border-[var(--border)] hover:border-[var(--border-strong)]',
        isDragging && 'opacity-80 shadow-lg z-30'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono-num text-xs font-medium text-[var(--muted-text)]">
          {task.code}
        </span>
        <DifficultyTag difficulty={task.difficulty} rate={rate} />
      </div>

      <h4 className="text-[13px] font-medium text-[var(--ink)] leading-snug line-clamp-2">
        {task.title}
      </h4>

      {task.status === 'Revision' && task.latestFeedback && (
        <div className="p-2 rounded-[6px] bg-[var(--rose)]/60 border border-[var(--rose-border)] text-[11px] text-[var(--rose-ink)] line-clamp-2">
          <RotateCcw className="w-3 h-3 inline mr-1" />
          {task.clientRevision ? '[Revisi Klien] ' : ''}
          {task.latestFeedback}
        </div>
      )}

      {/* 10-Variation Mini Progress */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-0.5">
            {task.variations.map((v) => (
              <span
                key={v.slotNumber}
                className={cn(
                  'w-1.5 h-2.5 rounded-[1px]',
                  v.filled ? 'bg-[var(--sage-ink)]' : 'bg-[var(--border-strong)]'
                )}
              />
            ))}
          </div>
          <span className="font-mono-num text-[11px] text-[var(--muted-text)] ml-1">
            {filled}/{task.variations.length}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {task.qaLLM !== null && <ScoreChip score={task.qaLLM} prefix="L" />}
          {task.qaHuman !== null && <ScoreChip score={task.qaHuman} prefix="H" />}
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-[var(--muted-text)] pt-1 border-t border-[var(--border)]">
        <span className="truncate max-w-[120px]">{task.batchName}</span>
        <span
          className={cn(
            'font-mono-num',
            urgency.isOverdue
              ? 'text-[var(--rose-ink)] font-semibold'
              : urgency.isUrgent
              ? 'text-[var(--butter-ink)] font-medium'
              : ''
          )}
        >
          {task.timeSpentMinutes > 0
            ? formatMinutes(task.timeSpentMinutes)
            : urgency.label}
        </span>
      </div>

      {(task.status === 'Reviewed' || task.isPaid || task.clientRevision) && (
        <div
          className="pt-1.5 border-t border-[var(--border)] flex justify-end"
          onClick={(e) => e.stopPropagation()}
        >
          <PaidToggleSwitch
            task={task}
            onTogglePaid={onTogglePaid}
            compact
          />
        </div>
      )}
    </div>
  );
};

const KanbanColumn: React.FC<{
  status: TaskStatus;
  title: string;
  subtitle: string;
  tasks: Task[];
  rates: { Easy: number; Medium: number; Hard: number };
  onSelectTask: (id: string) => void;
  onTogglePaid: (id: string, paid: boolean) => void;
}> = ({ status, title, subtitle, tasks, rates, onSelectTask, onTogglePaid }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col rounded-[12px] border border-[var(--border)] bg-[var(--surface-muted)]/50 p-2.5 min-w-[265px] w-[265px] shrink-0 transition-colors',
        isOver && 'border-[var(--ink)] bg-[var(--surface-muted)]'
      )}
    >
      <div className="flex items-center justify-between px-1.5 pb-2.5 mb-2 border-b border-[var(--border)]">
        <div>
          <h3 className="font-display text-xs font-semibold text-[var(--ink)]">
            {title}
          </h3>
          <p className="text-[11px] text-[var(--muted-text)]">{subtitle}</p>
        </div>
        <span className="px-2 py-0.5 text-xs font-mono-num font-semibold rounded-[6px] bg-[var(--surface)] border border-[var(--border)] text-[var(--ink)]">
          {tasks.length}
        </span>
      </div>

      <div className="space-y-2.5 flex-1 min-h-[240px]">
        {tasks.map((t) => (
          <KanbanCard
            key={t.id}
            task={t}
            rate={rates[t.difficulty]}
            onSelect={() => onSelectTask(t.id)}
            onTogglePaid={onTogglePaid}
          />
        ))}
        {tasks.length === 0 && (
          <div className="h-28 rounded-[8px] border border-dashed border-[var(--border)] flex items-center justify-center text-xs text-[var(--muted-text)]">
            Drop task here
          </div>
        )}
      </div>
    </div>
  );
};

export const TasksPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as LifecycleTab) || 'all';

  const tasks = useTaskStore((s) => s.tasks);
  const settings = useTaskStore((s) => s.settings);
  const activeTimerTaskId = useTaskStore((s) => s.activeTimerTaskId);
  const selectTask = useTaskStore((s) => s.selectTask);
  const setAddModalOpen = useTaskStore((s) => s.setAddModalOpen);
  const claimTask = useTaskStore((s) => s.claimTask);
  const skipTask = useTaskStore((s) => s.skipTask);
  const restoreTaskToAvailable = useTaskStore((s) => s.restoreTaskToAvailable);
  const submitTaskVariations = useTaskStore((s) => s.submitTaskVariations);
  const moveTaskStatus = useTaskStore((s) => s.moveTaskStatus);
  const startTimer = useTaskStore((s) => s.startTimer);
  const stopTimer = useTaskStore((s) => s.stopTimer);
  const toggleTaskPaid = useTaskStore((s) => s.toggleTaskPaid);

  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty | 'ALL'>('ALL');
  const [batchFilter, setBatchFilter] = useState<string>('ALL');
  const [showSkipped, setShowSkipped] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  // Active board excludes tasks that have already been marked Paid (they live on /paid)
  const unpaidTasks = useMemo(
    () => tasks.filter((t) => !t.isPaid),
    [tasks]
  );

  const paidTasksCount = useMemo(
    () => tasks.filter((t) => Boolean(t.isPaid)).length,
    [tasks]
  );

  const batches = useMemo(() => {
    const set = new Set(unpaidTasks.map((t) => t.batchName));
    return Array.from(set).sort();
  }, [unpaidTasks]);

  const setTab = (tab: LifecycleTab) => {
    setSearchParams(tab === 'all' ? {} : { tab });
  };

  const filteredTasks = useMemo(() => {
    return unpaidTasks.filter((task) => {
      if (!showSkipped && task.status === 'Skipped') return false;

      if (initialTab === 'available' && task.status !== 'Available') return false;
      if (
        initialTab === 'in-progress' &&
        task.status !== 'In Progress' &&
        task.status !== 'Revision'
      ) {
        return false;
      }
      if (
        initialTab === 'completed' &&
        task.status !== 'Submitted' &&
        task.status !== 'In QA' &&
        task.status !== 'Reviewed'
      ) {
        return false;
      }
      if (initialTab === 'reviewed' && task.status !== 'Reviewed') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = task.title.toLowerCase().includes(q);
        const matchCode = task.code.toLowerCase().includes(q);
        const matchBatch = task.batchName.toLowerCase().includes(q);
        const matchNotes = task.notes.toLowerCase().includes(q);
        if (!matchTitle && !matchCode && !matchBatch && !matchNotes) return false;
      }

      if (difficultyFilter !== 'ALL' && task.difficulty !== difficultyFilter) {
        return false;
      }

      if (batchFilter !== 'ALL' && task.batchName !== batchFilter) {
        return false;
      }

      return true;
    });
  }, [
    unpaidTasks,
    initialTab,
    searchQuery,
    difficultyFilter,
    batchFilter,
    showSkipped,
  ]);

  const tabCounts = useMemo(() => {
    const nonSkipped = unpaidTasks.filter((t) => t.status !== 'Skipped');
    return {
      all: nonSkipped.length,
      available: unpaidTasks.filter((t) => t.status === 'Available').length,
      'in-progress': unpaidTasks.filter(
        (t) => t.status === 'In Progress' || t.status === 'Revision'
      ).length,
      completed: unpaidTasks.filter(
        (t) =>
          t.status === 'Submitted' ||
          t.status === 'In QA' ||
          t.status === 'Reviewed'
      ).length,
      reviewed: unpaidTasks.filter((t) => t.status === 'Reviewed').length,
    };
  }, [unpaidTasks]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const taskId = String(active.id);
    const targetStatus = over.id as TaskStatus;
    moveTaskStatus(taskId, targetStatus);
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--ink)] tracking-tight">
            Tasks Board
          </h1>
          <p className="text-[13px] text-[var(--muted-text)]">
            Kelola 10 slot varian per task (01–08 ilustrasi & PSD, 09 Gambar Asli Task, 10 File .txt) dan aktifkan toggle <strong>Paid</strong> saat task sudah Reviewed.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {paidTasksCount > 0 && (
            <button
              type="button"
              onClick={() => navigate('/paid')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-[8px] bg-[var(--sage)] text-[var(--sage-ink)] border border-[var(--sage-border)] hover:opacity-90 cursor-pointer"
            >
              <BadgeCheck className="w-3.5 h-3.5" />
              <span>Halaman Paid ({paidTasksCount})</span>
            </button>
          )}

          {/* View Switcher: Table vs Kanban */}
          <div className="inline-flex items-center p-0.5 rounded-[8px] bg-[var(--surface-muted)] border border-[var(--border)]">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-[6px] transition-colors cursor-pointer',
                viewMode === 'table'
                  ? 'bg-[var(--surface)] text-[var(--ink)] shadow-2xs'
                  : 'text-[var(--muted-text)] hover:text-[var(--ink)]'
              )}
            >
              <TableIcon className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-[6px] transition-colors cursor-pointer',
                viewMode === 'kanban'
                  ? 'bg-[var(--surface)] text-[var(--ink)] shadow-2xs'
                  : 'text-[var(--muted-text)] hover:text-[var(--ink)]'
              )}
            >
              <Kanban className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Kanban</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-[8px] bg-[var(--ink)] text-[var(--background)] hover:opacity-90 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2} />
            <span>Add Task</span>
          </button>
        </div>
      </div>

      {/* Lifecycle Tabs & Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-2 border-b border-[var(--border)]">
        {/* Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0">
          {(
            [
              { id: 'all', label: 'All Tasks' },
              { id: 'available', label: 'Available' },
              { id: 'in-progress', label: 'In Progress & Revision' },
              { id: 'completed', label: 'Completed (Submitted / QA)' },
              { id: 'reviewed', label: 'Reviewed (Siap Paid)' },
            ] as { id: LifecycleTab; label: string }[]
          ).map((tab) => {
            const active = initialTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTab(tab.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs font-medium transition-colors whitespace-nowrap cursor-pointer',
                  active
                    ? 'bg-[var(--ink)] text-[var(--background)]'
                    : 'text-[var(--muted-text)] hover:text-[var(--ink)] hover:bg-[var(--surface-muted)]'
                )}
              >
                <span>{tab.label}</span>
                <span
                  className={cn(
                    'px-1.5 py-0.2 text-[10px] font-mono-num rounded-[4px]',
                    active
                      ? 'bg-white/20 text-[var(--background)]'
                      : 'bg-[var(--surface-muted)] text-[var(--muted-text)]'
                  )}
                >
                  {tabCounts[tab.id]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:flex-initial">
            <Search
              className="w-3.5 h-3.5 text-[var(--muted-text)] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              strokeWidth={1.5}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter title, code, batch..."
              className="w-full sm:w-52 pl-8 pr-3 py-1.5 text-xs rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--ink)]"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-[var(--muted-text)]" strokeWidth={1.5} />
            <select
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
              aria-label="Filter by batch"
              className="px-2.5 py-1.5 text-xs rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] cursor-pointer"
            >
              <option value="ALL">All Batches</option>
              {batches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>

            <select
              value={difficultyFilter}
              onChange={(e) =>
                setDifficultyFilter(e.target.value as Difficulty | 'ALL')
              }
              aria-label="Filter by difficulty"
              className="px-2.5 py-1.5 text-xs rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] cursor-pointer"
            >
              <option value="ALL">All Difficulties</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>

          <label className="inline-flex items-center gap-1.5 text-xs text-[var(--muted-text)] cursor-pointer select-none px-1">
            <input
              type="checkbox"
              checked={showSkipped}
              onChange={(e) => setShowSkipped(e.target.checked)}
              className="rounded border-[var(--border-strong)]"
            />
            <span>Show Skipped</span>
          </label>
        </div>
      </div>

      {/* Main Content: Table or Kanban */}
      {filteredTasks.length === 0 ? (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[12px] p-12 text-center">
          <p className="font-display text-base font-medium text-[var(--ink)]">
            Tidak ada task yang sesuai filter
          </p>
          <p className="text-xs text-[var(--muted-text)] mt-1 max-w-md mx-auto">
            Coba bersihkan pencarian atau tambahkan task baru. Jika task sudah ditandai <strong>Paid</strong>, task tersebut berada di halaman <strong>Paid Tasks</strong>.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setBatchFilter('ALL');
                setDifficultyFilter('ALL');
                setTab('all');
              }}
              className="px-3 py-1.5 text-xs font-medium rounded-[8px] border border-[var(--border)] text-[var(--ink)] hover:bg-[var(--surface-muted)] cursor-pointer"
            >
              Reset Filters
            </button>
            <button
              type="button"
              onClick={() => setAddModalOpen(true)}
              className="px-3.5 py-1.5 text-xs font-medium rounded-[8px] bg-[var(--ink)] text-[var(--background)] cursor-pointer"
            >
              Add New Task
            </button>
          </div>
        </div>
      ) : viewMode === 'table' ? (
        <DataTable
          tasks={filteredTasks}
          settings={settings}
          activeTimerTaskId={activeTimerTaskId}
          onSelectTask={(id) => selectTask(id)}
          onClaimTask={(id) => claimTask(id)}
          onSkipTask={(id) => skipTask(id)}
          onRestoreTask={(id) => restoreTaskToAvailable(id)}
          onSubmitTask={(id) => submitTaskVariations(id)}
          onToggleTimer={(id) =>
            activeTimerTaskId === id ? stopTimer() : startTimer(id)
          }
          onTogglePaid={(id, paid) => toggleTaskPaid(id, paid)}
        />
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-4">
            {KANBAN_COLUMNS.map((col) => (
              <KanbanColumn
                key={col.status}
                status={col.status}
                title={col.title}
                subtitle={col.subtitle}
                tasks={filteredTasks.filter((t) => t.status === col.status)}
                rates={settings.rates}
                onSelectTask={(id) => selectTask(id)}
                onTogglePaid={(id, paid) => toggleTaskPaid(id, paid)}
              />
            ))}
          </div>
        </DndContext>
      )}
    </div>
  );
};
