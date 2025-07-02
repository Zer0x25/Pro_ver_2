import { useContext } from 'react';
import { LogContext } from '../contexts/LogContext'; // Corrected relative path
import { LogContextType } from '../types';

export const useLogs = (): LogContextType => {
  const context = useContext(LogContext);
  if (context === undefined) {
    throw new Error('useLogs must be used within a LogProvider');
  }
  return context;
};