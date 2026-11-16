import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { User as FirebaseUser } from 'firebase/auth';
import {
  Database,
  ExternalLink,
  FolderCheck,
  LogOut,
  Mail,
  RefreshCw,
  Save,
  ShieldCheck,
  User,
} from 'lucide-react';
import { useTaskStore } from '../../store/useTaskStore';
import {
  DEFAULT_GDRIVE_FOLDER_URL,
  extractDriveFolderId,
  formatSlotNum,
  googleSignIn,
  initAuth,
  logoutGoogle,
  subscribeGoogleAuth,
  VARIATION_GDRIVE_SPECS,
} from '../../lib/googleDrive';
import { calculateTaskPayout, formatMinutes } from '../../lib/utils';

export const ProfilePage: React.FC = () => {
  const tasks = useTaskStore((s) => s.tasks);
  const settings = useTaskStore((s) => s.settings);
  const updateSettings = useTaskStore((s) => s.updateSettings);
  const firebaseSyncStatus = useTaskStore((s) => s.firebaseSyncStatus);
  const firebaseUserEmail = useTaskStore((s) => s.firebaseUserEmail);
  const addToast = useTaskStore((s) => s.addToast);

  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
  const [driveConnected, setDriveConnected] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  const [nameInput, setNameInput] = useState(settings.illustratorName);
  const [weeklyTargetInput, setWeeklyTargetInput] = useState(settings.weeklyHourTarget);
  const [folderUrlInput, setFolderUrlInput] = useState(
    settings.gdriveFolderUrl || DEFAULT_GDRIVE_FOLDER_URL
  );

  useEffect(() => {
    setNameInput(settings.illustratorName);
    setWeeklyTargetInput(settings.weeklyHourTarget);
    setFolderUrlInput(settings.gdriveFolderUrl || DEFAULT_GDRIVE_FOLDER_URL);
  }, [settings.illustratorName, settings.weeklyHourTarget, settings.gdriveFolderUrl]);

  useEffect(() => {
    const unsubInit = initAuth(
      (u) => {
        setAuthUser(u);
        setDriveConnected(true);
      },
      () => {
        setDriveConnected(false);
      }
    );
    const unsubStore = subscribeGoogleAuth(({ user: u, hasToken: t }) => {
      setAuthUser(u);
      setDriveConnected(t);
    });
    return () => {
      unsubInit();
      unsubStore();
    };
  }, []);

  const handleUnifiedSignIn = async () => {
    setAuthLoading(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setAuthUser(res.user);
        setDriveConnected(true);
        addToast({
          title: 'Akun Google Terhubung (Firebase + Google Drive)',
          description: `Masuk sebagai ${res.user.email}. Seluruh task, 10 varian, dan pengaturan otomatis disinkronkan.`,
          variant: 'success',
        });
      }
    } catch (err: any) {
      addToast({
        title: 'Gagal menghubungkan akun Google',
        description: err?.message || 'Silakan coba lagi.',
        variant: 'danger',
      });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleUnifiedSignOut = async () => {
    await logoutGoogle();
    setAuthUser(null);
    setDriveConnected(false);
    addToast({
      title: 'Akun Google diputuskan',
      description: 'Sesi Google Drive & Firebase Cloud telah keluar.',
      variant: 'default',
    });
  };

  const handleSaveQuickProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = nameInput.trim() || 'Senior Illustrator';
    const cleanFolderUrl = folderUrlInput.trim() || DEFAULT_GDRIVE_FOLDER_URL;
    updateSettings({
      illustratorName: cleanName,
      weeklyHourTarget: Math.max(1, Math.min(100, Number(weeklyTargetInput) || 32)),
      gdriveFolderUrl: cleanFolderUrl,
      gdriveFolderId: extractDriveFolderId(cleanFolderUrl),
      gdrivePrefixMode: 'title_only',
      variationCount: 10,
    });
  };

  const stats = useMemo(() => {
    const reviewed = tasks.filter((t) => t.status === 'Reviewed');
    const active = tasks.filter(
      (t) => t.status === 'In Progress' || t.status === 'Revision'
    );
    const totalMinutes = tasks.reduce((sum, t) => sum + (t.timeSpentMinutes || 0), 0);
    const totalSyncedFiles = tasks.reduce(
      (sum, t) => sum + t.variations.filter((v) => Boolean(v.driveFileId)).length,
      0
    );
    const totalEarned = reviewed.reduce(
      (sum, t) => sum + calculateTaskPayout(t.difficulty, settings.rates),
      0
    );
    const pipelineEarned = active.reduce(
      (sum, t) => sum + calculateTaskPayout(t.difficulty, settings.rates),
      0
    );
    const humanScored = tasks.filter((t) => t.qaHuman !== null);
    const avgHuman =
      humanScored.length > 0
        ? humanScored.reduce((sum, t) => sum + (t.qaHuman ?? 0), 0) / humanScored.length
        : 0;

    return {
      totalTasks: tasks.length,
      reviewedCount: reviewed.length,
      activeCount: active.length,
      totalMinutes,
      totalSyncedFiles,
      totalEarned,
      pipelineEarned,
      avgHuman,
    };
  }, [tasks, settings.rates]);

  const displayEmail = authUser?.email || firebaseUserEmail || 'Belum login ke akun Google';
  const displayName = authUser?.displayName || settings.illustratorName;

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-[var(--border)]">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-text)]">
            Unified Account · Firebase Cloud + Google Drive
          </span>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[var(--ink)] tracking-tight mt-0.5">
            Profil Akun & Sinkronisasi Cloud
          </h1>
          <p className="text-xs text-[var(--muted-text)] mt-1">
            Satu login Google otomatis menghubungkan penyimpanan daftar task & pengaturan di Firebase Cloud sekaligus akses upload 10 file ke Google Drive.
          </p>
        </div>
      </div>

      {/* Unified Identity & Cloud Card */}
      <div className="bg-[var(--surface)] border border-[var(--border-strong)] rounded-[14px] p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[var(--border)]">
          <div className="flex items-center gap-4 min-w-0">
            {authUser?.photoURL ? (
              <img
                src={authUser.photoURL}
                alt={displayName}
                className="w-16 h-16 rounded-full border-2 border-[var(--border-strong)] object-cover shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-[var(--ink)] text-[var(--background)] font-display text-2xl font-bold flex items-center justify-center shrink-0">
                {(displayName || 'K').charAt(0).toUpperCase()}
              </div>
            )}

            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-xl font-bold text-[var(--ink)] truncate">
                  {displayName}
                </h2>
                <span className="px-2 py-0.5 text-[11px] font-bold rounded-[6px] bg-[var(--surface-muted)] text-[var(--ink)] border border-[var(--border)]">
                  Senior AI Evaluator
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[var(--muted-text)]">
                <Mail className="w-3.5 h-3.5 shrink-0" />
                <span className="font-mono-num truncate">{displayEmail}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={authLoading}
              onClick={handleUnifiedSignIn}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-[8px] bg-[var(--ink)] text-[var(--background)] hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${authLoading ? 'animate-spin' : ''}`} />
              <span>
                {driveConnected || firebaseUserEmail
                  ? 'Perbarui Sesi Login (Firebase + GDrive)'
                  : 'Login Google (Firebase + GDrive)'}
              </span>
            </motion.button>

            {(driveConnected || firebaseUserEmail || authUser) && (
              <button
                type="button"
                onClick={handleUnifiedSignOut}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-[8px] border border-[var(--border-strong)] text-[var(--muted-text)] hover:text-[var(--rose-ink)] hover:bg-[var(--rose)]/35 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar</span>
              </button>
            )}
          </div>
        </div>

        {/* Dual Integration Status Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-[10px] border border-[var(--border)] bg-[var(--surface-muted)]/45 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-[var(--ink)]" />
                <span className="font-display text-sm font-bold text-[var(--ink)]">
                  1. Firebase Cloud Firestore
                </span>
              </div>
              <span
                className={`px-2 py-0.5 text-[11px] font-bold rounded-[6px] border ${
                  firebaseSyncStatus === 'synced'
                    ? 'bg-[var(--sage)] text-[var(--sage-ink)] border-[var(--sage-border)]'
                    : 'bg-[var(--butter)] text-[var(--butter-ink)] border-[var(--butter-border)]'
                }`}
              >
                {firebaseSyncStatus === 'synced' ? 'Tersinkron Otomatis' : 'Siap Sinkron'}
              </span>
            </div>
            <p className="text-xs text-[var(--muted-text)] leading-relaxed">
              Menyimpan seluruh daftar task, progres 10 slot varian, status Paid/Revisi Klien, skor QA LLM & Human, timesheet mingguan, dan pengaturan tarif secara real-time.
            </p>
          </div>

          <div className="p-4 rounded-[10px] border border-[var(--border)] bg-[var(--surface-muted)]/45 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderCheck className="w-4 h-4 text-[var(--ink)]" />
                <span className="font-display text-sm font-bold text-[var(--ink)]">
                  2. Google Drive Auto-Subfolder & 10 Varian
                </span>
              </div>
              <span
                className={`px-2 py-0.5 text-[11px] font-bold rounded-[6px] border ${
                  driveConnected
                    ? 'bg-[var(--sage)] text-[var(--sage-ink)] border-[var(--sage-border)]'
                    : 'bg-[var(--butter)] text-[var(--butter-ink)] border-[var(--butter-border)]'
                }`}
              >
                {driveConnected ? 'Token Drive Aktif' : 'Klik Login untuk Upload'}
              </span>
            </div>
            <p className="text-xs text-[var(--muted-text)] leading-relaxed">
              Membuat subfolder otomatis <code className="font-mono-num font-bold text-[var(--ink)]">NamaBatch_Difficulty_NoTask</code> dan mengunggah 8 file <code className="font-mono-num">.png</code> (termasuk gambar asli task) + 1 file <code className="font-mono-num font-bold text-[var(--ink)]">_master.psd</code> + 1 file <code className="font-mono-num font-bold text-[var(--ink)]">_notes.txt</code>.
            </p>
          </div>
        </div>
      </div>

      {/* Studio Telemetry Strip */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[14px] p-5">
        <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted-text)] mb-3">
          Ringkasan Performa Akun & Tarif ($2 Easy · $3 Medium · $4 Hard)
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-[var(--border)]">
          <div className="p-3 first:pl-0">
            <span className="text-[11px] text-[var(--muted-text)] block">Total Task</span>
            <span className="font-display text-2xl font-bold text-[var(--ink)] tabular-nums">
              {stats.totalTasks}
            </span>
          </div>
          <div className="p-3">
            <span className="text-[11px] text-[var(--muted-text)] block">Task Lulus QA</span>
            <span className="font-display text-2xl font-bold text-[var(--sage-ink)] tabular-nums">
              {stats.reviewedCount}
            </span>
          </div>
          <div className="p-3">
            <span className="text-[11px] text-[var(--muted-text)] block">File di GDrive</span>
            <span className="font-display text-2xl font-bold text-[var(--ink)] tabular-nums">
              {stats.totalSyncedFiles}
            </span>
          </div>
          <div className="p-3">
            <span className="text-[11px] text-[var(--muted-text)] block">Avg QA Human</span>
            <span className="font-display text-2xl font-bold text-[var(--ink)] tabular-nums">
              {stats.avgHuman > 0 ? stats.avgHuman.toFixed(2) : '—'}
            </span>
          </div>
          <div className="p-3">
            <span className="text-[11px] text-[var(--muted-text)] block">Total Jam Kerja</span>
            <span className="font-display text-2xl font-bold text-[var(--ink)] tabular-nums">
              {formatMinutes(stats.totalMinutes)}
            </span>
          </div>
          <div className="p-3">
            <span className="text-[11px] text-[var(--muted-text)] block">Earnings + Pipeline</span>
            <span className="font-display text-2xl font-bold text-[var(--butter-ink)] tabular-nums">
              ${stats.totalEarned}
              <span className="text-xs font-mono-num text-[var(--muted-text)] font-normal ml-1">
                (+${stats.pipelineEarned})
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Quick Profile & Standard 10-Slot Naming Reference */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <form
          onSubmit={handleSaveQuickProfile}
          className="lg:col-span-6 bg-[var(--surface)] border border-[var(--border)] rounded-[14px] p-5 space-y-4"
        >
          <div className="flex items-center gap-2 pb-2.5 border-b border-[var(--border)]">
            <User className="w-4 h-4 text-[var(--ink)]" />
            <h3 className="font-display text-sm font-bold text-[var(--ink)]">
              Identitas Studio & Folder Google Drive
            </h3>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
              Nama Illustrator (Tampil di Dashboard & Log)
            </label>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-[8px] border border-[var(--border-strong)] bg-[var(--background)] text-[var(--ink)]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
              Target Jam Kerja Mingguan (Worksheet)
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={weeklyTargetInput}
              onChange={(e) => setWeeklyTargetInput(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs font-mono-num rounded-[8px] border border-[var(--border-strong)] bg-[var(--background)] text-[var(--ink)]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-[var(--ink)]">
                Link Folder Utama Google Drive
              </label>
              <a
                href={folderUrlInput || DEFAULT_GDRIVE_FOLDER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--ink)] hover:underline"
              >
                <span>Buka Folder</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <input
              type="text"
              value={folderUrlInput}
              onChange={(e) => setFolderUrlInput(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono-num rounded-[8px] border border-[var(--border-strong)] bg-[var(--background)] text-[var(--ink)]"
            />
          </div>

          <button
            type="submit"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-[8px] bg-[var(--ink)] text-[var(--background)] hover:opacity-90 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Simpan Profil & Sinkron ke Firebase</span>
          </button>
        </form>

        <div className="lg:col-span-6 bg-[var(--surface)] border border-[var(--border)] rounded-[14px] p-5 space-y-3">
          <div className="flex items-center justify-between pb-2.5 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[var(--ink)]" />
              <h3 className="font-display text-sm font-bold text-[var(--ink)]">
                Standar Baku 10 File Varian (Title Only)
              </h3>
            </div>
            <span className="text-[11px] font-mono-num font-bold px-2 py-0.5 rounded-[6px] bg-[var(--surface-muted)] border border-[var(--border)]">
              Title + Suffix
            </span>
          </div>

          <div className="space-y-1.5">
            {VARIATION_GDRIVE_SPECS.map((spec) => (
              <div
                key={spec.slotNumber}
                className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-[8px] bg-[var(--surface-muted)]/60 border border-[var(--border)] text-xs"
              >
                <span className="font-mono-num font-bold text-[var(--muted-text)]">
                  {formatSlotNum(spec.slotNumber)}: _{spec.suffix}
                </span>
                <span
                  className={`font-mono-num text-[11px] font-bold px-2 py-0.5 rounded-[5px] border ${
                    spec.requiredExt === 'psd'
                      ? 'bg-[var(--lavender)] text-[var(--lavender-ink)] border-[var(--lavender-border)]'
                      : spec.requiredExt === 'txt'
                      ? 'bg-[var(--sky)] text-[var(--sky-ink)] border-[var(--sky-border)]'
                      : spec.slotNumber === 9
                      ? 'bg-[var(--sage)] text-[var(--sage-ink)] border-[var(--sage-border)]'
                      : 'bg-[var(--surface)] text-[var(--ink)] border-[var(--border)]'
                  }`}
                >
                  JudulTask_{spec.suffix}.{spec.requiredExt}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
