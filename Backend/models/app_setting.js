import { DataTypes } from 'sequelize';

export default (sequelize) =>
  sequelize.define('AppSetting', {
    id: { type: DataTypes.STRING, primaryKey: true },
    value: { type: DataTypes.TEXT, allowNull: false },
    lastModified: { type: DataTypes.BIGINT, allowNull: false },
    isDeleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    syncStatus: { type: DataTypes.ENUM('synced', 'pending', 'error'), allowNull: false, defaultValue: 'pending' },
    syncError: { type: DataTypes.STRING, allowNull: true }
  });
