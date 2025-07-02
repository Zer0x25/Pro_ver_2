import { useContext } from 'react';
import { ToastContext, ToastContextType } from '../contexts/ToastContext';

export const useToasts = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToasts must be used within a ToastProvider');
  }
  return context;
};