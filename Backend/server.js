import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { sequelize } from './models/index.js';
import authRoutes from './routes/auth.js';
import syncRoutes from './routes/sync.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// --- Rutas API ---
app.use('/api/login', authRoutes);
app.use('/api', syncRoutes);

// --- Servir frontend desde Dist ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, '../dist');

app.use(express.static(distPath));

// SPA fallback: sirve index.html en rutas no API
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// --- Puerto y arranque ---
const PORT = process.env.PORT || 3000;

(async () => {
  try {
    await sequelize.sync({ alter: true });
    app.listen(PORT, () => {
      console.log(`✅ Backend y Frontend corriendo en: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Error iniciando servidor:', error);
  }
})();
