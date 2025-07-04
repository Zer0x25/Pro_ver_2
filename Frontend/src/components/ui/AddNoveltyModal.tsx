import React, { useState, useEffect } from 'react';
import Button from './Button';
import Input from './Input';
import { CloseIcon } from './icons';
import { formatTime } from '../../utils/formatters';

interface AddNoveltyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (annotation: string, time: string) => Promise<void>;
  initialText?: string;
  initialTime?: string;
  isEditing: boolean;
}

const AddNoveltyModal: React.FC<AddNoveltyModalProps> = ({ isOpen, onClose, onSave, initialText = '', initialTime, isEditing }) => {
  const [annotation, setAnnotation] = useState('');
  const [time, setTime] = useState('');

  useEffect(() => {
    if (isOpen) {
      setAnnotation(initialText);
      setTime(initialTime || formatTime(new Date()));
    }
  }, [isOpen, initialText, initialTime]);
  
  if (!isOpen) {
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!annotation.trim() || !time.trim()) {
      alert("La hora y la anotación son requeridas.");
      return;
    }
    onSave(annotation, time);
  };

  const modalTitle = isEditing ? "Editar Novedad" : "Agregar Novedad";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 dark:bg-opacity-80 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="novelty-modal-title"
    >
      <div className="p-6 rounded-lg shadow-xl w-full max-w-lg bg-white dark:bg-gray-800" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 id="novelty-modal-title" className="text-xl font-semibold text-gray-900 dark:text-gray-100">{modalTitle}</h3>
          <Button onClick={onClose} variant="secondary" size="sm" className="p-1 !bg-transparent hover:!bg-gray-200 dark:hover:!bg-gray-700" aria-label="Cerrar modal">
            <CloseIcon className="text-gray-600 dark:text-gray-300"/>
          </Button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input 
            label="Hora" 
            type="time" 
            id="noveltyTime" 
            value={time} 
            onChange={e => setTime(e.target.value)} 
            required 
          />
          <label htmlFor="noveltyAnnotationTextarea" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Detalle de la novedad</label>
          <textarea 
            id="noveltyAnnotationTextarea" 
            value={annotation} 
            onChange={e => setAnnotation(e.target.value)} 
            rows={5} 
            placeholder="Detalle de la novedad..." 
            className="block w-full px-3 py-2 border border-sap-border dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-sap-blue focus:border-sap-blue dark:focus:ring-sap-light-blue dark:focus:border-sap-light-blue sm:text-sm" 
            required
          />
          <Button type="submit" disabled={!annotation.trim() || !time.trim()}>
            {isEditing ? "Actualizar Novedad" : "Guardar Novedad"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default AddNoveltyModal;
