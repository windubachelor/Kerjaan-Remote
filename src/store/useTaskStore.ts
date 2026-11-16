import { format } from 'date-fns';
import { create } from 'zustand';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  setDoc,
  Unsubscribe,
  where,
} from 'firebase/firestore';
import {
  auth,
  buildVariationDriveFileName,
  compressImageDataUrlForFirestore,
  db,
  handleFirestoreError,
  OperationType,
} from '../lib/googleDrive';
import { LedgerSnapshot, taskRepository } from '../lib/repository';
import {
  createEmptyVariations,
  normalizeTaskVariations,
  VARIATION_SLOT_LABELS,
} from '../lib/utils';
import {
  AppSettings,
  DailyWorksheetNote,
  Difficulty,
  RevisionCauseTag,
  Task,
  TaskStatus,
  ToastNotification,
  VariationItem,
  WorksheetCell,
} from '../types';

export type FirebaseSyncStatus = 'local' | 'syncing' | 'synced' | 'error';

interface TaskStoreState {
  tasks: Task[];
  worksheetCells: WorksheetCell[];
  dailyNotes: DailyWorksheetNote[];
  settings: AppSettings;

  // Firebase Cloud State
  firebaseSyncStatus: FirebaseSyncStatus;
  firebaseUserEmail: string | null;
  firebaseUid: string | null;

  // UI state
  selectedTaskId: string | null;
  isAddModalOpen: boolean;
  isCommandPaletteOpen: boolean;
  toasts: ToastNotification[];

  // Active live timer state
  activeTimerTaskId: string | null;
  timerStartedAt: number | null; // epoch ms
  timerElapsedSeconds: number;

  // Actions
  selectTask: (taskId: string | null) => void;
  setAddModalOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  addToast: (toast: Omit<ToastNotification, 'id'>) => void;
  dismissToast: (id: string) => void;

  // Task lifecycle actions
  addTask: (input: {
    customCode?: string;
    title: string;
    batchName: string;
    difficulty: Difficulty;
    status: 'Available' | 'In Progress';
    deadline?: string;
    externalLink?: string;
    notes?: string;
  }) => Task;
  updateTaskMeta: (
    taskId: string,
    updates: Partial<
      Pick<
        Task,
        | 'code'
        | 'title'
        | 'batchName'
        | 'difficulty'
        | 'deadline'
        | 'externalLink'
        | 'notes'
        | 'driveSubfolderId'
        | 'driveSubfolderName'
        | 'driveSubfolderLink'
      >
    >
  ) => void;
  deleteTask: (taskId: string) => void;
  claimTask: (taskId: string) => void;
  skipTask: (taskId: string) => void;
  restoreTaskToAvailable: (taskId: string) => void;
  logHistoryEvent: (taskId: string, action: string, details?: string) => void;
  toggleTaskPaid: (taskId: string, paid?: boolean) => void;

  // Variation actions
  updateVariationSlot: (
    taskId: string,
    slotNumber: number,
    data: {
      imageUrl?: string;
      imageName?: string;
      noteOrLink?: string;
      textContent?: string;
      label?: string;
      driveFileId?: string;
      driveFileName?: string;
      driveWebViewLink?: string;
      driveSyncedAt?: string;
    }
  ) => void;
  clearVariationSlot: (taskId: string, slotNumber: number) => void;
  reorderVariations: (taskId: string, fromIndex: number, toIndex: number) => void;

  // Submission & QA transitions
  submitTaskVariations: (taskId: string) => { ok: boolean; error?: string };
  moveTaskStatus: (
    taskId: string,
    targetStatus: TaskStatus
  ) => { ok: boolean; error?: string };
  recordLLMScore: (taskId: string, score: number) => { ok: boolean; error?: string };
  recordHumanReview: (
    taskId: string,
    score: number,
    feedback?: string,
    tags?: RevisionCauseTag[]
  ) => { ok: boolean; error?: string; resultingStatus?: TaskStatus };

  // Time tracking & Worksheet
  startTimer: (taskId: string) => void;
  stopTimer: () => void;
  tickTimer: () => void;
  logManualMinutes: (taskId: string, minutes: number, dateStr?: string) => void;
  setWorksheetMinutes: (taskId: string, dateStr: string, minutes: number) => void;
  setDailyNote: (dateStr: string, note: string) => void;

  // Settings & Data Portability
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  resetAllData: () => void;
  exportLedgerJson: () => string;
  importLedgerJson: (rawJson: string) => { ok: boolean; error?: string };
}

const initialSnapshot = taskRepository.loadSnapshot();

function syncThemeToDom(theme: 'light' | 'dark') {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }
}

syncThemeToDom(initialSnapshot.settings.theme);

/**
 * Helper to strip undefined fields recursively and prepare a Task document
 * that strictly conforms to `isValidTask` in `firestore.rules`.
 */
