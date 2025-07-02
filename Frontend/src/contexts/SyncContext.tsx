import React, { createContext, useState, useEffect, ReactNode, useCallback, useContext } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useToasts } from '../hooks/useToasts';
import { useLogs } from '../hooks/useLogs';
import { STORES, idbGetAllBy, idbPut, getDBInstance, COUNTER_IDS, setSettingValue } from '../utils/indexedDB';
import { Syncable, SyncState, SyncContextType, AuditLog } from '../types';

export const SyncContext = createContext<SyncContextType | undefined>(undefined);

const SYNCABLE_STORES = [
    STORES.EMPLOYEES,
    STORES.USERS,
    STORES.DAILY_TIME_RECORDS,
    STORES.THEORETICAL_SHIFT_PATTERNS,
    STORES.ASSIGNED_SHIFTS,
    STORES.SHIFT_REPORTS,
    STORES.APP_SETTINGS
];

export const SyncProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [conflicts, setConflicts] = useState<any[]>([]);

  const { currentUser } = useAuth();
  const { addToast } = useToasts();
  const { addLog } = useLogs();

  useEffect(() => {
      const storedTime = localStorage.getItem(COUNTER_IDS.LAST_SYNC_TIMESTAMP);
      if (storedTime) {
          setLastSyncTime(parseInt(storedTime, 10));
      }
  }, []);

  const runSync = useCallback(async () => {
    if (!isOnline) {
      setSyncState('no-network');
      addToast("No se puede sincronizar. No hay conexión a internet.", "error");
      return;
    }
    if (syncState === 'syncing') {
      addToast("La sincronización ya está en progreso.", "info");
      return;
    }
    if (!currentUser) {
      addToast("Debe iniciar sesión para sincronizar.", "error");
      return;
    }
    setSyncState('syncing');
    setConflicts([]); // Reset conflicts at the start of a sync

    try {
      const db = await getDBInstance();
      let pendingChangesPayload: Record<string, any[]> = {};
      let changeCount = 0;

      for (const storeName of SYNCABLE_STORES) {
        const pendingItems = await idbGetAllBy<Syncable>(storeName, 'syncStatus', 'pending');
        if (pendingItems.length > 0) {
          pendingChangesPayload[storeName] = pendingItems;
          changeCount += pendingItems.length;
        }
      }
      
      const auditLogs = await idbGetAllBy<AuditLog>(STORES.AUDIT_LOGS, 'syncStatus', 'pending');
      
      const payload = {
          lastSyncTimestamp: localStorage.getItem(COUNTER_IDS.LAST_SYNC_TIMESTAMP) || 0,
          changes: pendingChangesPayload,
          auditLogs: auditLogs
      };

      console.log("SYNC: Payload to be sent to backend:", JSON.stringify(payload, null, 2));
      
      if (changeCount === 0 && auditLogs.length === 0) {
          addToast("Los datos ya están actualizados.", 'success');
          setSyncState('success');
          setTimeout(() => setSyncState('idle'), 3000);
          return;
      }

      await new Promise(resolve => setTimeout(resolve, 1500));

      const mockErrors: any[] = [];
      const mockConflicts: any[] = [];
      Object.values(payload.changes).flat().forEach((item: any) => {
        if ((item.name || item.username)?.toLowerCase().includes('error')) {
          mockErrors.push({ clientRecordId: item.id, message: 'Error de validación forzado para pruebas.' });
        }
        if ((item.name || item.username)?.toLowerCase().includes('conflict')) {
          mockConflicts.push({ clientRecordId: item.id, message: `Conflicto resuelto para ${item.name || item.username}.` });
        }
      });

      const mockResponse = {
        newSyncTimestamp: Date.now(),
        updates: {},
        conflicts: mockConflicts,
        errors: mockErrors,
      };
      
      console.log("SYNC: Mock response from backend:", JSON.stringify(mockResponse, null, 2));
      setConflicts(mockResponse.conflicts);

      const tx = db.transaction([...SYNCABLE_STORES, STORES.AUDIT_LOGS], 'readwrite');
      
      for (const storeName of Object.keys(payload.changes)) {
          for (const item of payload.changes[storeName]) {
            if (!mockResponse.errors.some((e: any) => e.clientRecordId === item.id)) {
                const store = tx.objectStore(storeName);
                item.syncStatus = 'synced';
                item.syncError = undefined; // Clear previous errors
                store.put(item);
            }
          }
      }
      
      const auditLogStore = tx.objectStore(STORES.AUDIT_LOGS);
      for (const log of auditLogs) {
        if (!mockResponse.errors.some((e: any) => e.clientRecordId === log.id)) {
            log.syncStatus = 'synced';
            log.syncError = undefined;
            auditLogStore.put(log);
        }
      }

      for (const error of mockResponse.errors as any[]) {
          let found = false;
          for (const storeName of SYNCABLE_STORES) {
              const store = tx.objectStore(storeName);
              const item = await store.get(error.clientRecordId);
              if (item) {
                  item.syncStatus = 'error';
                  item.syncError = error.message;
                  store.put(item);
                  addToast(`Error al sincronizar ${(item as any).name || `ID: ${item.id}`}: ${error.message}`, 'error', 7000);
                  found = true;
                  break; 
              }
          }
           if (!found) console.warn(`SYNC: Could not find item with ID ${error.clientRecordId} to mark as error.`);
      }

      for (const conflict of mockResponse.conflicts as any[]) {
          addToast(conflict.message, 'info', 7000);
      }
      
      for (const storeName of Object.keys(mockResponse.updates)) {
          const store = tx.objectStore(storeName);
          for (const item of (mockResponse.updates as any)[storeName]) {
              store.put(item);
          }
      }

      await tx.done;

      localStorage.setItem(COUNTER_IDS.LAST_SYNC_TIMESTAMP, String(mockResponse.newSyncTimestamp));
      setLastSyncTime(mockResponse.newSyncTimestamp);
      
      const hasErrors = mockResponse.errors.length > 0;
      if (hasErrors) {
          addToast("Sincronización completada con errores.", "warning");
          setSyncState('error');
      } else {
          addToast("Sincronización completada.", 'success');
          setSyncState('success');
      }
      
      await addLog(currentUser.username, 'Sync Completed', { changesSent: changeCount + auditLogs.length, errors: mockResponse.errors.length, conflicts: mockResponse.conflicts.length });

      if (!hasErrors) {
          setTimeout(() => setSyncState('idle'), 3000);
      }

    } catch (error) {
      console.error("SYNC: An error occurred during synchronization:", error);
      addToast("Ocurrió un error inesperado durante la sincronización.", "error");
      setSyncState('error');
      if (currentUser) {
        await addLog(currentUser.username, 'Sync Failed', { error: String(error) });
      }
      setTimeout(() => setSyncState('idle'), 5000);
    }
  }, [currentUser, isOnline, addToast, addLog, syncState]);

  useEffect(() => {
    const handleOnline = () => {
        setIsOnline(true);
        setSyncState('idle');
        addToast("Conexión a internet reestablecida. Iniciando sincronización.", "success");
        runSync();
    };
    const handleOffline = () => {
        setIsOnline(false);
        setSyncState('no-network');
        addToast("Se ha perdido la conexión a internet. Modo offline activado.", "warning");
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [addToast, runSync]);
  
  const runBootstrap = useCallback(async () => {
      console.log("SYNC: Running bootstrap...");
      addToast("Función de Bootstrap no implementada.", "info");
  }, [addToast]);

  return (
    <SyncContext.Provider value={{ syncState, lastSyncTime, runSync, runBootstrap, conflicts }}>
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = (): SyncContextType => {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
};