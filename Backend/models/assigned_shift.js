import { DataTypes } from 'sequelize';

export default (sequelize) =>
  sequelize.define('AssignedShift', {
    id: { type: DataTypes.STRING, primaryKey: true },
    employeeId: { type: DataTypes.STRING, allowNull: false },
    shiftPatternId: { type: DataTypes.STRING, allowNull: false },
    startDate: { type: DataTypes.STRING, allowNull: false },
    endDate: { type: DataTypes.STRING, allowNull: true },
    lastModified: { type: DataTypes.BIGINT, allowNull: false },
    isDeleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    syncStatus: { type: DataTypes.ENUM('synced', 'pending', 'error'), allowNull: false, defaultValue: 'pending' },
    syncError: { type: DataTypes.STRING, allowNull: true }
  });
