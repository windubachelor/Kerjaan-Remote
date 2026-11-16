import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive',
];

export const DEFAULT_GDRIVE_FOLDER_ID = '1M8T97bFGhhluvTnKGOQabhle4UJ4OWip';
export const DEFAULT_GDRIVE_FOLDER_URL =
  'https://drive.google.com/drive/folders/1M8T97bFGhhluvTnKGOQabhle4UJ4OWip?usp=sharing';

/**
 * The 10 official variation suffixes, labels, and strict file formats:
 * 01: _rough (.png)
 * 02: _rough_object_swap (.png)
 * 03: _detailed_background (.png)
 * 04: _detailed_expression_1 (.png)
 * 05: _detailed_expression_2 (.png)
 * 06: _master (.psd)
 * 07: _detailed_object_swap (.png)
 * 08: _detailed (.png)
 * 09: _original (.png — Gambar Asli Task)
 * 10: _notes (.txt — File .txt Task disimpan ke Google Drive)
 */
export const VARIATION_GDRIVE_SPECS = [
  {
    slotNumber: 1,
    suffix: 'rough',
    label: 'Rough',
    requiredExt: 'png',
    accept: 'image/png,.png,image/*',
  },
  {
    slotNumber: 2,
    suffix: 'rough_object_swap',
    label: 'Rough Object Swap',
    requiredExt: 'png',
    accept: 'image/png,.png,image/*',
  },
  {
    slotNumber: 3,
    suffix: 'detailed_background',
    label: 'Detailed Background',
    requiredExt: 'png',
    accept: 'image/png,.png,image/*',
  },
  {
    slotNumber: 4,
    suffix: 'detailed_expression_1',
    label: 'Detailed Expression 1',
    requiredExt: 'png',
    accept: 'image/png,.png,image/*',
  },
  {
    slotNumber: 5,
    suffix: 'detailed_expression_2',
    label: 'Detailed Expression 2',
    requiredExt: 'png',
    accept: 'image/png,.png,image/*',
  },
  {
    slotNumber: 6,
    suffix: 'master',
    label: 'Master (PSD)',
    requiredExt: 'psd',
    accept: '.psd,image/vnd.adobe.photoshop,application/octet-stream',
  },
  {
    slotNumber: 7,
    suffix: 'detailed_object_swap',
    label: 'Detailed Object Swap',
    requiredExt: 'png',
    accept: 'image/png,.png,image/*',
  },
  {
    slotNumber: 8,
    suffix: 'detailed',
    label: 'Detailed',
    requiredExt: 'png',
    accept: 'image/png,.png,image/*',
  },
  {
    slotNumber: 9,
    suffix: 'original',
    label: 'Gambar Asli Task',
    requiredExt: 'png',
    accept: 'image/png,.png,image/*',
  },
  {
    slotNumber: 10,
    suffix: 'notes',
    label: 'File Catatan / Prompt (.txt)',
    requiredExt: 'txt',
    accept: '.txt,text/plain',
  },
] as const;

export type NamingPrefixMode = 'title_only' | 'id_title' | 'id_only';

export function formatSlotNum(slotNumber: number): string {
  return String(slotNumber).padStart(2, '0');
}

// In-memory cache of raw File objects (for .psd Master files, .txt files, and high-res .png files)
const slotRawFileCache = new Map<string, File>();

export function setSlotRawFile(taskId: string, slotNumber: number, file: File) {
  slotRawFileCache.set(`${taskId}_${slotNumber}`, file);
}

export function getSlotRawFile(taskId: string, slotNumber: number): File | undefined {
  return slotRawFileCache.get(`${taskId}_${slotNumber}`);
}

export function clearSlotRawFile(taskId: string, slotNumber: number) {
  slotRawFileCache.delete(`${taskId}_${slotNumber}`);
}

