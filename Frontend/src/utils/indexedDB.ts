import { IDBPDatabase, openDB } from 'idb';
import { Employee, DailyTimeRecord, ShiftReport, AppSetting, AuditLog, User, TheoreticalShiftPattern, AssignedShift, QuickNote, MeterReading } from '../types';

const DB_NAME = 'SAPHRPortalDB';
const DB_VERSION = 8; // Incremented version for new indexes and stores

// Define Object Store Names
export const STORES = {
  EMPLOYEES: 'employees',
  DAILY_TIME_RECORDS: 'dailyTimeRecords',
  SHIFT_REPORTS: 'shiftReports',
  APP_SETTINGS: 'appSettings',
  AUDIT_LOGS: 'auditLogs',
  USERS: 'users',
  THEORETICAL_SHIFT_PATTERNS: 'theoreticalShiftPatterns',
  ASSIGNED_SHIFTS: 'assignedShifts',
  QUICK_NOTES: 'quickNotes',
  METER_READINGS: 'meterReadings',
};

let dbPromise: Promise<IDBPDatabase<any>> | null = null;

const initDB = (): Promise<IDBPDatabase<any>> => {
  if (dbPromise) return dbPromise;

  dbPromise = openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      // Helper function to robustly create a store and its indexes
      const createStoreWithSyncIndexes = (storeName: string, keyPath: string, indexes?: { name: string, keyPath: string, options?: IDBIndexParameters }[]) => {
          let store;
          if (!db.objectStoreNames.contains(storeName)) {
              store = db.createObjectStore(storeName, { keyPath });
          } else {
              store = transaction.objectStore(storeName);
          }

          if (!store.indexNames.contains('syncStatus')) {
              store.createIndex('syncStatus', 'syncStatus');
          }
          if (!store.indexNames.contains('isDeleted')) {
              store.createIndex('isDeleted', 'isDeleted');
          }
          if (indexes) {
              indexes.forEach(idx => {
                  if (!store.indexNames.contains(idx.name)) {
                      store.createIndex(idx.name, idx.keyPath, idx.options);
                  }
              });
          }
      };
      
      // Apply sync indexes to all relevant stores
      createStoreWithSyncIndexes(STORES.EMPLOYEES, 'id');
      // Add employeeId and entradaTimestamp index for performance
      createStoreWithSyncIndexes(STORES.DAILY_TIME_RECORDS, 'id', [
          { name: 'employeeId', keyPath: 'employeeId' },
          { name: 'entradaTimestamp', keyPath: 'entradaTimestamp' }
      ]);
      createStoreWithSyncIndexes(STORES.SHIFT_REPORTS, 'id');
      createStoreWithSyncIndexes(STORES.USERS, 'id', [{ name: 'username', keyPath: 'username', options: { unique: true } }]);
      createStoreWithSyncIndexes(STORES.THEORETICAL_SHIFT_PATTERNS, 'id');
      createStoreWithSyncIndexes(STORES.ASSIGNED_SHIFTS, 'id', [
          { name: 'employeeId', keyPath: 'employeeId' },
          { name: 'shiftPatternId', keyPath: 'shiftPatternId' }
      ]);
      createStoreWithSyncIndexes(STORES.APP_SETTINGS, 'id');
      createStoreWithSyncIndexes(STORES.AUDIT_LOGS, 'id');
      createStoreWithSyncIndexes(STORES.QUICK_NOTES, 'id', [{ name: 'createdAt', keyPath: 'createdAt' }]);
      createStoreWithSyncIndexes(STORES.METER_READINGS, 'id', [{ name: 'timestamp', keyPath: 'timestamp' }]);
    },
  });
  return dbPromise;
};
// Ensure initDB is called once when the module loads to trigger upgrade if needed.
initDB();


// Generic CRUD operations
export const idbGetAll = async <T>(storeName: string): Promise<T[]> => {
  const db = await initDB();
  return db.getAll(storeName);
};

export const idbGetAllBy = async <T>(storeName: string, indexName: string, value: any): Promise<T[]> => {
    const db = await initDB();
    return db.getAllFromIndex(storeName, indexName, value);
};

