

import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ROUTES, APP_TITLE } from '../../constants';
import { 
  HomeIcon, ClockIcon, BookOpenIcon, CogIcon, SunIcon, MoonIcon, 
  InformationCircleIcon, UsersIcon, CalendarDaysIcon, ChevronDoubleLeftIcon, 
  ChevronDoubleRightIcon, ClipboardIcon, DocumentChartBarIcon
} from '../ui/icons';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import AboutModal from '../ui/AboutModal';

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
  isLgCollapsed: boolean;
  toggleLgCollapse: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, toggleSidebar, isLgCollapsed, toggleLgCollapse }) => {
  const { effectiveTheme, toggleTheme } = useTheme();
  const { currentUser } = useAuth();
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // The sidebar is visually collapsed only if it's set to be collapsed AND the user is not hovering over it.
  const isEffectivelyCollapsed = isLgCollapsed && !isHovered;

  const supervisorRoles = ['Supervisor', 'Administrador', 'Usuario Elevado'];
  const isElevatedRole = currentUser && supervisorRoles.includes(currentUser.role);
  const isAdminOrElevated = currentUser && (currentUser.role === 'Administrador' || currentUser.role === 'Usuario Elevado');

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-sap-gray dark:hover:bg-gray-700 hover:text-sap-blue dark:hover:text-white rounded-md transition-colors duration-150 ${isEffectivelyCollapsed ? 'lg:justify-center' : ''} ${
      isActive ? 'bg-sap-gray dark:bg-gray-700 text-sap-blue dark:text-white font-semibold' : ''
    }`;
    
  const handleLinkClick = () => {
    // For small screens, close the sidebar overlay
    if (isOpen && window.innerWidth < 1024) { 
        toggleSidebar();
    }
  };

  const iconClasses = `flex-shrink-0 w-5 h-5 ${isEffectivelyCollapsed ? 'lg:mr-0' : 'mr-3'}`;
  const textClasses = `whitespace-nowrap ${isEffectivelyCollapsed ? 'lg:hidden' : 'lg:block'}`;

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black opacity-50 lg:hidden"
          onClick={toggleSidebar}
          aria-hidden="true"
        ></div>
      )}
      <aside 
        className={`fixed inset-y-0 left-0 z-40 bg-white dark:bg-sap-dark-gray shadow-lg transform ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 lg:static lg:inset-0 transition-all duration-300 ease-in-out flex flex-col ${
          isEffectivelyCollapsed ? 'lg:w-20' : 'lg:w-64'
        }`}
        aria-label="Main navigation"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex items-center justify-center h-16 border-b border-sap-border dark:border-gray-700 lg:hidden">
           <span className="text-xl font-semibold text-sap-blue dark:text-sap-light-blue">{APP_TITLE}</span>
        </div>
        
        <nav className="flex-grow py-4 px-2 overflow-y-auto">
          <ul>
            {/* User dashboard link, hidden for Supervisor role */}
            {currentUser?.role !== 'Supervisor' && (
              <li>
                <NavLink to={ROUTES.DASHBOARD} className={navLinkClass} onClick={handleLinkClick} end>
                  <HomeIcon className={iconClasses} />
                  <span className={textClasses}>Dashboard</span>
                </NavLink>
              </li>
            )}
            
            {/* Supervisor/Admin/Elevated dashboard link */}
            {isElevatedRole && (
               <li>
                 <NavLink to={ROUTES.SUPERVISOR_DASHBOARD} className={navLinkClass} onClick={handleLinkClick} end>
                   <ClipboardIcon className={iconClasses} />
                   <span className={textClasses}>
                     {currentUser?.role === 'Supervisor' ? 'Dashboard' : 'Supervisión'}
                   </span>
                 </NavLink>
               </li>
            )}

            <li>
              <NavLink to={ROUTES.TIME_CONTROL} className={navLinkClass} onClick={handleLinkClick}>
                <ClockIcon className={iconClasses} />
                 <span className={textClasses}>Control de Horario</span>
              </NavLink>
            </li>
            {(currentUser?.role === 'Administrador' || currentUser?.role === 'Usuario Elevado' || currentUser?.role === 'Usuario') && (
              <li>
                <NavLink to={ROUTES.LOGBOOK} className={navLinkClass} onClick={handleLinkClick}>
                  <BookOpenIcon className={iconClasses} />
                  <span className={textClasses}>Libro de Novedades</span>
                </NavLink>
              </li>
            )}
            {/* New link for all users */}
            <li>
              <NavLink to={ROUTES.SHIFT_CALENDAR} className={navLinkClass} onClick={handleLinkClick}>
                <CalendarDaysIcon className={iconClasses} />
                <span className={textClasses}>Calendario de Turnos</span>
              </NavLink>
            </li>
            {isElevatedRole && (
              <>
                <li>
                  <NavLink to={ROUTES.REPORTS} className={navLinkClass} onClick={handleLinkClick}>
                    <DocumentChartBarIcon className={iconClasses} />
                    <span className={textClasses}>Centro de Reportes</span>
                  </NavLink>
                </li>
                <li>
                  <NavLink to={ROUTES.THEORETICAL_SHIFTS} className={navLinkClass} onClick={handleLinkClick}>
                    <CalendarDaysIcon className={iconClasses} />
                    <span className={textClasses}>Gestión de Turnos</span>
                  </NavLink>
                </li>
                <li>
                  <NavLink to={ROUTES.EMPLOYEE_MANAGEMENT} className={navLinkClass} onClick={handleLinkClick}>
                    <UsersIcon className={iconClasses} />
                    <span className={textClasses}>Gestión de Empleados</span>
                  </NavLink>
                </li>
              </>
            )}
             {isAdminOrElevated && (
              <li>
                <NavLink to={ROUTES.USER_MANAGEMENT} className={navLinkClass} onClick={handleLinkClick}>
                  <UsersIcon className={iconClasses} />
                  <span className={textClasses}>Gestión de Usuarios</span>
                </NavLink>
              </li>
            )}
            <li>
              <NavLink to={ROUTES.CONFIGURATION} className={navLinkClass} onClick={handleLinkClick}>
                <CogIcon className={iconClasses} />
                <span className={textClasses}>Configuración</span>
              </NavLink>
            </li>
          </ul>
        </nav>

        <div className="px-2 py-3 border-t border-sap-border dark:border-gray-700">
           <button
            onClick={toggleTheme}
            className={`flex items-center w-full px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-sap-gray dark:hover:bg-gray-700 hover:text-sap-blue dark:hover:text-white rounded-md transition-colors duration-150 ${isEffectivelyCollapsed ? 'lg:justify-center' : ''}`}
            title={effectiveTheme === 'dark' ? "Cambiar a Tema Claro" : "Cambiar a Tema Oscuro"}
          >
            {effectiveTheme === 'dark' ? <SunIcon className={iconClasses} /> : <MoonIcon className={iconClasses} />}
            <span className={textClasses}>
              {effectiveTheme === 'dark' ? "Tema Claro" : "Tema Oscuro"}
            </span>
          </button>
          
          <button 
            onClick={() => { setShowAboutModal(true); handleLinkClick(); }}
            className={`flex items-center w-full px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-sap-gray dark:hover:bg-gray-700 hover:text-sap-blue dark:hover:text-white rounded-md transition-colors duration-150 ${isEffectivelyCollapsed ? 'lg:justify-center' : ''}`}
            title="Acerca de la aplicación"
          >
            <InformationCircleIcon className={iconClasses} />
            <span className={textClasses}>Acerca de</span>
          </button>
        </div>

        {/* --- Sidebar Collapse Toggle Button --- */}
        <div className="hidden lg:flex items-center justify-center py-2 border-t border-sap-border dark:border-gray-700">
            <button
                onClick={toggleLgCollapse}
                className="p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-sap-gray dark:hover:bg-gray-700"
                title={isLgCollapsed ? "Expandir panel" : "Colapsar panel"}
                aria-label={isLgCollapsed ? "Expandir panel lateral" : "Colapsar panel lateral"}
            >
                {isLgCollapsed ? <ChevronDoubleRightIcon className="w-5 h-5" /> : <ChevronDoubleLeftIcon className="w-5 h-5" />}
            </button>
        </div>
      </aside>
      <AboutModal isOpen={showAboutModal} onClose={() => setShowAboutModal(false)} />
    </>
  );
};

export default Sidebar;