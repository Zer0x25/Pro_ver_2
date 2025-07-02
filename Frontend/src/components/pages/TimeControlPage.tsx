import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DailyTimeRecord, Employee, ShiftReport } from '../../types';
import { useEmployees } from '../../contexts/EmployeeContext';
import { useAuth } from '../../hooks/useAuth'; 
import { useLogs } from '../../hooks/useLogs';   
import { useToasts } from '../../hooks/useToasts';
import { useTimeRecords } from '../../hooks/useTimeRecords'; // Import the new hook
import { ROUTES } from '../../constants';
import { exportToCSV, exportToExcel, exportToPDF } from '../../utils/exportUtils';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Card from '../ui/Card';
import ConfirmationModal from '../ui/ConfirmationModal';
import { 
  FilterIcon, 
  ChevronDownIcon, ExportIcon, CloseIcon, EditIcon, DeleteIcon, ExclamationTriangleIcon,
  TableCellsIcon, DocumentTextIcon, DocumentArrowDownIcon
} from '../ui/icons';
import { useUsers } from '../../hooks/useUsers';
import { idbGetAll, STORES } from '../../utils/indexedDB';

const CLOCK_FORMAT_KEY = 'timecontrol-clockformat'; 
const THREE_MINUTES_IN_MS = 3 * 60 * 1000;
const RECORDS_PER_PAGE = 40;

