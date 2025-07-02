import React, { useState, useEffect, useMemo } from 'react';
import { User, UserRole, Syncable } from '../../types';
import { useUsers } from '../../hooks/useUsers';
import { useAuth } from '../../hooks/useAuth'; 
import { useToasts } from '../../hooks/useToasts';
import { useEmployees } from '../../contexts/EmployeeContext';
import Button from '../ui/Button';
import Input from '../ui/Input';
import ConfirmationModal from '../ui/ConfirmationModal';
import { PlusCircleIcon, EditIcon, DeleteIcon } from '../ui/icons';
import { useTheoreticalShifts } from '../../hooks/useTheoreticalShifts';

const USER_ROLES: UserRole[] = ['Usuario', 'Supervisor', 'Administrador'];
const USERS_PER_PAGE = 10;

const UserManagementPage: React.FC = () => {
  const { users, isLoadingUsers, addUser, updateUser, deleteUser } = useUsers();
  const { activeEmployees, employees, isLoadingEmployees: isLoadingEmps } = useEmployees();
  const { addToast } = useToasts();
  const { currentUser } = useAuth(); 
  const { globalMaxWeeklyHours, updateGlobalMaxWeeklyHours, isLoadingShifts, areaList, updateAreaList } = useTheoreticalShifts();

  const [isFormVisible, setIsFormVisible] = useState(false);
  
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('Usuario');
  const [linkedEmployeeId, setLinkedEmployeeId] = useState<string>('');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [maxWeeklyHoursInputValue, setMaxWeeklyHoursInputValue] = useState<string>('');
  const [newAreaName, setNewAreaName] = useState('');
  const [areaToDelete, setAreaToDelete] = useState<string | null>(null);

  const actorUsername = useMemo(() => currentUser?.username || 'System', [currentUser]);

  const cardHeaderClass = "px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-sap-border dark:border-gray-600 flex justify-between items-center";
  const cardBodyClass = "p-4 text-gray-800 dark:text-gray-200";
  const cardContainerClass = "bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden";

  const availableEmployeesForLinking = useMemo(() => {
    const linkedEmployeeIds = users
        .map(u => u.employeeId)
        .filter((id): id is string => !!id);
        
    return activeEmployees.filter(emp => 
        !linkedEmployeeIds.includes(emp.id) || (editingUser && emp.id === editingUser.employeeId)
    );
  }, [users, activeEmployees, editingUser]);
  
  useEffect(() => {
    if (editingUser) {
      setUsername(editingUser.username);
      setRole(editingUser.role);
      setLinkedEmployeeId(editingUser.employeeId || '');
      setPassword(''); 
      setConfirmPassword('');
    } else {
      setUsername('');
      setPassword('');
      setConfirmPassword('');
      setRole('Usuario');
      setLinkedEmployeeId('');
    }
  }, [editingUser]);
  
  useEffect(() => {
    if(!isFormVisible) {
        setEditingUser(null);
    }
  }, [isFormVisible]);

  useEffect(() => {
    if (!isLoadingShifts) {
      setMaxWeeklyHoursInputValue(String(globalMaxWeeklyHours));
    }
  }, [globalMaxWeeklyHours, isLoadingShifts]);

  const handleCancel = () => {
    setIsFormVisible(false);
    setEditingUser(null);
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      addToast("El nombre de usuario es requerido.", "warning");
      return;
    }
    if (!editingUser && !password.trim()) {
      addToast("La contraseña es requerida para nuevos usuarios.", "warning");
      return;
    }
    if (password && password !== confirmPassword) {
      addToast("Las contraseñas no coinciden.", "error");
      return;
    }

    let success = false;
    if (editingUser) {
      const dataToUpdate: Partial<Omit<User, 'id' | keyof Syncable>> = {
        username,
        role,
        employeeId: linkedEmployeeId || undefined,
      };
      if (password) {
        dataToUpdate.password = password;
      }
      success = await updateUser(editingUser.id, dataToUpdate, actorUsername);
    } else {
      if (!password) { 
          addToast("La contraseña es requerida.", "error");
          return;
      }
      const newUser = {
        username,
        password,
        role,
        employeeId: linkedEmployeeId || undefined,
      };
      const result = await addUser(newUser, actorUsername);
      success = !!result;
    }

    if (success) {
      handleCancel();
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setIsFormVisible(true);
    const formElement = document.getElementById('user-management-card');
    if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleDeleteUser = (user: User) => {
    if (currentUser?.id === user.id) {
        addToast("No se puede eliminar a sí mismo.", "error");
        return;
    }
    setUserToDelete(user);
  };
  
  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;
    await deleteUser(userToDelete.id, actorUsername);
  };
  
  const handleOpenNewForm = () => {
    setIsFormVisible(true);
    setEditingUser(null);
  };

  const filteredUsers = useMemo(() => {
    const usersWithEmployeeNames = users.map(user => {
        const employee = user.employeeId ? activeEmployees.find(e => e.id === user.employeeId) : null;
        return { ...user, employeeName: employee?.name || '' };
    });

    if (!searchTerm) return usersWithEmployeeNames;
    
    const lowerSearchTerm = searchTerm.toLowerCase();
    return usersWithEmployeeNames.filter(user => 
      user.username.toLowerCase().includes(lowerSearchTerm) ||
      user.role.toLowerCase().includes(lowerSearchTerm) ||
      user.employeeName.toLowerCase().includes(lowerSearchTerm)
    );
  }, [users, searchTerm, activeEmployees]);

  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * USERS_PER_PAGE;
    return filteredUsers.slice(startIndex, startIndex + USERS_PER_PAGE);
  }, [filteredUsers, currentPage]);

  const totalPages = useMemo(() => {
    return Math.ceil(filteredUsers.length / USERS_PER_PAGE);
  }, [filteredUsers.length]);

  const handleSaveGlobalMaxHours = async () => {
    const newMaxHours = parseInt(maxWeeklyHoursInputValue, 10);
    if (isNaN(newMaxHours) || newMaxHours <= 0 || newMaxHours > 168) {
        addToast("Por favor, ingrese un número válido de horas (ej. 1-168).", "error");
        return;
    }
    await updateGlobalMaxWeeklyHours(newMaxHours, actorUsername);
  };

  const handleAddArea = async () => {
    const trimmedArea = newAreaName.trim();
    if (!trimmedArea) {
      addToast("El nombre del área no puede estar vacío.", "warning");
      return;
    }
    if (areaList.some(area => area.toLowerCase() === trimmedArea.toLowerCase())) {
      addToast("El área ya existe.", "warning");
      return;
    }
    const newAreaList = [...areaList, trimmedArea];
    await updateAreaList(newAreaList, actorUsername);
    setNewAreaName('');
  };

  const handleDeleteArea = (area: string) => {
    const isUsed = employees.some(emp => emp.area === area);
    if (isUsed) {
      addToast("No se puede eliminar. El área está en uso por uno o más empleados.", "error");
      return;
    }
    setAreaToDelete(area);
  };
  
  const handleConfirmDeleteArea = async () => {
    if (!areaToDelete) return;
    const newAreaList = areaList.filter(area => area !== areaToDelete);
    await updateAreaList(newAreaList, actorUsername);
  };

  if (isLoadingUsers || isLoadingShifts || isLoadingEmps) {
    return <div className="p-6 text-center dark:text-gray-200">Cargando datos de administración...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-sap-dark-gray dark:text-gray-100">Administración de Usuarios</h1>

      <div id="user-management-card" className={cardContainerClass}>
        <div className={cardHeaderClass}>
            <h3 className="text-lg font-medium leading-6 text-sap-dark-gray dark:text-gray-100">
                Gestión de Usuarios
            </h3>
            {!isFormVisible && (
              <Button onClick={handleOpenNewForm} size="sm" className="flex items-center">
                  <PlusCircleIcon className="w-5 h-5 mr-1" />
                  Agregar Nuevo Usuario
              </Button>
            )}
        </div>
        <div className={cardBodyClass}>
            {isFormVisible && (
               <div className="border-b-2 border-dashed border-gray-300 dark:border-gray-600 mb-4 pb-4">
                 <h3 className="text-lg font-semibold mb-3">{editingUser ? `Editando: ${editingUser.username}` : 'Agregar Nuevo Usuario'}</h3>
                 <form onSubmit={handleFormSubmit} className="space-y-4">
                    <Input label="Nombre de Usuario" id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="off" />
                    <Input label={editingUser ? "Nueva Contraseña (dejar en blanco para no cambiar)" : "Contraseña"} id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required={!editingUser} autoComplete="new-password" />
                    <Input label="Confirmar Contraseña" id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required={!editingUser || !!password} disabled={!password} autoComplete="new-password" />
                    
                    <div>
                      <label htmlFor="linkedEmployee" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vincular a Empleado (Opcional)</label>
                      <select 
                        id="linkedEmployee" 
                        value={linkedEmployeeId} 
                        onChange={(e) => setLinkedEmployeeId(e.target.value)}
                        className="block w-full px-3 py-2 border border-sap-border dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-sap-blue focus:border-sap-blue sm:text-sm"
                      >
                        <option value="">-- No Vincular --</option>
                        {availableEmployeesForLinking.map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                        <label htmlFor="role" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rol</label>
                        <select id="role" value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="block w-full px-3 py-2 border border-sap-border dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-sap-blue focus:border-sap-blue sm:text-sm">
                        {USER_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                    <div className="flex space-x-2">
                        <Button type="submit" variant="primary" className="flex items-center">
                            <PlusCircleIcon className="w-5 h-5 mr-2" />
                            {editingUser ? 'Actualizar Usuario' : 'Agregar Usuario'}
                        </Button>
                        <Button type="button" variant="secondary" onClick={handleCancel}>
                            Cancelar
                        </Button>
                    </div>
                </form>
               </div>
            )}
            
            <Input 
              type="search"
              placeholder="Buscar por nombre, empleado o rol..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="mb-4"
              aria-label="Buscar usuarios"
            />

            {isLoadingUsers ? <p className="text-center py-4">Cargando usuarios...</p> : 
             paginatedUsers.length === 0 ? (
              <p className="text-sap-medium-gray dark:text-gray-400 text-center py-4">
                {searchTerm ? "No se encontraron usuarios con ese criterio." : "No hay usuarios registrados."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-sap-border dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">Nombre de Usuario</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">Empleado Vinculado</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">Rol</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-sap-border dark:divide-gray-700">
                    {paginatedUsers.map(user => {
                      return (
                        <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{user.username}</td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{user.employeeName || 'N/A'}</td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{user.role}</td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm space-x-2">
                            <Button size="sm" onClick={() => handleEditUser(user)} className="p-1"><EditIcon /></Button>
                            <Button size="sm" variant="danger" onClick={() => handleDeleteUser(user)} className="p-1" disabled={currentUser?.id === user.id}><DeleteIcon /></Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {totalPages > 1 && (
              <div className="mt-4 flex justify-between items-center">
                <Button 
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} 
                  disabled={currentPage === 1}
                  size="sm"
                >
                  Anterior
                </Button>
                <span className="text-sm text-sap-medium-gray dark:text-gray-400">
                  Página {currentPage} de {totalPages}
                </span>
                <Button 
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} 
                  disabled={currentPage === totalPages}
                  size="sm"
                >
                  Siguiente
                </Button>
              </div>
            )}
        </div>
      </div>
      
      <div className={cardContainerClass}>
        <div className={cardHeaderClass}>
            <h3 className="text-lg font-medium leading-6 text-sap-dark-gray dark:text-gray-100">
                Variables Globales
            </h3>
        </div>
        <div className={`${cardBodyClass} grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6`}>
            <div className="space-y-4">
              <h4 className="text-base font-semibold text-gray-700 dark:text-gray-200">Horas Semanales</h4>
              <Input
                label="Máximas por Ley"
                id="globalMaxWeeklyHours"
                type="number"
                value={maxWeeklyHoursInputValue}
                onChange={(e) => setMaxWeeklyHoursInputValue(e.target.value)}
                min="1"
                max="168"
              />
              <Button onClick={handleSaveGlobalMaxHours} variant="primary">
                Guardar Horas Máximas
              </Button>
            </div>
            <div className="space-y-4">
              <h4 className="text-base font-semibold text-gray-700 dark:text-gray-200">Gestionar Lista de Áreas</h4>
              <div className="flex items-end gap-2">
                <Input
                  label="Nueva Área"
                  id="newAreaName"
                  value={newAreaName}
                  onChange={(e) => setNewAreaName(e.target.value)}
                  placeholder="Ej: Logística"
                />
                <Button onClick={handleAddArea} className="shrink-0">
                  <PlusCircleIcon className="w-5 h-5"/>
                </Button>
              </div>
              <div className="mt-2 border rounded-md dark:border-gray-600 max-h-48 overflow-y-auto">
                {areaList.length > 0 ? (
                  <ul className="divide-y dark:divide-gray-600">
                    {areaList.map(area => (
                      <li key={area} className="flex justify-between items-center p-2 text-sm">
                        <span className="text-gray-800 dark:text-gray-200">{area}</span>
                        <Button size="sm" variant="danger" className="p-1" onClick={() => handleDeleteArea(area)}>
                          <DeleteIcon className="w-4 h-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">No hay áreas definidas.</p>
                )}
              </div>
            </div>
        </div>
      </div>

      {userToDelete && (
          <ConfirmationModal
              isOpen={!!userToDelete}
              onClose={() => setUserToDelete(null)}
              onConfirm={handleConfirmDeleteUser}
              title="Confirmar Eliminación de Usuario"
              message={`¿Está seguro de eliminar al usuario '${userToDelete.username}'? Esta acción es irreversible.`}
              confirmText="Eliminar Usuario"
              confirmVariant="danger"
          />
      )}
      {areaToDelete && (
          <ConfirmationModal
              isOpen={!!areaToDelete}
              onClose={() => setAreaToDelete(null)}
              onConfirm={handleConfirmDeleteArea}
              title="Confirmar Eliminación de Área"
              message={`¿Está seguro de que desea eliminar el área '${areaToDelete}'?`}
              confirmText="Eliminar Área"
              confirmVariant="danger"
          />
      )}
    </div>
  );
};

export default UserManagementPage;