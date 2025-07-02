

export const ROUTES = {
  LOGIN: '/',
  DASHBOARD: '/dashboard', // New default page after login
  TIME_CONTROL: '/time-control',
  LOGBOOK: '/logbook',
  CONFIGURATION: '/configuration',
  USER_MANAGEMENT: '/user-management', 
  THEORETICAL_SHIFTS: '/theoretical-shifts',
  SHIFT_CALENDAR: '/shift-calendar', // New route for the dedicated calendar page
};

export const APP_TITLE = "Powered by Zer0x";

// LocalStorage keys for LogbookPage
export const LOGBOOK_SHIFT_REPORTS_KEY = 'logbookShiftReports';
export const LOGBOOK_FOLIO_COUNTER_KEY = 'logbookFolioCounter';