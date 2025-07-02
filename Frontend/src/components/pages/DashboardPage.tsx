import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useEmployees } from '../../contexts/EmployeeContext';
import { useTheoreticalShifts } from '../../hooks/useTheoreticalShifts';
import { useTimeRecords } from '../../hooks/useTimeRecords';
import { DailyTimeRecord, ShiftReport, EmployeeDailyScheduleInfo, Employee, LogbookEntryItem } from '../../types';
import { idbGetAll, idbPut, getCounterValue, setCounterValue, STORES, COUNTER_IDS } from '../../utils/indexedDB';
import { useLogs } from '../../hooks/useLogs';
import { useToasts } from '../../hooks/useToasts';
import { ROUTES } from '../../constants';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { ClockIcon, BookOpenIcon, ExclamationTriangleIcon, CalendarDaysIcon, UsersIcon } from '../ui/icons';

const formatDisplayDateTime = (isoDateTimeString?: string): string => {
  if (!isoDateTimeString) return '-';
  if (isoDateTimeString === "SIN REGISTRO") return "Sin Registro";
  try {
    const date = new Date(String(isoDateTimeString));
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return '-';
  }
};

interface UpcomingEmployeeStatus {
  employee: Employee;
  shiftStartTime: Date;
  status: 'ontime' | 'late_warn' | 'late_alert' | 'absent';
  statusText: string;
  latenessMinutes: number;
}

interface MissingClockOutStatus {
  employee: Employee;
  shiftEndTime: string; // HH:mm format
  minutesPast: number;
  recordId: string;
  recordDate: string;
}


