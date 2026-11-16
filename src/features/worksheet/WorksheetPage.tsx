import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import * as XLSX from 'xlsx';
import {
  addDays,
  format,
  isSameDay,
  startOfWeek,
  subWeeks,
  addWeeks,
} from 'date-fns';
import {
  BadgeCheck,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  FileSpreadsheet,
  RotateCcw,
} from 'lucide-react';
import { useTaskStore } from '../../store/useTaskStore';
import {
  calculateTaskPayout,
  cn,
  formatMinutes,
  formatMinutesDecimal,
} from '../../lib/utils';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { DifficultyTag } from '../../components/ui/DifficultyTag';
import { PaidToggleSwitch } from '../../components/ui/PaidToggleSwitch';

const PAGE_SIZE = 10;

export const WorksheetPage: React.FC = () => {
  const navigate = useNavigate();
  const tasks = useTaskStore((s) => s.tasks);
  const worksheetCells = useTaskStore((s) => s.worksheetCells);
  const dailyNotes = useTaskStore((s) => s.dailyNotes);
  const settings = useTaskStore((s) => s.settings);

  const selectTask = useTaskStore((s) => s.selectTask);
  const setWorksheetMinutes = useTaskStore((s) => s.setWorksheetMinutes);
  const setDailyNote = useTaskStore((s) => s.setDailyNote);
  const toggleTaskPaid = useTaskStore((s) => s.toggleTaskPaid);

  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());
  const [currentPage, setCurrentPage] = useState<number>(1);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, idx) => addDays(weekStart, idx)),
    [weekStart]
  );

  // Exclude Paid tasks (!t.isPaid) so tasks marked Paid disappear from Worksheet
  const workedTasks = useMemo(
    () =>
      tasks.filter(
        (t) =>
          !t.isPaid &&
          (t.status !== 'Available' && t.status !== 'Skipped')
      ),
    [tasks]
  );

  const paidTasksCount = useMemo(
    () => tasks.filter((t) => Boolean(t.isPaid)).length,
    [tasks]
  );

  const clientRevisionCount = useMemo(
    () => workedTasks.filter((t) => Boolean(t.clientRevision)).length,
    [workedTasks]
  );

  const totalPages = Math.max(1, Math.ceil(workedTasks.length / PAGE_SIZE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const paginatedTasks = useMemo(() => {
    const startIdx = (currentPage - 1) * PAGE_SIZE;
    return workedTasks.slice(startIdx, startIdx + PAGE_SIZE);
  }, [workedTasks, currentPage]);

  const cellMap = useMemo(() => {
    const map = new Map<string, number>();
    worksheetCells.forEach((c) => {
      map.set(`${c.taskId}__${c.date}`, c.minutes);
    });
    return map;
  }, [worksheetCells]);

  const getCellMinutes = (taskId: string, dateObj: Date): number => {
    const dateKey = format(dateObj, 'yyyy-MM-dd');
    return cellMap.get(`${taskId}__${dateKey}`) ?? 0;
  };

  const dayTotals = useMemo(() => {
    return weekDays.map((day) => {
      return workedTasks.reduce(
        (sum, t) => sum + getCellMinutes(t.id, day),
        0
      );
    });
  }, [weekDays, workedTasks, cellMap]);

  const weekTotalMinutes = useMemo(
    () => dayTotals.reduce((a, b) => a + b, 0),
    [dayTotals]
  );

  const weekTotalHours = weekTotalMinutes / 60;
  const targetHours = settings.weeklyHourTarget;
  const targetProgressPct = Math.min(
    100,
    Math.round((weekTotalHours / Math.max(1, targetHours)) * 100)
  );

  const activeWorksheetEarnings = useMemo(() => {
    return workedTasks
      .filter((t) => t.status === 'Reviewed' && !t.isPaid)
      .reduce(
        (sum, t) => sum + calculateTaskPayout(t.difficulty, settings.rates),
        0
      );
  }, [workedTasks, settings.rates]);

  const selectedDayStr = format(selectedDay, 'yyyy-MM-dd');
  const selectedDayNote =
    dailyNotes.find((n) => n.date === selectedDayStr)?.note ?? '';

  const handleExportExcel = () => {
    const sheetRows: Record<string, string | number>[] = workedTasks.map(
      (task, idx) => {
        const row: Record<string, string | number> = {
          No: idx + 1,
          'No Task': task.code,
          'Judul Task': task.title,
          Batch: task.batchName,
          Difficulty: task.difficulty,
          'Rate ($)': calculateTaskPayout(task.difficulty, settings.rates),
          Status: task.clientRevision
            ? 'Revisi Klien'
            : task.status,
        };
        let rowWeekMins = 0;
        weekDays.forEach((d) => {
          const label = format(d, 'EEE dd/MM');
          const mins = getCellMinutes(task.id, d);
          row[label] = mins;
          rowWeekMins += mins;
        });
        row['Menit Minggu Ini'] = rowWeekMins;
        row['Jam Minggu Ini'] = Number((rowWeekMins / 60).toFixed(2));
        row['Total Jam Keseluruhan'] = Number(
          (task.timeSpentMinutes / 60).toFixed(2)
        );
        return row;
      }
    );

    // Append Weekly Summary Row
    const summaryRow: Record<string, string | number> = {
      No: '',
      'No Task': 'TOTAL',
      'Judul Task': `Ringkasan Minggu (${format(weekStart, 'dd MMM')} - ${format(
        addDays(weekStart, 6),
        'dd MMM yyyy'
      )})`,
      Batch: '',
      Difficulty: '',
      'Rate ($)': activeWorksheetEarnings,
      Status: `${workedTasks.length} Task Aktif`,
    };
    weekDays.forEach((d, idx) => {
      const label = format(d, 'EEE dd/MM');
      summaryRow[label] = dayTotals[idx];
    });
    summaryRow['Menit Minggu Ini'] = weekTotalMinutes;
    summaryRow['Jam Minggu Ini'] = Number((weekTotalMinutes / 60).toFixed(2));
    summaryRow['Total Jam Keseluruhan'] = Number(
      (
        workedTasks.reduce((s, t) => s + (t.timeSpentMinutes || 0), 0) / 60
      ).toFixed(2)
    );
    sheetRows.push(summaryRow);

    const ws = XLSX.utils.json_to_sheet(sheetRows);
    ws['!cols'] = [
      { wch: 5 },
      { wch: 14 },
      { wch: 36 },
      { wch: 18 },
      { wch: 11 },
      { wch: 10 },
      { wch: 16 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 16 },
      { wch: 15 },
      { wch: 20 },
    ];

    const notesRows = weekDays.map((d, idx) => {
      const dStr = format(d, 'yyyy-MM-dd');
      const noteObj = dailyNotes.find((n) => n.date === dStr);
      return {
        Tanggal: dStr,
        Hari: format(d, 'EEEE'),
        'Total Menit': dayTotals[idx],
        'Total Jam': Number((dayTotals[idx] / 60).toFixed(2)),
        'Catatan Harian Studio': noteObj?.note || '—',
      };
    });
    const wsNotes = XLSX.utils.json_to_sheet(notesRows);
    wsNotes['!cols'] = [
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 12 },
      { wch: 60 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Weekly Worksheet');
    XLSX.utils.book_append_sheet(wb, wsNotes, 'Daily Studio Notes');

    XLSX.writeFile(
      wb,
      `kerjaan-remote-worksheet-${format(weekStart, 'yyyy-MM-dd')}.xlsx`
    );
  };

  return (
    <div className="space-y-5">
      {/* Header & Week Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--ink)] tracking-tight">
            Weekly Worksheet
          </h1>
          <p className="text-[13px] text-[var(--muted-text)] mt-0.5">
            Timesheet interaktif (maksimal 10 task per halaman). Task yang ditandai <strong>Paid</strong> otomatis berpindah ke halaman Paid & menghilang dari tabel ini.
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
              <span>{paidTasksCount} Task di Halaman Paid</span>
            </button>
          )}

          <div className="inline-flex items-center rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-0.5">
            <button
              type="button"
              onClick={() => setWeekStart((w) => subWeeks(w, 1))}
              className="p-1.5 rounded-[6px] text-[var(--muted-text)] hover:text-[var(--ink)] hover:bg-[var(--surface-muted)] cursor-pointer"
              title="Minggu sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" strokeWidth={2.4} />
            </button>
            <span className="px-3 text-xs font-mono-num font-bold text-[var(--ink)]">
              {format(weekStart, 'MMM d')} –{' '}
              {format(addDays(weekStart, 6), 'MMM d, yyyy')}
            </span>
            <button
              type="button"
              onClick={() => setWeekStart((w) => addWeeks(w, 1))}
              className="p-1.5 rounded-[6px] text-[var(--muted-text)] hover:text-[var(--ink)] hover:bg-[var(--surface-muted)] cursor-pointer"
              title="Minggu berikutnya"
            >
              <ChevronRight className="w-4 h-4" strokeWidth={2.4} />
            </button>
          </div>

          <button
            type="button"
            onClick={() =>
              setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))
            }
            className="px-2.5 py-1.5 text-xs font-semibold rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-muted)] cursor-pointer"
          >
            Minggu Ini
          </button>

          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={workedTasks.length === 0}
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-[8px] bg-[var(--ink)] text-[var(--background)] hover:opacity-90 disabled:opacity-40 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" strokeWidth={2.4} />
            <span>Export Excel (.xlsx)</span>
          </motion.button>
        </div>
      </div>

      {/* Client Revision Alert if any task was returned from Paid */}
      {clientRevisionCount > 0 && (
        <div className="p-3.5 rounded-[12px] border border-[var(--rose-border)] bg-[var(--rose)]/25 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-[var(--rose-ink)] font-semibold">
            <RotateCcw className="w-4 h-4 shrink-0" />
            <span>
              Ada <strong>{clientRevisionCount} task Revisi Klien</strong> yang dikembalikan dari halaman Paid ke Worksheet. Aktifkan kembali toggle Paid pada baris task jika sudah selesai direvisi.
            </span>
          </div>
          <button
            type="button"
            onClick={() => navigate('/paid')}
            className="font-bold text-[var(--rose-ink)] underline cursor-pointer"
          >
            Buka Halaman Paid →
          </button>
        </div>
      )}

      {/* Weekly Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[12px] p-4">
          <div className="flex items-center justify-between text-xs text-[var(--muted-text)]">
            <span className="font-semibold">Hours Logged This Week</span>
            <Clock className="w-4 h-4" strokeWidth={2.2} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold text-[var(--ink)] tabular-nums">
              {formatMinutesDecimal(weekTotalMinutes)}
            </span>
            <span className="text-xs text-[var(--muted-text)] font-mono-num">
              / {targetHours}h target ({targetProgressPct}%)
            </span>
          </div>
          <div className="mt-2.5 h-1.5 w-full rounded-full bg-[var(--surface-muted)] overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${targetProgressPct}%` }}
              transition={{ duration: 0.4 }}
              className="h-full bg-[var(--sage-ink)] rounded-full"
            />
          </div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[12px] p-4">
          <div className="flex items-center justify-between text-xs text-[var(--muted-text)]">
            <span className="font-semibold">Task Aktif di Worksheet</span>
            <Calendar className="w-4 h-4" strokeWidth={2.2} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold text-[var(--ink)] tabular-nums">
              {workedTasks.length}
            </span>
            <span className="text-xs text-[var(--muted-text)]">
              task belum Paid (Hal {currentPage}/{totalPages})
            </span>
          </div>
          <p className="text-xs text-[var(--muted-text)] mt-1.5">
            {paidTasksCount} task sudah lunas & diarsipkan di halaman Paid
          </p>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[12px] p-4">
          <div className="flex items-center justify-between text-xs text-[var(--muted-text)]">
            <span className="font-semibold">Reviewed (Menunggu Paid)</span>
            <DollarSign className="w-4 h-4" strokeWidth={2.2} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold text-[var(--ink)] tabular-nums">
              ${activeWorksheetEarnings.toLocaleString()}
            </span>
            <span className="text-xs font-medium text-[var(--sage-ink)]">
              siap ditandai Paid
            </span>
          </div>
          <p className="text-xs text-[var(--muted-text)] mt-1.5">
            Easy ${settings.rates.Easy} · Med ${settings.rates.Medium} · Hard $
            {settings.rates.Hard}
          </p>
        </div>
      </div>

      {/* Spreadsheet Grid Table with 10-Task Pagination */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[12px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]/60 text-xs font-bold text-[var(--muted-text)]">
                <th className="py-3 pl-4 pr-3 min-w-[240px]">Task</th>
                <th className="py-3 px-2.5 whitespace-nowrap">Batch · Diff</th>
                <th className="py-3 px-2.5 whitespace-nowrap">
                  Status / Toggle Paid
                </th>
                {weekDays.map((day) => {
                  const isTodayCol = isSameDay(day, new Date());
                  const isSelectedCol = isSameDay(day, selectedDay);
                  return (
                    <th
                      key={day.toISOString()}
                      onClick={() => setSelectedDay(day)}
                      className={cn(
                        'py-2.5 px-2 text-center font-mono-num whitespace-nowrap cursor-pointer transition-colors select-none min-w-[74px]',
                        isSelectedCol
                          ? 'bg-[var(--butter)]/60 text-[var(--butter-ink)]'
                          : isTodayCol
                          ? 'bg-[var(--sage)]/40 text-[var(--sage-ink)]'
                          : 'hover:bg-[var(--surface-muted)]'
                      )}
                    >
                      <div className="text-[11px] uppercase tracking-wider">
                        {format(day, 'EEE')}
                      </div>
                      <div className="text-xs font-bold text-[var(--ink)]">
                        {format(day, 'MMM d')}
                      </div>
                    </th>
                  );
                })}
                <th className="py-3 px-3 text-right whitespace-nowrap">
                  Week Total
                </th>
                <th className="py-3 pl-2 pr-4 text-right whitespace-nowrap">
                  All-Time
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[var(--border)] text-[13px]">
              {paginatedTasks.length === 0 ? (
                <tr>
                  <td
                    colSpan={12}
                    className="py-12 text-center text-xs text-[var(--muted-text)]"
                  >
                    Belum ada task aktif pada worksheet. Semua task yang sudah ditandai <strong>Paid</strong> telah dipindahkan ke halaman Paid Tasks.
                  </td>
                </tr>
              ) : (
                paginatedTasks.map((task, idx) => {
                  const rowWeekTotal = weekDays.reduce(
                    (sum, d) => sum + getCellMinutes(task.id, d),
                    0
                  );
                  const globalIndex = (currentPage - 1) * PAGE_SIZE + idx + 1;

                  return (
                    <motion.tr
                      key={task.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.14, delay: idx * 0.02 }}
                      className={cn(
                        'hover:bg-[var(--surface-muted)]/35 transition-colors',
                        task.clientRevision && 'bg-[var(--rose)]/15'
                      )}
                    >
                      <td className="py-2.5 pl-4 pr-3 max-w-[280px]">
                        <button
                          type="button"
                          onClick={() => selectTask(task.id)}
                          className="text-left group flex items-center gap-2 w-full cursor-pointer"
                        >
                          <span className="font-mono-num text-[11px] font-bold text-[var(--muted-text)] w-5 shrink-0">
                            {globalIndex}.
                          </span>
                          <span className="font-mono-num text-xs font-bold text-[var(--muted-text)] shrink-0">
                            {task.code}
                          </span>
                          <span className="font-semibold text-[var(--ink)] truncate group-hover:underline">
                            {task.title}
                          </span>
                        </button>
                      </td>

                      <td className="py-2.5 px-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-[var(--muted-text)]">
                            {task.batchName}
                          </span>
                          <DifficultyTag difficulty={task.difficulty} />
                        </div>
                      </td>

                      <td className="py-2.5 px-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <StatusBadge
                            status={task.status}
                            revisionCount={task.revisionCount}
                            clientRevision={task.clientRevision}
                            isPaid={task.isPaid}
                          />
                          <PaidToggleSwitch
                            task={task}
                            onTogglePaid={(id, nextPaid) =>
                              toggleTaskPaid(id, nextPaid)
                            }
                            compact
                          />
                        </div>
                      </td>

                      {weekDays.map((day) => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const mins = getCellMinutes(task.id, day);
                        const isSelectedCol = isSameDay(day, selectedDay);

                        return (
                          <td
                            key={dateStr}
                            className={cn(
                              'p-1.5 text-center',
                              isSelectedCol && 'bg-[var(--butter)]/15'
                            )}
                          >
                            <input
                              type="number"
                              min="0"
                              max="720"
                              step="15"
                              value={mins === 0 ? '' : mins}
                              placeholder="—"
                              aria-label={`${task.code} minutes on ${dateStr}`}
                              onChange={(e) => {
                                const val =
                                  e.target.value === ''
                                    ? 0
                                    : parseInt(e.target.value, 10);
                                setWorksheetMinutes(
                                  task.id,
                                  dateStr,
                                  Number.isNaN(val) ? 0 : val
                                );
                              }}
                              className={cn(
                                'w-16 text-center font-mono-num text-xs py-1 px-1.5 rounded-[6px] border transition-colors tabular-nums focus:outline-none focus:ring-1 focus:ring-[var(--ink)]',
                                mins > 0
                                  ? 'bg-[var(--surface)] border-[var(--border-strong)] font-bold text-[var(--ink)]'
                                  : 'bg-transparent border-transparent hover:border-[var(--border)] text-[var(--muted-text)]'
                              )}
                            />
                          </td>
                        );
                      })}

                      <td className="py-2.5 px-3 text-right font-mono-num text-xs font-bold text-[var(--ink)] tabular-nums whitespace-nowrap">
                        {rowWeekTotal > 0 ? formatMinutes(rowWeekTotal) : '—'}
                      </td>

                      <td className="py-2.5 pl-2 pr-4 text-right font-mono-num text-xs text-[var(--muted-text)] tabular-nums whitespace-nowrap">
                        {formatMinutes(task.timeSpentMinutes)}
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>

            {/* Totals Footer */}
            <tfoot>
              <tr className="border-t-2 border-[var(--border-strong)] bg-[var(--surface-muted)]/60 font-mono-num text-xs font-bold text-[var(--ink)]">
                <td colSpan={3} className="py-3 pl-4 pr-3">
                  Daily Studio Totals (Minutes / Hours)
                </td>
                {dayTotals.map((totalMins, i) => (
                  <td
                    key={i}
                    className="py-3 px-2 text-center tabular-nums whitespace-nowrap"
                  >
                    {totalMins > 0 ? (
                      <div>
                        <div>{totalMins}m</div>
                        <div className="text-[10px] text-[var(--muted-text)] font-normal">
                          {(totalMins / 60).toFixed(1)}h
                        </div>
                      </div>
                    ) : (
                      <span className="text-[var(--muted-text)] font-normal">
                        0m
                      </span>
                    )}
                  </td>
                ))}
                <td className="py-3 px-3 text-right text-[var(--sage-ink)] tabular-nums">
                  {formatMinutes(weekTotalMinutes)}
                </td>
                <td className="py-3 pl-2 pr-4 text-right text-[var(--muted-text)] tabular-nums">
                  {formatMinutes(
                    workedTasks.reduce((s, t) => s + t.timeSpentMinutes, 0)
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Pagination Bar (10 Tasks per Page) */}
        {workedTasks.length > 0 && (
          <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--surface)] flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-[var(--muted-text)] font-medium">
              Menampilkan{' '}
              <strong className="font-mono-num text-[var(--ink)]">
                {(currentPage - 1) * PAGE_SIZE + 1}–
                {Math.min(currentPage * PAGE_SIZE, workedTasks.length)}
              </strong>{' '}
              dari{' '}
              <strong className="font-mono-num text-[var(--ink)]">
                {workedTasks.length}
              </strong>{' '}
              task di worksheet (10 task / halaman)
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-muted)] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed font-semibold"
              >
                <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2.4} />
                <span>Prev</span>
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (pageNum) => (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    className={cn(
                      'w-7 h-7 rounded-[6px] font-mono-num font-bold text-xs transition-colors cursor-pointer',
                      currentPage === pageNum
                        ? 'bg-[var(--ink)] text-[var(--background)]'
                        : 'border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-text)] hover:text-[var(--ink)]'
                    )}
                  >
                    {pageNum}
                  </button>
                )
              )}

              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-muted)] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed font-semibold"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.4} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Selected Day Log & Studio Notes */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[12px] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h2 className="font-display text-sm font-bold text-[var(--ink)]">
              Daily Studio Log · {format(selectedDay, 'EEEE, MMMM d, yyyy')}
            </h2>
            <p className="text-xs text-[var(--muted-text)]">
              Klik kolom tanggal di atas untuk mengganti catatan harian. Tersimpan otomatis ke Firebase Cloud.
            </p>
          </div>
          <span className="font-mono-num text-xs px-2.5 py-1 rounded-[6px] bg-[var(--surface-muted)] text-[var(--ink)] border border-[var(--border)] font-bold">
            {selectedDayStr}
          </span>
        </div>

        <textarea
          rows={3}
          value={selectedDayNote}
          onChange={(e) => setDailyNote(selectedDayStr, e.target.value)}
          placeholder="Catat ringkasan pengerjaan batch hari ini, catatan upload GDrive, atau instruksi QA..."
          className="w-full px-3 py-2 text-xs rounded-[8px] border border-[var(--border-strong)] bg-[var(--background)] text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--ink)]"
        />
      </div>
    </div>
  );
};
