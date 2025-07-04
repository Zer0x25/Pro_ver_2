
import React, { useState, useEffect, useMemo, useCallback, useRef, Dispatch, SetStateAction } from 'react';
import { Employee, Syncable, UserRole } from '../../types';
import { useEmployees } from '../../contexts/EmployeeContext';
import { useAuth } from '../../hooks/useAuth';
import { useToasts } from '../../hooks/useToasts';
import { useTheoreticalShifts } from '../../hooks/useTheoreticalShifts';
import { useLogs } from '../../hooks/useLogs';
import Button from '../ui/Button';
import Input from '../ui/Input';
import ConfirmationModal from '../ui/ConfirmationModal';
import SortableHeader from '../ui/SortableHeader';
import { 
    PlusCircleIcon, EditIcon, DeleteIcon,
    ExportIcon, DocumentTextIcon, TableCellsIcon, DocumentArrowDownIcon 
} from '../ui/icons';
import { exportToCSV, exportToExcel, exportToPDF } from '../../utils/exportUtils';

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
    const currentArea = employeeData.area || '';
    const combinedList = [...new Set([currentArea, ...areaList])].filter(Boolean);
    return combinedList.sort((a,b) => a.localeCompare(b));
  }, [areaList, employeeData.area]);
  
  const validateAndSetRut = (rutInput: string) => {
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
      return true;
    }
    
    const isDuplicate = existingEmployees.some(
      emp => emp.rut === formattedRut && emp.id !== employeeIdToEdit
    );
    if (isDuplicate) {
      setRutError('Error: RUT ya Registrado.');
      return false;
    }
    
    if (formattedRut === '11111111-1') {
      setRutError('');
      return true;
    }
    
    if (!isValidChileanRut(formattedRut)) {
      setRutError('RUT inválido. Verifique el dígito verificador.');
      return false;
    }

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

const EmployeeManagementPage: React.FC = () => {
  const { employees, addEmployee, updateEmployee, toggleEmployeeStatus, softDeleteEmployee, isLoadingEmployees, getNextEmployeeId } = useEmployees();
  const { addToast } = useToasts();
  const { currentUser } = useAuth();
  const { addLog } = useLogs();
  const { areaList, isLoadingShifts } = useTheoreticalShifts();
  
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [employeeData, setEmployeeData] = useState<Partial<Omit<Employee, 'id'|'isActive'|keyof Syncable>>>({});
  const [nextId, setNextId] = useState('');
  
  const [searchTermTable, setSearchTermTable] = useState('');
  const [currentPageTable, setCurrentPageTable] = useState(1);
  
  const [sortConfig, setSortConfig] = useState<{ key: keyof Employee; direction: 'ascending' | 'descending' } | null>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  
  const actorUsername = useMemo(() => currentUser?.username || 'System', [currentUser]);

  const cardHeaderClass = "px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-sap-border dark:border-gray-600 flex justify-between items-center";
  const cardBodyClass = "p-4 text-gray-800 dark:text-gray-200";
  const cardContainerClass = "bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden";

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
    }
    setSortConfig({ key, direction });
  }, [sortConfig]);

  const processedEmployees = useMemo(() => {
    let sortableItems = [...employees];

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
                if (sortConfig.direction === 'ascending') return valA ? -1 : 1;
                return valA ? 1 : -1;
            }
            
            if (typeof valA === 'string' && typeof valB === 'string') {
                 return sortConfig.direction === 'ascending' 
                    ? valA.localeCompare(valB, 'es', { sensitivity: 'base' }) 
                    : valB.localeCompare(valA, 'es', { sensitivity: 'base' });
            }
            
            if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
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

  const canSoftDelete = currentUser?.role === 'Administrador' || currentUser?.role === 'Usuario Elevado';
  const canEdit = currentUser?.role === 'Administrador' || currentUser?.role === 'Usuario Elevado' || currentUser?.role === 'Supervisor';

  if (isLoadingEmployees || isLoadingShifts) {
    return <div className="min-h-screen flex items-center justify-center dark:text-gray-200"><p>Cargando datos...</p></div>;
  }
  
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-sap-dark-gray dark:text-gray-100">Gestión de Empleados</h1>
      
      <div id="employee-management-card" className={cardContainerClass}>
        <div className={cardHeaderClass}>
          <h3 className="text-lg font-medium leading-6 text-sap-dark-gray dark:text-gray-100">
            Lista de Empleados
          </h3>
          {canEdit && !isFormVisible && (
            <Button onClick={handleOpenNewForm} size="sm" className="flex items-center">
              <PlusCircleIcon className="w-5 h-5 mr-1" /> Agregar Empleado
            </Button>
          )}
        </div>
        <div className={cardBodyClass}>
          {isFormVisible && canEdit && (
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
                    <SortableHeader title="ID" sortKey="id" sortConfig={sortConfig} onSort={requestSort} />
                    <SortableHeader title="Nombre" sortKey="name" sortConfig={sortConfig} onSort={requestSort} />
                    <SortableHeader title="RUT" sortKey="rut" sortConfig={sortConfig} onSort={requestSort} />
                    <SortableHeader title="Cargo" sortKey="position" sortConfig={sortConfig} onSort={requestSort} />
                    <SortableHeader title="Área" sortKey="area" sortConfig={sortConfig} onSort={requestSort} />
                    <SortableHeader title="Estado" sortKey="isActive" sortConfig={sortConfig} onSort={requestSort} />
                    {canEdit && <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">Acciones</th>}
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
                          onClick={() => canEdit && toggleEmployeeStatus(emp.id)}
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${canEdit ? 'cursor-pointer' : 'cursor-default'} transition-transform transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${emp.isActive ? 'bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100 focus:ring-green-500' : 'bg-red-100 text-red-800 dark:bg-red-700 dark:text-red-100 focus:ring-red-500'}`}
                          title={emp.isActive ? "Click para desactivar" : "Click para activar"}
                          disabled={!canEdit}
                        >
                          {emp.isActive ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>
                      {canEdit && (
                        <td className="px-4 py-2 whitespace-nowrap text-sm space-x-2">
                            <Button size="sm" onClick={() => handleEdit(emp)} title="Editar Empleado"><EditIcon /></Button>
                            {canSoftDelete && (
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
                      )}
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
    </div>
  );
};

export default EmployeeManagementPage;
