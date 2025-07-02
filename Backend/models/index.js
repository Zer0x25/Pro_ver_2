import sequelize from '../config/db.js';
import UserDef from './user.js';
import EmployeeDef from './employee.js';
import DailyTimeRecordDef from './daily_time_record.js';
import TheoreticalShiftPatternDef from './theoretical_shift_pattern.js';
import AssignedShiftDef from './assigned_shift.js';
import ShiftReportDef from './shift_report.js';
import AppSettingDef from './app_setting.js';
import AuditLogDef from './audit_log.js';

const User = UserDef(sequelize);
const Employee = EmployeeDef(sequelize);
const DailyTimeRecord = DailyTimeRecordDef(sequelize);
const TheoreticalShiftPattern = TheoreticalShiftPatternDef(sequelize);
const AssignedShift = AssignedShiftDef(sequelize);
const ShiftReport = ShiftReportDef(sequelize);
const AppSetting = AppSettingDef(sequelize);
const AuditLog = AuditLogDef(sequelize);

export {
  User,
  Employee,
  DailyTimeRecord,
  TheoreticalShiftPattern,
  AssignedShift,
  ShiftReport,
  AppSetting,
  AuditLog,
  sequelize
};
