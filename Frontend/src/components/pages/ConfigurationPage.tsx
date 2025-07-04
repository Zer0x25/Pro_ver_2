


import React, { useState, useCallback, useEffect, useMemo, Dispatch, SetStateAction, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Employee, AuditLog, UserRole, Syncable, MeterConfig } from '../../types';
import Button from '../ui/Button';
import Input from '../ui/Input';
import ConfirmationModal from '../ui/ConfirmationModal';
import { 
    PlusCircleIcon, ChevronDownIcon, EditIcon, DeleteIcon, ChevronUpIcon,
    ExportIcon, DocumentTextIcon, TableCellsIcon, DocumentArrowDownIcon, DocumentArrowUpIcon, ExclamationTriangleIcon 
} from '../ui/icons';
import { useEmployees } from '../../contexts/EmployeeContext';
import { useLogs } from '../../hooks/useLogs';
import { useToasts } from '../../hooks/useToasts';
import { useAuth } from '../../hooks/useAuth';
import { useTheoreticalShifts } from '../../hooks/useTheoreticalShifts';
import { ROUTES } from '../../constants';
import { exportToCSV, exportToExcel, exportToPDF } from '../../utils/exportUtils';
import { idbGetAll, exportDB, importDB } from '../../utils/indexedDB';
import { formatLogTimestamp } from '../../utils/formatters';
import { GlobalVariablesManager } from '../config/GlobalVariablesManager';

// --- SUB-COMPONENTS ---

const DatabaseManager: React.FC = () => {
    const [importFile, setImportFile] = useState<File | null>(null);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { addToast } = useToasts();
    const { addLog } = useLogs();
    const { currentUser } = useAuth();

    const handleExportClick = async () => {
        try {
            await exportDB();
            addToast("Base de datos exportada con éxito.", "success");
            await addLog(currentUser?.username || 'System', 'Database Exported');
        } catch (error) {
            console.error(error);
            addToast("Error al exportar la base de datos.", "error");
            await addLog(currentUser?.username || 'System', 'Database Export Failed', { error: String(error) });
        }
    };

    const handleTriggerImport = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type === 'application/json') {
            setImportFile(file);
        } else if (file) {
            addToast("Por favor, seleccione un archivo .json válido.", "warning");
            setImportFile(null);
        }
        e.target.value = '';
    };

    const handleConfirmImport = async () => {
        if (!importFile) {
            addToast("No se ha seleccionado ningún archivo para importar.", "error");
            return;
        }

        try {
            await importDB(importFile);
            await addLog(currentUser?.username || 'System', 'Database Imported', { fileName: importFile.name });
            addToast("Base de datos importada con éxito. La aplicación se recargará.", "success", 6000);
            
            setTimeout(() => {
                window.location.reload();
            }, 2000);

        } catch (error: any) {
            console.error("Import failed:", error);
            addToast(`Error al importar: ${error.message || 'Formato de archivo inválido.'}`, "error", 8000);
            await addLog(currentUser?.username || 'System', 'Database Import Failed', { fileName: importFile.name, error: String(error) });
        } finally {
            setImportFile(null);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-sap-border dark:border-gray-600">
                <h3 className="text-lg font-medium leading-6 text-sap-dark-gray dark:text-gray-100">
                    Gestión de Datos de la Aplicación
                </h3>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {/* Export Section */}
                <div className="space-y-2">
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200">Exportar Datos</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Cree una copia de seguridad de todos los datos actuales de la aplicación (empleados, registros, turnos, etc.) en un único archivo JSON.
                    </p>
                    <Button onClick={handleExportClick} variant="secondary" className="flex items-center">
                        <DocumentArrowDownIcon className="w-5 h-5 mr-2" />
                        Exportar Base de Datos
                    </Button>
                </div>
                {/* Import Section */}
                <div className="space-y-2">
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200">Importar Datos</h4>
                    <p className="text-sm text-yellow-600 dark:text-yellow-400">
                        <ExclamationTriangleIcon className="w-5 h-5 inline-block mr-1" />
                        <strong>Atención:</strong> La importación reemplazará irreversiblemente todos los datos actuales.
                    </p>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept=".json"
                        className="hidden"
                    />
                    <Button onClick={handleTriggerImport} variant="secondary" className="flex items-center">
                        <DocumentArrowUpIcon className="w-5 h-5 mr-2" />
                        Seleccionar Archivo...
                    </Button>
                    {importFile && (
                        <div className="p-2 mt-2 bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-700 rounded-md space-y-2">
                            <p className="text-sm text-gray-800 dark:text-gray-200">Archivo seleccionado: <span className="font-mono">{importFile.name}</span></p>
                            <Button onClick={() => setIsImportModalOpen(true)} variant="danger">
                                Iniciar Importación
                            </Button>
                        </div>
                    )}
                </div>
            </div>
            <ConfirmationModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onConfirm={handleConfirmImport}
                title="Confirmar Importación Destructiva"
                message={
                    <>
                       <p>¿Está seguro de que desea importar el archivo <strong>{importFile?.name}</strong>?</p>
                       <p className="mt-2 text-red-600 dark:text-red-400 font-bold">
                         Esta acción es irreversible y reemplazará TODOS los datos actuales de la aplicación con el contenido del archivo. Se recomienda encarecidamente exportar los datos actuales primero como respaldo.
                       </p>
                    </>
                }
                confirmText="Sí, Importar y Reemplazar Todo"
                confirmVariant="danger"
            />
        </div>
    );
};