export function sanitizeFileSegment(input: string): string {
  return input
    .trim()
    .replace(/[—–/\\:*?"<>|]+/g, ' ')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

export function getVariationSpec(slotNumber: number) {
  return (
    VARIATION_GDRIVE_SPECS.find((s) => s.slotNumber === slotNumber) ||
    VARIATION_GDRIVE_SPECS[0]
  );
}

export function getVariationSuffix(slotNumber: number): string {
  const spec = VARIATION_GDRIVE_SPECS.find((s) => s.slotNumber === slotNumber);
  return spec ? spec.suffix : `variation_${slotNumber}`;
}

export function getVariationLabel(slotNumber: number): string {
  const spec = VARIATION_GDRIVE_SPECS.find((s) => s.slotNumber === slotNumber);
  return spec ? spec.label : `Variation #${slotNumber}`;
}

export function getVariationRequiredExt(slotNumber: number): 'png' | 'psd' | 'txt' {
  const spec = VARIATION_GDRIVE_SPECS.find((s) => s.slotNumber === slotNumber);
  return spec ? spec.requiredExt : 'png';
}

/**
 * Generates the standardized task subfolder name inside the parent Google Drive folder:
 * Format: {batchName}_{difficulty}_{taskCode}
 */
export function buildTaskSubfolderName(params: {
  batchName: string;
  difficulty: string;
  taskCode: string;
}): string {
  const cleanBatch = sanitizeFileSegment(params.batchName) || 'Batch';
  const cleanDiff = sanitizeFileSegment(params.difficulty) || 'Medium';
  const cleanCode = sanitizeFileSegment(params.taskCode) || 'TASK';
  return `${cleanBatch}_${cleanDiff}_${cleanCode}`;
}

/**
 * Generates the exact standardized Google Drive filename for any slot (1..10)
 * using the single unified format: Title Only + status suffix + strict extension:
 * 01: <Title>_rough.png
 * 02: <Title>_rough_object_swap.png
 * 03: <Title>_detailed_background.png
 * 04: <Title>_detailed_expression_1.png
 * 05: <Title>_detailed_expression_2.png
 * 06: <Title>_master.psd
 * 07: <Title>_detailed_object_swap.png
 * 08: <Title>_detailed.png
 * 09: <Title>_original.png
 * 10: <Title>_notes.txt
 */
export function buildVariationDriveFileName(params: {
  taskCode?: string;
  taskTitle: string;
  slotNumber: number;
  prefixMode?: NamingPrefixMode;
  extension?: string;
}): string {
  const { taskTitle, slotNumber } = params;
  const cleanTitle = sanitizeFileSegment(taskTitle) || 'Illustration';
  const suffix = getVariationSuffix(slotNumber);
  const strictExt = getVariationRequiredExt(slotNumber);

  return `${cleanTitle}_${suffix}.${strictExt}`;
}

/**
 * Generates a crisp SVG badge preview for Slot 06 (.psd Master file)
 */
export function generatePsdBadgeDataUrl(fileName: string, fileSizeBytes?: number): string {
  const sizeLabel = fileSizeBytes
    ? `${(fileSizeBytes / (1024 * 1024)).toFixed(2)} MB`
    : 'Adobe Photoshop Document';
  const safeName = fileName.replace(/[<>&"']/g, '').slice(0, 32);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200" fill="none">
    <rect width="320" height="200" fill="#181F2C"/>
    <rect x="12" y="12" width="296" height="176" rx="10" stroke="#31A8FF" stroke-opacity="0.45" stroke-width="2"/>
    <rect x="116" y="36" width="88" height="64" rx="10" fill="#001E36" stroke="#31A8FF" stroke-width="2.5"/>
    <text x="160" y="78" text-anchor="middle" fill="#31A8FF" font-family="sans-serif" font-size="28" font-weight="800">Ps</text>
    <text x="160" y="128" text-anchor="middle" fill="#F5F7FA" font-family="monospace" font-size="12" font-weight="700">${safeName}</text>
    <text x="160" y="150" text-anchor="middle" fill="#7AA7C7" font-family="sans-serif" font-size="11" font-weight="600">.PSD MASTER LAYER FILE · ${sizeLabel}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Generates a crisp SVG badge preview for Slot 10 (.txt Notes/Prompt file)
 */
export function generateTxtBadgeDataUrl(fileName: string, textSnippet?: string): string {
  const safeName = fileName.replace(/[<>&"']/g, '').slice(0, 32);
  const cleanSnippet = (textSnippet || 'Plain Text Document (.txt)')
    .replace(/[<>&"'\r\n]+/g, ' ')
    .trim()
    .slice(0, 42);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200" fill="none">
    <rect width="320" height="200" fill="#1F2421"/>
    <rect x="12" y="12" width="296" height="176" rx="10" stroke="#8BB898" stroke-opacity="0.45" stroke-width="2"/>
    <rect x="112" y="32" width="96" height="62" rx="10" fill="#122117" stroke="#8BB898" stroke-width="2.2"/>
    <text x="160" y="72" text-anchor="middle" fill="#8BB898" font-family="monospace" font-size="23" font-weight="800">.TXT</text>
    <text x="160" y="124" text-anchor="middle" fill="#F5F7FA" font-family="monospace" font-size="12" font-weight="700">${safeName}</text>
    <text x="160" y="148" text-anchor="middle" fill="#A8CBB1" font-family="monospace" font-size="10.5" font-weight="500">${cleanSnippet || 'Task Text File'}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Initialize Firebase App, Auth & Firestore
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection to Firestore on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));

let isSigningIn = false;
// Cache the OAuth access token strictly in memory (never in localStorage/sessionStorage)
let cachedAccessToken: string | null = null;

type AuthListener = (state: { user: User | null; hasToken: boolean }) => void;
const listeners = new Set<AuthListener>();

function notifyListeners() {
  const currentUser = auth.currentUser;
  const hasToken = Boolean(cachedAccessToken);
  listeners.forEach((fn) => fn({ user: currentUser, hasToken }));
}

export const subscribeGoogleAuth = (listener: AuthListener) => {
  listeners.add(listener);
  listener({ user: auth.currentUser, hasToken: Boolean(cachedAccessToken) });
  return () => {
    listeners.delete(listener);
  };
};

// Keep listeners updated whenever Firebase Auth user state changes
onAuthStateChanged(auth, (user) => {
  if (!user) {
    cachedAccessToken = null;
  }
  notifyListeners();
});

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
    notifyListeners();
  });
};

export const googleSignIn = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    provider.setCustomParameters({ prompt: 'consent' });
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to obtain Google Drive access token from sign-in.');
    }
    cachedAccessToken = credential.accessToken;
    notifyListeners();
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error('Google Sign-In error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const getCurrentGoogleUser = (): User | null => {
  return auth.currentUser;
};

export const logoutGoogle = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  notifyListeners();
};

export function extractDriveFolderId(folderUrlOrId: string): string {
  const trimmed = folderUrlOrId.trim();
  if (!trimmed) return DEFAULT_GDRIVE_FOLDER_ID;
  const match = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) return match[1];
  return trimmed.split('?')[0];
}

/**
 * Compresses raster data URLs into lightweight preview thumbnails (< 18KB)
 * so storing 10 variation previews inside a single Task document in Firestore
 * always stays well under the 1MB Firestore document limit.
 */
export async function compressImageDataUrlForFirestore(
  dataUrl: string,
  maxDimension = 260
): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) {
    return '';
  }
  if (dataUrl.startsWith('data:image/svg') || dataUrl.length <= 22000) {
    return dataUrl;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(
          1,
          maxDimension / Math.max(img.width || 1, img.height || 1)
        );
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl.slice(0, 22000));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/webp', 0.72);
        resolve(compressed);
      } catch {
        resolve('');
      }
    };
    img.onerror = () => resolve('');
    img.src = dataUrl;
  });
}

