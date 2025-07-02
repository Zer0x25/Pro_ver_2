import React, { useState, useCallback, useEffect, useMemo, Dispatch, SetStateAction, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Employee, AuditLog, UserRole, Syncable } from '../../types';
import Button from '../ui/Button';
import Input from '../ui/Input';
import ConfirmationModal from '../ui/ConfirmationModal';
import { 
    PlusCircleIcon, ChevronDownIcon, EditIcon, DeleteIcon, ChevronUpIcon,
    ExportIcon, DocumentTextIcon, TableCellsIcon, DocumentArrowDownIcon 
} from '../ui/icons';
import { useEmployees } from '../../contexts/EmployeeContext';
import { useLogs } from '../../hooks/useLogs';
import { useToasts } from '../../hooks/useToasts';
import { useAuth } from '../../hooks/useAuth';
import { useTheoreticalShifts } from '../../hooks/useTheoreticalShifts';
import { ROUTES } from '../../constants';
import { exportToCSV, exportToExcel, exportToPDF } from '../../utils/exportUtils';
import { idbGetAll } from '../../utils/indexedDB';

const isValidChileanRut = (rut: string): boolean => {
  if (!/^[0-9]+-[0-9kK]{1}$/.test(rut)) return false;
  const [rutBody, dv] = rut.split('-');
  let M = 0, S = 1;
  for (let T = parseInt(rutBody); T; T = Math.floor(T / 10)) {
    S = (S + T % 10 * (9 - M++ % 6)) % 11;
  }
  const calculatedDv = S ? String(S - 1) : 'K';
  return calculatedDv.toUpperCase() === dv.toUpperCase();
};

const formatDisplayDateTime = (isoDateTimeString?: string): string => {
  if (!isoDateTimeString) return '-';
  try {
    const date = new Date(isoDateTimeString);
    if (isNaN(date.getTime())) return '-';
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  } catch (e) {
    console.error("Error formatting date:", isoDateTimeString, e);
    return '-';
  }
};

interface EmployeeFormProps {
  onSave: () => Promise<boolean>;
  onCancel: () => void;
  employeeData: Partial<Omit<Employee, 'id' | 'isActive' | keyof Syncable>>;
  setEmployeeData: Dispatch<SetStateAction<Partial<Omit<Employee, 'id' | 'isActive' | keyof Syncable>>>>;
  isEditing: boolean;
  nextEmployeeId: string;
  existingEmployees: Employee[];
  employeeIdToEdit?: string;
  areaList: string[];
}

