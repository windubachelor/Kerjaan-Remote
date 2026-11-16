import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  Columns2,
  ExternalLink,
  FileCode2,
  FileText,
  Maximize2,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Task, VariationItem } from '../../types';
import {
  buildVariationDriveFileName,
  formatSlotNum,
  getVariationRequiredExt,
  getVariationSuffix,
} from '../../lib/googleDrive';
import { cn } from '../../lib/utils';

interface VariationLightboxModalProps {
  open: boolean;
  task: Task;
  initialSlotNumber?: number;
  initialCompareMode?: boolean;
  onClose: () => void;
}

export const VariationLightboxModal: React.FC<VariationLightboxModalProps> = ({
  open,
  task,
  initialSlotNumber = 1,
  initialCompareMode = false,
  onClose,
}) => {
  const [compareMode, setCompareMode] = useState(initialCompareMode);
  const [activeSlot, setActiveSlot] = useState(initialSlotNumber);
  const [leftSlot, setLeftSlot] = useState(9);
  const [rightSlot, setRightSlot] = useState(8);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (open) {
      setActiveSlot(initialSlotNumber);
      setCompareMode(initialCompareMode);
      setZoom(1);
      // Prefer comparing Original Task Image (slot 9) or first filled PNG with Detailed (slot 8)
      const filledPngs = task.variations.filter(
        (v) => v.filled && v.slotNumber !== 6 && v.slotNumber !== 10 && v.imageUrl
      );
      if (filledPngs.length >= 2) {
        const hasOriginal = filledPngs.find((v) => v.slotNumber === 9);
        setLeftSlot(hasOriginal ? 9 : filledPngs[0].slotNumber);
        setRightSlot(filledPngs[filledPngs.length - 1].slotNumber === 9 ? filledPngs[0].slotNumber : filledPngs[filledPngs.length - 1].slotNumber);
      } else {
        setLeftSlot(initialSlotNumber);
        setRightSlot(initialSlotNumber === 8 ? 9 : 8);
      }
    }
  }, [open, initialSlotNumber, initialCompareMode, task.id]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (!compareMode && e.key === 'ArrowRight') {
        setActiveSlot((s) => (s < task.variations.length ? s + 1 : 1));
      } else if (!compareMode && e.key === 'ArrowLeft') {
        setActiveSlot((s) => (s > 1 ? s - 1 : task.variations.length));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, compareMode, task.variations.length, onClose]);

  if (!open) return null;

  const getSlotItem = (slotNum: number): VariationItem => {
    return (
      task.variations.find((v) => v.slotNumber === slotNum) || task.variations[0]
    );
  };

  const currentItem = getSlotItem(activeSlot);
  const leftItem = getSlotItem(leftSlot);
  const rightItem = getSlotItem(rightSlot);

  const renderViewportPane = (item: VariationItem, titlePrefix?: string) => {
    const strictExt = getVariationRequiredExt(item.slotNumber);
    const suffix = getVariationSuffix(item.slotNumber);
    const padded = formatSlotNum(item.slotNumber);
    const stdName = buildVariationDriveFileName({
      taskTitle: task.title,
      slotNumber: item.slotNumber,
    });

    return (
      <div className="flex-1 flex flex-col min-w-0 h-full bg-[#121110] rounded-[12px] border border-white/10 overflow-hidden">
        {/* Pane Header */}
        <div className="px-4 py-2.5 bg-black/50 border-b border-white/10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {titlePrefix && (
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-white/10 text-white/80">
                {titlePrefix}
              </span>
            )}
            <span className="font-mono-num text-xs font-bold text-white">
              {padded}: _{suffix}.{strictExt}
            </span>
            <span className="text-xs text-white/50 truncate hidden sm:inline">
              ({stdName})
            </span>
          </div>

          {item.driveWebViewLink && (
            <a
              href={item.driveWebViewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 shrink-0"
            >
              <span>Buka di GDrive</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        {/* Pane Canvas */}
        <div className="flex-1 relative overflow-auto flex items-center justify-center p-4 sm:p-6 select-none">
          {strictExt === 'txt' && item.textContent ? (
            <div className="w-full max-w-xl bg-[#1A1D1A] border border-emerald-500/30 rounded-[10px] p-5 text-left font-mono-num text-xs text-emerald-100 whitespace-pre-wrap leading-relaxed shadow-2xl overflow-y-auto max-h-full select-text">
              <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-white/10 text-[11px] text-emerald-300/80">
                <span className="flex items-center gap-1.5 font-bold">
                  <FileText className="w-3.5 h-3.5" />
                  {stdName}
                </span>
                <span>{item.textContent.length} chars</span>
              </div>
              {item.textContent}
            </div>
          ) : item.imageUrl ? (
            <motion.img
              key={`${item.slotNumber}-${zoom}`}
              initial={{ opacity: 0.8, scale: 0.98 }}
              animate={{ opacity: 1, scale: zoom }}
              transition={{ duration: 0.15 }}
              src={item.imageUrl}
              alt={stdName}
              referrerPolicy="no-referrer"
              style={{ transformOrigin: 'center center' }}
              className="max-w-full max-h-full object-contain rounded-[6px] shadow-2xl"
            />
          ) : (
            <div className="text-center space-y-2 text-white/50">
              <FileCode2 className="w-8 h-8 mx-auto opacity-50" />
              <p className="text-xs font-semibold">
                Slot {padded} (_{suffix}.{strictExt}) belum berisi file
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex flex-col p-2 sm:p-5"
        onClick={onClose}
      >
        <div
          className="w-full max-w-[1440px] mx-auto flex-1 flex flex-col gap-3 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-[12px] bg-[#1C1A17] border border-white/15 text-white">
            <div className="flex items-center gap-3 min-w-0">
              <span className="font-mono-num text-xs font-bold px-2 py-0.5 rounded bg-white/10 text-white border border-white/15">
                {task.code}
              </span>
              <h3 className="font-display text-sm sm:text-base font-bold truncate">
                {task.title}
              </h3>
            </div>

            {/* Mode Switcher & Zoom Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center p-0.5 rounded-[8px] bg-black/40 border border-white/15">
                <button
                  type="button"
                  onClick={() => setCompareMode(false)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-[6px] transition-colors cursor-pointer',
                    !compareMode
                      ? 'bg-white text-black'
                      : 'text-white/70 hover:text-white'
                  )}
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Single Lightbox</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCompareMode(true)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-[6px] transition-colors cursor-pointer',
                    compareMode
                      ? 'bg-white text-black'
                      : 'text-white/70 hover:text-white'
                  )}
                >
                  <Columns2 className="w-3.5 h-3.5" />
                  <span>Side-by-Side Compare</span>
                </button>
              </div>

              {/* Zoom */}
              <div className="inline-flex items-center gap-1 px-2 py-1 rounded-[8px] bg-black/40 border border-white/15">
                <button
                  type="button"
                  onClick={() =>
                    setZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))
                  }
                  className="p-1 text-white/70 hover:text-white cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(1)}
                  className="px-1.5 font-mono-num text-xs font-bold text-white cursor-pointer"
                  title="Reset Zoom 100%"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setZoom((z) => Math.min(3, Number((z + 0.25).toFixed(2))))
                  }
                  className="p-1 text-white/70 hover:text-white cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-[8px] bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                title="Close (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Revision Feedback Strip if task has feedback */}
          {task.latestFeedback && (
            <div className="px-4 py-2.5 rounded-[10px] bg-rose-950/80 border border-rose-500/40 text-rose-100 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <RotateCcw className="w-3.5 h-3.5 text-rose-300 shrink-0" />
                <span className="font-bold text-rose-200 shrink-0">
                  {task.clientRevision ? 'Revisi Klien:' : 'Catatan Revisi QA:'}
                </span>
                <span className="truncate">{task.latestFeedback}</span>
              </div>
              {task.qaHuman !== null && (
                <span className="font-mono-num font-bold px-2 py-0.5 rounded bg-rose-500/20 border border-rose-400/30 shrink-0">
                  Human: {task.qaHuman.toFixed(1)}
                </span>
              )}
            </div>
          )}

          {/* Compare Slot Selectors when in Side-by-Side mode */}
          {compareMode && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center justify-between gap-2 px-3.5 py-2 rounded-[10px] bg-[#1C1A17] border border-white/15 text-white text-xs">
                <span className="font-semibold text-white/70">Panel Kiri:</span>
                <select
                  value={leftSlot}
                  onChange={(e) => setLeftSlot(Number(e.target.value))}
                  className="px-2.5 py-1 rounded bg-black/60 border border-white/20 text-white font-mono-num text-xs cursor-pointer"
                >
                  {task.variations.map((v) => (
                    <option key={v.slotNumber} value={v.slotNumber}>
                      {formatSlotNum(v.slotNumber)}: _{getVariationSuffix(v.slotNumber)}.
                      {getVariationRequiredExt(v.slotNumber)}{' '}
                      {v.filled ? '(Terisi)' : '(Kosong)'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between gap-2 px-3.5 py-2 rounded-[10px] bg-[#1C1A17] border border-white/15 text-white text-xs">
                <span className="font-semibold text-white/70">Panel Kanan:</span>
                <select
                  value={rightSlot}
                  onChange={(e) => setRightSlot(Number(e.target.value))}
                  className="px-2.5 py-1 rounded bg-black/60 border border-white/20 text-white font-mono-num text-xs cursor-pointer"
                >
                  {task.variations.map((v) => (
                    <option key={v.slotNumber} value={v.slotNumber}>
                      {formatSlotNum(v.slotNumber)}: _{getVariationSuffix(v.slotNumber)}.
                      {getVariationRequiredExt(v.slotNumber)}{' '}
                      {v.filled ? '(Terisi)' : '(Kosong)'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Main Viewport */}
          <div className="flex-1 min-h-0 flex items-stretch gap-3">
            {compareMode ? (
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 min-h-0">
                {renderViewportPane(leftItem, 'KIRI')}
                {renderViewportPane(rightItem, 'KANAN')}
              </div>
            ) : (
              <div className="flex-1 flex items-center gap-2 min-h-0">
                <button
                  type="button"
                  onClick={() =>
                    setActiveSlot((s) =>
                      s > 1 ? s - 1 : task.variations.length
                    )
                  }
                  className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer shrink-0"
                  title="Slot Sebelumnya (←)"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                {renderViewportPane(currentItem)}

                <button
                  type="button"
                  onClick={() =>
                    setActiveSlot((s) =>
                      s < task.variations.length ? s + 1 : 1
                    )
                  }
                  className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer shrink-0"
                  title="Slot Berikutnya (→)"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          {/* Bottom 10-Slot Strip */}
          {!compareMode && (
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5 px-3 py-2.5 rounded-[12px] bg-[#1C1A17] border border-white/15">
              {task.variations.map((v) => {
                const isSelected = v.slotNumber === activeSlot;
                const suffix = getVariationSuffix(v.slotNumber);
                const ext = getVariationRequiredExt(v.slotNumber);
                return (
                  <button
                    key={v.slotNumber}
                    type="button"
                    onClick={() => setActiveSlot(v.slotNumber)}
                    className={cn(
                      'p-1.5 rounded-[8px] border text-left transition-all cursor-pointer flex flex-col gap-0.5',
                      isSelected
                        ? 'bg-white/15 border-white text-white'
                        : 'bg-black/40 border-white/10 text-white/60 hover:text-white hover:border-white/30'
                    )}
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono-num font-bold">
                      <span>{formatSlotNum(v.slotNumber)}</span>
                      <span
                        className={cn(
                          'px-1 rounded text-[9px] uppercase',
                          ext === 'psd'
                            ? 'bg-sky-500/30 text-sky-300'
                            : ext === 'txt'
                            ? 'bg-emerald-500/30 text-emerald-300'
                            : 'bg-white/10 text-white/70'
                        )}
                      >
                        .{ext}
                      </span>
                    </div>
                    <div className="text-[10px] truncate font-medium">
                      _{suffix}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
