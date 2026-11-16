import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from 'firebase/auth';
import {
  CheckCircle2,
  CloudUpload,
  ExternalLink,
  FolderUp,
  LogOut,
  UserCheck,
} from 'lucide-react';
import {
  DEFAULT_GDRIVE_FOLDER_URL,
  googleSignIn,
  initAuth,
  logoutGoogle,
  subscribeGoogleAuth,
} from '../../lib/googleDrive';
import { useTaskStore } from '../../store/useTaskStore';
import { cn } from '../../lib/utils';

interface GoogleDriveConnectButtonProps {
  compact?: boolean;
  showFolderLink?: boolean;
  className?: string;
}

export const GoogleDriveConnectButton: React.FC<GoogleDriveConnectButtonProps> = ({
  compact = false,
  showFolderLink = true,
  className,
}) => {
  const navigate = useNavigate();
  const addToast = useTaskStore((s) => s.addToast);
  const settings = useTaskStore((s) => s.settings);

  const [user, setUser] = useState<User | null>(null);
  const [hasToken, setHasToken] = useState<boolean>(false);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  useEffect(() => {
    const unsubInit = initAuth(
      (u) => {
        setUser(u);
        setHasToken(true);
      },
      () => {
        setHasToken(false);
      }
    );
    const unsubStore = subscribeGoogleAuth(({ user: u, hasToken: t }) => {
      setUser(u);
      setHasToken(t);
    });
    return () => {
      unsubInit();
      unsubStore();
    };
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setHasToken(true);
        addToast({
          title: 'Akun Google Terhubung (Firebase & GDrive)',
          description: `Login sebagai ${res.user.email || res.user.displayName}. Semua data & upload GDrive aktif.`,
          variant: 'success',
        });
      }
    } catch (err: any) {
      addToast({
        title: 'Gagal Login Akun Google',
        description: err?.message || 'Tidak dapat menyelesaikan autentikasi Google.',
        variant: 'danger',
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logoutGoogle();
    setUser(null);
    setHasToken(false);
    addToast({
      title: 'Keluar dari Akun Google',
      variant: 'default',
    });
  };

  const folderUrl = settings.gdriveFolderUrl || DEFAULT_GDRIVE_FOLDER_URL;

  if (user) {
    return (
      <div className={cn('inline-flex items-center gap-1.5', className)}>
        <button
          type="button"
          onClick={() => navigate('/profile')}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] bg-[var(--sage)] text-[var(--sage-ink)] border border-[var(--sage-border)] text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer whitespace-nowrap"
          title="Buka Halaman Profil & Akun"
        >
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'User'}
              referrerPolicy="no-referrer"
              className="w-4 h-4 rounded-full object-cover shrink-0"
            />
          ) : (
            <UserCheck className="w-3.5 h-3.5 shrink-0" strokeWidth={2.5} />
          )}
          <span className="truncate max-w-[140px]">
            {user.displayName || user.email?.split('@')[0] || 'Akun Aktif'}
          </span>
          {hasToken && (
            <CheckCircle2 className="w-3 h-3 shrink-0 opacity-80" strokeWidth={2.5} />
          )}
        </button>

        {!hasToken && (
          <button
            type="button"
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[8px] bg-[var(--butter)] text-[var(--butter-ink)] border border-[var(--butter-border)] text-xs font-semibold hover:opacity-90 cursor-pointer whitespace-nowrap"
            title="Aktifkan izin upload Google Drive untuk sesi ini"
          >
            <CloudUpload className="w-3.5 h-3.5" strokeWidth={2.4} />
            <span>{isLoggingIn ? '...' : 'Aktifkan Upload'}</span>
          </button>
        )}

        {showFolderLink && (
          <a
            href={folderUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[8px] border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-muted)] text-xs font-semibold transition-colors whitespace-nowrap"
            title="Buka Folder Google Drive Utama"
          >
            <FolderUp className="w-3.5 h-3.5" strokeWidth={2.4} />
            <span className="hidden xl:inline">Folder GDrive</span>
            <ExternalLink className="w-3 h-3 opacity-75" strokeWidth={2.4} />
          </a>
        )}

        <button
          type="button"
          onClick={handleLogout}
          className="p-1.5 rounded-[8px] border border-[var(--border)] text-[var(--muted-text)] hover:text-[var(--rose-ink)] hover:bg-[var(--rose)]/40 transition-colors cursor-pointer"
          title="Logout Akun Google"
        >
          <LogOut className="w-3.5 h-3.5" strokeWidth={2.4} />
        </button>
      </div>
    );
  }

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <button
        type="button"
        onClick={handleLogin}
        disabled={isLoggingIn}
        className="gsi-material-button inline-flex items-center gap-2 px-3 py-1.5 rounded-[8px] border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-muted)] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 shadow-2xs"
      >
        <div className="gsi-material-button-state" />
        <div className="gsi-material-button-content-wrapper flex items-center gap-2">
          <div className="gsi-material-button-icon w-4 h-4 shrink-0">
            <svg
              version="1.1"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 48 48"
              style={{ display: 'block', width: '100%', height: '100%' }}
            >
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
              />
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
              />
              <path
                fill="#FBBC05"
                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
              />
              <path fill="none" d="M0 0h48v48H0z" />
            </svg>
          </div>
          <span className="gsi-material-button-contents">
            {isLoggingIn ? 'Menghubungkan...' : 'Login Google (Firebase & Drive)'}
          </span>
        </div>
      </button>
    </div>
  );
};
