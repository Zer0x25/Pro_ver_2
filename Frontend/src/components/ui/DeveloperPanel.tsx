import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSync } from '../../contexts/SyncContext';
import { useAuth } from '../../hooks/useAuth';
import { useEmployees } from '../../contexts/EmployeeContext';
import { useToasts } from '../../hooks/useToasts';
import { getDBInstance, STORES } from '../../utils/indexedDB';
import Button from '../ui/Button';
import { 
    CodeBracketSquareIcon, CloseIcon, ChevronUpIcon, ChevronDownIcon, 
    ExportIcon, BeakerIcon, PlayIcon, StopIcon, ArrowPathIcon, ForwardIcon, ExclamationTriangleIcon 
} from './icons';
import { exportToCSV } from '../../utils/exportUtils';
import { useUsers } from '../../hooks/useUsers';
import { useTheoreticalShifts } from '../../hooks/useTheoreticalShifts';
import { useTimeRecords } from '../../hooks/useTimeRecords';
import { formatTime, formatDateToDateTimeLocal } from '../../utils/formatters';
import { Employee, DailyTimeRecord, ShiftReport, LogbookEntryItem, UserRole } from '../../types';
import { useLogs } from '../../hooks/useLogs';
import ConfirmationModal from './ConfirmationModal';
import Input from './Input';

const SYNCABLE_STORES_FOR_STATS = [
    STORES.EMPLOYEES, STORES.USERS, STORES.DAILY_TIME_RECORDS,
    STORES.THEORETICAL_SHIFT_PATTERNS, STORES.ASSIGNED_SHIFTS,
    STORES.SHIFT_REPORTS, STORES.APP_SETTINGS
];

// --- Data for Seeding ---
const firstNames = ['Ana', 'Bruno', 'Carla', 'David', 'Elena', 'Franco', 'Gilda', 'Hector', 'Irene', 'Jorge', 'Karla', 'Luis', 'Maria', 'Nestor', 'Olga', 'Pedro', 'Quintin', 'Rosa', 'Sergio', 'Teresa', 'Ursula', 'Victor', 'Sofia', 'Mateo', 'Valentina', 'Santiago', 'Isabella', 'Sebastian', 'Camila', 'Matias'];
const lastNames = ['García', 'Rodríguez', 'González', 'Fernández', 'López', 'Martínez', 'Sánchez', 'Pérez', 'Gómez', 'Martin', 'Jiménez', 'Ruiz', 'Hernández', 'Díaz', 'Moreno', 'Muñoz', 'Álvarez', 'Romero', 'Alonso', 'Gutiérrez', 'Navarro', 'Torres', 'Domínguez'];
const positions = ['Guardia', 'Operador', 'Técnico', 'Administrativo', 'Supervisor', 'Analista', 'Mantención', 'Logística', 'Seguridad', 'Limpieza', 'Jefe de Turno', 'Bodeguero'];
const areas = ['Seguridad', 'Logística', 'Mantención', 'Oficina', 'Producción', 'Calidad', 'RRHH', 'Bodega'];
const PRESET_COLORS = [
  '#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', 
  '#2196F3', '#03A9F4', '#00BCD4', '#009688', '#4CAF50', 
  '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', 
  '#FF5722', '#795548', '#9E9E9E', '#607D8B'
];
const getRandomItem = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];


