import React, { useState, useEffect } from 'react';
import { useTheoreticalShifts } from '../../hooks/useTheoreticalShifts';
import { useAuth } from '../../hooks/useAuth';
import { useToasts } from '../../hooks/useToasts';
import { useEmployees } from '../../contexts/EmployeeContext';
import { MeterConfig } from '../../types';
import Button from '../ui/Button';
import Input from '../ui/Input';
import ConfirmationModal from '../ui/ConfirmationModal';
import { PlusCircleIcon, DeleteIcon } from '../ui/icons';


export const GlobalVariablesManager: React.FC = () => {
    const { 
        globalMaxWeeklyHours, updateGlobalMaxWeeklyHours, 
        isLoadingShifts, areaList, updateAreaList,
        meterConfigs, updateMeterConfigs 
    } = useTheoreticalShifts();
    const { currentUser } = useAuth();
    const { employees } = useEmployees();
    const { addToast } = useToasts();

    const [maxWeeklyHoursInputValue, setMaxWeeklyHoursInputValue] = useState<string>('');
    const [newAreaName, setNewAreaName] = useState('');
    const [areaToDelete, setAreaToDelete] = useState<string | null>(null);
    const [newMeterName, setNewMeterName] = useState('');
    const [meterToDelete, setMeterToDelete] = useState<MeterConfig | null>(null);

    const actorUsername = currentUser?.username || 'System';

    useEffect(() => {
        if (!isLoadingShifts) {
          setMaxWeeklyHoursInputValue(String(globalMaxWeeklyHours));
        }
    }, [globalMaxWeeklyHours, isLoadingShifts]);

    const handleSaveGlobalMaxHours = async () => {
        const newMaxHours = parseInt(maxWeeklyHoursInputValue, 10);
        if (isNaN(newMaxHours) || newMaxHours <= 0 || newMaxHours > 168) {
            addToast("Por favor, ingrese un número válido de horas (ej. 1-168).", "error");
            return;
        }
        await updateGlobalMaxWeeklyHours(newMaxHours, actorUsername);
    };

    const handleAddArea = async () => {
        const trimmedArea = newAreaName.trim();
        if (!trimmedArea) {
          addToast("El nombre del área no puede estar vacío.", "warning");
          return;
        }
        if (areaList.some(area => area.toLowerCase() === trimmedArea.toLowerCase())) {
          addToast("El área ya existe.", "warning");
          return;
        }
        const newAreaList = [...areaList, trimmedArea];
        await updateAreaList(newAreaList, actorUsername);
        setNewAreaName('');
    };
    
    const handleDeleteArea = (area: string) => {
        const isUsed = employees.some(emp => emp.area === area);
        if (isUsed) {
          addToast("No se puede eliminar. El área está en uso por uno o más empleados.", "error");
          return;
        }
        setAreaToDelete(area);
    };
      
    const handleConfirmDeleteArea = async () => {
        if (!areaToDelete) return;
        const newAreaList = areaList.filter(area => area !== areaToDelete);
        await updateAreaList(newAreaList, actorUsername);
    };
      
    const handleAddMeter = async () => {
        const trimmedName = newMeterName.trim();
        if (!trimmedName) {
          addToast("El nombre del medidor no puede estar vacío.", "warning");
          return;
        }
        if (meterConfigs.some(m => m.label.toLowerCase() === trimmedName.toLowerCase())) {
          addToast("Ese medidor ya existe.", "warning");
          return;
        }
        const newMeterList = [...meterConfigs, { id: crypto.randomUUID(), label: trimmedName }];
        await updateMeterConfigs(newMeterList, actorUsername);
        setNewMeterName('');
    };
    
    const handleDeleteMeter = (meter: MeterConfig) => {
        setMeterToDelete(meter);
    };
    
    const handleConfirmDeleteMeter = async () => {
        if (!meterToDelete) return;
        const newMeterList = meterConfigs.filter(m => m.id !== meterToDelete.id);
        await updateMeterConfigs(newMeterList, actorUsername);
    };


    return (
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-sap-border dark:border-gray-600 flex justify-between items-center">
                <h3 className="text-lg font-medium leading-6 text-sap-dark-gray dark:text-gray-100">
                    Variables Globales
                </h3>
            </div>
            <div className="p-4 text-gray-800 dark:text-gray-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
                <div className="space-y-4">
                  <h4 className="text-base font-semibold text-gray-700 dark:text-gray-200">Horas Semanales</h4>
                  <Input
                    label="Máximas por Ley"
                    id="globalMaxWeeklyHours"
                    type="number"
                    value={maxWeeklyHoursInputValue}
                    onChange={(e) => setMaxWeeklyHoursInputValue(e.target.value)}
                    min="1"
                    max="168"
                  />
                  <Button onClick={handleSaveGlobalMaxHours} variant="primary">
                    Guardar Horas Máximas
                  </Button>
                </div>
                <div className="space-y-4">
                  <h4 className="text-base font-semibold text-gray-700 dark:text-gray-200">Gestionar Lista de Áreas</h4>
                  <div className="flex items-end gap-2">
                    <Input
                      label="Nueva Área"
                      id="newAreaName"
                      value={newAreaName}
                      onChange={(e) => setNewAreaName(e.target.value)}
                      placeholder="Ej: Logística"
                    />
                    <Button onClick={handleAddArea} className="shrink-0">
                      <PlusCircleIcon className="w-5 h-5"/>
                    </Button>
                  </div>
                  <div className="mt-2 border rounded-md dark:border-gray-600 max-h-48 overflow-y-auto">
                    {areaList.length > 0 ? (
                      <ul className="divide-y dark:divide-gray-600">
                        {areaList.map(area => (
                          <li key={area} className="flex justify-between items-center p-2 text-sm">
                            <span className="text-gray-800 dark:text-gray-200">{area}</span>
                            <Button size="sm" variant="danger" className="p-1" onClick={() => handleDeleteArea(area)}>
                              <DeleteIcon className="w-4 h-4" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">No hay áreas definidas.</p>
                    )}
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="text-base font-semibold text-gray-700 dark:text-gray-200">Gestión de Medidores</h4>
                  <div className="flex items-end gap-2">
                    <Input
                      label="Nuevo Medidor"
                      id="newMeterName"
                      value={newMeterName}
                      onChange={(e) => setNewMeterName(e.target.value)}
                      placeholder="Ej: Medidor de Agua"
                    />
                    <Button onClick={handleAddMeter} className="shrink-0">
                      <PlusCircleIcon className="w-5 h-5"/>
                    </Button>
                  </div>
                  <div className="mt-2 border rounded-md dark:border-gray-600 max-h-48 overflow-y-auto">
                    {meterConfigs.length > 0 ? (
                      <ul className="divide-y dark:divide-gray-600">
                        {meterConfigs.map(meter => (
                          <li key={meter.id} className="flex justify-between items-center p-2 text-sm">
                            <span className="text-gray-800 dark:text-gray-200">{meter.label}</span>
                            <Button size="sm" variant="danger" className="p-1" onClick={() => handleDeleteMeter(meter)}>
                              <DeleteIcon className="w-4 h-4" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">No hay medidores definidos.</p>
                    )}
                  </div>
                </div>
            </div>
            {areaToDelete && (
                <ConfirmationModal
                    isOpen={!!areaToDelete}
                    onClose={() => setAreaToDelete(null)}
                    onConfirm={handleConfirmDeleteArea}
                    title="Confirmar Eliminación de Área"
                    message={`¿Está seguro de que desea eliminar el área '${areaToDelete}'?`}
                    confirmText="Eliminar Área"
                    confirmVariant="danger"
                />
            )}
            {meterToDelete && (
                <ConfirmationModal
                    isOpen={!!meterToDelete}
                    onClose={() => setMeterToDelete(null)}
                    onConfirm={handleConfirmDeleteMeter}
                    title="Confirmar Eliminación de Medidor"
                    message={`¿Está seguro de que desea eliminar el medidor '${meterToDelete.label}'?`}
                    confirmText="Eliminar Medidor"
                    confirmVariant="danger"
                />
            )}
        </div>
    );
};
