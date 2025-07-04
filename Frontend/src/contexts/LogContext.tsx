

import React, { createContext, useState, useCallback, ReactNode } from 'react';
import { AuditLog, LogContextType } from '../types';
import { STORES, idbGetAll, idbPut, getDBInstance } from '../utils/indexedDB'; 

export const LogContext = createContext<LogContextType | undefined>(undefined);

interface LogProviderProps {
  children: ReactNode;
}

export const LogProvider: React.FC<LogProviderProps> = ({ children }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(false); // Default to false

  const loadLogs = useCallback(async () => {
    if (isLoadingLogs) return; // Prevent concurrent loads
    setIsLoadingLogs(true);
    try {
      const storedLogs = await idbGetAll<AuditLog>(STORES.AUDIT_LOGS);
      setLogs(storedLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    } catch (error) {
      console.error("Error loading audit logs from IndexedDB:", error);
    } finally {
      setIsLoadingLogs(false);
    }
  }, [isLoadingLogs]);


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
      // Only update state if logs have been loaded previously to avoid inconsistent states
      setLogs(prevLogs => {
        if (prevLogs.length > 0 || isLoadingLogs) {
          return [newLog, ...prevLogs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        }
        return prevLogs; // Return previous state if not modifying
      });
    } catch (error) {
      console.error("Error adding log to IndexedDB:", error);
    }
  }, [isLoadingLogs]);

  const clearAllLogs = useCallback(async (): Promise<void> => {
    // Confirmation is handled by the caller (ConfigurationPage)
    setIsLoadingLogs(true);
    try {
      const db = await getDBInstance();
      const tx = db.transaction(STORES.AUDIT_LOGS, 'readwrite');
      await tx.store.clear(); // Much more efficient than deleting one by one
      await tx.done;
      setLogs([]);
    } catch (error) {
      console.error("Error clearing audit logs from IndexedDB:", error);
      throw error; 
    } finally {
      setIsLoadingLogs(false);
    }
  }, []);

  return (
    <LogContext.Provider value={{ logs, isLoadingLogs, addLog, clearAllLogs, loadLogs }}>
      {children}
    </LogContext.Provider>
  );
};