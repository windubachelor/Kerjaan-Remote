import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { AppSettings, Task } from '../types';
import { calculateTaskPayout, formatMinutes } from './utils';

export interface LatexReportMetrics {
  totalTasks: number;
  reviewedCount: number;
  paidCount: number;
  clientRevisionCount: number;
  firstPassCount: number;
  firstPassPct: number;
  avgLLM: number;
  avgHuman: number;
  avgDelta: number;
  totalHours: number;
  earnedTotal: number;
  paidTotal: number;
}

export function computeLatexReportMetrics(
  tasks: Task[],
  settings: AppSettings
): LatexReportMetrics {
  const reviewed = tasks.filter((t) => t.status === 'Reviewed');
  const paid = tasks.filter((t) => Boolean(t.isPaid));
  const clientRev = tasks.filter((t) => Boolean(t.clientRevision) && !t.isPaid);
  const humanEvaluated = tasks.filter((t) => t.qaHuman !== null);
  const llmEvaluated = tasks.filter((t) => t.qaLLM !== null);

  const firstPass = reviewed.filter((t) => t.revisionCount === 0).length;
  const firstPassPct =
    humanEvaluated.length > 0
      ? Math.round((firstPass / humanEvaluated.length) * 100)
      : 0;

  const avgLLM =
    llmEvaluated.length > 0
      ? llmEvaluated.reduce((s, t) => s + (t.qaLLM ?? 0), 0) / llmEvaluated.length
      : 0;

  const avgHuman =
    humanEvaluated.length > 0
      ? humanEvaluated.reduce((s, t) => s + (t.qaHuman ?? 0), 0) /
        humanEvaluated.length
      : 0;

  const bothScored = tasks.filter((t) => t.qaLLM !== null && t.qaHuman !== null);
  const avgDelta =
    bothScored.length > 0
      ? bothScored.reduce((s, t) => s + ((t.qaHuman ?? 0) - (t.qaLLM ?? 0)), 0) /
        bothScored.length
      : 0;

  const totalMinutes = tasks.reduce((s, t) => s + (t.timeSpentMinutes || 0), 0);
  const earnedTotal = reviewed.reduce(
    (s, t) => s + calculateTaskPayout(t.difficulty, settings.rates),
    0
  );
  const paidTotal = paid.reduce(
    (s, t) => s + calculateTaskPayout(t.difficulty, settings.rates),
    0
  );

  return {
    totalTasks: tasks.length,
    reviewedCount: reviewed.length,
    paidCount: paid.length,
    clientRevisionCount: clientRev.length,
    firstPassCount: firstPass,
    firstPassPct,
    avgLLM,
    avgHuman,
    avgDelta,
    totalHours: Number((totalMinutes / 60).toFixed(2)),
    earnedTotal,
    paidTotal,
  };
}

/**
 * Generates compilable LaTeX (.tex) source with booktabs tables and mathematical formulas.
 */
