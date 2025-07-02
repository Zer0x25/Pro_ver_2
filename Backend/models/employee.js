import { DataTypes } from 'sequelize';

export default (sequelize) =>
  sequelize.define('Employee', {
    id: { type: DataTypes.STRING, primaryKey: true },
    name: { type: DataTypes.STRING },
    rut: { type: DataTypes.STRING },
    position: { type: DataTypes.STRING },
    area: { type: DataTypes.STRING },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    lastModified: { type: DataTypes.BIGINT, allowNull: false },
    syncStatus: { type: DataTypes.ENUM('synced', 'pending', 'error'), defaultValue: 'pending' },
    isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false }
  });