const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { employees, activeEmployees, getEmployeeById, isLoadingEmployees } = useEmployees();
  const { getEmployeeDailyScheduleInfo, isLoadingShifts } = useTheoreticalShifts();
  const { addLog } = useLogs();
  const { addToast } = useToasts();
  const { dailyRecords, isLoadingRecords, addOrUpdateRecord } = useTimeRecords();

  const [shiftReports, setShiftReports] = useState<ShiftReport[]>([]);
  const [upcomingEmployees, setUpcomingEmployees] = useState<UpcomingEmployeeStatus[]>([]);
  const [missingClockOuts, setMissingClockOuts] = useState<MissingClockOutStatus[]>([]);
  
  const isLoadingData = isLoadingEmployees || isLoadingShifts || isLoadingRecords;

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const reports = await idbGetAll<ShiftReport>(STORES.SHIFT_REPORTS);
        setShiftReports(reports.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()));
      } catch (error) {
        console.error("Error fetching dashboard reports:", error);
      }
    };

    if (!isLoadingEmployees && !isLoadingShifts) {
      fetchReports();
    }
  }, [isLoadingEmployees, isLoadingShifts]);

  // This single effect handles all login automations for the 'Reloj Control' user.
  useEffect(() => {
    const formatDateYYYYMMDD = (date: Date): string => {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const formatDateToDateTimeLocal = (date: Date): string => {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    const runLoginAutomations = async () => {
        const checkDone = sessionStorage.getItem('autoLoginActionsDone');
        if (checkDone || !currentUser?.employeeId) return;
        sessionStorage.setItem('autoLoginActionsDone', 'true');

        const employee = getEmployeeById(currentUser.employeeId);
        if (!employee || employee.position.toLowerCase() !== 'reloj control') return;
        
        const now = new Date();
        const scheduleInfo = getEmployeeDailyScheduleInfo(employee.id, now);
        
        if (!scheduleInfo?.isWorkDay || !scheduleInfo.startTime) return;
        
        const [startHour, startMinute] = scheduleInfo.startTime.split(':').map(Number);
        const shiftStartTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startHour, startMinute);
        
        // --- Automation 1: Auto Clock-In ---
        const hasOpenRecord = dailyRecords.some(r =>
            r.employeeId === currentUser.employeeId &&
            r.entrada && !r.salida && r.entrada !== "SIN REGISTRO"
        );
        
        if (!hasOpenRecord && now >= shiftStartTime) {
            const newRecord: DailyTimeRecord = {
                id: crypto.randomUUID(),
                employeeId: employee.id, employeeName: employee.name, employeePosition: employee.position, employeeArea: employee.area,
                date: now.toISOString().split('T')[0],
                entrada: formatDateToDateTimeLocal(now), entradaTimestamp: now.getTime(),
                lastModified: now.getTime(), syncStatus: 'pending', isDeleted: false,
            };
            const success = await addOrUpdateRecord(newRecord);
            if (success) {
                addToast('Se ha registrado tu entrada automáticamente.', 'success');
                await addLog(currentUser.username, 'Auto Clock-In Success on Login', { employeeId: employee.id });
            }
        }

        // --- Automation 2: Auto Start Shift ---
        const activeShift = shiftReports.find(s => s.status === 'open');
        if (!activeShift && scheduleInfo.endTime) {
            const [endHour, endMinute] = scheduleInfo.endTime.split(':').map(Number);
            const scheduleEndDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endHour, endMinute, 0);
            if (scheduleEndDate < shiftStartTime) scheduleEndDate.setDate(scheduleEndDate.getDate() + 1);
            
            const oneHourBeforeStart = new Date(shiftStartTime.getTime() - 60 * 60 * 1000);

            if (now >= oneHourBeforeStart && now <= scheduleEndDate) {
                try {
                    const actor = currentUser.username;
                    const currentHour = now.getHours();
                    const shiftNameToStart = (currentHour >= 8 && currentHour < 20) ? 'DÍA' : 'NOCHE';
                    const currentFolioCounter = await getCounterValue(COUNTER_IDS.LOGBOOK_FOLIO, 1);
                    const newFolio = String(currentFolioCounter).padStart(3, '0');
                    const startingEntry: LogbookEntryItem = {
                      id: now.getTime().toString(),
                      time: now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false }),
                      annotation: "Inicio de Turno, con Novedades Mencionadas",
                      timestamp: now.getTime(),
                    };
                    const newShift: ShiftReport = {
                        id: now.toISOString() + '-' + Math.random().toString(36).substr(2, 9),
                        folio: newFolio, date: formatDateYYYYMMDD(now), shiftName: shiftNameToStart,
                        responsibleUser: actor, startTime: now.toISOString(), status: 'open',
                        logEntries: [startingEntry], supplierEntries: [],
                        lastModified: now.getTime(), syncStatus: 'pending', isDeleted: false,
                    };
                    await idbPut<ShiftReport>(STORES.SHIFT_REPORTS, newShift);
                    await setCounterValue(COUNTER_IDS.LOGBOOK_FOLIO, currentFolioCounter + 1);
                    setShiftReports(prev => [newShift, ...prev].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()));
                    addToast(`Turno ${newFolio} (${shiftNameToStart}) iniciado automáticamente.`, 'success');
                    await addLog(actor, 'Shift Auto-Started on Login', { folio: newShift.folio });
                } catch (error) {
                    console.error("Error during auto-start shift:", error);
                    await addLog(currentUser.username, 'Shift Auto-Start Failed on Login', { error: String(error) });
                    addToast("Error al iniciar turno automáticamente.", "error");
                    sessionStorage.removeItem('autoLoginActionsDone');
                }
            }
        }
    };
    
    if (!isLoadingData) {
        runLoginAutomations();
    }
  }, [isLoadingData, currentUser, getEmployeeById, getEmployeeDailyScheduleInfo, dailyRecords, addOrUpdateRecord, addToast, addLog, shiftReports, setShiftReports]);
  
  const activeShiftReport = useMemo(() => {
    return shiftReports.find(r => r.status === 'open') || null;
  }, [shiftReports]);

  // useEffect for "Próximos a Entrar" card
  useEffect(() => {
    const updateUpcomingEmployees = async () => {
      if (isLoadingData || !Array.isArray(activeEmployees)) return;

      const now = new Date();
      
      const scheduledToday = activeEmployees
        .map(emp => {
          const schedule = getEmployeeDailyScheduleInfo(emp.id, now);
          if (schedule && schedule.isWorkDay && schedule.startTime) {
            const [hour, minute] = schedule.startTime.split(':').map(Number);
            const shiftStartTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute);
            return { employee: emp, shiftStartTime };
          }
          return null;
        })
        .filter((item): item is { employee: Employee; shiftStartTime: Date } => item !== null);

      const currentlyClockedInIds = new Set<string>();
      activeEmployees.forEach(emp => {
        const latestRecordForEmp = dailyRecords.find(r => r.employeeId === emp.id);
        if (latestRecordForEmp && latestRecordForEmp.entrada && !latestRecordForEmp.salida && latestRecordForEmp.entrada !== "SIN REGISTRO") {
          currentlyClockedInIds.add(emp.id);
        }
      });

      const notYetArrived = scheduledToday.filter(item => !currentlyClockedInIds.has(item.employee.id));
      
      const upcoming = notYetArrived
        .filter(item => {
          const timeDiff = item.shiftStartTime.getTime() - now.getTime();
          return timeDiff < (4 * 60 * 60 * 1000) && timeDiff > -(2 * 60 * 60 * 1000); // Show within 4h before, 2h after
        })
        .sort((a, b) => a.shiftStartTime.getTime() - b.shiftStartTime.getTime())
        .slice(0, 5);

      const upcomingWithStatus: UpcomingEmployeeStatus[] = upcoming.map(item => {
        const diffMs = now.getTime() - item.shiftStartTime.getTime();
        let status: 'ontime' | 'late_warn' | 'late_alert' | 'absent' = 'ontime';
        let statusText = 'A tiempo';
        let latenessMinutes = 0;

        if (diffMs > 0) {
          latenessMinutes = Math.floor(diffMs / 60000);
          statusText = `${latenessMinutes} min atraso`;
          
          if (latenessMinutes > 60) {
            status = 'absent'; // Red
            statusText = `Ausente (+60 min)`;
          } else if (latenessMinutes > 15) {
            status = 'late_alert'; // Orange
          } else { // 1 to 15 minutes
            status = 'late_warn'; // Yellow
          }
        }
        return { ...item, status, statusText, latenessMinutes };
      });

      setUpcomingEmployees(upcomingWithStatus);

      // --- Handle automatic log entries ---
      if (activeShiftReport && upcomingWithStatus.some(e => e.latenessMinutes > 15)) {
        let logEntriesToAdd: LogbookEntryItem[] = [];
        let shiftNeedsUpdate = false;
        
        for (const emp of upcomingWithStatus) {
            const employeeId = emp.employee.id;
            const todayStrForLogKey = new Date().toISOString().split('T')[0];
            
            if (emp.latenessMinutes > 60) { // Ausencia
                const absenceLogKey = `absence-log-${employeeId}-${todayStrForLogKey}`;
                if (!sessionStorage.getItem(absenceLogKey)) {
                    logEntriesToAdd.push({
                        id: crypto.randomUUID(),
                        time: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false }),
                        annotation: `Novedad: Empleado ${emp.employee.name} se marca como ausente (atraso > 60 min).`,
                        timestamp: Date.now() + 1, // Ensure unique timestamp
                    });
                    sessionStorage.setItem(absenceLogKey, 'true');
                    sessionStorage.setItem(`late-log-${employeeId}-${todayStrForLogKey}`, 'true'); 
                    shiftNeedsUpdate = true;
                }
            } else if (emp.latenessMinutes > 15) { // Atraso (16-60)
                const lateLogKey = `late-log-${employeeId}-${todayStrForLogKey}`;
                if (!sessionStorage.getItem(lateLogKey)) {
                    logEntriesToAdd.push({
                        id: crypto.randomUUID(),
                        time: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false }),
                        annotation: `Novedad: Empleado ${emp.employee.name} presenta atraso.`,
                        timestamp: Date.now(),
                    });
                    sessionStorage.setItem(lateLogKey, 'true');
                    shiftNeedsUpdate = true;
                }
            }
        }

        if (shiftNeedsUpdate) {
            const uniqueNewLogs = logEntriesToAdd.filter(newLog => 
                !activeShiftReport.logEntries.some(existingLog => existingLog.annotation === newLog.annotation && existingLog.time === newLog.time)
            );
            
            if (uniqueNewLogs.length > 0) {
                const updatedShift = { 
                    ...activeShiftReport, 
                    logEntries: [...activeShiftReport.logEntries, ...uniqueNewLogs].sort((a,b) => a.timestamp - b.timestamp) 
                };
                await idbPut<ShiftReport>(STORES.SHIFT_REPORTS, updatedShift);
                setShiftReports(prev => prev.map(s => s.id === updatedShift.id ? updatedShift : s));
                uniqueNewLogs.forEach(log => addToast(log.annotation, 'info'));
            }
        }
      }
    };

    const intervalId = setInterval(updateUpcomingEmployees, 60000);
    updateUpcomingEmployees();

    return () => clearInterval(intervalId);
  }, [isLoadingData, activeEmployees, dailyRecords, activeShiftReport, getEmployeeDailyScheduleInfo, addToast]);


  // useEffect for "Salidas Faltantes" card
  useEffect(() => {
    const updateMissingClockOuts = () => {
        if (isLoadingData || !Array.isArray(activeEmployees)) return;

        const now = new Date();
        const employeesToTrack: MissingClockOutStatus[] = [];

        const clockedInRecords = dailyRecords.filter(
            r => r.entrada && !r.salida && r.entrada !== "SIN REGISTRO"
        );

        for (const record of clockedInRecords) {
            const employee = getEmployeeById(record.employeeId);
            if (!employee) continue;

            const clockInDate = new Date(record.entradaTimestamp!);
            const schedule = getEmployeeDailyScheduleInfo(employee.id, clockInDate);

            if (schedule && schedule.isWorkDay && schedule.startTime && schedule.endTime) {
                const [startHour, startMinute] = schedule.startTime.split(':').map(Number);
                const [endHour, endMinute] = schedule.endTime.split(':').map(Number);

                const shiftStartTimeOnClockInDay = new Date(clockInDate.getFullYear(), clockInDate.getMonth(), clockInDate.getDate(), startHour, startMinute);
                let shiftEndTime = new Date(shiftStartTimeOnClockInDay);
                shiftEndTime.setHours(endHour, endMinute, 0, 0);

                if (shiftEndTime < shiftStartTimeOnClockInDay) {
                    shiftEndTime.setDate(shiftEndTime.getDate() + 1);
                }

                if (now > shiftEndTime) {
                    const minutesPast = Math.floor((now.getTime() - shiftEndTime.getTime()) / 60000);
                    employeesToTrack.push({
                        employee,
                        shiftEndTime: schedule.endTime, // HH:mm format for display
                        minutesPast,
                        recordId: record.id,
                        recordDate: record.date,
                    });
                }
            }
        }
        
        setMissingClockOuts(employeesToTrack.sort((a, b) => b.minutesPast - a.minutesPast));
    };

    const intervalId = setInterval(updateMissingClockOuts, 60000);
    updateMissingClockOuts();

    return () => clearInterval(intervalId);
  }, [isLoadingData, activeEmployees, dailyRecords, getEmployeeById, getEmployeeDailyScheduleInfo]);


  // --- Memoized Data Calculations ---
  
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Buenos días";
    if (hour < 20) return "Buenas tardes";
    return "Buenas noches";
  }, []);

  const { currentUserEmployee, userClockingStatus, welcomeName } = useMemo(() => {
    if (!currentUser || employees.length === 0) {
      return { currentUserEmployee: null, userClockingStatus: { status: 'unknown' }, welcomeName: currentUser?.username || 'Invitado' };
    }
    
    const employee = currentUser.employeeId ? getEmployeeById(currentUser.employeeId) : undefined;
    
    if (!employee) {
       return { currentUserEmployee: null, userClockingStatus: { status: 'not_employee' }, welcomeName: currentUser.username };
    }
    
    const latestRecord = dailyRecords.find(r => r.employeeId === employee.id);
    
    let clockingStatus;
    if (!latestRecord) {
      clockingStatus = { status: 'out', time: 'Nunca' };
    } else if (latestRecord.entrada && !latestRecord.salida && latestRecord.entrada !== "SIN REGISTRO") {
      clockingStatus = { status: 'in', time: formatDisplayDateTime(latestRecord.entrada) };
    } else {
      clockingStatus = { status: 'out', time: formatDisplayDateTime(latestRecord.salida || latestRecord.entrada) };
    }
    
    return { currentUserEmployee: employee, userClockingStatus: clockingStatus, welcomeName: employee.name };

  }, [currentUser, employees, dailyRecords, getEmployeeById]);
  
  const latestRecordByEmployee = useMemo(() => {
    const recordMap = new Map<string, DailyTimeRecord>();
    dailyRecords.forEach(record => {
      if (!recordMap.has(record.employeeId) || (record.entradaTimestamp || record.salidaTimestamp || 0) > (recordMap.get(record.employeeId)!.entradaTimestamp || recordMap.get(record.employeeId)!.salidaTimestamp || 0)) {
        recordMap.set(record.employeeId, record);
      }
    });
    return recordMap;
  }, [dailyRecords]);

  const teamStatus = useMemo(() => {
    let presentCount = 0;
    latestRecordByEmployee.forEach(record => {
      if (record.entrada && !record.salida && record.entrada !== 'SIN REGISTRO') {
        presentCount++;
      }
    });
    
    const anomalies = Array.from(latestRecordByEmployee.values()).filter(r => r.salida === 'SIN REGISTRO' || r.entrada === 'SIN REGISTRO');

    return {
      present: presentCount,
      total: activeEmployees.length,
      anomalies: anomalies,
    };
  }, [activeEmployees, latestRecordByEmployee]);

  const handleMissingClockOutDoubleClick = (item: MissingClockOutStatus) => {
    const params = new URLSearchParams();
    params.set('employeeName', item.employee.name);
    params.set('date', item.recordDate);
    navigate(`${ROUTES.TIME_CONTROL}?${params.toString()}`);
  };

  if (isLoadingData) {
    return <div className="p-6 text-center dark:text-gray-200">Cargando dashboard...</div>;
  }
  
  const blinkerStyle = {
    animation: 'blinker 1.5s linear infinite',
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
       <style>
          {`
              @keyframes blinker {
                  50% { opacity: 0.2; }
              }
          `}
      </style>
      <h1 className="text-3xl font-semibold text-gray-800 dark:text-gray-100">
        {greeting}, <span className="text-sap-blue dark:text-sap-light-blue">{welcomeName}</span>!
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Row 1: Quick Actions & My Status */}
        <Card title="Acciones Rápidas" className="md:col-span-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Left Column: Status */}
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-700 dark:text-gray-200 text-center">Mi Estado Actual</h3>
              {userClockingStatus.status === 'in' && (
                <div className="flex items-center p-3 bg-green-100 dark:bg-green-800/50 rounded-lg">
                  <span className="text-4xl mr-3">🟢</span>
                  <div>
                    <p className="font-bold text-green-800 dark:text-green-200">Presente</p>
                    <p className="text-sm text-green-700 dark:text-green-300">Entrada marcada a las {userClockingStatus.time}</p>
                  </div>
                </div>
              )}
               {userClockingStatus.status === 'out' && (
                <div className="flex items-center p-3 bg-red-100 dark:bg-red-800/50 rounded-lg">
                  <span className="text-4xl mr-3">🔴</span>
                  <div>
                    <p className="font-bold text-red-800 dark:text-red-200">Ausente</p>
                    <p className="text-sm text-red-700 dark:text-red-300">Última marca a las {userClockingStatus.time}</p>
                  </div>
                </div>
              )}
               {userClockingStatus.status === 'unknown' && <p>No se pudo determinar el estado.</p>}
               {userClockingStatus.status === 'not_employee' && <p>Usuario no es un empleado registrable.</p>}
               
                {activeShiftReport ? (
                    <div
                        className={`flex items-center p-3 rounded-lg ${
                            activeShiftReport.responsibleUser !== currentUser?.username
                                ? 'bg-yellow-100 dark:bg-yellow-800/50'
                                : 'bg-blue-100 dark:bg-blue-800/50'
                        }`}
                        style={activeShiftReport.responsibleUser !== currentUser?.username ? blinkerStyle : {}}
                    >
                        <BookOpenIcon
                            className={`w-8 h-8 mr-3 shrink-0 ${
                                activeShiftReport.responsibleUser !== currentUser?.username
                                    ? 'text-yellow-600 dark:text-yellow-300'
                                    : 'text-blue-600 dark:text-blue-300'
                            }`}
                        />
                        <div>
                            <p
                                className={`font-bold ${
                                    activeShiftReport.responsibleUser !== currentUser?.username
                                        ? 'text-yellow-800 dark:text-yellow-200'
                                        : 'text-blue-800 dark:text-blue-200'
                                }`}
                            >
                                Turno Iniciado
                            </p>
                            <p
                                className={`text-sm ${
                                    activeShiftReport.responsibleUser !== currentUser?.username
                                        ? 'text-yellow-700 dark:text-yellow-300'
                                        : 'text-blue-700 dark:text-blue-300'
                                }`}
                            >
                                Responsable: {activeShiftReport.responsibleUser}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center p-3 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
                        <BookOpenIcon className="w-8 h-8 mr-3 shrink-0 text-gray-500" />
                        <div>
                            <p className="font-bold text-gray-800 dark:text-gray-200">Sin Turno Activo</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Inicie un turno en el Libro de Novedades.</p>
                        </div>
                    </div>
                )}
            </div>
            {/* Right Column: Actions */}
            <div className="space-y-3 border-t sm:border-t-0 sm:border-l border-gray-200 dark:border-gray-700 sm:pl-4 pt-4 sm:pt-0 flex flex-col">
                <h3 className="font-semibold text-gray-700 dark:text-gray-200 text-center">Acciones</h3>
                <div className="grid grid-cols-2 gap-3 flex-grow content-center">
                    <Button onClick={() => navigate(ROUTES.TIME_CONTROL)} className="w-full h-full flex flex-col justify-center items-center p-2 text-center">
                        <ClockIcon className="w-6 h-6 mb-1" />
                        <span className="text-xs">Marcar Horario</span>
                    </Button>
                    <Button onClick={() => navigate(ROUTES.LOGBOOK)} className="w-full h-full flex flex-col justify-center items-center p-2 text-center">
                        <BookOpenIcon className="w-6 h-6 mb-1" />
                        <span className="text-xs">Libro Novedades</span>
                    </Button>
                    <Button onClick={() => navigate(ROUTES.SHIFT_CALENDAR)} className="w-full h-full flex flex-col justify-center items-center p-2 text-center">
                        <CalendarDaysIcon className="w-6 h-6 mb-1" />
                        <span className="text-xs">Ver Calendario</span>
                    </Button>
                    <Button onClick={() => navigate(ROUTES.CONFIGURATION)} className="w-full h-full flex flex-col justify-center items-center p-2 text-center">
                        <UsersIcon className="w-6 h-6 mb-1" />
                        <span className="text-xs">Gestionar Personal</span>
                    </Button>
                </div>
            </div>
          </div>
        </Card>
        
        {/* Row 2: Upcoming / Missing */}
        <Card title="Próximos a Entrar">
          <div className="space-y-2 max-h-52 overflow-y-auto">
            {upcomingEmployees.length > 0 ? (
              upcomingEmployees.map(({ employee, shiftStartTime, status, statusText }) => {
                const colorClasses = {
                  ontime: 'border-green-500',
                  late_warn: 'border-yellow-500', // Amarillo
                  late_alert: 'border-orange-500', // Naranja
                  absent: 'border-red-500', // Rojo
                };
                return (
                  <div key={employee.id} className={`flex items-center justify-between p-2 rounded-lg border-l-4 ${colorClasses[status]} bg-gray-50 dark:bg-gray-700/50`}>
                    <div>
                      <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm">{employee.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Turno: {shiftStartTime.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="text-right">
                       <p className={`text-xs font-semibold ${
                        status === 'ontime' ? 'text-green-600 dark:text-green-400' :
                        status === 'late_warn' ? 'text-yellow-600 dark:text-yellow-400' :
                        status === 'late_alert' ? 'text-orange-600 dark:text-orange-400' :
                        'text-red-600 dark:text-red-400'
                      }`}>{statusText}</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center text-gray-500 dark:text-gray-400 h-full flex items-center justify-center py-10">
                <p>No hay empleados próximos a entrar.</p>
              </div>
            )}
          </div>
        </Card>
        
        <Card title="Salidas Faltantes">
            <div className="space-y-2 max-h-52 overflow-y-auto">
                {missingClockOuts.length > 0 ? (
                    missingClockOuts.map((item) => (
                        <div 
                            key={item.recordId}
                            onDoubleClick={() => handleMissingClockOutDoubleClick(item)}
                            className="flex items-center justify-between p-2 rounded-lg bg-red-50 dark:bg-red-900/40 cursor-pointer hover:bg-red-100 dark:hover:bg-red-800/40 transition-colors"
                            title="Doble click para ver en Control Horario"
                        >
                            <div className="flex items-center">
                                <span className="w-3 h-3 bg-red-500 rounded-full mr-3 shrink-0" style={blinkerStyle}></span>
                                <div>
                                    <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm">{item.employee.name}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        Turno terminó a las {item.shiftEndTime}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                               <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                                   {item.minutesPast >= 60 ? `${Math.floor(item.minutesPast / 60)}h ${item.minutesPast % 60}m` : `${item.minutesPast}m`} tarde
                               </p>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center text-gray-500 dark:text-gray-400 h-full flex items-center justify-center py-10">
                        <p>Todos los empleados han salido a tiempo.</p>
                    </div>
                )}
            </div>
        </Card>

        {teamStatus && (
           <>
            <Card title="Estado del Equipo Hoy">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 space-y-2">
                        <h3 className="font-semibold text-gray-700 dark:text-gray-200">Asistencia Actual</h3>
                        <div className="w-full bg-gray-200 rounded-full h-4 dark:bg-gray-700">
                            <div className="bg-green-500 h-4 rounded-full" style={{ width: `${teamStatus.total > 0 ? (teamStatus.present / teamStatus.total) * 100 : 0}%` }}></div>
                        </div>
                        <p className="text-lg font-bold text-center">{teamStatus.present} <span className="font-normal text-sm text-gray-600 dark:text-gray-400">/ {teamStatus.total} empleados presentes</span></p>
                    </div>
                     <div className="flex-1 space-y-2 p-3 border-t sm:border-t-0 sm:border-l border-gray-200 dark:border-gray-700">
                        <h3 className="font-semibold text-gray-700 dark:text-gray-200 flex items-center"><ExclamationTriangleIcon className="w-5 h-5 mr-2 text-yellow-500"/>Anomalías de Marcaje</h3>
                        {teamStatus.anomalies.length > 0 ? (
                            <ul className="text-sm list-disc pl-5 text-yellow-700 dark:text-yellow-300">
                                {teamStatus.anomalies.map(r => (
                                    <li key={r.id}>
                                       {r.employeeName}: <span className="font-semibold">{r.entrada === 'SIN REGISTRO' ? 'Salida sin Entrada' : 'Entrada sin Salida'}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400">No hay anomalías recientes.</p>
                        )}
                    </div>
                </div>
            </Card>

             <Card title="Novedades Recientes">
              {activeShiftReport ? (
                <div className="space-y-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Turno Activo: {activeShiftReport.folio} ({activeShiftReport.shiftName})</p>
                    <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                        {activeShiftReport.logEntries.slice(-4).reverse().map(entry => (
                            <li key={entry.id} className="text-sm border-b border-gray-100 dark:border-gray-700 pb-1">
                                <span className="font-semibold text-gray-600 dark:text-gray-300">{entry.time}:</span> {entry.annotation}
                            </li>
                        ))}
                        {activeShiftReport.logEntries.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">Sin novedades en este turno.</p>}
                    </ul>
                </div>
              ) : (
                 <p className="text-center text-gray-500 dark:text-gray-400 h-full flex items-center justify-center">No hay ningún turno activo.</p>
              )}
            </Card>
           </>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;