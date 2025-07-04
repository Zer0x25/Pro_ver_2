import React, { createContext, useState, useEffect, ReactNode, useCallback, useContext } from 'react';
import { MeterReading, MeterReadingsContextType, MeterReadingItem } from '../types';
import { idbGetAll, idbPut, STORES } from '../utils/indexedDB';
import { useAuth } from '../hooks/useAuth';
import { useToasts } from '../hooks/useToasts';
import { useLogs } from '../hooks/useLogs';
import { useTheoreticalShifts } from '../hooks/useTheoreticalShifts';

export const MeterReadingsContext = createContext<MeterReadingsContextType | undefined>(undefined);

export const MeterReadingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [readings, setReadings] = useState<MeterReading[]>([]);
  const [isLoadingReadings, setIsLoadingReadings] = useState(true);
  const { currentUser } = useAuth();
  const { addToast } = useToasts();
  const { addLog } = useLogs();
  const { meterConfigs } = useTheoreticalShifts();

  const loadReadings = useCallback(async () => {
    setIsLoadingReadings(true);
    try {
      const storedReadings = await idbGetAll<MeterReading>(STORES.METER_READINGS);
      setReadings(storedReadings.sort((a, b) => b.timestamp - a.timestamp));
    } catch (error) {
      console.error("Error loading meter readings:", error);
      addToast("Error al cargar las lecturas de medidores.", "error");
    } finally {
      setIsLoadingReadings(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadReadings();
  }, []);

  const addReading = useCallback(async (newReadings: Omit<MeterReadingItem, 'label'>[]): Promise<MeterReading | null> => {
    if (!currentUser) {
      addToast("Debe iniciar sesión para agregar una lectura.", "error");
      return null;
    }
    if (newReadings.some(r => r.value < 0)) {
      addToast("Los valores de lectura no pueden ser negativos.", "error");
      return null;
    }

    const readingsWithLabels = newReadings.map(reading => {
        const config = meterConfigs.find(c => c.id === reading.meterConfigId);
        return {
            ...reading,
            label: config?.label || 'Medidor Desconocido'
        };
    });

    const newReadingEntry: MeterReading = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      authorUsername: currentUser.username,
      readings: readingsWithLabels,
      lastModified: Date.now(),
      syncStatus: 'pending',
      isDeleted: false,
    };

    try {
      await idbPut<MeterReading>(STORES.METER_READINGS, newReadingEntry);
      setReadings(prev => [newReadingEntry, ...prev].sort((a, b) => b.timestamp - a.timestamp));
      addLog(currentUser.username, 'Meter Reading Added', { readingId: newReadingEntry.id, count: newReadings.length });
      addToast("Lectura de medidores guardada.", "success");
      return newReadingEntry;
    } catch (error) {
      console.error("Error adding meter reading:", error);
      addLog(currentUser.username, 'Meter Reading Add Failed', { error: String(error) });
      addToast("Error al guardar la lectura.", "error");
      return null;
    }
  }, [currentUser, addLog, addToast, meterConfigs]);

  return (
    <MeterReadingsContext.Provider value={{ readings, isLoadingReadings, addReading }}>
      {children}
    </MeterReadingsContext.Provider>
  );
};
