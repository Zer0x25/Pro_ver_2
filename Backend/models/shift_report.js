import { DataTypes } from 'sequelize';

export default (sequelize) =>
  sequelize.define('ShiftReport', {
    id: { type: DataTypes.STRING, primaryKey: true },
    folio: { type: DataTypes.STRING, allowNull: false },
    date: { type: DataTypes.STRING, allowNull: false },
    shiftName: { type: DataTypes.STRING, allowNull: false },
    responsibleUser: { type: DataTypes.STRING, allowNull: false },
    startTime: { type: DataTypes.STRING, allowNull: true },
    endTime: { type: DataTypes.STRING, allowNull: true },
    status: { type: DataTypes.STRING, allowNull: true },
    logEntries: { type: DataTypes.TEXT, allowNull: true },
    supplierEntries: { type: DataTypes.TEXT, allowNull: true },
    lastModified: { type: DataTypes.BIGINT, allowNull: false },
    isDeleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    syncStatus: { type: DataTypes.ENUM('synced', 'pending', 'error'), allowNull: false, defaultValue: 'pending' },
    syncError: { type: DataTypes.STRING, allowNull: true }
  });
