import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FolderPlus, Hash, Link as LinkIcon, X } from 'lucide-react';
import { addDays, format } from 'date-fns';
import { useTaskStore } from '../../store/useTaskStore';
import { taskCreateSchema, TaskCreateFormValues } from '../../types';
import { buildTaskSubfolderName } from '../../lib/googleDrive';

export const AddTaskDialog: React.FC = () => {
  const isOpen = useTaskStore((s) => s.isAddModalOpen);
  const setOpen = useTaskStore((s) => s.setAddModalOpen);
  const addTask = useTaskStore((s) => s.addTask);
  const selectTask = useTaskStore((s) => s.selectTask);
  const settings = useTaskStore((s) => s.settings);

  const defaultDeadline = format(addDays(new Date(), 3), 'yyyy-MM-dd');

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<TaskCreateFormValues>({
    resolver: zodResolver(taskCreateSchema),
    defaultValues: {
      title: '',
      customCode: '',
      externalLink: '',
      batchName: 'Batch-2411-Editorial',
      difficulty: 'Medium',
      status: 'In Progress',
      deadline: defaultDeadline,
      notes: '',
    },
  });

  if (!isOpen) return null;

  const watchedBatch = watch('batchName') || 'Batch';
  const watchedDifficulty = watch('difficulty') || 'Medium';
  const watchedCustomCode = watch('customCode')?.trim() || 'KR-1001';

  const previewSubfolder = buildTaskSubfolderName({
    batchName: watchedBatch,
    difficulty: watchedDifficulty,
    taskCode: watchedCustomCode,
  });

  const onSubmit = (values: TaskCreateFormValues) => {
    const created = addTask(values);
    reset();
    setOpen(false);
    selectTask(created.id);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[1px]"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl bg-[var(--surface)] border border-[var(--border)] rounded-[14px] p-6 shadow-xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-[var(--border)]">
          <div>
            <h2 className="font-display text-lg font-bold text-[var(--ink)]">
              Tambah Task Evaluasi Baru
            </h2>
            <p className="text-xs text-[var(--muted-text)] mt-0.5">
              Setiap task memiliki 10 slot file (01–08 varian, 09: _original.png, 10: _notes.txt) dengan penamaan otomatis Title_suffix.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-[8px] text-[var(--muted-text)] hover:text-[var(--ink)] hover:bg-[var(--surface-muted)] cursor-pointer"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
              Judul Task / Nama Karakter / Subjek (Digunakan sebagai Nama File)
            </label>
            <input
              type="text"
              placeholder="Contoh: Kyoto_Machiya atau Character_Hero_A"
              {...register('title')}
              className="w-full px-3 py-2 text-[13px] rounded-[8px] border border-[var(--border-strong)] bg-[var(--background)] text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--ink)]"
              autoFocus
            />
            {errors.title && (
              <p className="mt-1 text-xs text-[var(--rose-ink)]">
                {errors.title.message}
              </p>
            )}
          </div>

          {/* Custom Nomor Task / Platform ID & Link Prompt */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ink)] mb-1">
                <Hash className="w-3.5 h-3.5 text-[var(--muted-text)]" />
                <span>Nomor Task / Platform ID (Opsional)</span>
              </label>
              <input
                type="text"
                placeholder="Contoh: 204 atau TASK-88"
                {...register('customCode')}
                className="w-full px-3 py-2 text-[13px] font-mono-num rounded-[8px] border border-[var(--border-strong)] bg-[var(--background)] text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--ink)]"
              />
              <span className="block text-[10px] text-[var(--muted-text)] mt-1">
                Kosongkan untuk nomor urut otomatis (KR-1001).
              </span>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ink)] mb-1">
                <LinkIcon className="w-3.5 h-3.5 text-[var(--muted-text)]" />
                <span>Link Task / Prompt URL (Opsional)</span>
              </label>
              <input
                type="url"
                placeholder="https://platform.example.com/tasks/..."
                {...register('externalLink')}
                className="w-full px-3 py-2 text-[13px] font-mono-num rounded-[8px] border border-[var(--border-strong)] bg-[var(--background)] text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--ink)]"
              />
              <span className="block text-[10px] text-[var(--muted-text)] mt-1">
                Buka langsung halaman soal/prompt dari drawer task.
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                Nama Batch
              </label>
              <input
                type="text"
                list="batch-suggestions"
                placeholder="Batch-2411-Editorial"
                {...register('batchName')}
                className="w-full px-3 py-2 text-[13px] rounded-[8px] border border-[var(--border-strong)] bg-[var(--background)] text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--ink)]"
              />
              <datalist id="batch-suggestions">
                <option value="Batch-2411-Editorial" />
                <option value="Batch-2411-Spatial" />
                <option value="Batch-2411-Character" />
                <option value="Batch-2411-Botanical" />
                <option value="Batch-2411-Iconography" />
                <option value="Batch-2411-Technical" />
              </datalist>
              {errors.batchName && (
                <p className="mt-1 text-xs text-[var(--rose-ink)]">
                  {errors.batchName.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                Tingkat Kesulitan & Tarif
              </label>
              <select
                {...register('difficulty')}
                className="w-full px-3 py-2 text-[13px] rounded-[8px] border border-[var(--border-strong)] bg-[var(--background)] text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--ink)]"
              >
                <option value="Easy">Easy (${settings.rates.Easy})</option>
                <option value="Medium">Medium (${settings.rates.Medium})</option>
                <option value="Hard">Hard (${settings.rates.Hard})</option>
              </select>
            </div>
          </div>

          {/* Live Subfolder Preview */}
          <div className="p-2.5 rounded-[8px] bg-[var(--surface-muted)]/70 border border-[var(--border)] flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <FolderPlus className="w-4 h-4 text-[var(--butter-ink)] shrink-0" />
              <span className="text-[var(--muted-text)]">Subfolder GDrive:</span>
              <code className="font-mono-num font-bold text-[var(--ink)] truncate">
                /{previewSubfolder}/
              </code>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                Status Awal
              </label>
              <select
                {...register('status')}
                className="w-full px-3 py-2 text-[13px] rounded-[8px] border border-[var(--border-strong)] bg-[var(--background)] text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--ink)]"
              >
                <option value="In Progress">Langsung Kerjakan (In Progress)</option>
                <option value="Available">Simpan di Antrean (Available)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                Target Deadline (Opsional)
              </label>
              <input
                type="date"
                {...register('deadline')}
                className="w-full px-3 py-2 text-[13px] font-mono-num rounded-[8px] border border-[var(--border-strong)] bg-[var(--background)] text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--ink)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
              Catatan Brief / Instruksi Style
            </label>
            <textarea
              rows={2}
              placeholder="Catatan proporsi, ekspresi karakter, atau detail object swap..."
              {...register('notes')}
              className="w-full px-3 py-2 text-[13px] rounded-[8px] border border-[var(--border-strong)] bg-[var(--background)] text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--ink)]"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2 text-xs font-semibold rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-muted)] cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-[8px] bg-[var(--ink)] text-[var(--background)] hover:opacity-90 cursor-pointer"
            >
              Buat Task (10 Slot Varian)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
