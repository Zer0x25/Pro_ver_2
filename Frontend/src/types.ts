


import { Dispatch, SetStateAction } from 'react';

export type UserRole = 'Usuario' | 'Supervisor' | 'Administrador' | 'Usuario Elevado';

export interface Syncable {
  lastModified: number; // Unix timestamp in ms
  syncStatus: 'synced' | 'pending' | 'error';
  isDeleted: boolean;
  syncError?: string; // To store the error message from the backend
}

export interface User extends Syncable {
  id: string;
  username: string;
  password?: string; // Optional because hardcoded admin might not have it from DB
  role: UserRole;
  employeeId?: string; // Link to an Employee record
}

export interface Employee extends Syncable {
  id: string; // e.g., EMP001
  name: string;
  rut?: string; // RUT Chileno
  position: string; // Cargo
  area: string;
  isActive: boolean;
}

export interface DailyTimeRecord extends Syncable {
  id: string; // Now a unique UUID for each clocking event
  employeeId: string;
  employeeName: string;
  employeePosition: string;
  employeeArea: string;
  date: string;         // YYYY-MM-DD (Date of the 'entrada', or 'salida' if entrada is SIN REGISTRO)
  entrada?: string | "SIN REGISTRO";     // YYYY-MM-DDTHH:mm or "SIN REGISTRO"
  salida?: string | "SIN REGISTRO";      // YYYY-MM-DDTHH:mm or "SIN REGISTRO"
  entradaTimestamp?: number | null; // Can be null if entrada is "SIN REGISTRO"
  salidaTimestamp?: number | null; // Can be null if salida is "SIN REGISTRO"
}

export interface AppSetting extends Syncable {
  id: string; // Name of the setting/counter, e.g., 'employeeIdCounter'
  value: any;
}

export interface EmployeeContextType {
  employees: Employee[]; // All non-deleted employees
  activeEmployees: Employee[]; // Only active and non-deleted employees
  isLoadingEmployees: boolean;
  addEmployee: (employeeData: Omit<Employee, 'id' | 'isActive' | keyof Syncable>) => Promise<Employee | null>;
  updateEmployee: (employeeData: Employee) => Promise<boolean>;
  toggleEmployeeStatus: (employeeId: string) => Promise<boolean>; 
  softDeleteEmployee: (employeeId: string, actorUsername: string) => Promise<boolean>;
  getEmployeeById: (employeeId: string) => Employee | undefined;
  getNextEmployeeId: () => Promise<string>;
}

// Tipos para el nuevo LogbookPage
export interface LogbookEntryItem {
  id: string; // unique within the shift report
  time: string; // HH:mm
  annotation: string;
  timestamp: number; // for sorting
}

export interface SupplierEntry {
  id: string; // unique within the shift report
  time: string; // HH:mm
  licensePlate: string;
  driverName: string;
  paxCount: number;
  company: string;
  reason: string;
  timestamp: number; // for sorting
}

export interface ShiftReport extends Syncable {
  id: string; // unique, e.g., timestamp-based or UUID
  folio: string; // e.g., "T20240521-001"
  date: string; // YYYY-MM-DD (start date of shift)
  shiftName: string; // e.g., "Mañana", "Tarde", "Noche"
  responsibleUser: string; // Username of the person starting the shift
  startTime: string; // ISO string
  endTime?: string; // ISO string, set when shift is closed
  status: 'open' | 'closed';
  logEntries: LogbookEntryItem[];
  supplierEntries: SupplierEntry[];
}

// Theme types
export type Theme = 'system' | 'light' | 'dark';

export interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  effectiveTheme: 'light' | 'dark'; // The actual theme being applied (light or dark)
  toggleTheme: () => void;
}

// Audit Log types
export interface AuditLog extends Syncable {
  id: string; // timestamp-random string
  timestamp: string; // ISO string
  actorUsername: string; // Username of the user performing the action
  action: string; // Description of the action
  details?: Record<string, any>; // Optional JSON object for more details
}