async function serializeTaskForFirestore(
  task: Task,
  ownerId: string
): Promise<Record<string, unknown>> {
  const normalizedVars = normalizeTaskVariations(task.variations);
  const compressedVariations = await Promise.all(
    normalizedVars.slice(0, 16).map(async (v) => {
      const item: Record<string, unknown> = {
        slotNumber: v.slotNumber,
        filled: Boolean(v.filled),
        label: v.label || `Variation #${v.slotNumber}`,
      };
      if (v.imageUrl) {
        const thumb = await compressImageDataUrlForFirestore(v.imageUrl);
        if (thumb) item.imageUrl = thumb;
      }
      if (v.imageName) item.imageName = v.imageName.slice(0, 240);
      if (v.noteOrLink) item.noteOrLink = v.noteOrLink.slice(0, 500);
      if (v.textContent) item.textContent = v.textContent.slice(0, 4000);
      if (v.updatedAt) item.updatedAt = v.updatedAt.slice(0, 64);
      if (v.driveFileId) item.driveFileId = v.driveFileId.slice(0, 128);
      if (v.driveFileName) item.driveFileName = v.driveFileName.slice(0, 240);
      if (v.driveWebViewLink) item.driveWebViewLink = v.driveWebViewLink.slice(0, 500);
      if (v.driveSyncedAt) item.driveSyncedAt = v.driveSyncedAt.slice(0, 64);
      return item;
    })
  );

  const cleanHistory = (task.history || []).slice(0, 200).map((h) => {
    const item: Record<string, unknown> = {
      id: h.id,
      timestamp: h.timestamp,
      action: h.action.slice(0, 200),
      actor: h.actor,
    };
    if (h.details) item.details = h.details.slice(0, 500);
    if (h.fromStatus) item.fromStatus = h.fromStatus;
    if (h.toStatus) item.toStatus = h.toStatus;
    if (typeof h.score === 'number') item.score = h.score;
    return item;
  });

  const cleanRevisionHistory = (task.revisionHistory || []).slice(0, 100).map((r) => ({
    id: r.id,
    revisionNumber: r.revisionNumber,
    timestamp: r.timestamp,
    llmScore: r.llmScore,
    humanScore: r.humanScore,
    feedback: r.feedback.slice(0, 1000),
    tags: (r.tags || []).slice(0, 15),
  }));

  const payload: Record<string, unknown> = {
    id: task.id,
    ownerId,
    code: task.code.slice(0, 60),
    title: task.title.slice(0, 200),
    batchName: task.batchName.slice(0, 100),
    difficulty: task.difficulty,
    status: task.status,
    timeSpentMinutes: Math.max(
      0,
      Math.min(100000, Math.round(task.timeSpentMinutes || 0))
    ),
    notes: (task.notes || '').slice(0, 2000),
    variations: compressedVariations,
    qaLLM: typeof task.qaLLM === 'number' ? task.qaLLM : null,
    qaHuman: typeof task.qaHuman === 'number' ? task.qaHuman : null,
    revisionCount: Math.max(0, Math.min(500, Math.round(task.revisionCount || 0))),
    revisionTags: (task.revisionTags || []).slice(0, 15),
    revisionHistory: cleanRevisionHistory,
    history: cleanHistory,
    updatedAt: new Date().toISOString(),
  };

  if (task.claimedAt) payload.claimedAt = task.claimedAt.slice(0, 64);
  if (task.submittedAt) payload.submittedAt = task.submittedAt.slice(0, 64);
  if (task.reviewedAt) payload.reviewedAt = task.reviewedAt.slice(0, 64);
  if (task.deadline) payload.deadline = task.deadline.slice(0, 64);
  if (task.latestFeedback) payload.latestFeedback = task.latestFeedback.slice(0, 2000);
  if (task.driveSubfolderId)
    payload.driveSubfolderId = task.driveSubfolderId.slice(0, 128);
  if (task.driveSubfolderName)
    payload.driveSubfolderName = task.driveSubfolderName.slice(0, 250);
  if (task.driveSubfolderLink)
    payload.driveSubfolderLink = task.driveSubfolderLink.slice(0, 500);
  if (task.externalLink) payload.externalLink = task.externalLink.slice(0, 500);
  if (typeof task.isPaid === 'boolean') payload.isPaid = task.isPaid;
  if (task.paidAt) payload.paidAt = task.paidAt.slice(0, 64);
  if (typeof task.clientRevision === 'boolean')
    payload.clientRevision = task.clientRevision;

  return payload;
}

async function persistTaskToFirestore(task: Task) {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const path = `users/${uid}/tasks/${task.id}`;
  try {
    useTaskStore.setState({ firebaseSyncStatus: 'syncing' });
    const data = await serializeTaskForFirestore(task, uid);
    await setDoc(doc(db, 'users', uid, 'tasks', task.id), data);
    useTaskStore.setState({ firebaseSyncStatus: 'synced' });
  } catch (error) {
    useTaskStore.setState({ firebaseSyncStatus: 'error' });
    try {
      handleFirestoreError(error, OperationType.WRITE, path);
    } catch {}
  }
}

async function deleteTaskFromFirestore(taskId: string) {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const path = `users/${uid}/tasks/${taskId}`;
  try {
    useTaskStore.setState({ firebaseSyncStatus: 'syncing' });
    await deleteDoc(doc(db, 'users', uid, 'tasks', taskId));
    useTaskStore.setState({ firebaseSyncStatus: 'synced' });
  } catch (error) {
    useTaskStore.setState({ firebaseSyncStatus: 'error' });
    try {
      handleFirestoreError(error, OperationType.DELETE, path);
    } catch {}
  }
}

