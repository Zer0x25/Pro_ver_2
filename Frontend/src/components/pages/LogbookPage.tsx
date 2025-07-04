


import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShiftReport, LogbookEntryItem, SupplierEntry, User, DailyTimeRecord } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { useLogs } from '../../hooks/useLogs';
import { useToasts } from '../../hooks/useToasts';
import { ROUTES, STORAGE_KEYS } from '../../constants';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Card from '../ui/Card';
import ConfirmationModal from '../ui/ConfirmationModal';
import { ClockIcon, PlusCircleIcon, CloseIcon, EditIcon, DeleteIcon } from '../ui/icons';
import { idbGetAll, idbPut, idbDelete, getCounterValue, setCounterValue, STORES, COUNTER_IDS } from '../../utils/indexedDB';
import { useTheoreticalShifts } from '../../hooks/useTheoreticalShifts';
import { useTimeRecords } from '../../hooks/useTimeRecords';
import { useEmployees } from '../../contexts/EmployeeContext';
import { useUsers } from '../../hooks/useUsers';
import { formatTime, formatDateToDateTimeLocal } from '../../utils/formatters';
import AddNoveltyModal from '../ui/AddNoveltyModal';
import ShiftReportModal from '../ui/ShiftReportModal';

const formatDateYYYYMMDD = (date: Date): string => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const REPORTS_PER_PAGE = 10;

const LogbookPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth(); 
  const { addLog } = useLogs();
  const { addToast } = useToasts();
  const { getEmployeeDailyScheduleInfo } = useTheoreticalShifts();
  const { dailyRecords, addOrUpdateRecord } = useTimeRecords();
  const { getEmployeeById } = useEmployees();
  const { users } = useUsers();

  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  const [allShiftReports, setAllShiftReports] = useState<ShiftReport[]>([]);
  const [isLoadingShifts, setIsLoadingShifts] = useState<boolean>(true);
  
  const [activeShiftId, setActiveShiftId] = useState<string | null>(null);

  const [showStartShiftModal, setShowStartShiftModal] = useState(false);
  const [showLogEntryModal, setShowLogEntryModal] = useState(false);
  const [showSupplierEntryModal, setShowSupplierEntryModal] = useState(false);
  const [showClosedReportsModal, setShowClosedReportsModal] = useState(false);
  const [showReportDetailsModal, setShowReportDetailsModal] = useState<ShiftReport | null>(null);

  const [newShiftName, setNewShiftName] = useState('DÍA'); 
  
  const [editingLogEntry, setEditingLogEntry] = useState<LogbookEntryItem | null>(null);

  const [supplierData, setSupplierData] = useState<Omit<SupplierEntry, 'id' | 'time' | 'timestamp'>>({
    licensePlate: '', driverName: '', paxCount: 0, company: '', reason: ''
  });
  const [supplierEntryTime, setSupplierEntryTime] = useState<string>(formatTime(new Date()));
  const [editingSupplierEntry, setEditingSupplierEntry] = useState<SupplierEntry | null>(null);
  
  const [reportsSearchDate, setReportsSearchDate] = useState<string>('');
  const [reportsCurrentPage, setReportsCurrentPage] = useState<number>(1);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; type: 'log' | 'supplier'; name: string } | null>(null);

  // State for logout countdown modal
  const [showLogoutCountdownModal, setShowLogoutCountdownModal] = useState(false);
  const [countdown, setCountdown] = useState(5);

  // NEW state for close shift confirmation
  const [showCloseShiftConfirmation, setShowCloseShiftConfirmation] = useState(false);

  const logoutRef = useRef(logout);
  logoutRef.current = logout;


  useEffect(() => {
    const timer = setInterval(() => setCurrentDateTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Countdown logic for auto-logout
  useEffect(() => {
    if (!showLogoutCountdownModal) return;

    setCountdown(5); // Reset countdown on modal show

    const timer = setInterval(() => {
        setCountdown(prev => {
            if (prev <= 1) {
                clearInterval(timer);
                logoutRef.current();
                window.location.reload(); // Force reload as requested
                return 0;
            }
            return prev - 1;
        });
    }, 1000);

    return () => clearInterval(timer);
  }, [showLogoutCountdownModal]);

  useEffect(() => {
    const loadShifts = async () => {
      setIsLoadingShifts(true);
      try {
        const storedShifts = await idbGetAll<ShiftReport>(STORES.SHIFT_REPORTS);
        setAllShiftReports(storedShifts);
        const openShift = storedShifts.find(s => s.status === 'open');
        if (openShift) setActiveShiftId(openShift.id);
      } catch (error) {
        console.error("Error loading shift reports from IndexedDB:", error);
        addToast("Error cargando reportes de turno.", "error");
      } finally {
        setIsLoadingShifts(false);
      }
    };
    loadShifts();
  }, [addToast]);


  const activeShift = useMemo(() => {
    return allShiftReports.find(s => s.id === activeShiftId);
  }, [allShiftReports, activeShiftId]);
  
  const getResponsibleDisplayName = useCallback((username: string): string => {
      const user = users.find(u => u.username === username);
      if (user?.employeeId) {
          const employee = getEmployeeById(user.employeeId);
          return employee?.name || username;
      }
      return username;
  }, [users, getEmployeeById]);

  const executeCloseShift = useCallback(async () => {
    if (!activeShiftId || !activeShift || !currentUser) return;
    const actor = currentUser.username;
    const now = new Date();

    const closingEntry: LogbookEntryItem = {
      id: now.getTime().toString(),
      time: formatTime(now),
      annotation: "Cierre de Turno, con Novedades Mencionadas",
      timestamp: now.getTime()
    };
    
    const updatedShift: ShiftReport = { 
      ...activeShift, 
      logEntries: [...activeShift.logEntries, closingEntry].sort((a,b) => a.timestamp - b.timestamp),
      status: 'closed' as 'closed', 
      endTime: now.toISOString(),
      lastModified: now.getTime(),
      syncStatus: 'pending' as 'pending'
    };
    try {
      await idbPut<ShiftReport>(STORES.SHIFT_REPORTS, updatedShift);
      setAllShiftReports(prev => prev.map(s => s.id === activeShiftId ? updatedShift : s));
      setActiveShiftId(null);
      addToast(`Turno ${updatedShift.folio} cerrado.`, 'success');
      await addLog(actor, 'Shift Closed', { folio: updatedShift.folio });
      
      setShowCloseShiftConfirmation(false);
      setShowLogoutCountdownModal(true);

    } catch (error) {
        console.error("Error closing shift in IndexedDB:", error);
        addToast("Error al cerrar el turno.", "error");
        await addLog(actor, 'Shift Close Failed', { folio: activeShift.folio, error: String(error) });
        setShowCloseShiftConfirmation(false);
    }
  }, [activeShift, activeShiftId, addLog, addToast, currentUser]);
  
  useEffect(() => {
    const autoClose = sessionStorage.getItem(STORAGE_KEYS.TRIGGER_AUTO_CLOSE_SHIFT);
    if (autoClose === 'true' && activeShift) {
        sessionStorage.removeItem(STORAGE_KEYS.TRIGGER_AUTO_CLOSE_SHIFT);
        executeCloseShift();
    }
  }, [activeShift, executeCloseShift]);

  const handleOpenStartShiftModal = () => {
    const currentHour = new Date().getHours();
    if (currentHour >= 8 && currentHour < 20) {
      setNewShiftName('DÍA');
    } else {
      setNewShiftName('NOCHE');
    }
    setShowStartShiftModal(true);
  };

  const handleStartShift = async () => {
    if (!newShiftName.trim() || !currentUser) return;
    const actor = currentUser.username;
    const now = new Date();

    // Automatic clock-in logic when starting a shift
    if (currentUser.employeeId) {
        const employee = getEmployeeById(currentUser.employeeId);
        const scheduleInfo = getEmployeeDailyScheduleInfo(currentUser.employeeId, now);

        // Check if employee is scheduled to work and has a start time defined
        if (employee && scheduleInfo?.isWorkDay && scheduleInfo.startTime) {
            const [startHour, startMinute] = scheduleInfo.startTime.split(':').map(Number);
            const shiftStartTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startHour, startMinute);
            // Allow clock-in starting 15 minutes before the shift
            const shiftStartTimeMinus15 = new Date(shiftStartTime.getTime() - 15 * 60 * 1000);

            let shiftEndTime;
            if (scheduleInfo.endTime) {
                const [endHour, endMinute] = scheduleInfo.endTime.split(':').map(Number);
                shiftEndTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endHour, endMinute);
                // Handle overnight shifts
                if (shiftEndTime < shiftStartTime) {
                    shiftEndTime.setDate(shiftEndTime.getDate() + 1);
                }
            }

            // Check if current time is within the allowed window (from 15 min before start)
            if (now >= shiftStartTimeMinus15 && (!shiftEndTime || now <= shiftEndTime)) {
                // Check if user has no open clock-in record
                const hasOpenRecord = dailyRecords.some(r =>
                    r.employeeId === currentUser.employeeId &&
                    r.entrada && !r.salida && r.entrada !== "SIN REGISTRO"
                );

                if (!hasOpenRecord) {
                    // Perform automatic clock-in
                    const newRecord: DailyTimeRecord = {
                        id: crypto.randomUUID(),
                        employeeId: employee.id,
                        employeeName: employee.name,
                        employeePosition: employee.position,
                        employeeArea: employee.area,
                        date: now.toISOString().split('T')[0],
                        entrada: formatDateToDateTimeLocal(now),
                        entradaTimestamp: now.getTime(),
                        lastModified: now.getTime(),
                        syncStatus: 'pending',
                        isDeleted: false,
                    };
                    const success = await addOrUpdateRecord(newRecord);
                    if (success) {
                        addToast('Se ha registrado tu entrada automáticamente.', 'success');
                        await addLog(actor, 'Auto Clock-In on Shift Start', {
                            employeeId: employee.id,
                            recordId: newRecord.id
                        });
                    }
                }
            }
        }
    }

    // Original shift start logic continues here
    const currentFolioCounter = await getCounterValue(COUNTER_IDS.LOGBOOK_FOLIO, 1);
    const newFolio = String(currentFolioCounter).padStart(3, '0');

    const startingEntry: LogbookEntryItem = {
      id: now.getTime().toString(),
      time: formatTime(now),
      annotation: "Inicio de Turno, con Novedades Mencionadas",
      timestamp: now.getTime(),
    };
    
    const newShift: ShiftReport = {
      id: now.toISOString() + '-' + Math.random().toString(36).substr(2, 9),
      folio: newFolio,
      date: formatDateYYYYMMDD(now),
      shiftName: newShiftName,
      responsibleUser: actor,
      startTime: now.toISOString(),
      status: 'open',
      logEntries: [startingEntry],
      supplierEntries: [],
      lastModified: now.getTime(),
      syncStatus: 'pending',
      isDeleted: false,
    };
    try {
      await idbPut<ShiftReport>(STORES.SHIFT_REPORTS, newShift);
      setAllShiftReports(prev => [...prev, newShift]);
      setActiveShiftId(newShift.id);
      await setCounterValue(COUNTER_IDS.LOGBOOK_FOLIO, currentFolioCounter + 1);
      addToast(`Turno ${newShift.folio} iniciado.`, 'success');
      await addLog(actor, 'Shift Started', { folio: newShift.folio, shiftName: newShift.shiftName });
      setShowStartShiftModal(false);
    } catch (error) {
        console.error("Error starting shift in IndexedDB:", error);
        addToast("Error al iniciar el turno.", "error");
        await addLog(actor, 'Shift Start Failed', { error: String(error) });
    }
  };

  const saveLogEntry = async (annotation: string, time: string) => {
    if (!activeShiftId || !activeShift || !currentUser) {
        addToast("No se puede guardar porque no hay un turno activo.", "warning");
        return;
    }
    const actor = currentUser.username;
    const now = new Date();
    const newEntry: LogbookEntryItem = {
      id: editingLogEntry ? editingLogEntry.id : now.getTime().toString(),
      time: time,
      annotation: annotation,
      timestamp: editingLogEntry ? editingLogEntry.timestamp : now.getTime(),
    };

    const updatedLogEntries = editingLogEntry
      ? activeShift.logEntries.map(le => le.id === editingLogEntry!.id ? newEntry : le)
      : [...activeShift.logEntries, newEntry];
    
    const sortedLogEntries = updatedLogEntries.sort((a,b) => a.timestamp - b.timestamp);
    const updatedShift = { ...activeShift, logEntries: sortedLogEntries, lastModified: Date.now(), syncStatus: 'pending' as 'pending' };

    try {
      await idbPut<ShiftReport>(STORES.SHIFT_REPORTS, updatedShift);
      setAllShiftReports(prev => prev.map(s => s.id === activeShiftId ? updatedShift : s));
      addToast(editingLogEntry ? "Novedad actualizada." : "Novedad agregada.", "success");
      if (editingLogEntry) { 
        await addLog(actor, 'Log Entry Edited', { shiftFolio: activeShift.folio, entryId: newEntry.id, annotation: newEntry.annotation.substring(0, 50) });
      } else {
        await addLog(actor, 'Log Entry Added', { shiftFolio: activeShift.folio, entryId: newEntry.id, annotation: newEntry.annotation.substring(0, 50) });
      }
      setShowLogEntryModal(false);
      setEditingLogEntry(null);
    } catch (error) {
        console.error("Error saving log entry in IndexedDB:", error);
        addToast("Error al guardar la novedad.", "error");
        const logAction = editingLogEntry ? 'Log Entry Edit Failed' : 'Log Entry Add Failed';
        await addLog(actor, logAction, { shiftFolio: activeShift.folio, error: String(error) });
    }
  };
  
  const openEditLogEntryModal = (entry: LogbookEntryItem) => {
    setEditingLogEntry(entry);
    setShowLogEntryModal(true);
  };

  const handleDeleteEntry = (entry: LogbookEntryItem) => {
    setItemToDelete({ id: entry.id, type: 'log', name: `la anotación "${entry.annotation.substring(0, 30)}..."` });
  };
  
  const handleDeleteSupplierEntry = (entry: SupplierEntry) => {
    setItemToDelete({ id: entry.id, type: 'supplier', name: `el ingreso de la empresa "${entry.company}"` });
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete || !activeShiftId || !activeShift || !currentUser) return;
    const actor = currentUser.username;
    const { id, type } = itemToDelete;

    let updatedShift: ShiftReport;
    let toastMessage: string = '';
    let logAction: string = '';
    let logDetails: Record<string, any> = {};

    if (type === 'log') {
        const entryToDelete = activeShift.logEntries.find(le => le.id === id);
        updatedShift = { ...activeShift, logEntries: activeShift.logEntries.filter(le => le.id !== id), lastModified: Date.now(), syncStatus: 'pending' };
        toastMessage = "Novedad eliminada.";
        logAction = 'Log Entry Deleted';
        logDetails = { shiftFolio: activeShift.folio, entryId: id, annotation: entryToDelete?.annotation.substring(0, 50) };
    } else { // 'supplier'
        const entryToDelete = activeShift.supplierEntries.find(se => se.id === id);
        updatedShift = { ...activeShift, supplierEntries: activeShift.supplierEntries.filter(se => se.id !== id), lastModified: Date.now(), syncStatus: 'pending' };
        toastMessage = "Registro de proveedor eliminado.";
        logAction = 'Supplier Entry Deleted';
        logDetails = { shiftFolio: activeShift.folio, entryId: id, company: entryToDelete?.company, licensePlate: entryToDelete?.licensePlate };
    }

    try {
        await idbPut<ShiftReport>(STORES.SHIFT_REPORTS, updatedShift);
        setAllShiftReports(prev => prev.map(s => s.id === activeShiftId ? updatedShift : s));
        addToast(toastMessage, "success");
        await addLog(actor, logAction, logDetails);
    } catch (error) {
        addToast(`Error al eliminar.`, "error");
        const failLogAction = logAction.replace('Deleted', 'Delete Failed');
        await addLog(actor, failLogAction, { ...logDetails, error: String(error) });
    }
  };
  
  const handleLicensePlateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); 
    if (value.length > 6) value = value.substring(0, 6);
    let formattedValue = '';
    if (value.length > 0) formattedValue = value.substring(0, Math.min(2, value.length));
    if (value.length > 2) formattedValue += '-' + value.substring(2, Math.min(4, value.length));
    if (value.length > 4) formattedValue += '-' + value.substring(4, Math.min(6, value.length));
    setSupplierData(s => ({ ...s, licensePlate: formattedValue }));
  };

  const saveSupplierEntry = async () => {
    if (!supplierEntryTime.trim() || !supplierData.licensePlate.trim() || !supplierData.driverName.trim() || !supplierData.company.trim() || !supplierData.reason.trim() || !activeShiftId || !activeShift || !currentUser) {
        addToast("Todos los campos de proveedor son requeridos (excepto +PAX).", "warning");
        return;
    }
    const actor = currentUser.username;
    const now = new Date();
    const newEntry: SupplierEntry = {
      id: editingSupplierEntry ? editingSupplierEntry.id : now.getTime().toString(),
      time: supplierEntryTime,
      timestamp: editingSupplierEntry ? editingSupplierEntry.timestamp : now.getTime(),
      ...supplierData,
      paxCount: Number(supplierData.paxCount) || 0,
    };

    const updatedSupplierEntries = editingSupplierEntry
        ? activeShift.supplierEntries.map(se => se.id === editingSupplierEntry!.id ? newEntry : se)
        : [...activeShift.supplierEntries, newEntry];
    
    const sortedSupplierEntries = updatedSupplierEntries.sort((a,b) => a.timestamp - b.timestamp);
    const updatedShift = { ...activeShift, supplierEntries: sortedSupplierEntries, lastModified: Date.now(), syncStatus: 'pending' as 'pending' };

    try {
      await idbPut<ShiftReport>(STORES.SHIFT_REPORTS, updatedShift);
      setAllShiftReports(prev => prev.map(s => s.id === activeShiftId ? updatedShift : s));
      addToast(editingSupplierEntry ? "Registro de proveedor actualizado." : "Registro de proveedor agregado.", "success");
      if (editingSupplierEntry) { 
          await addLog(actor, 'Supplier Entry Edited', { shiftFolio: activeShift.folio, entryId: newEntry.id, company: newEntry.company, licensePlate: newEntry.licensePlate });
      } else {
          await addLog(actor, 'Supplier Entry Added', { shiftFolio: activeShift.folio, entryId: newEntry.id, company: newEntry.company, licensePlate: newEntry.licensePlate });
      }
      setShowSupplierEntryModal(false);
      setSupplierData({ licensePlate: '', driverName: '', paxCount: 0, company: '', reason: '' });
      setSupplierEntryTime(formatTime(new Date()));
      setEditingSupplierEntry(null);
    } catch (error) {
        console.error("Error saving supplier entry in IndexedDB:", error);
        addToast("Error al guardar el registro del proveedor.", "error");
        if (editingSupplierEntry) { 
            await addLog(actor, 'Supplier Entry Edit Failed', { shiftFolio: activeShift.folio, error: String(error) });
        } else {
            await addLog(actor, 'Supplier Entry Add Failed', { shiftFolio: activeShift.folio, error: String(error) });
        }
    }
  };

  const openEditSupplierEntryModal = (entry: SupplierEntry) => {
    setEditingSupplierEntry(entry);
    setSupplierData({
        licensePlate: entry.licensePlate,
        driverName: entry.driverName,
        paxCount: entry.paxCount,
        company: entry.company,
        reason: entry.reason
    });
    setSupplierEntryTime(entry.time);
    setShowSupplierEntryModal(true);
  };

  const filteredClosedReports = useMemo(() => {
    return allShiftReports
      .filter(s => s.status === 'closed')
      .filter(s => {
        if (!reportsSearchDate) return true;
        return s.date === reportsSearchDate;
      })
      .sort((a,b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }, [allShiftReports, reportsSearchDate]);

  const totalReportPages = useMemo(() => {
    return Math.ceil(filteredClosedReports.length / REPORTS_PER_PAGE);
  }, [filteredClosedReports.length]);

  const paginatedClosedReports = useMemo(() => {
    const startIndex = (reportsCurrentPage - 1) * REPORTS_PER_PAGE;
    return filteredClosedReports.slice(startIndex, startIndex + REPORTS_PER_PAGE);
  }, [filteredClosedReports, reportsCurrentPage]);

  const commonModalClass = "fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 dark:bg-opacity-80 p-4";
  const modalContentClass = "p-6 rounded-lg shadow-xl w-full max-w-lg bg-white dark:bg-gray-800";
  
  const renderModal = (isOpen: boolean, closeFn: () => void, title: string, children: React.ReactNode) => {
    if (!isOpen) return null;
    const modalId = `modal-title-${title.replace(/\s+/g, '-').toLowerCase()}`;
    return (
      <div className={commonModalClass} onClick={closeFn} role="dialog" aria-modal="true" aria-labelledby={modalId}>
        <div className={modalContentClass} onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-4">
            <h3 id={modalId} className="text-xl font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
            <Button onClick={closeFn} variant="secondary" size="sm" className="p-1 !bg-transparent hover:!bg-gray-200 dark:hover:!bg-gray-700" aria-label="Cerrar modal">
              <CloseIcon className="text-gray-600 dark:text-gray-300"/>
            </Button>
          </div>
          {children}
        </div>
      </div>
    );
  };

  if (isLoadingShifts) {
    return <div className="min-h-screen flex items-center justify-center dark:text-gray-200"><p>Cargando datos del libro de novedades...</p></div>;
  }

  return (
    <div className="min-h-screen p-4 md:p-6 space-y-6 text-sap-dark-gray dark:text-gray-200">
      <h2 className="text-2xl font-semibold text-center mb-6 text-sap-blue dark:text-sap-light-blue">
        Libro de Novedades - Espacio OX
      </h2>

      {!activeShift ? (
        <Card className="text-center">
          <p className="mb-4 text-lg">No hay ningún turno activo.</p>
          <Button onClick={handleOpenStartShiftModal}>Iniciar Nuevo Turno</Button>
        </Card>
      ) : (
        <>
          <Card>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 rounded-md border border-sap-border dark:border-gray-600 bg-gray-50 dark:bg-gray-700 mb-4">
              <div><strong>Folio:</strong> {activeShift.folio}</div>
              <div><strong>Fecha:</strong> {new Date(activeShift.date + 'T00:00:00').toLocaleDateString('es-CL')}</div>
              <div><strong>Turno:</strong> {activeShift.shiftName}</div>
              <div><strong>Responsable:</strong> {getResponsibleDisplayName(activeShift.responsibleUser)}</div>
            </div>
            <div className="flex space-x-2 mb-4">
              <Button onClick={() => { setReportsSearchDate(''); setReportsCurrentPage(1); setShowClosedReportsModal(true);}} variant="secondary">Ver Reportes Anteriores</Button>
              <Button onClick={() => setShowCloseShiftConfirmation(true)} variant="danger">Cerrar Turno Actual</Button>
            </div>
          </Card>
        
          <Card title="Registro de Novedades">
            <div className="flex items-center mb-3">
              <Button onClick={() => { setEditingLogEntry(null); setShowLogEntryModal(true); }} size="sm" className="flex items-center">
                <PlusCircleIcon className="w-5 h-5 mr-1" /> Agregar Novedad
              </Button>
            </div>
            <div className="overflow-x-auto max-h-96">
              <table className="min-w-full divide-y divide-sap-border dark:divide-gray-700">
                <thead className="bg-gray-100 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider w-1/6">Hora</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider w-4/6">Anotación</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider w-1/6">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-sap-border dark:divide-gray-700">
                  {activeShift.logEntries.length > 0 ? activeShift.logEntries.map(entry => (
                    <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-2 whitespace-nowrap text-sm">{entry.time}</td>
                      <td className="px-4 py-2 text-sm whitespace-pre-wrap">{entry.annotation}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm space-x-1">
                        <Button size="sm" onClick={() => openEditLogEntryModal(entry)} className="p-1" aria-label={`Editar novedad ${entry.id}`}><EditIcon /></Button>
                        <Button size="sm" variant="danger" onClick={() => handleDeleteEntry(entry)} className="p-1" aria-label={`Eliminar novedad ${entry.id}`}><DeleteIcon /></Button>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={3} className="px-4 py-4 text-center text-sm">No hay novedades en este turno.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Ingreso de Proveedores">
             <div className="flex items-center mb-3">
                <Button onClick={() => { setEditingSupplierEntry(null); setSupplierData({ licensePlate: '', driverName: '', paxCount: 0, company: '', reason: '' }); setSupplierEntryTime(formatTime(new Date())); setShowSupplierEntryModal(true);}} size="sm" className="flex items-center">
                  <PlusCircleIcon className="w-5 h-5 mr-1" /> Registrar Ingreso Proveedor
                </Button>
            </div>
            <div className="overflow-x-auto max-h-96">
              <table className="min-w-full divide-y divide-sap-border dark:divide-gray-700">
                <thead className="bg-gray-100 dark:bg-gray-700">
                  <tr>
                    {['Hora', 'Patente', 'Conductor', '+PAX', 'Empresa', 'Motivo', 'Acciones'].map(header => (
                       <th key={header} className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-sap-border dark:divide-gray-700">
                  {activeShift.supplierEntries.length > 0 ? activeShift.supplierEntries.map(entry => (
                    <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-2 whitespace-nowrap text-sm">{entry.time}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">{entry.licensePlate}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">{entry.driverName}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">{entry.paxCount}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">{entry.company}</td>
                      <td className="px-4 py-2 text-sm whitespace-pre-wrap">{entry.reason}</td>
                       <td className="px-4 py-2 whitespace-nowrap text-sm space-x-1">
                        <Button size="sm" onClick={() => openEditSupplierEntryModal(entry)} className="p-1" aria-label={`Editar proveedor ${entry.id}`}><EditIcon /></Button>
                        <Button size="sm" variant="danger" onClick={() => handleDeleteSupplierEntry(entry)} className="p-1" aria-label={`Eliminar proveedor ${entry.id}`}><DeleteIcon /></Button>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={7} className="px-4 py-4 text-center text-sm">No hay ingresos de proveedores en este turno.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {itemToDelete && (
        <ConfirmationModal
            isOpen={!!itemToDelete}
            onClose={() => setItemToDelete(null)}
            onConfirm={handleConfirmDelete}
            title="Confirmar Eliminación"
            message={`¿Está seguro de que desea eliminar ${itemToDelete.name}? Esta acción no se puede deshacer.`}
            confirmText="Sí, Eliminar"
            confirmVariant="danger"
        />
      )}

      {renderModal(showStartShiftModal, () => setShowStartShiftModal(false), "Iniciar Nuevo Turno",
        <div className="space-y-4">
          <p className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Seleccione el Turno:</p>
          <div className="flex space-x-4">
            {['DÍA', 'NOCHE'].map(turno => (
              <label key={turno} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="shiftName"
                  value={turno}
                  checked={newShiftName === turno}
                  onChange={(e) => setNewShiftName(e.target.value)}
                  className="form-radio h-4 w-4 text-sap-blue focus:ring-sap-blue dark:bg-gray-600 dark:border-gray-500"
                />
                <span className="text-gray-700 dark:text-gray-200">{turno}</span>
              </label>
            ))}
          </div>
          <Button onClick={handleStartShift}>Confirmar Inicio de Turno</Button>
        </div>
      )}

      <AddNoveltyModal
        isOpen={showLogEntryModal}
        onClose={() => {
            setShowLogEntryModal(false);
            setEditingLogEntry(null);
        }}
        onSave={saveLogEntry}
        initialText={editingLogEntry ? editingLogEntry.annotation : ''}
        initialTime={editingLogEntry ? editingLogEntry.time : undefined}
        isEditing={!!editingLogEntry}
      />
      
      {renderModal(showSupplierEntryModal, () => {setShowSupplierEntryModal(false); setEditingSupplierEntry(null); setSupplierData({ licensePlate: '', driverName: '', paxCount: 0, company: '', reason: '' }); setSupplierEntryTime(formatTime(new Date()));}, editingSupplierEntry ? "Editar Ingreso Proveedor" : "Registrar Ingreso Proveedor",
        <form onSubmit={(e) => { e.preventDefault(); saveSupplierEntry();}} className="space-y-3">
          <Input 
            label="Hora" 
            type="time" 
            id="supplierEntryTime" 
            value={supplierEntryTime} 
            onChange={e => setSupplierEntryTime(e.target.value)} 
            required 
          />
          <Input 
            label="Patente" 
            id="supplierLicensePlate" 
            value={supplierData.licensePlate} 
            onChange={handleLicensePlateChange} 
            required
            maxLength={8}
            placeholder="AA-BB-11 o AABB11"
          />
          <Input label="Nombre Conductor" id="supplierDriverName" value={supplierData.driverName} onChange={e => setSupplierData(s => ({...s, driverName: e.target.value}))} required />
          <Input label="Personas Adicionales (+PAX)" id="supplierPaxCount" type="number" min="0" value={String(supplierData.paxCount)} onChange={e => setSupplierData(s => ({...s, paxCount: parseInt(e.target.value,10) || 0}))} />
          <Input label="Empresa" id="supplierCompany" value={supplierData.company} onChange={e => setSupplierData(s => ({...s, company: e.target.value}))} required />
          
          <div>
            <label htmlFor="supplierReasonTextarea" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Motivo Ingreso</label>
            <textarea 
              id="supplierReasonTextarea" 
              value={supplierData.reason} 
              onChange={e => setSupplierData(s => ({...s, reason: e.target.value}))} 
              rows={3} 
              placeholder="Detalle del motivo del ingreso..." 
              className="block w-full px-3 py-2 border border-sap-border dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-sap-blue focus:border-sap-blue dark:focus:ring-sap-light-blue dark:focus:border-sap-light-blue sm:text-sm"
              required
            />
          </div>
          <Button type="submit" disabled={!supplierEntryTime.trim() || !supplierData.licensePlate.trim() || !supplierData.driverName.trim() || !supplierData.company.trim() || !supplierData.reason.trim()}>{editingSupplierEntry ? "Actualizar Registro" : "Guardar Registro"}</Button>
        </form>
      )}

      {renderModal(showClosedReportsModal, () => {
          setShowClosedReportsModal(false);
          setReportsSearchDate(''); 
          setReportsCurrentPage(1); 
        }, "Reportes de Turno Cerrados",
        <div className="max-h-[70vh] overflow-y-auto space-y-2">
          <Input
            type="date"
            label="Buscar por Fecha de Inicio:"
            id="reportsSearchDate"
            value={reportsSearchDate}
            onChange={(e) => {
              setReportsSearchDate(e.target.value);
              setReportsCurrentPage(1); 
            }}
            className="mb-3 w-full"
          />
          {paginatedClosedReports.length > 0 ? paginatedClosedReports.map(report => (
            <div key={report.id} tabIndex={0} role="button" onKeyPress={(e) => { if (e.key === 'Enter' || e.key === ' ') { setShowClosedReportsModal(false); setReportsSearchDate(''); setReportsCurrentPage(1); setShowReportDetailsModal(report);}}} className="p-3 border rounded cursor-pointer hover:bg-opacity-75 border-sap-border dark:border-gray-600 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600" onClick={() => {setShowClosedReportsModal(false); setReportsSearchDate(''); setReportsCurrentPage(1); setShowReportDetailsModal(report);}}>
              <p><strong>Folio:</strong> {report.folio} - <strong>Turno:</strong> {report.shiftName}</p>
              <p className="text-sm"><strong>Fecha:</strong> {new Date(report.date + 'T00:00:00').toLocaleDateString('es-CL')} - <strong>Responsable:</strong> {getResponsibleDisplayName(report.responsibleUser)}</p>
              <p className="text-xs"><strong>Inicio:</strong> {new Date(report.startTime).toLocaleString('es-CL')} - <strong>Cierre:</strong> {report.endTime ? new Date(report.endTime).toLocaleString('es-CL') : 'N/A'}</p>
            </div>
          )) : <p>No hay reportes cerrados para la fecha seleccionada o en general.</p>}
          {filteredClosedReports.length > REPORTS_PER_PAGE && (
            <div className="flex justify-between items-center mt-4">
              <Button
                onClick={() => setReportsCurrentPage(p => Math.max(1, p - 1))}
                disabled={reportsCurrentPage === 1}
              >
                Anterior
              </Button>
              <span className="text-sm text-gray-600 dark:text-gray-400">Página {reportsCurrentPage} de {totalReportPages || 1}</span>
              <Button
                onClick={() => setReportsCurrentPage(p => Math.min(totalReportPages, p + 1))}
                disabled={reportsCurrentPage === totalReportPages || totalReportPages === 0}
              >
                Siguiente
              </Button>
            </div>
          )}
        </div>
      )}
      
      {renderModal(showCloseShiftConfirmation, () => setShowCloseShiftConfirmation(false), "Confirmar Cierre de Turno",
        <div className="space-y-4">
            <p className="text-gray-700 dark:text-gray-300">
                ¿Está seguro de que desea cerrar el turno actual ({activeShift?.folio})?
                <br />
                <strong className="text-red-600 dark:text-red-400">Esta acción cerrará su sesión automáticamente.</strong>
            </p>
            <div className="flex justify-end space-x-2">
                <Button variant="secondary" onClick={() => setShowCloseShiftConfirmation(false)}>
                    Cancelar
                </Button>
                <Button variant="danger" onClick={executeCloseShift}>
                    Sí, Cerrar Turno
                </Button>
            </div>
        </div>
      )}

      {showLogoutCountdownModal && (
        <div className={commonModalClass} role="dialog" aria-modal="true" aria-labelledby="logout-countdown-title">
            <div className={`${modalContentClass} max-w-sm text-center`}>
                <h3 id="logout-countdown-title" className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    Cierre de Sesión Automático
                </h3>
                <p className="mt-4 text-lg text-gray-700 dark:text-gray-300">
                    Se hará cierre de sesión en <span className="font-bold text-2xl text-sap-blue dark:text-sap-light-blue">{countdown}</span> segundos...
                </p>
            </div>
        </div>
      )}

      <ShiftReportModal
        isOpen={!!showReportDetailsModal}
        onClose={() => setShowReportDetailsModal(null)}
        report={showReportDetailsModal}
      />
    </div>
  );
};

export default LogbookPage;