export interface LogContextType {
  logs: AuditLog[];
  isLoadingLogs: boolean;
  addLog: (actorUsername: string, action: string, details?: Record<string, any>) => Promise<void>;
  clearAllLogs: () => Promise<void>;
  loadLogs: () => Promise<void>; // Added for deferred loading
}

// User Management types
export interface UserContextType {
  users: User[];
  isLoadingUsers: boolean;
  addUser: (userData: Omit<User, 'id' | keyof Syncable>, actorUsername: string) => Promise<User | null>;
  updateUser: (userId: string, data: Partial<Omit<User, 'id' | keyof Syncable>>, actorUsername: string) => Promise<boolean>;
  deleteUser: (userId: string, actorUsername: string) => Promise<boolean>;
  getUserById: (userId: string) => User | undefined;
  getUserByUsername: (username: string) => User | undefined;
}

// Theoretical Shifts Types
export interface DayInCycleSchedule {
  dayIndex: number; // 0 to cycleLengthDays - 1
  startTime?: string; // HH:MM, optional if isOffDay is true
  endTime?: string;   // HH:MM, optional if isOffDay is true
  isOffDay: boolean;
  hasColacion: boolean; 
  colacionMinutes: number; 
  hours?: number; // Calculated hours for display (net hours after colacion)
}

export interface TheoreticalShiftPattern extends Syncable {
  id: string; // UUID
  name: string;
  cycleLengthDays: number; // e.g., 7 for weekly, 14 for bi-weekly
  startDayOfWeek?: number; // 1 for Monday, 7 for Sunday. Optional for backward compatibility.
  dailySchedules: DayInCycleSchedule[]; // Array defining schedule for each day in the cycle
  color?: string; // Optional hex color string for the pattern
  maxHoursPattern?: number; // Optional pattern-specific max weekly hours
}

export interface AssignedShift extends Syncable {
  id: string; // UUID
  employeeId: string;
  employeeName?: string; // For display purposes, denormalized
  shiftPatternId: string;
  shiftPatternName?: string; // For display purposes, denormalized
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD, Optional end date for the assignment
}

export interface ScheduledEmployeeDetail { // For multi-employee calendar view
  employeeId: string;
  employeeName: string;
  shiftPatternName: string;
  startTime?: string;
  endTime?: string;
  patternColor?: string; // Color of the shift pattern
}

export interface EmployeeDailyScheduleInfo { // For single-employee calendar view and detailed list
  scheduleText: string;
  isWorkDay: boolean;
  startTime?: string;
  endTime?: string;
  hours?: number;
  shiftPatternName?: string;
  patternColor?: string; // Color of the shift pattern
  hasColacion?: boolean;
  colacionMinutes?: number;
}

export interface EmployeeWithShiftDetails extends Employee {
  assignedShiftsDetails: Array<AssignedShift & {
    patternDetails?: TheoreticalShiftPattern; // Enriched pattern
  }>;
}

export interface MonthlyDayScheduleView { // For list view by month
  dateIso: string;       // YYYY-MM-DD
  dayOfWeek: string;     // e.g., "Lunes", "Martes"
  dayOfMonth: number;    // e.g., 26
  scheduleText: string;  // e.g., "Jueves 26 - 08:00 a 17:00 (9.00 hrs)" or "Jueves 26 - Libre"
  isWorkDay: boolean;
}

export interface MeterConfig {
  id: string;
  label: string;
}

