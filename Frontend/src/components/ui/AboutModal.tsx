import React from 'react';
import Card from './Card';
import Button from './Button';
import { CloseIcon } from './icons';
import { APP_TITLE } from '../../constants';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-modal-title"
    >
      <Card 
        title="Acerca de Portal Control-Interno" 
        className="w-full max-w-md bg-white dark:bg-sap-dark-gray shadow-xl relative" 
        onClick={(e) => e.stopPropagation()}
      >
         <button 
            onClick={onClose} 
            className="absolute top-3 right-3 p-1 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Cerrar modal"
          >
            <CloseIcon className="w-5 h-5"/>
        </button>
        <div className="space-y-4 text-center text-gray-700 dark:text-gray-300">
          <img src="imagens/Mini_Zer0x.jpg" alt="Zer0x Logo" className="mx-auto h-10 mb-2"/>
          <p className="text-lg font-semibold">Portal Control Interno</p>
          <p className="text-sm">{APP_TITLE}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Versión 1.0.0</p>
          <hr className="dark:border-gray-600"/>
          <p className="text-xs">
          Esta app fue desarrollada por Jaime Mella, como un pequeño gesto de{' '}
          <em title="Virtud romana que representa la generosidad sin interés">liberalitas</em>.
          </p>
        </div>
        <div className="mt-6 text-center">
          <Button onClick={onClose} variant="primary">
            Cerrar
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default AboutModal;