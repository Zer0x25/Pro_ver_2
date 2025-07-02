import React, { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { AuditLog, LogContextType } from '../types';
import { STORES, idbGetAll, idbPut, idbDelete } from '../utils/indexedDB'; // idbDelete will be used for clearing logs

export const LogContext = createContext<LogContextType | undefined>(undefined);

interface LogProviderProps {
  children: ReactNode;
}

export const LogProvider: React.FC<LogProviderProps> = ({ children }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(true);

  useEffect(() => {
    const loadLogs = async () => {
      setIsLoadingLogs(true);
      try {
        const storedLogs = await idbGetAll<AuditLog>(STORES.AUDIT_LOGS);
        // Sort by timestamp descending to show newest first
        setLogs(storedLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      } catch (error) {
        console.error("Error loading audit logs from IndexedDB:", error);
      } finally {
        setIsLoadingLogs(false);
      }
    };
    loadLogs();
  }, []);

  const addLog = useCallback(async (actorUsername: string, action: string, details?: Record<string, any>): Promise<void> => {
    const timestamp = new Date().toISOString();
    const newLog: AuditLog = {
      id: `${timestamp}-${Math.random().toString(36).substr(2, 9)}`, // Unique ID
      timestamp,
      actorUsername,
      action,
      details,
      lastModified: Date.now(),
      syncStatus: 'pending',
      isDeleted: false,
    };
    try {
      await idbPut<AuditLog>(STORES.AUDIT_LOGS, newLog);
      setLogs(prevLogs => [newLog, ...prevLogs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())); // Add to start and re-sort
    } catch (error) {
      console.error("Error adding log to IndexedDB:", error);
    }
  }, []);

  const clearAllLogs = useCallback(async (): Promise<void> => {
    // Confirmation is handled by the caller (ConfigurationPage)
    setIsLoadingLogs(true);
    try {
      const allLogs = await idbGetAll<AuditLog>(STORES.AUDIT_LOGS);
      const { getDBInstance } = await import('../utils/indexedDB'); 
      const db = await getDBInstance();
      const tx = db.transaction(STORES.AUDIT_LOGS, 'readwrite');
      for (const log of allLogs) {
        tx.store.delete(log.id);
      }
      await tx.done;
      setLogs([]);
      // Toast notifications for success/failure will be handled by the calling component (ConfigurationPage)
    } catch (error) {
      console.error("Error clearing audit logs from IndexedDB:", error);
      // Re-throw the error so the caller can handle it (e.g., show a toast)
      throw error; 
    } finally {
      setIsLoadingLogs(false);
    }
  }, []);

  return (
    <LogContext.Provider value={{ logs, isLoadingLogs, addLog, clearAllLogs }}>
      {children}
    </LogContext.Provider>
  );
};