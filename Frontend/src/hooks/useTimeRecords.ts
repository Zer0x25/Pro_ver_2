
import { useContext } from 'react';
import { TimeRecordContext } from '../contexts/TimeRecordContext';
import { TimeRecordContextType } from '../types';

export const useTimeRecords = (): TimeRecordContextType => {
  const context = useContext(TimeRecordContext);
  if (context === undefined) {
    throw new Error('useTimeRecords must be used within a TimeRecordProvider');
  }
  return context;
};
