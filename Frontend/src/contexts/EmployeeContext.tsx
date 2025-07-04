import React, { createContext, useState, useEffect, ReactNode, useCallback, useContext, useMemo, useRef } from 'react';
import { Employee, EmployeeContextType, DailyTimeRecord, AssignedShift, Syncable } from '../types';
import { idbGetAll, idbPut, getCounterValue, setCounterValue, STORES, COUNTER_IDS, idbDelete, idbGetAllBy } from '../utils/indexedDB';
import { useLogs } from '../hooks/useLogs';
import { useAuth } from '../hooks/useAuth';
import { useToasts } from '../hooks/useToasts';

export const EmployeeContext = createContext<EmployeeContextType | undefined>(undefined);

interface EmployeeProviderProps {
  children: ReactNode;
}

export const EmployeeProvider: React.FC<EmployeeProviderProps> = ({ children }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const employeesRef = useRef(employees);
  employeesRef.current = employees;
  const [isLoadingEmployees, setIsLoadingEmployees] = useState<boolean>(true);
  const { addLog } = useLogs();
  const { currentUser } = useAuth();
  const { addToast } = useToasts();
  
  const loadEmployees = useCallback(async () => {
      setIsLoadingEmployees(true);
      try {
        const storedEmployees = await idbGetAll<Employee>(STORES.EMPLOYEES);
        // Filter out soft-deleted records for UI display
        setEmployees(storedEmployees.filter(e => !e.isDeleted).sort((a, b) => a.name.localeCompare(b.name)));
      } catch (error) {
        console.error("Error loading employees from IndexedDB:", error);
        addToast("Error cargando lista de empleados.", "error");
      } finally {
        setIsLoadingEmployees(false);
      }
  }, [addToast]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const activeEmployees = useMemo(() => {
    return employees.filter(emp => emp.isActive).sort((a, b) => a.name.localeCompare(b.name));
  }, [employees]);

  const getNextEmployeeId = useCallback(async (): Promise<string> => {
    const currentCounter = await getCounterValue(COUNTER_IDS.EMPLOYEE_ID, 1);
    return `EMP${String(currentCounter).padStart(3, '0')}`;
  }, []);

  const addEmployee = useCallback(async (employeeData: Omit<Employee, 'id' | 'isActive' | keyof Syncable>): Promise<Employee | null> => {
    const actor = currentUser?.username || 'System';
    try {
      const currentCounterVal = await getCounterValue(COUNTER_IDS.EMPLOYEE_ID, 1);
      const newId = `EMP${String(currentCounterVal).padStart(3, '0')}`;

      // This check should ideally be against all employees in DB, not just loaded ones
      const allEmployees = await idbGetAll<Employee>(STORES.EMPLOYEES);
      if (allEmployees.some(emp => emp.id === newId)) {
          console.error("Duplicate employee ID generated. Incrementing counter and retrying.");
          await setCounterValue(COUNTER_IDS.EMPLOYEE_ID, currentCounterVal + 1); 
          return addEmployee(employeeData); 
      }
      
      const newEmployee: Employee = { 
        ...employeeData, 
        id: newId, 
        isActive: true,
        isDeleted: false,
        lastModified: Date.now(),
        syncStatus: 'pending'
      };

      await idbPut<Employee>(STORES.EMPLOYEES, newEmployee);
      setEmployees(prevEmployees => 
        [...prevEmployees, newEmployee].sort((a, b) => a.name.localeCompare(b.name))
      );
      await setCounterValue(COUNTER_IDS.EMPLOYEE_ID, currentCounterVal + 1);
      await addLog(actor, 'Employee Added', { employeeId: newEmployee.id, name: newEmployee.name, rut: newEmployee.rut });
      addToast(`Empleado ${newEmployee.name} agregado.`, 'success');
      return newEmployee;
    } catch (error) {
      console.error("Error adding employee to IndexedDB:", error);
      await addLog(actor, 'Employee Add Failed', { name: employeeData.name, error: String(error) });
      addToast(`Error al agregar empleado ${employeeData.name}.`, 'error');
      return null;
    }
  }, [currentUser, addLog, addToast]);

  const updateEmployee = useCallback(async (employeeToUpdate: Employee): Promise<boolean> => {
    const actor = currentUser?.username || 'System';
    const updatedEmployee: Employee = {
        ...employeeToUpdate,
        lastModified: Date.now(),
        syncStatus: 'pending'
    };

    try {
      await idbPut<Employee>(STORES.EMPLOYEES, updatedEmployee);
      setEmployees(prevEmployees =>
        prevEmployees.map(emp => (emp.id === updatedEmployee.id ? updatedEmployee : emp))
        .filter(e => !e.isDeleted)
        .sort((a, b) => a.name.localeCompare(b.name))
      );
      return true;
    } catch (error) {
      console.error("Error updating employee in IndexedDB:", error);
      await addLog(actor, 'Employee Update Failed', { employeeId: updatedEmployee.id, error: String(error) });
      addToast(`Error al actualizar empleado ${updatedEmployee.name}.`, 'error');
      return false;
    }
  }, [currentUser, addLog, addToast]);


  const toggleEmployeeStatus = useCallback(async (employeeId: string): Promise<boolean> => {
    const actor = currentUser?.username || 'System';
    const employeeToToggle = employeesRef.current.find(emp => emp.id === employeeId);
    if (!employeeToToggle) {
      addToast('Empleado no encontrado.', 'error');
      return false;
    }
    
    const updatedEmployee = { ...employeeToToggle, isActive: !employeeToToggle.isActive };
    const success = await updateEmployee(updatedEmployee);

    if (success) {
      const statusMessage = updatedEmployee.isActive ? 'activado' : 'desactivado';
      await addLog(actor, `Employee ${updatedEmployee.isActive ? 'Activated' : 'Deactivated'}`, { employeeId: updatedEmployee.id, name: updatedEmployee.name });
      addToast(`Empleado ${updatedEmployee.name} ${statusMessage}.`, 'success');
    }
    return success;
  }, [updateEmployee, addLog, addToast]);

  
  const softDeleteEmployee = useCallback(async (employeeId: string, actorUsername: string): Promise<boolean> => {
    const employeeToDelete = employeesRef.current.find(e => e.id === employeeId);
    if (!employeeToDelete) {
        addToast("Empleado no encontrado para eliminar.", "error");
        return false;
    }
    
    const timeRecords = await idbGetAll<DailyTimeRecord>(STORES.DAILY_TIME_RECORDS);
    if (timeRecords.some(r => r.employeeId === employeeId)) {
        addToast("No se puede archivar. El empleado tiene registros de horario. Desactívelo en su lugar.", "error", 8000);
        return false;
    }

    const assignedShifts = await idbGetAll<AssignedShift>(STORES.ASSIGNED_SHIFTS);
    if (assignedShifts.some(a => a.employeeId === employeeId && !a.isDeleted)) {
        addToast("No se puede archivar. El empleado tiene turnos asignados activos. Elimine las asignaciones primero.", "error", 8000);
        return false;
    }
    
    const softDeletedEmployee = { ...employeeToDelete, isDeleted: true };
    const success = await updateEmployee(softDeletedEmployee);
    
    if (success) {
        await addLog(actorUsername, 'Employee Soft Deleted', { employeeId, name: employeeToDelete.name });
        addToast(`Empleado '${employeeToDelete.name}' archivado.`, 'success');
    }
    return success;
  }, [updateEmployee, addLog, addToast]);

  const getEmployeeById = useCallback((employeeId: string): Employee | undefined => {
    return employeesRef.current.find(emp => emp.id === employeeId);
  }, []);

  return (
    <EmployeeContext.Provider value={{ 
      employees, 
      activeEmployees, 
      isLoadingEmployees, 
      addEmployee, 
      updateEmployee, 
      toggleEmployeeStatus, 
      softDeleteEmployee,
      getEmployeeById, 
      getNextEmployeeId 
    }}>
      {children}
    </EmployeeContext.Provider>
  );
};

export const useEmployees = () => {
  const context = useContext(EmployeeContext);
  if (context === undefined) {
    throw new Error('useEmployees must be used within an EmployeeProvider');
  }
  return context;
};