import React, { useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useEmployees } from '../../contexts/EmployeeContext';
import { APP_TITLE } from '../../constants';
import Button from '../ui/Button';
import { UserCircleIcon, LogoutIcon, MenuIcon } from '../ui/icons';
import SyncStatus from '../ui/SyncStatus'; // Import the new component

interface HeaderProps {
  toggleSidebar: () => void;
}

const Header: React.FC<HeaderProps> = ({ toggleSidebar }) => {
  const { currentUser, logout } = useAuth();
  const { employees } = useEmployees();

  const welcomeName = useMemo(() => {
    if (currentUser?.employeeId) {
      const employee = employees.find(e => e.id === currentUser.employeeId);
      if (employee) {
        return employee.name;
      }
    }
    return currentUser?.username;
  }, [currentUser, employees]);

  return (
    <header className="bg-sap-blue text-white shadow-md dark:bg-gray-800 dark:border-b dark:border-gray-700">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center">
          <button 
            onClick={toggleSidebar} 
            className="mr-3 text-white hover:text-gray-200 lg:hidden"
            aria-label="Toggle sidebar"
          >
            <MenuIcon className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-semibold">{APP_TITLE}</h1>
        </div>
        <div className="flex items-center space-x-4">
          <SyncStatus />
          {currentUser && (
            <div className="flex items-center">
              <UserCircleIcon className="w-7 h-7 mr-2" />
              <span className="hidden sm:inline" title={currentUser.username}>Bienvenido, {welcomeName}</span>
            </div>
          )}
          <Button 
            onClick={logout} 
            variant="secondary" 
            size="sm" 
            className="bg-sap-light-blue hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            <LogoutIcon className="w-5 h-5 mr-1 inline" />
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
