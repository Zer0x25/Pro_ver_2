import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import { ROUTES } from '../../constants';
import { HomeIcon } from '../ui/icons';
import DeveloperPanel from '../ui/DeveloperPanel'; // Import the new component
import { useAuth } from '../../hooks/useAuth'; // Import useAuth to check role


interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarLgCollapsed, setIsSidebarLgCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth(); // Get current user details

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const toggleSidebarLgCollapse = () => {
    setIsSidebarLgCollapsed(prev => !prev);
  };
  
  const showHomeFab = location.pathname !== ROUTES.DASHBOARD;

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
            {currentUser?.role === 'Administrador' && <DeveloperPanel />}
            {showHomeFab && (
              <button
                onClick={() => navigate(ROUTES.DASHBOARD)}
                className="bg-sap-blue hover:bg-sap-light-blue text-white p-4 rounded-full shadow-lg dark:bg-sap-light-blue dark:hover:bg-blue-600 transition-transform hover:scale-110"
                aria-label="Ir al Dashboard"
                title="Ir al Dashboard"
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
