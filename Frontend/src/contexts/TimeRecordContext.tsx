
import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { DailyTimeRecord, TimeRecordContextType } from '../types';
import { useToasts } from '../hooks/useToasts';
import { idbGetAll, idbPut, idbDelete, STORES, getDBInstance } from '../utils/indexedDB';

export const TimeRecordContext = createContext<TimeRecordContextType | undefined>(undefined);

interface TimeRecordProviderProps {
  children: ReactNode;
}

const sortRecords = (records: DailyTimeRecord[]): DailyTimeRecord[] => {
  return records.sort((a, b) => (b.entradaTimestamp || b.salidaTimestamp || 0) - (a.entradaTimestamp || a.salidaTimestamp || 0));
};

export const TimeRecordProvider: React.FC<TimeRecordProviderProps> = ({ children }) => {
  const [dailyRecords, setDailyRecords] = useState<DailyTimeRecord[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState<boolean>(true);
  const [allRecordsLoaded, setAllRecordsLoaded] = useState<boolean>(false);
  const { addToast } = useToasts();

  useEffect(() => {
    const loadInitialRecords = async () => {
      setIsLoadingRecords(true);
      try {
        const db = await getDBInstance();
        const thirtyOneDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;
        const range = IDBKeyRange.lowerBound(thirtyOneDaysAgo);
        const records = await db.getAllFromIndex(STORES.DAILY_TIME_RECORDS, 'entradaTimestamp', range);
        setDailyRecords(sortRecords(records));
      } catch (error) {
        console.error("Error loading initial daily records from IndexedDB:", error);
        addToast("Error cargando registros de horario iniciales.", 'error');
      } finally {
        setIsLoadingRecords(false);
      }
    };
    loadInitialRecords();
  }, [addToast]);
  
  const loadAllRecords = useCallback(async () => {
    if (allRecordsLoaded) return;
    setIsLoadingRecords(true);
    try {
      const allRecords = await idbGetAll<DailyTimeRecord>(STORES.DAILY_TIME_RECORDS);
      setDailyRecords(sortRecords(allRecords));
      setAllRecordsLoaded(true);
    } catch (error) {
      console.error("Error loading all daily records from IndexedDB:", error);
      addToast("Error cargando el historial completo de registros.", 'error');
    } finally {
      setIsLoadingRecords(false);
    }
  }, [addToast, allRecordsLoaded]);

  const addOrUpdateRecord = useCallback(async (record: DailyTimeRecord): Promise<boolean> => {
    try {
      await idbPut<DailyTimeRecord>(STORES.DAILY_TIME_RECORDS, record);
      setDailyRecords(prevRecords => {
        const existingIndex = prevRecords.findIndex(r => r.id === record.id);
        if (existingIndex > -1) {
          const newRecords = [...prevRecords];
          newRecords[existingIndex] = record;
          return sortRecords(newRecords);
        } else {
          return sortRecords([record, ...prevRecords]);
        }
      });
      return true;
    } catch (error) {
      console.error("Error saving record to IndexedDB:", error);
      addToast("Error al guardar el registro.", 'error');
      return false;
    }
  }, [addToast]);

  const deleteRecordById = useCallback(async (recordId: string): Promise<boolean> => {
    try {
      await idbDelete(STORES.DAILY_TIME_RECORDS, recordId);
      setDailyRecords(prev => prev.filter(r => r.id !== recordId));
      return true;
    } catch (error) {
      console.error("Error deleting record from IndexedDB:", error);
      addToast("Error al eliminar el registro.", 'error');
      return false;
    }
  }, [addToast]);

  return (
    <TimeRecordContext.Provider value={{
      dailyRecords,
      isLoadingRecords,
      allRecordsLoaded,
      addOrUpdateRecord,
      deleteRecordById,
      loadAllRecords
    }}>
      {children}
    </TimeRecordContext.Provider>
  );
};