export const idbGet = async <T>(storeName: string, key: string): Promise<T | undefined> => {
  const db = await initDB();
  return db.get(storeName, key);
};

export const idbPut = async <T>(storeName: string, item: T): Promise<IDBValidKey> => {
  const db = await initDB();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  const result = await store.put(item);
  await tx.done;
  return result;
};

export const idbDelete = async (storeName: string, key: string): Promise<void> => {
  const db = await initDB();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  await store.delete(key);
  await tx.done;
};

// Counter/Setting specific functions
export const COUNTER_IDS = {
  EMPLOYEE_ID: 'employeeIdCounter',
  LOGBOOK_FOLIO: 'logbookFolioCounter',
  GLOBAL_SETTING_MAX_WEEKLY_HOURS_ID: 'globalMaxWeeklyHours',
  GLOBAL_AREA_LIST_ID: 'globalAreaList',
  GLOBAL_METER_CONFIGS_ID: 'globalMeterConfigs',
  COMMUNICATIONS_CONTENT_ID: 'communicationsContent',
  LAST_SYNC_TIMESTAMP: 'lastSyncTimestamp',
};

export const getSettingValue = async <T>(settingId: string, defaultValue: T): Promise<T> => {
  const setting = await idbGet<AppSetting>(STORES.APP_SETTINGS, settingId);
  return setting ? (setting.value as T) : defaultValue;
};

export const setSettingValue = async (settingId: string, value: any): Promise<IDBValidKey> => {
  return idbPut<AppSetting>(STORES.APP_SETTINGS, { 
      id: settingId, 
      value,
      lastModified: Date.now(),
      syncStatus: 'pending',
      isDeleted: false
  });
};

export const getCounterValue = async (counterId: string, defaultValue: number): Promise<number> => {
  return getSettingValue<number>(counterId, defaultValue);
};
export const setCounterValue = (counterId: string, value: any): Promise<IDBValidKey> => {
    return setSettingValue(counterId, value);
};

// Export store names and counter IDs for use in other files
export { initDB as getDBInstance }; // Export initDB for LogContext special clearAllLogs case


/**
 * Exports the entire IndexedDB database to a JSON file.
 */
export const exportDB = async (): Promise<void> => {
  try {
    const db = await initDB();
    const exportObject: { [key: string]: any[] } = {};

    for (const storeName of Object.values(STORES)) {
      const allRecords = await db.getAll(storeName);
      exportObject[storeName] = allRecords;
    }

    const jsonString = JSON.stringify(exportObject, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.download = `portal-control-interno-backup-${timestamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error exporting database:", error);
    throw new Error("Failed to export database.");
  }
};

/**
 * Imports data from a JSON file into the IndexedDB, overwriting existing data.
 * @param file The JSON file to import.
 */
export const importDB = async (file: File): Promise<void> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const jsonString = event.target?.result;
        if (typeof jsonString !== 'string') {
          throw new Error("File could not be read as text.");
        }
        const dataToImport = JSON.parse(jsonString);

        // Basic validation to check if it looks like a valid export file
        const storeNames = Object.values(STORES);
        const importedKeys = Object.keys(dataToImport);
        if (!importedKeys.length || !importedKeys.every(key => storeNames.includes(key))) {
             throw new Error("El archivo no parece ser una exportación válida de la base de datos.");
        }

        const db = await initDB();
        const tx = db.transaction(storeNames, 'readwrite');

        // Clear all stores first
        await Promise.all(
          storeNames.map((storeName) => {
            return tx.objectStore(storeName).clear();
          })
        );
        
        console.log("All stores cleared. Starting import...");

        // Populate all stores with imported data
        await Promise.all(
          Object.keys(dataToImport).map(storeName => {
            const store = tx.objectStore(storeName);
            const records = dataToImport[storeName];
            return Promise.all(records.map((record: any) => store.put(record)));
          })
        );
        
        console.log("Data import transaction prepared.");

        await tx.done;
        console.log("Import transaction completed.");
        resolve();
      } catch (error) {
        console.error("Error during database import:", error);
        reject(error);
      }
    };
    reader.onerror = (error) => {
      console.error("Error reading file:", error);
      reject(new Error("Failed to read file."));
    };
    reader.readAsText(file);
  });
};