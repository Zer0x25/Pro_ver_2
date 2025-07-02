import React, { createContext, useState, useEffect, ReactNode, useCallback, useContext } from 'react';
import { User, UserContextType, UserRole, Syncable } from '../types';
import { idbGetAll, idbPut, idbDelete, idbGet, STORES } from '../utils/indexedDB';
// import { useAuth } from '../hooks/useAuth'; // Removed useAuth
import { useLogs } from '../hooks/useLogs';
import { useToasts } from '../hooks/useToasts';

export const UserContext = createContext<UserContextType | undefined>(undefined);

interface UserProviderProps {
  children: ReactNode;
}

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(true);
  // const { currentUser } = useAuth(); // Removed: To get actor for logs
  const { addLog } = useLogs();
  const { addToast } = useToasts();

  const loadUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const storedUsers = await idbGetAll<User>(STORES.USERS);
      setUsers(storedUsers.sort((a, b) => a.username.localeCompare(b.username)));
    } catch (error) {
      console.error("Error loading users from IndexedDB:", error);
      addToast("Error cargando la lista de usuarios.", "error");
    } finally {
      setIsLoadingUsers(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);
  
  const getUserByUsername = useCallback((username: string): User | undefined => {
    return users.find(u => u.username === username);
  }, [users]);

  const addUser = useCallback(async (userData: Omit<User, 'id' | keyof Syncable>, actorUsername: string): Promise<User | null> => {
    // Check for username uniqueness
    const existingUserByUsername = getUserByUsername(userData.username);
    if (existingUserByUsername) {
      addToast(`El nombre de usuario '${userData.username}' ya existe.`, "error");
      await addLog(actorUsername, 'Add User Failed - Username Exists', { username: userData.username });
      return null;
    }

    // Check if employee is already linked
    if (userData.employeeId) {
      const isEmployeeLinked = users.some(u => u.employeeId === userData.employeeId);
      if (isEmployeeLinked) {
        addToast("Este empleado ya está vinculado a otro usuario.", "error");
        await addLog(actorUsername, 'Add User Failed - Employee Already Linked', { employeeId: userData.employeeId });
        return null;
      }
    }

    try {
      const newId = crypto.randomUUID();
      const newUser: User = { 
        ...userData, 
        id: newId, 
        lastModified: Date.now(),
        syncStatus: 'pending',
        isDeleted: false,
      };
      
      await idbPut<User>(STORES.USERS, newUser);
      setUsers(prevUsers => [...prevUsers, newUser].sort((a, b) => a.username.localeCompare(b.username)));
      await addLog(actorUsername, 'User Added', { userId: newUser.id, username: newUser.username, role: newUser.role, employeeId: newUser.employeeId });
      addToast(`Usuario '${newUser.username}' agregado con rol '${newUser.role}'.`, 'success');
      if(userData.password) {
        addToast('Recordatorio: La contraseña se guarda en texto plano (solo para demo).', 'warning', 7000);
      }
      return newUser;
    } catch (error: any) {
      console.error("Error adding user to IndexedDB:", error);
      let errorMessage = "Error al agregar usuario.";
      if (error.name === 'ConstraintError') {
        errorMessage = `El nombre de usuario '${userData.username}' ya existe.`;
      }
      await addLog(actorUsername, 'Add User Failed', { username: userData.username, error: String(error) });
      addToast(errorMessage, 'error');
      return null;
    }
  }, [addLog, addToast, users, getUserByUsername]);

  const updateUser = useCallback(async (userId: string, data: Partial<Omit<User, 'id' | keyof Syncable>>, actorUsername: string): Promise<boolean> => {
    const userToUpdate = users.find(u => u.id === userId);

    if (!userToUpdate) {
      addToast("Usuario no encontrado para actualizar.", "error");
      await addLog(actorUsername, 'Update User Failed - Not Found', { userId });
      return false;
    }

    // Check if new username is taken by another user
    if (data.username && data.username !== userToUpdate.username) {
        const existingUserByNewUsername = users.find(u => u.username === data.username && u.id !== userId);
        if (existingUserByNewUsername) {
            addToast(`El nombre de usuario '${data.username}' ya está en uso por otro usuario.`, "error");
            await addLog(actorUsername, 'Update User Failed - Username Exists', { userId, newUsername: data.username });
            return false;
        }
    }
    
    // Check if new employeeId is taken by another user
    if (data.employeeId) {
        const isEmployeeLinked = users.some(u => u.employeeId === data.employeeId && u.id !== userId);
        if (isEmployeeLinked) {
            addToast("Este empleado ya está vinculado a otro usuario.", "error");
            await addLog(actorUsername, 'Update User Failed - Employee Already Linked', { userId, employeeId: data.employeeId });
            return false;
        }
    }

    const updatedUserData = { ...data };
    // If password is an empty string, it should not be saved.
    if (updatedUserData.password === '') {
      delete updatedUserData.password;
    }
    
    const finalUpdatedUser: User = { 
      ...userToUpdate, 
      ...updatedUserData,
      lastModified: Date.now(),
      syncStatus: 'pending',
    };
    
    try {
      await idbPut<User>(STORES.USERS, finalUpdatedUser);
      setUsers(prevUsers =>
        prevUsers.map(u => (u.id === userId ? finalUpdatedUser : u))
        .sort((a, b) => a.username.localeCompare(b.username))
      );
      await addLog(actorUsername, 'User Updated', { userId, changes: data });
      addToast(`Usuario '${finalUpdatedUser.username}' actualizado.`, 'success');
      if(data.password) {
         addToast('Recordatorio: La contraseña se guarda en texto plano (solo para demo).', 'warning', 7000);
      }
      return true;
    } catch (error: any) {
      console.error("Error updating user in IndexedDB:", error);
      let errorMessage = "Error al actualizar usuario.";
       if (error.name === 'ConstraintError') {
        errorMessage = `El nombre de usuario '${data.username}' ya está en uso.`;
      }
      await addLog(actorUsername, 'Update User Failed', { userId, error: String(error) });
      addToast(errorMessage, 'error');
      return false;
    }
  }, [users, addLog, addToast]);

  const deleteUser = useCallback(async (userId: string, actorUsername: string): Promise<boolean> => {
    const userToDelete = users.find(u => u.id === userId);
    if (!userToDelete) {
        addToast("Usuario no encontrado para eliminar.", "error");
        await addLog(actorUsername, 'Delete User Failed - Not Found', { userId });
        return false;
    }
    // Prevent deleting the special admin user if they are trying to delete themselves via this mechanism
    if (userToDelete.username === 'admin' && userToDelete.role === 'Administrador' && users.filter(u => u.role === 'Administrador').length === 1) {
        addToast("No se puede eliminar el único administrador.", "error");
        await addLog(actorUsername, 'Delete User Failed - Last Admin', { userId });
        return false;
    }

    try {
      await idbDelete(STORES.USERS, userId);
      setUsers(prevUsers => prevUsers.filter(u => u.id !== userId));
      await addLog(actorUsername, 'User Deleted', { userId, username: userToDelete.username });
      addToast(`Usuario '${userToDelete.username}' eliminado.`, 'success');
      return true;
    } catch (error) {
      console.error("Error deleting user from IndexedDB:", error);
      await addLog(actorUsername, 'Delete User Failed', { userId, error: String(error) });
      addToast("Error al eliminar usuario.", 'error');
      return false;
    }
  }, [users, addLog, addToast]);
  
  const getUserById = useCallback((userId: string): User | undefined => {
    return users.find(u => u.id === userId);
  }, [users]);

  return (
    <UserContext.Provider value={{ 
      users, 
      isLoadingUsers, 
      addUser, 
      updateUser, 
      deleteUser, 
      getUserById,
      getUserByUsername
    }}>
      {children}
    </UserContext.Provider>
  );
};
