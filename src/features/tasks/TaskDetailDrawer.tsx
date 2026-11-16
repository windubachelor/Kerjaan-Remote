import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Clock,
  CloudUpload,
  Columns2,
  ExternalLink,
  FolderCheck,
  FolderPlus,
  FolderUp,
  Layers,
  Link as LinkIcon,
  Loader2,
  Play,
  RotateCcw,
  Send,
  ShieldCheck,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { useTaskStore } from '../../store/useTaskStore';
import {
  REVISION_CAUSE_TAGS,
  RevisionCauseTag,
  VariationItem,
} from '../../types';
import {
  cn,
  formatFullDateTime,
  formatMinutes,
} from '../../lib/utils';
import {
  buildTaskSubfolderName,
  buildVariationDriveFileName,
  DEFAULT_GDRIVE_FOLDER_ID,
  DEFAULT_GDRIVE_FOLDER_URL,
  deleteFileFromGoogleDrive,
  ensureTaskSubfolderInGoogleDrive,
  formatSlotNum,
  getAccessToken,
  getSlotRawFile,
  googleSignIn,
  uploadVariationToGoogleDrive,
} from '../../lib/googleDrive';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { DifficultyTag } from '../../components/ui/DifficultyTag';
import { ScoreChip } from '../../components/ui/ScoreChip';
import { VariationSlot } from '../../components/ui/VariationSlot';
import { VariationLightboxModal } from '../../components/ui/VariationLightboxModal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { GoogleDriveConnectButton } from '../../components/ui/GoogleDriveConnectButton';
import { PaidToggleSwitch } from '../../components/ui/PaidToggleSwitch';

