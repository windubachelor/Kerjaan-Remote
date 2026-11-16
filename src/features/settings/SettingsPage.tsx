import React, { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Download,
  ExternalLink,
  FolderUp,
  Moon,
  RotateCcw,
  Save,
  Sun,
  Upload,
} from 'lucide-react';
import { useTaskStore } from '../../store/useTaskStore';
import { settingsFormSchema, SettingsFormValues } from '../../types';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { GoogleDriveConnectButton } from '../../components/ui/GoogleDriveConnectButton';
import {
  buildVariationDriveFileName,
  DEFAULT_GDRIVE_FOLDER_URL,
  extractDriveFolderId,
  formatSlotNum,
  VARIATION_GDRIVE_SPECS,
} from '../../lib/googleDrive';

export const SettingsPage: React.FC = () => {
  const settings = useTaskStore((s) => s.settings);
  const updateSettings = useTaskStore((s) => s.updateSettings);
  const resetAllData = useTaskStore((s) => s.resetAllData);
  const exportLedgerJson = useTaskStore((s) => s.exportLedgerJson);
  const importLedgerJson = useTaskStore((s) => s.importLedgerJson);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      illustratorName: settings.illustratorName,
      passThreshold: settings.passThreshold,
      rateEasy: settings.rates.Easy,
      rateMedium: settings.rates.Medium,
      rateHard: settings.rates.Hard,
      weeklyHourTarget: settings.weeklyHourTarget,
      variationCount: 10,
      theme: settings.theme,
      gdriveFolderUrl: settings.gdriveFolderUrl || DEFAULT_GDRIVE_FOLDER_URL,
      gdrivePrefixMode: 'title_only',
      autoUploadToGDrive: settings.autoUploadToGDrive ?? true,
    },
  });

  const currentTheme = watch('theme');
  const currentThreshold = watch('passThreshold');
  const currentFolderUrl = watch('gdriveFolderUrl');

  const onSubmit = (values: SettingsFormValues) => {
    const extractedId = extractDriveFolderId(values.gdriveFolderUrl);
    updateSettings({
      illustratorName: values.illustratorName,
      passThreshold: Math.round(values.passThreshold * 10) / 10,
      rates: {
        Easy: values.rateEasy,
        Medium: values.rateMedium,
        Hard: values.rateHard,
      },
      weeklyHourTarget: values.weeklyHourTarget,
      variationCount: 10,
      theme: values.theme,
      gdriveFolderUrl: values.gdriveFolderUrl,
      gdriveFolderId: extractedId,
      gdrivePrefixMode: 'title_only',
      autoUploadToGDrive: values.autoUploadToGDrive,
    });
  };

  const handleExportJson = () => {
    const json = exportLedgerJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kerjaan-remote-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        importLedgerJson(reader.result);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[var(--ink)] tracking-tight">
          Pengaturan Kerjaan-Remote, Firebase & Google Drive
        </h1>
        <p className="text-xs text-[var(--muted-text)] mt-0.5">
          Konfigurasi folder Google Drive otomatis untuk 10 file varian (termasuk gambar asli & .txt), batas skor QA, tarif per kesulitan ($2/$3/$4), dan backup data.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Google Drive Integration & 10-Variation Auto-Naming Card */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[12px] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
            <div className="flex items-center gap-2">
              <FolderUp className="w-4 h-4 text-[var(--ink)]" />
              <h2 className="font-display text-base font-bold text-[var(--ink)]">
                Integrasi Google Drive & Format Baku 10 File Varian
              </h2>
            </div>
            <GoogleDriveConnectButton showFolderLink={false} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-[var(--ink)]">
                Link Folder Google Drive Tujuan
              </label>
              <a
                href={currentFolderUrl || DEFAULT_GDRIVE_FOLDER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--ink)] hover:underline"
              >
                <span>Buka Folder di GDrive</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <input
              type="text"
              {...register('gdriveFolderUrl')}
              className="w-full px-3 py-2 text-xs font-mono-num rounded-[8px] border border-[var(--border-strong)] bg-[var(--background)] text-[var(--ink)]"
            />
            {errors.gdriveFolderUrl && (
              <p className="text-xs text-[var(--rose-ink)] mt-1">
                {errors.gdriveFolderUrl.message}
              </p>
            )}
            <p className="text-[11px] text-[var(--muted-text)] mt-1">
              Folder ID Aktif:{' '}
              <code className="font-mono-num font-bold text-[var(--ink)]">
                {extractDriveFolderId(currentFolderUrl || DEFAULT_GDRIVE_FOLDER_URL)}
              </code>
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div>
              <span className="block text-xs font-semibold text-[var(--ink)]">
                Format Nama File (Tunggal & Terkunci)
              </span>
              <span className="text-[11px] text-[var(--muted-text)]">
                Title Only + Suffix (8 file .png + Slot 06 .psd + Slot 10 .txt)
              </span>
            </div>

            <label className="inline-flex items-center gap-2.5 text-xs font-semibold text-[var(--ink)] cursor-pointer select-none">
              <input
                type="checkbox"
                {...register('autoUploadToGDrive')}
                className="w-4 h-4 rounded border-[var(--border-strong)]"
              />
              <span>
                Auto-upload ke GDrive saat memilih file di slot varian
              </span>
            </label>
          </div>

          {/* Live Preview of all 10 Standardized Filenames */}
          <div className="p-3.5 rounded-[10px] bg-[var(--surface-muted)]/70 border border-[var(--border)] space-y-2">
            <span className="text-xs font-bold text-[var(--ink)] block">
              Preview Otomatis 10 Nama File di Google Drive (Format Title Only):
            </span>
            <div className="grid grid-cols-1 gap-1.5">
              {VARIATION_GDRIVE_SPECS.map((spec) => {
                const sampleName = buildVariationDriveFileName({
                  taskTitle: 'Kyoto_Machiya',
                  slotNumber: spec.slotNumber,
                });
                return (
                  <div
                    key={spec.slotNumber}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-[6px] bg-[var(--surface)] border border-[var(--border)] text-xs"
                  >
                    <span className="font-semibold text-[var(--muted-text)]">
                      {formatSlotNum(spec.slotNumber)}: _{spec.suffix} (
                      {spec.requiredExt === 'psd'
                        ? 'harus file .psd'
                        : spec.requiredExt === 'txt'
                        ? 'file teks .txt'
                        : spec.slotNumber === 9
                        ? 'gambar asli task .png'
                        : 'gambar .png'}
                      )
                    </span>
                    <code
                      className={`font-mono-num font-bold ${
                        spec.requiredExt === 'psd'
                          ? 'text-[var(--lavender-ink)]'
                          : spec.requiredExt === 'txt'
                          ? 'text-[var(--sky-ink)]'
                          : 'text-[var(--ink)]'
                      }`}
                    >
                      {sampleName}
                    </code>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Profile & QA Rules */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[12px] p-5 space-y-4">
          <h2 className="font-display text-base font-bold text-[var(--ink)] border-b border-[var(--border)] pb-2.5">
            Evaluation Rubric & Workflow Rules
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                Illustrator Display Name
              </label>
              <input
                type="text"
                {...register('illustratorName')}
                className="w-full px-3 py-2 text-xs rounded-[8px] border border-[var(--border-strong)] bg-[var(--background)] text-[var(--ink)]"
              />
              {errors.illustratorName && (
                <p className="text-xs text-[var(--rose-ink)] mt-1">
                  {errors.illustratorName.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                Weekly Hour Target (Worksheet)
              </label>
              <input
                type="number"
                min={1}
                max={100}
                {...register('weeklyHourTarget', { valueAsNumber: true })}
                className="w-full px-3 py-2 text-xs font-mono-num rounded-[8px] border border-[var(--border-strong)] bg-[var(--background)] text-[var(--ink)]"
              />
            </div>
          </div>

          <div className="pt-2">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-[var(--ink)]">
                Human QA Pass Threshold (1.0 – 5.0)
              </label>
              <span className="font-mono-num text-xs font-bold px-2 py-0.5 rounded-[6px] bg-[var(--sage)] text-[var(--sage-ink)]">
                {Number(currentThreshold || 4.0).toFixed(1)}
              </span>
            </div>
            <input
              type="range"
              step="0.1"
              min="1.0"
              max="5.0"
              {...register('passThreshold', { valueAsNumber: true })}
              className="w-full accent-[var(--ink)] cursor-pointer"
            />
            <p className="text-[11px] text-[var(--muted-text)] mt-1">
              Human QA scores ≥ {Number(currentThreshold || 4.0).toFixed(1)} move tasks to Reviewed; scores below trigger Revision.
            </p>
          </div>
        </div>

        {/* Payout Rates per Difficulty */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[12px] p-5 space-y-4">
          <div>
            <h2 className="font-display text-base font-bold text-[var(--ink)]">
              Estimated Payout Rate per Difficulty (USD)
            </h2>
            <p className="text-xs text-[var(--muted-text)]">
              Standar tarif: Easy $2, Medium $3, Hard $4. Digunakan otomatis di Dashboard dan Analytics.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            <div>
              <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                Easy Task Rate ($)
              </label>
              <input
                type="number"
                min={0}
                step={0.5}
                {...register('rateEasy', { valueAsNumber: true })}
                className="w-full px-3 py-2 text-xs font-mono-num rounded-[8px] border border-[var(--border-strong)] bg-[var(--background)] text-[var(--ink)]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                Medium Task Rate ($)
              </label>
              <input
                type="number"
                min={0}
                step={0.5}
                {...register('rateMedium', { valueAsNumber: true })}
                className="w-full px-3 py-2 text-xs font-mono-num rounded-[8px] border border-[var(--border-strong)] bg-[var(--background)] text-[var(--ink)]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                Hard Task Rate ($)
              </label>
              <input
                type="number"
                min={0}
                step={0.5}
                {...register('rateHard', { valueAsNumber: true })}
                className="w-full px-3 py-2 text-xs font-mono-num rounded-[8px] border border-[var(--border-strong)] bg-[var(--background)] text-[var(--ink)]"
              />
            </div>
          </div>
        </div>

        {/* Appearance / Theme */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[12px] p-5 space-y-3">
          <h2 className="font-display text-base font-bold text-[var(--ink)]">
            Appearance & Surface Theme
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setValue('theme', 'light')}
              className={`flex items-center gap-3 p-3.5 rounded-[10px] border text-left transition-colors cursor-pointer ${
                currentTheme === 'light'
                  ? 'border-[var(--ink)] bg-[var(--surface-muted)]'
                  : 'border-[var(--border)] hover:bg-[var(--surface-muted)]/50'
              }`}
            >
              <Sun className="w-4 h-4 text-[var(--ink)]" />
              <div>
                <div className="text-xs font-bold text-[var(--ink)]">
                  Warm Editorial Paper (Light)
                </div>
                <div className="text-[11px] text-[var(--muted-text)]">
                  #FAF8F5 neutral base with desaturated pastel tags
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setValue('theme', 'dark')}
              className={`flex items-center gap-3 p-3.5 rounded-[10px] border text-left transition-colors cursor-pointer ${
                currentTheme === 'dark'
                  ? 'border-[var(--ink)] bg-[var(--surface-muted)]'
                  : 'border-[var(--border)] hover:bg-[var(--surface-muted)]/50'
              }`}
            >
              <Moon className="w-4 h-4 text-[var(--ink)]" />
              <div>
                <div className="text-xs font-bold text-[var(--ink)]">
                  Low-Glare Studio Slate (Dark)
                </div>
                <div className="text-[11px] text-[var(--muted-text)]">
                  Warm charcoal canvas calibrated for evening linework
                </div>
              </div>
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-[8px] bg-[var(--ink)] text-[var(--background)] hover:opacity-90 transition-opacity cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Simpan Pengaturan</span>
          </button>
        </div>
      </form>

      {/* Data Portability & Reset */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[12px] p-5 space-y-4">
        <div>
          <h2 className="font-display text-base font-bold text-[var(--ink)]">
            Backup Data & Bersihkan Workspace
          </h2>
          <p className="text-xs text-[var(--muted-text)]">
            Ekspor seluruh data Kerjaan-Remote ke JSON atau kosongkan daftar task & timesheet.
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          onChange={handleImportFile}
          className="hidden"
        />

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-[8px] border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-muted)] cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-[8px] border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-muted)] cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import JSON</span>
          </button>

          <button
            type="button"
            onClick={() => setConfirmResetOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-[8px] bg-[var(--rose)] text-[var(--rose-ink)] border border-[var(--rose-border)] hover:opacity-90 cursor-pointer ml-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Kosongkan Semua Task</span>
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmResetOpen}
        title="Kosongkan Semua Data Task?"
        description="Ini akan menghapus seluruh task, 8 varian, dan catatan timesheet dari workspace & Firebase Cloud Anda. Pastikan Anda sudah Export JSON jika ingin menyimpan backup."
        confirmLabel="Kosongkan Data"
        onConfirm={resetAllData}
        onCancel={() => setConfirmResetOpen(false)}
      />
    </div>
  );
};
