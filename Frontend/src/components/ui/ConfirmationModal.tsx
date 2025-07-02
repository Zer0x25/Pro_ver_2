import React from 'react';
import Card from './Card';
import Button from './Button';
import { CloseIcon, ExclamationTriangleIcon } from './icons';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'primary' | 'secondary' | 'danger';
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  confirmVariant = 'danger',
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmation-modal-title"
    >
      <Card
        className="w-full max-w-lg relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Cerrar modal"
        >
            <CloseIcon className="w-5 h-5"/>
        </button>
        <div className="p-4 sm:p-6">
            <div className="flex items-start">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/50 sm:mx-0 sm:h-10 sm:w-10">
                    <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" aria-hidden="true" />
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 id="confirmation-modal-title" className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100">
                        {title}
                    </h3>
                    <div className="mt-2">
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                            {message}
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse rounded-b-lg">
          <Button
            onClick={handleConfirm}
            variant={confirmVariant}
            className="w-full sm:ml-3 sm:w-auto"
          >
            {confirmText}
          </Button>
          <Button
            onClick={onClose}
            variant="secondary"
            className="mt-3 w-full sm:mt-0 sm:w-auto"
          >
            {cancelText}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ConfirmationModal;
