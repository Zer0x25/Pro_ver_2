
import { useState, useEffect, useCallback } from 'react';
import { DailyTimeRecord } from '../types';
import { useToasts } from './useToasts';
import { idbGetAll, idbPut, idbDelete, STORES } from '../utils/indexedDB';

export const useTimeRecords = () => {
  const [dailyRecords, setDailyRecords] = useState<DailyTimeRecord[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState<boolean>(true);
  const { addToast } = useToasts();

  const sortRecords = (records: DailyTimeRecord[]): DailyTimeRecord[] => {
    return records.sort((a, b) => (b.entradaTimestamp || b.salidaTimestamp || 0) - (a.entradaTimestamp || a.salidaTimestamp || 0));
  };

  useEffect(() => {
    const loadRecords = async () => {
      setIsLoadingRecords(true);
      try {
        const storedRecords = await idbGetAll<DailyTimeRecord>(STORES.DAILY_TIME_RECORDS);
        setDailyRecords(sortRecords(storedRecords));
      } catch (error) {
        console.error("Error loading daily records from IndexedDB:", error);
        addToast("Error cargando registros de horario.", 'error');
      } finally {
        setIsLoadingRecords(false);
      }
    };
    loadRecords();
  }, [addToast]);

  const addOrUpdateRecord = useCallback(async (record: DailyTimeRecord): Promise<boolean> => {
    try {
      await idbPut<DailyTimeRecord>(STORES.DAILY_TIME_RECORDS, record);
      setDailyRecords(prevRecords => {
        const existingIndex = prevRecords.findIndex(r => r.id === record.id);
        if (existingIndex > -1) {
          // Update
          const newRecords = [...prevRecords];
          newRecords[existingIndex] = record;
          return sortRecords(newRecords);
        } else {
          // Add
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

  return {
    dailyRecords,
    isLoadingRecords,
    addOrUpdateRecord,
    deleteRecordById,
  };
};
