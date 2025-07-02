import { IDBPDatabase, openDB } from 'idb';
import { Employee, DailyTimeRecord, ShiftReport, AppSetting, AuditLog, User, TheoreticalShiftPattern, AssignedShift } from '../types';

const DB_NAME = 'SAPHRPortalDB';
const DB_VERSION = 6; // Incremented version for new indexes and stores

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
      // Add employeeId index for performance and to ensure upgrade runs smoothly
      createStoreWithSyncIndexes(STORES.DAILY_TIME_RECORDS, 'id', [{ name: 'employeeId', keyPath: 'employeeId' }]);
      createStoreWithSyncIndexes(STORES.SHIFT_REPORTS, 'id');
      createStoreWithSyncIndexes(STORES.USERS, 'id', [{ name: 'username', keyPath: 'username', options: { unique: true } }]);
      createStoreWithSyncIndexes(STORES.THEORETICAL_SHIFT_PATTERNS, 'id');
      createStoreWithSyncIndexes(STORES.ASSIGNED_SHIFTS, 'id', [
          { name: 'employeeId', keyPath: 'employeeId' },
          { name: 'shiftPatternId', keyPath: 'shiftPatternId' }
      ]);
      createStoreWithSyncIndexes(STORES.APP_SETTINGS, 'id');
      createStoreWithSyncIndexes(STORES.AUDIT_LOGS, 'id');
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