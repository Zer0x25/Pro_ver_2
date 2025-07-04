import React, { useEffect, useMemo } from 'react';
import { ToastMessage, ToastType } from '../../contexts/ToastContext';
import { CheckCircleIcon, XCircleIcon, InformationCircleIcon, ExclamationTriangleIcon, CloseIcon } from './icons';

interface ToastItemProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  const { id, message, type, duration } = toast;

  useEffect(() => {
    if (duration) {
      const timer = setTimeout(() => {
        onDismiss(id);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [id, duration, onDismiss]);

  useEffect(() => {
    if (type === 'warning') {
      const audio = new Audio('imagens/notif.mp3');
      audio.play().catch(e => console.error("Error playing warning sound:", e));
    } else if (type === 'error') {
      const audio = new Audio('imagens/error.mp3');
      audio.play().catch(e => console.error("Error playing error sound:", e));
    }
  }, [type, id]);

  const IconComponent = useMemo(() => {
    switch (type) {
      case 'success':
        return CheckCircleIcon;
      case 'error':
        return XCircleIcon;
      case 'info':
        return InformationCircleIcon;
      case 'warning':
        return ExclamationTriangleIcon;
      default:
        return InformationCircleIcon;
    }
  }, [type]);

  const bgColor = useMemo(() => {
    switch (type) {
      case 'success':
        return 'bg-green-500 dark:bg-green-600';
      case 'error':
        return 'bg-red-500 dark:bg-red-600';
      case 'info':
        return 'bg-sap-blue dark:bg-sap-light-blue';
      case 'warning':
        return 'bg-yellow-500 dark:bg-yellow-600';
      default:
        return 'bg-gray-700 dark:bg-gray-600';
    }
  }, [type]);
  
  const iconColor = "text-white";

  const getAriaRole = (toastType: ToastType) => {
    switch (toastType) {
      case 'error':
      case 'warning':
        return 'alert';
      case 'success':
      case 'info':
      default:
        return 'status';
    }
  };


  return (
    <div
      role={getAriaRole(type)}
      aria-live={type === 'error' || type === 'warning' ? 'assertive' : 'polite'}
      className={`max-w-sm w-full ${bgColor} text-white shadow-lg rounded-md pointer-events-auto flex ring-1 ring-black ring-opacity-5 overflow-hidden`}
    >
      <div className="flex-1 p-3 flex items-center">
        <div className="flex-shrink-0 mr-2">
          <IconComponent className={`w-6 h-6 ${iconColor}`} />
        </div>
        <div className="flex-1 text-sm font-medium">
          {message}
        </div>
      </div>
      <div className="flex border-l border-white/20 dark:border-white/30">
        <button
          onClick={() => onDismiss(id)}
          className="w-full border border-transparent rounded-none rounded-r-lg p-3 flex items-center justify-center text-sm font-medium text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white"
          aria-label="Cerrar notificación"
        >
          <CloseIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default ToastItem;