const LOGS_PER_PAGE = 20;

const ConfigurationPage: React.FC = () => {
  const { logs, isLoadingLogs, clearAllLogs, loadLogs } = useLogs();
  const { addToast } = useToasts();
  const { currentUser } = useAuth();
  const { isLoadingShifts } = useTheoreticalShifts();
  
  const [isAuditLogOpen, setIsAuditLogOpen] = useState(false);
  const [hasLoadedLogs, setHasLoadedLogs] = useState(false);
  const [logCurrentPage, setLogCurrentPage] = useState(1);
  const [logSearchTerm, setLogSearchTerm] = useState('');
  
  const headerBaseClasses = "flex justify-between items-center w-full p-4 text-lg font-semibold text-left text-sap-blue dark:text-sap-light-blue bg-white dark:bg-gray-800 shadow-md cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sap-blue dark:focus-visible:ring-sap-light-blue";
  const headerOpenClasses = "rounded-t-lg border-b border-sap-border dark:border-gray-600";
  const headerClosedClasses = "rounded-lg";
  const contentClasses = "bg-white dark:bg-gray-800 shadow-md rounded-b-lg overflow-hidden";
  
  const handleToggleAuditLog = () => {
    const newOpenState = !isAuditLogOpen;
    setIsAuditLogOpen(newOpenState);
    if (newOpenState && !hasLoadedLogs) {
      loadLogs();
      setHasLoadedLogs(true);
    }
  };

  const filteredAuditLogs = useMemo(() => {
    if (!logSearchTerm) return logs;
    const lowerSearch = logSearchTerm.toLowerCase();
    return logs.filter(log =>
      log.actorUsername.toLowerCase().includes(lowerSearch) ||
      log.action.toLowerCase().includes(lowerSearch) ||
      (log.details && JSON.stringify(log.details).toLowerCase().includes(lowerSearch))
    );
  }, [logs, logSearchTerm]);

  const paginatedLogs = useMemo(() => {
    const startIndex = (logCurrentPage - 1) * LOGS_PER_PAGE;
    return filteredAuditLogs.slice(startIndex, startIndex + LOGS_PER_PAGE);
  }, [filteredAuditLogs, logCurrentPage]);

  const totalLogPages = useMemo(() => {
    return Math.ceil(filteredAuditLogs.length / LOGS_PER_PAGE);
  }, [filteredAuditLogs.length]);
  
  const handleClearAllLogs = async () => {
    if (window.confirm("¿Está seguro de que desea eliminar TODOS los logs de auditoría? Esta acción es irreversible.")) {
      try {
        await clearAllLogs();
        addToast("Todos los logs de auditoría han sido eliminados.", "success");
      } catch (error) {
        addToast("Error al limpiar los logs de auditoría.", "error");
        console.error("Error clearing logs from page:", error);
      }
    }
  }

  if (isLoadingShifts) {
    return <div className="min-h-screen flex items-center justify-center dark:text-gray-200"><p>Cargando datos...</p></div>;
  }
  
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-sap-dark-gray dark:text-gray-100">Configuración</h1>
      
       {(currentUser?.role === 'Administrador' || currentUser?.role === 'Usuario Elevado') && (
        <>
            <div className="mt-6">
                <GlobalVariablesManager />
            </div>
            <div className="mt-6">
                <DatabaseManager />
            </div>
        </>
      )}

      <div className="mb-6">
        <div
          className={`${headerBaseClasses} ${isAuditLogOpen ? headerOpenClasses : headerClosedClasses}`}
          onClick={handleToggleAuditLog}
          role="button" tabIndex={0} onKeyPress={(e) => { if (e.key === 'Enter' || e.key === ' ') handleToggleAuditLog(); }}
          aria-expanded={isAuditLogOpen}
          aria-controls="audit-log-content"
        >
          <span>Logs de Auditoría</span>
          <ChevronDownIcon className={`w-5 h-5 transform transition-transform ${isAuditLogOpen ? 'rotate-180' : ''}`} />
        </div>
        {isAuditLogOpen && (
          <div id="audit-log-content" className={contentClasses}>
            <div className="p-4">
              <div className="mb-4 flex flex-col sm:flex-row justify-between items-center gap-2">
                <Input
                  type="search"
                  placeholder="Buscar en logs..."
                  value={logSearchTerm}
                  onChange={(e) => {
                    setLogSearchTerm(e.target.value);
                    setLogCurrentPage(1);
                  }}
                  className="w-full sm:w-auto flex-grow"
                  aria-label="Buscar en logs"
                />
                {currentUser?.role === 'Administrador' && (
                  <Button onClick={handleClearAllLogs} variant="danger" size="sm" className="w-full sm:w-auto" disabled={isLoadingLogs || logs.length === 0}>
                    Limpiar Todos los Logs
                  </Button>
                )}
              </div>

              {isLoadingLogs ? <p className="text-center py-4">Cargando logs...</p> : paginatedLogs.length === 0 ? (
                <p className="text-sap-medium-gray dark:text-gray-400 text-center py-4">
                  {logSearchTerm ? "No se encontraron logs con ese criterio." : "No hay logs de auditoría registrados."}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-sap-border dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">Timestamp</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">Actor</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">Acción</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">Detalles</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-sap-border dark:divide-gray-700">
                      {paginatedLogs.map(log => (
                        <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{formatLogTimestamp(log.timestamp)}</td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{log.actorUsername}</td>
                          <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">{log.action}</td>
                          <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                            {log.details ? <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(log.details, null, 2)}</pre> : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {totalLogPages > 1 && (
                <div className="mt-4 flex justify-between items-center">
                  <Button onClick={() => setLogCurrentPage(prev => Math.max(1, prev - 1))} disabled={logCurrentPage === 1} size="sm">Anterior</Button>
                  <span className="text-sm text-sap-medium-gray dark:text-gray-400">Página {logCurrentPage} de {totalLogPages}</span>
                  <Button onClick={() => setLogCurrentPage(prev => Math.min(totalLogPages, prev + 1))} disabled={logCurrentPage === totalLogPages} size="sm">Siguiente</Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConfigurationPage;