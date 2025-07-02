import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { sequelize, User } from '../models/index.js';

(async () => {
  try {
    await sequelize.sync();

    const existing = await User.findOne({ where: { username: 'admin' } });
    if (existing) {
      console.log('⚠️ El usuario admin ya existe.');
      return process.exit(0);
    }

    const password = 'password1234'; // Cambia esto o toma desde argv
    const passwordHash = bcrypt.hashSync(password, 10);

    const admin = await User.create({
      id: crypto.randomUUID(),
      username: 'admin',
      password: passwordHash, // Almacenar la contraseña como hash
      role: 'Administrador', // Corrige el rol a mayúscula inicial
      lastModified: Date.now(),
      syncStatus: 'synced'
    });

    console.log('✅ Usuario Admin creado:', admin.username);
  } catch (err) {
    console.error('❌ Error al crear el usuario admin:', err);
  } finally {
    process.exit();
  }
})();