/**
 * Converts a data URL into a Blob.
 */
export async function dataUrlToBlobWithExt(dataUrl: string): Promise<{
  blob: Blob;
  mimeType: string;
  extension: string;
}> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const mimeType = blob.type || 'image/png';
  let extension = 'png';
  if (mimeType.includes('photoshop') || mimeType.includes('psd')) extension = 'psd';
  else if (mimeType.includes('text/plain')) extension = 'txt';
  else if (mimeType.includes('svg')) extension = 'svg';
  else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) extension = 'jpg';
  else if (mimeType.includes('webp')) extension = 'webp';
  else if (mimeType.includes('gif')) extension = 'gif';
  return { blob, mimeType, extension };
}

export interface DriveSubfolderResult {
  folderId: string;
  folderName: string;
  webViewLink: string;
}

/**
 * Finds or creates a dedicated task subfolder inside the parent Google Drive folder:
 * Format: {batchName}_{difficulty}_{taskCode}
 */
export async function ensureTaskSubfolderInGoogleDrive(params: {
  parentFolderUrlOrId?: string;
  batchName: string;
  difficulty: string;
  taskCode: string;
  existingSubfolderId?: string;
}): Promise<DriveSubfolderResult> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('AUTH_REQUIRED');
  }

  const parentFolderId = extractDriveFolderId(
    params.parentFolderUrlOrId || DEFAULT_GDRIVE_FOLDER_ID
  );
  const folderName = buildTaskSubfolderName({
    batchName: params.batchName,
    difficulty: params.difficulty,
    taskCode: params.taskCode,
  });

  if (params.existingSubfolderId) {
    try {
      const checkRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${params.existingSubfolderId}?supportsAllDrives=true&fields=id,name,webViewLink,trashed`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (checkRes.ok) {
        const existingData = await checkRes.json();
        if (!existingData.trashed) {
          if (existingData.name !== folderName) {
            await fetch(
              `https://www.googleapis.com/drive/v3/files/${params.existingSubfolderId}?supportsAllDrives=true`,
              {
                method: 'PATCH',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name: folderName }),
              }
            ).catch(() => {});
          }
          return {
            folderId: existingData.id,
            folderName,
            webViewLink:
              existingData.webViewLink ||
              `https://drive.google.com/drive/folders/${existingData.id}`,
          };
        }
      }
    } catch {
      // Fall through to search/create
    }
  }

  const escapedName = folderName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const q = `mimeType = 'application/vnd.google-apps.folder' and name = '${escapedName}' and '${parentFolderId}' in parents and trashed = false`;
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    q
  )}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,webViewLink)&pageSize=1`;

  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (searchRes.status === 401) {
    cachedAccessToken = null;
    notifyListeners();
    throw new Error('AUTH_REQUIRED');
  }

  if (searchRes.ok) {
    const searchData = await searchRes.json();
    const match = searchData.files?.[0];
    if (match?.id) {
      return {
        folderId: match.id,
        folderName: match.name || folderName,
        webViewLink:
          match.webViewLink || `https://drive.google.com/drive/folders/${match.id}`,
      };
    }
  }

  const createRes = await fetch(
    'https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId],
        description: `Kerjaan-Remote Task Folder · ${params.batchName} · ${params.difficulty} · ${params.taskCode}`,
      }),
    }
  );

  if (createRes.status === 401) {
    cachedAccessToken = null;
    notifyListeners();
    throw new Error('AUTH_REQUIRED');
  }

  if (!createRes.ok) {
    const errBody = await createRes.json().catch(() => ({}));
    throw new Error(
      errBody?.error?.message ||
        `Gagal membuat subfolder "${folderName}" di Google Drive (HTTP ${createRes.status})`
    );
  }

  const created = await createRes.json();
  return {
    folderId: created.id,
    folderName: created.name || folderName,
    webViewLink:
      created.webViewLink || `https://drive.google.com/drive/folders/${created.id}`,
  };
}

