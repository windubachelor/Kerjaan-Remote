import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, isPast, isToday, isTomorrow, parseISO } from 'date-fns';
import { Difficulty, TaskStatus, VariationItem } from '../types';
import { formatSlotNum, getVariationSuffix, VARIATION_GDRIVE_SPECS } from './googleDrive';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMinutes(totalMinutes: number): string {
  if (!totalMinutes || totalMinutes <= 0) return '0m';
  const hours = Math.floor(totalMinutes / 60);
  const mins = Math.round(totalMinutes % 60);
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function formatMinutesDecimal(totalMinutes: number): string {
  if (!totalMinutes || totalMinutes <= 0) return '0.0h';
  return `${(totalMinutes / 60).toFixed(1)}h`;
}

export function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined || Number.isNaN(score)) return '—';
  return score.toFixed(1);
}

export function formatShortDate(isoDate?: string): string {
  if (!isoDate) return '—';
  try {
    return format(parseISO(isoDate), 'MMM d');
  } catch {
    return '—';
  }
}

export function formatFullDateTime(isoDate?: string): string {
  if (!isoDate) return '—';
  try {
    return format(parseISO(isoDate), 'MMM d, yyyy · HH:mm');
  } catch {
    return '—';
  }
}

export function formatRelativeTime(isoDate?: string): string {
  if (!isoDate) return '';
  try {
    return formatDistanceToNow(parseISO(isoDate), { addSuffix: true });
  } catch {
    return '';
  }
}

export function getDeadlineUrgency(deadline?: string, status?: TaskStatus): {
  label: string;
  isUrgent: boolean;
  isOverdue: boolean;
} {
  if (!deadline) return { label: 'No deadline', isUrgent: false, isOverdue: false };
  if (status === 'Reviewed' || status === 'Skipped') {
    return { label: formatShortDate(deadline), isUrgent: false, isOverdue: false };
  }
  try {
    const parsed = parseISO(deadline);
    if (isToday(parsed)) {
      return { label: 'Due today', isUrgent: true, isOverdue: false };
    }
    if (isTomorrow(parsed)) {
      return { label: 'Due tomorrow', isUrgent: true, isOverdue: false };
    }
    if (isPast(parsed)) {
      return { label: `Overdue (${formatShortDate(deadline)})`, isUrgent: true, isOverdue: true };
    }
    return { label: `Due ${formatShortDate(deadline)}`, isUrgent: false, isOverdue: false };
  } catch {
    return { label: '—', isUrgent: false, isOverdue: false };
  }
}

