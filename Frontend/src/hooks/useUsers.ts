import { useContext } from 'react';
import { UserContext } from '../contexts/UserContext';
import type { UserContextType } from '../types'; // Corrected: UserContextType is imported from types.ts

export const useUsers = (): UserContextType => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUsers must be used within a UserProvider');
  }
  return context;
};