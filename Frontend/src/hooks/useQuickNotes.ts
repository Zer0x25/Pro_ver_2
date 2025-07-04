import { useContext } from 'react';
import { QuickNotesContext } from '../contexts/QuickNotesContext';
import { QuickNotesContextType } from '../types';

export const useQuickNotes = (): QuickNotesContextType => {
  const context = useContext(QuickNotesContext);
  if (context === undefined) {
    throw new Error('useQuickNotes must be used within a QuickNotesProvider');
  }
  return context;
};
