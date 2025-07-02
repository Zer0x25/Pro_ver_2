import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ROUTES } from '../constants';
import { UserRole } from '../types'; 

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: UserRole[]; 
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRoles }) => {
  const { isAuthenticated, currentUser, isAuthLoading } = useAuth();

  if (isAuthLoading) {
    // Show a loading indicator while authentication status is being determined
    return (
      <div className="flex items-center justify-center h-screen bg-sap-gray dark:bg-sap-dark-gray">
        <p className="text-xl text-gray-700 dark:text-gray-300">Verificando sesión...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  // Updated logic to check against an array of roles
  if (requiredRoles && requiredRoles.length > 0 && (!currentUser || !requiredRoles.includes(currentUser.role))) {
    console.warn(`Access denied. User role ${currentUser?.role} is not in the required roles list [${requiredRoles.join(', ')}].`);
    return <Navigate to={ROUTES.DASHBOARD} replace />; 
  }

  return <>{children}</>;
};

export default ProtectedRoute;