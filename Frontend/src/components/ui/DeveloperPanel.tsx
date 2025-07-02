import React, { useState, useEffect, useCallback } from 'react';
import { useSync } from '../../contexts/SyncContext';
import { useAuth } from '../../hooks/useAuth';
import { useEmployees } from '../../contexts/EmployeeContext';
import { useToasts } from '../../hooks/useToasts';
import { getDBInstance, STORES } from '../../utils/indexedDB';
import Button from './Button';
import { CodeBracketSquareIcon, CloseIcon, ChevronUpIcon, ChevronDownIcon, ExportIcon } from './icons';
import { exportToCSV } from '../../utils/exportUtils';

const SYNCABLE_STORES_FOR_STATS = [
    STORES.EMPLOYEES, STORES.USERS, STORES.DAILY_TIME_RECORDS,
    STORES.THEORETICAL_SHIFT_PATTERNS, STORES.ASSIGNED_SHIFTS,
    STORES.SHIFT_REPORTS, STORES.APP_SETTINGS
];

const DeveloperPanel: React.FC = () => {
    const { lastSyncTime, conflicts } = useSync();
    const { addEmployee } = useEmployees();
    const { addToast } = useToasts();
    
    const [isOpen, setIsOpen] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);
    const [errorCount, setErrorCount] = useState(0);

    const updateCounts = useCallback(async () => {
        try {
            const db = await getDBInstance();
            let totalPending = 0;
            let totalError = 0;
            for (const storeName of SYNCABLE_STORES_FOR_STATS) {
                totalPending += await db.countFromIndex(storeName, 'syncStatus', 'pending');
                totalError += await db.countFromIndex(storeName, 'syncStatus', 'error');
            }
            setPendingCount(totalPending);
            setErrorCount(totalError);
        } catch (error) {
            console.error("DevPanel: Error counting sync statuses:", error);
        }
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        updateCounts();
        const interval = setInterval(updateCounts, 5000); // Poll every 5 seconds
        return () => clearInterval(interval);
    }, [isOpen, updateCounts]);

    const handleSimulateError = async () => {
        const testEmployee = {
            name: `Test User Error ${new Date().toLocaleTimeString()}`,
            rut: '11111111-1',
            position: 'Test Position',
            area: 'Testing',
        };
        const result = await addEmployee(testEmployee);
        if (result) {
            addToast("Empleado 'Test User Error' creado. Sincronice para ver el error.", 'info');
            updateCounts(); // Update counts immediately
        }
    };

    const handleExportConflicts = () => {
        if (conflicts.length === 0) {
            addToast("No hay conflictos para exportar.", "info");
            return;
        }
        const headers = ["Client Record ID", "Message"];
        const data = conflicts.map(c => [c.clientRecordId, c.message]);
        exportToCSV(headers, data, "sync_conflicts");
    };

    return (
        <div className="relative">
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-black/30 z-40" 
                    onClick={() => setIsOpen(false)}
                ></div>
            )}
            <div className="relative z-50">
                 {isOpen && (
                    <div className="absolute bottom-16 right-0 w-80 sm:w-96 bg-gray-800 text-white rounded-lg shadow-2xl border border-gray-600 flex flex-col">
                        <div className="flex justify-between items-center p-3 border-b border-gray-600">
                            <h3 className="font-semibold flex items-center">
                                <CodeBracketSquareIcon className="w-5 h-5 mr-2" />
                                Panel de Desarrollador
                            </h3>
                            <button onClick={() => setIsOpen(false)} className="p-1 rounded-full hover:bg-gray-700">
                                <CloseIcon className="w-5 h-5"/>
                            </button>
                        </div>
                        <div className="p-3 space-y-3 overflow-y-auto max-h-96">
                            {/* Sync Stats */}
                            <div className="space-y-1">
                                <p className="text-xs text-gray-400">Última Sincronización:</p>
                                <p className="text-sm font-mono">{lastSyncTime ? new Date(lastSyncTime).toLocaleString('es-CL') : 'Nunca'}</p>
                            </div>
                            <div className="flex justify-around text-center">
                                <div>
                                    <p className="text-2xl font-bold text-yellow-400">{pendingCount}</p>
                                    <p className="text-xs text-gray-400">Pendientes</p>
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-red-400">{errorCount}</p>
                                    <p className="text-xs text-gray-400">Errores</p>
                                </div>
                            </div>

                            {/* Conflicts List */}
                            <div className="border-t border-gray-600 pt-2">
                                <div className="flex justify-between items-center">
                                    <h4 className="text-sm font-semibold">Conflictos Recientes ({conflicts.length})</h4>
                                    <Button size="sm" variant="secondary" onClick={handleExportConflicts} disabled={conflicts.length === 0}>
                                        <ExportIcon className="w-4 h-4 mr-1"/> Exportar
                                    </Button>
                                </div>
                                {conflicts.length > 0 ? (
                                    <ul className="text-xs space-y-1 mt-2 font-mono bg-gray-900 p-2 rounded">
                                        {conflicts.map((c, i) => (
                                            <li key={i}>{c.clientRecordId}: {c.message}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-xs text-gray-500 mt-1">No hay conflictos en la última sincronización.</p>
                                )}
                            </div>
                        </div>
                        <div className="p-3 border-t border-gray-600">
                             <Button onClick={handleSimulateError} size="sm" variant="danger" className="w-full">
                                Simular Error de Sincronización
                            </Button>
                        </div>
                    </div>
                 )}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-full shadow-lg transition-transform hover:scale-110"
                    aria-label={isOpen ? "Cerrar Panel de Desarrollador" : "Abrir Panel de Desarrollador"}
                    title="Panel de Desarrollador"
                >
                    {isOpen ? <ChevronDownIcon className="w-7 h-7" /> : <CodeBracketSquareIcon className="w-7 h-7" />}
                </button>
            </div>
        </div>
    );
};

export default DeveloperPanel;
