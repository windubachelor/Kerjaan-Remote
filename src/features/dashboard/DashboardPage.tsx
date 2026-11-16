import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Clock,
  ExternalLink,
  FolderPlus,
  FolderUp,
  Plus,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { isAfter, parseISO, subDays } from 'date-fns';
import { useTaskStore } from '../../store/useTaskStore';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ScoreChip } from '../../components/ui/ScoreChip';
import { GoogleDriveConnectButton } from '../../components/ui/GoogleDriveConnectButton';
import {
  calculateTaskPayout,
  formatFullDateTime,
  getDeadlineUrgency,
} from '../../lib/utils';
import {
  DEFAULT_GDRIVE_FOLDER_URL,
  formatSlotNum,
  VARIATION_GDRIVE_SPECS,
} from '../../lib/googleDrive';
import { TaskStatus } from '../../types';

interface AnimatedNumberProps {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
}

const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
}) => {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let raf: number;
    const duration = 520;
    const start = performance.now();
    const from = display;
    const delta = value - from;

    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + delta * eased);
      if (progress < 1) {
        raf = requestAnimationFrame(step);
      } else {
        setDisplay(value);
      }
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  const formatted =
    decimals > 0 ? display.toFixed(decimals) : Math.round(display).toLocaleString();

  return (
    <span className="tabular-nums">
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
};

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const tasks = useTaskStore((s) => s.tasks);
  const settings = useTaskStore((s) => s.settings);
  const selectTask = useTaskStore((s) => s.selectTask);
  const setAddModalOpen = useTaskStore((s) => s.setAddModalOpen);

  const kpis = useMemo(() => {
    const sevenDaysAgo = subDays(new Date(), 7);
    const claimedThisWeek = tasks.filter(
      (t) => t.claimedAt && isAfter(parseISO(t.claimedAt), sevenDaysAgo)
    ).length;

    const llmTasks = tasks.filter((t) => t.qaLLM !== null);
    const avgLLM =
      llmTasks.length > 0
        ? llmTasks.reduce((sum, t) => sum + (t.qaLLM ?? 0), 0) / llmTasks.length
        : 0;

    const humanTasks = tasks.filter((t) => t.qaHuman !== null);
    const avgHuman =
      humanTasks.length > 0
        ? humanTasks.reduce((sum, t) => sum + (t.qaHuman ?? 0), 0) /
          humanTasks.length
        : 0;

    const reviewedCount = tasks.filter((t) => t.status === 'Reviewed').length;
    const paidCount = tasks.filter((t) => Boolean(t.isPaid)).length;
    const totalHumanEvaluated = humanTasks.length;
    const passRate =
      totalHumanEvaluated > 0 ? (reviewedCount / totalHumanEvaluated) * 100 : 0;

    const claimedOrDone = tasks.filter(
      (t) => t.status !== 'Available' && t.status !== 'Skipped'
    );
    const tasksWithRevisions = claimedOrDone.filter((t) => t.revisionCount > 0).length;
    const revisionRate =
      claimedOrDone.length > 0
        ? (tasksWithRevisions / claimedOrDone.length) * 100
        : 0;

    const earnedReviewed = tasks
      .filter((t) => t.status === 'Reviewed')
      .reduce((sum, t) => sum + calculateTaskPayout(t.difficulty, settings.rates), 0);

    const earnedPaid = tasks
      .filter((t) => Boolean(t.isPaid))
      .reduce((sum, t) => sum + calculateTaskPayout(t.difficulty, settings.rates), 0);

    const pipelineValue = tasks
      .filter(
        (t) =>
          t.status === 'In Progress' ||
          t.status === 'Revision' ||
          t.status === 'Submitted' ||
          t.status === 'In QA'
      )
      .reduce((sum, t) => sum + calculateTaskPayout(t.difficulty, settings.rates), 0);

    const syncedFilesCount = tasks.reduce(
      (sum, t) => sum + t.variations.filter((v) => Boolean(v.driveFileId)).length,
      0
    );

    return {
      claimedThisWeek,
      avgLLM,
      avgHuman,
      passRate,
      revisionRate,
      earnedReviewed,
      earnedPaid,
      paidCount,
      pipelineValue,
      reviewedCount,
      totalHumanEvaluated,
      syncedFilesCount,
    };
  }, [tasks, settings.rates]);

  const revisionTasks = useMemo(
    () => tasks.filter((t) => t.status === 'Revision'),
    [tasks]
  );

  const dueSoonTasks = useMemo(
    () =>
      tasks.filter((t) => {
        if (t.status === 'Reviewed' || t.status === 'Skipped') return false;
        const u = getDeadlineUrgency(t.deadline, t.status);
        return u.isUrgent;
      }),
    [tasks]
  );

  const pipelineStages: {
    status: TaskStatus;
    label: string;
    tabParam: string;
    toneClass: string;
    barColor: string;
  }[] = [
    {
      status: 'Available',
      label: 'Available',
      tabParam: 'available',
      toneClass: 'bg-[var(--sky)] text-[var(--sky-ink)] border-[var(--sky-border)]',
      barColor: '#95B8D1',
    },
    {
      status: 'In Progress',
      label: 'In Progress (10 File)',
      tabParam: 'in-progress',
      toneClass:
        'bg-[var(--butter)] text-[var(--butter-ink)] border-[var(--butter-border)]',
      barColor: '#D9C777',
    },
    {
      status: 'Revision',
      label: 'Revision / Klien',
      tabParam: 'in-progress',
      toneClass: 'bg-[var(--rose)] text-[var(--rose-ink)] border-[var(--rose-border)]',
      barColor: '#D99AA7',
    },
    {
      status: 'Submitted',
      label: 'Submitted',
      tabParam: 'completed',
      toneClass:
        'bg-[var(--lavender)] text-[var(--lavender-ink)] border-[var(--lavender-border)]',
      barColor: '#B4A7D6',
    },
    {
      status: 'In QA',
      label: 'In QA Review',
      tabParam: 'completed',
      toneClass:
        'bg-[var(--lavender)] text-[var(--lavender-ink)] border-[var(--lavender-border)]',
      barColor: '#8E7CC3',
    },
    {
      status: 'Reviewed',
      label: 'Reviewed (Pass)',
      tabParam: 'reviewed',
      toneClass: 'bg-[var(--sage)] text-[var(--sage-ink)] border-[var(--sage-border)]',
      barColor: '#8BB898',
    },
  ];

  const scoreTrendData = useMemo(() => {
    return tasks
      .filter((t) => t.qaLLM !== null || t.qaHuman !== null)
      .slice()
      .reverse()
      .map((t) => ({
        name: t.code,
        title: t.title,
        LLM: t.qaLLM,
        Human: t.qaHuman,
      }));
  }, [tasks]);

  const difficultyChartData = useMemo(() => {
    const tiers: ('Easy' | 'Medium' | 'Hard')[] = ['Easy', 'Medium', 'Hard'];
    return tiers.map((tier) => {
      const subset = tasks.filter((t) => t.difficulty === tier);
      return {
        difficulty: `${tier} ($${settings.rates[tier]})`,
        Reviewed: subset.filter((t) => t.status === 'Reviewed').length,
        InQA: subset.filter(
          (t) => t.status === 'Submitted' || t.status === 'In QA'
        ).length,
        Active: subset.filter(
          (t) => t.status === 'In Progress' || t.status === 'Revision'
        ).length,
        Available: subset.filter((t) => t.status === 'Available').length,
      };
    });
  }, [tasks, settings.rates]);

  const weeklyThroughputData = useMemo(() => {
    const deliveredCount = tasks.filter(
      (t) =>
        t.status === 'Reviewed' ||
        t.status === 'Submitted' ||
        t.status === 'In QA'
    ).length;
    const totalHours = Number(
      (
        tasks.reduce((sum, t) => sum + (t.timeSpentMinutes || 0), 0) / 60
      ).toFixed(1)
    );
    return [
      { week: '3w ago', completed: 0, hours: 0 },
      { week: '2w ago', completed: 0, hours: 0 },
      { week: 'Last wk', completed: 0, hours: 0 },
      {
        week: 'This wk',
        completed: deliveredCount,
        hours: totalHours,
      },
    ];
  }, [tasks]);

  const passFailData = useMemo(() => {
    const firstPass = tasks.filter(
      (t) => t.status === 'Reviewed' && t.revisionCount === 0
    ).length;
    const passedAfterRev = tasks.filter(
      (t) => t.status === 'Reviewed' && t.revisionCount > 0
    ).length;
    const currentlyInRev = tasks.filter((t) => t.status === 'Revision').length;
    return [
      { name: 'Passed 1st Pass', value: firstPass, color: '#8BB898' },
      { name: 'Passed After Revision', value: passedAfterRev, color: '#D9C777' },
      { name: 'Active Revision', value: currentlyInRev, color: '#D99AA7' },
    ];
  }, [tasks]);

  const recentActivity = useMemo(() => {
    const allEvents = tasks.flatMap((t) =>
      t.history.map((h) => ({
        ...h,
        taskId: t.id,
        taskCode: t.code,
        taskTitle: t.title,
      }))
    );
    return allEvents
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      .slice(0, 8);
  }, [tasks]);

  const activeWorkCount = tasks.filter(
    (t) => t.status === 'In Progress' || t.status === 'Revision'
  ).length;

  return (
    <div className="space-y-6">
      {/* Greeting & Studio Command Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-[var(--border)]"
      >
        <div>
          <p className="text-[11px] font-bold text-[var(--muted-text)] uppercase tracking-wider">
            Kerjaan-Remote · AI Illustration Evaluation & Unified Cloud Ledger
          </p>
          <h1 className="font-display text-[28px] sm:text-[32px] font-bold text-[var(--ink)] tracking-tight mt-0.5">
            Halo, {settings.illustratorName.split(' ')[0]}
          </h1>
          <p className="text-[13px] text-[var(--muted-text)] mt-1">
            Ada{' '}
            <span className="font-bold text-[var(--ink)] tabular-nums">
              {revisionTasks.length} task revisi
            </span>{' '}
            dan{' '}
            <span className="font-bold text-[var(--ink)] tabular-nums">
              {dueSoonTasks.length} task deadline dekat
            </span>
            . Format penamaan tunggal <code className="font-mono-num font-bold text-[var(--ink)]">Title_suffix</code> untuk 10 file (.png, _master.psd, _original.png & _notes.txt).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="lg:hidden">
            <GoogleDriveConnectButton compact />
          </div>
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/paid')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-[8px] border border-[var(--sage-border)] bg-[var(--sage)] text-[var(--sage-ink)] hover:opacity-90 transition-opacity cursor-pointer"
          >
            <BadgeCheck className="w-3.5 h-3.5" />
            <span>Paid ({kpis.paidCount})</span>
          </motion.button>
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/worksheet')}
            className="px-3.5 py-2 text-xs font-semibold rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-muted)] transition-colors cursor-pointer"
          >
            Weekly Worksheet
          </motion.button>
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/tasks')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-[8px] bg-[var(--ink)] text-[var(--background)] hover:opacity-90 transition-opacity cursor-pointer"
          >
            <span>Buka Tasks Board</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </motion.button>
        </div>
      </motion.div>

      {/* Editorial Financial & Telemetry Ledger (Anti-AI-Slop Industry Standard Strip) */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.03 }}
        className="rounded-[14px] border border-[var(--border-strong)] bg-[var(--surface)] overflow-hidden"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[var(--border)]">
          {/* Left Hero Column: Financial Payout & Rate Architecture */}
          <div className="lg:col-span-4 p-5 sm:p-6 bg-[var(--surface-muted)]/35 flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-text)]">
                  Verified Earnings Ledger
                </span>
                <span className="px-2 py-0.5 text-[10px] font-mono-num font-bold rounded-[5px] bg-[var(--butter)]/70 text-[var(--butter-ink)] border border-[var(--butter-border)]">
                  Easy ${settings.rates.Easy} · Med ${settings.rates.Medium} · Hard ${settings.rates.Hard}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-baseline gap-2.5">
                <span className="font-display text-4xl sm:text-[42px] font-bold tracking-tight text-[var(--ink)] leading-none">
                  <AnimatedNumber value={kpis.earnedReviewed} prefix="$" />
                </span>
                <span className="font-mono-num text-xs font-bold text-[var(--sage-ink)] bg-[var(--sage)] px-2 py-0.5 rounded-[5px] border border-[var(--sage-border)]">
                  Paid: $<AnimatedNumber value={kpis.earnedPaid} /> ({kpis.paidCount})
                </span>
                <span className="font-mono-num text-xs font-semibold text-[var(--butter-ink)] bg-[var(--butter)]/70 px-2 py-0.5 rounded-[5px] border border-[var(--butter-border)]">
                  +<AnimatedNumber value={kpis.pipelineValue} prefix="$" /> pipeline
                </span>
              </div>
              <p className="text-xs text-[var(--muted-text)] mt-2">
                Dari <strong className="font-mono-num text-[var(--ink)]">{kpis.reviewedCount}</strong> task Reviewed (Pass) · <strong className="font-mono-num text-[var(--sage-ink)]">{kpis.paidCount}</strong> sudah Paid.
              </p>
            </div>

            <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs">
              <span className="text-[var(--muted-text)]">
                File tersinkron di GDrive:{' '}
                <strong className="font-mono-num text-[var(--ink)]">
                  {kpis.syncedFilesCount}
                </strong>
              </span>
              <button
                type="button"
                onClick={() => navigate('/paid')}
                className="inline-flex items-center gap-1 font-semibold text-[var(--ink)] hover:underline cursor-pointer"
              >
                <span>Buka Paid Ledger</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Right Telemetry Matrix: Hairline-divided typographic metrics */}
          <div className="lg:col-span-8 flex flex-col justify-between">
            <div className="grid grid-cols-2 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-[var(--border)] flex-1">
              {/* Metric 1: Claimed This Week */}
              <div className="p-4 sm:p-5 flex flex-col justify-between">
                <span className="text-[11px] font-semibold text-[var(--muted-text)]">
                  Claimed (7d)
                </span>
                <div className="my-2">
                  <span className="font-display text-2xl sm:text-3xl font-bold text-[var(--ink)]">
                    <AnimatedNumber value={kpis.claimedThisWeek} />
                  </span>
                </div>
                <span className="text-[11px] font-mono-num text-[var(--muted-text)]">
                  {activeWorkCount} active now
                </span>
              </div>

              {/* Metric 2: QA Pass Rate */}
              <div className="p-4 sm:p-5 flex flex-col justify-between">
                <span className="text-[11px] font-semibold text-[var(--muted-text)]">
                  QA Pass Rate
                </span>
                <div className="my-2">
                  <span className="font-display text-2xl sm:text-3xl font-bold text-[var(--sage-ink)]">
                    <AnimatedNumber value={kpis.passRate} suffix="%" />
                  </span>
                </div>
                <span className="text-[11px] font-mono-num text-[var(--muted-text)]">
                  {kpis.reviewedCount}/{kpis.totalHumanEvaluated} human-reviewed
                </span>
              </div>

              {/* Metric 3: Avg QA LLM Score */}
              <div className="p-4 sm:p-5 flex flex-col justify-between">
                <span className="text-[11px] font-semibold text-[var(--muted-text)]">
                  Avg QA LLM
                </span>
                <div className="my-2">
                  <span className="font-display text-2xl sm:text-3xl font-bold text-[var(--ink)]">
                    <AnimatedNumber value={kpis.avgLLM} decimals={2} />
                  </span>
                </div>
                <span className="text-[11px] font-mono-num text-[var(--muted-text)]">
                  Threshold ≥ {settings.passThreshold.toFixed(1)}
                </span>
              </div>

              {/* Metric 4: Avg QA Human Score */}
              <div className="p-4 sm:p-5 flex flex-col justify-between">
                <span className="text-[11px] font-semibold text-[var(--muted-text)]">
                  Avg QA Human
                </span>
                <div className="my-2">
                  <span className="font-display text-2xl sm:text-3xl font-bold text-[var(--ink)]">
                    <AnimatedNumber value={kpis.avgHuman} decimals={2} />
                  </span>
                </div>
                <span className="text-[11px] font-mono-num text-[var(--muted-text)]">
                  Rubrik Senior QA
                </span>
              </div>

              {/* Metric 5: Revision Rate */}
              <div className="p-4 sm:p-5 flex flex-col justify-between col-span-2 sm:col-span-1">
                <span className="text-[11px] font-semibold text-[var(--muted-text)]">
                  Revision Rate
                </span>
                <div className="my-2">
                  <span className="font-display text-2xl sm:text-3xl font-bold text-[var(--rose-ink)]">
                    <AnimatedNumber value={kpis.revisionRate} suffix="%" />
                  </span>
                </div>
                <span className="text-[11px] font-mono-num text-[var(--muted-text)]">
                  {revisionTasks.length} in revision
                </span>
              </div>
            </div>

            {/* Bottom Integrated 10-Variation Specification Bar */}
            <div className="px-4 sm:px-5 py-3 border-t border-[var(--border)] bg-[var(--surface-muted)]/25 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--ink)] mr-1">
                  <FolderUp className="w-3.5 h-3.5" />
                  <span>10 File Otomatis:</span>
                </span>
                {VARIATION_GDRIVE_SPECS.map((s) => (
                  <span
                    key={s.slotNumber}
                    className={`px-1.5 py-0.5 text-[10px] font-mono-num font-bold rounded-[5px] border ${
                      s.requiredExt === 'psd'
                        ? 'bg-[var(--lavender)] text-[var(--lavender-ink)] border-[var(--lavender-border)]'
                        : s.requiredExt === 'txt'
                        ? 'bg-[var(--sky)] text-[var(--sky-ink)] border-[var(--sky-border)]'
                        : s.slotNumber === 9
                        ? 'bg-[var(--sage)] text-[var(--sage-ink)] border-[var(--sage-border)]'
                        : 'bg-[var(--surface)] text-[var(--ink)] border-[var(--border)]'
                    }`}
                  >
                    {formatSlotNum(s.slotNumber)}: _{s.suffix}.{s.requiredExt}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[10px] font-mono-num font-bold text-[var(--butter-ink)] bg-[var(--butter)]/60 px-2 py-0.5 rounded-[5px] border border-[var(--butter-border)]">
                  <FolderPlus className="w-3 h-3" />
                  <span>/Batch_Difficulty_NoTask/</span>
                </span>
                <a
                  href={settings.gdriveFolderUrl || DEFAULT_GDRIVE_FOLDER_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-mono-num font-semibold text-[var(--ink)] hover:underline"
                >
                  <span>Folder Utama</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Clean First-Run Empty State Banner when no tasks exist yet */}
      {tasks.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.99 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[var(--surface)] border border-[var(--border-strong)] rounded-[12px] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[6px] text-[11px] font-bold bg-[var(--sage)] text-[var(--sage-ink)] border border-[var(--sage-border)]">
              Workspace Bersih & Siap Produksi
            </span>
            <h3 className="font-display text-lg font-bold text-[var(--ink)]">
              Mulai Tambahkan Task Evaluasi Ilustrasi Anda
            </h3>
            <p className="text-xs text-[var(--muted-text)] max-w-xl">
              Semua task yang Anda buat otomatis tersimpan di Firebase Cloud Firestore. Saat upload 10 file varian (01–10 termasuk <code className="font-mono-num font-bold text-[var(--ink)]">06: _master.psd</code>, <code className="font-mono-num font-bold text-[var(--ink)]">09: _original.png</code>, dan <code className="font-mono-num font-bold text-[var(--ink)]">10: _notes.txt</code>), aplikasi otomatis membuat folder <code className="font-mono-num font-bold text-[var(--ink)]">NamaBatch_Difficulty_NoTask</code> di Google Drive.
            </p>
          </div>
          <motion.button
            type="button"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setAddModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-[8px] bg-[var(--ink)] text-[var(--background)] hover:opacity-90 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            <span>Buat Task Pertama</span>
          </motion.button>
        </motion.div>
      )}

      {/* Today's Focus Strip (Revisions & Urgent Deadlines) */}
      {(revisionTasks.length > 0 || dueSoonTasks.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[12px] p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-xs font-bold rounded-[6px] bg-[var(--rose)] text-[var(--rose-ink)] border border-[var(--rose-border)]">
                  Revision Priority ({revisionTasks.length})
                </span>
                <span className="text-xs text-[var(--muted-text)]">
                  Klik untuk cek Side-by-Side Compare & re-upload
                </span>
              </div>
              <button
                type="button"
                onClick={() => navigate('/tasks?tab=in-progress')}
                className="text-xs font-semibold text-[var(--ink)] hover:underline cursor-pointer"
              >
                View all
              </button>
            </div>

            <div className="space-y-2.5">
              {revisionTasks.map((t) => (
                <div
                  key={t.id}
                  onClick={() => selectTask(t.id)}
                  className="p-3 rounded-[8px] border border-[var(--rose-border)] bg-[var(--rose)]/20 hover:bg-[var(--rose)]/35 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono-num text-xs font-bold text-[var(--rose-ink)]">
                        {t.code}
                      </span>
                      <span className="text-[13px] font-semibold text-[var(--ink)] truncate">
                        {t.title}
                      </span>
                    </div>
                    <ScoreChip score={t.qaHuman} prefix="Human" />
                  </div>
                  {t.latestFeedback && (
                    <p className="mt-1.5 text-xs text-[var(--muted-text)] line-clamp-2 leading-relaxed">
                      "{t.latestFeedback}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[12px] p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-xs font-bold rounded-[6px] bg-[var(--butter)] text-[var(--butter-ink)] border border-[var(--butter-border)]">
                  Focus Queue ({dueSoonTasks.length})
                </span>
                <span className="text-xs text-[var(--muted-text)]">
                  Upcoming deadlines & active plates
                </span>
              </div>
              <button
                type="button"
                onClick={() => navigate('/tasks')}
                className="text-xs font-semibold text-[var(--ink)] hover:underline cursor-pointer"
              >
                Open board
              </button>
            </div>

            <div className="space-y-2">
              {dueSoonTasks.slice(0, 3).map((t) => {
                const filled = t.variations.filter((v) => v.filled).length;
                const urgency = getDeadlineUrgency(t.deadline, t.status);
                return (
                  <div
                    key={t.id}
                    onClick={() => selectTask(t.id)}
                    className="flex items-center justify-between gap-3 p-3 rounded-[8px] border border-[var(--border)] hover:bg-[var(--surface-muted)]/60 transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono-num text-xs font-bold text-[var(--muted-text)]">
                          {t.code}
                        </span>
                        <span className="text-[13px] font-semibold text-[var(--ink)] truncate">
                          {t.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-[var(--muted-text)]">
                        <span>{t.batchName}</span>
                        <span>·</span>
                        <span className="font-mono-num">
                          {filled}/{t.variations.length} variations
                        </span>
                        <span>·</span>
                        <span className="font-mono-num text-[var(--butter-ink)] font-semibold">
                          {urgency.label}
                        </span>
                      </div>
                    </div>
                    <StatusBadge status={t.status} revisionCount={t.revisionCount} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Task Lifecycle Pipeline Strip */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[12px] p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-sm font-bold text-[var(--ink)]">
            Task Lifecycle Pipeline
          </h2>
          <span className="text-xs text-[var(--muted-text)] font-mono-num">
            Total tracked: {tasks.length} tasks
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {pipelineStages.map((stage) => {
            const count = tasks.filter((t) => t.status === stage.status).length;
            return (
              <motion.button
                key={stage.status}
                type="button"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate(`/tasks?tab=${stage.tabParam}`)}
                className="flex flex-col justify-between p-3 rounded-[8px] border border-[var(--border)] bg-[var(--surface-muted)]/40 hover:bg-[var(--surface-muted)] transition-colors text-left cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`px-2 py-0.5 text-[11px] font-semibold rounded-[6px] border ${stage.toneClass}`}
                  >
                    {stage.status}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--muted-text)]" />
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="font-display text-2xl font-bold text-[var(--ink)] tabular-nums">
                    <AnimatedNumber value={count} />
                  </span>
                  <span className="text-[11px] text-[var(--muted-text)] truncate">
                    {stage.label}
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Charts Grid with Smooth Entrance Transitions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.06 }}
          className="lg:col-span-7 bg-[var(--surface)] border border-[var(--border)] rounded-[12px] p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="font-display text-base font-bold text-[var(--ink)]">
                QA Score Trend (LLM vs. Human Review)
              </h2>
              <p className="text-xs text-[var(--muted-text)]">
                Sequential 1.0–5.0 evaluation across recent tasks with{' '}
                {settings.passThreshold.toFixed(1)} pass threshold
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#6E59A5]" />
                <span>QA LLM</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#2E6F44]" />
                <span>QA Human</span>
              </span>
            </div>
          </div>

          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={scoreTrendData}
                margin={{ top: 10, right: 16, left: -12, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: 'var(--muted-text)' }}
                  axisLine={{ stroke: 'var(--border)' }}
                />
                <YAxis
                  domain={[2.5, 5.0]}
                  ticks={[2.5, 3.0, 3.5, 4.0, 4.5, 5.0]}
                  tick={{ fontSize: 11, fill: 'var(--muted-text)' }}
                  axisLine={{ stroke: 'var(--border)' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--border)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <ReferenceLine
                  y={settings.passThreshold}
                  stroke="#B85D6F"
                  strokeDasharray="4 4"
                  label={{
                    value: `Pass ${settings.passThreshold.toFixed(1)}`,
                    position: 'insideTopRight',
                    fill: '#B85D6F',
                    fontSize: 11,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="LLM"
                  stroke="#6E59A5"
                  strokeWidth={2}
                  dot={{ r: 3.5, fill: '#6E59A5' }}
                  activeDot={{ r: 5 }}
                  isAnimationActive={true}
                  animationDuration={750}
                />
                <Line
                  type="monotone"
                  dataKey="Human"
                  stroke="#2E6F44"
                  strokeWidth={2.2}
                  dot={{ r: 4, fill: '#2E6F44' }}
                  activeDot={{ r: 5.5 }}
                  connectNulls
                  isAnimationActive={true}
                  animationDuration={850}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.1 }}
          className="lg:col-span-5 bg-[var(--surface)] border border-[var(--border)] rounded-[12px] p-5"
        >
          <div className="mb-4">
            <h2 className="font-display text-base font-bold text-[var(--ink)]">
              Tasks by Difficulty & Rate
            </h2>
            <p className="text-xs text-[var(--muted-text)]">
              Distribution across Easy (${settings.rates.Easy}), Medium ($
              {settings.rates.Medium}), and Hard (${settings.rates.Hard})
            </p>
          </div>

          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={difficultyChartData}
                margin={{ top: 10, right: 12, left: -16, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="difficulty"
                  tick={{ fontSize: 11, fill: 'var(--ink)' }}
                  axisLine={{ stroke: 'var(--border)' }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: 'var(--muted-text)' }}
                  axisLine={{ stroke: 'var(--border)' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--border)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar
                  dataKey="Reviewed"
                  stackId="a"
                  fill="#8BB898"
                  name="Reviewed"
                  animationDuration={700}
                />
                <Bar
                  dataKey="InQA"
                  stackId="a"
                  fill="#B4A7D6"
                  name="Submitted / QA"
                  animationDuration={700}
                />
                <Bar
                  dataKey="Active"
                  stackId="a"
                  fill="#E5D17A"
                  name="In Progress / Rev"
                  animationDuration={700}
                />
                <Bar
                  dataKey="Available"
                  stackId="a"
                  fill="#A4C4DF"
                  name="Available"
                  radius={[4, 4, 0, 0]}
                  animationDuration={700}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[12px] p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-display text-base font-bold text-[var(--ink)]">
                  Weekly Throughput
                </h2>
                <p className="text-xs text-[var(--muted-text)]">
                  Tasks completed & hours logged per week
                </p>
              </div>
              <TrendingUp className="w-4 h-4 text-[var(--muted-text)]" />
            </div>

            <div className="h-[175px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={weeklyThroughputData}
                  margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="week"
                    tick={{ fontSize: 11, fill: 'var(--muted-text)' }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: 'var(--muted-text)' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--surface)',
                      borderColor: 'var(--border)',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar
                    dataKey="completed"
                    fill="#95B8D1"
                    name="Tasks Delivered"
                    radius={[4, 4, 0, 0]}
                    animationDuration={750}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[12px] p-5">
            <h2 className="font-display text-base font-bold text-[var(--ink)] mb-1">
              QA Outcome Ratio
            </h2>
            <p className="text-xs text-[var(--muted-text)] mb-3">
              First-pass approval vs. revision cycle tasks
            </p>
            <div className="flex items-center gap-4">
              <div className="w-32 h-32 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={passFailData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={52}
                      paddingAngle={3}
                      animationDuration={750}
                    >
                      {passFailData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2 text-xs">
                {passFailData.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="flex items-center gap-2 text-[var(--ink)]">
                      <span
                        className="w-2.5 h-2.5 rounded-[3px] shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span>{item.name}</span>
                    </span>
                    <span className="font-mono-num font-bold tabular-nums">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 bg-[var(--surface)] border border-[var(--border)] rounded-[12px] p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-display text-base font-bold text-[var(--ink)]">
                  Recent Studio Activity
                </h2>
                <p className="text-xs text-[var(--muted-text)]">
                  Latest claims, 8-file Google Drive uploads, and QA score logs
                </p>
              </div>
              <Clock className="w-4 h-4 text-[var(--muted-text)]" />
            </div>

            {recentActivity.length === 0 ? (
              <div className="py-12 text-center text-xs text-[var(--muted-text)]">
                Belum ada riwayat aktivitas. Tambahkan task baru untuk memulai.
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {recentActivity.map((event) => (
                  <div
                    key={event.id}
                    onClick={() => selectTask(event.taskId)}
                    className="py-2.5 flex items-start justify-between gap-3 hover:bg-[var(--surface-muted)]/45 px-2 -mx-2 rounded-[8px] transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono-num text-xs font-bold text-[var(--muted-text)]">
                          {event.taskCode}
                        </span>
                        <span className="text-xs font-semibold text-[var(--ink)] truncate">
                          {event.action}
                        </span>
                        {event.score !== undefined && (
                          <ScoreChip score={event.score} />
                        )}
                      </div>
                      <p className="text-xs text-[var(--muted-text)] truncate mt-0.5">
                        {event.taskTitle}
                        {event.details ? ` — ${event.details}` : ''}
                      </p>
                    </div>

                    <span className="font-mono-num text-[11px] text-[var(--muted-text)] whitespace-nowrap shrink-0">
                      {formatFullDateTime(event.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 mt-3 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--muted-text)]">
            <span>Klik item untuk membuka 8 varian & upload ke Google Drive</span>
            <button
              type="button"
              onClick={() => navigate('/reports')}
              className="font-semibold text-[var(--ink)] hover:underline cursor-pointer"
            >
              Full QA Reports →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
