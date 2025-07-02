import { DataTypes } from 'sequelize';

export default (sequelize) =>
  sequelize.define('AuditLog', {
    id: { type: DataTypes.STRING, primaryKey: true },
    timestamp: { type: DataTypes.BIGINT, allowNull: false },
    actorUsername: { type: DataTypes.STRING, allowNull: false },
    action: { type: DataTypes.STRING, allowNull: false },
    details: { type: DataTypes.TEXT, allowNull: true }
  });
