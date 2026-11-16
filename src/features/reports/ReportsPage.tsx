import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Award,
  BookOpen,
  Code2,
  Copy,
  Check,
  FileDown,
  FileText,
  GitCompare,
  RotateCcw,
  ShieldAlert,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { format } from 'date-fns';
import { useTaskStore } from '../../store/useTaskStore';
import {
  calculateTaskPayout,
  cn,
  formatMinutes,
  formatScore,
} from '../../lib/utils';
import {
  computeLatexReportMetrics,
  exportLatexReportToPdf,
  generateLatexSource,
} from '../../lib/latexReportPdf';
import { ScoreChip } from '../../components/ui/ScoreChip';
import { DifficultyTag } from '../../components/ui/DifficultyTag';
import { StatusBadge } from '../../components/ui/StatusBadge';

export const ReportsPage: React.FC = () => {
  const tasks = useTaskStore((s) => s.tasks);
  const settings = useTaskStore((s) => s.settings);
  const selectTask = useTaskStore((s) => s.selectTask);
  const addToast = useTaskStore((s) => s.addToast);

  const [latexModalOpen, setLatexModalOpen] = useState(false);
  const [showTexCode, setShowTexCode] = useState(false);
  const [copiedTex, setCopiedTex] = useState(false);

  const evaluatedTasks = useMemo(
    () => tasks.filter((t) => t.qaLLM !== null || t.qaHuman !== null),
    [tasks]
  );

  const bothScoredTasks = useMemo(
    () => tasks.filter((t) => t.qaLLM !== null && t.qaHuman !== null),
    [tasks]
  );

  const latexMetrics = useMemo(
    () => computeLatexReportMetrics(tasks, settings),
    [tasks, settings]
  );

  const latexSource = useMemo(
    () => generateLatexSource(tasks, settings),
    [tasks, settings]
  );

  // LLM vs Human calibration metrics
  const calibration = useMemo(() => {
    if (bothScoredTasks.length === 0) {
      return {
        avgDelta: 0,
        stricterHumanCount: 0,
        firstPassRate: 0,
        avgRevisionsPerTask: 0,
      };
    }

    const deltas = bothScoredTasks.map(
      (t) => (t.qaHuman ?? 0) - (t.qaLLM ?? 0)
    );
    const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    const stricterHumanCount = deltas.filter((d) => d < 0).length;

    const humanReviewed = tasks.filter((t) => t.qaHuman !== null);
    const passedFirstTry = humanReviewed.filter(
      (t) => t.status === 'Reviewed' && t.revisionCount === 0
    ).length;
    const firstPassRate =
      humanReviewed.length > 0
        ? Math.round((passedFirstTry / humanReviewed.length) * 100)
        : 0;

    const totalRevs = tasks.reduce((s, t) => s + t.revisionCount, 0);
    const avgRevisionsPerTask =
      humanReviewed.length > 0 ? totalRevs / humanReviewed.length : 0;

    return {
      avgDelta,
      stricterHumanCount,
      firstPassRate,
      avgRevisionsPerTask,
    };
  }, [bothScoredTasks, tasks]);

  // Revision Cause Tag Breakdown
  const revisionTagData = useMemo(() => {
    const counts: Record<string, number> = {};
    tasks.forEach((t) => {
      t.revisionTags.forEach((tag) => {
        counts[tag] = (counts[tag] ?? 0) + 1;
      });
      t.revisionHistory.forEach((r) => {
        r.tags.forEach((tag) => {
          counts[tag] = (counts[tag] ?? 0) + 1;
        });
      });
    });

    return Object.entries(counts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }, [tasks]);

  // Batch Performance Table Data
  const batchStats = useMemo(() => {
    const map = new Map<
      string,
      {
        batchName: string;
        total: number;
        reviewed: number;
        paid: number;
        inRevision: number;
        llmSum: number;
        llmCount: number;
        humanSum: number;
        humanCount: number;
        minutes: number;
        earnings: number;
      }
    >();

    tasks.forEach((t) => {
      const cur = map.get(t.batchName) ?? {
        batchName: t.batchName,
        total: 0,
        reviewed: 0,
        paid: 0,
        inRevision: 0,
        llmSum: 0,
        llmCount: 0,
        humanSum: 0,
        humanCount: 0,
        minutes: 0,
        earnings: 0,
      };
      cur.total += 1;
      if (t.status === 'Reviewed') {
        cur.reviewed += 1;
        cur.earnings += calculateTaskPayout(t.difficulty, settings.rates);
      }
      if (t.isPaid) cur.paid += 1;
      if (t.status === 'Revision') cur.inRevision += 1;
      if (t.qaLLM !== null) {
        cur.llmSum += t.qaLLM;
        cur.llmCount += 1;
      }
      if (t.qaHuman !== null) {
        cur.humanSum += t.qaHuman;
        cur.humanCount += 1;
      }
      cur.minutes += t.timeSpentMinutes;
      map.set(t.batchName, cur);
    });

    return Array.from(map.values());
  }, [tasks, settings.rates]);

  // Scatter data: LLM vs Human Score per task
  const scatterData = useMemo(() => {
    return bothScoredTasks.map((t) => ({
      code: t.code,
      title: t.title,
      llm: t.qaLLM,
      human: t.qaHuman,
      revisions: t.revisionCount + 1,
    }));
  }, [bothScoredTasks]);

  const handleDownloadLatexPdf = () => {
    exportLatexReportToPdf(tasks, settings);
    addToast({
      title: 'Laporan PDF (LaTeX Format) berhasil diunduh',
      description: 'Dokumen akademik booktabs .pdf telah tersimpan.',
      variant: 'success',
    });
  };

  const handleDownloadTexFile = () => {
    const blob = new Blob([latexSource], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `kerjaan-remote-qa-report-${format(new Date(), 'yyyy-MM-dd')}.tex`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyTex = () => {
    navigator.clipboard?.writeText(latexSource);
    setCopiedTex(true);
    setTimeout(() => setCopiedTex(false), 1800);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--ink)] tracking-tight">
            QA Analytics & Batch Reports
          </h1>
          <p className="text-[13px] text-[var(--muted-text)]">
            Kalibrasi antara evaluasi LLM otomatis dan Human QA Reviewer, dilengkapi ekspor dokumen <strong>.PDF berformat LaTeX Akademik (Booktabs)</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setLatexModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-[8px] border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-muted)] cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Preview LaTeX Document</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadLatexPdf}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-[8px] bg-[var(--ink)] text-[var(--background)] hover:opacity-90 cursor-pointer"
          >
            <FileDown className="w-3.5 h-3.5" strokeWidth={2} />
            <span>Export PDF (LaTeX)</span>
          </button>
        </div>
      </div>

      {/* Calibration KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[12px] p-4">
          <div className="flex items-center justify-between text-xs text-[var(--muted-text)]">
            <span>First-Pass QA Approval</span>
            <Award className="w-4 h-4 text-[var(--sage-ink)]" strokeWidth={1.5} />
          </div>
          <div className="font-display text-2xl font-semibold text-[var(--ink)] mt-2 tabular-nums">
            {calibration.firstPassRate}%
          </div>
          <p className="text-xs text-[var(--muted-text)] mt-1">
            Passed Human QA (≥ {settings.passThreshold.toFixed(1)}) without revision
          </p>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[12px] p-4">
          <div className="flex items-center justify-between text-xs text-[var(--muted-text)]">
            <span>Human vs. LLM Delta (Δ)</span>
            <GitCompare className="w-4 h-4 text-[var(--lavender-ink)]" strokeWidth={1.5} />
          </div>
          <div className="font-display text-2xl font-semibold text-[var(--ink)] mt-2 font-mono-num tabular-nums">
            {calibration.avgDelta > 0 ? '+' : ''}
            {calibration.avgDelta.toFixed(2)}
          </div>
          <p className="text-xs text-[var(--muted-text)] mt-1">
            Human stricter on {calibration.stricterHumanCount}/
            {bothScoredTasks.length} tasks
          </p>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[12px] p-4">
          <div className="flex items-center justify-between text-xs text-[var(--muted-text)]">
            <span>Avg Revisions / Task</span>
            <RotateCcw className="w-4 h-4 text-[var(--rose-ink)]" strokeWidth={1.5} />
          </div>
          <div className="font-display text-2xl font-semibold text-[var(--ink)] mt-2 font-mono-num tabular-nums">
            {calibration.avgRevisionsPerTask.toFixed(2)}
          </div>
          <p className="text-xs text-[var(--muted-text)] mt-1">
            Across {evaluatedTasks.length} evaluated plates
          </p>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[12px] p-4">
          <div className="flex items-center justify-between text-xs text-[var(--muted-text)]">
            <span>Top Revision Cause</span>
            <ShieldAlert className="w-4 h-4 text-[var(--butter-ink)]" strokeWidth={1.5} />
          </div>
          <div className="font-display text-lg font-semibold text-[var(--ink)] mt-2 truncate">
            {revisionTagData[0]?.tag ?? 'None'}
          </div>
          <p className="text-xs text-[var(--muted-text)] mt-1">
            {revisionTagData[0]
              ? `${revisionTagData[0].count} occurrences logged`
              : 'No revision tags recorded'}
          </p>
        </div>
      </div>

      {/* Charts Row: Revision Cause Breakdown + LLM vs Human Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Revision Cause Bar Chart */}
        <div className="lg:col-span-6 bg-[var(--surface)] border border-[var(--border)] rounded-[12px] p-5">
          <div className="mb-4">
            <h2 className="font-display text-base font-semibold text-[var(--ink)]">
              Revision Causes Frequency
            </h2>
            <p className="text-xs text-[var(--muted-text)]">
              Tagged root causes from Human QA revision feedback loops
            </p>
          </div>

          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={revisionTagData}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 24, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: 'var(--muted-text)' }}
                />
                <YAxis
                  dataKey="tag"
                  type="category"
                  width={120}
                  tick={{ fontSize: 11, fill: 'var(--ink)' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--border)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" name="Occurrences" radius={[0, 4, 4, 0]}>
                  {revisionTagData.map((_, idx) => (
                    <Cell
                      key={idx}
                      fill={idx === 0 ? '#D99AA7' : idx === 1 ? '#E5D17A' : '#B4A7D6'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* LLM vs Human Score Scatter / Calibration */}
        <div className="lg:col-span-6 bg-[var(--surface)] border border-[var(--border)] rounded-[12px] p-5">
          <div className="mb-4">
            <h2 className="font-display text-base font-semibold text-[var(--ink)]">
              LLM Score vs. Human Score Calibration
            </h2>
            <p className="text-xs text-[var(--muted-text)]">
              Each point represents a task evaluated by both automated LLM and Human QA
            </p>
          </div>

          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  type="number"
                  dataKey="llm"
                  name="QA LLM"
                  domain={[2.5, 5.0]}
                  tick={{ fontSize: 11, fill: 'var(--muted-text)' }}
                  label={{
                    value: 'QA LLM Score',
                    position: 'insideBottom',
                    offset: -5,
                    fontSize: 11,
                    fill: 'var(--muted-text)',
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="human"
                  name="QA Human"
                  domain={[2.5, 5.0]}
                  tick={{ fontSize: 11, fill: 'var(--muted-text)' }}
                />
                <ZAxis type="number" dataKey="revisions" range={[60, 180]} />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--border)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Scatter
                  name="Evaluated Tasks"
                  data={scatterData}
                  fill="#6E59A5"
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Batch Performance Summary Table */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[12px] overflow-hidden">
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-[var(--ink)]">
              Batch Throughput & Earnings Breakdown
            </h2>
            <p className="text-xs text-[var(--muted-text)]">
              Aggregated QA scores, time spent, and verified earnings by batch
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]/60 text-xs font-medium text-[var(--muted-text)]">
                <th className="py-2.5 pl-4 pr-3">Batch Name</th>
                <th className="py-2.5 px-3 text-right">Total Tasks</th>
                <th className="py-2.5 px-3 text-right">Reviewed</th>
                <th className="py-2.5 px-3 text-right">Paid</th>
                <th className="py-2.5 px-3 text-right">In Revision</th>
                <th className="py-2.5 px-3 text-right">Avg LLM</th>
                <th className="py-2.5 px-3 text-right">Avg Human</th>
                <th className="py-2.5 px-3 text-right">Time Logged</th>
                <th className="py-2.5 pl-3 pr-4 text-right">Reviewed Payout</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] text-[13px]">
              {batchStats.map((b) => (
                <tr
                  key={b.batchName}
                  className="hover:bg-[var(--surface-muted)]/40 transition-colors"
                >
                  <td className="py-3 pl-4 pr-3 font-medium text-[var(--ink)]">
                    {b.batchName}
                  </td>
                  <td className="py-3 px-3 text-right font-mono-num tabular-nums">
                    {b.total}
                  </td>
                  <td className="py-3 px-3 text-right font-mono-num text-[var(--sage-ink)] font-semibold tabular-nums">
                    {b.reviewed}
                  </td>
                  <td className="py-3 px-3 text-right font-mono-num text-[var(--sage-ink)] font-bold tabular-nums">
                    {b.paid}
                  </td>
                  <td className="py-3 px-3 text-right font-mono-num text-[var(--rose-ink)] tabular-nums">
                    {b.inRevision}
                  </td>
                  <td className="py-3 px-3 text-right font-mono-num tabular-nums">
                    {b.llmCount > 0 ? (b.llmSum / b.llmCount).toFixed(2) : '—'}
                  </td>
                  <td className="py-3 px-3 text-right font-mono-num tabular-nums">
                    {b.humanCount > 0
                      ? (b.humanSum / b.humanCount).toFixed(2)
                      : '—'}
                  </td>
                  <td className="py-3 px-3 text-right font-mono-num text-xs text-[var(--muted-text)] tabular-nums">
                    {formatMinutes(b.minutes)}
                  </td>
                  <td className="py-3 pl-3 pr-4 text-right font-mono-num font-semibold text-[var(--ink)] tabular-nums">
                    ${b.earnings.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Evaluated Tasks Audit Table */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[12px] overflow-hidden">
        <div className="p-4 border-b border-[var(--border)]">
          <h2 className="font-display text-base font-semibold text-[var(--ink)]">
            Evaluated Tasks Score Delta Audit
          </h2>
          <p className="text-xs text-[var(--muted-text)]">
            Side-by-side comparison of QA LLM vs. QA Human scores and reviewer notes
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]/60 text-xs font-medium text-[var(--muted-text)]">
                <th className="py-2.5 pl-4 pr-3">Task</th>
                <th className="py-2.5 px-3">Difficulty</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">QA LLM</th>
                <th className="py-2.5 px-3 text-right">QA Human</th>
                <th className="py-2.5 px-3 text-right">Delta (H - L)</th>
                <th className="py-2.5 pl-3 pr-4">Latest Reviewer Feedback</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] text-[13px]">
              {evaluatedTasks.map((t) => {
                const delta =
                  t.qaLLM !== null && t.qaHuman !== null
                    ? t.qaHuman - t.qaLLM
                    : null;
                return (
                  <tr
                    key={t.id}
                    onClick={() => selectTask(t.id)}
                    className="hover:bg-[var(--surface-muted)]/40 transition-colors cursor-pointer"
                  >
                    <td className="py-3 pl-4 pr-3 max-w-[280px]">
                      <div className="flex items-center gap-2">
                        <span className="font-mono-num text-xs text-[var(--muted-text)]">
                          {t.code}
                        </span>
                        <span className="font-medium text-[var(--ink)] truncate">
                          {t.title}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <DifficultyTag difficulty={t.difficulty} />
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge
                        status={t.status}
                        revisionCount={t.revisionCount}
                        clientRevision={t.clientRevision}
                        isPaid={t.isPaid}
                      />
                    </td>
                    <td className="py-3 px-3 text-right">
                      <ScoreChip score={t.qaLLM} />
                    </td>
                    <td className="py-3 px-3 text-right">
                      <ScoreChip score={t.qaHuman} />
                    </td>
                    <td className="py-3 px-3 text-right font-mono-num text-xs tabular-nums">
                      {delta !== null ? (
                        <span
                          className={
                            delta < 0
                              ? 'text-[var(--rose-ink)] font-semibold'
                              : delta > 0
                              ? 'text-[var(--sage-ink)] font-semibold'
                              : 'text-[var(--muted-text)]'
                          }
                        >
                          {delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 pl-3 pr-4 text-xs text-[var(--muted-text)] max-w-[320px] truncate">
                      {t.latestFeedback ?? 'Passed without revision comments'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* LaTeX Academic Document Preview & .PDF / .TEX Export Modal */}
      <AnimatePresence>
        {latexModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
            onClick={() => setLatexModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="w-full max-w-4xl max-h-[90vh] bg-[var(--surface)] border border-[var(--border-strong)] rounded-[14px] flex flex-col overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Top Bar */}
              <div className="px-5 py-3.5 border-b border-[var(--border)] bg-[var(--surface-muted)]/60 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-[var(--ink)]" />
                  <span className="font-display text-sm font-bold text-[var(--ink)]">
                    LaTeX Academic Report Preview (Computer Modern / Booktabs)
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowTexCode((v) => !v)}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-[6px] border cursor-pointer',
                      showTexCode
                        ? 'bg-[var(--ink)] text-[var(--background)] border-[var(--ink)]'
                        : 'bg-[var(--surface)] text-[var(--ink)] border-[var(--border)]'
                    )}
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    <span>{showTexCode ? 'Lihat Dokumen LaTeX' : 'Lihat Kode .TEX'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadTexFile}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-muted)] cursor-pointer"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>Unduh .TEX</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadLatexPdf}
                    className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-[6px] bg-[var(--ink)] text-[var(--background)] hover:opacity-90 cursor-pointer"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>Unduh .PDF (LaTeX)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLatexModalOpen(false)}
                    className="p-1 rounded-[6px] text-[var(--muted-text)] hover:text-[var(--ink)] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Modal Body: Typeset LaTeX Paper or Raw .tex Code */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[#E9E5DC] dark:bg-[#141311]">
                {showTexCode ? (
                  <div className="bg-[#18181B] text-emerald-100 rounded-[10px] p-4 font-mono-num text-xs overflow-x-auto relative border border-white/10">
                    <button
                      type="button"
                      onClick={handleCopyTex}
                      className="absolute top-3 right-3 inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold cursor-pointer"
                    >
                      {copiedTex ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>Tersalin</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Salin .TEX</span>
                        </>
                      )}
                    </button>
                    <pre className="leading-relaxed">{latexSource}</pre>
                  </div>
                ) : (
                  /* Authentic LaTeX Paper Sheet */
                  <div
                    className="max-w-[760px] mx-auto bg-[#FFFEFC] text-[#141413] shadow-xl border border-[#D6D1C7] p-6 sm:p-12 space-y-6"
                    style={{ fontFamily: 'Georgia, "Times New Roman", Times, serif' }}
                  >
                    {/* \maketitle */}
                    <div className="text-center space-y-2 pb-4">
                      <h2 className="text-xl sm:text-2xl font-bold leading-snug tracking-tight">
                        Kerjaan-Remote: Quantitative QA &amp; Production Evaluation Ledger
                      </h2>
                      <p className="italic text-sm text-[#4A4843]">
                        10-Variation AI Illustration Evaluation, Score Calibration (&Delta;), &amp; Financial Audit
                      </p>
                      <p className="text-xs pt-1">
                        Author: <strong>{settings.illustratorName}</strong> &nbsp;&middot;&nbsp;{' '}
                        {format(new Date(), 'MMMM d, yyyy')} &nbsp;&middot;&nbsp; Pass Threshold &tau; ={' '}
                        {settings.passThreshold.toFixed(1)}
                      </p>
                    </div>

                    {/* \begin{abstract} */}
                    <div className="border-y border-[#141413] py-3 px-4 sm:px-8 text-xs leading-relaxed text-justify">
                      <div className="text-center font-bold mb-1.5 uppercase tracking-wider text-[11px]">
                        Abstract
                      </div>
                      <p>
                        This technical evaluation ledger documents{' '}
                        <strong>{latexMetrics.totalTasks}</strong> tracked illustration tasks under the standardized 10-variation specification (slots 01&ndash;08 illustration &amp; <code>.psd</code> master plates, slot 09 original task image, and slot 10 task notes <code>.txt</code> synced to Google Drive). Under a minimum Human QA pass threshold of &tau; = {settings.passThreshold.toFixed(1)}, the studio achieved a first-pass approval rate of &eta; = <strong>{latexMetrics.firstPassPct}%</strong>, a mean LLM QA score of &mu;<sub>LLM</sub> = <strong>{latexMetrics.avgLLM.toFixed(2)}</strong>, and a mean Human QA score of &mu;<sub>Human</sub> = <strong>{latexMetrics.avgHuman.toFixed(2)}</strong> (&Delta;&#772; = {latexMetrics.avgDelta >= 0 ? '+' : ''}
                        {latexMetrics.avgDelta.toFixed(2)}). Total verified earnings equal <strong>${latexMetrics.earnedTotal}</strong> (<strong>${latexMetrics.paidTotal}</strong> settled in Paid status).
                      </p>
                    </div>

                    {/* \section{1} */}
                    <div className="space-y-2">
                      <h3 className="text-sm sm:text-base font-bold">
                        1 &nbsp;&nbsp; Mathematical Calibration &amp; Executive Telemetry
                      </h3>
                      <div className="p-3.5 bg-[#F7F5F0] border border-[#D6D1C7] font-mono-num text-xs space-y-1">
                        <div>
                          &mu;<sub>LLM</sub> = {latexMetrics.avgLLM.toFixed(2)} &nbsp;&nbsp;|&nbsp;&nbsp; &mu;<sub>Human</sub> = {latexMetrics.avgHuman.toFixed(2)} &nbsp;&nbsp;|&nbsp;&nbsp; &Delta;&#772; = S<sub>Human</sub> &minus; S<sub>LLM</sub> = {latexMetrics.avgDelta >= 0 ? '+' : ''}{latexMetrics.avgDelta.toFixed(2)}
                        </div>
                        <div>
                          &eta;<sub>1st-pass</sub> = {latexMetrics.firstPassPct}% ({latexMetrics.firstPassCount} tasks) &nbsp;&nbsp;|&nbsp;&nbsp; Reviewed = {latexMetrics.reviewedCount} &nbsp;&nbsp;|&nbsp;&nbsp; Paid = {latexMetrics.paidCount} (${latexMetrics.paidTotal})
                        </div>
                      </div>
                    </div>

                    {/* \section{2} Booktabs Table */}
                    <div className="space-y-2">
                      <h3 className="text-sm sm:text-base font-bold">
                        2 &nbsp;&nbsp; Batch Throughput &amp; Financial Summary
                      </h3>
                      <p className="italic text-xs text-[#4A4843]">
                        Table 1: Batch-level throughput, studio hours, and verified payouts (booktabs format).
                      </p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="border-t-2 border-b border-[#141413] font-bold">
                              <th className="py-1.5 text-left">Batch Name</th>
                              <th className="py-1.5 text-right">Tasks</th>
                              <th className="py-1.5 text-right">Reviewed</th>
                              <th className="py-1.5 text-right">Paid</th>
                              <th className="py-1.5 text-right">Hours</th>
                              <th className="py-1.5 text-right">Earned ($)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {batchStats.map((b) => (
                              <tr key={b.batchName} className="border-b border-[#E5E0D5]">
                                <td className="py-1.5">{b.batchName}</td>
                                <td className="py-1.5 text-right font-mono-num">{b.total}</td>
                                <td className="py-1.5 text-right font-mono-num">{b.reviewed}</td>
                                <td className="py-1.5 text-right font-mono-num">{b.paid}</td>
                                <td className="py-1.5 text-right font-mono-num">
                                  {(b.minutes / 60).toFixed(1)}h
                                </td>
                                <td className="py-1.5 text-right font-mono-num font-bold">
                                  ${b.earnings}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-b-2 border-[#141413] font-bold">
                              <td className="py-1.5">Total</td>
                              <td className="py-1.5 text-right font-mono-num">{latexMetrics.totalTasks}</td>
                              <td className="py-1.5 text-right font-mono-num">{latexMetrics.reviewedCount}</td>
                              <td className="py-1.5 text-right font-mono-num">{latexMetrics.paidCount}</td>
                              <td className="py-1.5 text-right font-mono-num">{latexMetrics.totalHours}h</td>
                              <td className="py-1.5 text-right font-mono-num">${latexMetrics.earnedTotal}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>

                    {/* \section{3} Task Registry Booktabs Table */}
                    <div className="space-y-2">
                      <h3 className="text-sm sm:text-base font-bold">
                        3 &nbsp;&nbsp; Task-Level QA &amp; 10-Variation Audit Registry
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="border-t-2 border-b border-[#141413] font-bold">
                              <th className="py-1.5 text-left">Code</th>
                              <th className="py-1.5 text-left">Title</th>
                              <th className="py-1.5 text-left">Tier</th>
                              <th className="py-1.5 text-right">10 Slots</th>
                              <th className="py-1.5 text-right">LLM</th>
                              <th className="py-1.5 text-right">Human</th>
                              <th className="py-1.5 text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tasks.map((t) => {
                              const filled = t.variations.filter((v) => v.filled).length;
                              return (
                                <tr key={t.id} className="border-b border-[#E5E0D5]">
                                  <td className="py-1.5 font-mono-num font-bold">{t.code}</td>
                                  <td className="py-1.5 max-w-[200px] truncate">{t.title}</td>
                                  <td className="py-1.5 italic">{t.difficulty}</td>
                                  <td className="py-1.5 text-right font-mono-num">
                                    {filled}/{t.variations.length}
                                  </td>
                                  <td className="py-1.5 text-right font-mono-num">
                                    {formatScore(t.qaLLM)}
                                  </td>
                                  <td className="py-1.5 text-right font-mono-num">
                                    {formatScore(t.qaHuman)}
                                  </td>
                                  <td className="py-1.5 text-right font-mono-num font-bold">
                                    {t.isPaid
                                      ? 'PAID'
                                      : t.clientRevision
                                      ? 'REVISI KLIEN'
                                      : t.status.toUpperCase()}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="border-b-2 border-[#141413]">
                              <td colSpan={7} className="py-1" />
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
