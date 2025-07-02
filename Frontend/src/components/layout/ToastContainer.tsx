import React from 'react';
import { useToasts } from '../../hooks/useToasts';
import ToastItem from '../ui/ToastItem';

const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToasts();

  if (!toasts.length) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed inset-0 pointer-events-none p-4 flex flex-col items-end justify-start space-y-3 z-[1000]"
      style={{ top: '1rem', right: '1rem' }}
    >
      {toasts.map(toast => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onDismiss={removeToast}
        />
      ))}
    </div>
  );
};

export default ToastContainer;