const formatDateToDateTimeLocal = (date: Date): string => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const formatDisplayDateTime = (isoDateTimeString?: string | "SIN REGISTRO"): string => {
  if (!isoDateTimeString) return '-';
  if (isoDateTimeString === "SIN REGISTRO") return "Sin Registro";
  try {
    // Explicitly ensure primitive string for new Date()
    const date = new Date(String(isoDateTimeString)); 
    if (isNaN(date.getTime())) return '-'; 
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch (e) {
    console.error("Error formatting date:", isoDateTimeString, e);
    return '-';
  }
};


const TimeControlPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeEmployees, getEmployeeById, isLoadingEmployees } = useEmployees();
  const { currentUser } = useAuth(); 
  const { addLog } = useLogs();     
  const { addToast } = useToasts(); 
  const { dailyRecords, isLoadingRecords, addOrUpdateRecord, deleteRecordById } = useTimeRecords();
  const { users } = useUsers();

  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  
  const [isFiltersVisible, setIsFiltersVisible] = useState(false);
  const [filters, setFilters] = useState({ 
    name: searchParams.get('employeeName') || '', 
    area: '', 
    desde: searchParams.get('date') || '', 
    hasta: searchParams.get('date') || '' 
  });
  const [manualFilterActive, setManualFilterActive] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<{ recordId: string, field: 'entrada' | 'salida', currentValue?: string } | null>(null);
  const [newDateTimeValue, setNewDateTimeValue] = useState('');
  const [recordToDelete, setRecordToDelete] = useState<DailyTimeRecord | null>(null);

  const [is24HourFormat, setIs24HourFormat] = useState<boolean>(() => {
    const storedFormat = localStorage.getItem(CLOCK_FORMAT_KEY);
    return storedFormat ? JSON.parse(storedFormat) : true; 
  });
  
  const actorUsername = currentUser?.username || 'System';

  // State for missed clock-out (entrada sin salida) confirmation
  const [showMissedClockOutConfirmation, setShowMissedClockOutConfirmation] = useState(false);
  const [pendingClockInDetails, setPendingClockInDetails] = useState<{ employee: Employee, openEntry: DailyTimeRecord } | null>(null);

  // State for missed clock-in (salida sin entrada) confirmation
  const [showMissedClockInConfirmation, setShowMissedClockInConfirmation] = useState(false);
  const [pendingClockOutEmployee, setPendingClockOutEmployee] = useState<Employee | null>(null);

  // State for export menu
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // State for responsible user clock-out confirmation
  const [shiftReports, setShiftReports] = useState<ShiftReport[]>([]);
  const [showResponsibleUserClockOutConfirmation, setShowResponsibleUserClockOutConfirmation] = useState(false);
  const [employeeToConfirmClockOut, setEmployeeToConfirmClockOut] = useState<Employee | null>(null);


  useEffect(() => {
    const fetchReports = async () => {
      try {
        const reports = await idbGetAll<ShiftReport>(STORES.SHIFT_REPORTS);
        setShiftReports(reports);
      } catch (error) {
        console.error("Error fetching shift reports for clock-out check:", error);
      }
    };
    fetchReports();
  }, []);

  useEffect(() => {
    const filterEmployeeName = searchParams.get('employeeName');
    const filterDate = searchParams.get('date');

    if (filterEmployeeName && filterDate) {
        setIsFiltersVisible(true);
        setManualFilterActive(true);
        setCurrentPage(1);

        setFilters({
            name: filterEmployeeName,
            area: '',
            desde: filterDate,
            hasta: filterDate,
        });

        // Clean up the URL search params after applying them
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.delete('employeeName');
        newSearchParams.delete('date');
        setSearchParams(newSearchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  
  useEffect(() => {
    localStorage.setItem(CLOCK_FORMAT_KEY, JSON.stringify(is24HourFormat));
  }, [is24HourFormat]);

  const toggleClockFormat = () => setIs24HourFormat(prev => !prev);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    const foundEmployee = activeEmployees.find(emp => emp.name.toLowerCase() === e.target.value.toLowerCase());
    if (foundEmployee) {
      setSelectedEmployeeId(foundEmployee.id);
    } else {
      setSelectedEmployeeId(null);
    }
  };
  
  const handleDirectSelect = (employeeId: string) => {
    const emp = activeEmployees.find(e => e.id === employeeId);
    if (emp) {
        setSearchTerm(emp.name);
        setSelectedEmployeeId(emp.id);
    }
  }

  const processNewClockIn = async (employee: Employee) => {
    const now = new Date();
    const currentFullDateTime = formatDateToDateTimeLocal(now);
    const currentDateYYYYMMDD = now.toISOString().split('T')[0];

    const newRecord: DailyTimeRecord = {
      id: crypto.randomUUID(),
      employeeId: employee.id,
      employeeName: employee.name,
      employeePosition: employee.position,
      employeeArea: employee.area,
      date: currentDateYYYYMMDD,
      entrada: currentFullDateTime,
      entradaTimestamp: now.getTime(),
      lastModified: now.getTime(),
      syncStatus: 'pending',
      isDeleted: false,
    };
    const success = await addOrUpdateRecord(newRecord);
    if (success) {
      addToast('Nueva entrada registrada con éxito.', 'success');
      await addLog(actorUsername, 'Clock In Success', {
          employeeId: employee.id,
          employeeName: employee.name,
          recordId: newRecord.id,
          recordedTime: currentFullDateTime
      });
      setSearchTerm('');
      setSelectedEmployeeId(null);
    } else {
      // Toast is handled by the hook
      await addLog(actorUsername, 'Clock In DB Error', {
          employeeId: employee.id,
          employeeName: employee.name,
          error: "Failed to save record via useTimeRecords hook"
      });
    }
  };
  
  const handleConfirmAutoCloseAndProceed = async () => {
    if (!pendingClockInDetails) return;
    const { employee, openEntry } = pendingClockInDetails;

    const autoClosedEntry: DailyTimeRecord = {
      ...openEntry,
      salida: "SIN REGISTRO",
      salidaTimestamp: null,
    };
    
    const success = await addOrUpdateRecord(autoClosedEntry);
    
    if (success) {
      await addLog(actorUsername, 'Missed Clock-Out Auto-Closed', {
        employeeId: employee.id,
        employeeName: employee.name,
        recordId: autoClosedEntry.id,
        autoClosedTime: autoClosedEntry.entrada
      });
      addToast(`La entrada anterior de ${employee.name} se marcó como 'SIN REGISTRO'.`, 'info');
      
      await processNewClockIn(employee);

    } else {
      addToast("Error al cerrar automáticamente la entrada anterior.", 'error');
    }
    
    setShowMissedClockOutConfirmation(false);
    setPendingClockInDetails(null);
  };

  const handleCancelNewClockIn = () => {
    addToast("Nueva entrada cancelada. Por favor, registre la salida de la entrada anterior o edítela manually.", 'info', 7000);
    setShowMissedClockOutConfirmation(false);
    setPendingClockInDetails(null);
  };

  const handleConfirmAutoCreateEntryAndClockOut = async () => {
    if (!pendingClockOutEmployee) return;
    const employee = pendingClockOutEmployee;
    const now = new Date();
    const currentFullDateTime = formatDateToDateTimeLocal(now);
    const currentDateYYYYMMDD = now.toISOString().split('T')[0];

    const newRecord: DailyTimeRecord = {
      id: crypto.randomUUID(),
      employeeId: employee.id,
      employeeName: employee.name,
      employeePosition: employee.position,
      employeeArea: employee.area,
      date: currentDateYYYYMMDD, 
      entrada: "SIN REGISTRO",
      entradaTimestamp: null,
      salida: currentFullDateTime,
      salidaTimestamp: now.getTime(),
      lastModified: now.getTime(),
      syncStatus: 'pending',
      isDeleted: false,
    };

    const success = await addOrUpdateRecord(newRecord);
    if (success) {
      addToast("Entrada 'SIN REGISTRO' y salida actual guardadas.", 'success');
      await addLog(actorUsername, 'Missed Clock-In Auto-Created With Salida', {
        employeeId: employee.id,
        employeeName: employee.name,
        recordId: newRecord.id,
        recordedSalida: currentFullDateTime
      });
      setSearchTerm('');
      setSelectedEmployeeId(null);
    } else {
      await addLog(actorUsername, 'Missed Clock-In Auto-Create DB Error', {
        employeeId: employee.id,
        employeeName: employee.name,
        error: "Failed to save record via useTimeRecords hook"
      });
    }

    setShowMissedClockInConfirmation(false);
    setPendingClockOutEmployee(null);
  };

  const handleCancelClockOutMissingEntry = () => {
    addToast("Salida cancelada. Registre una entrada o edite un registro existente.", 'info', 7000);
    setShowMissedClockInConfirmation(false);
    setPendingClockOutEmployee(null);
  };

  const handleConfirmResponsibleUserClockOut = async () => {
    if (!employeeToConfirmClockOut) return;
    const employeeId = employeeToConfirmClockOut.id;

    const latestOpenEntryForEmployee = dailyRecords
        .filter(r => r.employeeId === employeeId && r.entrada && !r.salida && r.entrada !== "SIN REGISTRO")
        .sort((a, b) => (b.entradaTimestamp || 0) - (a.entradaTimestamp || 0))[0];
    
    if (!latestOpenEntryForEmployee) {
        addToast(`No se encontró una entrada abierta para ${employeeToConfirmClockOut.name}.`, 'error');
        setShowResponsibleUserClockOutConfirmation(false);
        setEmployeeToConfirmClockOut(null);
        return;
    }

    const now = new Date();
    const currentFullDateTime = formatDateToDateTimeLocal(now); 
    const recordToSave: DailyTimeRecord = {
        ...latestOpenEntryForEmployee,
        salida: currentFullDateTime,
        salidaTimestamp: now.getTime(),
        lastModified: now.getTime(),
        syncStatus: 'pending',
    };

    const success = await addOrUpdateRecord(recordToSave);
    if (success) {
        addToast('Salida registrada. Iniciando cierre automático de turno...', 'success');
        await addLog(actorUsername, 'Clock Out Success (Shift Responsible)', {
            employeeId: employeeToConfirmClockOut.id,
            employeeName: employeeToConfirmClockOut.name,
            recordId: recordToSave.id,
            recordedTime: currentFullDateTime
        });
        setSearchTerm('');
        setSelectedEmployeeId(null);
        // Set flag for auto close
        sessionStorage.setItem('triggerAutoCloseShift', 'true');
        navigate(ROUTES.LOGBOOK);
    } else {
        await addLog(actorUsername, 'Clock Out DB Error (Shift Responsible)', {
            employeeId: employeeToConfirmClockOut.id,
            employeeName: employeeToConfirmClockOut.name,
            recordId: latestOpenEntryForEmployee.id,
            error: "Failed to save record via useTimeRecords hook"
        });
    }
    
    setShowResponsibleUserClockOutConfirmation(false);
    setEmployeeToConfirmClockOut(null);
  };


  const handleRecordAction = async (type: 'entrada' | 'salida') => {
    if (!selectedEmployeeId) {
      addToast('Por favor, seleccione un empleado.', 'warning');
      return;
    }
    const employee = getEmployeeById(selectedEmployeeId); 
    if (!employee || !employee.isActive) { 
      addToast('Empleado no encontrado o inactivo.', 'warning');
      return;
    }

    const now = new Date();

    if (type === 'entrada') {
      // 3-minute check
      const employeeSpecificRecords = dailyRecords.filter(r => r.employeeId === selectedEmployeeId);
      if (employeeSpecificRecords.length > 0) {
        const latestRecordForEmployee = employeeSpecificRecords[0]; // Already sorted, first is latest
        const latestTimestamp = Math.max(latestRecordForEmployee.entradaTimestamp || 0, latestRecordForEmployee.salidaTimestamp || 0);
        if (latestTimestamp > 0) {
          const timeDifference = now.getTime() - latestTimestamp;
          if (timeDifference < THREE_MINUTES_IN_MS) {
            addToast(`No puede ingresar un nuevo registro para ${employee.name} hasta que pasen 3 minutos desde su última marcación.`, 'warning', 7000);
            return;
          }
        }
      }

      // Check for open entries
      const openEntries = employeeSpecificRecords
        .filter(r => r.entrada && !r.salida && r.entrada !== "SIN REGISTRO")
        .sort((a, b) => (b.entradaTimestamp || 0) - (a.entradaTimestamp || 0)); // Re-sort just in case, though parent sort should hold

      if (openEntries.length > 0) {
        const lastOpenEntry = openEntries[0];
        setPendingClockInDetails({ employee, openEntry: lastOpenEntry });
        setShowMissedClockOutConfirmation(true);
        return; 
      }
      await processNewClockIn(employee);

    } else { // type === 'salida'
        const userForEmployee = users.find(u => u.employeeId === selectedEmployeeId);
        if (userForEmployee) {
            const openShiftForUser = shiftReports.find(s => s.status === 'open' && s.responsibleUser === userForEmployee.username);
            if (openShiftForUser) {
                setEmployeeToConfirmClockOut(employee);
                setShowResponsibleUserClockOutConfirmation(true);
                return; // Stop here, wait for user confirmation
            }
        }

      const latestOpenEntryForEmployee = dailyRecords
        .filter(r => r.employeeId === selectedEmployeeId && r.entrada && !r.salida && r.entrada !== "SIN REGISTRO")
        .sort((a, b) => (b.entradaTimestamp || 0) - (a.entradaTimestamp || 0))[0];

      if (!latestOpenEntryForEmployee) {
        // No open entry, show confirmation for "SIN REGISTRO" entrada
        setPendingClockOutEmployee(employee);
        setShowMissedClockInConfirmation(true);
        return; 
      }
      
      const currentFullDateTime = formatDateToDateTimeLocal(now); 
      const recordToSave: DailyTimeRecord = {
        ...latestOpenEntryForEmployee,
        salida: currentFullDateTime,
        salidaTimestamp: now.getTime(),
        lastModified: now.getTime(),
        syncStatus: 'pending',
      };

      const success = await addOrUpdateRecord(recordToSave);
      if (success) {
        addToast('Salida registrada con éxito.', 'success');
        await addLog(actorUsername, 'Clock Out Success', {
            employeeId: employee.id,
            employeeName: employee.name,
            recordId: recordToSave.id,
            recordedTime: currentFullDateTime
        });
        setSearchTerm('');
        setSelectedEmployeeId(null);
      } else {
        await addLog(actorUsername, 'Clock Out DB Error', {
            employeeId: employee.id,
            employeeName: employee.name,
            recordId: latestOpenEntryForEmployee.id,
            error: "Failed to save record via useTimeRecords hook"
        });
      }
    }
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setManualFilterActive(true);
    setCurrentPage(1);
    setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const clearFilters = () => {
    setFilters({ name: '', area: '', desde: '', hasta: '' });
    setManualFilterActive(false);
    setCurrentPage(1);
  };

  const filteredRecords = useMemo(() => {
    if (manualFilterActive) {
      return dailyRecords.filter(record => {
        let recordDateStr = record.date;
        if (record.entrada === "SIN REGISTRO" && record.salida && record.salida !== "SIN REGISTRO") {
          recordDateStr = record.salida.split('T')[0];
        }
        const recordDateObj = new Date(recordDateStr + 'T00:00:00');
        const desdeDate = filters.desde ? new Date(filters.desde + 'T00:00:00') : null;
        const hastaDate = filters.hasta ? new Date(filters.hasta + 'T23:59:59') : null;

        return (
          (filters.name === '' || record.employeeName.toLowerCase().includes(filters.name.toLowerCase())) &&
          (filters.area === '' || record.employeeArea === filters.area) &&
          (!desdeDate || recordDateObj >= desdeDate) &&
          (!hastaDate || recordDateObj <= hastaDate)
        );
      }).sort((a,b) => (b.entradaTimestamp || b.salidaTimestamp || 0) - (a.entradaTimestamp || a.salidaTimestamp || 0));
    } else {
      // Default filter: last 20 hours
      const twentyHoursAgo = Date.now() - (20 * 60 * 60 * 1000);
      return dailyRecords.filter(record => {
        const recordTimestamp = record.entradaTimestamp || record.salidaTimestamp || 0;
        return recordTimestamp >= twentyHoursAgo;
      }).sort((a,b) => (b.entradaTimestamp || b.salidaTimestamp || 0) - (a.entradaTimestamp || a.salidaTimestamp || 0));
    }
  }, [dailyRecords, filters, manualFilterActive]);

  const paginatedRecords = useMemo(() => {
    if (!manualFilterActive) {
      return filteredRecords; // No pagination for default view
    }
    const startIndex = (currentPage - 1) * RECORDS_PER_PAGE;
    return filteredRecords.slice(startIndex, startIndex + RECORDS_PER_PAGE);
  }, [filteredRecords, currentPage, manualFilterActive]);

  const recordsToDisplay = manualFilterActive ? paginatedRecords : filteredRecords;
  
  const totalPages = Math.ceil(filteredRecords.length / RECORDS_PER_PAGE);

  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    if (filteredRecords.length === 0) {
      addToast("No hay datos para exportar.", "info");
      return;
    }
    
    setIsExportMenuOpen(false);
    const headers = ['Área', 'Nombre', 'Cargo', 'Fecha Principal (Entrada/Salida)', 'Entrada (Fecha y Hora)', 'Salida (Fecha y Hora)'];
    const data = filteredRecords.map(r => {
      let mainDate = r.date;
      if (r.entrada === "SIN REGISTRO" && r.salida && r.salida !== "SIN REGISTRO") {
         mainDate = r.salida.split('T')[0];
      }
      return [
        r.employeeArea, 
        r.employeeName, 
        r.employeePosition, 
        mainDate, 
        formatDisplayDateTime(r.entrada), 
        formatDisplayDateTime(r.salida)
      ];
    });

    const filtersString = manualFilterActive ? Object.entries(filters).filter(([, val]) => val).map(([key, val]) => `${key}: ${val}`).join(', ') || 'Sin filtros específicos' : 'Últimas 20 horas';

    switch (format) {
      case 'csv':
        exportToCSV(headers, data, "registros_horario");
        break;
      case 'excel':
        exportToExcel(headers, data, "registros_horario", "Registros");
        break;
      case 'pdf':
        exportToPDF("Reporte de Registros de Horario", headers, data, filtersString);
        break;
      default:
        addToast('Formato de exportación no soportado.', 'error');
        return;
    }

    addToast(`Registros exportados a ${format.toUpperCase()}.`, "success");
    addLog(actorUsername, `Exported Time Records to ${format.toUpperCase()}`, { 
        numberOfRecords: filteredRecords.length,
        filtersApplied: manualFilterActive ? filters : { default: 'last_20_hours' }
    });
  };
  
  const openEditModal = (recordId: string, field: 'entrada' | 'salida') => {
    const record = dailyRecords.find(r => r.id === recordId);
    if (!record) return;
    
    let currentValue: string | undefined;
    if (field === 'entrada') {
        if (record.entrada === "SIN REGISTRO") {
             currentValue = record.salida && record.salida !== "SIN REGISTRO" 
                ? record.salida 
                : formatDateToDateTimeLocal(new Date());
        } else {
             currentValue = record.entrada;
        }
    } else { // field === 'salida'
        if (record.salida === "SIN REGISTRO") {
            currentValue = record.entrada && record.entrada !== "SIN REGISTRO" 
                ? record.entrada 
                : formatDateToDateTimeLocal(new Date()); 
        } else {
            currentValue = record.salida;
        }
    }
    setNewDateTimeValue(currentValue || formatDateToDateTimeLocal(new Date()));

    setEditingRecord({ recordId, field, currentValue });
    setIsEditModalVisible(true);
  };

  const handleSaveEditedRecord = async () => {
    if (!editingRecord || !newDateTimeValue) return;

    const newTimestamp = new Date(newDateTimeValue).getTime();
    let recordToUpdate = dailyRecords.find(r => r.id === editingRecord.recordId);

    if (!recordToUpdate) return;
    recordToUpdate = { ...recordToUpdate }; 

    if (editingRecord.field === 'entrada') {
      recordToUpdate.entrada = newDateTimeValue;
      recordToUpdate.entradaTimestamp = newTimestamp;
      recordToUpdate.date = newDateTimeValue.split('T')[0]; // Update main date field if entrada changes
    } else { // field === 'salida'
      recordToUpdate.salida = newDateTimeValue;
      recordToUpdate.salidaTimestamp = newTimestamp;
      if (recordToUpdate.entrada === "SIN REGISTRO") {
        recordToUpdate.date = newDateTimeValue.split('T')[0];
      }
    }
    
    recordToUpdate.lastModified = Date.now();
    recordToUpdate.syncStatus = 'pending';

    const success = await addOrUpdateRecord(recordToUpdate);
    if (success) {
      addToast('Registro actualizado con éxito.', 'success');
      await addLog(actorUsername, 'Time Record Edited', {
        employeeId: recordToUpdate.employeeId,
        employeeName: recordToUpdate.employeeName,
        recordId: recordToUpdate.id,
        fieldEdited: editingRecord.field,
        oldValue: editingRecord.currentValue,
        newValue: newDateTimeValue
      });
      setIsEditModalVisible(false);
      setEditingRecord(null);
    } else {
        await addLog(actorUsername, 'Time Record Edit Failed', {
            employeeId: recordToUpdate.employeeId,
            recordId: recordToUpdate.id,
            field: editingRecord.field,
            error: "Failed to save record via useTimeRecords hook"
        });
    }
  };
  
  const handleDeleteRecord = (recordId: string) => {
    const rec = dailyRecords.find(r => r.id === recordId);
    if (rec) {
      setRecordToDelete(rec);
    } else {
      addToast("Registro no encontrado para eliminar.", "error");
    }
  };

  const handleConfirmDelete = async () => {
    if (!recordToDelete) return;

    const success = await deleteRecordById(recordToDelete.id);
    if (success) {
      addToast('Registro eliminado con éxito.', 'success');
      await addLog(actorUsername, 'Time Record Deleted', {
        employeeId: recordToDelete.employeeId,
        employeeName: recordToDelete.employeeName,
        recordId: recordToDelete.id,
        deletedData: {
          date: recordToDelete.date,
          entrada: recordToDelete.entrada,
          salida: recordToDelete.salida,
        },
      });
    } else {
      await addLog(actorUsername, 'Time Record Delete Failed', {
        recordId: recordToDelete.id,
        employeeName: recordToDelete.employeeName,
        error: 'Failed to delete record via useTimeRecords hook',
      });
    }
  };

  const uniqueAreas = useMemo(() => {
    const areas = new Set(activeEmployees.map(emp => emp.area));
    return Array.from(areas).sort();
  }, [activeEmployees]);

  if (isLoadingRecords || isLoadingEmployees) {
    return <div className="min-h-screen flex items-center justify-center dark:text-gray-200"><p>Cargando datos...</p></div>;
  }

  return (
    <div className="min-h-screen text-sap-dark-gray dark:text-gray-200">
      <div className="p-4 md:p-6 space-y-6">
        <h2 className="text-2xl font-semibold text-center text-sap-blue dark:text-sap-light-blue">
          Reloj Control - Espacio OX
        </h2>

        <Card> 
          <div className="grid md:grid-cols-3 gap-4 items-center">
            <div className="md:col-span-2 space-y-3">
              <Input
                type="search"
                id="busquedaEmpleado"
                placeholder="Buscar empleado por nombre..."
                aria-label="Buscar empleado"
                autoComplete="off"
                value={searchTerm}
                onChange={handleSearchChange}
              />
               {searchTerm && !selectedEmployeeId && (
                <div className="max-h-32 overflow-y-auto border rounded p-1 border-sap-border dark:border-gray-600 bg-white dark:bg-gray-700">
                    {activeEmployees.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase())).map(e => (
                        <div key={e.id} onClick={() => handleDirectSelect(e.id)} className="p-1 cursor-pointer hover:bg-sap-light-blue hover:text-white dark:hover:bg-blue-600">
                            {e.name}
                        </div>
                    ))}
                </div>
              )}
              <div className="flex space-x-2 justify-center">
                <Button onClick={() => handleRecordAction('entrada')} className="flex-1 bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-500">Entrada</Button>
                <Button onClick={() => handleRecordAction('salida')} className="flex-1 bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-500">Salida</Button>
              </div>
            </div>
            <div className="space-y-2 text-center md:text-right">
              <div className="font-semibold text-lg text-sap-dark-gray dark:text-gray-100">
                {currentDateTime.toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
              <div 
                className="font-mono text-3xl cursor-pointer text-sap-blue dark:text-sap-light-blue"
                onClick={toggleClockFormat}
                title={is24HourFormat ? "Cambiar a formato AM/PM" : "Cambiar a formato 24 horas"}
              >
                {currentDateTime.toLocaleTimeString('es-CL', { hour12: !is24HourFormat })}
              </div>
            </div>
          </div>
        </Card>

        <div>
          <Button 
            onClick={() => setIsFiltersVisible(!isFiltersVisible)}
            className="w-full flex justify-between items-center bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200"
          >
            Tabla de Registros / Filtros 
            <ChevronDownIcon className={`w-5 h-5 transform transition-transform ${isFiltersVisible ? 'rotate-180' : ''}`} />
          </Button>
          {isFiltersVisible && (
            <Card className="mt-2"> 
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <Input label="Nombre" name="name" value={filters.name} onChange={handleFilterChange} />
                <div>
                  <label htmlFor="filtroArea" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Área:</label>
                  <select 
                    id="filtroArea" 
                    name="area" 
                    value={filters.area} 
                    onChange={handleFilterChange}
                    className="block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-sap-blue focus:border-sap-blue sm:text-sm border-sap-border dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 dark:focus:ring-sap-light-blue dark:focus:border-sap-light-blue"
                  >
                    <option value="">Todos</option>
                    {uniqueAreas.map((area: string) => <option key={area} value={area}>{area}</option>)}
                  </select>
                </div>
                <Input label="Desde (Fecha Principal)" name="desde" type="date" value={filters.desde} onChange={handleFilterChange} />
                <Input label="Hasta (Fecha Principal)" name="hasta" type="date" value={filters.hasta} onChange={handleFilterChange} />
              </div>
              <div className="flex space-x-2">
                <Button onClick={clearFilters} variant="secondary">Limpiar Filtros</Button>
              </div>
            </Card>
          )}
        </div>
        
        <Card> 
          <div className="flex flex-wrap gap-2 justify-between items-center mb-2">
            <h3 className="text-lg font-semibold">{manualFilterActive ? 'Resultados del Filtro Manual' : 'Registros de las Últimas 20 Horas'}</h3>
            <div className="flex items-center gap-4">
                <span className="text-sm text-gray-500 dark:text-gray-400">{filteredRecords.length} registro(s)</span>
                <div className="relative inline-block text-left">
                  <Button onClick={() => setIsExportMenuOpen(prev => !prev)} className="flex items-center">
                    <ExportIcon className="mr-1"/> Exportar
                  </Button>
                  {isExportMenuOpen && (
                    <div ref={exportMenuRef} className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
                      <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                        <button onClick={() => handleExport('csv')} className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700" role="menuitem">
                          <DocumentTextIcon className="w-5 h-5 mr-2" /> Exportar a CSV
                        </button>
                        <button onClick={() => handleExport('excel')} className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700" role="menuitem">
                          <TableCellsIcon className="w-5 h-5 mr-2" /> Exportar a Excel
                        </button>
                        <button onClick={() => handleExport('pdf')} className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700" role="menuitem">
                          <DocumentArrowDownIcon className="w-5 h-5 mr-2" /> Exportar a PDF
                        </button>
                      </div>
                    </div>
                  )}
                </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-sap-border dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider hidden sm:table-cell">Área</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">Nombre</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider hidden sm:table-cell">Cargo</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">Entrada</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">Salida</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-sap-border dark:divide-gray-700">
                {recordsToDisplay.length > 0 ? recordsToDisplay.map(record => (
                  <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-2 whitespace-nowrap text-sm hidden sm:table-cell">{record.employeeArea}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">{record.employeeName}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm hidden sm:table-cell">{record.employeePosition}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">{formatDisplayDateTime(record.entrada)}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">{formatDisplayDateTime(record.salida)}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm space-x-1">
                      <Button size="sm" onClick={() => openEditModal(record.id, 'entrada')} title="Editar Entrada" className="p-1"> <EditIcon /> </Button>
                      <Button size="sm" onClick={() => openEditModal(record.id, 'salida')} title="Editar Salida" className="p-1"> <EditIcon /> </Button>
                      <Button size="sm" variant="danger" onClick={() => handleDeleteRecord(record.id)} title="Eliminar Registro" className="p-1"> <DeleteIcon /> </Button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-4 text-center text-sm">{manualFilterActive ? 'No hay registros que coincidan con su filtro.' : 'No hay registros en las últimas 20 horas.'}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {manualFilterActive && filteredRecords.length > RECORDS_PER_PAGE && (
            <div className="mt-4 flex justify-between items-center">
              <Button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                variant="secondary"
              >
                Anterior
              </Button>
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                variant="secondary"
              >
                Siguiente
              </Button>
            </div>
          )}
        </Card>
      </div>

      {isEditModalVisible && editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4">
          <Card title={`Editar ${editingRecord.field === 'entrada' ? 'Entrada' : 'Salida'}`} className="w-full max-w-md relative"> 
            <div className="space-y-4">
              <Input
                label="Nueva Fecha y Hora"
                type="datetime-local"
                value={newDateTimeValue}
                onChange={(e) => setNewDateTimeValue(e.target.value)}
              />
              <div className="flex justify-end space-x-2">
                <Button variant="secondary" onClick={() => setIsEditModalVisible(false)}>Cancelar</Button>
                <Button onClick={handleSaveEditedRecord}>Aceptar</Button>
              </div>
            </div>
             <button 
                onClick={() => setIsEditModalVisible(false)} 
                className="absolute top-3 right-3 p-1 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                aria-label="Cerrar modal"
              >
                <CloseIcon className="w-5 h-5"/>
            </button>
          </Card>
        </div>
      )}

      {recordToDelete && (
        <ConfirmationModal
          isOpen={!!recordToDelete}
          onClose={() => setRecordToDelete(null)}
          onConfirm={handleConfirmDelete}
          title="Confirmar Eliminación de Registro"
          message={`¿Está seguro de que desea eliminar este registro horario para ${recordToDelete.employeeName}?`}
          confirmText="Eliminar"
          confirmVariant="danger"
        />
      )}

      {showMissedClockOutConfirmation && pendingClockInDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 p-4" role="dialog" aria-modal="true" aria-labelledby="missed-clockout-title">
          <Card className="w-full max-w-lg relative">
            <button 
                onClick={handleCancelNewClockIn} 
                className="absolute top-3 right-3 p-1 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                aria-label="Cerrar modal de confirmación"
            >
                <CloseIcon className="w-5 h-5"/>
            </button>
            <div className="p-4">
                <div className="flex items-start">
                    <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900 sm:mx-0 sm:h-10 sm:w-10">
                        <ExclamationTriangleIcon className="h-6 w-6 text-yellow-500 dark:text-yellow-400" />
                    </div>
                    <div className="ml-3 text-left">
                        <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100" id="missed-clockout-title">
                            Entrada Pendiente de Salida
                        </h3>
                        <div className="mt-2">
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                                {pendingClockInDetails.employee.name} tiene una entrada anterior del <strong className="font-semibold">{formatDisplayDateTime(pendingClockInDetails.openEntry.entrada)}</strong> sin marcar salida.
                            </p>
                            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                                ¿Desea marcar esta entrada anterior como 'SIN REGISTRO' y proceder con la nueva entrada?
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse rounded-b-lg">
                <Button
                    onClick={handleConfirmAutoCloseAndProceed}
                    variant="primary"
                    className="w-full sm:ml-3 sm:w-auto"
                >
                    Sí, marcar SIN REGISTRO y continuar
                </Button>
                <Button
                    onClick={handleCancelNewClockIn}
                    variant="secondary"
                    className="mt-3 w-full sm:mt-0 sm:w-auto"
                >
                    No, cancelar nueva entrada
                </Button>
            </div>
          </Card>
        </div>
      )}

      {showMissedClockInConfirmation && pendingClockOutEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 p-4" role="dialog" aria-modal="true" aria-labelledby="missed-clockin-title">
          <Card className="w-full max-w-lg relative">
            <button 
                onClick={handleCancelClockOutMissingEntry} 
                className="absolute top-3 right-3 p-1 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                aria-label="Cerrar modal de confirmación"
            >
                <CloseIcon className="w-5 h-5"/>
            </button>
            <div className="p-4">
                <div className="flex items-start">
                    <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900 sm:mx-0 sm:h-10 sm:w-10">
                        <ExclamationTriangleIcon className="h-6 w-6 text-yellow-500 dark:text-yellow-400" />
                    </div>
                    <div className="ml-3 text-left">
                        <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100" id="missed-clockin-title">
                            Salida sin Entrada Registrada
                        </h3>
                        <div className="mt-2">
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                                {pendingClockOutEmployee.name} no tiene una entrada registrada para marcar esta salida.
                            </p>
                            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                                ¿Desea registrar una entrada como 'SIN REGISTRO' y continuar con la salida actual?
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse rounded-b-lg">
                <Button
                    onClick={handleConfirmAutoCreateEntryAndClockOut}
                    variant="primary"
                    className="w-full sm:ml-3 sm:w-auto"
                >
                    Sí, registrar ENTRADA SIN REGISTRO y continuar
                </Button>
                <Button
                    onClick={handleCancelClockOutMissingEntry}
                    variant="secondary"
                    className="mt-3 w-full sm:mt-0 sm:w-auto"
                >
                    No, cancelar salida
                </Button>
            </div>
          </Card>
        </div>
      )}

        {showResponsibleUserClockOutConfirmation && employeeToConfirmClockOut && (
            <ConfirmationModal
                isOpen={!!showResponsibleUserClockOutConfirmation}
                onClose={() => {
                    setShowResponsibleUserClockOutConfirmation(false);
                    setEmployeeToConfirmClockOut(null);
                }}
                onConfirm={handleConfirmResponsibleUserClockOut}
                title="Responsable de Turno Activo"
                message={
                    <>
                        <p>El empleado <strong>{employeeToConfirmClockOut.name}</strong> es el responsable del turno activo en el Libro de Novedades.</p>
                        <p className="mt-2 text-red-600 dark:text-red-400">¿Desea registrar la salida y <strong>cerrar automáticamente el turno</strong>? Esta acción finalizará su sesión.</p>
                    </>
                }
                confirmText="Sí, cerrar turno y salir"
                confirmVariant="danger"
            />
        )}
    </div>
  );
};

export default TimeControlPage;