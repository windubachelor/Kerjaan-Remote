import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  BadgeCheck,
  BarChart3,
  Briefcase,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Command,
  Database,
  FolderKanban,
  LayoutDashboard,
  Loader2,
  Menu,
  Moon,
  Plus,
  Settings,
  Square,
  Sun,
  Table2,
  UserCircle2,
  X,
} from 'lucide-react';
import { useTaskStore } from '../../store/useTaskStore';
import { cn } from '../../lib/utils';
import { GoogleDriveConnectButton } from '../ui/GoogleDriveConnectButton';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const tasks = useTaskStore((s) => s.tasks);
  const settings = useTaskStore((s) => s.settings);
  const firebaseSyncStatus = useTaskStore((s) => s.firebaseSyncStatus);
  const firebaseUserEmail = useTaskStore((s) => s.firebaseUserEmail);
  const updateSettings = useTaskStore((s) => s.updateSettings);
  const setAddModalOpen = useTaskStore((s) => s.setAddModalOpen);
  const setCommandPaletteOpen = useTaskStore((s) => s.setCommandPaletteOpen);
  const selectTask = useTaskStore((s) => s.selectTask);

  const activeTimerTaskId = useTaskStore((s) => s.activeTimerTaskId);
  const timerElapsedSeconds = useTaskStore((s) => s.timerElapsedSeconds);
  const tickTimer = useTaskStore((s) => s.tickTimer);
  const stopTimer = useTaskStore((s) => s.stopTimer);

  useEffect(() => {
    if (!activeTimerTaskId) return;
    const interval = setInterval(() => {
      tickTimer();
    }, 1000);
    return () => clearInterval(interval);
  }, [activeTimerTaskId, tickTimer]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const activeCount = tasks.filter(
    (t) => !t.isPaid && (t.status === 'In Progress' || t.status === 'Revision')
  ).length;
  const revisionCount = tasks.filter(
    (t) => !t.isPaid && t.status === 'Revision'
  ).length;
  const reviewedCount = tasks.filter((t) => t.status === 'Reviewed').length;
  const paidCount = tasks.filter((t) => Boolean(t.isPaid)).length;
  const activeTimerTask = tasks.find((t) => t.id === activeTimerTaskId);

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remSec = sec % 60;
    return `${String(mins).padStart(2, '0')}:${String(remSec).padStart(2, '0')}`;
  };

  const navItems = [
    {
      to: '/',
      label: 'Dashboard',
      shortLabel: 'Home',
      icon: LayoutDashboard,
    },
    {
      to: '/tasks',
      label: 'Tasks Board',
      shortLabel: 'Tasks',
      icon: FolderKanban,
      badge: activeCount > 0 ? activeCount : undefined,
      hasRevisionAlert: revisionCount > 0,
    },
    {
      to: '/worksheet',
      label: 'Worksheet',
      shortLabel: 'Sheet',
      icon: Table2,
    },
    {
      to: '/paid',
      label: 'Paid / Lunas',
      shortLabel: 'Paid',
      icon: BadgeCheck,
      badge: paidCount > 0 ? paidCount : undefined,
      isPaidBadge: true,
    },
    {
      to: '/reports',
      label: 'Reports & QA',
      shortLabel: 'Reports',
      icon: BarChart3,
    },
    {
      to: '/profile',
      label: 'Profil Akun',
      shortLabel: 'Profil',
      icon: UserCircle2,
    },
    {
      to: '/settings',
      label: 'Settings',
      shortLabel: 'Setting',
      icon: Settings,
    },
  ];

  const mobileBottomNavItems = navItems.slice(0, 5);

  const getPageBreadcrumb = () => {
    switch (location.pathname) {
      case '/':
        return 'Studio Overview';
      case '/tasks':
        return 'Tasks & 10-Varian GDrive';
      case '/worksheet':
        return 'Weekly Worksheet (Excel .xlsx)';
      case '/paid':
        return 'Paid Tasks Ledger (Sudah Dibayar)';
      case '/reports':
        return 'QA Analytics & LaTeX PDF';
      case '/profile':
        return 'Profil Akun (Firebase + GDrive)';
      case '/settings':
        return 'Studio, Firebase & GDrive Config';
      default:
        return 'Workspace';
    }
  };

  return (
    <div className="min-h-screen flex bg-[var(--background)] text-[var(--ink)] pb-16 md:pb-0">
      {/* Desktop Sidebar — sticky h-screen with cohesive, compact sections */}
      <aside
        className={cn(
          'hidden md:flex flex-col sticky top-0 h-screen overflow-y-auto border-r border-[var(--border)] bg-[var(--surface)] shrink-0 transition-[width] duration-200 ease-out select-none',
          sidebarCollapsed ? 'w-[72px]' : 'w-[260px]'
        )}
      >
        {/* 1. Brand Header */}
        <div
          className={cn(
            'h-14 px-3.5 flex items-center border-b border-[var(--border)] shrink-0',
            sidebarCollapsed ? 'justify-center' : 'justify-between'
          )}
        >
          <NavLink
            to="/"
            className="flex items-center gap-2.5 min-w-0 group"
            title="Kerjaan-Remote"
          >
            <motion.span
              whileHover={{ scale: 1.05, rotate: -2 }}
              whileTap={{ scale: 0.95 }}
              className="w-8 h-8 rounded-[8px] bg-[var(--ink)] text-[var(--background)] flex items-center justify-center shrink-0 shadow-2xs"
            >
              <Briefcase className="w-4 h-4" strokeWidth={2.5} />
            </motion.span>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <span className="font-display text-[15px] font-bold tracking-tight text-[var(--ink)] block truncate leading-tight">
                  Kerjaan-Remote
                </span>
                <span className="text-[10px] font-semibold text-[var(--muted-text)] uppercase tracking-wider block truncate">
                  Illustrator Ops · 10 Varian
                </span>
              </div>
            )}
          </NavLink>

          {!sidebarCollapsed && (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(true)}
              className="p-1.5 rounded-[8px] text-[var(--muted-text)] hover:text-[var(--ink)] hover:bg-[var(--surface-muted)] transition-colors cursor-pointer"
              title="Kecilkan sidebar"
            >
              <ChevronLeft className="w-4 h-4" strokeWidth={2.5} />
            </button>
          )}
        </div>

        {/* Collapse / Expand button when collapsed */}
        {sidebarCollapsed && (
          <div className="px-2.5 pt-2.5 flex justify-center">
            <button
              type="button"
              onClick={() => setSidebarCollapsed(false)}
              className="w-full py-1.5 rounded-[8px] border border-[var(--border)] bg-[var(--surface-muted)]/60 text-[var(--muted-text)] hover:text-[var(--ink)] hover:bg-[var(--surface-muted)] flex items-center justify-center transition-colors cursor-pointer"
              title="Perlebar sidebar"
            >
              <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
            </button>
          </div>
        )}

        {/* 2. Quick Action Button */}
        <div className="px-3 pt-3 pb-1 shrink-0">
          <motion.button
            type="button"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setAddModalOpen(true)}
            title="Tambah Task Baru"
            className={cn(
              'w-full flex items-center justify-center gap-2 rounded-[8px] bg-[var(--ink)] text-[var(--background)] font-semibold text-xs py-2 px-3 shadow-2xs hover:opacity-95 transition-all cursor-pointer',
              sidebarCollapsed && 'px-0'
            )}
          >
            <Plus className="w-4 h-4 shrink-0" strokeWidth={2.5} />
            {!sidebarCollapsed && <span>Tambah Task Baru</span>}
          </motion.button>
        </div>

        {/* 3. Primary Navigation */}
        <div className="px-3 py-2 shrink-0">
          {!sidebarCollapsed && (
            <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-text)]">
              Menu Navigasi
            </div>
          )}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      'relative flex items-center justify-between gap-2.5 px-3 py-2 rounded-[8px] text-[13px] font-medium transition-all duration-150 group',
                      sidebarCollapsed && 'justify-center px-0',
                      isActive
                        ? 'text-[var(--ink)] font-bold'
                        : 'text-[var(--muted-text)] hover:text-[var(--ink)] hover:bg-[var(--surface-muted)]/60'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.div
                          layoutId="sidebar-active-bg"
                          className="absolute inset-0 rounded-[8px] bg-[var(--surface-muted)] border border-[var(--border)]"
                          transition={{
                            type: 'spring',
                            stiffness: 380,
                            damping: 30,
                          }}
                        />
                      )}
                      <div className="relative z-10 flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={cn(
                            'w-4 h-4 shrink-0 transition-transform duration-150 group-hover:scale-110',
                            isActive
                              ? 'text-[var(--ink)]'
                              : 'text-[var(--muted-text)] group-hover:text-[var(--ink)]'
                          )}
                          strokeWidth={2.4}
                        />
                        {!sidebarCollapsed && (
                          <span className="truncate whitespace-nowrap">
                            {item.label}
                          </span>
                        )}
                      </div>
                      {!sidebarCollapsed && item.badge !== undefined && (
                        <span
                          className={cn(
                            'relative z-10 px-1.5 py-0.5 text-[11px] font-mono-num font-bold rounded-[6px] border tabular-nums',
                            item.hasRevisionAlert
                              ? 'bg-[var(--rose)] text-[var(--rose-ink)] border-[var(--rose-border)]'
                              : item.isPaidBadge
                              ? 'bg-[var(--sage)] text-[var(--sage-ink)] border-[var(--sage-border)]'
                              : 'bg-[var(--butter)] text-[var(--butter-ink)] border-[var(--butter-border)]'
                          )}
                        >
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* 4. Cohesive Studio & Profile Section directly below navigation */}
        <div className="px-3 pt-2 pb-4 space-y-2.5 shrink-0">
          <div className="border-t border-[var(--border)] pt-3" />

          {/* Active Live Timer Banner */}
          <AnimatePresence>
            {activeTimerTask && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="p-2.5 rounded-[10px] bg-[var(--butter)] text-[var(--butter-ink)] border border-[var(--butter-border)]"
              >
                <div className="flex items-center justify-between gap-1">
                  <button
                    type="button"
                    onClick={() => selectTask(activeTimerTask.id)}
                    className="text-xs font-mono-num font-bold hover:underline truncate text-left cursor-pointer"
                  >
                    {sidebarCollapsed
                      ? formatTimer(timerElapsedSeconds)
                      : `${activeTimerTask.code} · ${formatTimer(timerElapsedSeconds)}`}
                  </button>
                  <button
                    type="button"
                    onClick={stopTimer}
                    className="p-1 rounded-[6px] bg-[var(--surface)]/80 text-[var(--ink)] hover:bg-[var(--surface)] cursor-pointer shrink-0"
                    title="Stop & log timer"
                  >
                    <Square className="w-3 h-3" strokeWidth={2.5} />
                  </button>
                </div>
                {!sidebarCollapsed && (
                  <p className="text-[11px] opacity-85 truncate mt-0.5">
                    {activeTimerTask.title}
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Studio & Firebase Status Card */}
          {!sidebarCollapsed ? (
            <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface-muted)]/45 p-3 space-y-2.5">
              {/* Profile & Theme Switcher */}
              <div className="flex items-center justify-between gap-2">
                <NavLink
                  to="/profile"
                  className="flex items-center gap-2 min-w-0 hover:opacity-85 transition-opacity"
                >
                  <div className="w-7 h-7 rounded-full bg-[var(--ink)] text-[var(--background)] font-display text-xs font-bold flex items-center justify-center shrink-0">
                    {(settings.illustratorName || 'S').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[var(--ink)] truncate leading-tight">
                      {settings.illustratorName}
                    </p>
                    <p className="text-[10px] text-[var(--muted-text)] truncate">
                      Pass ≥ {settings.passThreshold.toFixed(1)} · 10 Varian
                    </p>
                  </div>
                </NavLink>

                <motion.button
                  type="button"
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() =>
                    updateSettings({
                      theme: settings.theme === 'light' ? 'dark' : 'light',
                    })
                  }
                  className="p-1.5 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-text)] hover:text-[var(--ink)] transition-colors cursor-pointer shrink-0"
                  title={`Ganti ke mode ${settings.theme === 'light' ? 'gelap' : 'terang'}`}
                >
                  {settings.theme === 'light' ? (
                    <Moon className="w-3.5 h-3.5" strokeWidth={2.4} />
                  ) : (
                    <Sun className="w-3.5 h-3.5" strokeWidth={2.4} />
                  )}
                </motion.button>
              </div>

              {/* Mini Task Counters */}
              <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-[var(--border)]/80 text-center">
                <div className="rounded-[6px] bg-[var(--surface)] px-1.5 py-1 border border-[var(--border)]/60">
                  <span className="block font-mono-num text-xs font-bold text-[var(-- butter-ink)]">
                    {activeCount}
                  </span>
                  <span className="block text-[9px] font-semibold text-[var(--muted-text)] uppercase">
                    Aktif
                  </span>
                </div>
                <div className="rounded-[6px] bg-[var(--surface)] px-1.5 py-1 border border-[var(--border)]/60">
                  <span className="block font-mono-num text-xs font-bold text-[var(--ink)]">
                    {reviewedCount}
                  </span>
                  <span className="block text-[9px] font-semibold text-[var(--muted-text)] uppercase">
                    Lulus
                  </span>
                </div>
                <div className="rounded-[6px] bg-[var(--surface)] px-1.5 py-1 border border-[var(--border)]/60">
                  <span className="block font-mono-num text-xs font-bold text-[var(--sage-ink)]">
                    {paidCount}
                  </span>
                  <span className="block text-[9px] font-semibold text-[var(--muted-text)] uppercase">
                    Paid
                  </span>
                </div>
              </div>

              {/* Firebase Cloud Persistence Status */}
              <div className="pt-1 border-t border-[var(--border)]/80 flex items-center justify-between gap-1.5 text-[11px]">
                <div className="flex items-center gap-1.5 min-w-0">
                  {firebaseSyncStatus === 'syncing' ? (
                    <Loader2 className="w-3.5 h-3.5 text-[var(--butter-ink)] animate-spin shrink-0" />
                  ) : firebaseSyncStatus === 'synced' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[var(--sage-ink)] shrink-0" />
                  ) : (
                    <Database className="w-3.5 h-3.5 text-[var(--muted-text)] shrink-0" />
                  )}
                  <span className="truncate font-semibold text-[var(--ink)]">
                    {firebaseSyncStatus === 'synced'
                      ? 'Firebase + GDrive Aktif'
                      : firebaseSyncStatus === 'syncing'
                      ? 'Menyimpan ke Cloud...'
                      : 'Cloud Siap (Login Google)'}
                  </span>
                </div>
              </div>
              {firebaseUserEmail && (
                <p className="text-[10px] text-[var(--muted-text)] truncate">
                  {firebaseUserEmail}
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <NavLink
                to="/profile"
                className="w-8 h-8 rounded-full bg-[var(--surface-muted)] border border-[var(--border)] flex items-center justify-center"
                title={
                  firebaseSyncStatus === 'synced'
                    ? `Firebase Cloud Aktif (${firebaseUserEmail || ''})`
                    : 'Profil Akun & Sinkronisasi Cloud'
                }
              >
                <Cloud
                  className={cn(
                    'w-4 h-4',
                    firebaseSyncStatus === 'synced'
                      ? 'text-[var(--sage-ink)]'
                      : 'text-[var(--muted-text)]'
                  )}
                  strokeWidth={2.4}
                />
              </NavLink>
              <button
                type="button"
                onClick={() =>
                  updateSettings({
                    theme: settings.theme === 'light' ? 'dark' : 'light',
                  })
                }
                className="p-2 rounded-[8px] border border-[var(--border)] text-[var(--muted-text)] hover:text-[var(--ink)] cursor-pointer"
                title="Toggle theme"
              >
                {settings.theme === 'light' ? (
                  <Moon className="w-3.5 h-3.5" strokeWidth={2.4} />
                ) : (
                  <Sun className="w-3.5 h-3.5" strokeWidth={2.4} />
                )}
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 md:hidden flex bg-black/40"
            onClick={() => setMobileMenuOpen(false)}
          >
            <motion.div
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ type: 'spring', stiffness: 360, damping: 32 }}
              className="w-72 bg-[var(--surface)] border-r border-[var(--border)] h-full flex flex-col p-4 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-4 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-[8px] bg-[var(--ink)] text-[var(--background)] flex items-center justify-center">
                    <Briefcase className="w-3.5 h-3.5" strokeWidth={2.5} />
                  </span>
                  <div>
                    <span className="font-display font-bold text-base block leading-tight">
                      Kerjaan-Remote
                    </span>
                    <span className="text-[10px] font-semibold text-[var(--muted-text)] uppercase">
                      10 Varian · Firebase + GDrive
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 text-[var(--muted-text)] hover:text-[var(--ink)]"
                >
                  <X className="w-4 h-4" strokeWidth={2.5} />
                </button>
              </div>

              <nav className="mt-4 space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/'}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center justify-between px-3 py-2.5 rounded-[8px] text-sm font-medium',
                          isActive
                            ? 'bg-[var(--surface-muted)] text-[var(--ink)] font-bold'
                            : 'text-[var(--muted-text)] hover:text-[var(--ink)]'
                        )
                      }
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4" strokeWidth={2.4} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge !== undefined && (
                        <span
                          className={cn(
                            'px-2 py-0.5 text-xs font-mono-num rounded-[6px]',
                            item.isPaidBadge
                              ? 'bg-[var(--sage)] text-[var(--sage-ink)]'
                              : 'bg-[var(--butter)] text-[var(--butter-ink)]'
                          )}
                        >
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </nav>

              <div className="mt-4 pt-4 border-t border-[var(--border)] space-y-3">
                <GoogleDriveConnectButton compact className="w-full justify-center" />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--ink)]">
                    {settings.illustratorName}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      updateSettings({
                        theme: settings.theme === 'light' ? 'dark' : 'light',
                      })
                    }
                    className="px-2.5 py-1 text-xs rounded-[8px] border border-[var(--border)]"
                  >
                    {settings.theme === 'light' ? 'Dark mode' : 'Light mode'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract */}
        <header className="h-14 px-3.5 sm:px-6 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-xs flex items-center justify-between gap-2 sm:gap-4 sticky top-0 z-30">
          {/* Zone 1: Mobile Menu Trigger + Breadcrumb */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-1.5 rounded-[8px] border border-[var(--border)] text-[var(--ink)] shrink-0"
              aria-label="Open menu"
            >
              <Menu className="w-4 h-4" strokeWidth={2.5} />
            </button>
            <div className="flex items-center gap-2 text-xs sm:text-[13px] whitespace-nowrap truncate">
              <span className="text-[var(--muted-text)] hidden sm:inline font-semibold">
                Kerjaan-Remote
              </span>
              <span className="text-[var(--muted-text)] hidden sm:inline">/</span>
              <span className="font-bold text-[var(--ink)] truncate">
                {getPageBreadcrumb()}
              </span>
            </div>
          </div>

          {/* Zone 2 & 3: Google Drive Connect + Command Palette + Primary Action */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div className="hidden lg:block">
              <GoogleDriveConnectButton compact />
            </div>

            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setCommandPaletteOpen(true)}
              className="flex items-center justify-between gap-2 sm:gap-4 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-[var(--muted-text)] hover:text-[var(--ink)] bg-[var(--surface-muted)] border border-[var(--border)] rounded-[8px] transition-colors cursor-pointer whitespace-nowrap"
            >
              <span className="flex items-center gap-1.5">
                <Command className="w-3.5 h-3.5" strokeWidth={2.4} />
                <span className="hidden sm:inline">Search...</span>
              </span>
              <kbd className="hidden xs:inline-block px-1.5 py-0.5 text-[10px] font-mono-num font-bold bg-[var(--surface)] border border-[var(--border)] rounded-[4px] text-[var(--ink)]">
                ⌘K
              </kbd>
            </motion.button>

            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold rounded-[8px] bg-[var(--ink)] text-[var(--background)] hover:opacity-90 transition-opacity cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
              <span className="hidden xs:inline">Add Task</span>
            </motion.button>
          </div>
        </header>

        {/* Page Viewport with smooth animated route transitions */}
        <main className="flex-1 px-3.5 sm:px-6 lg:px-8 py-5 sm:py-6 max-w-[1440px] w-full mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Responsive Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 h-15 bg-[var(--surface)]/95 backdrop-blur-md border-t border-[var(--border)] px-1.5 flex items-center justify-around">
        {mobileBottomNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'relative flex flex-col items-center justify-center gap-0.5 py-1.5 px-2.5 rounded-[8px] text-[10px] font-semibold transition-colors min-w-[58px]',
                  isActive
                    ? 'text-[var(--ink)] font-bold bg-[var(--surface-muted)]'
                    : 'text-[var(--muted-text)]'
                )
              }
            >
              <div className="relative">
                <Icon className="w-4 h-4" strokeWidth={2.4} />
                {item.badge !== undefined && (
                  <span
                    className={cn(
                      'absolute -top-1.5 -right-2.5 px-1 min-w-[15px] h-[15px] rounded-full text-[9px] font-mono-num font-bold flex items-center justify-center border',
                      item.isPaidBadge
                        ? 'bg-[var(--sage)] text-[var(--sage-ink)] border-[var(--sage-border)]'
                        : 'bg-[var(--butter)] text-[var(--butter-ink)] border-[var(--butter-border)]'
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="truncate">{item.shortLabel}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};
