import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { EmployeeProvider } from './contexts/EmployeeContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LogProvider } from './contexts/LogContext';
import { ToastProvider } from './contexts/ToastContext';
import { UserProvider } from './contexts/UserContext'; 
import { TheoreticalShiftProvider } from './contexts/TheoreticalShiftContext';
import { SyncProvider } from './contexts/SyncContext'; // Import SyncProvider
import { QuickNotesProvider } from './contexts/QuickNotesContext';
import { MeterReadingsProvider } from './contexts/MeterReadingsContext';
import { TimeRecordProvider } from './contexts/TimeRecordContext';
import { HashRouter } from 'react-router-dom';
import './input.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <HashRouter>
      <ToastProvider>
        <LogProvider>
          <UserProvider>
            <AuthProvider>
              <SyncProvider> {/* SyncProvider needs Auth details */}
                <EmployeeProvider>
                  <TheoreticalShiftProvider>
                    <QuickNotesProvider>
                      <MeterReadingsProvider>
                        <TimeRecordProvider>
                          <ThemeProvider>
                            <App />
                          </ThemeProvider>
                        </TimeRecordProvider>
                      </MeterReadingsProvider>
                    </QuickNotesProvider>
                  </TheoreticalShiftProvider>
                </EmployeeProvider>
              </SyncProvider>
            </AuthProvider>
          </UserProvider>
        </LogProvider>
      </ToastProvider>
    </HashRouter>
  </React.StrictMode>
);
// Provider order note:
// - ToastProvider (outermost for universal access)
// - LogProvider (needed by many contexts)
// - UserProvider (needed by AuthProvider)
// - AuthProvider (needed by SyncProvider and most of the app)
// - SyncProvider (needs auth, provides sync services to children)
// - EmployeeProvider & TheoreticalShiftProvider (core data contexts)
// - QuickNotesProvider & MeterReadingsProvider (feature-specific data)
// - TimeRecordProvider (manages time clocking data efficiently)
// - ThemeProvider (general UI)