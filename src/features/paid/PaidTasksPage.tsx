import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import * as XLSX from 'xlsx';
import {
  ArrowRight,
  BadgeCheck,
  DollarSign,
  ExternalLink,
  FileSpreadsheet,
  FolderCheck,
  RotateCcw,
  Search,
  Table2,
} from 'lucide-react';
import { format } from 'date-fns';
import { useTaskStore } from '../../store/useTaskStore';
import { Difficulty } from '../../types';
import {
  calculateTaskPayout,
  cn,
  formatFullDateTime,
  formatMinutes,
} from '../../lib/utils';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { DifficultyTag } from '../../components/ui/DifficultyTag';
import { ScoreChip } from '../../components/ui/ScoreChip';
import { PaidToggleSwitch } from '../../components/ui/PaidToggleSwitch';

export const PaidTasksPage: React.FC = () => {
  const navigate = useNavigate();
  const tasks = useTaskStore((s) => s.tasks);
  const settings = useTaskStore((s) => s.settings);
  const selectTask = useTaskStore((s) => s.selectTask);
  const toggleTaskPaid = useTaskStore((s) => s.toggleTaskPaid);

  const [searchQuery, setSearchQuery] = useState('');
  const [batchFilter, setBatchFilter] = useState<string>('ALL');
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty | 'ALL'>('ALL');

  const paidTasks = useMemo(
    () => tasks.filter((t) => Boolean(t.isPaid)),
    [tasks]
  );

  const clientRevisionTasks = useMemo(
    () => tasks.filter((t) => !t.isPaid && Boolean(t.clientRevision)),
    [tasks]
  );

  const unpaidReviewedTasks = useMemo(
    () => tasks.filter((t) => !t.isPaid && t.status === 'Reviewed'),
    [tasks]
  );

  const batches = useMemo(() => {
    const set = new Set(paidTasks.map((t) => t.batchName));
    return Array.from(set).sort();
  }, [paidTasks]);

  const filteredPaidTasks = useMemo(() => {
    return paidTasks.filter((task) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = task.title.toLowerCase().includes(q);
        const matchCode = task.code.toLowerCase().includes(q);
        const matchBatch = task.batchName.toLowerCase().includes(q);
        if (!matchTitle && !matchCode && !matchBatch) return false;
      }
      if (batchFilter !== 'ALL' && task.batchName !== batchFilter) return false;
      if (difficultyFilter !== 'ALL' && task.difficulty !== difficultyFilter)
        return false;
      return true;
    });
  }, [paidTasks, searchQuery, batchFilter, difficultyFilter]);

  const summary = useMemo(() => {
    const totalPaidAmount = paidTasks.reduce(
      (sum, t) => sum + calculateTaskPayout(t.difficulty, settings.rates),
      0
    );
    const totalMinutes = paidTasks.reduce(
      (sum, t) => sum + (t.timeSpentMinutes || 0),
      0
    );
    const totalSyncedFiles = paidTasks.reduce(
      (sum, t) => sum + t.variations.filter((v) => Boolean(v.driveFileId)).length,
      0
    );
    const unpaidReviewedAmount = unpaidReviewedTasks.reduce(
      (sum, t) => sum + calculateTaskPayout(t.difficulty, settings.rates),
      0
    );
    return {
      totalPaidAmount,
      totalMinutes,
      totalSyncedFiles,
      unpaidReviewedAmount,
    };
  }, [paidTasks, unpaidReviewedTasks, settings.rates]);

  const handleExportPaidExcel = () => {
    if (filteredPaidTasks.length === 0) return;
    const rows = filteredPaidTasks.map((t, index) => ({
      No: index + 1,
      'No Task': t.code,
      'Judul Task': t.title,
      Batch: t.batchName,
      Difficulty: t.difficulty,
      'Rate ($)': calculateTaskPayout(t.difficulty, settings.rates),
      Status: 'PAID (Sudah Dibayar)',
      'Tanggal Paid': t.paidAt ? formatFullDateTime(t.paidAt) : '—',
      'QA LLM': t.qaLLM ?? '',
      'QA Human': t.qaHuman ?? '',
      '10 Varian Terisi': `${t.variations.filter((v) => v.filled).length}/${
        t.variations.length
      }`,
      'Folder Google Drive': t.driveSubfolderName || '',
      'Link Subfolder GDrive': t.driveSubfolderLink || '',
      'Total Menit': t.timeSpentMinutes,
      'Total Jam': Number((t.timeSpentMinutes / 60).toFixed(2)),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 5 },
      { wch: 14 },
      { wch: 36 },
      { wch: 20 },
      { wch: 12 },
      { wch: 10 },
      { wch: 20 },
      { wch: 22 },
      { wch: 10 },
      { wch: 10 },
      { wch: 16 },
      { wch: 28 },
      { wch: 42 },
      { wch: 12 },
      { wch: 12 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Paid Tasks');
    XLSX.writeFile(
      wb,
      `kerjaan-remote-paid-tasks-${format(new Date(), 'yyyy-MM-dd')}.xlsx`
    );
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[6px] bg-[var(--sage)] text-[var(--sage-ink)] border border-[var(--sage-border)] text-[11px] font-bold mb-1.5">
            <BadgeCheck className="w-3.5 h-3.5" strokeWidth={2.2} />
            <span>PAID ARCHIVE & PAYOUT LEDGER</span>
          </div>
          <h1 className="font-display text-2xl sm:text-[28px] font-bold text-[var(--ink)] tracking-tight">
            Task Sudah Dibayar (Paid)
          </h1>
          <p className="text-[13px] text-[var(--muted-text)] mt-0.5">
            Task yang diaktifkan toggle <strong>Paid</strong> otomatis berpindah ke halaman ini dan disembunyikan dari Worksheet. Jika toggle dinonaktifkan, task kembali ke Worksheet dengan status <strong>Revisi Klien</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/worksheet')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-muted)] cursor-pointer"
          >
            <Table2 className="w-3.5 h-3.5" />
            <span>Buka Worksheet</span>
          </button>

          <button
            type="button"
            disabled={filteredPaidTasks.length === 0}
            onClick={handleExportPaidExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-[8px] bg-[var(--ink)] text-[var(--background)] hover:opacity-90 disabled:opacity-40 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Paid Financial & Telemetry Strip */}
      <div className="rounded-[12px] border border-[var(--border-strong)] bg-[var(--surface)] overflow-hidden grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 divide-x divide-[var(--border)]">
        <div className="p-4 sm:p-5 bg-[var(--sage)]/25">
          <span className="text-xs font-semibold text-[var(--muted-text)] flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-[var(--sage-ink)]" />
            Total Sudah Dibayar (Paid)
          </span>
          <div className="font-display text-2xl sm:text-3xl font-bold text-[var(--sage-ink)] mt-1 tabular-nums">
            ${summary.totalPaidAmount.toLocaleString()}
          </div>
          <span className="text-[11px] font-mono-num text-[var(--muted-text)]">
            {paidTasks.length} task lunas
          </span>
        </div>

        <div className="p-4 sm:p-5">
          <span className="text-xs font-semibold text-[var(--muted-text)]">
            Siap Ditandai Paid (Reviewed)
          </span>
          <div className="font-display text-2xl sm:text-3xl font-bold text-[var(--ink)] mt-1 tabular-nums">
            ${summary.unpaidReviewedAmount.toLocaleString()}
          </div>
          <span className="text-[11px] font-mono-num text-[var(--muted-text)]">
            {unpaidReviewedTasks.length} task Reviewed menunggu Paid
          </span>
        </div>

        <div className="p-4 sm:p-5">
          <span className="text-xs font-semibold text-[var(--muted-text)]">
            Total Waktu Kerja (Paid)
          </span>
          <div className="font-display text-2xl sm:text-3xl font-bold text-[var(--ink)] mt-1 tabular-nums">
            {formatMinutes(summary.totalMinutes)}
          </div>
          <span className="text-[11px] font-mono-num text-[var(--muted-text)]">
            {(summary.totalMinutes / 60).toFixed(1)} jam tercatat
          </span>
        </div>

        <div className="p-4 sm:p-5">
          <span className="text-xs font-semibold text-[var(--muted-text)]">
            Status Revisi Klien Aktif
          </span>
          <div className="font-display text-2xl sm:text-3xl font-bold text-[var(--rose-ink)] mt-1 tabular-nums">
            {clientRevisionTasks.length}
          </div>
          <span className="text-[11px] font-mono-num text-[var(--muted-text)]">
            Dikembalikan ke Worksheet
          </span>
        </div>
      </div>

      {/* Quick Banner: Client Revision Tasks (Deactivated from Paid) */}
      {clientRevisionTasks.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[12px] border border-[var(--rose-border)] bg-[var(--rose)]/25 p-4 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-[var(--rose-ink)]" />
              <span className="font-display text-sm font-bold text-[var(--rose-ink)]">
                Task dalam Revisi Klien ({clientRevisionTasks.length}) — Sedang di Worksheet
              </span>
            </div>
            <button
              type="button"
              onClick={() => navigate('/worksheet')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--rose-ink)] hover:underline cursor-pointer"
            >
              <span>Lihat di Worksheet</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-xs text-[var(--muted-text)]">
            Task di bawah ini sebelumnya dinonaktifkan dari Paid sehingga kembali ke Worksheet dengan status <strong>Revisi Klien</strong>. Aktifkan kembali toggle di kanan untuk mengembalikannya ke daftar Paid.
          </p>
          <div className="space-y-2">
            {clientRevisionTasks.map((t) => (
              <div
                key={t.id}
                onClick={() => selectTask(t.id)}
                className="p-3 rounded-[8px] bg-[var(--surface)] border border-[var(--rose-border)] flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-[var(--surface-muted)]/60"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="font-mono-num text-xs font-bold text-[var(--rose-ink)]">
                    {t.code}
                  </span>
                  <span className="text-sm font-semibold text-[var(--ink)] truncate">
                    {t.title}
                  </span>
                  <StatusBadge
                    status={t.status}
                    revisionCount={t.revisionCount}
                    clientRevision={t.clientRevision}
                  />
                </div>
                <div
                  className="flex items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <PaidToggleSwitch
                    task={t}
                    onTogglePaid={(id, nextPaid) => toggleTaskPaid(id, nextPaid)}
                    compact
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Quick Banner: Unpaid Reviewed Tasks ready to be marked Paid */}
      {unpaidReviewedTasks.length > 0 && (
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface-muted)]/50 p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--ink)]">
              Task Berstatus Reviewed yang Belum Ditandai Paid ({unpaidReviewedTasks.length})
            </span>
            <span className="text-[11px] text-[var(--muted-text)]">
              Aktifkan toggle untuk memindahkan ke halaman Paid & menyembunyikan dari Worksheet
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {unpaidReviewedTasks.map((t) => (
              <div
                key={t.id}
                onClick={() => selectTask(t.id)}
                className="p-2.5 rounded-[8px] bg-[var(--surface)] border border-[var(--border)] flex items-center justify-between gap-2 cursor-pointer hover:border-[var(--border-strong)]"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono-num text-xs font-bold text-[var(--muted-text)]">
                      {t.code}
                    </span>
                    <span className="text-xs font-semibold text-[var(--ink)] truncate">
                      {t.title}
                    </span>
                  </div>
                  <span className="text-[11px] text-[var(--muted-text)]">
                    {t.batchName} · {t.difficulty} ($
                    {calculateTaskPayout(t.difficulty, settings.rates)})
                  </span>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <PaidToggleSwitch
                    task={t}
                    onTogglePaid={(id, nextPaid) => toggleTaskPaid(id, nextPaid)}
                    compact
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--surface)] p-3 rounded-[12px] border border-[var(--border)]">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[var(--muted-text)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari task yang sudah Paid (judul, nomor task, batch)..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-[8px] border border-[var(--border)] bg-[var(--background)] text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--ink)]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={batchFilter}
            onChange={(e) => setBatchFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-[8px] border border-[var(--border)] bg-[var(--background)] text-[var(--ink)] cursor-pointer"
          >
            <option value="ALL">Semua Batch</option>
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
            className="px-2.5 py-1.5 text-xs rounded-[8px] border border-[var(--border)] bg-[var(--background)] text-[var(--ink)] cursor-pointer"
          >
            <option value="ALL">Semua Difficulty</option>
            <option value="Easy">Easy (${settings.rates.Easy})</option>
            <option value="Medium">Medium (${settings.rates.Medium})</option>
            <option value="Hard">Hard (${settings.rates.Hard})</option>
          </select>
        </div>
      </div>

      {/* Paid Tasks List */}
      {filteredPaidTasks.length === 0 ? (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[12px] p-12 text-center">
          <BadgeCheck className="w-8 h-8 text-[var(--muted-text)] mx-auto mb-2 opacity-60" />
          <h3 className="font-display text-base font-bold text-[var(--ink)]">
            Belum ada task di daftar Paid
          </h3>
          <p className="text-xs text-[var(--muted-text)] mt-1 max-w-md mx-auto">
            Saat task sudah berstatus <strong>Reviewed</strong>, aktifkan tombol toggle <strong>Paid</strong> pada Tasks Board, Worksheet, atau Drawer untuk memindahkannya ke halaman ini.
          </p>
        </div>
      ) : (
        <>
          {/* Mobile Cards (< md) */}
          <div className="md:hidden space-y-2.5">
            {filteredPaidTasks.map((task) => {
              const filledCount = task.variations.filter((v) => v.filled).length;
              const payout = calculateTaskPayout(task.difficulty, settings.rates);
              return (
                <div
                  key={task.id}
                  onClick={() => selectTask(task.id)}
                  className="p-4 rounded-[12px] border border-[var(--sage-border)] bg-[var(--surface)] space-y-3 cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono-num text-xs font-bold px-2 py-0.5 rounded bg-[var(--surface-muted)] text-[var(--ink)] border border-[var(--border)]">
                        {task.code}
                      </span>
                      <StatusBadge status={task.status} isPaid={task.isPaid} />
                    </div>
                    <span className="font-display text-sm font-bold text-[var(--sage-ink)]">
                      +${payout}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-semibold text-sm text-[var(--ink)]">
                      {task.title}
                    </h4>
                    <p className="text-xs text-[var(--muted-text)] mt-0.5">
                      {task.batchName} · {task.difficulty} · Paid:{' '}
                      {formatFullDateTime(task.paidAt)}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
                    <span className="font-mono-num text-xs text-[var(--muted-text)]">
                      {filledCount}/{task.variations.length} file ·{' '}
                      {formatMinutes(task.timeSpentMinutes)}
                    </span>
                    <div onClick={(e) => e.stopPropagation()}>
                      <PaidToggleSwitch
                        task={task}
                        onTogglePaid={(id, nextPaid) =>
                          toggleTaskPaid(id, nextPaid)
                        }
                        compact
                      />
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
                  <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]/60 text-[12px] font-semibold text-[var(--muted-text)]">
                    <th className="py-3 pl-4 pr-3">Task</th>
                    <th className="py-3 px-3">Batch · Difficulty</th>
                    <th className="py-3 px-3 text-right">Payout</th>
                    <th className="py-3 px-3">10 Varian & GDrive</th>
                    <th className="py-3 px-3 text-right">QA Scores</th>
                    <th className="py-3 px-3 text-right">Waktu Kerja</th>
                    <th className="py-3 px-3">Tanggal Paid</th>
                    <th className="py-3 pl-3 pr-4 text-right">
                      Toggle Paid / Revisi Klien
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] text-[13px]">
                  {filteredPaidTasks.map((task) => {
                    const filledCount = task.variations.filter(
                      (v) => v.filled
                    ).length;
                    const payout = calculateTaskPayout(
                      task.difficulty,
                      settings.rates
                    );
                    return (
                      <tr
                        key={task.id}
                        onClick={() => selectTask(task.id)}
                        className="hover:bg-[var(--surface-muted)]/45 transition-colors cursor-pointer"
                      >
                        <td className="py-3 pl-4 pr-3 max-w-[300px]">
                          <div className="flex items-center gap-2">
                            <span className="font-mono-num text-xs font-bold text-[var(--muted-text)]">
                              {task.code}
                            </span>
                            <span className="font-semibold text-[var(--ink)] truncate">
                              {task.title}
                            </span>
                          </div>
                        </td>

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

                        <td className="py-3 px-3 text-right font-mono-num font-bold text-[var(--sage-ink)] whitespace-nowrap">
                          ${payout}
                        </td>

                        <td
                          className="py-3 px-3 whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono-num text-xs font-semibold text-[var(--ink)]">
                              {filledCount}/{task.variations.length} file
                            </span>
                            {task.driveSubfolderLink && (
                              <a
                                href={task.driveSubfolderLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-[6px] bg-[var(--sage)] text-[var(--sage-ink)] border border-[var(--sage-border)] hover:opacity-90"
                              >
                                <FolderCheck className="w-3 h-3" />
                                <span>GDrive</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <ScoreChip score={task.qaLLM} prefix="LLM" />
                            <ScoreChip score={task.qaHuman} prefix="Hum" />
                          </div>
                        </td>

                        <td className="py-3 px-3 text-right font-mono-num text-xs text-[var(--ink)] whitespace-nowrap">
                          {formatMinutes(task.timeSpentMinutes)}
                        </td>

                        <td className="py-3 px-3 font-mono-num text-xs text-[var(--muted-text)] whitespace-nowrap">
                          {formatFullDateTime(task.paidAt || task.reviewedAt)}
                        </td>

                        <td
                          className="py-3 pl-3 pr-4 text-right whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <PaidToggleSwitch
                            task={task}
                            onTogglePaid={(id, nextPaid) =>
                              toggleTaskPaid(id, nextPaid)
                            }
                            compact
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
