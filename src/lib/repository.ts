import {
  AppSettings,
  DailyWorksheetNote,
  Task,
  WorksheetCell,
} from '../types';
import { createInitialSeedData, DEFAULT_SETTINGS } from './seedData';
import { normalizeTaskVariations } from './utils';

export interface LedgerSnapshot {
  version: number;
  tasks: Task[];
  worksheetCells: WorksheetCell[];
  dailyNotes: DailyWorksheetNote[];
  settings: AppSettings;
}

export interface ITaskLedgerRepository {
  loadSnapshot(): LedgerSnapshot;
  saveSnapshot(snapshot: LedgerSnapshot): void;
  resetToSeed(): LedgerSnapshot;
  exportJson(): string;
  importJson(rawJson: string): LedgerSnapshot;
}

const STORAGE_KEY = 'kerjaan_remote_v5_clean_snapshot';
const CURRENT_SCHEMA_VERSION = 5;

function normalizeLoadedSettings(rawSettings?: Partial<AppSettings>): AppSettings {
  const merged: AppSettings = {
    ...DEFAULT_SETTINGS,
    ...rawSettings,
    variationCount: 10,
    gdrivePrefixMode: 'title_only',
  };

  // Migrate legacy $55/$95/$150 default rates to the standard $2/$3/$4 rates
  if (
    !rawSettings?.rates ||
    (rawSettings.rates.Easy === 55 &&
      rawSettings.rates.Medium === 95 &&
      rawSettings.rates.Hard === 150)
  ) {
    merged.rates = { Easy: 2, Medium: 3, Hard: 4 };
  }

  return merged;
}

export class LocalStorageTaskLedgerRepository implements ITaskLedgerRepository {
  loadSnapshot(): LedgerSnapshot {
    try {
      window.localStorage.removeItem('taskledger_v1_snapshot');
      window.localStorage.removeItem('kerjaan_remote_v2_snapshot');

      const raw =
        window.localStorage.getItem(STORAGE_KEY) ||
        window.localStorage.getItem('kerjaan_remote_v4_clean_snapshot') ||
        window.localStorage.getItem('kerjaan_remote_v3_clean_snapshot');
      if (!raw) {
        const clean = createInitialSeedData();
        const initial: LedgerSnapshot = {
          version: CURRENT_SCHEMA_VERSION,
          ...clean,
        };
        this.saveSnapshot(initial);
        return initial;
      }
      const parsed = JSON.parse(raw) as LedgerSnapshot;
      if (!parsed || !Array.isArray(parsed.tasks)) {
        return this.resetToSeed();
      }
      const normalizedTasks = parsed.tasks.map((t) => ({
        ...t,
        variations: normalizeTaskVariations(t.variations),
      }));
      const normalizedSnapshot: LedgerSnapshot = {
        version: CURRENT_SCHEMA_VERSION,
        tasks: normalizedTasks,
        worksheetCells: Array.isArray(parsed.worksheetCells)
          ? parsed.worksheetCells
          : [],
        dailyNotes: Array.isArray(parsed.dailyNotes) ? parsed.dailyNotes : [],
        settings: normalizeLoadedSettings(parsed.settings),
      };
      this.saveSnapshot(normalizedSnapshot);
      return normalizedSnapshot;
    } catch {
      return this.resetToSeed();
    }
  }

  saveSnapshot(snapshot: LedgerSnapshot): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch (err) {
      console.error('Failed to persist Kerjaan-Remote snapshot to localStorage:', err);
    }
  }

  resetToSeed(): LedgerSnapshot {
    const clean = createInitialSeedData();
    const snapshot: LedgerSnapshot = {
      version: CURRENT_SCHEMA_VERSION,
      ...clean,
    };
    this.saveSnapshot(snapshot);
    return snapshot;
  }

  exportJson(): string {
    const snapshot = this.loadSnapshot();
    return JSON.stringify(snapshot, null, 2);
  }

  importJson(rawJson: string): LedgerSnapshot {
    const parsed = JSON.parse(rawJson) as Partial<LedgerSnapshot>;
    if (!parsed || !Array.isArray(parsed.tasks) || !parsed.settings) {
      throw new Error(
        'Invalid Kerjaan-Remote JSON file: missing tasks array or settings object.'
      );
    }
    const validated: LedgerSnapshot = {
      version: CURRENT_SCHEMA_VERSION,
      tasks: parsed.tasks.map((t) => ({
        ...t,
        variations: normalizeTaskVariations(t.variations),
      })),
      worksheetCells: Array.isArray(parsed.worksheetCells)
        ? parsed.worksheetCells
        : [],
      dailyNotes: Array.isArray(parsed.dailyNotes) ? parsed.dailyNotes : [],
      settings: normalizeLoadedSettings(parsed.settings),
    };
    this.saveSnapshot(validated);
    return validated;
  }
}

export const taskRepository: ITaskLedgerRepository =
  new LocalStorageTaskLedgerRepository();
