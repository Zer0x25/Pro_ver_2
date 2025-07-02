import express from 'express';
import auth from '../middleware/auth.js';
import {
  Employee,
  User,
  DailyTimeRecord,
  TheoreticalShiftPattern,
  AssignedShift,
  ShiftReport,
  AppSetting,
  AuditLog
} from '../models/index.js';

const router = express.Router();

// Utilidad para comparar timestamps y resolver conflictos
function isServerWinner(serverRecord, clientRecord) {
  return serverRecord && serverRecord.lastModified > clientRecord.lastModified;
}

router.post('/sync', auth, async (req, res) => {
  // LOG: Ver el payload recibido
  console.log('SYNC PAYLOAD:', JSON.stringify(req.body, null, 2));
  const { lastSyncTimestamp, changes = {}, auditLogs = [] } = req.body;
  const updates = {};
  const conflicts = [];
  const errors = [];

  // Procesar cambios de cada entidad
  for (const [entity, records] of Object.entries(changes)) {
    updates[entity] = [];
    for (const record of records) {
      let Model;
      switch (entity) {
        case 'employees': Model = Employee; break;
        case 'users': Model = User; break;
        case 'daily_time_records': Model = DailyTimeRecord; break;
        case 'theoretical_shift_patterns': Model = TheoreticalShiftPattern; break;
        case 'assigned_shifts': Model = AssignedShift; break;
        case 'shift_reports': Model = ShiftReport; break;
        case 'app_settings': Model = AppSetting; break;
        default: continue;
      }
      try {
        // Validación especial para empleados con nombre "Error"
        if (entity === 'employees' && record.name && record.name.includes('Error')) {
          errors.push({ clientRecordId: record.id, message: 'Nombre inválido: contiene "Error".' });
          continue;
        }
        // Buscar registro existente
        const serverRecord = await Model.findByPk(record.id);
        if (serverRecord) {
          if (isServerWinner(serverRecord, record)) {
            conflicts.push({ clientRecordId: record.id, message: 'Registro actualizado con la versión del servidor, que era más reciente.' });
            updates[entity].push(serverRecord.toJSON());
            continue;
          }
          // Actualizar registro
          await serverRecord.update(record);
          updates[entity].push(serverRecord.toJSON());
        } else {
          // Crear nuevo registro
          await Model.create(record);
          updates[entity].push(record);
        }
      } catch (e) {
        // LOG: Error al guardar registro
        console.error('Error guardando registro en', entity, 'ID:', record.id, e.message, record);
        errors.push({ clientRecordId: record.id, message: e.message });
      }
    }
  }

  // Guardar logs de auditoría y devolver sus IDs para marcar como sincronizados
  let auditLogIds = [];
  for (const log of auditLogs) {
    try {
      await AuditLog.create(log);
      auditLogIds.push(log.id);
    } catch { /* ignorar errores de logs */ }
  }
  updates.auditLogs = auditLogIds.map(id => ({ id }));

  // Buscar cambios en el servidor desde lastSyncTimestamp
  for (const entity of Object.keys(changes)) {
    let Model;
    switch (entity) {
      case 'employees': Model = Employee; break;
      case 'users': Model = User; break;
      case 'daily_time_records': Model = DailyTimeRecord; break;
      case 'theoretical_shift_patterns': Model = TheoreticalShiftPattern; break;
      case 'assigned_shifts': Model = AssignedShift; break;
      case 'shift_reports': Model = ShiftReport; break;
      case 'app_settings': Model = AppSetting; break;
      default: continue;
    }
    const changed = await Model.findAll({ where: { lastModified: { $gt: lastSyncTimestamp } } });
    for (const rec of changed) {
      if (!updates[entity].find(r => r.id === rec.id)) {
        updates[entity].push(rec.toJSON());
      }
    }
  }

  res.json({
    newSyncTimestamp: Date.now(),
    updates,
    conflicts,
    errors
  });
});

// Endpoint de carga inicial de datos (bootstrap)
router.get('/bootstrap', auth, async (req, res) => {
  try {
    // Puedes filtrar por rol si es necesario (ejemplo: req.user.role)
    const [employees, users, daily_time_records, theoretical_shift_patterns, assigned_shifts, app_settings] = await Promise.all([
      Employee.findAll({ where: { isDeleted: false } }),
      User.findAll({ where: { isDeleted: false } }),
      DailyTimeRecord.findAll({ where: { isDeleted: false } }),
      TheoreticalShiftPattern.findAll({ where: { isDeleted: false } }),
      AssignedShift.findAll({ where: { isDeleted: false } }),
      AppSetting.findAll({ where: { isDeleted: false } })
    ]);
    res.json({
      newSyncTimestamp: Date.now(),
      data: {
        employees,
        users,
        daily_time_records,
        theoretical_shift_patterns,
        assigned_shifts,
        app_settings
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