async function persistWorksheetCellToFirestore(cell: WorksheetCell) {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const cellId = `${cell.taskId}_${cell.date}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `users/${uid}/worksheetCells/${cellId}`;
  try {
    useTaskStore.setState({ firebaseSyncStatus: 'syncing' });
    if (cell.minutes <= 0) {
      await deleteDoc(doc(db, 'users', uid, 'worksheetCells', cellId));
    } else {
      await setDoc(doc(db, 'users', uid, 'worksheetCells', cellId), {
        ownerId: uid,
        taskId: cell.taskId.slice(0, 128),
        date: cell.date.slice(0, 16),
        minutes: Math.max(0, Math.min(1440, Math.round(cell.minutes))),
        updatedAt: new Date().toISOString(),
      });
    }
    useTaskStore.setState({ firebaseSyncStatus: 'synced' });
  } catch (error) {
    useTaskStore.setState({ firebaseSyncStatus: 'error' });
    try {
      handleFirestoreError(error, OperationType.WRITE, path);
    } catch {}
  }
}

async function persistDailyNoteToFirestore(dateStr: string, note: string) {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const dateId = dateStr.replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `users/${uid}/dailyNotes/${dateId}`;
  try {
    useTaskStore.setState({ firebaseSyncStatus: 'syncing' });
    if (!note.trim()) {
      await deleteDoc(doc(db, 'users', uid, 'dailyNotes', dateId));
    } else {
      await setDoc(doc(db, 'users', uid, 'dailyNotes', dateId), {
        ownerId: uid,
        date: dateStr.slice(0, 16),
        note: note.trim().slice(0, 2000),
        updatedAt: new Date().toISOString(),
      });
    }
    useTaskStore.setState({ firebaseSyncStatus: 'synced' });
  } catch (error) {
    useTaskStore.setState({ firebaseSyncStatus: 'error' });
    try {
      handleFirestoreError(error, OperationType.WRITE, path);
    } catch {}
  }
}

async function persistSettingsToFirestore(settings: AppSettings) {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const path = `users/${uid}/settings/main`;
  try {
    useTaskStore.setState({ firebaseSyncStatus: 'syncing' });
    await setDoc(doc(db, 'users', uid, 'settings', 'main'), {
      ownerId: uid,
      illustratorName: (settings.illustratorName || 'Senior Illustrator').slice(0, 80),
      passThreshold: Math.max(1.0, Math.min(5.0, Number(settings.passThreshold) || 4.0)),
      rates: {
        Easy: Number(settings.rates?.Easy) || 2,
        Medium: Number(settings.rates?.Medium) || 3,
        Hard: Number(settings.rates?.Hard) || 4,
      },
      weeklyHourTarget: Math.max(
        1,
        Math.min(120, Number(settings.weeklyHourTarget) || 32)
      ),
      variationCount: 10,
      theme: settings.theme === 'dark' ? 'dark' : 'light',
      gdriveFolderId: (settings.gdriveFolderId || '').slice(0, 128),
      gdriveFolderUrl: (settings.gdriveFolderUrl || '').slice(0, 500),
      gdrivePrefixMode: 'title_only',
      autoUploadToGDrive: Boolean(settings.autoUploadToGDrive),
      updatedAt: new Date().toISOString(),
    });
    useTaskStore.setState({ firebaseSyncStatus: 'synced' });
  } catch (error) {
    useTaskStore.setState({ firebaseSyncStatus: 'error' });
    try {
      handleFirestoreError(error, OperationType.WRITE, path);
    } catch {}
  }
}

export const useTaskStore = create<TaskStoreState>((set, get) => {
  const persistCurrent = () => {
    const state = get();
    const snapshot: LedgerSnapshot = {
      version: 5,
      tasks: state.tasks,
      worksheetCells: state.worksheetCells,
      dailyNotes: state.dailyNotes,
      settings: state.settings,
    };
    taskRepository.saveSnapshot(snapshot);
  };

  const syncUpdatedTaskById = (taskId: string) => {
    persistCurrent();
    const updated = get().tasks.find((t) => t.id === taskId);
    if (updated) {
      persistTaskToFirestore(updated);
    }
  };

  const restoreSnapshot = (prevTasks: Task[], prevCells: WorksheetCell[]) => {
    set({ tasks: prevTasks, worksheetCells: prevCells });
    persistCurrent();
    prevTasks.forEach((t) => persistTaskToFirestore(t));
  };

  return {
    tasks: initialSnapshot.tasks,
    worksheetCells: initialSnapshot.worksheetCells,
    dailyNotes: initialSnapshot.dailyNotes,
    settings: initialSnapshot.settings,

    firebaseSyncStatus: 'local',
    firebaseUserEmail: null,
    firebaseUid: null,

    selectedTaskId: null,
    isAddModalOpen: false,
    isCommandPaletteOpen: false,
    toasts: [],

    activeTimerTaskId: null,
    timerStartedAt: null,
    timerElapsedSeconds: 0,

    selectTask: (taskId) => set({ selectedTaskId: taskId }),
    setAddModalOpen: (open) => set({ isAddModalOpen: open }),
    setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),

    addToast: (toast) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, 5000);
    },

    dismissToast: (id) => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    },

    addTask: (input) => {
      const state = get();
      const highestNum = state.tasks.reduce((max, t) => {
        const num = parseInt(t.code.replace(/\D/g, ''), 10);
        return Number.isNaN(num) ? max : Math.max(max, num);
      }, 1000);
      const customTrimmed = input.customCode?.trim();
      const nextCode =
        customTrimmed && customTrimmed.length > 0
          ? customTrimmed
          : `KR-${highestNum + 1}`;
      const nowIso = new Date().toISOString();
      const newTask: Task = {
        id: `task-${Date.now()}`,
        code: nextCode,
        title: input.title.trim(),
        batchName: input.batchName.trim(),
        difficulty: input.difficulty,
        status: input.status,
        claimedAt: input.status === 'In Progress' ? nowIso : undefined,
        deadline: input.deadline ? new Date(input.deadline).toISOString() : undefined,
        timeSpentMinutes: 0,
        notes: input.notes ?? '',
        externalLink: input.externalLink?.trim() || undefined,
        variations: createEmptyVariations(10),
        qaLLM: null,
        qaHuman: null,
        revisionCount: 0,
        revisionTags: [],
        revisionHistory: [],
        isPaid: false,
        clientRevision: false,
        history: [
          {
            id: `h-${Date.now()}`,
            timestamp: nowIso,
            action:
              input.status === 'In Progress'
                ? 'Task dibuat & langsung dikerjakan (10 Varian)'
                : 'Task ditambahkan ke antrean Available',
            details: `${input.batchName} · ${input.difficulty}`,
            toStatus: input.status,
            actor: 'Illustrator',
          },
        ],
      };

      set((s) => ({ tasks: [newTask, ...s.tasks] }));
      persistCurrent();
      persistTaskToFirestore(newTask);
      get().addToast({
        title: `Task ${newTask.code} ditambahkan`,
        description: newTask.title,
        variant: 'success',
      });
      return newTask;
    },

    updateTaskMeta: (taskId, updates) => {
      set((s) => ({
        tasks: s.tasks.map((t) => {
          if (t.id !== taskId) return t;
          const nextTitle = updates.title !== undefined ? updates.title : t.title;
          const nextVariations =
            updates.title !== undefined && updates.title !== t.title
              ? t.variations.map((v) => ({
                  ...v,
                  imageName: v.filled
                    ? buildVariationDriveFileName({
                        taskTitle: nextTitle,
                        slotNumber: v.slotNumber,
                      })
                    : v.imageName,
                }))
              : t.variations;
          return {
            ...t,
            ...updates,
            variations: nextVariations,
          };
        }),
      }));
      syncUpdatedTaskById(taskId);
    },

    deleteTask: (taskId) => {
      const prevTasks = get().tasks;
      const prevCells = get().worksheetCells;
      const target = prevTasks.find((t) => t.id === taskId);
      if (!target) return;

      set((s) => ({
        tasks: s.tasks.filter((t) => t.id !== taskId),
        worksheetCells: s.worksheetCells.filter((c) => c.taskId !== taskId),
        selectedTaskId: s.selectedTaskId === taskId ? null : s.selectedTaskId,
      }));
      persistCurrent();
      deleteTaskFromFirestore(taskId);

      get().addToast({
        title: `Task ${target.code} dihapus`,
        description: target.title,
        variant: 'default',
        undoAction: () => restoreSnapshot(prevTasks, prevCells),
      });
    },

    claimTask: (taskId) => {
      const prevTasks = get().tasks;
      const prevCells = get().worksheetCells;
      const target = prevTasks.find((t) => t.id === taskId);
      if (!target) return;

      const nowIso = new Date().toISOString();
      set((s) => ({
        tasks: s.tasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: 'In Progress',
                claimedAt: t.claimedAt ?? nowIso,
                history: [
                  {
                    id: `h-${Date.now()}`,
                    timestamp: nowIso,
                    action: 'Task claimed dari batch',
                    details: 'Mulai pengerjaan 10 slot file varian',
                    fromStatus: t.status,
                    toStatus: 'In Progress',
                    actor: 'Illustrator',
                  },
                  ...t.history,
                ],
              }
            : t
        ),
      }));
      syncUpdatedTaskById(taskId);

      get().addToast({
        title: `Claimed ${target.code}`,
        description: 'Dipindahkan ke In Progress.',
        variant: 'success',
        undoAction: () => restoreSnapshot(prevTasks, prevCells),
      });
    },

    skipTask: (taskId) => {
      const prevTasks = get().tasks;
      const prevCells = get().worksheetCells;
      const target = prevTasks.find((t) => t.id === taskId);
      if (!target) return;

      const nowIso = new Date().toISOString();
      set((s) => ({
        tasks: s.tasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: 'Skipped',
                history: [
                  {
                    id: `h-${Date.now()}`,
                    timestamp: nowIso,
                    action: 'Task dilewati (Skipped)',
                    fromStatus: t.status,
                    toStatus: 'Skipped',
                    actor: 'Illustrator',
                  },
                  ...t.history,
                ],
              }
            : t
        ),
      }));
      syncUpdatedTaskById(taskId);

      get().addToast({
        title: `Skipped ${target.code}`,
        description: 'Task disembunyikan dari daftar Available aktif.',
        variant: 'default',
        undoAction: () => restoreSnapshot(prevTasks, prevCells),
      });
    },

    restoreTaskToAvailable: (taskId) => {
      const nowIso = new Date().toISOString();
      set((s) => ({
        tasks: s.tasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: 'Available',
                history: [
                  {
                    id: `h-${Date.now()}`,
                    timestamp: nowIso,
                    action: 'Dikembalikan ke antrean Available',
                    fromStatus: t.status,
                    toStatus: 'Available',
                    actor: 'Illustrator',
                  },
                  ...t.history,
                ],
              }
            : t
        ),
      }));
      syncUpdatedTaskById(taskId);
    },

    logHistoryEvent: (taskId, action, details) => {
      const nowIso = new Date().toISOString();
      set((s) => ({
        tasks: s.tasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                history: [
                  {
                    id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                    timestamp: nowIso,
                    action,
                    details,
                    actor: 'Illustrator',
                  },
                  ...t.history,
                ],
              }
            : t
        ),
      }));
      syncUpdatedTaskById(taskId);
    },

    toggleTaskPaid: (taskId, paid) => {
      const state = get();
      const target = state.tasks.find((t) => t.id === taskId);
      if (!target) return;

      const isEligible =
        target.status === 'Reviewed' || Boolean(target.isPaid) || Boolean(target.clientRevision);
      if (!isEligible) {
        state.addToast({
          title: 'Belum dapat ditandai Paid',
          description:
            'Toggle Paid hanya tersedia untuk task yang sudah berstatus Reviewed.',
          variant: 'warning',
        });
        return;
      }

      const nextPaid = paid !== undefined ? paid : !target.isPaid;
      const nowIso = new Date().toISOString();

      set((s) => ({
        tasks: s.tasks.map((t) => {
          if (t.id !== taskId) return t;

          if (nextPaid) {
            return {
              ...t,
              isPaid: true,
              paidAt: nowIso,
              status: 'Reviewed',
              clientRevision: false,
              reviewedAt: t.reviewedAt || nowIso,
              history: [
                {
                  id: `h-${Date.now()}`,
                  timestamp: nowIso,
                  action: 'Task ditandai PAID (Sudah Dibayar)',
                  details:
                    'Dipindahkan ke halaman Paid Tasks & disembunyikan dari Worksheet aktif',
                  fromStatus: t.status,
                  toStatus: 'Reviewed',
                  actor: 'Illustrator',
                },
                ...t.history,
              ],
            };
          } else {
            const nextRevCount = (t.revisionCount || 0) + 1;
            const feedbackMsg =
              'Revisi Klien — Toggle Paid dinonaktifkan, task dikembalikan ke Worksheet';
            return {
              ...t,
              isPaid: false,
              status: 'Revision',
              clientRevision: true,
              revisionCount: nextRevCount,
              latestFeedback: feedbackMsg,
              revisionHistory: [
                {
                  id: `rev-${Date.now()}`,
                  revisionNumber: nextRevCount,
                  timestamp: nowIso,
                  llmScore: t.qaLLM ?? 4.0,
                  humanScore: t.qaHuman ?? 4.0,
                  feedback: feedbackMsg,
                  tags: ['Prompt Adherence'],
                },
                ...(t.revisionHistory || []),
              ],
              history: [
                {
                  id: `h-${Date.now()}`,
                  timestamp: nowIso,
                  action: 'Toggle Paid dinonaktifkan → Status Revisi Klien',
                  details:
                    'Task dikembalikan ke Worksheet dengan status Revisi Klien',
                  fromStatus: t.status,
                  toStatus: 'Revision',
                  actor: 'Human Reviewer',
                },
                ...t.history,
              ],
            };
          }
        }),
      }));

      syncUpdatedTaskById(taskId);

      if (nextPaid) {
        state.addToast({
          title: `${target.code} ditandai PAID (Sudah Dibayar)`,
          description:
            'Task berpindah ke halaman Paid Tasks dan menghilang dari Worksheet.',
          variant: 'success',
        });
      } else {
        state.addToast({
          title: `${target.code} kembali ke Worksheet (Revisi Klien)`,
          description:
            'Status berubah menjadi Revisi Klien. Aktifkan kembali toggle untuk pindah ke Paid.',
          variant: 'warning',
        });
      }
    },

    updateVariationSlot: (taskId, slotNumber, data) => {
      const nowIso = new Date().toISOString();
      set((s) => ({
        tasks: s.tasks.map((t) => {
          if (t.id !== taskId) return t;
          const updatedVariations = t.variations.map((v) => {
            if (v.slotNumber !== slotNumber) return v;
            const nextImageUrl =
              data.imageUrl !== undefined ? data.imageUrl : v.imageUrl;
            const nextImageName =
              data.imageName !== undefined ? data.imageName : v.imageName;
            const nextNote =
              data.noteOrLink !== undefined ? data.noteOrLink : v.noteOrLink;
            const nextTextContent =
              data.textContent !== undefined ? data.textContent : v.textContent;
            const nextLabel = data.label !== undefined ? data.label : v.label;
            const nextDriveFileId =
              data.driveFileId !== undefined ? data.driveFileId : v.driveFileId;
            const nextDriveFileName =
              data.driveFileName !== undefined ? data.driveFileName : v.driveFileName;
            const nextDriveLink =
              data.driveWebViewLink !== undefined
                ? data.driveWebViewLink
                : v.driveWebViewLink;
            const nextDriveSyncedAt =
              data.driveSyncedAt !== undefined ? data.driveSyncedAt : v.driveSyncedAt;

            const isFilled = Boolean(
              (nextImageUrl && nextImageUrl.trim().length > 0) ||
                (nextTextContent && nextTextContent.trim().length > 0) ||
                (nextNote && nextNote.trim().length > 0) ||
                (nextDriveLink && nextDriveLink.trim().length > 0)
            );
            return {
              ...v,
              label: nextLabel,
              imageUrl: nextImageUrl,
              imageName: nextImageName,
              noteOrLink: nextNote,
              textContent: nextTextContent,
              driveFileId: nextDriveFileId,
              driveFileName: nextDriveFileName,
              driveWebViewLink: nextDriveLink,
              driveSyncedAt: nextDriveSyncedAt,
              filled: isFilled,
              updatedAt: nowIso,
            };
          });
          return {
            ...t,
            variations: updatedVariations,
          };
        }),
      }));
      syncUpdatedTaskById(taskId);
    },

    clearVariationSlot: (taskId, slotNumber) => {
      set((s) => ({
        tasks: s.tasks.map((t) => {
          if (t.id !== taskId) return t;
          return {
            ...t,
            variations: t.variations.map((v) =>
              v.slotNumber === slotNumber
                ? {
                    ...v,
                    filled: false,
                    imageUrl: undefined,
                    imageName: undefined,
                    noteOrLink: undefined,
                    textContent: undefined,
                    updatedAt: undefined,
                    driveFileId: undefined,
                    driveFileName: undefined,
                    driveWebViewLink: undefined,
                    driveSyncedAt: undefined,
                  }
                : v
            ),
          };
        }),
      }));
      syncUpdatedTaskById(taskId);
    },

    reorderVariations: (taskId, fromIndex, toIndex) => {
      set((s) => ({
        tasks: s.tasks.map((t) => {
          if (t.id !== taskId) return t;
          const list = [...t.variations];
          const [moved] = list.splice(fromIndex, 1);
          list.splice(toIndex, 0, moved);
          const reindexed: VariationItem[] = list.map((item, idx) => {
            const newSlotNumber = idx + 1;
            const standardizedName = buildVariationDriveFileName({
              taskTitle: t.title,
              slotNumber: newSlotNumber,
            });
            return {
              ...item,
              slotNumber: newSlotNumber,
              label: VARIATION_SLOT_LABELS[idx] || `Variation #${newSlotNumber}`,
              imageName: item.filled ? standardizedName : item.imageName,
            };
          });
          return { ...t, variations: reindexed };
        }),
      }));
      syncUpdatedTaskById(taskId);
    },

    submitTaskVariations: (taskId) => {
      const prevTasks = get().tasks;
      const prevCells = get().worksheetCells;
      const target = prevTasks.find((t) => t.id === taskId);
      if (!target) return { ok: false, error: 'Task not found' };

      const filledCount = target.variations.filter((v) => v.filled).length;
      const requiredCount = target.variations.length;
      if (filledCount < requiredCount) {
        const msg = `Belum lengkap: ${filledCount}/${requiredCount} slot terisi. Seluruh ${requiredCount} slot (01 s/d 10 termasuk _master.psd, _original.png, dan _notes.txt) wajib diisi sebelum Submit.`;
        get().addToast({
          title: 'Submit diblokir',
          description: msg,
          variant: 'danger',
        });
        return { ok: false, error: msg };
      }

      const nowIso = new Date().toISOString();
      const wasRevision = target.status === 'Revision';
      set((s) => ({
        tasks: s.tasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: 'Submitted',
                submittedAt: nowIso,
                history: [
                  {
                    id: `h-${Date.now()}`,
                    timestamp: nowIso,
                    action: wasRevision
                      ? `Re-submitted seluruh ${requiredCount} file setelah Revisi #${t.revisionCount}`
                      : `Submitted seluruh ${requiredCount} file untuk evaluasi QA`,
                    details: `${requiredCount}/${requiredCount} slot terverifikasi`,
                    fromStatus: t.status,
                    toStatus: 'Submitted',
                    actor: 'Illustrator',
                  },
                  ...t.history,
                ],
              }
            : t
        ),
      }));
      syncUpdatedTaskById(taskId);

      get().addToast({
        title: wasRevision ? `Re-submitted ${target.code}` : `Submitted ${target.code}`,
        description: `Seluruh ${requiredCount} file telah masuk ke antrean QA.`,
        variant: 'success',
        undoAction: () => restoreSnapshot(prevTasks, prevCells),
      });

      return { ok: true };
    },

    moveTaskStatus: (taskId, targetStatus) => {
      const state = get();
      const task = state.tasks.find((t) => t.id === taskId);
      if (!task) return { ok: false, error: 'Task not found' };
      if (task.status === targetStatus) return { ok: true };

      if (targetStatus === 'In Progress') {
        if (task.status === 'Available' || task.status === 'Skipped') {
          state.claimTask(taskId);
          return { ok: true };
        }
      }

      if (targetStatus === 'Submitted') {
        return state.submitTaskVariations(taskId);
      }

      if (targetStatus === 'In QA') {
        const filledCount = task.variations.filter((v) => v.filled).length;
        if (filledCount < task.variations.length) {
          const msg = `Seluruh ${task.variations.length} slot varian harus lengkap sebelum masuk ke QA.`;
          state.addToast({
            title: 'Tidak dapat pindah ke QA',
            description: msg,
            variant: 'danger',
          });
          return { ok: false, error: msg };
        }
      }

      if (targetStatus === 'Reviewed') {
        if (task.qaLLM === null || task.qaHuman === null) {
          const msg =
            'Skor QA LLM dan QA Human wajib diisi sebelum task berstatus Reviewed.';
          state.addToast({
            title: 'Skor QA diperlukan',
            description: msg,
            variant: 'warning',
          });
          state.selectTask(taskId);
          return { ok: false, error: msg };
        }
        if (task.qaHuman < state.settings.passThreshold) {
          const msg = `Skor Human QA (${task.qaHuman.toFixed(1)}) di bawah batas lulus (${state.settings.passThreshold.toFixed(1)}).`;
          state.addToast({
            title: 'Skor di bawah batas lulus',
            description: msg,
            variant: 'danger',
          });
          return { ok: false, error: msg };
        }
      }

      const prevTasks = state.tasks;
      const prevCells = state.worksheetCells;
      const nowIso = new Date().toISOString();

      set((s) => ({
        tasks: s.tasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: targetStatus,
                clientRevision:
                  targetStatus === 'Reviewed' ? false : t.clientRevision,
                claimedAt:
                  targetStatus === 'In Progress' && !t.claimedAt ? nowIso : t.claimedAt,
                history: [
                  {
                    id: `h-${Date.now()}`,
                    timestamp: nowIso,
                    action: `Status diubah dari ${t.status} ke ${targetStatus}`,
                    fromStatus: t.status,
                    toStatus: targetStatus,
                    actor: 'Illustrator',
                  },
                  ...t.history,
                ],
              }
            : t
        ),
      }));
      syncUpdatedTaskById(taskId);

      state.addToast({
        title: `${task.code} → ${targetStatus}`,
        variant: 'default',
        undoAction: () => restoreSnapshot(prevTasks, prevCells),
      });
      return { ok: true };
    },

    recordLLMScore: (taskId, rawScore) => {
      const score = Math.round(rawScore * 10) / 10;
      if (Number.isNaN(score) || score < 1.0 || score > 5.0) {
        return {
          ok: false,
          error: 'Skor QA LLM harus di antara 1.0 hingga 5.0.',
        };
      }
      const target = get().tasks.find((t) => t.id === taskId);
      if (!target) return { ok: false, error: 'Task not found' };

      const filledCount = target.variations.filter((v) => v.filled).length;
      if (filledCount < target.variations.length) {
        return {
          ok: false,
          error: `Seluruh ${target.variations.length} slot harus diisi sebelum mencatat skor QA.`,
        };
      }

      const nowIso = new Date().toISOString();
      set((s) => ({
        tasks: s.tasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: 'In QA',
                qaLLM: score,
                history: [
                  {
                    id: `h-${Date.now()}`,
                    timestamp: nowIso,
                    action: `QA LLM Score tercatat: ${score.toFixed(1)}`,
                    details: 'Menunggu Human QA Review',
                    fromStatus: t.status,
                    toStatus: 'In QA',
                    score,
                    actor: 'LLM Evaluator',
                  },
                  ...t.history,
                ],
              }
            : t
        ),
      }));
      syncUpdatedTaskById(taskId);

      get().addToast({
        title: `LLM QA tercatat (${score.toFixed(1)})`,
        description: `${target.code} kini siap untuk Human Review.`,
        variant: 'success',
      });

      return { ok: true };
    },

    recordHumanReview: (taskId, rawScore, feedback, tags = []) => {
      const state = get();
      const target = state.tasks.find((t) => t.id === taskId);
      if (!target) return { ok: false, error: 'Task not found' };

      if (target.qaLLM === null) {
        return {
          ok: false,
          error: 'Aturan QA Berurutan: Skor QA LLM wajib diisi terlebih dahulu.',
        };
      }

      const score = Math.round(rawScore * 10) / 10;
      if (Number.isNaN(score) || score < 1.0 || score > 5.0) {
        return {
          ok: false,
          error: 'Skor QA Human harus di antara 1.0 hingga 5.0.',
        };
      }

      const threshold = state.settings.passThreshold;
      const passed = score >= threshold;

      if (!passed && (!feedback || feedback.trim().length < 4)) {
        return {
          ok: false,
          error: `Skor ${score.toFixed(1)} di bawah batas lulus (${threshold.toFixed(
            1
          )}). Catatan feedback wajib diisi untuk status Revision.`,
        };
      }

      const nowIso = new Date().toISOString();
      const nextStatus: TaskStatus = passed ? 'Reviewed' : 'Revision';
      const nextRevCount = passed ? target.revisionCount : target.revisionCount + 1;

      set((s) => ({
        tasks: s.tasks.map((t) => {
          if (t.id !== taskId) return t;
          const updatedRevHistory = !passed
            ? [
                {
                  id: `rev-${Date.now()}`,
                  revisionNumber: nextRevCount,
                  timestamp: nowIso,
                  llmScore: t.qaLLM ?? score,
                  humanScore: score,
                  feedback: feedback!.trim(),
                  tags:
                    tags.length > 0
                      ? tags
                      : (['Prompt Adherence'] as RevisionCauseTag[]),
                },
                ...t.revisionHistory,
              ]
            : t.revisionHistory;

          return {
            ...t,
            status: nextStatus,
            clientRevision: passed ? false : t.clientRevision,
            qaHuman: score,
            reviewedAt: passed ? nowIso : t.reviewedAt,
            revisionCount: nextRevCount,
            latestFeedback: !passed ? feedback!.trim() : t.latestFeedback,
            revisionTags:
              !passed && tags.length > 0
                ? Array.from(new Set([...t.revisionTags, ...tags]))
                : t.revisionTags,
            revisionHistory: updatedRevHistory,
            history: [
              {
                id: `h-${Date.now()}`,
                timestamp: nowIso,
                action: passed
                  ? `Lulus Human QA (${score.toFixed(1)} ≥ ${threshold.toFixed(1)})`
                  : `Perlu Revisi Human QA (${score.toFixed(1)} < ${threshold.toFixed(
                      1
                    )}) — Revisi #${nextRevCount}`,
                details: passed
                  ? feedback?.trim() || 'Disetujui untuk pengiriman akhir'
                  : feedback!.trim(),
                fromStatus: t.status,
                toStatus: nextStatus,
                score,
                actor: 'Human Reviewer',
              },
              ...t.history,
            ],
          };
        }),
      }));
      syncUpdatedTaskById(taskId);

      get().addToast({
        title: passed
          ? `${target.code} Lulus QA (${score.toFixed(1)})`
          : `${target.code} Masuk Revisi (${score.toFixed(1)})`,
        description: passed
          ? 'Task otomatis dipindahkan ke Reviewed. Toggle Paid kini tersedia!'
          : `Revisi #${nextRevCount} tercatat beserta feedback reviewer.`,
        variant: passed ? 'success' : 'warning',
      });

      return { ok: true, resultingStatus: nextStatus };
    },

    startTimer: (taskId) => {
      const currentActive = get().activeTimerTaskId;
      if (currentActive && currentActive !== taskId) {
        get().stopTimer();
      }
      const target = get().tasks.find((t) => t.id === taskId);
      set({
        activeTimerTaskId: taskId,
        timerStartedAt: Date.now(),
        timerElapsedSeconds: 0,
      });
      if (target) {
        get().addToast({
          title: `Timer dimulai untuk ${target.code}`,
          description: target.title,
          variant: 'default',
        });
      }
    },

    stopTimer: () => {
      const { activeTimerTaskId, timerElapsedSeconds } = get();
      if (!activeTimerTaskId) return;
      const loggedMinutes = Math.max(1, Math.round(timerElapsedSeconds / 60));
      get().logManualMinutes(activeTimerTaskId, loggedMinutes);
      set({
        activeTimerTaskId: null,
        timerStartedAt: null,
        timerElapsedSeconds: 0,
      });
    },

    tickTimer: () => {
      const { activeTimerTaskId, timerStartedAt } = get();
      if (!activeTimerTaskId || !timerStartedAt) return;
      const elapsed = Math.floor((Date.now() - timerStartedAt) / 1000);
      set({ timerElapsedSeconds: elapsed });
    },

    logManualMinutes: (taskId, minutesToAdd, dateStr) => {
      if (minutesToAdd <= 0) return;
      const targetDate = dateStr || format(new Date(), 'yyyy-MM-dd');
      const target = get().tasks.find((t) => t.id === taskId);
      if (!target) return;

      let updatedCell: WorksheetCell | null = null;

      set((s) => {
        const existingCellIndex = s.worksheetCells.findIndex(
          (c) => c.taskId === taskId && c.date === targetDate
        );
        const nextCells = [...s.worksheetCells];
        if (existingCellIndex >= 0) {
          updatedCell = {
            ...nextCells[existingCellIndex],
            minutes: nextCells[existingCellIndex].minutes + minutesToAdd,
          };
          nextCells[existingCellIndex] = updatedCell;
        } else {
          updatedCell = {
            taskId,
            date: targetDate,
            minutes: minutesToAdd,
          };
          nextCells.push(updatedCell);
        }

        return {
          tasks: s.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  timeSpentMinutes: Math.max(0, t.timeSpentMinutes + minutesToAdd),
                }
              : t
          ),
          worksheetCells: nextCells,
        };
      });
      syncUpdatedTaskById(taskId);
      if (updatedCell) {
        persistWorksheetCellToFirestore(updatedCell);
      }

      get().addToast({
        title: `+${minutesToAdd}m tercatat pada ${target.code}`,
        description: `Tersinkron ke worksheet ${targetDate}.`,
        variant: 'success',
      });
    },

    setWorksheetMinutes: (taskId, dateStr, minutes) => {
      const sanitized = Math.max(0, Math.round(minutes));
      set((s) => {
        const prevCell = s.worksheetCells.find(
          (c) => c.taskId === taskId && c.date === dateStr
        );
        const prevMins = prevCell?.minutes ?? 0;
        const delta = sanitized - prevMins;

        const filtered = s.worksheetCells.filter(
          (c) => !(c.taskId === taskId && c.date === dateStr)
        );
        const nextCells =
          sanitized > 0
            ? [...filtered, { taskId, date: dateStr, minutes: sanitized }]
            : filtered;

        return {
          worksheetCells: nextCells,
          tasks: s.tasks.map((t) =>
            t.id === taskId
              ? { ...t, timeSpentMinutes: Math.max(0, t.timeSpentMinutes + delta) }
              : t
          ),
        };
      });
      syncUpdatedTaskById(taskId);
      persistWorksheetCellToFirestore({
        taskId,
        date: dateStr,
        minutes: sanitized,
      });
    },

    setDailyNote: (dateStr, note) => {
      set((s) => {
        const filtered = s.dailyNotes.filter((n) => n.date !== dateStr);
        const nextNotes = note.trim()
          ? [...filtered, { date: dateStr, note }]
          : filtered;
        return { dailyNotes: nextNotes };
      });
      persistCurrent();
      persistDailyNoteToFirestore(dateStr, note);
    },

    updateSettings: (newSettings) => {
      set((s) => {
        const merged: AppSettings = {
          ...s.settings,
          ...newSettings,
          variationCount: 10,
          gdrivePrefixMode: 'title_only',
        };
        syncThemeToDom(merged.theme);
        return { settings: merged };
      });
      persistCurrent();
      persistSettingsToFirestore(get().settings);
      get().addToast({
        title: 'Pengaturan disimpan',
        description: 'Konfigurasi Kerjaan-Remote & Firebase diperbarui.',
        variant: 'success',
      });
    },

    resetAllData: () => {
      const currentTasks = get().tasks;
      const fresh = taskRepository.resetToSeed();
      syncThemeToDom(fresh.settings.theme);
      set({
        tasks: [],
        worksheetCells: [],
        dailyNotes: [],
        settings: fresh.settings,
        selectedTaskId: null,
        activeTimerTaskId: null,
        timerStartedAt: null,
        timerElapsedSeconds: 0,
      });
      currentTasks.forEach((t) => deleteTaskFromFirestore(t.id));
      get().addToast({
        title: 'Data berhasil dikosongkan',
        description: 'Semua task dan worksheet telah dibersihkan.',
        variant: 'default',
      });
    },

    exportLedgerJson: () => {
      return taskRepository.exportJson();
    },

    importLedgerJson: (rawJson) => {
      try {
        const imported = taskRepository.importJson(rawJson);
        syncThemeToDom(imported.settings.theme);
        set({
          tasks: imported.tasks,
          worksheetCells: imported.worksheetCells,
          dailyNotes: imported.dailyNotes,
          settings: imported.settings,
          selectedTaskId: null,
        });
        imported.tasks.forEach((t) => persistTaskToFirestore(t));
        imported.worksheetCells.forEach((c) => persistWorksheetCellToFirestore(c));
        imported.dailyNotes.forEach((n) => persistDailyNoteToFirestore(n.date, n.note));
        persistSettingsToFirestore(imported.settings);
        get().addToast({
          title: 'Backup JSON berhasil diimpor',
          description: `Memuat ${imported.tasks.length} task.`,
          variant: 'success',
        });
        return { ok: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Invalid JSON file';
        get().addToast({
          title: 'Import gagal',
          description: message,
          variant: 'danger',
        });
        return { ok: false, error: message };
      }
    },
  };
});

