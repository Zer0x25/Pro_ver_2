import { DataTypes } from 'sequelize';
import bcrypt from 'bcrypt';

export default (sequelize) => {
  const User = sequelize.define('User', {
    id: { type: DataTypes.STRING, primaryKey: true },
    username: { type: DataTypes.STRING, unique: true },
    password: { 
      type: DataTypes.STRING,
      allowNull: false,
      set(value) {
        // Hash the password before saving it
        const hashedPassword = bcrypt.hashSync(value, 10);
        this.setDataValue('password', hashedPassword);
      }
    },
    role: { type: DataTypes.STRING }, // admin, supervisor, etc.
    employeeId: { type: DataTypes.STRING },
    lastModified: { type: DataTypes.BIGINT, allowNull: false },
    syncStatus: { type: DataTypes.ENUM('synced', 'pending', 'error'), defaultValue: 'pending' },
    isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false }
  });

  return User;
};