export const TaskDetailDrawer: React.FC = () => {
  const selectedTaskId = useTaskStore((s) => s.selectedTaskId);
  const selectTask = useTaskStore((s) => s.selectTask);
  const tasks = useTaskStore((s) => s.tasks);
  const settings = useTaskStore((s) => s.settings);
  const addToast = useTaskStore((s) => s.addToast);
  const logHistoryEvent = useTaskStore((s) => s.logHistoryEvent);
  const toggleTaskPaid = useTaskStore((s) => s.toggleTaskPaid);

  const claimTask = useTaskStore((s) => s.claimTask);
  const skipTask = useTaskStore((s) => s.skipTask);
  const deleteTask = useTaskStore((s) => s.deleteTask);
  const updateTaskMeta = useTaskStore((s) => s.updateTaskMeta);

  const updateVariationSlot = useTaskStore((s) => s.updateVariationSlot);
  const clearVariationSlot = useTaskStore((s) => s.clearVariationSlot);
  const reorderVariations = useTaskStore((s) => s.reorderVariations);
  const submitTaskVariations = useTaskStore((s) => s.submitTaskVariations);

  const recordLLMScore = useTaskStore((s) => s.recordLLMScore);
  const recordHumanReview = useTaskStore((s) => s.recordHumanReview);

  const activeTimerTaskId = useTaskStore((s) => s.activeTimerTaskId);
  const timerElapsedSeconds = useTaskStore((s) => s.timerElapsedSeconds);
  const startTimer = useTaskStore((s) => s.startTimer);
  const stopTimer = useTaskStore((s) => s.stopTimer);
  const logManualMinutes = useTaskStore((s) => s.logManualMinutes);

  const task = tasks.find((t) => t.id === selectedTaskId);

  const [activeTab, setActiveTab] = useState<'variations' | 'qa' | 'notes'>('variations');
  const [llmInput, setLlmInput] = useState('');
  const [humanInput, setHumanInput] = useState('');
  const [feedbackInput, setFeedbackInput] = useState('');
  const [selectedTags, setSelectedTags] = useState<RevisionCauseTag[]>([]);
  const [qaError, setQaError] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // Lightbox & Side-by-Side Compare Modal state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxInitialSlot, setLightboxInitialSlot] = useState(1);
  const [lightboxInitialCompare, setLightboxInitialCompare] = useState(false);

  // Google Drive Upload state & mandatory confirmation dialogs for overwriting/deleting
  const [uploadingSlotNumber, setUploadingSlotNumber] = useState<number | null>(null);
  const [isBatchUploading, setIsBatchUploading] = useState(false);
  const [batchProgressText, setBatchProgressText] = useState('');
  const [pendingOverwriteSlot, setPendingOverwriteSlot] = useState<VariationItem | null>(null);
  const [pendingBatchOverwrite, setPendingBatchOverwrite] = useState(false);
  const [pendingClearSlotWithDrive, setPendingClearSlotWithDrive] =
    useState<VariationItem | null>(null);

  useEffect(() => {
    if (!task) return;
    setLlmInput(task.qaLLM !== null ? task.qaLLM.toFixed(1) : '');
    setHumanInput(task.qaHuman !== null ? task.qaHuman.toFixed(1) : '');
    setFeedbackInput('');
    setSelectedTags(task.revisionTags ?? []);
    setQaError(null);
    setLightboxOpen(false);
    if (task.status === 'In QA' || task.status === 'Submitted') {
      setActiveTab('qa');
    } else {
      setActiveTab('variations');
    }
  }, [task?.id]);

  if (!task) return null;

  const filledCount = task.variations.filter((v) => v.filled).length;
  const syncedToDriveCount = task.variations.filter((v) => Boolean(v.driveFileId)).length;
  const totalSlots = task.variations.length;
  const isAllFilled = filledCount === totalSlots;
  const isTimerRunning = activeTimerTaskId === task.id;

  const autoSubfolderName = buildTaskSubfolderName({
    batchName: task.batchName,
    difficulty: task.difficulty,
    taskCode: task.code,
  });

  const parsedHumanPreview = parseFloat(humanInput);
  const isHumanBelowThreshold =
    !Number.isNaN(parsedHumanPreview) &&
    parsedHumanPreview >= 1.0 &&
    parsedHumanPreview < settings.passThreshold;

  const ensureDriveToken = async (): Promise<string | null> => {
    const existing = await getAccessToken();
    if (existing) return existing;
    const signedIn = await googleSignIn();
    return signedIn?.accessToken ?? null;
  };

  /**
   * Automatically creates or locates the dedicated task subfolder
   * `{batchName}_{difficulty}_{taskCode}` inside the parent Google Drive folder
   * before uploading variations.
   */
  const resolveAndSaveTaskSubfolder = async () => {
    const parentUrlOrId =
      settings.gdriveFolderUrl || settings.gdriveFolderId || DEFAULT_GDRIVE_FOLDER_ID;
    const subfolder = await ensureTaskSubfolderInGoogleDrive({
      parentFolderUrlOrId: parentUrlOrId,
      batchName: task.batchName,
      difficulty: task.difficulty,
      taskCode: task.code,
      existingSubfolderId: task.driveSubfolderId,
    });

    if (
      task.driveSubfolderId !== subfolder.folderId ||
      task.driveSubfolderName !== subfolder.folderName
    ) {
      updateTaskMeta(task.id, {
        driveSubfolderId: subfolder.folderId,
        driveSubfolderName: subfolder.folderName,
        driveSubfolderLink: subfolder.webViewLink,
      });
    }

    return subfolder;
  };

  const executeSingleSlotUpload = async (
    variation: VariationItem,
    overrideDataUrl?: string,
    overrideRawFile?: File,
    overrideTextContent?: string
  ) => {
    const dataUrlToUpload = overrideDataUrl || variation.imageUrl;
    const rawFileToUpload =
      overrideRawFile || getSlotRawFile(task.id, variation.slotNumber);
    const textContentToUpload =
      overrideTextContent !== undefined ? overrideTextContent : variation.textContent;
    const padded = formatSlotNum(variation.slotNumber);

    if (!dataUrlToUpload && !rawFileToUpload && !textContentToUpload) {
      addToast({
        title: 'Belum ada file dipilih',
        description: `Pilih file pada slot ${padded} terlebih dahulu.`,
        variant: 'warning',
      });
      return;
    }

    setUploadingSlotNumber(variation.slotNumber);
    try {
      const token = await ensureDriveToken();
      if (!token) {
        throw new Error('Silakan Login Google terlebih dahulu.');
      }

      // 1. Ensure automatic subfolder ({batchName}_{difficulty}_{code}) exists
      const subfolder = await resolveAndSaveTaskSubfolder();

      const autoFileName = buildVariationDriveFileName({
        taskCode: task.code,
        taskTitle: task.title,
        slotNumber: variation.slotNumber,
      });

      // 2. Upload file (.png, .psd, or .txt) directly into the task's dedicated subfolder
      const result = await uploadVariationToGoogleDrive({
        dataUrl: dataUrlToUpload || '',
        rawFile: rawFileToUpload,
        textContent: textContentToUpload,
        fileName: autoFileName,
        folderId: subfolder.folderId,
        existingFileId: variation.driveFileId,
        description: `Kerjaan-Remote · Folder: ${subfolder.folderName} · ${task.code} (${task.title}) · Slot ${padded}`,
      });

      const nowIso = new Date().toISOString();
      updateVariationSlot(task.id, variation.slotNumber, {
        imageName: result.name,
        driveFileId: result.fileId,
        driveFileName: result.name,
        driveWebViewLink: result.webViewLink,
        driveSyncedAt: nowIso,
        noteOrLink: result.webViewLink,
      });

      logHistoryEvent(
        task.id,
        `Uploaded Slot ${padded} to Google Drive subfolder`,
        `Folder: ${subfolder.folderName} / File: ${result.name}`
      );

      addToast({
        title: `Slot ${padded} masuk ke folder ${subfolder.folderName}`,
        description: result.name,
        variant: 'success',
      });
    } catch (err: any) {
      addToast({
        title: `Gagal upload Slot ${padded}`,
        description: err?.message || 'Periksa koneksi atau izin folder Google Drive.',
        variant: 'danger',
      });
    } finally {
      setUploadingSlotNumber(null);
    }
  };

  const handleRequestSlotUpload = (variation: VariationItem) => {
    if (variation.driveFileId) {
      setPendingOverwriteSlot(variation);
    } else {
      executeSingleSlotUpload(variation);
    }
  };

  const executeBatchUploadAll = async () => {
    const filledVariations = task.variations.filter(
      (v) => v.filled && (v.imageUrl || v.textContent)
    );
    if (filledVariations.length === 0) {
      addToast({
        title: 'Belum ada file di slot varian',
        description: 'Pilih file .png / .psd / .txt pada slot varian terlebih dahulu.',
        variant: 'warning',
      });
      return;
    }

    setIsBatchUploading(true);
    try {
      const token = await ensureDriveToken();
      if (!token) {
        throw new Error('Silakan Login Google terlebih dahulu.');
      }

      setBatchProgressText(`Membuat folder ${autoSubfolderName}...`);
      const subfolder = await resolveAndSaveTaskSubfolder();

      let successCount = 0;
      for (let i = 0; i < filledVariations.length; i++) {
        const v = filledVariations[i];
        const padded = formatSlotNum(v.slotNumber);
        setBatchProgressText(
          `Uploading ${i + 1}/${filledVariations.length} ke ${subfolder.folderName}...`
        );

        const autoFileName = buildVariationDriveFileName({
          taskCode: task.code,
          taskTitle: task.title,
          slotNumber: v.slotNumber,
        });

        const rawFile = getSlotRawFile(task.id, v.slotNumber);

        const result = await uploadVariationToGoogleDrive({
          dataUrl: v.imageUrl || '',
          rawFile,
          textContent: v.textContent,
          fileName: autoFileName,
          folderId: subfolder.folderId,
          existingFileId: v.driveFileId,
          description: `Kerjaan-Remote · Folder: ${subfolder.folderName} · ${task.code} (${task.title}) · Slot ${padded}`,
        });

        const nowIso = new Date().toISOString();
        updateVariationSlot(task.id, v.slotNumber, {
          imageName: result.name,
          driveFileId: result.fileId,
          driveFileName: result.name,
          driveWebViewLink: result.webViewLink,
          driveSyncedAt: nowIso,
          noteOrLink: result.webViewLink,
        });
        successCount += 1;
      }

      logHistoryEvent(
        task.id,
        `Uploaded ${successCount} variations to Google Drive subfolder`,
        `Subfolder: ${subfolder.folderName}`
      );

      addToast({
        title: `${successCount} file masuk ke folder ${subfolder.folderName}!`,
        description:
          'Folder task & ke-10 file (.png, _master.psd, _original.png, _notes.txt) otomatis tersusun di Google Drive.',
        variant: 'success',
      });
    } catch (err: any) {
      addToast({
        title: 'Batch upload ke Google Drive terhenti',
        description: err?.message || 'Terjadi kendala saat mengunggah ke Google Drive.',
        variant: 'danger',
      });
    } finally {
      setIsBatchUploading(false);
      setBatchProgressText('');
    }
  };

  const handleRequestBatchUpload = () => {
    const hasExistingOnDrive = task.variations.some((v) => v.filled && v.driveFileId);
    if (hasExistingOnDrive) {
      setPendingBatchOverwrite(true);
    } else {
      executeBatchUploadAll();
    }
  };

  const handleRequestClearSlot = (variation: VariationItem) => {
    if (variation.driveFileId) {
      setPendingClearSlotWithDrive(variation);
    } else {
      clearVariationSlot(task.id, variation.slotNumber);
    }
  };

  const executeClearAndDeleteDriveFile = async (variation: VariationItem) => {
    if (variation.driveFileId) {
      try {
        await deleteFileFromGoogleDrive(variation.driveFileId);
        addToast({
          title: 'File dihapus dari Google Drive & Slot',
          description: variation.driveFileName,
          variant: 'default',
        });
      } catch {
        // Still clear local slot
      }
    }
    clearVariationSlot(task.id, variation.slotNumber);
  };

  const handleSaveLLM = (e: React.FormEvent) => {
    e.preventDefault();
    setQaError(null);
    const val = parseFloat(llmInput);
    if (Number.isNaN(val) || val < 1.0 || val > 5.0) {
      setQaError('Enter a valid QA LLM score between 1.0 and 5.0 (one decimal place).');
      return;
    }
    const res = recordLLMScore(task.id, val);
    if (!res.ok && res.error) {
      setQaError(res.error);
    }
  };

  const handleSaveHuman = (e: React.FormEvent) => {
    e.preventDefault();
    setQaError(null);
    const val = parseFloat(humanInput);
    if (Number.isNaN(val) || val < 1.0 || val > 5.0) {
      setQaError('Enter a valid QA Human score between 1.0 and 5.0 (one decimal place).');
      return;
    }
    const res = recordHumanReview(task.id, val, feedbackInput, selectedTags);
    if (!res.ok && res.error) {
      setQaError(res.error);
    } else {
      setFeedbackInput('');
    }
  };

  const toggleTag = (tag: RevisionCauseTag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[1px] flex justify-end"
        onClick={() => selectTask(null)}
      >
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', stiffness: 340, damping: 32 }}
          className="w-full max-w-2xl bg-[var(--surface)] border-l border-[var(--border)] h-full flex flex-col overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Drawer Header */}
          <div className="p-4 sm:p-5 border-b border-[var(--border)] bg-[var(--surface)]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono-num text-xs font-bold px-2 py-0.5 rounded-[6px] bg-[var(--surface-muted)] text-[var(--ink)] border border-[var(--border)]">
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
                <span className="text-xs text-[var(--muted-text)] font-medium">
                  · {task.batchName}
                </span>
                {task.externalLink && (
                  <a
                    href={task.externalLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-[6px] bg-[var(--sky)] text-[var(--sky-ink)] border border-[var(--sky-border)] hover:opacity-90"
                  >
                    <LinkIcon className="w-3 h-3" />
                    <span>Buka Link Soal</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteOpen(true)}
                  className="p-1.5 rounded-[8px] text-[var(--muted-text)] hover:text-[var(--rose-ink)] hover:bg-[var(--rose)]/40 transition-colors cursor-pointer"
                  title="Delete task"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => selectTask(null)}
                  className="p-1.5 rounded-[8px] text-[var(--muted-text)] hover:text-[var(--ink)] hover:bg-[var(--surface-muted)] transition-colors cursor-pointer"
                  title="Close drawer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <h2 className="font-display text-lg sm:text-xl font-semibold text-[var(--ink)] mt-2.5 leading-snug">
              {task.title}
            </h2>

            {/* Revision Banner if in Revision */}
            {task.status === 'Revision' && task.latestFeedback && (
              <div className="mt-3 p-3 rounded-[8px] bg-[var(--rose)]/55 border border-[var(--rose-border)] text-[var(--rose-ink)]">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <RotateCcw className="w-3.5 h-3.5" />
                    {task.clientRevision
                      ? 'Status Revisi Klien (Dikembalikan dari Paid)'
                      : `Reviewer Feedback (Revision #${task.revisionCount})`}
                  </span>
                  <div className="flex items-center gap-2">
                    {task.qaHuman !== null && (
                      <span className="font-mono-num text-xs font-bold">
                        Human QA: {task.qaHuman.toFixed(1)}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setLightboxInitialSlot(9);
                        setLightboxInitialCompare(true);
                        setLightboxOpen(true);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded-[6px] bg-[var(--surface)] text-[var(--ink)] border border-[var(--border-strong)] cursor-pointer"
                    >
                      <Columns2 className="w-3 h-3" />
                      <span>Cek Side-by-Side</span>
                    </button>
                  </div>
                </div>
                <p className="text-xs leading-relaxed">{task.latestFeedback}</p>
                {task.revisionTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {task.revisionTags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 text-[11px] font-semibold rounded-[6px] bg-[var(--surface)]/80 text-[var(--rose-ink)] border border-[var(--rose-border)]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Live Time Tracker & Primary Stage Actions Bar (including Paid Toggle) */}
            <div className="mt-4 pt-3 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs text-[var(--muted-text)]">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Logged:</span>
                  <span className="font-mono-num font-bold text-[var(--ink)] tabular-nums">
                    {formatMinutes(task.timeSpentMinutes)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    isTimerRunning ? stopTimer() : startTimer(task.id)
                  }
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-[8px] border transition-colors cursor-pointer',
                    isTimerRunning
                      ? 'bg-[var(--butter)] text-[var(--butter-ink)] border-[var(--butter-border)]'
                      : 'bg-[var(--surface-muted)] text-[var(--ink)] border-[var(--border)] hover:border-[var(--border-strong)]'
                  )}
                >
                  {isTimerRunning ? (
                    <>
                      <Square className="w-3 h-3" />
                      <span className="font-mono-num tabular-nums">
                        Stop ({Math.floor(timerElapsedSeconds / 60)}:
                        {String(timerElapsedSeconds % 60).padStart(2, '0')})
                      </span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3" />
                      <span>Start Timer</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => logManualMinutes(task.id, 15)}
                  className="px-2 py-1 text-xs font-mono-num font-semibold rounded-[8px] border border-[var(--border)] text-[var(--muted-text)] hover:text-[var(--ink)] hover:bg-[var(--surface-muted)] cursor-pointer"
                >
                  +15m
                </button>
                <button
                  type="button"
                  onClick={() => logManualMinutes(task.id, 30)}
                  className="px-2 py-1 text-xs font-mono-num font-semibold rounded-[8px] border border-[var(--border)] text-[var(--muted-text)] hover:text-[var(--ink)] hover:bg-[var(--surface-muted)] cursor-pointer"
                >
                  +30m
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Paid / Sudah Dibayar Toggle Switch (Only visible when Reviewed, Paid, or Client Revision) */}
                <PaidToggleSwitch
                  task={task}
                  onTogglePaid={(id, nextPaid) => toggleTaskPaid(id, nextPaid)}
                />

                {task.status === 'Available' && (
                  <>
                    <button
                      type="button"
                      onClick={() => skipTask(task.id)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-[8px] border border-[var(--border)] text-[var(--muted-text)] hover:text-[var(--ink)] cursor-pointer"
                    >
                      Skip
                    </button>
                    <button
                      type="button"
                      onClick={() => claimTask(task.id)}
                      className="px-3.5 py-1.5 text-xs font-semibold rounded-[8px] bg-[var(--ink)] text-[var(--background)] hover:opacity-90 cursor-pointer"
                    >
                      Claim Task
                    </button>
                  </>
                )}

                {(task.status === 'In Progress' || task.status === 'Revision') && (
                  <button
                    type="button"
                    onClick={() => submitTaskVariations(task.id)}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-[8px] transition-opacity cursor-pointer',
                      isAllFilled
                        ? 'bg-[var(--ink)] text-[var(--background)] hover:opacity-90'
                        : 'bg-[var(--surface-muted)] text-[var(--muted-text)] border border-[var(--border)]'
                    )}
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>
                      {task.status === 'Revision'
                        ? `Re-submit (${filledCount}/${totalSlots})`
                        : `Submit for QA (${filledCount}/${totalSlots})`}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Section Tabs inside Drawer */}
            <div className="flex items-center gap-1 mt-4 bg-[var(--surface-muted)] p-1 rounded-[8px]">
              <button
                type="button"
                onClick={() => setActiveTab('variations')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 sm:px-3 rounded-[6px] text-xs font-semibold transition-colors cursor-pointer',
                  activeTab === 'variations'
                    ? 'bg-[var(--surface)] text-[var(--ink)] shadow-2xs'
                    : 'text-[var(--muted-text)] hover:text-[var(--ink)]'
                )}
              >
                <Layers className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  10 Varian & GDrive ({filledCount}/{totalSlots})
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('qa')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 sm:px-3 rounded-[6px] text-xs font-semibold transition-colors cursor-pointer',
                  activeTab === 'qa'
                    ? 'bg-[var(--surface)] text-[var(--ink)] shadow-2xs'
                    : 'text-[var(--muted-text)] hover:text-[var(--ink)]'
                )}
              >
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">QA Review & Scores</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('notes')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 sm:px-3 rounded-[6px] text-xs font-semibold transition-colors cursor-pointer',
                  activeTab === 'notes'
                    ? 'bg-[var(--surface)] text-[var(--ink)] shadow-2xs'
                    : 'text-[var(--muted-text)] hover:text-[var(--ink)]'
                )}
              >
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Detail & Log ({task.history.length})</span>
              </button>
            </div>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
            <AnimatePresence mode="wait">
              {/* TAB 1: 10-VARIATION TRACKER & GOOGLE DRIVE DIRECT UPLOAD */}
              {activeTab === 'variations' && (
                <motion.div
                  key="tab-variations"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-4"
                >
                  {/* Google Drive Sync Control Panel with Auto-Subfolder Preview */}
                  <div className="rounded-[12px] border border-[var(--border-strong)] bg-[var(--surface-muted)]/60 p-4 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <FolderUp className="w-4 h-4 text-[var(--ink)]" />
                          <span className="font-display text-sm font-bold text-[var(--ink)]">
                            Auto-Folder & 10 Varian Google Drive
                          </span>
                        </div>
                        <p className="text-xs text-[var(--muted-text)]">
                          Parent Folder:{' '}
                          <a
                            href={settings.gdriveFolderUrl || DEFAULT_GDRIVE_FOLDER_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono-num font-semibold text-[var(--ink)] underline inline-flex items-center gap-1"
                          >
                            1M8T97bFGhhluvTnKGOQabhle4UJ4OWip
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </p>
                      </div>

                      <GoogleDriveConnectButton compact showFolderLink={false} />
                    </div>

                    {/* Automatic Subfolder Banner: (sesuai_nama_batch + sesuai_difficulty + no_task) */}
                    <div className="p-2.5 rounded-[8px] bg-[var(--surface)] border border-[var(--border)] flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {task.driveSubfolderId ? (
                          <FolderCheck className="w-4 h-4 text-[var(--sage-ink)] shrink-0" />
                        ) : (
                          <FolderPlus className="w-4 h-4 text-[var(--butter-ink)] shrink-0" />
                        )}
                        <div className="min-w-0">
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--muted-text)]">
                            Subfolder Otomatis (Batch + Difficulty + No Task)
                          </span>
                          <code className="font-mono-num text-xs font-bold text-[var(--ink)] truncate block">
                            /{autoSubfolderName}/
                          </code>
                        </div>
                      </div>

                      {task.driveSubfolderLink ? (
                        <a
                          href={task.driveSubfolderLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-[6px] bg-[var(--sage)] text-[var(--sage-ink)] border border-[var(--sage-border)] hover:opacity-90 shrink-0"
                        >
                          <span>Buka Subfolder Task</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-[6px] bg-[var(--butter)]/60 text-[var(--butter-ink)] border border-[var(--butter-border)]">
                          Dibuat otomatis saat Upload
                        </span>
                      )}
                    </div>

                    {/* Format Info & Action Buttons */}
                    <div className="pt-2 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[var(--muted-text)]">
                          Format Baku:
                        </span>
                        <code className="px-2 py-0.5 text-xs font-mono-num font-bold rounded-[6px] bg-[var(--surface)] border border-[var(--border)] text-[var(--ink)]">
                          Title_suffix (.png / .psd / .txt)
                        </code>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setLightboxInitialSlot(9);
                            setLightboxInitialCompare(true);
                            setLightboxOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-[8px] border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-muted)] transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <Columns2 className="w-3.5 h-3.5" />
                          <span>Side-by-Side Compare</span>
                        </button>

                        <button
                          type="button"
                          disabled={isBatchUploading || filledCount === 0}
                          onClick={handleRequestBatchUpload}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-[8px] bg-[var(--ink)] text-[var(--background)] hover:opacity-90 disabled:opacity-40 transition-opacity cursor-pointer whitespace-nowrap"
                        >
                          {isBatchUploading ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>{batchProgressText || 'Uploading...'}</span>
                            </>
                          ) : (
                            <>
                              <CloudUpload className="w-3.5 h-3.5" />
                              <span>
                                Upload Semua ({filledCount}/{totalSlots}) ke Folder Task
                              </span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Progress Strip */}
                  <div className="flex items-center justify-between text-xs text-[var(--muted-text)] px-1">
                    <span>
                      Terisi:{' '}
                      <strong className="font-mono-num text-[var(--ink)]">
                        {filledCount}/{totalSlots}
                      </strong>{' '}
                      varian (termasuk Gambar Asli & File .txt)
                    </span>
                    <span>
                      Tersinkron ke GDrive:{' '}
                      <strong className="font-mono-num text-[var(--sage-ink)]">
                        {syncedToDriveCount}/{totalSlots}
                      </strong>{' '}
                      file
                    </span>
                  </div>

                  <div className="h-2 w-full rounded-full bg-[var(--surface-muted)] overflow-hidden flex gap-0.5 p-0.5 border border-[var(--border)]">
                    {task.variations.map((v) => (
                      <div
                        key={v.slotNumber}
                        className={cn(
                          'flex-1 h-full rounded-full transition-colors duration-150',
                          v.driveFileId
                            ? 'bg-[var(--sage-ink)]'
                            : v.filled
                            ? 'bg-[var(--butter-ink)]'
                            : 'bg-transparent'
                        )}
                      />
                    ))}
                  </div>

                  {/* 10 Variation Slots */}
                  <div className="space-y-2.5">
                    {task.variations.map((variation, idx) => (
                      <VariationSlot
                        key={variation.slotNumber}
                        variation={variation}
                        taskId={task.id}
                        taskCode={task.code}
                        taskTitle={task.title}
                        totalSlots={totalSlots}
                        isUploading={uploadingSlotNumber === variation.slotNumber}
                        onUpdate={(data) =>
                          updateVariationSlot(task.id, variation.slotNumber, data)
                        }
                        onFileUploadSelected={async (
                          file,
                          dataUrl,
                          _autoName,
                          textContent
                        ) => {
                          if (settings.autoUploadToGDrive) {
                            const existingToken = await getAccessToken();
                            if (existingToken && !variation.driveFileId) {
                              executeSingleSlotUpload(
                                variation,
                                dataUrl,
                                file,
                                textContent
                              );
                            }
                          }
                        }}
                        onUploadToDrive={() => handleRequestSlotUpload(variation)}
                        onClear={() => handleRequestClearSlot(variation)}
                        onOpenLightbox={(slotNum) => {
                          setLightboxInitialSlot(slotNum);
                          setLightboxInitialCompare(false);
                          setLightboxOpen(true);
                        }}
                        onMoveUp={
                          idx > 0
                            ? () => reorderVariations(task.id, idx, idx - 1)
                            : undefined
                        }
                        onMoveDown={
                          idx < totalSlots - 1
                            ? () => reorderVariations(task.id, idx, idx + 1)
                            : undefined
                        }
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* TAB 2: SEQUENTIAL QA EVALUATION & REVISION LOOP */}
              {activeTab === 'qa' && (
                <motion.div
                  key="tab-qa"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-5"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-[12px] border border-[var(--border)] bg-[var(--surface-muted)]/40">
                      <span className="text-xs text-[var(--muted-text)] block mb-1">
                        1. QA LLM Score
                      </span>
                      <ScoreChip score={task.qaLLM} size="lg" />
                    </div>
                    <div className="p-3.5 rounded-[12px] border border-[var(--border)] bg-[var(--surface-muted)]/40">
                      <span className="text-xs text-[var(--muted-text)] block mb-1">
                        2. QA Human Score
                      </span>
                      <ScoreChip score={task.qaHuman} size="lg" />
                    </div>
                    <div className="p-3.5 rounded-[12px] border border-[var(--border)] bg-[var(--surface-muted)]/40">
                      <span className="text-xs text-[var(--muted-text)] block mb-1">
                        Pass Threshold
                      </span>
                      <span className="font-mono-num text-sm font-semibold text-[var(--ink)]">
                        ≥ {settings.passThreshold.toFixed(1)}
                      </span>
                      <span className="block text-[11px] text-[var(--muted-text)] mt-0.5">
                        Revisions: {task.revisionCount}
                      </span>
                    </div>
                  </div>

                  {qaError && (
                    <div className="p-3 rounded-[8px] bg-[var(--rose)] text-[var(--rose-ink)] border border-[var(--rose-border)] text-xs font-medium">
                      {qaError}
                    </div>
                  )}

                  {/* Step 1: QA LLM Evaluation Form */}
                  <form
                    onSubmit={handleSaveLLM}
                    className="p-4 rounded-[12px] border border-[var(--border)] bg-[var(--surface)] space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-display text-sm font-semibold text-[var(--ink)]">
                          Step 1 · Automated LLM QA Review
                        </h3>
                        <p className="text-xs text-[var(--muted-text)]">
                          Decimal score from 1.0 to 5.0 (one decimal place, e.g. 4.2). Requires all {totalSlots} variations filled.
                        </p>
                      </div>
                      {task.qaLLM !== null && (
                        <ScoreChip score={task.qaLLM} prefix="Recorded" />
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      <input
                        type="number"
                        step="0.1"
                        min="1.0"
                        max="5.0"
                        placeholder="4.2"
                        value={llmInput}
                        onChange={(e) => setLlmInput(e.target.value)}
                        disabled={!isAllFilled}
                        className="w-32 px-3 py-1.5 text-sm font-mono-num rounded-[8px] border border-[var(--border-strong)] bg-[var(--background)] text-[var(--ink)] disabled:opacity-50"
                      />
                      <button
                        type="submit"
                        disabled={!isAllFilled}
                        className="px-3.5 py-1.5 text-xs font-semibold rounded-[8px] bg-[var(--ink)] text-[var(--background)] hover:opacity-90 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                      >
                        Save LLM Score
                      </button>
                      {!isAllFilled && (
                        <span className="text-xs text-[var(--rose-ink)]">
                          Fill all {totalSlots} variations first ({filledCount}/{totalSlots})
                        </span>
                      )}
                    </div>
                  </form>

                  {/* Step 2: QA Human Review Form */}
                  <form
                    onSubmit={handleSaveHuman}
                    className={cn(
                      'p-4 rounded-[12px] border space-y-3 transition-opacity',
                      task.qaLLM === null
                        ? 'border-[var(--border)] bg-[var(--surface-muted)]/40 opacity-60'
                        : 'border-[var(--border)] bg-[var(--surface)]'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-display text-sm font-semibold text-[var(--ink)]">
                          Step 2 · Senior Human QA Review
                        </h3>
                        <p className="text-xs text-[var(--muted-text)]">
                          Score ≥ {settings.passThreshold.toFixed(1)} moves task to Reviewed (and unlocks Paid toggle). Score &lt;{' '}
                          {settings.passThreshold.toFixed(1)} triggers a Revision loop.
                        </p>
                      </div>
                      {task.qaLLM === null && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-[6px] bg-[var(--butter)] text-[var(--butter-ink)]">
                          Requires Step 1 LLM Score
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        type="number"
                        step="0.1"
                        min="1.0"
                        max="5.0"
                        placeholder="4.5"
                        value={humanInput}
                        onChange={(e) => setHumanInput(e.target.value)}
                        disabled={task.qaLLM === null}
                        className="w-32 px-3 py-1.5 text-sm font-mono-num rounded-[8px] border border-[var(--border-strong)] bg-[var(--background)] text-[var(--ink)] disabled:opacity-50"
                      />

                      {!Number.isNaN(parsedHumanPreview) &&
                        parsedHumanPreview >= 1.0 &&
                        parsedHumanPreview <= 5.0 && (
                          <span
                            className={cn(
                              'text-xs font-semibold px-2.5 py-1 rounded-[8px] border',
                              parsedHumanPreview >= settings.passThreshold
                                ? 'bg-[var(--sage)] text-[var(--sage-ink)] border-[var(--sage-border)]'
                                : 'bg-[var(--rose)] text-[var(--rose-ink)] border-[var(--rose-border)]'
                            )}
                          >
                            {parsedHumanPreview >= settings.passThreshold
                              ? `Passes (≥ ${settings.passThreshold.toFixed(1)}) → Reviewed`
                              : `Fails (< ${settings.passThreshold.toFixed(1)}) → Revision #${
                                  task.revisionCount + 1
                                }`}
                          </span>
                        )}
                    </div>

                    <div className="space-y-2.5 pt-1">
                      <label className="block text-xs font-semibold text-[var(--ink)]">
                        {isHumanBelowThreshold
                          ? 'Reviewer Feedback (Required for Revision)'
                          : 'Reviewer Notes (Optional on Pass)'}
                      </label>
                      <textarea
                        rows={2}
                        value={feedbackInput}
                        onChange={(e) => setFeedbackInput(e.target.value)}
                        disabled={task.qaLLM === null}
                        placeholder={
                          isHumanBelowThreshold
                            ? 'Describe which variation slots need adjustment...'
                            : 'Optional commendation or final delivery note...'
                        }
                        className="w-full px-3 py-2 text-xs rounded-[8px] border border-[var(--border-strong)] bg-[var(--background)] text-[var(--ink)]"
                      />

                      {isHumanBelowThreshold && (
                        <div>
                          <span className="block text-[11px] font-semibold text-[var(--muted-text)] mb-1.5">
                            Revision Cause Tags (used in Analytics)
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {REVISION_CAUSE_TAGS.map((tag) => {
                              const active = selectedTags.includes(tag);
                              return (
                                <button
                                  key={tag}
                                  type="button"
                                  onClick={() => toggleTag(tag)}
                                  className={cn(
                                    'px-2.5 py-1 text-xs rounded-[8px] border transition-colors cursor-pointer',
                                    active
                                      ? 'bg-[var(--rose)] text-[var(--rose-ink)] border-[var(--rose-border)] font-semibold'
                                      : 'bg-[var(--surface-muted)] text-[var(--muted-text)] border-[var(--border)] hover:text-[var(--ink)]'
                                  )}
                                >
                                  {tag}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={task.qaLLM === null}
                      className="px-4 py-2 text-xs font-semibold rounded-[8px] bg-[var(--ink)] text-[var(--background)] hover:opacity-90 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                    >
                      Record Human Review Decision
                    </button>
                  </form>

                  {/* Past Revision History */}
                  {task.revisionHistory.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-display text-xs font-semibold text-[var(--muted-text)] uppercase tracking-wider">
                        Revision History ({task.revisionHistory.length})
                      </h4>
                      <div className="space-y-2">
                        {task.revisionHistory.map((rev) => (
                          <div
                            key={rev.id}
                            className="p-3.5 rounded-[12px] border border-[var(--border)] bg-[var(--surface-muted)]/40 space-y-1.5"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-[var(--ink)]">
                                Revision #{rev.revisionNumber}
                              </span>
                              <div className="flex items-center gap-2">
                                <ScoreChip score={rev.llmScore} prefix="LLM" />
                                <ScoreChip score={rev.humanScore} prefix="Human" />
                                <span className="text-[var(--muted-text)] font-mono-num">
                                  {formatFullDateTime(rev.timestamp)}
                                </span>
                              </div>
                            </div>
                            <p className="text-xs text-[var(--ink)] leading-relaxed">
                              {rev.feedback}
                            </p>
                            {rev.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-1">
                                {rev.tags.map((t) => (
                                  <span
                                    key={t}
                                    className="px-2 py-0.5 text-[10px] rounded-[6px] bg-[var(--surface)] border border-[var(--border)] text-[var(--muted-text)]"
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* TAB 3: NOTES, METADATA & ACTIVITY LOG */}
              {activeTab === 'notes' && (
                <motion.div
                  key="tab-notes"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-5"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                        Nomor Task / Platform ID
                      </label>
                      <input
                        type="text"
                        value={task.code}
                        onChange={(e) =>
                          updateTaskMeta(task.id, { code: e.target.value })
                        }
                        className="w-full px-3 py-1.5 text-xs font-mono-num rounded-[8px] border border-[var(--border-strong)] bg-[var(--background)] text-[var(--ink)]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                        Judul Task (Untuk Penamaan File)
                      </label>
                      <input
                        type="text"
                        value={task.title}
                        onChange={(e) =>
                          updateTaskMeta(task.id, { title: e.target.value })
                        }
                        className="w-full px-3 py-1.5 text-xs rounded-[8px] border border-[var(--border-strong)] bg-[var(--background)] text-[var(--ink)]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                      Link Task / Prompt Platform URL
                    </label>
                    <input
                      type="url"
                      placeholder="https://platform.example.com/tasks/..."
                      value={task.externalLink || ''}
                      onChange={(e) =>
                        updateTaskMeta(task.id, { externalLink: e.target.value })
                      }
                      className="w-full px-3 py-1.5 text-xs font-mono-num rounded-[8px] border border-[var(--border-strong)] bg-[var(--background)] text-[var(--ink)]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                        Batch Name
                      </label>
                      <input
                        type="text"
                        value={task.batchName}
                        onChange={(e) =>
                          updateTaskMeta(task.id, { batchName: e.target.value })
                        }
                        className="w-full px-3 py-1.5 text-xs rounded-[8px] border border-[var(--border-strong)] bg-[var(--background)] text-[var(--ink)]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                        Difficulty Tier
                      </label>
                      <select
                        value={task.difficulty}
                        onChange={(e) =>
                          updateTaskMeta(task.id, {
                            difficulty: e.target.value as typeof task.difficulty,
                          })
                        }
                        className="w-full px-3 py-1.5 text-xs rounded-[8px] border border-[var(--border-strong)] bg-[var(--background)] text-[var(--ink)]"
                      >
                        <option value="Easy">Easy (${settings.rates.Easy})</option>
                        <option value="Medium">Medium (${settings.rates.Medium})</option>
                        <option value="Hard">Hard (${settings.rates.Hard})</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-[var(--ink)]">
                      Illustrator Working Notes
                    </label>
                    <textarea
                      rows={4}
                      value={task.notes}
                      onChange={(e) =>
                        updateTaskMeta(task.id, { notes: e.target.value })
                      }
                      placeholder="Add camera angle specs, stroke weights, or batch links..."
                      className="w-full px-3 py-2 text-[13px] rounded-[8px] border border-[var(--border-strong)] bg-[var(--background)] text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--ink)]"
                    />
                  </div>

                  {/* Activity Log */}
                  <div className="pt-2 border-t border-[var(--border)]">
                    <h3 className="font-display text-sm font-semibold text-[var(--ink)] mb-3">
                      Chronological Activity Log
                    </h3>
                    <div className="space-y-2.5">
                      {task.history.map((event) => (
                        <div
                          key={event.id}
                          className="flex items-start justify-between gap-3 p-3 rounded-[8px] border border-[var(--border)] bg-[var(--surface-muted)]/35 text-xs"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-[var(--ink)]">
                                {event.action}
                              </span>
                              <span className="text-[11px] text-[var(--muted-text)]">
                                · {event.actor}
                              </span>
                            </div>
                            {event.details && (
                              <p className="text-[var(--muted-text)] leading-relaxed">
                                {event.details}
                              </p>
                            )}
                          </div>
                          <span className="font-mono-num text-[11px] text-[var(--muted-text)] whitespace-nowrap shrink-0">
                            {formatFullDateTime(event.timestamp)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>

      {/* Lightbox & Side-by-Side Revision Compare Modal */}
      <VariationLightboxModal
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        task={task}
        initialSlotNumber={lightboxInitialSlot}
        initialCompareMode={lightboxInitialCompare}
      />

      {/* Confirm Delete Task */}
      <ConfirmDialog
        open={confirmDeleteOpen}
        title={`Delete ${task.code}?`}
        description={`This will remove "${task.title}" and its variation records from your Kerjaan-Remote ledger. You can undo immediately from the toast notification.`}
        confirmLabel="Delete Task"
        onConfirm={() => deleteTask(task.id)}
        onCancel={() => setConfirmDeleteOpen(false)}
      />

      {/* Mandatory Confirmation Dialog before Overwriting Existing Google Drive File */}
      <ConfirmDialog
        open={Boolean(pendingOverwriteSlot)}
        title={`Update Existing File in Google Drive?`}
        description={`Slot ${
          pendingOverwriteSlot ? formatSlotNum(pendingOverwriteSlot.slotNumber) : ''
        } (${pendingOverwriteSlot?.driveFileName}) already exists in your Google Drive folder (${autoSubfolderName}). Confirming will overwrite the existing Google Drive file content with the updated variation.`}
        confirmLabel="Overwrite in Google Drive"
        variant="default"
        onConfirm={() => {
          if (pendingOverwriteSlot) {
            executeSingleSlotUpload(pendingOverwriteSlot);
          }
        }}
        onCancel={() => setPendingOverwriteSlot(null)}
      />

      {/* Mandatory Confirmation Dialog before Batch Overwriting Existing Google Drive Files */}
      <ConfirmDialog
        open={pendingBatchOverwrite}
        title="Update Variations in Google Drive?"
        description={`One or more variations for ${task.code} have already been uploaded to folder "${autoSubfolderName}". Proceeding will update existing files and upload any new variations across all ${filledCount} filled slots.`}
        confirmLabel="Confirm Batch Upload"
        variant="default"
        onConfirm={() => executeBatchUploadAll()}
        onCancel={() => setPendingBatchOverwrite(false)}
      />

      {/* Mandatory Confirmation Dialog before Deleting a Synced Slot from Google Drive */}
      <ConfirmDialog
        open={Boolean(pendingClearSlotWithDrive)}
        title="Delete File from Google Drive & Clear Slot?"
        description={`Slot ${
          pendingClearSlotWithDrive
            ? formatSlotNum(pendingClearSlotWithDrive.slotNumber)
            : ''
        } is synced to Google Drive as "${pendingClearSlotWithDrive?.driveFileName}". Confirming will delete this file from Google Drive and clear the variation slot.`}
        confirmLabel="Delete from Google Drive"
        variant="danger"
        onConfirm={() => {
          if (pendingClearSlotWithDrive) {
            executeClearAndDeleteDriveFile(pendingClearSlotWithDrive);
          }
        }}
        onCancel={() => setPendingClearSlotWithDrive(null)}
      />
    </>
  );
};
