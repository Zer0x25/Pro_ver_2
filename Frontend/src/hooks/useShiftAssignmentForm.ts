import { useState, useEffect, useMemo } from 'react';
import { AssignedShift, Syncable } from '../types';
import { useTheoreticalShifts } from './useTheoreticalShifts';
import { useAuth } from './useAuth';
import { useToasts } from './useToasts';

export const useShiftAssignmentForm = () => {
    const { assignShiftToEmployee, updateAssignedShift } = useTheoreticalShifts();
    const { currentUser } = useAuth();
    const { addToast } = useToasts();
    
    const actorUsername = useMemo(() => currentUser?.username || 'System', [currentUser]);

    const [editingAssignment, setEditingAssignment] = useState<AssignedShift | null>(null);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [selectedPatternId, setSelectedPatternId] = useState('');
    const [assignmentStartDate, setAssignmentStartDate] = useState('');
    const [assignmentEndDate, setAssignmentEndDate] = useState('');

    useEffect(() => {
        if (editingAssignment) {
            setSelectedEmployeeId(editingAssignment.employeeId);
            setSelectedPatternId(editingAssignment.shiftPatternId);
            setAssignmentStartDate(editingAssignment.startDate);
            setAssignmentEndDate(editingAssignment.endDate || '');
        } else {
            clearForm();
        }
    }, [editingAssignment]);
    
    const clearForm = () => {
        setEditingAssignment(null);
        setSelectedEmployeeId('');
        setSelectedPatternId('');
        setAssignmentStartDate('');
        setAssignmentEndDate('');
    };

    const handleSaveAssignment = async (): Promise<boolean> => {
        if (!selectedEmployeeId || !selectedPatternId || !assignmentStartDate) {
            addToast("Empleado, patrón de turno y fecha de inicio son requeridos.", "warning");
            return false;
        }
        if (assignmentEndDate && assignmentStartDate > assignmentEndDate) {
            addToast("La fecha de término no puede ser anterior a la fecha de inicio.", "error");
            return false;
        }
        
        const assignmentData: Omit<AssignedShift, 'id' | 'employeeName' | 'shiftPatternName' | keyof Syncable> = {
            employeeId: selectedEmployeeId,
            shiftPatternId: selectedPatternId,
            startDate: assignmentStartDate,
            endDate: assignmentEndDate || undefined,
        };
        
        let success = false;
        if (editingAssignment) {
            success = await updateAssignedShift({ ...assignmentData, id: editingAssignment.id }, actorUsername);
        } else {
            const newAssignment = await assignShiftToEmployee(assignmentData, actorUsername);
            success = !!newAssignment;
        }
        
        if (success) {
            clearForm();
        }
        
        return success;
    };

    return {
        editingAssignment,
        setEditingAssignment,
        selectedEmployeeId,
        setSelectedEmployeeId,
        selectedPatternId,
        setSelectedPatternId,
        assignmentStartDate,
        setAssignmentStartDate,
        assignmentEndDate,
        setAssignmentEndDate,
        handleSaveAssignment,
        clearForm,
    };
};