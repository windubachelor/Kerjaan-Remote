import {
  AppSettings,
  DailyWorksheetNote,
  Task,
  WorksheetCell,
} from '../types';
import {
  DEFAULT_GDRIVE_FOLDER_ID,
  DEFAULT_GDRIVE_FOLDER_URL,
} from './googleDrive';

export const DEFAULT_SETTINGS: AppSettings = {
  illustratorName: 'Senior Illustrator',
  passThreshold: 4.0,
  rates: {
    Easy: 2,
    Medium: 3,
    Hard: 4,
  },
  weeklyHourTarget: 32,
  variationCount: 10,
  theme: 'light',
  gdriveFolderId: DEFAULT_GDRIVE_FOLDER_ID,
  gdriveFolderUrl: DEFAULT_GDRIVE_FOLDER_URL,
  gdrivePrefixMode: 'title_only',
  autoUploadToGDrive: true,
};

/**
 * Clean production initial state with zero dummy data.
 */
export function createInitialSeedData(): {
  tasks: Task[];
  worksheetCells: WorksheetCell[];
  dailyNotes: DailyWorksheetNote[];
  settings: AppSettings;
} {
  return {
    tasks: [],
    worksheetCells: [],
    dailyNotes: [],
    settings: DEFAULT_SETTINGS,
  };
}
