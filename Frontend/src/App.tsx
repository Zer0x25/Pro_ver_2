import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

const LoginPage = React.lazy(() => import('./components/pages/LoginPage'));
const DashboardPage = React.lazy(() => import('./components/pages/DashboardPage'));
const SupervisorDashboardPage = React.lazy(() => import('./components/pages/SupervisorDashboardPage'));
const TimeControlPage = React.lazy(() => import('./components/pages/TimeControlPage'));
const LogbookPage = React.lazy(() => import('./components/pages/LogbookPage'));
const ConfigurationPage = React.lazy(() => import('./components/pages/ConfigurationPage'));
const UserManagementPage = React.lazy(() => import('./components/pages/UserManagementPage'));
const EmployeeManagementPage = React.lazy(() => import('./components/pages/EmployeeManagementPage'));
const TheoreticalShiftsPage = React.lazy(() => import('./components/pages/TheoreticalShiftsPage'));
const ShiftCalendarPage = React.lazy(() => import('./components/pages/ShiftCalendarPage'));
const CommunicationsPage = React.lazy(() => import('./components/pages/CommunicationsPage'));
const ReportsPage = React.lazy(() => import('./components/pages/ReportsPage'));

import ProtectedRoute from './router/ProtectedRoute';
import MainLayout from './components/layout/MainLayout';
import ToastContainer from './components/layout/ToastContainer';
import { ROUTES } from './constants';

const App: React.FC = () => {
  return (
    <>
      <ToastContainer />
      <Suspense fallback={<div>Cargando...</div>}>
        <Routes>
          <Route path={ROUTES.LOGIN} element={<LoginPage />} />
          {/* The default dashboard, now protected to exclude Supervisors */}
          <Route 
            path={ROUTES.DASHBOARD}
            element={
              <ProtectedRoute requiredRoles={['Usuario', 'Administrador', 'Usuario Elevado']}>
                <MainLayout>
                  <DashboardPage />
                </MainLayout>
              </ProtectedRoute>
            } 
          />
          {/* A dedicated route for the supervisor dashboard, accessible by elevated roles */}
          <Route 
            path={ROUTES.SUPERVISOR_DASHBOARD}
            element={
              <ProtectedRoute requiredRoles={['Supervisor', 'Administrador', 'Usuario Elevado']}>
                <MainLayout>
                  <SupervisorDashboardPage />
                </MainLayout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path={ROUTES.TIME_CONTROL}
            element={
              <ProtectedRoute>
                <MainLayout>
                  <TimeControlPage />
                </MainLayout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path={ROUTES.LOGBOOK}
            element={
              <ProtectedRoute requiredRoles={['Administrador', 'Usuario Elevado', 'Usuario']}>
                <MainLayout>
                  <LogbookPage />
                </MainLayout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path={ROUTES.CONFIGURATION}
            element={
              <ProtectedRoute>
                <MainLayout>
                  <ConfigurationPage />
                </MainLayout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path={ROUTES.USER_MANAGEMENT}
            element={
              <ProtectedRoute requiredRoles={['Administrador', 'Usuario Elevado']}>
                <MainLayout>
                  <UserManagementPage />
                </MainLayout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path={ROUTES.EMPLOYEE_MANAGEMENT}
            element={
              <ProtectedRoute requiredRoles={['Administrador', 'Supervisor', 'Usuario Elevado']}>
                <MainLayout>
                  <EmployeeManagementPage />
                </MainLayout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path={ROUTES.THEORETICAL_SHIFTS}
            element={
              <ProtectedRoute requiredRoles={['Administrador', 'Supervisor', 'Usuario Elevado']}>
                <MainLayout>
                  <TheoreticalShiftsPage />
                </MainLayout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path={ROUTES.SHIFT_CALENDAR}
            element={
              <ProtectedRoute>
                <MainLayout>
                  <ShiftCalendarPage />
                </MainLayout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path={ROUTES.REPORTS}
            element={
              <ProtectedRoute requiredRoles={['Administrador', 'Supervisor', 'Usuario Elevado']}>
                <MainLayout>
                  <ReportsPage />
                </MainLayout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path={ROUTES.COMMUNICATIONS}
            element={
              <ProtectedRoute>
                <MainLayout>
                  <CommunicationsPage />
                </MainLayout>
              </ProtectedRoute>
            } 
          />
          <Route path="*" element={<Navigate to={ROUTES.LOGIN} />} />
        </Routes>
      </Suspense>
    </>
  );
};

export default App;