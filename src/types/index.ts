import { z } from 'zod';
import { NamingPrefixMode } from '../lib/googleDrive';

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export type TaskStatus =
  | 'Available'
  | 'Skipped'
  | 'In Progress'
  | 'Submitted'
  | 'In QA'
  | 'Revision'
  | 'Reviewed';

export type RevisionCauseTag =
  | 'Prompt Adherence'
  | 'Composition'
  | 'Line Weight'
  | 'Color Harmony'
  | 'Anatomy / Perspective'
  | 'Edge Artifacts'
  | 'Layer Hierarchy';

export const REVISION_CAUSE_TAGS: RevisionCauseTag[] = [
  'Prompt Adherence',
  'Composition',
  'Line Weight',
  'Color Harmony',
  'Anatomy / Perspective',
  'Edge Artifacts',
  'Layer Hierarchy',
];

export interface VariationItem {
  slotNumber: number; // 1..10
  filled: boolean;
  label: string;
  imageUrl?: string;
  imageName?: string;
  noteOrLink?: string;
  textContent?: string; // For Slot 10 (.txt file content)
  updatedAt?: string;
  // Google Drive integration fields
  driveFileId?: string;
  driveFileName?: string;
  driveWebViewLink?: string;
  driveSyncedAt?: string;
}

export interface HistoryEvent {
  id: string;
  timestamp: string;
  action: string;
  details?: string;
  fromStatus?: TaskStatus;
  toStatus?: TaskStatus;
  score?: number;
  actor: 'Illustrator' | 'LLM Evaluator' | 'Human Reviewer';
}

export interface RevisionRecord {
  id: string;
  revisionNumber: number;
  timestamp: string;
  llmScore: number;
  humanScore: number;
  feedback: string;
  tags: RevisionCauseTag[];
}

export interface Task {
  id: string;
  code: string; // Custom Task Number / Platform ID or auto KR-1001
  title: string;
  batchName: string;
  difficulty: Difficulty;
  status: TaskStatus;
  claimedAt?: string; // ISO string
  submittedAt?: string;
  reviewedAt?: string;
  deadline?: string; // ISO string
  timeSpentMinutes: number;
  notes: string;
  externalLink?: string; // External Labeling Platform Task / Prompt URL
  variations: VariationItem[];
  qaLLM: number | null; // 1.0 to 5.0
  qaHuman: number | null; // 1.0 to 5.0
  revisionCount: number;
  latestFeedback?: string;
  revisionTags: RevisionCauseTag[];
  revisionHistory: RevisionRecord[];
  history: HistoryEvent[];
  driveSubfolderId?: string;
  driveSubfolderName?: string;
  driveSubfolderLink?: string;
  // Paid & Client Revision Loop fields
  isPaid?: boolean;
  paidAt?: string;
  clientRevision?: boolean;
}

export interface WorksheetCell {
  taskId: string;
  date: string; // YYYY-MM-DD
  minutes: number;
}

export interface DailyWorksheetNote {
  date: string; // YYYY-MM-DD
  note: string;
}

export interface AppSettings {
  illustratorName: string;
  passThreshold: number; // default 4.0
  rates: {
    Easy: number; // default $2
    Medium: number; // default $3
    Hard: number; // default $4
  };
  weeklyHourTarget: number; // default 32
  variationCount: number; // default 10
  theme: 'light' | 'dark';
  gdriveFolderId: string;
  gdriveFolderUrl: string;
  gdrivePrefixMode: NamingPrefixMode;
  autoUploadToGDrive: boolean;
}

export interface ToastNotification {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  undoAction?: () => void;
}

// Zod validation schemas
export const taskCreateSchema = z.object({
  customCode: z
    .string()
    .trim()
    .max(50, 'Nomor task maksimal 50 karakter')
    .optional(),
  title: z
    .string()
    .trim()
    .min(2, 'Judul / nama task minimal 2 karakter')
    .max(120, 'Judul task maksimal 120 karakter'),
  batchName: z
    .string()
    .trim()
    .min(2, 'Nama batch wajib diisi')
    .max(60, 'Nama batch maksimal 60 karakter'),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']),
  status: z.enum(['Available', 'In Progress']),
  deadline: z.string().optional(),
  externalLink: z.string().trim().max(400).optional(),
  notes: z.string().max(1000).optional(),
});

export type TaskCreateFormValues = z.infer<typeof taskCreateSchema>;

export const qaScoreValueSchema = z
  .number({ message: 'Score must be a valid number between 1.0 and 5.0' })
  .min(1.0, 'Minimum QA score is 1.0')
  .max(5.0, 'Maximum QA score is 5.0')
  .refine(
    (val) => Math.round(val * 10) === val * 10,
    'Score must have at most one decimal place (e.g., 4.2)'
  );

export const settingsFormSchema = z.object({
  illustratorName: z.string().trim().min(1, 'Name is required').max(60),
  passThreshold: z.number().min(1.0).max(5.0),
  rateEasy: z.number().min(0).max(5000),
  rateMedium: z.number().min(0).max(5000),
  rateHard: z.number().min(0).max(5000),
  weeklyHourTarget: z.number().min(1).max(120),
  variationCount: z.number().int().min(1).max(16),
  theme: z.enum(['light', 'dark']),
  gdriveFolderUrl: z.string().trim().min(5, 'Google Drive Folder URL or ID is required'),
  gdrivePrefixMode: z.enum(['title_only', 'id_title', 'id_only']),
  autoUploadToGDrive: z.boolean(),
});

export type SettingsFormValues = z.infer<typeof settingsFormSchema>;
