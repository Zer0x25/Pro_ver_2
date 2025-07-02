import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { User } from '../models/index.js';
import crypto from 'crypto';

dotenv.config();
const router = express.Router();

router.post('/', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ where: { username } });

  if (!user || user.isDeleted) return res.status(401).json({ error: 'Credenciales inválidas' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Credenciales inválidas' });

  const token = jwt.sign(
    { userId: user.id, role: user.role, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );

  res.json({ token });
});

router.post('/register', async (req, res) => {
  const { username, password, role, employeeId } = req.body;

  if (!username || !password || !role) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  try {
    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return res.status(409).json({ error: 'El nombre de usuario ya existe' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      id: crypto.randomUUID(),
      username,
      password: hashedPassword,
      role,
      employeeId,
      lastModified: Date.now(),
      syncStatus: 'synced'
    });

    res.status(201).json({ message: 'Usuario creado exitosamente', userId: newUser.id });
  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