export interface DriveUploadResult {
  fileId: string;
  name: string;
  webViewLink: string;
}

/**
 * Uploads or updates a variation file (.png, .psd, or .txt) directly into the target Google Drive folder.
 */
export async function uploadVariationToGoogleDrive(params: {
  dataUrl?: string;
  rawFile?: File;
  textContent?: string;
  fileName: string;
  folderId?: string;
  existingFileId?: string;
  description?: string;
}): Promise<DriveUploadResult> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('AUTH_REQUIRED');
  }

  const targetFolderId = extractDriveFolderId(
    params.folderId || DEFAULT_GDRIVE_FOLDER_ID
  );

  let blob: Blob;
  let mimeType: string;
  const lowerName = params.fileName.toLowerCase();

  if (lowerName.endsWith('.txt')) {
    mimeType = 'text/plain;charset=utf-8';
    if (params.rawFile) {
      blob = params.rawFile;
    } else if (typeof params.textContent === 'string') {
      blob = new Blob([params.textContent], { type: 'text/plain;charset=utf-8' });
    } else {
      blob = new Blob([params.description || 'Task Notes'], {
        type: 'text/plain;charset=utf-8',
      });
    }
  } else if (params.rawFile) {
    blob = params.rawFile;
    if (lowerName.endsWith('.psd')) {
      mimeType = 'image/vnd.adobe.photoshop';
    } else {
      mimeType = params.rawFile.type || 'image/png';
    }
  } else if (params.dataUrl) {
    const parsed = await dataUrlToBlobWithExt(params.dataUrl);
    blob = parsed.blob;
    mimeType = lowerName.endsWith('.psd')
      ? 'image/vnd.adobe.photoshop'
      : parsed.mimeType;
  } else {
    throw new Error('Tidak ada file untuk di-upload.');
  }

  const metadata: Record<string, unknown> = {
    name: params.fileName,
    mimeType,
    description: params.description || 'Uploaded via Kerjaan-Remote',
  };

  if (!params.existingFileId && targetFolderId) {
    metadata.parents = [targetFolderId];
  }

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append('file', blob, params.fileName);

  const url = params.existingFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${params.existingFileId}?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink`;

  const method = params.existingFileId ? 'PATCH' : 'POST';

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  if (res.status === 401 || res.status === 403) {
    if (res.status === 401) {
      cachedAccessToken = null;
      notifyListeners();
      throw new Error('AUTH_REQUIRED');
    }
    const errBody = await res.json().catch(() => ({}));
    throw new Error(
      errBody?.error?.message ||
        'Izin Google Drive ditolak. Pastikan akun Google Anda memiliki akses Edit ke folder tujuan.'
    );
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(
      errBody?.error?.message || `Google Drive upload gagal (HTTP ${res.status})`
    );
  }

  const data = await res.json();
  return {
    fileId: data.id,
    name: data.name || params.fileName,
    webViewLink:
      data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`,
  };
}

/**
 * Deletes a file from Google Drive (must only be called after explicit user confirmation dialog).
 */
export async function deleteFileFromGoogleDrive(fileId: string): Promise<void> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('AUTH_REQUIRED');
  }

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (res.status === 401) {
    cachedAccessToken = null;
    notifyListeners();
    throw new Error('AUTH_REQUIRED');
  }

  if (!res.ok && res.status !== 404) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(
      errBody?.error?.message || `Gagal menghapus file dari Google Drive (${res.status})`
    );
  }
}
