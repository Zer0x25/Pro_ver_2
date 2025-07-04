import React, { useCallback } from 'react';
import { ShiftReport } from '../../types';
import { useUsers } from '../../hooks/useUsers';
import { useEmployees } from '../../contexts/EmployeeContext';
import { exportShiftReportToPDF } from '../../utils/exportUtils';
import Button from './Button';
import { CloseIcon, DocumentArrowDownIcon } from './icons';

interface ShiftReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: ShiftReport | null;
}

const ShiftReportModal: React.FC<ShiftReportModalProps> = ({ isOpen, onClose, report }) => {
  const { users } = useUsers();
  const { getEmployeeById } = useEmployees();
  
  const getResponsibleDisplayName = useCallback((username: string): string => {
      const user = users.find(u => u.username === username);
      if (user?.employeeId) {
          const employee = getEmployeeById(user.employeeId);
          return employee?.name || username;
      }
      return username;
  }, [users, getEmployeeById]);

  if (!isOpen || !report) {
    return null;
  }

  const responsibleDisplayName = getResponsibleDisplayName(report.responsibleUser);

  const handleExport = () => {
      exportShiftReportToPDF(report, responsibleDisplayName);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 dark:bg-opacity-80 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-details-modal-title"
    >
      <div
        className="p-0 rounded-lg shadow-xl w-full max-w-2xl bg-white dark:bg-gray-800 relative max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b dark:border-gray-600 shrink-0">
          <h3 id="report-details-modal-title" className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Detalle Turno: {report.folio}
          </h3>
          <div className="flex items-center gap-2">
            <Button onClick={handleExport} size="sm" variant="secondary" className="flex items-center">
                <DocumentArrowDownIcon className="w-4 h-4 mr-2" />
                Exportar a PDF
            </Button>
            <Button
              onClick={onClose}
              variant="secondary"
              size="sm"
              className="p-1 !bg-transparent hover:!bg-gray-200 dark:hover:!bg-gray-700"
              aria-label="Cerrar modal"
            >
              <CloseIcon className="text-gray-600 dark:text-gray-300 w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="overflow-y-auto p-4 space-y-4">
          <div>
            <h4 className="font-semibold text-lg mb-1 text-gray-900 dark:text-gray-100">Información General</h4>
            <div className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
                <p><strong>Folio:</strong> {report.folio}</p>
                <p><strong>Fecha:</strong> {new Date(report.date + 'T00:00:00').toLocaleDateString('es-CL')}</p>
                <p><strong>Turno:</strong> {report.shiftName}</p>
                <p><strong>Responsable:</strong> {responsibleDisplayName}</p>
                <p><strong>Inicio:</strong> {new Date(report.startTime).toLocaleString('es-CL')}</p>
                <p><strong>Cierre:</strong> {report.endTime ? new Date(report.endTime).toLocaleString('es-CL') : 'N/A'}</p>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-lg mt-3 mb-1 text-gray-900 dark:text-gray-100">Novedades Registradas ({report.logEntries.length})</h4>
            {report.logEntries.length > 0 ? (
              <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700 dark:text-gray-300">
                {report.logEntries.map(le => <li key={le.id}><strong>{le.time}:</strong> {le.annotation}</li>)}
              </ul>
            ) : <p className="text-sm text-gray-500 dark:text-gray-400">Ninguna.</p>}
          </div>
          <div>
            <h4 className="font-semibold text-lg mt-3 mb-1 text-gray-900 dark:text-gray-100">Ingresos de Proveedores ({report.supplierEntries.length})</h4>
            {report.supplierEntries.length > 0 ? (
              <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                {report.supplierEntries.map(se => (
                  <li key={se.id} className="border-b pb-1 last:border-b-0 border-gray-200 dark:border-gray-700">
                    <strong>{se.time}</strong> - {se.company} (Cond: {se.driverName}, Pat: {se.licensePlate}, Pax: {se.paxCount}). Motivo: {se.reason}
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-gray-500 dark:text-gray-400">Ninguno.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShiftReportModal;
