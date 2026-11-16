import React, { useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  CloudUpload,
  Copy,
  ExternalLink,
  FileCode2,
  FileText,
  ImagePlus,
  Link2,
  Loader2,
  Maximize2,
  PencilLine,
  Trash2,
  Upload,
} from 'lucide-react';
import { VariationItem } from '../../types';
import { cn } from '../../lib/utils';
import {
  buildVariationDriveFileName,
  formatSlotNum,
  generatePsdBadgeDataUrl,
  generateTxtBadgeDataUrl,
  getVariationSpec,
  getVariationSuffix,
  setSlotRawFile,
} from '../../lib/googleDrive';

interface VariationSlotProps {
  taskId: string;
  variation: VariationItem;
  taskCode: string;
  taskTitle: string;
  totalSlots: number;
  isUploading?: boolean;
  onUpdate: (data: {
    imageUrl?: string;
    imageName?: string;
    noteOrLink?: string;
    textContent?: string;
    label?: string;
    driveFileId?: string;
    driveFileName?: string;
    driveWebViewLink?: string;
    driveSyncedAt?: string;
  }) => void;
  onFileUploadSelected?: (
    file: File,
    dataUrl: string,
    autoDriveName: string,
    textContent?: string
  ) => void;
  onUploadToDrive?: () => void;
  onOpenLightbox?: (slotNumber: number) => void;
  onClear: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  disabled?: boolean;
}

