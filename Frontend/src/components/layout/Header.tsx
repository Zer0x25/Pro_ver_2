import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useEmployees } from '../../contexts/EmployeeContext';
import { APP_TITLE } from '../../constants';
import Button from '../ui/Button';
import { UserCircleIcon, LogoutIcon, MenuIcon } from '../ui/icons';
import SyncStatus from '../ui/SyncStatus';
import ChangePasswordModal from '../ui/ChangePasswordModal';
import UserManualModal from '../ui/UserManualModal';

interface HeaderProps {
  toggleSidebar: () => void;
}

const Header: React.FC<HeaderProps> = ({ toggleSidebar }) => {
  const { currentUser, logout } = useAuth();
  const { employees } = useEmployees();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
    <>
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
              <div className="relative" ref={dropdownRef}>
                <button 
                  onClick={() => setIsDropdownOpen(prev => !prev)}
                  className="flex items-center cursor-pointer p-2 rounded-md hover:bg-white/10"
                  aria-haspopup="true"
                  aria-expanded={isDropdownOpen}
                >
                  <UserCircleIcon className="w-7 h-7 mr-2" />
                  <span className="hidden sm:inline" title={currentUser.username}>Bienvenido, {welcomeName}</span>
                </button>
                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 focus:outline-none z-20">
                    <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                      <button
                        onClick={() => {
                          setIsChangePasswordModalOpen(true);
                          setIsDropdownOpen(false);
                        }}
                        className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                        role="menuitem"
                      >
                        Cambio de Contraseña
                      </button>
                      <button
                        onClick={() => {
                          setIsManualModalOpen(true);
                          setIsDropdownOpen(false);
                        }}
                        className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                        role="menuitem"
                      >
                        Manual
                      </button>
                    </div>
                  </div>
                )}
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
      <ChangePasswordModal isOpen={isChangePasswordModalOpen} onClose={() => setIsChangePasswordModalOpen(false)} />
      <UserManualModal isOpen={isManualModalOpen} onClose={() => setIsManualModalOpen(false)} />
    </>
  );
};

export default Header;