import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BadgeCheck,
  BarChart3,
  FolderKanban,
  FolderUp,
  LayoutDashboard,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  Table2,
  X,
} from 'lucide-react';
import { useTaskStore } from '../../store/useTaskStore';
import { StatusBadge } from './StatusBadge';
import { DEFAULT_GDRIVE_FOLDER_URL } from '../../lib/googleDrive';

export const CommandPalette: React.FC = () => {
  const navigate = useNavigate();
  const isOpen = useTaskStore((s) => s.isCommandPaletteOpen);
  const setOpen = useTaskStore((s) => s.setCommandPaletteOpen);
  const tasks = useTaskStore((s) => s.tasks);
  const selectTask = useTaskStore((s) => s.selectTask);
  const setAddModalOpen = useTaskStore((s) => s.setAddModalOpen);
  const settings = useTaskStore((s) => s.settings);
  const updateSettings = useTaskStore((s) => s.updateSettings);

  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!isOpen);
      } else if (e.key === 'Escape' && isOpen) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, setOpen]);

  useEffect(() => {
    if (isOpen) setQuery('');
  }, [isOpen]);

  const matchingTasks = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tasks.slice(0, 6);
    return tasks
      .filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.code.toLowerCase().includes(q) ||
          t.batchName.toLowerCase().includes(q) ||
          t.status.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [query, tasks]);

  if (!isOpen) return null;

  const runAndClose = (fn: () => void) => {
    fn();
    setOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/40"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl bg-[var(--surface)] border border-[var(--border)] rounded-[12px] overflow-hidden shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
          <Search className="w-4 h-4 text-[var(--muted-text)] shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari kode task (KR-1020), batch, atau perintah Kerjaan-Remote..."
            className="flex-1 bg-transparent text-sm text-[var(--ink)] placeholder:text-[var(--muted-text)] focus:outline-none"
            autoFocus
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="p-1 text-[var(--muted-text)] hover:text-[var(--ink)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[420px] overflow-y-auto p-2 space-y-4">
          <div>
            <p className="px-2.5 py-1 text-[11px] font-semibold text-[var(--muted-text)]">
              Quick Actions & Navigation
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mt-1">
              <button
                type="button"
                onClick={() => runAndClose(() => setAddModalOpen(true))}
                className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-[8px] text-[var(--ink)] hover:bg-[var(--surface-muted)] transition-colors text-left cursor-pointer"
              >
                <Plus className="w-4 h-4 text-[var(--muted-text)]" />
                <span>Add New Evaluation Task (10 Slot)</span>
              </button>
              <a
                href={settings.gdriveFolderUrl || DEFAULT_GDRIVE_FOLDER_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-[8px] text-[var(--ink)] hover:bg-[var(--surface-muted)] transition-colors text-left cursor-pointer"
              >
                <FolderUp className="w-4 h-4 text-[var(--muted-text)]" />
                <span>Buka Folder Google Drive</span>
              </a>
              <button
                type="button"
                onClick={() =>
                  runAndClose(() =>
                    updateSettings({
                      theme: settings.theme === 'light' ? 'dark' : 'light',
                    })
                  )
                }
                className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-[8px] text-[var(--ink)] hover:bg-[var(--surface-muted)] transition-colors text-left cursor-pointer"
              >
                {settings.theme === 'light' ? (
                  <Moon className="w-4 h-4 text-[var(--muted-text)]" />
                ) : (
                  <Sun className="w-4 h-4 text-[var(--muted-text)]" />
                )}
                <span>
                  Switch to {settings.theme === 'light' ? 'Dark' : 'Light'} Mode
                </span>
              </button>
              <button
                type="button"
                onClick={() => runAndClose(() => navigate('/'))}
                className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-[8px] text-[var(--ink)] hover:bg-[var(--surface-muted)] transition-colors text-left cursor-pointer"
              >
                <LayoutDashboard className="w-4 h-4 text-[var(--muted-text)]" />
                <span>Go to Dashboard</span>
              </button>
              <button
                type="button"
                onClick={() => runAndClose(() => navigate('/tasks'))}
                className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-[8px] text-[var(--ink)] hover:bg-[var(--surface-muted)] transition-colors text-left cursor-pointer"
              >
                <FolderKanban className="w-4 h-4 text-[var(--muted-text)]" />
                <span>Go to Tasks Board</span>
              </button>
              <button
                type="button"
                onClick={() => runAndClose(() => navigate('/paid'))}
                className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-[8px] text-[var(--ink)] hover:bg-[var(--surface-muted)] transition-colors text-left cursor-pointer"
              >
                <BadgeCheck className="w-4 h-4 text-[var(--sage-ink)]" />
                <span>Go to Paid Tasks (Sudah Dibayar)</span>
              </button>
              <button
                type="button"
                onClick={() => runAndClose(() => navigate('/worksheet'))}
                className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-[8px] text-[var(--ink)] hover:bg-[var(--surface-muted)] transition-colors text-left cursor-pointer"
              >
                <Table2 className="w-4 h-4 text-[var(--muted-text)]" />
                <span>Go to Weekly Worksheet (Excel)</span>
              </button>
              <button
                type="button"
                onClick={() => runAndClose(() => navigate('/reports'))}
                className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-[8px] text-[var(--ink)] hover:bg-[var(--surface-muted)] transition-colors text-left cursor-pointer"
              >
                <BarChart3 className="w-4 h-4 text-[var(--muted-text)]" />
                <span>Go to Reports & QA (LaTeX PDF)</span>
              </button>
              <button
                type="button"
                onClick={() => runAndClose(() => navigate('/settings'))}
                className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-[8px] text-[var(--ink)] hover:bg-[var(--surface-muted)] transition-colors text-left cursor-pointer"
              >
                <Settings className="w-4 h-4 text-[var(--muted-text)]" />
                <span>Go to Workspace Settings</span>
              </button>
            </div>
          </div>

          <div>
            <p className="px-2.5 py-1 text-[11px] font-semibold text-[var(--muted-text)]">
              Evaluation Tasks ({matchingTasks.length})
            </p>
            {matchingTasks.length === 0 ? (
              <p className="px-3 py-4 text-xs text-[var(--muted-text)]">
                No tasks matching "{query}".
              </p>
            ) : (
              <div className="space-y-1 mt-1">
                {matchingTasks.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => runAndClose(() => selectTask(t.id))}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-[8px] hover:bg-[var(--surface-muted)] transition-colors text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono-num text-xs font-bold text-[var(--muted-text)] shrink-0">
                        {t.code}
                      </span>
                      <span className="text-xs font-semibold text-[var(--ink)] truncate">
                        {t.title}
                      </span>
                    </div>
                    <StatusBadge
                      status={t.status}
                      revisionCount={t.revisionCount}
                      isPaid={t.isPaid}
                      clientRevision={t.clientRevision}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