export const VariationSlot: React.FC<VariationSlotProps> = ({
  taskId,
  variation,
  taskTitle,
  totalSlots,
  isUploading = false,
  onUpdate,
  onFileUploadSelected,
  onUploadToDrive,
  onOpenLightbox,
  onClear,
  onMoveUp,
  onMoveDown,
  disabled = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [noteInput, setNoteInput] = useState(variation.noteOrLink ?? '');
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [txtEditorOpen, setTxtEditorOpen] = useState(false);
  const [txtContentInput, setTxtContentInput] = useState(
    variation.textContent ?? ''
  );
  const [copiedName, setCopiedName] = useState(false);

  const spec = getVariationSpec(variation.slotNumber);
  const isPsdSlot = spec.requiredExt === 'psd';
  const isTxtSlot = spec.requiredExt === 'txt';
  const isOriginalSlot = variation.slotNumber === 9;
  const suffixKey = getVariationSuffix(variation.slotNumber);
  const slotPadded = formatSlotNum(variation.slotNumber);

  // Strict single format: {Title}_{suffix}.{png|psd|txt}
  const autoDriveFileName = buildVariationDriveFileName({
    taskTitle,
    slotNumber: variation.slotNumber,
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Cache the raw File object in memory so Google Drive receives the exact .psd, .txt, or .png binary
    setSlotRawFile(taskId, variation.slotNumber, file);

    if (isTxtSlot || file.name.toLowerCase().endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = () => {
        const textVal = typeof reader.result === 'string' ? reader.result : '';
        const txtBadgeUrl = generateTxtBadgeDataUrl(autoDriveFileName, textVal);
        setTxtContentInput(textVal);
        onUpdate({
          imageUrl: txtBadgeUrl,
          imageName: autoDriveFileName,
          textContent: textVal,
          noteOrLink:
            variation.noteOrLink ||
            `File .TXT siap upload (${textVal.length} karakter)`,
        });
        if (onFileUploadSelected) {
          onFileUploadSelected(file, txtBadgeUrl, autoDriveFileName, textVal);
        }
      };
      reader.readAsText(file);
      e.target.value = '';
      return;
    }

    if (isPsdSlot || file.name.toLowerCase().endsWith('.psd')) {
      const psdPreviewUrl = generatePsdBadgeDataUrl(autoDriveFileName, file.size);
      onUpdate({
        imageUrl: psdPreviewUrl,
        imageName: autoDriveFileName,
        noteOrLink:
          variation.noteOrLink ||
          `File PSD siap upload (${(file.size / (1024 * 1024)).toFixed(2)} MB)`,
      });
      if (onFileUploadSelected) {
        onFileUploadSelected(file, psdPreviewUrl, autoDriveFileName);
      }
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onUpdate({
          imageUrl: reader.result,
          imageName: autoDriveFileName,
          noteOrLink: variation.noteOrLink || autoDriveFileName,
        });
        if (onFileUploadSelected) {
          onFileUploadSelected(file, reader.result, autoDriveFileName);
        }
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSaveInlineTxt = () => {
    const trimmed = txtContentInput.trim();
    if (!trimmed) return;
    const syntheticFile = new File([trimmed], autoDriveFileName, {
      type: 'text/plain;charset=utf-8',
    });
    setSlotRawFile(taskId, variation.slotNumber, syntheticFile);
    const txtBadgeUrl = generateTxtBadgeDataUrl(autoDriveFileName, trimmed);
    onUpdate({
      imageUrl: txtBadgeUrl,
      imageName: autoDriveFileName,
      textContent: trimmed,
      noteOrLink:
        variation.noteOrLink || `File .TXT (${trimmed.length} karakter)`,
    });
    setTxtEditorOpen(false);
    if (onFileUploadSelected) {
      onFileUploadSelected(syntheticFile, txtBadgeUrl, autoDriveFileName, trimmed);
    }
  };

  const handleSaveNote = () => {
    onUpdate({ noteOrLink: noteInput.trim() });
    setIsEditingNote(false);
  };

  const handleCopyAutoName = () => {
    navigator.clipboard?.writeText(autoDriveFileName);
    setCopiedName(true);
    setTimeout(() => setCopiedName(false), 1500);
  };

  return (
    <div
      className={cn(
        'group rounded-[12px] border p-3.5 transition-all duration-150',
        variation.filled
          ? 'bg-[var(--surface)] border-[var(--border)] hover:border-[var(--border-strong)]'
          : 'bg-[var(--surface-muted)]/50 border-dashed border-[var(--border-strong)]'
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={spec.accept}
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="flex flex-col sm:flex-row items-start gap-3.5">
        {/* Thumbnail / Upload Zone */}
        <div className="relative w-full sm:w-28 h-24 sm:h-20 rounded-[8px] border border-[var(--border)] bg-[var(--surface-muted)] overflow-hidden shrink-0 flex items-center justify-center group/thumb">
          {variation.imageUrl ? (
            <>
              <img
                src={variation.imageUrl}
                alt={variation.label}
                referrerPolicy="no-referrer"
                onClick={() => onOpenLightbox && onOpenLightbox(variation.slotNumber)}
                className="w-full h-full object-cover cursor-zoom-in"
              />
              {onOpenLightbox && (
                <button
                  type="button"
                  onClick={() => onOpenLightbox(variation.slotNumber)}
                  className="absolute inset-0 bg-black/45 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-semibold gap-1 cursor-zoom-in"
                  title="Perbesar & Bandingkan (Lightbox)"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Preview</span>
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              disabled={disabled}
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-full flex flex-col items-center justify-center gap-1 text-[var(--muted-text)] hover:text-[var(--ink)] transition-colors cursor-pointer disabled:cursor-not-allowed"
              title={
                isPsdSlot
                  ? 'Pilih file .PSD untuk slot Master'
                  : isTxtSlot
                  ? 'Pilih file .TXT atau tulis teks untuk disimpan ke Google Drive'
                  : isOriginalSlot
                  ? 'Pilih Gambar Asli Task (.PNG)'
                  : 'Pilih file gambar .PNG'
              }
            >
              {isPsdSlot ? (
                <FileCode2 className="w-4 h-4 text-[var(--sky-ink)]" />
              ) : isTxtSlot ? (
                <FileText className="w-4 h-4 text-[var(--sage-ink)]" />
              ) : (
                <ImagePlus className="w-4 h-4" />
              )}
              <span className="text-[10px] font-bold">
                {isPsdSlot
                  ? 'Pilih .PSD'
                  : isTxtSlot
                  ? 'Pilih .TXT'
                  : isOriginalSlot
                  ? 'Gambar Asli'
                  : 'Pilih .PNG'}
              </span>
            </button>
          )}

          <span
            className={cn(
              'absolute top-1 left-1 px-1.5 py-0.2 text-[10px] font-mono-num font-bold rounded-[4px] border pointer-events-none',
              variation.filled
                ? 'bg-[var(--sage)] text-[var(--sage-ink)] border-[var(--sage-border)]'
                : 'bg-[var(--surface)] text-[var(--muted-text)] border-[var(--border)]'
            )}
          >
            {slotPadded}
          </span>
        </div>

        {/* Details & Controls */}
        <div className="flex-1 min-w-0 w-full">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <span className="text-[13px] font-bold text-[var(--ink)] truncate">
                {slotPadded}: _{suffixKey}
              </span>
              <span
                className={cn(
                  'px-1.5 py-0.2 text-[10px] font-mono-num font-bold uppercase rounded-[5px] border shrink-0',
                  isPsdSlot
                    ? 'bg-[var(--sky)] text-[var(--sky-ink)] border-[var(--sky-border)]'
                    : isTxtSlot
                    ? 'bg-[var(--sage)] text-[var(--sage-ink)] border-[var(--sage-border)]'
                    : isOriginalSlot
                    ? 'bg-[var(--butter)] text-[var(--butter-ink)] border-[var(--butter-border)]'
                    : 'bg-[var(--surface-muted)] text-[var(--muted-text)] border-[var(--border)]'
                )}
              >
                .{spec.requiredExt}{' '}
                {isPsdSlot
                  ? 'WAJIB'
                  : isTxtSlot
                  ? 'FILE TEKS'
                  : isOriginalSlot
                  ? 'GAMBAR ASLI'
                  : ''}
              </span>

              {variation.driveWebViewLink ? (
                <a
                  href={variation.driveWebViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--sage-ink)] bg-[var(--sage)] px-2 py-0.5 rounded-[6px] border border-[var(--sage-border)] hover:opacity-90 shrink-0"
                  title="Buka file di Google Drive"
                >
                  <Check className="w-3 h-3" />
                  <span>Tersimpan di GDrive</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              ) : variation.filled ? (
                <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-[var(--butter-ink)] bg-[var(--butter)] px-1.5 py-0.5 rounded-[6px] border border-[var(--butter-border)] shrink-0">
                  <Check className="w-3 h-3" />
                  Siap Upload
                </span>
              ) : null}
            </div>

            {/* Reorder, Lightbox, Upload & GDrive Sync Controls */}
            {!disabled && (
              <div className="flex flex-wrap items-center gap-1 shrink-0">
                {variation.filled && onOpenLightbox && (
                  <button
                    type="button"
                    onClick={() => onOpenLightbox(variation.slotNumber)}
                    title="Buka Lightbox & Compare"
                    className="p-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-text)] hover:text-[var(--ink)] hover:bg-[var(--surface-muted)] transition-colors cursor-pointer"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                )}
                {variation.slotNumber > 1 && onMoveUp && (
                  <button
                    type="button"
                    onClick={onMoveUp}
                    title="Pindah ke atas"
                    className="p-1 rounded-[6px] text-[var(--muted-text)] hover:text-[var(--ink)] hover:bg-[var(--surface-muted)] transition-colors cursor-pointer"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                )}
                {variation.slotNumber < totalSlots && onMoveDown && (
                  <button
                    type="button"
                    onClick={onMoveDown}
                    title="Pindah ke bawah"
                    className="p-1 rounded-[6px] text-[var(--muted-text)] hover:text-[var(--ink)] hover:bg-[var(--surface-muted)] transition-colors cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                )}

                {isTxtSlot && (
                  <button
                    type="button"
                    onClick={() => {
                      setTxtContentInput(variation.textContent ?? '');
                      setTxtEditorOpen((v) => !v);
                    }}
                    title="Ketik atau edit langsung isi file .txt"
                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-muted)] transition-colors cursor-pointer"
                  >
                    <PencilLine className="w-3 h-3" />
                    <span>{variation.textContent ? 'Edit .TXT' : 'Ketik .TXT'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title={
                    isPsdSlot
                      ? 'Pilih file .PSD Master'
                      : isTxtSlot
                      ? 'Pilih file .TXT dari komputer'
                      : isOriginalSlot
                      ? 'Pilih file Gambar Asli Task (.PNG)'
                      : 'Pilih file gambar .PNG'
                  }
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-muted)] transition-colors cursor-pointer"
                >
                  <Upload className="w-3 h-3" />
                  <span>
                    {variation.filled
                      ? 'Ganti File'
                      : isPsdSlot
                      ? 'File .PSD'
                      : isTxtSlot
                      ? 'File .TXT'
                      : 'File .PNG'}
                  </span>
                </button>

                {variation.filled && onUploadToDrive && (
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={onUploadToDrive}
                    title="Upload file ini langsung ke subfolder Google Drive"
                    className={cn(
                      'inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-[6px] border transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50',
                      variation.driveFileId
                        ? 'bg-[var(--surface-muted)] text-[var(--ink)] border-[var(--border-strong)] hover:bg-[var(--border)]'
                        : 'bg-[var(--ink)] text-[var(--background)] border-[var(--ink)] hover:opacity-90'
                    )}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <CloudUpload className="w-3.5 h-3.5" />
                        <span>
                          {variation.driveFileId ? 'Update GDrive' : 'Upload GDrive'}
                        </span>
                      </>
                    )}
                  </button>
                )}
                {variation.filled && (
                  <button
                    type="button"
                    onClick={onClear}
                    title="Kosongkan slot"
                    className="p-1.5 rounded-[6px] text-[var(--muted-text)] hover:text-[var(--rose-ink)] hover:bg-[var(--rose)]/50 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Standardized Filename Bar (Title Only + suffix + .png/.psd/.txt) */}
          <div className="mt-1.5 flex items-center justify-between gap-2 px-2.5 py-1 rounded-[6px] bg-[var(--surface-muted)]/85 border border-[var(--border)]">
            <code className="font-mono-num text-[11px] font-bold text-[var(--ink)] truncate">
              {autoDriveFileName}
            </code>
            <button
              type="button"
              onClick={handleCopyAutoName}
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--muted-text)] hover:text-[var(--ink)] shrink-0 cursor-pointer"
              title="Salin nama file"
            >
              {copiedName ? (
                <span className="text-[var(--sage-ink)]">Tersalin</span>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Salin</span>
                </>
              )}
            </button>
          </div>

          {/* Inline .TXT Editor for Slot 10 */}
          {isTxtSlot && txtEditorOpen && (
            <div className="mt-2 p-2.5 rounded-[8px] bg-[var(--background)] border border-[var(--border-strong)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[var(--ink)]">
                  Isi File {autoDriveFileName} (Disimpan ke Google Drive)
                </span>
                <span className="text-[10px] font-mono-num text-[var(--muted-text)]">
                  {txtContentInput.length} karakter
                </span>
              </div>
              <textarea
                rows={4}
                value={txtContentInput}
                onChange={(e) => setTxtContentInput(e.target.value)}
                placeholder="Ketik prompt, deskripsi perubahan objek/ekspresi, atau catatan task yang akan disimpan sebagai file .txt di Google Drive..."
                className="w-full px-2.5 py-1.5 text-xs font-mono-num rounded-[6px] bg-[var(--surface)] border border-[var(--border)] text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--ink)]"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTxtEditorOpen(false)}
                  className="px-2.5 py-1 text-xs text-[var(--muted-text)] hover:text-[var(--ink)] cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveInlineTxt}
                  className="px-3 py-1 text-xs font-semibold rounded-[6px] bg-[var(--ink)] text-[var(--background)] hover:opacity-90 cursor-pointer"
                >
                  Simpan File .TXT
                </button>
              </div>
            </div>
          )}

          {/* Preview of saved .TXT content */}
          {isTxtSlot && !txtEditorOpen && variation.textContent && (
            <div
              onClick={() => {
                if (!disabled) {
                  setTxtContentInput(variation.textContent ?? '');
                  setTxtEditorOpen(true);
                }
              }}
              className="mt-1.5 px-2.5 py-1.5 rounded-[6px] bg-[var(--surface-muted)]/60 border border-[var(--border)] text-[11px] font-mono-num text-[var(--ink)] line-clamp-2 cursor-pointer hover:border-[var(--border-strong)]"
              title="Klik untuk mengedit isi file .txt"
            >
              {variation.textContent}
            </div>
          )}

          {/* Note / Platform Link */}
          {isEditingNote ? (
            <div className="mt-2 flex items-center gap-1.5">
              <input
                type="text"
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveNote();
                  if (e.key === 'Escape') setIsEditingNote(false);
                }}
                placeholder="Catatan revisi atau link file..."
                className="flex-1 px-2.5 py-1 text-xs rounded-[8px] bg-[var(--background)] border border-[var(--border-strong)] text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--ink)]"
                autoFocus
              />
              <button
                type="button"
                onClick={handleSaveNote}
                className="px-2.5 py-1 text-xs font-semibold rounded-[8px] bg-[var(--ink)] text-[var(--background)] cursor-pointer whitespace-nowrap"
              >
                Simpan
              </button>
              <button
                type="button"
                onClick={() => setIsEditingNote(false)}
                className="px-2 py-1 text-xs text-[var(--muted-text)] hover:text-[var(--ink)] cursor-pointer"
              >
                Batal
              </button>
            </div>
          ) : (
            <div className="mt-1.5 flex items-center justify-between gap-2">
              {variation.noteOrLink ? (
                <button
                  type="button"
                  onClick={() => {
                    if (!disabled) {
                      setNoteInput(variation.noteOrLink ?? '');
                      setIsEditingNote(true);
                    }
                  }}
                  className="text-left text-xs text-[var(--muted-text)] hover:text-[var(--ink)] line-clamp-1 flex items-center gap-1 cursor-pointer"
                >
                  <Link2 className="w-3 h-3 shrink-0 opacity-75" />
                  <span className="truncate">{variation.noteOrLink}</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setNoteInput('');
                    setIsEditingNote(true);
                  }}
                  className="text-[11px] text-[var(--muted-text)] hover:text-[var(--ink)] underline decoration-dotted underline-offset-2 cursor-pointer"
                >
                  + Catatan slot
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
