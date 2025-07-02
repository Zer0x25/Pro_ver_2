import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input: React.FC<InputProps> = ({ label, id, error, className = '', ...props }) => {
  return (
    <div className="w-full">
      {label && <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>}
      <input
        id={id}
        className={`block w-full px-3 py-2 border border-sap-border dark:border-gray-600 rounded-md shadow-sm 
                   bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 
                   focus:ring-sap-blue focus:border-sap-blue dark:focus:ring-sap-light-blue dark:focus:border-sap-light-blue 
                   sm:text-sm ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
};

export default Input;