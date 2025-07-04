



import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import { ROUTES, STORAGE_KEYS } from '../../constants';
import { HomeIcon } from '../ui/icons';
import { DeveloperPanel } from '../ui/DeveloperPanel';
import { useAuth } from '../../hooks/useAuth';


interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarLgCollapsed, setIsSidebarLgCollapsed] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [devModeEnabled, setDevModeEnabled] = useState(
    localStorage.getItem(STORAGE_KEYS.DEV_MODE) === 'true'
  );

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === STORAGE_KEYS.DEV_MODE) {
        setDevModeEnabled(event.newValue === 'true');
      }
    };
    
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const toggleSidebarLgCollapse = () => {
    setIsSidebarLgCollapsed(prev => !prev);
  };
  
  const isSupervisorOnly = currentUser?.role === 'Supervisor';
  
  // The FAB should be hidden on any main dashboard page
  const onADashboard = location.pathname === ROUTES.DASHBOARD || location.pathname === ROUTES.SUPERVISOR_DASHBOARD;
  const showHomeFab = !onADashboard;
  
  // The FAB always targets the user's primary dashboard
  const homeFabTarget = isSupervisorOnly ? ROUTES.SUPERVISOR_DASHBOARD : ROUTES.DASHBOARD;
  const homeFabTitle = isSupervisorOnly ? "Ir al Dashboard de Supervisión" : "Ir al Dashboard Principal";

  const canShowDevPanel = currentUser?.role === 'Administrador' && devModeEnabled;

  return (
    <div className="flex h-screen bg-sap-gray dark:bg-sap-dark-gray">
      <Sidebar 
        isOpen={isSidebarOpen} 
        toggleSidebar={toggleSidebar}
        isLgCollapsed={isSidebarLgCollapsed}
        toggleLgCollapse={toggleSidebarLgCollapse}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header toggleSidebar={toggleSidebar} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-sap-gray dark:bg-gray-900 p-0 lg:p-6">
          {children}
        </main>
        
        {/* Container for Floating Action Buttons */}
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
            {canShowDevPanel && <DeveloperPanel />}
            {showHomeFab && (
              <button
                onClick={() => navigate(homeFabTarget)}
                className="bg-sap-blue hover:bg-sap-light-blue text-white p-4 rounded-full shadow-lg dark:bg-sap-light-blue dark:hover:bg-blue-600 transition-transform hover:scale-110"
                aria-label={homeFabTitle}
                title={homeFabTitle}
              >
                <HomeIcon className="w-8 h-8" />
              </button>
            )}
        </div>
      </div>
    </div>
  );
};

export default MainLayout;