// --- EMULATION SUB-COMPONENT ---
interface EmulationPanelProps {
    onClose: () => void;
    isSimulating: boolean;
    setIsSimulating: React.Dispatch<React.SetStateAction<boolean>>;
}
const EmulationPanel: React.FC<EmulationPanelProps> = ({ onClose, isSimulating, setIsSimulating }) => {
    // Hooks for data manipulation
    const { addEmployee } = useEmployees();
    const { addUser } = useUsers();
    const { addShiftPattern, assignShiftToEmployee, getEmployeeDailyScheduleInfo } = useTheoreticalShifts();
    const { addOrUpdateRecord } = useTimeRecords();
    const { addLog } = useLogs();
    const { addToast } = useToasts();
    
    // Simulation State
    const [simulationSpeed, setSimulationSpeed] = useState(1);
    const [simulationStartDate, setSimulationStartDate] = useState(() => new Date().toISOString().slice(0, 16));
    const [emulatedTime, setEmulatedTime] = useState(() => new Date(simulationStartDate));
    const [isSeeding, setIsSeeding] = useState(false);
    const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
    
    const simulationTimerRef = useRef<number | null>(null);
    
    useEffect(() => {
        if (!isSimulating) {
           setEmulatedTime(new Date(simulationStartDate));
        }
    }, [isSimulating, simulationStartDate]);

    // --- Data Seeding Logic ---
    const handleSeedData = async () => {
        setIsSeeding(true);
        addToast("Iniciando creación de datos de prueba...", "info");

        try {
            const db = await getDBInstance();
            const existingEmployees = await db.getAll(STORES.EMPLOYEES);
            if (existingEmployees.length > 5) { // Heuristic check for existing data
                addToast("Ya existen suficientes datos. No se crearán nuevos datos de prueba.", "warning");
                setIsSeeding(false);
                return;
            }

            // 1. Create Employees (up to 50)
            const createdEmployees: Employee[] = [];
            addToast("Creando 50 empleados...", "info");
            for (let i = 0; i < 50; i++) {
                const firstName = getRandomItem(firstNames);
                const lastName = getRandomItem(lastNames);
                const name = `${firstName} ${lastName}`;
                const rut = `${Math.floor(10000000 + Math.random() * 80000000)}-${Math.floor(Math.random() * 10)}`;
                const position = getRandomItem(positions);
                const area = getRandomItem(areas);
                
                const newEmployee = await addEmployee({ name, rut, position, area });
                if (newEmployee) {
                    createdEmployees.push(newEmployee);
                }
                if (i % 10 === 0) await new Promise(res => setTimeout(res, 50)); 
            }
            addToast(`${createdEmployees.length} empleados de prueba creados.`, "success");

            // 2. Create Users (up to 9)
            const createdUsers = [];
            addToast("Creando 9 usuarios...", "info");
            for (let i = 0; i < 9; i++) {
                if (i >= createdEmployees.length) break; 
                
                const employeeToLink = createdEmployees[i];
                const username = `${employeeToLink.name.split(' ')[0].toLowerCase()}${employeeToLink.name.split(' ')[1].charAt(0).toLowerCase()}`;
                const role: UserRole = i < 6 ? 'Usuario' : (i < 8 ? 'Supervisor' : 'Usuario Elevado');
                
                const newUser = await addUser({ username, password: 'password', role, employeeId: employeeToLink.id }, 'seed_script');
                if (newUser) {
                    createdUsers.push(newUser);
                }
            }
            addToast(`${createdUsers.length} usuarios de prueba creados.`, "success");

            // 3. Create Shift Patterns (up to 10)
            const createdPatterns = [];
            addToast("Creando 10 patrones de turno...", "info");
            for (let i = 0; i < 10; i++) {
                const cycleLength = getRandomItem([5, 7, 8, 10, 14]);
                const name = `Turno #${i + 1} (${cycleLength} días)`;
                const color = PRESET_COLORS[i % PRESET_COLORS.length];
                
                const dailySchedules = Array.from({ length: cycleLength }, (_, dayIndex) => {
                    const isOffDay = Math.random() < 0.3;
                    if (isOffDay) {
                        return { dayIndex, isOffDay: true, hasColacion: false, colacionMinutes: 0 };
                    }
                    const startHour = getRandomItem([7, 8, 9, 14, 20, 22]);
                    const endHour = (startHour + getRandomItem([8, 9, 10, 12])) % 24;
                    const startTime = `${String(startHour).padStart(2, '0')}:00`;
                    const endTime = `${String(endHour).padStart(2, '0')}:00`;
                    return { dayIndex, startTime, endTime, isOffDay: false, hasColacion: true, colacionMinutes: 60 };
                });
                
                const newPattern = await addShiftPattern({ name, cycleLengthDays: cycleLength, startDayOfWeek: 1, maxHoursPattern: 45, color, dailySchedules }, 'seed_script');
                if (newPattern) {
                    createdPatterns.push(newPattern);
                }
            }
            addToast(`${createdPatterns.length} patrones de turno creados.`, "success");

            // 4. Assign Shifts
            addToast("Asignando turnos a empleados...", "info");
            const sixtyDaysAgo = new Date();
            sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
            const assignmentStartDate = sixtyDaysAgo.toISOString().split('T')[0];
            
            if (createdPatterns.length > 0) {
                for (const emp of createdEmployees) {
                    const randomPattern = getRandomItem(createdPatterns);
                    await assignShiftToEmployee({ employeeId: emp.id, shiftPatternId: randomPattern.id, startDate: assignmentStartDate }, 'seed_script');
                }
            }
            addToast("Asignaciones de turno creadas.", "success");

            // 5. Generate historical time records for the last 2 months
            addToast("Generando registros de horario históricos (2 meses)...", "info");
            
            const todayForRecords = new Date();
            for (let dayOffset = 60; dayOffset >= 0; dayOffset--) {
                const currentDate = new Date(todayForRecords);
                currentDate.setDate(todayForRecords.getDate() - dayOffset);
                if (currentDate > todayForRecords) continue; 

                const dateStr = currentDate.toISOString().split('T')[0];

                for (const emp of createdEmployees) {
                    const scheduleInfo = getEmployeeDailyScheduleInfo(emp.id, currentDate);

                    if (scheduleInfo && scheduleInfo.isWorkDay && scheduleInfo.startTime && scheduleInfo.endTime) {
                        // ~5% chance of being absent
                        if (Math.random() < 0.05) continue;

                        const [startHour, startMinute] = scheduleInfo.startTime.split(':').map(Number);
                        const scheduledStartTime = new Date(currentDate);
                        scheduledStartTime.setHours(startHour, startMinute, 0, 0);
                        
                        // Random tardiness: -5 to +20 minutes
                        const tardinessMinutes = Math.floor(Math.random() * 25) - 5;
                        const entryTime = new Date(scheduledStartTime.getTime() + tardinessMinutes * 60 * 1000);

                        // ~3% chance of forgetting to clock out
                        if (Math.random() < 0.03) {
                            const newRecord: DailyTimeRecord = {
                                id: crypto.randomUUID(), employeeId: emp.id, employeeName: emp.name, employeePosition: emp.position, employeeArea: emp.area,
                                date: dateStr, entrada: formatDateToDateTimeLocal(entryTime), salida: "SIN REGISTRO",
                                entradaTimestamp: entryTime.getTime(), salidaTimestamp: null, lastModified: entryTime.getTime(),
                                syncStatus: 'pending', isDeleted: false,
                            };
                            await addOrUpdateRecord(newRecord);
                            continue;
                        }
                        
                        const [endHour, endMinute] = scheduleInfo.endTime.split(':').map(Number);
                        const scheduledEndTime = new Date(currentDate);
                        scheduledEndTime.setHours(endHour, endMinute, 0, 0);

                        if (scheduledEndTime < scheduledStartTime) {
                            scheduledEndTime.setDate(scheduledEndTime.getDate() + 1);
                        }

                        // Random clock-out variation: -15 to +30 minutes
                        const clockOutVariationMinutes = Math.floor(Math.random() * 45) - 15;
                        let exitTime = new Date(scheduledEndTime.getTime() + clockOutVariationMinutes * 60 * 1000);
                        
                        if (exitTime <= entryTime) {
                            exitTime = new Date(entryTime.getTime() + (scheduleInfo.hours || 8) * 60 * 60 * 1000);
                        }

                        const newRecord: DailyTimeRecord = {
                            id: crypto.randomUUID(), employeeId: emp.id, employeeName: emp.name, employeePosition: emp.position, employeeArea: emp.area,
                            date: dateStr, entrada: formatDateToDateTimeLocal(entryTime), salida: formatDateToDateTimeLocal(exitTime),
                            entradaTimestamp: entryTime.getTime(), salidaTimestamp: exitTime.getTime(), lastModified: exitTime.getTime(),
                            syncStatus: 'pending', isDeleted: false,
                        };
                        await addOrUpdateRecord(newRecord);
                    }
                }
                 await new Promise(res => setTimeout(res, 20)); // a small delay to allow UI to breathe
            }
            addToast("Registros históricos generados.", "success");


            addToast("Carga de datos de prueba completada. Recargando...", "success", 5000);
            setTimeout(() => window.location.reload(), 2000);

        } catch (error) {
            console.error("Seeding failed:", error);
            addToast("Falló la creación de datos de prueba.", "error");
        } finally {
            setIsSeeding(false);
        }
    };

    const handleConfirmClearData = async () => {
        addToast("Limpiando todos los datos...", "warning");
        try {
            const db = await getDBInstance();
            const storeNames = db.objectStoreNames;
            const tx = db.transaction(Array.from(storeNames), 'readwrite');
            await Promise.all(
                Array.from(storeNames).map((storeName) => {
                    console.log(`Clearing ${storeName}...`);
                    return tx.objectStore(storeName).clear();
                })
            );
            await tx.done;
            addToast("Todos los datos han sido eliminados. La aplicación se recargará.", "success", 5000);
            setTimeout(() => window.location.reload(), 2000);
        } catch (error) {
            console.error("Failed to clear data:", error);
            addToast("Error al limpiar la base de datos.", "error");
        }
        setIsClearConfirmOpen(false);
    };
    
    // --- Simulation Core Logic ---
    const performClockIn = useCallback(async (employee: Employee, time: Date) => {
        const newRecord: DailyTimeRecord = {
            id: crypto.randomUUID(), employeeId: employee.id, employeeName: employee.name,
            employeePosition: employee.position, employeeArea: employee.area,
            date: time.toISOString().split('T')[0], entrada: formatDateToDateTimeLocal(time),
            entradaTimestamp: time.getTime(), lastModified: time.getTime(), syncStatus: 'pending', isDeleted: false,
        };
        await addOrUpdateRecord(newRecord);
        addToast(`Entrada simulada: ${employee.name}`, 'info');
        await addLog('simulation', 'Simulated Clock-In', { employee: employee.name });
    }, [addOrUpdateRecord, addToast, addLog]);

    const performClockOut = useCallback(async (employee: Employee, openRecord: DailyTimeRecord, time: Date) => {
        const updatedRecord: DailyTimeRecord = {
            ...openRecord,
            salida: formatDateToDateTimeLocal(time),
            salidaTimestamp: time.getTime(),
            lastModified: time.getTime(),
            syncStatus: 'pending',
        };
        await addOrUpdateRecord(updatedRecord);
        addToast(`Salida simulada: ${employee.name}`, 'info');
        await addLog('simulation', 'Simulated Clock-Out', { employee: employee.name });
    }, [addOrUpdateRecord, addToast, addLog]);

    const addRandomLogEntry = useCallback(async (time: Date) => {
        const db = await getDBInstance();
        const openShifts = await db.getAll(STORES.SHIFT_REPORTS);
        const openShift = openShifts.find((s: ShiftReport) => s.status === 'open');

        if (openShift) {
            const randomEntries = ["Revisión de cámaras perimetrales.", "Llamada de supervisor para consulta.", "Entrega de correspondencia interna.", "Prueba de sistema de alarmas OK."];
            const randomEntry = randomEntries[Math.floor(Math.random() * randomEntries.length)];
            const newLog: LogbookEntryItem = {
                id: crypto.randomUUID(), time: formatTime(time), annotation: randomEntry, timestamp: time.getTime()
            };
            openShift.logEntries.push(newLog);
            openShift.logEntries.sort((a: { timestamp: number }, b: { timestamp: number }) => a.timestamp - b.timestamp);
            openShift.lastModified = time.getTime();
            openShift.syncStatus = 'pending';
            await db.put(STORES.SHIFT_REPORTS, openShift);
        }
    }, []);

    useEffect(() => {
        if (!isSimulating) {
            if (simulationTimerRef.current) clearInterval(simulationTimerRef.current);
            return;
        }

        const tick = async () => {
            const newEmulatedTime = new Date(emulatedTime.getTime() + (60 * 1000 * simulationSpeed));
            setEmulatedTime(newEmulatedTime);

            const db = await getDBInstance();
            const allEmployees = await db.getAll(STORES.EMPLOYEES);
            const records = await db.getAll(STORES.DAILY_TIME_RECORDS);
            const allAssignments = await db.getAll(STORES.ASSIGNED_SHIFTS);
            const allPatterns = await db.getAll(STORES.THEORETICAL_SHIFT_PATTERNS);

            for (const emp of allEmployees) {
                const assignment = allAssignments.find((a: any) => a.employeeId === emp.id);
                if (!assignment) continue;

                const pattern = allPatterns.find((p: any) => p.id === assignment.shiftPatternId);
                if (!pattern) continue;
                
                const diffTime = newEmulatedTime.getTime() - new Date(assignment.startDate + 'T00:00:00Z').getTime();
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                const dayIndexInCycle = (diffDays % pattern.cycleLengthDays + pattern.cycleLengthDays) % pattern.cycleLengthDays;
                const schedule = pattern.dailySchedules.find((ds: any) => ds.dayIndex === dayIndexInCycle);

                if (!schedule || schedule.isOffDay || !schedule.startTime || !schedule.endTime) continue;

                const openRecord = records.find((r: any) => r.employeeId === emp.id && !r.salida);
                const [startHour, startMinute] = schedule.startTime.split(':').map(Number);
                const [endHour, endMinute] = schedule.endTime.split(':').map(Number);
                
                const scheduledStartTime = new Date(newEmulatedTime);
                scheduledStartTime.setHours(startHour, startMinute, 0, 0);

                const scheduledEndTime = new Date(newEmulatedTime);
                scheduledEndTime.setHours(endHour, endMinute, 0, 0);
                if (scheduledEndTime <= scheduledStartTime) scheduledEndTime.setDate(scheduledEndTime.getDate() + 1);

                // Check for Clock-In
                if (!openRecord && newEmulatedTime >= scheduledStartTime && newEmulatedTime < scheduledEndTime) {
                    const lastRecord = records.filter((r:any) => r.employeeId === emp.id).sort((a:any,b:any) => (b.salidaTimestamp || b.entradaTimestamp || 0) - (a.salidaTimestamp || a.entradaTimestamp || 0))[0];
                    if (!lastRecord || (newEmulatedTime.getTime() - (lastRecord.salidaTimestamp || lastRecord.entradaTimestamp || 0) > 8 * 60 * 60 * 1000 )) { // 8 hour cooldown
                         await performClockIn(emp, newEmulatedTime);
                    }
                }
                
                // Check for Clock-Out
                if (openRecord && newEmulatedTime >= scheduledEndTime) {
                    await performClockOut(emp, openRecord, newEmulatedTime);
                }
            }

            if (Math.random() < 0.1) { // 10% chance per tick
                await addRandomLogEntry(newEmulatedTime);
            }
        };

        simulationTimerRef.current = window.setInterval(tick, 1000);

        return () => {
            if (simulationTimerRef.current) clearInterval(simulationTimerRef.current);
        };
    }, [isSimulating, simulationSpeed, emulatedTime, performClockIn, performClockOut, addRandomLogEntry]);

    const handleToggleSimulation = () => {
        if (isSimulating) {
            setIsSimulating(false);
        } else {
            setEmulatedTime(new Date(simulationStartDate));
            setIsSimulating(true);
        }
    };


    return (
        <>
         <div className="absolute bottom-16 right-0 w-80 sm:w-96 bg-gray-800 text-white rounded-lg shadow-2xl border border-gray-600 flex flex-col">
            <div className="flex justify-between items-center p-3 border-b border-gray-600">
                <h3 className="font-semibold flex items-center">
                    <BeakerIcon className="w-5 h-5 mr-2" />
                    Panel de Emulación
                </h3>
                <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-700">
                    <CloseIcon className="w-5 h-5"/>
                </button>
            </div>
            <div className="p-3 space-y-4">
                {/* Data Management */}
                <div>
                    <h4 className="text-sm font-semibold mb-2">1. Gestión de Datos</h4>
                    <div className="grid grid-cols-2 gap-2">
                        <Button onClick={handleSeedData} size="sm" variant="secondary" className="w-full flex items-center justify-center" disabled={isSeeding}>
                            <ArrowPathIcon className={`w-4 h-4 mr-2 ${isSeeding ? 'animate-spin' : ''}`} />
                            {isSeeding ? 'Cargando...' : 'Crear Datos'}
                        </Button>
                        <Button onClick={() => setIsClearConfirmOpen(true)} size="sm" variant="danger" className="w-full flex items-center justify-center">
                            <ExclamationTriangleIcon className="w-4 h-4 mr-2" />
                            Limpiar Datos
                        </Button>
                    </div>
                </div>
                {/* Simulation Control */}
                <div>
                     <h4 className="text-sm font-semibold mb-2">2. Simulación de Tiempo</h4>
                     <Input
                        type="datetime-local"
                        label="Fecha de inicio de simulación"
                        value={simulationStartDate}
                        onChange={(e) => setSimulationStartDate(e.target.value)}
                        disabled={isSimulating}
                        className="mb-2"
                    />
                     <div className="p-2 bg-gray-900 rounded-md text-center font-mono text-lg tracking-wider">
                        {emulatedTime.toLocaleString('es-CL')}
                     </div>
                     <div className="flex justify-between items-center mt-2 gap-2">
                        <Button
                            onClick={handleToggleSimulation}
                            size="sm"
                            variant={isSimulating ? "danger" : "primary"}
                            className="flex-grow flex items-center justify-center"
                        >
                            {isSimulating ? <StopIcon className="w-4 h-4 mr-2"/> : <PlayIcon className="w-4 h-4 mr-2"/>}
                            {isSimulating ? 'Detener' : 'Iniciar'}
                        </Button>
                        <div className="flex items-center bg-gray-700 rounded-md">
                            {[1, 5, 15, 60].map(speed => (
                                <button key={speed} onClick={() => setSimulationSpeed(speed)} className={`px-2 py-1 text-xs rounded-md transition-colors ${simulationSpeed === speed ? 'bg-sap-blue text-white font-bold' : 'text-gray-300 hover:bg-gray-600'}`}>
                                    x{speed}
                                </button>
                            ))}
                        </div>
                     </div>
                </div>
            </div>
        </div>
        {isClearConfirmOpen && (
            <ConfirmationModal
                isOpen={isClearConfirmOpen}
                onClose={() => setIsClearConfirmOpen(false)}
                onConfirm={handleConfirmClearData}
                title="Confirmar Limpieza de Datos"
                message={<>¿Está seguro? Esta acción eliminará <strong>TODOS</strong> los datos de la aplicación (empleados, registros, turnos, etc.) de forma irreversible.</>}
                confirmText="Sí, Limpiar Todo"
                confirmVariant="danger"
            />
        )}
        </>
    );
};