export function generateVariationArtworkSvg(taskSeed: number, slotNumber: number, title?: string): string {
  const palettes = [
    { bg: '#F7F3EB', stroke: '#26231F', fill1: '#CFE3D4', fill2: '#F7D9C4', accent: '#DAD3F0' },
    { bg: '#F4F1EA', stroke: '#26231F', fill1: '#CFE2F3', fill2: '#F6EBB8', accent: '#F4CFD6' },
    { bg: '#F6F2EC', stroke: '#26231F', fill1: '#DAD3F0', fill2: '#CFE3D4', accent: '#F7D9C4' },
    { bg: '#F5F1EB', stroke: '#26231F', fill1: '#F7D9C4', fill2: '#CFE2F3', accent: '#CFE3D4' },
    { bg: '#F7F4EE', stroke: '#26231F', fill1: '#F6EBB8', fill2: '#F4CFD6', accent: '#CFE2F3' },
  ];
  const p = palettes[(taskSeed + slotNumber) % palettes.length];
  const variantType = (slotNumber - 1) % 7;

  let motif = '';
  if (variantType === 0) {
    motif = `
      <rect x="28" y="24" width="104" height="72" rx="4" fill="none" stroke="${p.stroke}" stroke-width="1.5" stroke-dasharray="4 2"/>
      <circle cx="62" cy="60" r="18" fill="${p.fill1}" fill-opacity="0.5" stroke="${p.stroke}" stroke-width="1.5"/>
      <path d="M84 82 L104 44 L124 82 Z" fill="none" stroke="${p.stroke}" stroke-width="1.5"/>
    `;
  } else if (variantType === 1) {
    motif = `
      <polygon points="80,20 128,44 80,68 32,44" fill="${p.fill2}" fill-opacity="0.6" stroke="${p.stroke}" stroke-width="1.5" stroke-dasharray="3 2"/>
      <rect x="64" y="54" width="32" height="32" rx="6" fill="${p.accent}" stroke="${p.stroke}" stroke-width="1.5"/>
    `;
  } else if (variantType === 2) {
    motif = `
      <rect x="20" y="22" width="120" height="76" rx="4" fill="${p.fill1}" stroke="${p.stroke}" stroke-width="1.5"/>
      <line x1="20" y1="68" x2="140" y2="68" stroke="${p.stroke}" stroke-width="1.5"/>
      <path d="M26 68 L52 38 L78 68 M68 68 L98 32 L132 68" fill="${p.fill2}" stroke="${p.stroke}" stroke-width="1.5"/>
    `;
  } else if (variantType === 3) {
    motif = `
      <circle cx="80" cy="58" r="28" fill="${p.fill2}" stroke="${p.stroke}" stroke-width="1.6"/>
      <circle cx="70" cy="52" r="3" fill="${p.stroke}"/>
      <circle cx="90" cy="52" r="3" fill="${p.stroke}"/>
      <path d="M68 68 Q80 78 92 68" fill="none" stroke="${p.stroke}" stroke-width="1.8" stroke-linecap="round"/>
    `;
  } else if (variantType === 4) {
    motif = `
      <circle cx="80" cy="58" r="28" fill="${p.accent}" stroke="${p.stroke}" stroke-width="1.6"/>
      <line x1="65" y1="49" x2="75" y2="53" stroke="${p.stroke}" stroke-width="1.8" stroke-linecap="round"/>
      <line x1="95" y1="49" x2="85" y2="53" stroke="${p.stroke}" stroke-width="1.8" stroke-linecap="round"/>
      <circle cx="80" cy="70" r="5" fill="${p.bg}" stroke="${p.stroke}" stroke-width="1.6"/>
    `;
  } else if (variantType === 5) {
    motif = `
      <rect x="24" y="20" width="112" height="80" rx="6" fill="${p.fill1}" stroke="${p.stroke}" stroke-width="1.8"/>
      <circle cx="80" cy="56" r="22" fill="${p.fill2}" stroke="${p.stroke}" stroke-width="1.8"/>
      <polygon points="80,38 96,68 64,68" fill="${p.accent}" stroke="${p.stroke}" stroke-width="1.6"/>
    `;
  } else {
    motif = `
      <rect x="24" y="20" width="112" height="80" rx="6" fill="${p.fill2}" stroke="${p.stroke}" stroke-width="1.8"/>
      <rect x="58" y="36" width="44" height="44" rx="8" fill="${p.accent}" stroke="${p.stroke}" stroke-width="1.8"/>
      <circle cx="80" cy="58" r="10" fill="${p.fill1}" stroke="${p.stroke}" stroke-width="1.6"/>
    `;
  }

  const suffixLabel = getVariationSuffix(slotNumber);
  const subLabel = title ? title.slice(0, 12).toUpperCase() : 'KR';
  const paddedSlot = formatSlotNum(slotNumber);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120" fill="none">
    <rect width="160" height="120" fill="${p.bg}"/>
    <rect x="6" y="6" width="148" height="108" rx="4" stroke="${p.stroke}" stroke-opacity="0.22" stroke-width="1.2"/>
    ${motif}
    <text x="12" y="18" fill="${p.stroke}" fill-opacity="0.8" font-family="monospace" font-size="7.5" font-weight="700">${paddedSlot}_${suffixLabel}</text>
    <text x="146" y="109" text-anchor="end" fill="${p.stroke}" fill-opacity="0.5" font-family="sans-serif" font-size="7" font-weight="600">${subLabel}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const VARIATION_SLOT_LABELS = VARIATION_GDRIVE_SPECS.map(
  (s) => `${s.label} (_${s.suffix}.${s.requiredExt})`
);

export function createEmptyVariations(count = 10): VariationItem[] {
  return Array.from({ length: count }, (_, idx) => {
    const spec = VARIATION_GDRIVE_SPECS[idx];
    return {
      slotNumber: idx + 1,
      filled: false,
      label: spec
        ? `${spec.label} (_${spec.suffix}.${spec.requiredExt})`
        : `Variation #${idx + 1}`,
    };
  });
}

export function normalizeTaskVariations(variations: VariationItem[] = []): VariationItem[] {
  return VARIATION_GDRIVE_SPECS.map((spec, idx) => {
    const slotNum = idx + 1;
    const existing = variations.find((v) => v.slotNumber === slotNum) || variations[idx];
    if (existing) {
      return {
        ...existing,
        slotNumber: slotNum,
        label: `${spec.label} (_${spec.suffix}.${spec.requiredExt})`,
      };
    }
    return {
      slotNumber: slotNum,
      filled: false,
      label: `${spec.label} (_${spec.suffix}.${spec.requiredExt})`,
    };
  });
}

export function exportToCsv(filename: string, rows: Record<string, string | number | null | undefined>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const cell = row[header] ?? '';
          const str = String(cell).replace(/"/g, '""');
          return `"${str}"`;
        })
        .join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function calculateTaskPayout(
  difficulty: Difficulty,
  rates: { Easy: number; Medium: number; Hard: number }
): number {
  return rates[difficulty] ?? 0;
}