// Real-time Firebase Firestore Synchronization Listener
let activeUnsubscribes: Unsubscribe[] = [];

function cleanupFirestoreListeners() {
  activeUnsubscribes.forEach((unsub) => unsub());
  activeUnsubscribes = [];
}

onAuthStateChanged(auth, (user: User | null) => {
  cleanupFirestoreListeners();

  if (!user) {
    useTaskStore.setState({
      firebaseSyncStatus: 'local',
      firebaseUserEmail: null,
      firebaseUid: null,
    });
    return;
  }

  const uid = user.uid;
  useTaskStore.setState({
    firebaseSyncStatus: 'syncing',
    firebaseUserEmail: user.email || user.displayName || 'Connected',
    firebaseUid: uid,
  });

  // 1. Tasks listener
  let initialTasksSynced = false;
  const tasksPath = `users/${uid}/tasks`;
  const unsubTasks = onSnapshot(
    query(collection(db, 'users', uid, 'tasks'), where('ownerId', '==', uid)),
    (snapshot) => {
      const remoteTasks: Task[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Task;
        if (data && data.id) {
          remoteTasks.push({
            ...data,
            variations: normalizeTaskVariations(data.variations),
          });
        }
      });

      remoteTasks.sort((a, b) => b.code.localeCompare(a.code));

      if (!initialTasksSynced) {
        initialTasksSynced = true;
        const localTasks = useTaskStore.getState().tasks;
        if (remoteTasks.length === 0 && localTasks.length > 0) {
          localTasks.forEach((t) => persistTaskToFirestore(t));
          useTaskStore.setState({ firebaseSyncStatus: 'synced' });
          return;
        }
      }

      useTaskStore.setState({
        tasks: remoteTasks,
        firebaseSyncStatus: 'synced',
      });
      const state = useTaskStore.getState();
      taskRepository.saveSnapshot({
        version: 5,
        tasks: remoteTasks,
        worksheetCells: state.worksheetCells,
        dailyNotes: state.dailyNotes,
        settings: state.settings,
      });
    },
    (error) => {
      useTaskStore.setState({ firebaseSyncStatus: 'error' });
      try {
        handleFirestoreError(error, OperationType.LIST, tasksPath);
      } catch {}
    }
  );

  // 2. WorksheetCells listener
  const cellsPath = `users/${uid}/worksheetCells`;
  const unsubCells = onSnapshot(
    query(
      collection(db, 'users', uid, 'worksheetCells'),
      where('ownerId', '==', uid)
    ),
    (snapshot) => {
      const remoteCells: WorksheetCell[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        if (d && d.taskId && d.date && typeof d.minutes === 'number') {
          remoteCells.push({
            taskId: d.taskId,
            date: d.date,
            minutes: d.minutes,
          });
        }
      });
      useTaskStore.setState({ worksheetCells: remoteCells });
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, cellsPath);
      } catch {}
    }
  );

  // 3. DailyNotes listener
  const notesPath = `users/${uid}/dailyNotes`;
  const unsubNotes = onSnapshot(
    query(
      collection(db, 'users', uid, 'dailyNotes'),
      where('ownerId', '==', uid)
    ),
    (snapshot) => {
      const remoteNotes: DailyWorksheetNote[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        if (d && d.date && typeof d.note === 'string') {
          remoteNotes.push({
            date: d.date,
            note: d.note,
          });
        }
      });
      useTaskStore.setState({ dailyNotes: remoteNotes });
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, notesPath);
      } catch {}
    }
  );

  // 4. UserSettings listener
  const settingsPath = `users/${uid}/settings/main`;
  const unsubSettings = onSnapshot(
    doc(db, 'users', uid, 'settings', 'main'),
    (docSnap) => {
      if (docSnap.exists()) {
        const d = docSnap.data() as Partial<AppSettings>;
        const current = useTaskStore.getState().settings;
        const legacyRates =
          d.rates &&
          d.rates.Easy === 55 &&
          d.rates.Medium === 95 &&
          d.rates.Hard === 150;
        const merged: AppSettings = {
          ...current,
          illustratorName: d.illustratorName || user.displayName || current.illustratorName,
          passThreshold:
            typeof d.passThreshold === 'number'
              ? d.passThreshold
              : current.passThreshold,
          rates: legacyRates
            ? { Easy: 2, Medium: 3, Hard: 4 }
            : d.rates || { Easy: 2, Medium: 3, Hard: 4 },
          weeklyHourTarget:
            typeof d.weeklyHourTarget === 'number'
              ? d.weeklyHourTarget
              : current.weeklyHourTarget,
          variationCount: 10,
          theme: d.theme === 'dark' ? 'dark' : 'light',
          gdriveFolderId: d.gdriveFolderId || current.gdriveFolderId,
          gdriveFolderUrl: d.gdriveFolderUrl || current.gdriveFolderUrl,
          gdrivePrefixMode: 'title_only',
          autoUploadToGDrive:
            typeof d.autoUploadToGDrive === 'boolean'
              ? d.autoUploadToGDrive
              : current.autoUploadToGDrive,
        };
        syncThemeToDom(merged.theme);
        useTaskStore.setState({ settings: merged });
        if (legacyRates || d.variationCount !== 10 || d.gdrivePrefixMode !== 'title_only') {
          persistSettingsToFirestore(merged);
        }
      } else {
        const currentSettings = useTaskStore.getState().settings;
        const updated: AppSettings = {
          ...currentSettings,
          illustratorName:
            user.displayName && currentSettings.illustratorName === 'Senior Illustrator'
              ? user.displayName
              : currentSettings.illustratorName,
          rates: { Easy: 2, Medium: 3, Hard: 4 },
          variationCount: 10,
          gdrivePrefixMode: 'title_only',
        };
        useTaskStore.setState({ settings: updated });
        persistSettingsToFirestore(updated);
      }
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, settingsPath);
      } catch {}
    }
  );

  activeUnsubscribes.push(unsubTasks, unsubCells, unsubNotes, unsubSettings);
});
