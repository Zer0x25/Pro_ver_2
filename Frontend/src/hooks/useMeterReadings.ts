import { useContext } from 'react';
import { MeterReadingsContext } from '../contexts/MeterReadingsContext';
import { MeterReadingsContextType } from '../types';

export const useMeterReadings = (): MeterReadingsContextType => {
  const context = useContext(MeterReadingsContext);
  if (context === undefined) {
    throw new Error('useMeterReadings must be used within a MeterReadingsProvider');
  }
  return context;
};
