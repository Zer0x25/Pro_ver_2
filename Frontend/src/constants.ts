

export const ROUTES = {
  LOGIN: '/',
  DASHBOARD: '/dashboard', // The default user dashboard
  SUPERVISOR_DASHBOARD: '/dashboard-supervisor', // The dashboard for supervisors
  TIME_CONTROL: '/time-control',
  LOGBOOK: '/logbook',
  CONFIGURATION: '/configuration',
  USER_MANAGEMENT: '/user-management', 
  EMPLOYEE_MANAGEMENT: '/employee-management', // New route for employee management
  THEORETICAL_SHIFTS: '/theoretical-shifts',
  SHIFT_CALENDAR: '/shift-calendar', // New route for the dedicated calendar page
  REPORTS: '/reports', // New route for the reports center
  COMMUNICATIONS: '/communications', // New route for internal communications
};

export const APP_TITLE = "Portal Control Interno";

// LocalStorage and SessionStorage Keys
export const STORAGE_KEYS = {
  // LocalStorage
  THEME: 'app-theme',
  DEV_MODE: 'devModeEnabled',
  TIME_CONTROL_CLOCK_FORMAT: 'timecontrol-clockformat',
  LAST_SYNC_TIMESTAMP: 'lastSyncTimestamp',
  LAST_QUICK_NOTES_VIEW_TIMESTAMP: 'lastQuickNotesViewTimestamp',
  
  // SessionStorage
  CURRENT_USER: 'currentUser',
  AUTO_LOGIN_ACTIONS_DONE: 'autoLoginActionsDone',
  TRIGGER_AUTO_CLOSE_SHIFT: 'triggerAutoCloseShift',
};