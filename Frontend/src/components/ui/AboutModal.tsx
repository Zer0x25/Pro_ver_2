import React, { useState, useRef } from 'react';
import Card from './Card';
import Button from './Button';
import { CloseIcon } from './icons';
import { APP_TITLE, STORAGE_KEYS } from '../../constants';
import { useToasts } from '../../hooks/useToasts';
import { useAuth } from '../../hooks/useAuth';
import LiberalitasSignature from '../LiberalitasSignature';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  const [clickCount, setClickCount] = useState(0);
  const clickTimeoutRef = useRef<number | null>(null);
  const { addToast } = useToasts();
  const { currentUser } = useAuth();
  const [showMonkey, setShowMonkey] = useState(false);
  
  if (!isOpen) {
    return null;
  }

  const handleLogoClick = () => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }

    const newClickCount = clickCount + 1;
    setClickCount(newClickCount);

    if (newClickCount >= 10) {
      if (currentUser?.role === 'Administrador') {
        const isDevModeCurrentlyEnabled = localStorage.getItem(STORAGE_KEYS.DEV_MODE) === 'true';
        const newDevModeState = !isDevModeCurrentlyEnabled;

        localStorage.setItem(STORAGE_KEYS.DEV_MODE, String(newDevModeState));

        window.dispatchEvent(
          new StorageEvent('storage', {
            key: STORAGE_KEYS.DEV_MODE,
            newValue: String(newDevModeState),
          })
        );

        addToast(
          `Modo Desarrollador ${newDevModeState ? 'Activado' : 'Desactivado'}.`,
          newDevModeState ? 'success' : 'warning'
        );

        if (newDevModeState) {
          const audio = new Audio('imagens/wow.mp3');
          audio.play().catch(e => console.error("Error playing sound:", e));
        }
      } else if (currentUser?.role === 'Usuario Elevado') {
        setShowMonkey(true);
        const audio = new Audio('imagens/popin.mp3');
        audio.play().catch(e => console.error("Error playing sound:", e));
      }
      
      setClickCount(0);
    } else {
      clickTimeoutRef.current = window.setTimeout(() => {
        setClickCount(0);
      }, 500);
    }
  };

  return (
    <>
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
            <CloseIcon className="w-5 h-5" />
          </button>
          <div className="space-y-4 text-center text-gray-700 dark:text-gray-300">
            <img
              src="imagens/Mini_Zer0x.jpg"
              alt="Zer0x Logo"
              className="mx-auto h-10 mb-2 cursor-pointer"
              onClick={handleLogoClick}
              title="Un secreto yace aquí..."
            />
            <p className="text-lg font-semibold">Powered by Zer0x</p>
            <p className="text-sm">{APP_TITLE}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Versión 1.0.0</p>
            <hr className="dark:border-gray-600" />
            <LiberalitasSignature className="text-xs" />
          </div>
          <div className="mt-6 text-center">
            <Button onClick={onClose} variant="primary">
              Cerrar
            </Button>
          </div>
        </Card>
      </div>

      {showMonkey && (
        <div
          className="fixed inset-0 z-[60] flex cursor-pointer items-center justify-center bg-black bg-opacity-80"
          onClick={() => setShowMonkey(false)}
        >
          <img
            src="imagens/mono.jpg"
            alt="Easter egg"
            className="max-h-[90vh] max-w-[90vw] rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}; 

export default AboutModal;