const EmployeeForm: React.FC<EmployeeFormProps> = ({ onSave, onCancel, employeeData, setEmployeeData, isEditing, nextEmployeeId, existingEmployees, employeeIdToEdit, areaList }) => {
  const [rutError, setRutError] = useState('');
  const { addToast } = useToasts();
  
  const dropdownAreaOptions = useMemo(() => {
    // Include the current employee's area in the list, even if it's not in the global list, to prevent data loss on edit.
    // Use a Set to ensure unique values.
    const currentArea = employeeData.area || '';
    const combinedList = [...new Set([currentArea, ...areaList])].filter(Boolean); // filter(Boolean) removes empty strings
    return combinedList.sort((a,b) => a.localeCompare(b));
  }, [areaList, employeeData.area]);
  
  const validateAndSetRut = (rutInput: string) => {
    // Format RUT input first
    let value = rutInput.toUpperCase().replace(/[^0-9Kk-]/g, ''); 
    let formattedRut = '';
    const parts = value.split('-');
    const body = parts[0].replace(/[^0-9]/g, '').slice(0, 8);
    let dv = parts.length > 1 ? parts[1].replace(/[^0-9Kk]/g, '').slice(0, 1) : '';

    if (body) {
        formattedRut = body;
        if (dv || value.includes('-')) {
            formattedRut += '-' + dv;
        }
    } else if (value.includes('-')) {
        formattedRut = '-' + dv;
    } else {
      formattedRut = dv;
    }
    
    setEmployeeData(prev => ({ ...prev, rut: formattedRut }));

    if (formattedRut.length === 0) {
      setRutError('');
      return true; // Allow empty while typing
    }
    
    // Check for duplicates first for any RUT
    const isDuplicate = existingEmployees.some(
      emp => emp.rut === formattedRut && emp.id !== employeeIdToEdit
    );
    if (isDuplicate) {
      setRutError('Error: RUT ya Registrado.');
      return false;
    }

    // Now, check for validity
    // The special RUT 11111111-1 is accepted as valid without mod 11 check
    if (formattedRut === '11111111-1') {
      setRutError('');
      return true;
    }
    
    if (!isValidChileanRut(formattedRut)) {
      setRutError('RUT inválido. Verifique el dígito verificador.');
      return false;
    }

    // If it's a valid Chilean RUT and not a duplicate, it's good.
    setRutError('');
    return true;
  };

  const handleRutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    validateAndSetRut(e.target.value);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeData.name?.trim() || !employeeData.position?.trim() || !employeeData.area?.trim() || !employeeData.rut?.trim()) {
      addToast("Todos los campos (Nombre, RUT, Cargo, Área) son requeridos.", "warning");
      return;
    }

    if (!validateAndSetRut(employeeData.rut)) {
        addToast(rutError || "El RUT ingresado no es válido o ya está registrado.", "error");
        return;
    }
    await onSave();
  };

  return (
    <div className="border-b-2 border-dashed border-gray-300 dark:border-gray-600 mb-4 pb-4">
      <h3 className="text-lg font-semibold mb-3">{isEditing ? 'Editar Empleado' : 'Nuevo Empleado'}</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        {!isEditing && <p className="text-sm text-sap-medium-gray dark:text-gray-400">Próximo ID: {nextEmployeeId || 'Calculando...'}</p>}
        <Input
          label="Nombre Completo"
          id="employeeName"
          type="text"
          value={employeeData.name || ''}
          onChange={(e) => setEmployeeData(prev => ({ ...prev, name: e.target.value }))}
          required
          placeholder="Ej: Juan Pérez"
        />
        <Input
          label="RUT"
          id="employeeRut"
          type="text"
          value={employeeData.rut || ''}
          onChange={handleRutChange}
          required
          placeholder="Ej: 12345678-9 o 11111111-1"
          maxLength={10}
          error={rutError}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Cargo"
            id="employeePosition"
            type="text"
            value={employeeData.position || ''}
            onChange={(e) => setEmployeeData(prev => ({ ...prev, position: e.target.value }))}
            required
            placeholder="Ej: Desarrollador Frontend"
          />
          <div>
            <label htmlFor="employeeArea" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Área
            </label>
            <select
              id="employeeArea"
              value={employeeData.area || ''}
              onChange={(e) => setEmployeeData(prev => ({ ...prev, area: e.target.value }))}
              required
              className="block w-full px-3 py-2 border border-sap-border dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-sap-blue focus:border-sap-blue dark:focus:ring-sap-light-blue dark:focus:border-sap-light-blue sm:text-sm"
            >
              <option value="" disabled>-- Seleccione un Área --</option>
              {dropdownAreaOptions.map(area => (
                <option key={area} value={area}>{area}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex space-x-2">
          <Button type="submit" variant="primary" className="flex items-center">
            <PlusCircleIcon className="w-5 h-5 mr-2" />
            {isEditing ? 'Actualizar Empleado' : 'Agregar Empleado'}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
};


const EMPLOYEES_PER_PAGE = 10;
const LOGS_PER_PAGE = 20;

const ConfigurationPage: React.FC = () => {
  const { employees, addEmployee, updateEmployee, toggleEmployeeStatus, softDeleteEmployee, isLoadingEmployees, getNextEmployeeId } = useEmployees();
  const { logs, isLoadingLogs, clearAllLogs, addLog } = useLogs();
  const { addToast } = useToasts();
  const { currentUser } = useAuth();
  const { areaList, isLoadingShifts } = useTheoreticalShifts();

  const [isFormVisible, setIsFormVisible] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [employeeData, setEmployeeData] = useState<Partial<Omit<Employee, 'id'|'isActive'|keyof Syncable>>>({});
  const [nextId, setNextId] = useState('');
  
  const [isAuditLogOpen, setIsAuditLogOpen] = useState(false);
  const [searchTermTable, setSearchTermTable] = useState('');
  const [currentPageTable, setCurrentPageTable] = useState(1);
  const [logCurrentPage, setLogCurrentPage] = useState(1);
  const [logSearchTerm, setLogSearchTerm] = useState('');
  
  const [sortConfig, setSortConfig] = useState<{ key: keyof Employee; direction: 'ascending' | 'descending' } | null>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  
  const actorUsername = useMemo(() => currentUser?.username || 'System', [currentUser]);

  const cardHeaderClass = "px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-sap-border dark:border-gray-600 flex justify-between items-center";
  const cardBodyClass = "p-4 text-gray-800 dark:text-gray-200";
  const cardContainerClass = "bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden";
  const headerBaseClasses = "flex justify-between items-center w-full p-4 text-lg font-semibold text-left text-sap-blue dark:text-sap-light-blue bg-white dark:bg-gray-800 shadow-md cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sap-blue dark:focus-visible:ring-sap-light-blue";
  const headerOpenClasses = "rounded-t-lg border-b border-sap-border dark:border-gray-600";
  const headerClosedClasses = "rounded-lg";
  const contentClasses = "bg-white dark:bg-gray-800 shadow-md rounded-b-lg overflow-hidden";
  const thSortableClass = "px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider cursor-pointer group select-none";
  
  useEffect(() => {
    if(!isFormVisible) {
        getNextEmployeeId().then(setNextId);
    }
  }, [isFormVisible, getNextEmployeeId])
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleOpenNewForm = () => {
    setEditingEmployee(null);
    setEmployeeData({});
    setIsFormVisible(true);
  };
  
  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setEmployeeData({
        name: employee.name,
        rut: employee.rut,
        position: employee.position,
        area: employee.area,
    });
    setIsFormVisible(true);
    document.getElementById('employee-management-card')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCancel = () => {
    setEditingEmployee(null);
    setEmployeeData({});
    setIsFormVisible(false);
  };
  
  const handleSave = async (): Promise<boolean> => {
    const dataToSave = employeeData as Omit<Employee, 'id' | 'isActive' | keyof Syncable>;
    
    // Validation is now handled in EmployeeForm's handleSubmit before calling onSave.
    
    let success = false;
    if (editingEmployee) {
      success = await updateEmployee({ ...editingEmployee, ...dataToSave });
    } else {
      const newEmp = await addEmployee(dataToSave);
      success = !!newEmp;
    }

    if (success) {
      handleCancel();
    }
    return success;
  };
  
  const handleDelete = (employee: Employee) => {
    setEmployeeToDelete(employee);
  };
  
  const handleConfirmDelete = async () => {
    if (!employeeToDelete) return;
    await softDeleteEmployee(employeeToDelete.id, actorUsername);
  };

  const requestSort = useCallback((key: keyof Employee) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
        direction = 'descending';
    } else if (sortConfig && sortConfig.key === key && sortConfig.direction === 'descending') {
        setSortConfig(null); // Third click removes sort
        return;
    }
    setSortConfig({ key, direction });
    setCurrentPageTable(1);
  }, [sortConfig]);
  
  const getSortIndicator = (key: keyof Employee) => {
    if (!sortConfig || sortConfig.key !== key) {
        return <ChevronDownIcon className="inline-block w-4 h-4 ml-1 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />;
    }
    if (sortConfig.direction === 'ascending') {
        return <ChevronUpIcon className="inline-block w-4 h-4 ml-1 text-sap-blue dark:text-sap-light-blue" />;
    }
    return <ChevronDownIcon className="inline-block w-4 h-4 ml-1 text-sap-blue dark:text-sap-light-blue" />;
  };

  const processedEmployees = useMemo(() => {
    let sortableItems = [...employees]; // `employees` from context is already filtered for isDeleted: false

    if (searchTermTable) {
        const lowerSearchTerm = searchTermTable.toLowerCase();
        sortableItems = sortableItems.filter(emp =>
            emp.name.toLowerCase().includes(lowerSearchTerm) ||
            (emp.rut && emp.rut.toLowerCase().includes(lowerSearchTerm))
        );
    }

    if (sortConfig !== null) {
        sortableItems.sort((a, b) => {
            const key = sortConfig.key;

            const valA = a[key];
            const valB = b[key];

            if (valA === undefined || valA === null) return 1;
            if (valB === undefined || valB === null) return -1;
            
            if (typeof valA === 'boolean' && typeof valB === 'boolean') {
                if (valA === valB) return 0;
                if (sortConfig.direction === 'ascending') {
                    return valA ? -1 : 1;
                }
                return valA ? 1 : -1;
            }
            
            if (typeof valA === 'string' && typeof valB === 'string') {
                 return sortConfig.direction === 'ascending' 
                    ? valA.localeCompare(valB, 'es', { sensitivity: 'base' }) 
                    : valB.localeCompare(valA, 'es', { sensitivity: 'base' });
            }
            
            if (valA < valB) {
                return sortConfig.direction === 'ascending' ? -1 : 1;
            }
            if (valA > valB) {
                return sortConfig.direction === 'ascending' ? 1 : -1;
            }
            return 0;
        });
    }

    return sortableItems;
}, [employees, searchTermTable, sortConfig]);


  const paginatedEmployees = useMemo(() => {
    const startIndex = (currentPageTable - 1) * EMPLOYEES_PER_PAGE;
    return processedEmployees.slice(startIndex, startIndex + EMPLOYEES_PER_PAGE);
  }, [processedEmployees, currentPageTable]);

  const totalTablePages = useMemo(() => {
    return Math.ceil(processedEmployees.length / EMPLOYEES_PER_PAGE);
  }, [processedEmployees.length]);

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

  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    if (processedEmployees.length === 0) {
      addToast("No hay datos para exportar.", "info");
      return;
    }
    
    setIsExportMenuOpen(false);
    const headers = ['ID', 'Nombre', 'RUT', 'Cargo', 'Área', 'Estado'];
    const data = processedEmployees.map(emp => [
        emp.id, emp.name, emp.rut, emp.position, emp.area, emp.isActive ? 'Activo' : 'Inactivo'
    ]);

    const filtersString = searchTermTable ? `Filtro aplicado: "${searchTermTable}"` : 'Sin filtros específicos';

    switch (format) {
      case 'csv':
        exportToCSV(headers, data, "lista_empleados");
        break;
      case 'excel':
        exportToExcel(headers, data, "lista_empleados", "Empleados");
        break;
      case 'pdf':
        exportToPDF("Lista de Empleados", headers, data, filtersString, { 5: 'status' });
        break;
      default:
        addToast('Formato de exportación no soportado.', 'error');
        return;
    }

    addToast(`Lista de empleados exportada a ${format.toUpperCase()}.`, "success");
    addLog(actorUsername, `Exported Employees to ${format.toUpperCase()}`, { 
        numberOfRecords: processedEmployees.length,
        filter: searchTermTable || 'none'
    });
  };

  if (isLoadingEmployees || isLoadingLogs || isLoadingShifts) {
    return <div className="min-h-screen flex items-center justify-center dark:text-gray-200"><p>Cargando datos...</p></div>;
  }
  
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-sap-dark-gray dark:text-gray-100">Configuración</h1>

      <div id="employee-management-card" className={cardContainerClass}>
        <div className={cardHeaderClass}>
          <h3 className="text-lg font-medium leading-6 text-sap-dark-gray dark:text-gray-100">
            Gestión de Empleados
          </h3>
          {!isFormVisible && (
            <Button onClick={handleOpenNewForm} size="sm" className="flex items-center">
              <PlusCircleIcon className="w-5 h-5 mr-1" /> Agregar Empleado
            </Button>
          )}
        </div>
        <div className={cardBodyClass}>
          {isFormVisible && (
            <EmployeeForm 
              onSave={handleSave}
              onCancel={handleCancel}
              employeeData={employeeData}
              setEmployeeData={setEmployeeData}
              isEditing={!!editingEmployee}
              nextEmployeeId={nextId}
              existingEmployees={employees}
              employeeIdToEdit={editingEmployee?.id}
              areaList={areaList}
            />
          )}

          <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-2">
            <Input
                type="search"
                placeholder="Buscar por Nombre o RUT..."
                value={searchTermTable}
                onChange={(e) => {
                setSearchTermTable(e.target.value);
                setCurrentPageTable(1);
                }}
                className="w-full sm:w-auto flex-grow"
                aria-label="Buscar empleados"
            />
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

          {isLoadingEmployees ? <p>Cargando empleados...</p> : paginatedEmployees.length === 0 ? (
            <p className="text-sap-medium-gray dark:text-gray-400 text-center py-4">
              {searchTermTable ? "No se encontraron empleados con ese criterio." : "No hay empleados registrados aún."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-sap-border dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className={thSortableClass} onDoubleClick={() => requestSort('id')}>
                      <div className="flex items-center">ID{getSortIndicator('id')}</div>
                    </th>
                    <th className={thSortableClass} onDoubleClick={() => requestSort('name')}>
                       <div className="flex items-center">Nombre{getSortIndicator('name')}</div>
                    </th>
                    <th className={thSortableClass} onDoubleClick={() => requestSort('rut')}>
                       <div className="flex items-center">RUT{getSortIndicator('rut')}</div>
                    </th>
                    <th className={thSortableClass} onDoubleClick={() => requestSort('position')}>
                       <div className="flex items-center">Cargo{getSortIndicator('position')}</div>
                    </th>
                    <th className={thSortableClass} onDoubleClick={() => requestSort('area')}>
                       <div className="flex items-center">Área{getSortIndicator('area')}</div>
                    </th>
                    <th className={thSortableClass} onDoubleClick={() => requestSort('isActive')}>
                       <div className="flex items-center">Estado{getSortIndicator('isActive')}</div>
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-sap-border dark:divide-gray-700">
                  {paginatedEmployees.map(emp => (
                    <tr key={emp.id} className={`${!emp.isActive ? 'bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-800/40' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{emp.id}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{emp.name}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{emp.rut || '-'}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{emp.position}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{emp.area}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">
                        <button
                          onClick={() => toggleEmployeeStatus(emp.id)}
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full cursor-pointer transition-transform transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${emp.isActive ? 'bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100 focus:ring-green-500' : 'bg-red-100 text-red-800 dark:bg-red-700 dark:text-red-100 focus:ring-red-500'}`}
                          title={emp.isActive ? "Click para desactivar" : "Click para activar"}
                        >
                          {emp.isActive ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm space-x-2">
                        <Button size="sm" onClick={() => handleEdit(emp)} title="Editar Empleado"><EditIcon /></Button>
                        {currentUser?.role === 'Administrador' && (
                            <Button
                                size="sm"
                                variant="danger"
                                onClick={() => handleDelete(emp)}
                                title="Archivar empleado"
                            >
                                <DeleteIcon />
                            </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {totalTablePages > 1 && (
            <div className="mt-4 flex justify-between items-center">
              <Button onClick={() => setCurrentPageTable(prev => Math.max(1, prev - 1))} disabled={currentPageTable === 1} size="sm">Anterior</Button>
              <span className="text-sm text-sap-medium-gray dark:text-gray-400">Página {currentPageTable} de {totalTablePages}</span>
              <Button onClick={() => setCurrentPageTable(prev => Math.min(totalTablePages, prev + 1))} disabled={currentPageTable === totalTablePages} size="sm">Siguiente</Button>
            </div>
          )}
        </div>
      </div>
      
      {employeeToDelete && (
        <ConfirmationModal
            isOpen={!!employeeToDelete}
            onClose={() => setEmployeeToDelete(null)}
            onConfirm={handleConfirmDelete}
            title="Confirmar Archivamiento de Empleado"
            message={
                <>
                    <p>¿Está seguro de que desea archivar a <strong>{employeeToDelete.name}</strong>?</p>
                    <p className="mt-2 text-sm text-yellow-600 dark:text-yellow-400">El empleado será ocultado de las listas y no podrá ser seleccionado. Esta acción es reversible desde el backend.</p>
                </>
            }
            confirmText="Sí, Archivar"
            confirmVariant="danger"
        />
      )}

      <div className="mb-6">
        <div
          className={`${headerBaseClasses} ${isAuditLogOpen ? headerOpenClasses : headerClosedClasses}`}
          onClick={() => setIsAuditLogOpen(!isAuditLogOpen)}
          role="button" tabIndex={0} onKeyPress={(e) => { if (e.key === 'Enter' || e.key === ' ') setIsAuditLogOpen(!isAuditLogOpen); }}
          aria-expanded={isAuditLogOpen}
          aria-controls="audit-log-content"
        >
          <span>Logs de Auditoría</span>
          <ChevronDownIcon className={`w-5 h-5 transform transition-transform ${isAuditLogOpen ? '' : '-rotate-180'}`} />
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

              {isLoadingLogs ? <p>Cargando logs...</p> : paginatedLogs.length === 0 ? (
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
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{formatDisplayDateTime(log.timestamp)}</td>
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
