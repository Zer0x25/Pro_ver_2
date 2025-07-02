import React, { useState } from 'react';
import { useSync } from '../../contexts/SyncContext';
import { CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon } from './icons';
import { idbGetAllBy, STORES } from '../../utils/indexedDB';
import SyncErrorsModal from './SyncErrorsModal';
import { Syncable, SyncState } from '../../types';

// A cloud icon with an arrow for syncing
const SyncIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || "w-6 h-6"}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l-3 3m3-3 3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
    </svg>
);

// A simple cloud icon for idle state
const CloudIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || "w-6 h-6"}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 0 0 4.5 4.5H18a3.75 3.75 0 0 0 1.332-7.257 3 3 0 0 0-3.758-3.848 5.25 5.25 0 0 0-10.233 2.33A4.5 4.5 0 0 0 2.25 15Z" />
    </svg>
);

const SYNCABLE_STORES_FOR_ERRORS = [
    STORES.EMPLOYEES, STORES.USERS, STORES.DAILY_TIME_RECORDS,
    STORES.THEORETICAL_SHIFT_PATTERNS, STORES.ASSIGNED_SHIFTS,
    STORES.SHIFT_REPORTS, STORES.APP_SETTINGS
];

const SyncStatus: React.FC = () => {
    const { syncState, runSync } = useSync();
    const [isErrorsModalOpen, setIsErrorsModalOpen] = useState(false);
    const [erroredItems, setErroredItems] = useState<Syncable[]>([]);

    const getStatusInfo = (state: SyncState): { Icon: React.FC<{className?: string}>, color: string, tooltip: string, spin: boolean } => {
        switch(state) {
            case 'syncing':
                return { Icon: SyncIcon, color: 'text-blue-300', tooltip: 'Sincronizando...', spin: true };
            case 'success':
                return { Icon: CheckCircleIcon, color: 'text-green-300', tooltip: 'Sincronizado', spin: false };
            case 'error':
                return { Icon: XCircleIcon, color: 'text-red-300', tooltip: 'Error de Sincronización. Click para ver detalles.', spin: false };
            case 'no-network':
                return { Icon: ExclamationTriangleIcon, color: 'text-yellow-300', tooltip: 'Sin conexión', spin: false };
            case 'idle':
            default:
                return { Icon: CloudIcon, color: 'text-white', tooltip: 'Click para sincronizar', spin: false };
        }
    };
    
    const fetchErroredItems = async () => {
        const allErroredItems: Syncable[] = [];
        for (const storeName of SYNCABLE_STORES_FOR_ERRORS) {
            const items = await idbGetAllBy<Syncable>(storeName, 'syncStatus', 'error');
            allErroredItems.push(...items);
        }
        setErroredItems(allErroredItems);
    };

    const handleClick = async () => {
        if (syncState === 'error') {
            await fetchErroredItems();
            setIsErrorsModalOpen(true);
        } else {
            runSync();
        }
    };

    const { Icon, color, tooltip, spin } = getStatusInfo(syncState);

    return (
        <>
            <button
                onClick={handleClick}
                disabled={syncState === 'syncing' || syncState === 'no-network'}
                className="p-2 rounded-full hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white disabled:opacity-50 disabled:cursor-not-allowed"
                title={tooltip}
                aria-label={tooltip}
            >
               <Icon className={`w-6 h-6 ${color} ${spin ? 'animate-pulse' : ''}`} />
            </button>
            <SyncErrorsModal
                isOpen={isErrorsModalOpen}
                onClose={() => setIsErrorsModalOpen(false)}
                erroredItems={erroredItems}
            />
        </>
    );
};

export default SyncStatus;