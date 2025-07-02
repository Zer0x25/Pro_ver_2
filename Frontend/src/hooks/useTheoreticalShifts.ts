import { useContext } from 'react';
import { TheoreticalShiftContext } from '../contexts/TheoreticalShiftContext';
import { TheoreticalShiftContextType } from '../types';

export const useTheoreticalShifts = (): TheoreticalShiftContextType => {
  const context = useContext(TheoreticalShiftContext);
  if (context === undefined) {
    throw new Error('useTheoreticalShifts must be used within a TheoreticalShiftProvider');
  }
  return context;
};
