import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './components/pages/LoginPage';
import DashboardPage from './components/pages/DashboardPage'; // Import DashboardPage
import TimeControlPage from './components/pages/TimeControlPage';
import LogbookPage from './components/pages/LogbookPage';
import ConfigurationPage from './components/pages/ConfigurationPage';
import UserManagementPage from './components/pages/UserManagementPage';
import TheoreticalShiftsPage from './components/pages/TheoreticalShiftsPage';
import ShiftCalendarPage from './components/pages/ShiftCalendarPage'; // Import the new page
import ProtectedRoute from './router/ProtectedRoute';
import MainLayout from './components/layout/MainLayout';
import ToastContainer from './components/layout/ToastContainer';
import { ROUTES } from './constants';

const App: React.FC = () => {
  return (
    <>
      <ToastContainer />
      <Routes>
        <Route path={ROUTES.LOGIN} element={<LoginPage />} />
        <Route 
          path={ROUTES.DASHBOARD}
          element={
            <ProtectedRoute>
              <MainLayout>
                <DashboardPage />
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
            <ProtectedRoute>
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
            <ProtectedRoute requiredRoles={['Administrador']}>
              <MainLayout>
                <UserManagementPage />
              </MainLayout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path={ROUTES.THEORETICAL_SHIFTS}
          element={
            <ProtectedRoute requiredRoles={['Administrador', 'Supervisor']}>
              <MainLayout>
                <TheoreticalShiftsPage />
              </MainLayout>
            </ProtectedRoute>
          } 
        />
        {/* New Route for the dedicated calendar, accessible to all logged-in users */}
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
        <Route path="*" element={<Navigate to={ROUTES.LOGIN} />} />
      </Routes>
    </>
  );
};

export default App;