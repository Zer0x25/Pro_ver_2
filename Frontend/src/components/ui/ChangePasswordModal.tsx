import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useUsers } from '../../hooks/useUsers';
import { useToasts } from '../../hooks/useToasts';
import Card from './Card';
import Button from './Button';
import Input from './Input';
import { CloseIcon } from './icons';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose }) => {
  const { currentUser } = useAuth();
  const { users, updateUser } = useUsers();
  const { addToast } = useToasts();
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setIsLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      addToast("Todos los campos son requeridos.", 'warning');
      return;
    }

    if (newPassword !== confirmPassword) {
      addToast("La nueva contraseña y su confirmación no coinciden.", 'error');
      return;
    }
    
    if (newPassword.length < 4) {
      addToast("La nueva contraseña debe tener al menos 4 caracteres.", 'warning');
      return;
    }

    if (!currentUser) {
      addToast("No se pudo identificar al usuario actual.", 'error');
      return;
    }

    // This is the hardcoded admin user. This password cannot be changed via UI.
    if (currentUser.id === 'admin-special-001') {
        if (currentPassword !== 'password') {
            addToast("La contraseña actual es incorrecta.", 'error');
            return;
        }
        addToast("La contraseña del administrador por defecto no puede ser cambiada desde aquí.", "error", 7000);
        return;
    }
    
    const fullUser = users.find(u => u.id === currentUser.id);

    if (!fullUser) {
        addToast("No se encontró el usuario en la base de datos local.", "error");
        return;
    }

    if (fullUser.password !== currentPassword) {
      addToast("La contraseña actual es incorrecta.", 'error');
      return;
    }

    setIsLoading(true);
    const success = await updateUser(currentUser.id, { password: newPassword }, currentUser.username);
    setIsLoading(false);

    if (success) {
      addToast("Contraseña actualizada con éxito.", 'success');
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-password-modal-title"
    >
      <Card
        title="Cambiar Contraseña"
        className="w-full max-w-md bg-white dark:bg-sap-dark-gray shadow-xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
          aria-label="Cerrar modal"
        >
          <CloseIcon className="w-5 h-5" />
        </button>
        <form onSubmit={handleSave} className="space-y-4">
            <Input 
                label="Contraseña Actual"
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
            />
            <Input 
                label="Nueva Contraseña"
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoComplete="new-password"
            />
            <Input 
                label="Confirmar Nueva Contraseña"
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={!newPassword}
                autoComplete="new-password"
            />
          <div className="mt-6 flex justify-end space-x-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={isLoading}>
              {isLoading ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default ChangePasswordModal;
