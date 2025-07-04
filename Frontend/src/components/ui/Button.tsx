
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'coral';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  ...props 
}) => {
  const baseStyles = 'font-semibold rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition ease-in-out duration-150 disabled:opacity-50 disabled:cursor-not-allowed';
  
  let variantStyles = '';
  switch (variant) {
    case 'primary':
      variantStyles = 'bg-sap-blue text-white hover:bg-blue-700 focus:ring-sap-blue dark:bg-sap-light-blue dark:hover:bg-blue-600 dark:focus:ring-sap-light-blue';
      break;
    case 'secondary':
      variantStyles = 'bg-sap-medium-gray text-white hover:bg-gray-600 focus:ring-sap-medium-gray dark:bg-gray-600 dark:hover:bg-gray-500 dark:focus:ring-gray-600';
      break;
    case 'danger':
      variantStyles = 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500 dark:bg-red-600 dark:hover:bg-red-500 dark:focus:ring-red-600';
      break;
    case 'coral':
      variantStyles = 'bg-orange-500 text-white hover:bg-orange-600 focus:ring-orange-500 dark:bg-orange-600 dark:hover:bg-orange-500 dark:focus:ring-orange-600';
      break;
  }

  let sizeStyles = '';
  switch (size) {
    case 'sm':
      sizeStyles = 'px-3 py-1.5 text-sm';
      break;
    case 'md':
      sizeStyles = 'px-4 py-2 text-base';
      break;
    case 'lg':
      sizeStyles = 'px-6 py-3 text-lg';
      break;
  }

  return (
    <button
      className={`${baseStyles} ${variantStyles} ${sizeStyles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;