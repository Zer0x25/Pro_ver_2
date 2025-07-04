
import React from 'react';
import { ChevronUpIcon, ChevronDownIcon } from './icons';

interface SortableHeaderProps<T> {
  title: string;
  sortKey: keyof T;
  sortConfig: { key: keyof T; direction: 'ascending' | 'descending' } | null;
  onSort: (key: keyof T) => void;
  className?: string;
}

const SortableHeader = <T,>({ title, sortKey, sortConfig, onSort, className = "" }: SortableHeaderProps<T>) => {
  const isSorted = sortConfig?.key === sortKey;
  const isAscending = isSorted && sortConfig?.direction === 'ascending';
  
  const thSortableClass = `px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider cursor-pointer group select-none ${className}`;

  const renderSortIndicator = () => {
    if (!isSorted) {
      return <ChevronDownIcon className="inline-block w-4 h-4 ml-1 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />;
    }
    return isAscending ? 
      <ChevronUpIcon className="inline-block w-4 h-4 ml-1 text-sap-blue dark:text-sap-light-blue" /> :
      <ChevronDownIcon className="inline-block w-4 h-4 ml-1 text-sap-blue dark:text-sap-light-blue" />;
  };

  return (
    <th className={thSortableClass} onClick={() => onSort(sortKey)}>
      <div className="flex items-center">
        {title}
        {renderSortIndicator()}
      </div>
    </th>
  );
};

export default SortableHeader;
