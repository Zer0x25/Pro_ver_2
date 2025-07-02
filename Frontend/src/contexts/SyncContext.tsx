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

      if (changeCount === 0 && auditLogs.length === 0) {
          addToast("Los datos ya están actualizados.", 'success');
          setSyncState('success');
          setTimeout(() => setSyncState('idle'), 3000);
          return;
      }

      // --- Llamada real al backend ---
      const token = sessionStorage.getItem('authToken');
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        addToast("Error de red o autenticación al sincronizar.", "error");
        setSyncState('error');
        return;
      }
      const syncResult = await response.json();
      setConflicts(syncResult.conflicts || []);

      const tx = db.transaction([...SYNCABLE_STORES, STORES.AUDIT_LOGS], 'readwrite');
      // Procesar updates del backend
      for (const storeName of Object.keys(syncResult.updates || {})) {
        const store = tx.objectStore(storeName);
        for (const item of syncResult.updates[storeName]) {
          store.put(item);
        }
      }
      // Marcar como 'synced' los enviados exitosamente
      for (const storeName of Object.keys(payload.changes)) {
        for (const item of payload.changes[storeName]) {
          if (!syncResult.errors?.some((e: any) => e.clientRecordId === item.id)) {
            const store = tx.objectStore(storeName);
            item.syncStatus = 'synced';
            item.syncError = undefined;
            store.put(item);
          }
        }
      }
      // Marcar logs de auditoría como 'synced'
      const auditLogStore = tx.objectStore(STORES.AUDIT_LOGS);
      for (const log of auditLogs) {
        if (!syncResult.errors?.some((e: any) => e.clientRecordId === log.id)) {
          log.syncStatus = 'synced';
          log.syncError = undefined;
          auditLogStore.put(log);
        }
      }
      // Procesar errores
      for (const error of syncResult.errors || []) {
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
      // Notificar conflictos
      for (const conflict of syncResult.conflicts || []) {
        addToast(conflict.message, 'info', 7000);
      }
      await tx.done;
      localStorage.setItem(COUNTER_IDS.LAST_SYNC_TIMESTAMP, String(syncResult.newSyncTimestamp));
      setLastSyncTime(syncResult.newSyncTimestamp);
      const hasErrors = (syncResult.errors || []).length > 0;
      if (hasErrors) {
        addToast("Sincronización completada con errores.", "warning");
        setSyncState('error');
      } else {
        addToast("Sincronización completada.", 'success');
        setSyncState('success');
      }
      await addLog(currentUser.username, 'Sync Completed', { changesSent: changeCount + auditLogs.length, errors: (syncResult.errors || []).length, conflicts: (syncResult.conflicts || []).length });
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
    try {
      const token = sessionStorage.getItem('authToken');
      if (!token) {
        addToast('No autenticado. Inicie sesión primero.', 'error');
        return;
      }
      const response = await fetch('/api/bootstrap', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        addToast('Error al obtener datos iniciales del servidor.', 'error');
        return;
      }
      const data = await response.json();
      const db = await getDBInstance();
      const tx = db.transaction([...SYNCABLE_STORES, STORES.AUDIT_LOGS], 'readwrite');
      // Solo poblar stores que existen en IndexedDB (usando contains correctamente)
      for (const storeName of Object.keys(data.data)) {
        if (!db.objectStoreNames.contains(storeName)) continue;
        const store = tx.objectStore(storeName);
        await store.clear();
        for (const item of data.data[storeName]) {
          store.put(item);
        }
      }
      await tx.done;
      localStorage.setItem(COUNTER_IDS.LAST_SYNC_TIMESTAMP, String(data.newSyncTimestamp));
      setLastSyncTime(data.newSyncTimestamp);
      addToast('Datos iniciales cargados correctamente.', 'success');
    } catch (error) {
      console.error('BOOTSTRAP: Error al poblar datos iniciales:', error);
      addToast('Error inesperado durante el bootstrap.', 'error');
    }
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