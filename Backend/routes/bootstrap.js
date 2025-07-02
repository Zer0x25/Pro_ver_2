import express from 'express';
import jwt from 'jsonwebtoken';
import { User, Employee, DailyTimeRecord, TheoreticalShiftPattern, AssignedShift, AppSetting } from '../models/index.js';

const router = express.Router();

// Middleware para validar JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// GET /api/bootstrap
router.get('/bootstrap', authenticateToken, async (req, res) => {
  try {
    // Filtrado por rol si es necesario
    const [employees, users, dailyTimeRecords, theoreticalShiftPatterns, assignedShifts, appSettings] = await Promise.all([
      Employee.findAll(),
      User.findAll({ attributes: { exclude: ['password'] } }),
      DailyTimeRecord.findAll(),
      TheoreticalShiftPattern.findAll(),
      AssignedShift.findAll(),
      AppSetting.findAll()
    ]);
    res.json({
      newSyncTimestamp: Date.now(),
      data: {
        employees,
        users,
        dailyTimeRecords,
        theoreticalShiftPatterns,
        assignedShifts,
        appSettings
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener datos de bootstrap', details: err.message });
  }
});

export default router;