export interface TheoreticalShiftContextType {
  globalMaxWeeklyHours: number; 
  areaList: string[];
  meterConfigs: MeterConfig[];
  shiftPatterns: TheoreticalShiftPattern[]; // Enriched with hours and color
  assignedShifts: AssignedShift[]; // Enriched with names
  isLoadingShifts: boolean;
  addShiftPattern: (
    patternData: Omit<TheoreticalShiftPattern, 'id' | 'dailySchedules' | keyof Syncable> & { dailySchedules: Omit<DayInCycleSchedule, 'hours'>[] }, 
    actorUsername: string
  ) => Promise<TheoreticalShiftPattern | null>;
  updateShiftPattern: (
    patternData: Omit<TheoreticalShiftPattern, 'dailySchedules' | keyof Syncable> & { dailySchedules: Omit<DayInCycleSchedule, 'hours'>[] }, 
    actorUsername: string
  ) => Promise<boolean>;
  deleteShiftPattern: (patternId: string, actorUsername: string) => Promise<boolean>;
  getShiftPatternById: (patternId: string) => TheoreticalShiftPattern | undefined;
  assignShiftToEmployee: (assignmentData: Omit<AssignedShift, 'id' | 'employeeName' | 'shiftPatternName' | keyof Syncable>, actorUsername: string) => Promise<AssignedShift | null>;
  updateAssignedShift: (assignmentData: Omit<AssignedShift, 'employeeName' | 'shiftPatternName' | keyof Syncable>, actorUsername: string) => Promise<boolean>;
  deleteAssignedShift: (assignmentId: string, actorUsername: string) => Promise<boolean>;
  getAssignedShiftsByEmployee: (employeeId: string) => AssignedShift[];
  calculateAverageWeeklyHoursForEmployee: (
    employeeId: string, 
    newAssignment?: Omit<AssignedShift, 'id' | 'employeeName' | 'shiftPatternName' | keyof Syncable>,
    assignmentToExcludeId?: string
  ) => number;
  isEmployeeScheduledOnDate: ( // For multi-employee calendar view (summary check)
    employeeId: string,
    targetDate: Date,
  ) => { scheduled: boolean, shiftPatternName?: string, startTime?: string, endTime?: string, patternColor?: string };
  getScheduledEmployeesDetailsOnDate: (targetDate: Date) => ScheduledEmployeeDetail[]; // For multi-employee calendar view (summary)
  getEmployeesWithAssignedShifts: () => EmployeeWithShiftDetails[];
  calculateHoursBetween: (startTime?: string, endTime?: string, breakMinutes?: number) => number;
  getEmployeeScheduleForMonth: (employeeId: string, year: number, month: number) => MonthlyDayScheduleView[]; // For list view by month
  getEmployeeDailyScheduleInfo: (employeeId: string, targetDate: Date) => EmployeeDailyScheduleInfo | null; // For single-employee detailed calendar view & list
  updateGlobalMaxWeeklyHours: (newMaxHours: number, actorUsername: string) => Promise<void>;
  updateAreaList: (newAreas: string[], actorUsername: string) => Promise<void>;
  updateMeterConfigs: (newConfigs: MeterConfig[], actorUsername: string) => Promise<void>;
}

export type SyncState = 'idle' | 'syncing' | 'success' | 'error' | 'no-network';

export interface SyncContextType {
  syncState: SyncState;
  lastSyncTime: number | null;
  conflicts: any[];
  runSync: () => Promise<void>;
  runBootstrap: () => Promise<void>;
}

// --- New Types for Dashboard Features ---

export interface QuickNote extends Syncable {
  id: string;
  content: string;
  authorUsername: string;
  createdAt: number; // Unix timestamp
}

export interface QuickNotesContextType {
  notes: QuickNote[];
  isLoadingNotes: boolean;
  addNote: (content: string) => Promise<QuickNote | null>;
  deleteNote: (noteId: string) => Promise<boolean>;
}

export interface MeterReadingItem {
  meterConfigId: string;
  label: string;
  value: number;
}

export interface MeterReading extends Syncable {
  id: string; // UUID of the reading entry
  timestamp: number; // Unix timestamp of when it was recorded
  authorUsername: string;
  readings: MeterReadingItem[];
}

export interface MeterReadingsContextType {
    readings: MeterReading[];
    isLoadingReadings: boolean;
    addReading: (readings: Omit<MeterReadingItem, 'label'>[]) => Promise<MeterReading | null>;
}

export interface TimeRecordContextType {
  dailyRecords: DailyTimeRecord[];
  isLoadingRecords: boolean;
  allRecordsLoaded: boolean; // To track if the full history is loaded
  addOrUpdateRecord: (record: DailyTimeRecord) => Promise<boolean>;
  deleteRecordById: (recordId: string) => Promise<boolean>;
  loadAllRecords: () => Promise<void>; // Function to load the full history
}