export function generateLatexSource(
  tasks: Task[],
  settings: AppSettings
): string {
  const m = computeLatexReportMetrics(tasks, settings);
  const todayStr = format(new Date(), 'MMMM d, yyyy');
  const escapeTex = (str: string) =>
    str
      .replace(/\\/g, '\\textbackslash{}')
      .replace(/([&%$#_{}])/g, '\\$1')
      .replace(/~/g, '\\textasciitilde{}')
      .replace(/\^/g, '\\textasciicircum{}');

  const batchMap = new Map<
    string,
    {
      total: number;
      reviewed: number;
      paid: number;
      minutes: number;
      payout: number;
    }
  >();

  tasks.forEach((t) => {
    const cur = batchMap.get(t.batchName) ?? {
      total: 0,
      reviewed: 0,
      paid: 0,
      minutes: 0,
      payout: 0,
    };
    cur.total += 1;
    if (t.status === 'Reviewed') {
      cur.reviewed += 1;
      cur.payout += calculateTaskPayout(t.difficulty, settings.rates);
    }
    if (t.isPaid) {
      cur.paid += 1;
    }
    cur.minutes += t.timeSpentMinutes || 0;
    batchMap.set(t.batchName, cur);
  });

  const batchRowsTex = Array.from(batchMap.entries())
    .map(
      ([batch, b]) =>
        `${escapeTex(batch)} & ${b.total} & ${b.reviewed} & ${b.paid} & ${(
          b.minutes / 60
        ).toFixed(1)}h & \\$${b.payout} \\\\`
    )
    .join('\n    ');

  const taskRowsTex = tasks
    .map((t) => {
      const filled = t.variations.filter((v) => v.filled).length;
      const delta =
        t.qaLLM !== null && t.qaHuman !== null
          ? (t.qaHuman - t.qaLLM >= 0 ? '+' : '') +
            (t.qaHuman - t.qaLLM).toFixed(1)
          : '--';
      const statusLabel = t.isPaid
        ? 'PAID'
        : t.clientRevision
        ? 'Revisi Klien'
        : t.status;
      return `${escapeTex(t.code)} & ${escapeTex(
        t.title.slice(0, 34)
      )} & ${escapeTex(t.difficulty)} & ${filled}/${t.variations.length} & ${
        t.qaLLM !== null ? t.qaLLM.toFixed(1) : '--'
      } & ${
        t.qaHuman !== null ? t.qaHuman.toFixed(1) : '--'
      } & ${delta} & ${escapeTex(statusLabel)} \\\\`;
    })
    .join('\n    ');

  return `\\documentclass[11pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[margin=1.8cm]{geometry}
\\usepackage{booktabs}
\\usepackage{amsmath,amssymb}
\\usepackage{hyperref}

\\title{\\textbf{Kerjaan-Remote: Quantitative QA \\& Production Evaluation Ledger}\\\\[0.4em]
\\large 10-Variation AI Illustration Evaluation, Score Calibration ($\\Delta$), \\& Financial Audit}
\\author{Illustrator: \\textbf{${escapeTex(settings.illustratorName)}}}
\\date{${todayStr}}

\\begin{document}
\\maketitle

\\begin{abstract}
\\noindent This technical ledger summarizes illustration evaluation performance across \\textbf{${
    m.totalTasks
  }} tracked tasks (10 variations per task: slots 01--08 illustration \\& PSD plates, slot 09 original task image, and slot 10 task notes \\texttt{.txt}). Under a minimum Human QA pass threshold of $\\tau = ${settings.passThreshold.toFixed(
    1
  )}$, the studio achieved a first-pass approval rate of $\\eta = ${
    m.firstPassPct
  }\\%$, a mean LLM score of $\\mu_{\\text{LLM}} = ${m.avgLLM.toFixed(
    2
  )}$, and a mean Human score of $\\mu_{\\text{Human}} = ${m.avgHuman.toFixed(
    2
  )}$ ($\\bar{\\Delta} = ${m.avgDelta >= 0 ? '+' : ''}${m.avgDelta.toFixed(
    2
  )}$). Total verified earnings equal \\textbf{\\$${
    m.earnedTotal
  }} (\\textbf{\\$${m.paidTotal}} settled as Paid).
\\end{abstract}

\\section{Mathematical Calibration \\& Telemetry}
\\begin{align*}
  \\mu_{\\text{LLM}} &= ${m.avgLLM.toFixed(
    2
  )}, \\quad \\mu_{\\text{Human}} = ${m.avgHuman.toFixed(
    2
  )}, \\quad \\bar{\\Delta} = \\frac{1}{N}\\sum_{i=1}^{N}(S_{\\text{Human},i} - S_{\\text{LLM},i}) = ${
    m.avgDelta >= 0 ? '+' : ''
  }${m.avgDelta.toFixed(2)} \\\\
  \\eta_{\\text{1st-pass}} &= \\frac{N_{\\text{1st-pass}}}{N_{\\text{eval}}} \\times 100\\% = ${
    m.firstPassPct
  }\\%, \\quad T_{\\text{total}} = ${m.totalHours}\\text{ hours}
\\end{align*}

\\section{Batch Throughput \\& Financial Summary}
\\begin{table}[h!]
  \\centering
  \\begin{tabular}{lrrrrr}
    \\toprule
    \\textbf{Batch Name} & \\textbf{Tasks} & \\textbf{Reviewed} & \\textbf{Paid} & \\textbf{Hours} & \\textbf{Earned (USD)} \\\\
    \\midrule
    ${batchRowsTex || '\\multicolumn{6}{c}{No batches recorded} \\\\'}
    \\bottomrule
  \\end{tabular}
  \\caption{Batch-level throughput and verified payout summary.}
\\end{table}

\\section{Task-Level QA \\& 10-Variation Audit Registry}
\\begin{table}[h!]
  \\centering
  \\small
  \\begin{tabular}{lllcrrrl}
    \\toprule
    \\textbf{Code} & \\textbf{Title} & \\textbf{Tier} & \\textbf{Slots} & \\textbf{LLM} & \\textbf{Human} & $\\mathbf{\\Delta}$ & \\textbf{Status} \\\\
    \\midrule
    ${taskRowsTex || '\\multicolumn{8}{c}{No tasks recorded} \\\\'}
    \\bottomrule
  \\end{tabular}
  \\caption{Complete task registry with 10-variation completion and Paid/Revision state.}
\\end{table}

\\end{document}
`;
}

/**
 * Generates and downloads a LaTeX-typeset PDF document (.pdf) using jsPDF
 * with academic Roman serif typography, numbered sections, mathematical expressions,
 * and authentic booktabs three-rule tables (\toprule, \midrule, \bottomrule).
 */
export function exportLatexReportToPdf(tasks: Task[], settings: AppSettings) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const marginX = 18;
  const contentWidth = pageWidth - marginX * 2; // 174mm
  const m = computeLatexReportMetrics(tasks, settings);
  const dateStr = format(new Date(), 'MMMM d, yyyy');

  let y = 22;

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > pageHeight - 20) {
      doc.addPage();
      // Running LaTeX header on subsequent pages
      doc.setFont('times', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(90, 90, 90);
      doc.text(
        'Kerjaan-Remote: Quantitative QA & Production Evaluation Ledger',
        marginX,
        14
      );
      doc.text(dateStr, pageWidth - marginX, 14, { align: 'right' });
      doc.setDrawColor(160, 160, 160);
      doc.setLineWidth(0.2);
      doc.line(marginX, 16, pageWidth - marginX, 16);
      doc.setTextColor(20, 20, 20);
      y = 24;
    }
  };

  // --- LaTeX \maketitle Block ---
  doc.setFont('times', 'bold');
  doc.setFontSize(16.5);
  doc.setTextColor(18, 18, 18);
  doc.text(
    'Kerjaan-Remote: Quantitative QA & Production Evaluation Ledger',
    pageWidth / 2,
    y,
    { align: 'center' }
  );
  y += 6.5;

  doc.setFont('times', 'italic');
  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);
  doc.text(
    '10-Variation AI Illustration Evaluation, Score Calibration (Delta), & Financial Audit',
    pageWidth / 2,
    y,
    { align: 'center' }
  );
  y += 6.5;

  doc.setFont('times', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(25, 25, 25);
  doc.text(
    `Author: ${settings.illustratorName}    ·    Date: ${dateStr}    ·    Pass Threshold: >= ${settings.passThreshold.toFixed(
      1
    )}`,
    pageWidth / 2,
    y,
    { align: 'center' }
  );
  y += 7;

  // --- LaTeX \begin{abstract} Box ---
  doc.setDrawColor(30, 30, 30);
  doc.setLineWidth(0.35);
  doc.line(marginX + 8, y, pageWidth - marginX - 8, y);
  y += 4.5;

  doc.setFont('times', 'bold');
  doc.setFontSize(9.5);
  doc.text('Abstract', pageWidth / 2, y, { align: 'center' });
  y += 4.5;

  doc.setFont('times', 'normal');
  doc.setFontSize(9.5);
  const abstractText = `This technical evaluation ledger documents ${
    m.totalTasks
  } tracked illustration tasks under the standardized 10-variation specification (slots 01-08 illustration & .psd master plates, slot 09 original task image, and slot 10 task notes .txt synced to Google Drive). With a Human QA pass threshold of ${settings.passThreshold.toFixed(
    1
  )}, the studio recorded a ${
    m.firstPassPct
  }% first-pass approval rate, mean LLM QA score of ${m.avgLLM.toFixed(
    2
  )}, mean Human QA score of ${m.avgHuman.toFixed(
    2
  )}, and calibration delta of ${
    m.avgDelta >= 0 ? '+' : ''
  }${m.avgDelta.toFixed(2)}. Total verified earnings: $${
    m.earnedTotal
  } ($${m.paidTotal} settled in Paid status; ${
    m.clientRevisionCount
  } tasks in Client Revision).`;

  const abstractLines = doc.splitTextToSize(abstractText, contentWidth - 20);
  doc.text(abstractLines, marginX + 10, y);
  y += abstractLines.length * 4.2 + 2;

  doc.line(marginX + 8, y, pageWidth - marginX - 8, y);
  y += 8;

  // --- Section 1: Executive Telemetry & Mathematical Calibration ---
  doc.setFont('times', 'bold');
  doc.setFontSize(12.5);
  doc.text('1   Executive Telemetry & Score Calibration Formulas', marginX, y);
  y += 5;

  // Equation / Metric Box
  doc.setFillColor(248, 246, 242);
  doc.setDrawColor(190, 185, 175);
  doc.setLineWidth(0.25);
  doc.rect(marginX, y, contentWidth, 24, 'FD');

  doc.setFont('courier', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);
  doc.text(
    `mu_LLM   = ${m.avgLLM.toFixed(2)} / 5.00        mu_Human = ${m.avgHuman.toFixed(
      2
    )} / 5.00        Delta (Human - LLM) = ${
      m.avgDelta >= 0 ? '+' : ''
    }${m.avgDelta.toFixed(2)}`,
    marginX + 4,
    y + 6.5
  );
  doc.text(
    `Pass_1st = ${m.firstPassPct}% (${m.firstPassCount} tasks)   Reviewed = ${m.reviewedCount} tasks          Paid (Settled)      = ${m.paidCount} tasks ($${m.paidTotal})`,
    marginX + 4,
    y + 13
  );
  doc.text(
    `ClientRev= ${m.clientRevisionCount} tasks           Hours    = ${m.totalHours}h             Rates (E/M/H)       = $${settings.rates.Easy} / $${settings.rates.Medium} / $${settings.rates.Hard}`,
    marginX + 4,
    y + 19.5
  );
  y += 31;

  // --- Section 2: Batch Throughput & Payout Breakdown (booktabs Table 1) ---
  ensureSpace(45);
  doc.setFont('times', 'bold');
  doc.setFontSize(12.5);
  doc.text('2   Batch Throughput & Financial Summary', marginX, y);
  y += 3.5;

  doc.setFont('times', 'italic');
  doc.setFontSize(9.5);
  doc.setTextColor(60, 60, 60);
  doc.text(
    'Table 1: Aggregated batch production metrics, logged studio hours, and verified payouts.',
    marginX,
    y + 3
  );
  doc.setTextColor(20, 20, 20);
  y += 6.5;

  // \toprule (thick line)
  doc.setDrawColor(20, 20, 20);
  doc.setLineWidth(0.55);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 4.5;

  doc.setFont('times', 'bold');
  doc.setFontSize(9.5);
  doc.text('Batch Identifier', marginX + 1, y);
  doc.text('Total', marginX + 68, y, { align: 'right' });
  doc.text('Reviewed', marginX + 92, y, { align: 'right' });
  doc.text('Paid', marginX + 112, y, { align: 'right' });
  doc.text('Avg Human', marginX + 138, y, { align: 'right' });
  doc.text('Hours', marginX + 155, y, { align: 'right' });
  doc.text('Earned ($)', pageWidth - marginX - 1, y, { align: 'right' });
  y += 2.2;

  // \midrule (thin line)
  doc.setLineWidth(0.25);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 4.5;

  const batchMap = new Map<
    string,
    {
      total: number;
      reviewed: number;
      paid: number;
      humanSum: number;
      humanCount: number;
      minutes: number;
      earned: number;
    }
  >();

  tasks.forEach((t) => {
    const cur = batchMap.get(t.batchName) ?? {
      total: 0,
      reviewed: 0,
      paid: 0,
      humanSum: 0,
      humanCount: 0,
      minutes: 0,
      earned: 0,
    };
    cur.total += 1;
    if (t.status === 'Reviewed') {
      cur.reviewed += 1;
      cur.earned += calculateTaskPayout(t.difficulty, settings.rates);
    }
    if (t.isPaid) cur.paid += 1;
    if (t.qaHuman !== null) {
      cur.humanSum += t.qaHuman;
      cur.humanCount += 1;
    }
    cur.minutes += t.timeSpentMinutes || 0;
    batchMap.set(t.batchName, cur);
  });

  doc.setFont('times', 'normal');
  doc.setFontSize(9.5);

  if (batchMap.size === 0) {
    doc.text('No batch records available.', marginX + 2, y);
    y += 5;
  } else {
    Array.from(batchMap.entries()).forEach(([batchName, b]) => {
      ensureSpace(8);
      doc.setFont('times', 'normal');
      doc.text(batchName.slice(0, 32), marginX + 1, y);
      doc.setFont('courier', 'normal');
      doc.text(String(b.total), marginX + 68, y, { align: 'right' });
      doc.text(String(b.reviewed), marginX + 92, y, { align: 'right' });
      doc.text(String(b.paid), marginX + 112, y, { align: 'right' });
      doc.text(
        b.humanCount > 0 ? (b.humanSum / b.humanCount).toFixed(2) : '—',
        marginX + 138,
        y,
        { align: 'right' }
      );
      doc.text(`${(b.minutes / 60).toFixed(1)}h`, marginX + 155, y, {
        align: 'right',
      });
      doc.setFont('courier', 'bold');
      doc.text(`$${b.earned}`, pageWidth - marginX - 1, y, { align: 'right' });
      y += 5;
    });
  }

  // \bottomrule (thick line)
  doc.setLineWidth(0.55);
  doc.line(marginX, y - 1.5, pageWidth - marginX, y - 1.5);
  y += 7;

  // --- Section 3: Task-Level Evaluation & 10-Variation Audit Registry (booktabs Table 2) ---
  ensureSpace(40);
  doc.setFont('times', 'bold');
  doc.setFontSize(12.5);
  doc.text(
    '3   Task-Level QA Evaluation & 10-Variation Audit Registry',
    marginX,
    y
  );
  y += 3.5;

  doc.setFont('times', 'italic');
  doc.setFontSize(9.5);
  doc.setTextColor(60, 60, 60);
  doc.text(
    'Table 2: Individual task scores, 10-slot completion (including _original.png & _notes.txt), and Paid status.',
    marginX,
    y + 3
  );
  doc.setTextColor(20, 20, 20);
  y += 6.5;

  const drawTaskTableHeader = () => {
    doc.setDrawColor(20, 20, 20);
    doc.setLineWidth(0.55);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 4.5;

    doc.setFont('times', 'bold');
    doc.setFontSize(9);
    doc.text('Code', marginX + 1, y);
    doc.text('Task Title', marginX + 22, y);
    doc.text('Tier', marginX + 94, y);
    doc.text('Slots', marginX + 114, y, { align: 'right' });
    doc.text('LLM', marginX + 127, y, { align: 'right' });
    doc.text('Human', marginX + 141, y, { align: 'right' });
    doc.text('Delta', marginX + 154, y, { align: 'right' });
    doc.text('Status', pageWidth - marginX - 1, y, { align: 'right' });
    y += 2.2;

    doc.setLineWidth(0.25);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 4.5;
  };

  drawTaskTableHeader();

  if (tasks.length === 0) {
    doc.setFont('times', 'normal');
    doc.setFontSize(9.5);
    doc.text('No tasks recorded in the ledger.', marginX + 2, y);
    y += 5;
  } else {
    tasks.forEach((t) => {
      if (y + 7 > pageHeight - 20) {
        doc.setLineWidth(0.35);
        doc.line(marginX, y - 1.5, pageWidth - marginX, y - 1.5);
        ensureSpace(25);
        drawTaskTableHeader();
      }

      const filled = t.variations.filter((v) => v.filled).length;
      const deltaStr =
        t.qaLLM !== null && t.qaHuman !== null
          ? (t.qaHuman - t.qaLLM >= 0 ? '+' : '') +
            (t.qaHuman - t.qaLLM).toFixed(1)
          : '—';
      const statusText = t.isPaid
        ? 'PAID'
        : t.clientRevision
        ? 'REVISI KLIEN'
        : t.status.toUpperCase();

      doc.setFont('courier', 'bold');
      doc.setFontSize(8.5);
      doc.text(t.code.slice(0, 10), marginX + 1, y);

      doc.setFont('times', 'normal');
      doc.setFontSize(9);
      doc.text(t.title.slice(0, 38), marginX + 22, y);

      doc.setFont('times', 'italic');
      doc.text(
        `${t.difficulty} ($${calculateTaskPayout(t.difficulty, settings.rates)})`,
        marginX + 94,
        y
      );

      doc.setFont('courier', 'normal');
      doc.setFontSize(8.5);
      doc.text(`${filled}/${t.variations.length}`, marginX + 114, y, {
        align: 'right',
      });
      doc.text(
        t.qaLLM !== null ? t.qaLLM.toFixed(1) : '—',
        marginX + 127,
        y,
        { align: 'right' }
      );
      doc.text(
        t.qaHuman !== null ? t.qaHuman.toFixed(1) : '—',
        marginX + 141,
        y,
        { align: 'right' }
      );
      doc.text(deltaStr, marginX + 154, y, { align: 'right' });

      doc.setFont('courier', 'bold');
      doc.text(statusText, pageWidth - marginX - 1, y, { align: 'right' });
      y += 4.8;
    });
  }

  // \bottomrule
  doc.setLineWidth(0.55);
  doc.line(marginX, y - 1.5, pageWidth - marginX, y - 1.5);
  y += 8;

  // --- Section 4: 10-Variation Naming & Archive Specification ---
  ensureSpace(32);
  doc.setFont('times', 'bold');
  doc.setFontSize(11.5);
  doc.text('4   Standardized 10-Variation Specification (Google Drive Sync)', marginX, y);
  y += 5;

  doc.setFont('courier', 'normal');
  doc.setFontSize(8.5);
  const specLines = [
    '01: {Title}_rough.png                  06: {Title}_master.psd (Layered PSD)',
    '02: {Title}_rough_object_swap.png      07: {Title}_detailed_object_swap.png',
    '03: {Title}_detailed_background.png    08: {Title}_detailed.png',
    '04: {Title}_detailed_expression_1.png  09: {Title}_original.png (Gambar Asli Task)',
    '05: {Title}_detailed_expression_2.png  10: {Title}_notes.txt (File Catatan / Prompt .txt)',
  ];
  specLines.forEach((line) => {
    doc.text(line, marginX + 3, y);
    y += 4.2;
  });

  // Add LaTeX page numbers on all pages
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('times', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(80, 80, 80);
    doc.text(`— ${i} of ${pageCount} —`, pageWidth / 2, pageHeight - 10, {
      align: 'center',
    });
  }

  doc.save(
    `kerjaan-remote-qa-report-latex-${format(new Date(), 'yyyy-MM-dd')}.pdf`
  );
}