export const DeveloperPanel: React.FC = () => {
    const { lastSyncTime, conflicts } = useSync();
    const { addToast } = useToasts();
    
    const [isDevPanelOpen, setIsDevPanelOpen] = useState(false);
    const [isEmulationOpen, setIsEmulationOpen] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);
    const [errorCount, setErrorCount] = useState(0);
    const [isSimulating, setIsSimulating] = useState(false);
    
    const panelRef = useRef<HTMLDivElement>(null);

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
        const handleClickOutside = (event: MouseEvent) => {
          if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
            setIsDevPanelOpen(false);
            setIsEmulationOpen(false);
            setIsSimulating(false); // Pause simulation on click outside
          }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);


    useEffect(() => {
        if (!isDevPanelOpen) return;
        updateCounts();
        const interval = setInterval(updateCounts, 5000); // Poll every 5 seconds
        return () => clearInterval(interval);
    }, [isDevPanelOpen, updateCounts]);

    const handleExportConflicts = () => {
        if (conflicts.length === 0) {
            addToast("No hay conflictos para exportar.", "info");
            return;
        }
        const headers = ["Client Record ID", "Message"];
        const data = conflicts.map(c => [c.clientRecordId, c.message]);
        exportToCSV(headers, data, "sync_conflicts");
    };

    const toggleMainPanel = () => {
        setIsDevPanelOpen(prev => !prev);
        if(!isDevPanelOpen){
            setIsEmulationOpen(false);
        } else {
            setIsEmulationOpen(false);
        }
    }
    const toggleEmulationPanel = () => {
        setIsEmulationOpen(prev => !prev);
        if(!isEmulationOpen){
            setIsDevPanelOpen(false);
        } else {
            setIsDevPanelOpen(false);
        }
    }

    return (
        <div className="relative" ref={panelRef}>
            {(isDevPanelOpen || isEmulationOpen) && (
                <div 
                    className="fixed inset-0 bg-black/30 z-40" 
                    onClick={() => {
                        setIsDevPanelOpen(false);
                        setIsEmulationOpen(false);
                        setIsSimulating(false); // Also pause simulation
                    }}
                ></div>
            )}
            <div className="relative z-50 flex gap-2">
                 {isDevPanelOpen && (
                    <div className="absolute bottom-16 right-0 w-80 sm:w-96 bg-gray-800 text-white rounded-lg shadow-2xl border border-gray-600 flex flex-col">
                        <div className="flex justify-between items-center p-3 border-b border-gray-600">
                            <h3 className="font-semibold flex items-center">
                                <CodeBracketSquareIcon className="w-5 h-5 mr-2" />
                                Panel de Desarrollador
                            </h3>
                            <button onClick={toggleMainPanel} className="p-1 rounded-full hover:bg-gray-700">
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
                                    <ul className="text-xs space-y-1 mt-2 font-mono bg-gray-900 p-2 rounded max-h-24 overflow-y-auto">
                                        {conflicts.map((c, i) => (
                                            <li key={i}>{c.clientRecordId}: {c.message}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-xs text-gray-500 mt-1">No hay conflictos en la última sincronización.</p>
                                )}
                            </div>
                        </div>
                    </div>
                 )}
                 {isEmulationOpen && <EmulationPanel onClose={toggleEmulationPanel} isSimulating={isSimulating} setIsSimulating={setIsSimulating} />}

                <button
                    onClick={toggleEmulationPanel}
                    className="bg-teal-600 hover:bg-teal-700 text-white p-3 rounded-full shadow-lg transition-transform hover:scale-110"
                    aria-label="Panel de Emulación"
                    title="Panel de Emulación"
                >
                   {isEmulationOpen ? <ChevronDownIcon className="w-7 h-7" /> : <BeakerIcon className="w-7 h-7" />}
                </button>

                <button
                    onClick={toggleMainPanel}
                    className="bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-full shadow-lg transition-transform hover:scale-110"
                    aria-label={isDevPanelOpen ? "Cerrar Panel de Desarrollador" : "Abrir Panel de Desarrollador"}
                    title="Panel de Desarrollador"
                >
                    {isDevPanelOpen ? <ChevronDownIcon className="w-7 h-7" /> : <CodeBracketSquareIcon className="w-7 h-7" />}
                </button>
            </div>
        </div>
    );
};
