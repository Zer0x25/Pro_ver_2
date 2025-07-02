import { DataTypes } from 'sequelize';

export default (sequelize) =>
  sequelize.define('TheoreticalShiftPattern', {
    id: { type: DataTypes.STRING, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    cycleLengthDays: { type: DataTypes.INTEGER, allowNull: false },
    color: { type: DataTypes.STRING, allowNull: true },
    maxHoursPattern: { type: DataTypes.STRING, allowNull: true },
    dailySchedules: { type: DataTypes.TEXT, allowNull: true },
    lastModified: { type: DataTypes.BIGINT, allowNull: false },
    isDeleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    syncStatus: { type: DataTypes.ENUM('synced', 'pending', 'error'), allowNull: false, defaultValue: 'pending' },
    syncError: { type: DataTypes.STRING, allowNull: true }
  });
