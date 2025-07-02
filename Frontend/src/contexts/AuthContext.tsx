import React, { createContext, useState, useEffect, ReactNode, useContext } from 'react';
import { User } from '../types';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../constants';
import { useLogs } from '../hooks/useLogs';
import { UserContext } from './UserContext'; // Import UserContext to get users

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  isAuthLoading: boolean; // Added for initial auth check status
  login: (username: string, pass: string) => Promise<boolean>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true); // Initialize to true
  const navigate = useNavigate();
  const { addLog } = useLogs();
  const userContext = useContext(UserContext); 

  useEffect(() => {
    let isMounted = true; // Prevent state update on unmounted component
    
    const verifyAuth = async () => {
      // Simulate a tiny delay if needed, useful for seeing loading state during dev.
      // await new Promise(resolve => setTimeout(resolve, 50)); 
      if (!isMounted) return;

      const storedUser = sessionStorage.getItem('currentUser');
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          if (parsedUser && parsedUser.id && parsedUser.username && parsedUser.role) {
              setCurrentUser(parsedUser);
              setIsAuthenticated(true);
          } else {
              sessionStorage.removeItem('currentUser'); // Clear invalid stored user
          }
        } catch (error) {
            console.error("Error parsing stored user:", error);
            sessionStorage.removeItem('currentUser');
        }
      }
      setIsAuthLoading(false); // Finished loading auth status
    };

    verifyAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (username: string, pass: string): Promise<boolean> => {
    let potentialUser: User | undefined = undefined;

    if (userContext && !userContext.isLoadingUsers) {
      potentialUser = userContext.users.find(u => u.username === username);
    }
    
    if (potentialUser && potentialUser.password === pass) {
      setCurrentUser(potentialUser);
      setIsAuthenticated(true);
      sessionStorage.setItem('currentUser', JSON.stringify(potentialUser)); 
      await addLog(username, 'User Login Success (DB)', { role: potentialUser.role });
      navigate(ROUTES.DASHBOARD);
      return true;
    }

    if (username === 'admin' && pass === 'password') {
      const adminUser: User = { 
        id: 'admin-special-001', 
        username: 'admin', 
        role: 'Administrador',
        lastModified: Date.now(),
        syncStatus: 'synced',
        isDeleted: false,
      };
      const adminUserForState = { ...adminUser, password: undefined }; 
      setCurrentUser(adminUserForState);
      setIsAuthenticated(true);
      sessionStorage.setItem('currentUser', JSON.stringify(adminUserForState)); 
      await addLog(username, 'User Login Success (Hardcoded Admin)');
      navigate(ROUTES.DASHBOARD);
      return true;
    }

    await new Promise(resolve => setTimeout(resolve, 300)); 
    await addLog(username, 'User Login Failed - Invalid Credentials');
    return false;
  };

  const logout = () => {
    const username = currentUser?.username || 'Unknown User';
    setCurrentUser(null);
    setIsAuthenticated(false);
    sessionStorage.removeItem('currentUser'); 
    sessionStorage.removeItem('autoShiftCheckDone'); // Clean up auto-start flag on logout
    addLog(username, 'User Logout');
    navigate(ROUTES.LOGIN);
  };

  return (
    <AuthContext.Provider value={{ currentUser, isAuthenticated, isAuthLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};