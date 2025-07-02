import { DataTypes } from 'sequelize';

export default (sequelize) =>
  sequelize.define('DailyTimeRecord', {
    id: { type: DataTypes.STRING, primaryKey: true },
    employeeId: { type: DataTypes.STRING, allowNull: false },
    date: { type: DataTypes.STRING, allowNull: false },
    entrada: { type: DataTypes.STRING, allowNull: true },
    salida: { type: DataTypes.STRING, allowNull: true },
    entradaTimestamp: { type: DataTypes.BIGINT, allowNull: true },
    salidaTimestamp: { type: DataTypes.BIGINT, allowNull: true },
    lastModified: { type: DataTypes.BIGINT, allowNull: false },
    isDeleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    syncStatus: { type: DataTypes.ENUM('synced', 'pending', 'error'), allowNull: false, defaultValue: 'pending' },
    syncError: { type: DataTypes.STRING, allowNull: true }
  });
