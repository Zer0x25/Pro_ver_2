import React, { useState, useEffect } from 'react';
import { useTheoreticalShifts } from '../../hooks/useTheoreticalShifts';
import { useMeterReadings } from '../../hooks/useMeterReadings';
import { MeterReadingItem } from '../../types';
import Card from './Card';
import Button from './Button';
import Input from './Input';
import { CloseIcon } from './icons';

interface MetersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ReadingState = { [key: string]: string };

const MetersModal: React.FC<MetersModalProps> = ({ isOpen, onClose }) => {
  const { meterConfigs, isLoadingShifts } = useTheoreticalShifts();
  const { readings, isLoadingReadings, addReading } = useMeterReadings();
  const [readingValues, setReadingValues] = useState<ReadingState>({});

  useEffect(() => {
    if (isOpen) {
      // Reset form when modal opens by creating an object with keys for each meter and empty string values.
      const initialValues: ReadingState = {};
      meterConfigs.forEach(config => {
        initialValues[config.id] = '';
      });
      setReadingValues(initialValues);
    }
  }, [isOpen, meterConfigs]);
  
  if (!isOpen) {
    return null;
  }

  const handleInputChange = (meterId: string, value: string) => {
    setReadingValues(prev => ({ ...prev, [meterId]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const readingsToSave: Omit<MeterReadingItem, 'label'>[] = Object.entries(readingValues)
      .map(([meterConfigId, value]) => ({
        meterConfigId,
        value: parseFloat(value),
      }))
      .filter(item => !isNaN(item.value)); // Only include items with a valid number

    if (readingsToSave.length === 0) {
        alert("Por favor, ingrese al menos una lectura válida.");
        return;
    }

    const success = await addReading(readingsToSave);
    if (success) {
      onClose();
    }
  };
  
  const isLoading = isLoadingShifts || isLoadingReadings;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="meters-modal-title"
    >
      <Card 
        title="Registro de Medidores" 
        className="w-full max-w-2xl bg-white dark:bg-sap-dark-gray shadow-xl relative" 
        onClick={(e) => e.stopPropagation()}
      >
        <button 
            onClick={onClose} 
            className="absolute top-3 right-3 p-1 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Cerrar modal"
        >
            <CloseIcon className="w-5 h-5"/>
        </button>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Form Section */}
            <form onSubmit={handleSave} className="space-y-4">
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200">Nueva Lectura</h3>
                {isLoading ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">Cargando configuración de medidores...</p>
                ) : meterConfigs.length > 0 ? (
                    meterConfigs.map(config => (
                        <Input
                            key={config.id}
                            id={`meter-${config.id}`}
                            label={config.label}
                            type="number"
                            step="any"
                            min="0"
                            value={readingValues[config.id] || ''}
                            onChange={(e) => handleInputChange(config.id, e.target.value)}
                            placeholder={`Valor para ${config.label}...`}
                            autoComplete="off"
                        />
                    ))
                ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No hay medidores configurados. Un administrador debe agregarlos en la sección de Variables Globales.</p>
                )}
                
                <Button type="submit" variant="primary" disabled={isLoading || meterConfigs.length === 0}>
                    Guardar Lectura
                </Button>
            </form>

            {/* History Section */}
            <div className="space-y-4">
                 <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200">Últimos Registros</h3>
                 <div className="max-h-96 overflow-y-auto border rounded-md dark:border-gray-700">
                     {isLoading ? (
                         <p className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">Cargando historial...</p>
                     ) : readings.length > 0 ? (
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                                <tr>
                                    <th className="p-2 text-left font-medium">Fecha</th>
                                    <th className="p-2 text-left font-medium">Medidor</th>
                                    <th className="p-2 text-right font-medium">Lectura</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-gray-700">
                                {readings.slice(0, 20).flatMap(entry => (
                                    entry.readings.map((readingItem, index) => (
                                        <tr key={`${entry.id}-${readingItem.meterConfigId}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                            {index === 0 && (
                                                <td className="p-2 align-top" rowSpan={entry.readings.length}>
                                                    {new Date(entry.timestamp).toLocaleString('es-CL', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                            )}
                                            <td className="p-2">{readingItem.label}</td>
                                            <td className="p-2 text-right font-mono">{readingItem.value}</td>
                                        </tr>
                                    ))
                                ))}
                            </tbody>
                        </table>
                     ) : (
                         <p className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">No hay lecturas registradas.</p>
                     )}
                 </div>
            </div>
        </div>
      </Card>
    </div>
  );
};

export default MetersModal;
