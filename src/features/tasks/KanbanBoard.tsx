import React, { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { Clock, GripVertical, RotateCcw } from 'lucide-react';
import { AppSettings, Task, TaskStatus } from '../../types';
import { cn, formatMinutes, getDeadlineUrgency } from '../../lib/utils';
import { DifficultyTag } from '../../components/ui/DifficultyTag';
import { ScoreChip } from '../../components/ui/ScoreChip';
import { StatusBadge } from '../../components/ui/StatusBadge';

interface KanbanBoardProps {
  tasks: Task[];
  settings: AppSettings;
  onSelectTask: (taskId: string) => void;
  onMoveTaskStatus: (taskId: string, status: TaskStatus) => void;
}

const KANBAN_COLUMNS: {
  status: TaskStatus;
  title: string;
  subtitle: string;
  headerAccent: string;
}[] = [
  {
    status: 'Available',
    title: 'Available',
    subtitle: 'Batch queue',
    headerAccent: 'bg-[var(--sky)] text-[var(--sky-ink)] border-[var(--sky-border)]',
  },
  {
    status: 'In Progress',
    title: 'In Progress',
    subtitle: '7 variation plates',
    headerAccent:
      'bg-[var(--butter)] text-[var(--butter-ink)] border-[var(--butter-border)]',
  },
  {
    status: 'Revision',
    title: 'Revision',
    subtitle: 'Reviewer feedback',
    headerAccent:
      'bg-[var(--rose)] text-[var(--rose-ink)] border-[var(--rose-border)]',
  },
  {
    status: 'Submitted',
    title: 'Submitted',
    subtitle: 'Awaiting QA',
    headerAccent:
      'bg-[var(--lavender)] text-[var(--lavender-ink)] border-[var(--lavender-border)]',
  },
  {
    status: 'In QA',
    title: 'In QA',
    subtitle: 'LLM & Human review',
    headerAccent:
      'bg-[var(--lavender)] text-[var(--lavender-ink)] border-[var(--lavender-border)]',
  },
  {
    status: 'Reviewed',
    title: 'Reviewed',
    subtitle: 'Passed final QA',
    headerAccent:
      'bg-[var(--sage)] text-[var(--sage-ink)] border-[var(--sage-border)]',
  },
];

interface KanbanCardProps {
  task: Task;
  settings: AppSettings;
  onSelectTask: (taskId: string) => void;
  isOverlay?: boolean;
}

const KanbanCardItem: React.FC<KanbanCardProps> = ({
  task,
  settings,
  onSelectTask,
  isOverlay = false,
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const filled = task.variations.filter((v) => v.filled).length;
  const total = task.variations.length;
  const urgency = getDeadlineUrgency(task.deadline, task.status);

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      style={style}
      onClick={() => onSelectTask(task.id)}
      className={cn(
        'bg-[var(--surface)] border border-[var(--border)] rounded-[12px] p-3.5 transition-colors hover:border-[var(--border-strong)] cursor-pointer select-none',
        isDragging && !isOverlay && 'opacity-35',
        isOverlay && 'shadow-lg ring-1 ring-[var(--ink)]',
        task.status === 'Revision' && 'border-[var(--rose-border)]'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="font-mono-num text-[11px] font-semibold text-[var(--muted-text)]">
            {task.code}
          </span>
          <DifficultyTag
            difficulty={task.difficulty}
            rate={settings.rates[task.difficulty]}
          />
        </div>

        <button
          type="button"
          {...(isOverlay ? {} : listeners)}
          {...(isOverlay ? {} : attributes)}
          onClick={(e) => e.stopPropagation()}
          className="p-1 -mr-1 -mt-1 text-[var(--muted-text)] hover:text-[var(--ink)] cursor-grab active:cursor-grabbing"
          title="Drag to change stage"
        >
          <GripVertical className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
      </div>

      <h4 className="font-display text-[13px] font-semibold text-[var(--ink)] mt-1.5 leading-snug line-clamp-2">
        {task.title}
      </h4>

      <p className="text-[11px] text-[var(--muted-text)] mt-1 truncate">
        {task.batchName}
      </p>

      {/* Reviewer feedback snippet for Revision tasks */}
      {task.status === 'Revision' && task.latestFeedback && (
        <div className="mt-2 p-2 rounded-[8px] bg-[var(--rose)]/35 border border-[var(--rose-border)] text-[11px] text-[var(--rose-ink)] line-clamp-2">
          <RotateCcw className="w-3 h-3 inline mr-1" strokeWidth={1.5} />
          {task.latestFeedback}
        </div>
      )}

      {/* 7-Variation mini bar */}
      <div className="mt-3 pt-2.5 border-t border-[var(--border)] flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-0.5">
            {task.variations.map((v) => (
              <span
                key={v.slotNumber}
                className={cn(
                  'w-1.5 h-3 rounded-[2px]',
                  v.filled
                    ? 'bg-[var(--sage-ink)]'
                    : 'bg-[var(--surface-muted)] border border-[var(--border-strong)]'
                )}
              />
            ))}
          </div>
          <span className="font-mono-num text-[11px] text-[var(--muted-text)] tabular-nums">
            {filled}/{total}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {task.qaLLM !== null && <ScoreChip score={task.qaLLM} prefix="L" />}
          {task.qaHuman !== null && <ScoreChip score={task.qaHuman} prefix="H" />}
          {task.qaLLM === null && task.qaHuman === null && (
            <span className="text-[11px] font-mono-num text-[var(--muted-text)] flex items-center gap-1">
              <Clock className="w-3 h-3" strokeWidth={1.5} />
              {formatMinutes(task.timeSpentMinutes)}
            </span>
          )}
        </div>
      </div>

      {task.deadline && task.status !== 'Reviewed' && (
        <div className="mt-1.5 flex justify-end">
          <span
            className={cn(
              'text-[10px] font-mono-num',
              urgency.isOverdue
                ? 'text-[var(--rose-ink)] font-semibold'
                : urgency.isUrgent
                ? 'text-[var(--butter-ink)] font-medium'
                : 'text-[var(--muted-text)]'
            )}
          >
            {urgency.label}
          </span>
        </div>
      )}
    </div>
  );
};

interface DroppableColumnProps {
  column: (typeof KANBAN_COLUMNS)[number];
  tasks: Task[];
  settings: AppSettings;
  onSelectTask: (taskId: string) => void;
}

const DroppableColumn: React.FC<DroppableColumnProps> = ({
  column,
  tasks,
  settings,
  onSelectTask,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: column.status,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col rounded-[12px] border border-[var(--border)] bg-[var(--surface-muted)]/45 p-2.5 min-h-[480px] transition-colors',
        isOver && 'border-[var(--ink)] bg-[var(--surface-muted)]'
      )}
    >
      <div className="flex items-center justify-between px-1.5 py-1.5 mb-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'px-2 py-0.5 text-xs font-semibold rounded-[6px] border',
              column.headerAccent
            )}
          >
            {column.title}
          </span>
          <span className="text-[11px] text-[var(--muted-text)] hidden xl:inline">
            {column.subtitle}
          </span>
        </div>
        <span className="font-mono-num text-xs font-semibold text-[var(--muted-text)] px-1.5 py-0.5 rounded-[6px] bg-[var(--surface)] border border-[var(--border)]">
          {tasks.length}
        </span>
      </div>

      <div className="flex-1 space-y-2.5">
        {tasks.map((t) => (
          <KanbanCardItem
            key={t.id}
            task={t}
            settings={settings}
            onSelectTask={onSelectTask}
          />
        ))}
        {tasks.length === 0 && (
          <div className="h-32 rounded-[8px] border border-dashed border-[var(--border-strong)] flex items-center justify-center text-xs text-[var(--muted-text)]">
            Drop task here
          </div>
        )}
      </div>
    </div>
  );
};

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  tasks,
  settings,
  onSelectTask,
  onMoveTaskStatus,
}) => {
  const [activeDragTask, setActiveDragTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const dragged = event.active.data.current?.task as Task | undefined;
    if (dragged) setActiveDragTask(dragged);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragTask(null);
    if (!over) return;
    const taskId = String(active.id);
    const targetStatus = over.id as TaskStatus;
    onMoveTaskStatus(taskId, targetStatus);
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {KANBAN_COLUMNS.map((col) => (
          <DroppableColumn
            key={col.status}
            column={col}
            tasks={tasks.filter((t) => t.status === col.status)}
            settings={settings}
            onSelectTask={onSelectTask}
          />
        ))}
      </div>

      <DragOverlay>
        {activeDragTask ? (
          <KanbanCardItem
            task={activeDragTask}
            settings={settings}
            onSelectTask={() => {}}
            isOverlay
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
