import React from 'react';
import { Syncable } from '../../types';
import Card from './Card';
import Button from './Button';
import { CloseIcon } from './icons';

interface SyncErrorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  erroredItems: Syncable[];
}

const SyncErrorsModal: React.FC<SyncErrorsModalProps> = ({ isOpen, onClose, erroredItems }) => {
  if (!isOpen) {
    return null;
  }

  const getItemName = (item: any): string => {
      return item.name || item.username || item.folio || item.id;
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sync-errors-modal-title"
    >
      <Card 
        title="Errores de Sincronización" 
        className="w-full max-w-2xl bg-white dark:bg-sap-dark-gray shadow-xl relative" 
        onClick={(e) => e.stopPropagation()}
      >
         <button 
            onClick={onClose} 
            className="absolute top-3 right-3 p-1 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Cerrar modal"
          >
            <CloseIcon className="w-5 h-5"/>
        </button>
        <div className="max-h-[60vh] overflow-y-auto space-y-3 p-1">
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                Los siguientes registros no pudieron sincronizarse. Por favor, revise los datos y vuelva a intentarlo.
            </p>
            {erroredItems.length > 0 ? (
                erroredItems.map(item => (
                    <div key={(item as any).id} className="p-3 bg-red-50 dark:bg-red-900/40 rounded-md border border-red-200 dark:border-red-800/50">
                        <p className="font-semibold text-red-800 dark:text-red-200">
                            Registro: {getItemName(item)}
                        </p>
                        <p className="text-sm text-red-700 dark:text-red-300">
                            <strong>Error:</strong> {item.syncError || 'Error desconocido del servidor.'}
                        </p>
                    </div>
                ))
            ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                    No se encontraron errores de sincronización.
                </p>
            )}
        </div>
        <div className="mt-6 text-right">
          <Button onClick={onClose} variant="primary">
            Cerrar
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default SyncErrorsModal;