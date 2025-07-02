import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  title?: string;
}

const Card: React.FC<CardProps> = ({ children, className = '', title, ...rest }) => {
  return (
    <div 
      className={`bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden ${className}`}
      {...rest}
    >
      {title && (
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b border-sap-border dark:border-gray-600">
          <h3 className="text-lg font-medium leading-6 text-sap-dark-gray dark:text-gray-100">{title}</h3>
        </div>
      )}
      <div className="p-4 text-gray-800 dark:text-gray-200">
        {children}
      </div>
    </div>
  );
};

export default Card;