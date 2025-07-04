import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, ShiftReport, Employee } from '../../types';
import { ROUTES } from '../../constants';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { 
    ClockIcon, BookOpenIcon, ExclamationTriangleIcon, CalendarDaysIcon, UsersIcon,
    ClipboardIcon, ChatBubbleLeftRightIcon, DocumentTextIcon, CalculatorIcon
} from '../ui/icons';
import type { UpcomingEmployeeStatus, MissingClockOutStatus } from '../pages/DashboardPage';

// --- Panel 1: Status & Actions ---
interface StatusAndActionsPanelProps {
    userClockingStatus: { status: string; time?: string };
    activeShiftReport: ShiftReport | null;
    currentUser: User | null;
    getResponsibleDisplayName: (username: string) => string;
    navigate: ReturnType<typeof useNavigate>;
    onOpenQuickNotes: () => void;
    hasUnreadNotes: boolean;
    setIsMetersModalOpen: (isOpen: boolean) => void;
}

export const StatusAndActionsPanel: React.FC<StatusAndActionsPanelProps> = ({
    userClockingStatus,
    activeShiftReport,
    currentUser,
    getResponsibleDisplayName,
    navigate,
    onOpenQuickNotes,
    hasUnreadNotes,
    setIsMetersModalOpen
}) => {
    const quickActionButtonClass = "w-full h-full flex flex-col justify-center items-center p-3 text-center text-sm font-medium";
    const toolButtonClass = "w-full h-full flex flex-col justify-center items-center p-2 text-center text-xs";

    return (
        <Card title="Estado y Acciones Principales">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* My Status */}
                <div className="space-y-3">
                    <h3 className="font-semibold text-gray-700 dark:text-gray-200 text-center">Mi Estado Actual</h3>
                    {userClockingStatus.status === 'in' && (
                        <div className="flex items-center p-3 bg-green-100 dark:bg-green-800/50 rounded-lg">
                        <span className="text-4xl mr-3">🟢</span>
                        <div>
                            <p className="font-bold text-green-800 dark:text-green-200">Presente</p>
                            <p className="text-sm text-green-700 dark:text-green-300">Entrada marcada a las {userClockingStatus.time}</p>
                        </div>
                        </div>
                    )}
                    {userClockingStatus.status === 'out' && (
                        <div className="flex items-center p-3 bg-red-100 dark:bg-red-800/50 rounded-lg">
                        <span className="text-4xl mr-3">🔴</span>
                        <div>
                            <p className="font-bold text-red-800 dark:text-red-200">Ausente</p>
                            <p className="text-sm text-red-700 dark:text-red-300">Última marca a las {userClockingStatus.time}</p>
                        </div>
                        </div>
                    )}
                    {userClockingStatus.status === 'unknown' && <p>No se pudo determinar el estado.</p>}
                    {userClockingStatus.status === 'not_employee' && <p>Usuario no es un empleado registrable.</p>}
                    
                    {activeShiftReport ? (
                        <div
                            className={`flex items-center p-3 rounded-lg ${
                                activeShiftReport.responsibleUser !== currentUser?.username
                                    ? 'bg-yellow-100 dark:bg-yellow-800/50 blinker'
                                    : 'bg-blue-100 dark:bg-blue-800/50'
                            }`}
                        >
                            <BookOpenIcon
                                className={`w-8 h-8 mr-3 shrink-0 ${
                                    activeShiftReport.responsibleUser !== currentUser?.username
                                        ? 'text-yellow-600 dark:text-yellow-300'
                                        : 'text-blue-600 dark:text-blue-300'
                                }`}
                            />
                            <div>
                                <p
                                    className={`font-bold ${
                                        activeShiftReport.responsibleUser !== currentUser?.username
                                            ? 'text-yellow-800 dark:text-yellow-200'
                                            : 'text-blue-800 dark:text-blue-200'
                                    }`}
                                >
                                    Turno Iniciado
                                </p>
                                <p
                                    className={`text-sm ${
                                        activeShiftReport.responsibleUser !== currentUser?.username
                                            ? 'text-yellow-700 dark:text-yellow-300'
                                            : 'text-blue-700 dark:text-blue-300'
                                    }`}
                                >
                                    Responsable: {activeShiftReport.responsibleUser}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center p-3 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
                            <BookOpenIcon className="w-8 h-8 mr-3 shrink-0 text-gray-500" />
                            <div>
                                <p className="font-bold text-gray-800 dark:text-gray-200">Sin Turno Activo</p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Inicie un turno en el Libro de Novedades.</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Quick Actions */}
                <div className="space-y-3 flex flex-col">
                    <h3 className="font-semibold text-gray-700 dark:text-gray-200 text-center">Acciones Rápidas</h3>
                    <div className="grid grid-cols-2 gap-3 flex-grow content-center">
                        <Button onClick={() => navigate(ROUTES.TIME_CONTROL)} className={quickActionButtonClass}>
                            <ClockIcon className="w-8 h-8 mb-1" />
                            <span>Marcar Horario</span>
                        </Button>
                        <Button onClick={() => navigate(ROUTES.LOGBOOK)} className={quickActionButtonClass}>
                            <BookOpenIcon className="w-8 h-8 mb-1" />
                            <span>Libro Novedades</span>
                        </Button>
                        <Button onClick={() => navigate(ROUTES.SHIFT_CALENDAR)} className={quickActionButtonClass}>
                            <CalendarDaysIcon className="w-8 h-8 mb-1" />
                            <span>Ver Calendario</span>
                        </Button>
                        <Button onClick={() => navigate(ROUTES.EMPLOYEE_MANAGEMENT)} className={quickActionButtonClass}>
                            <UsersIcon className="w-8 h-8 mb-1" />
                            <span>Gestionar Personal</span>
                        </Button>
                    </div>
                </div>

                {/* Tools and Resources */}
                <div className="space-y-3 flex flex-col">
                    <h3 className="font-semibold text-gray-700 dark:text-gray-200 text-center">Herramientas y Recursos</h3>
                     <div className="grid grid-cols-2 gap-3 flex-grow content-center">
                        <Button onClick={() => navigate(ROUTES.COMMUNICATIONS)} variant="coral" className={toolButtonClass}>
                            <ClipboardIcon className="w-6 h-6 mb-1" />
                            <span>Comunicados</span>
                        </Button>
                        <Button onClick={onOpenQuickNotes} variant="coral" className={`${toolButtonClass} relative`}>
                            {hasUnreadNotes && (
                                <span className="absolute top-1 right-1 flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                </span>
                            )}
                            <ChatBubbleLeftRightIcon className="w-6 h-6 mb-1" />
                            <span>Notas Rápidas</span>
                        </Button>
                        <a href="imagens/reglamentointerno.pdf" target="_blank" rel="noopener noreferrer" className={`inline-block ${toolButtonClass} bg-orange-500 text-white hover:bg-orange-600 focus:ring-orange-500 dark:bg-orange-600 dark:hover:bg-orange-500 dark:focus:ring-orange-600 font-semibold rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition ease-in-out duration-150`}>
                            <DocumentTextIcon className="w-6 h-6 mb-1" />
                            <span>Reglamento</span>
                        </a>
                        <Button onClick={() => setIsMetersModalOpen(true)} variant="coral" className={toolButtonClass}>
                            <CalculatorIcon className="w-6 h-6 mb-1" />
                            <span>Medidores</span>
                        </Button>
                    </div>
                </div>
            </div>
        </Card>
    );
};


// --- Panel 2: Alerts & Team Status ---
interface AlertsAndTeamStatusPanelProps {
    upcomingEmployees: UpcomingEmployeeStatus[];
    missingClockOuts: MissingClockOutStatus[];
    teamStatus: { present: number; total: number; anomalies: any[] };
    shiftReports: ShiftReport[];
    onMissingClockOutDoubleClick: (item: MissingClockOutStatus) => void;
    setShowReportDetailsModal: (report: ShiftReport | null) => void;
    getResponsibleDisplayName: (username: string) => string;
    navigate: ReturnType<typeof useNavigate>;
    onUpcomingEmployeeDoubleClick: (employeeStatus: UpcomingEmployeeStatus) => void;
}

export const AlertsAndTeamStatusPanel: React.FC<AlertsAndTeamStatusPanelProps> = ({
    upcomingEmployees,
    missingClockOuts,
    teamStatus,
    shiftReports,
    onMissingClockOutDoubleClick,
    setShowReportDetailsModal,
    getResponsibleDisplayName,
    navigate,
    onUpcomingEmployeeDoubleClick
}) => {
    const [activeAlertTab, setActiveAlertTab] = useState<'upcoming' | 'missing'>('upcoming');

    useEffect(() => {
        const hasUpcomingAlerts = upcomingEmployees.length > 0;
        const hasMissingAlerts = missingClockOuts.length > 0;
    
        let intervalId: number | undefined;
    
        if (hasUpcomingAlerts && hasMissingAlerts) {
          intervalId = window.setInterval(() => {
            setActiveAlertTab(prev => (prev === 'upcoming' ? 'missing' : 'upcoming'));
          }, 15000);
        } else if (hasMissingAlerts) {
          setActiveAlertTab('missing');
        } else {
          setActiveAlertTab('upcoming');
        }
    
        return () => {
          if (intervalId) {
            clearInterval(intervalId);
          }
        };
      }, [upcomingEmployees.length, missingClockOuts.length]);


    return (
        <>
            <Card title="Alertas de Personal">
                <div className="flex border-b border-gray-200 dark:border-gray-700">
                    <button
                        onClick={() => setActiveAlertTab('upcoming')}
                        className={`w-1/2 pb-2 text-sm font-medium text-center transition-colors duration-150 focus:outline-none ${
                            activeAlertTab === 'upcoming'
                            ? 'border-b-2 border-sap-blue text-sap-blue dark:border-sap-light-blue dark:text-sap-light-blue'
                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                        }`}
                    >
                        Próximos a Entrar ({upcomingEmployees.length})
                    </button>
                    <button
                        onClick={() => setActiveAlertTab('missing')}
                        className={`w-1/2 pb-2 text-sm font-medium text-center transition-colors duration-150 focus:outline-none relative ${
                            activeAlertTab === 'missing'
                            ? 'border-b-2 border-sap-blue text-sap-blue dark:border-sap-light-blue dark:text-sap-light-blue'
                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                        }`}
                    >
                        Salidas Pendientes ({missingClockOuts.length})
                        {missingClockOuts.some(m => m.status === 'late') && <span className="absolute top-0 right-2 w-3 h-3 bg-red-500 rounded-full animate-ping"></span>}
                        {missingClockOuts.some(m => m.status === 'late') && <span className="absolute top-0 right-2 w-3 h-3 bg-red-500 rounded-full"></span>}
                    </button>
                </div>
                <div className="pt-4 max-h-52 overflow-y-auto">
                    {activeAlertTab === 'upcoming' ? (
                        <div className="space-y-2">
                            {upcomingEmployees.length > 0 ? (
                                upcomingEmployees.map((employeeStatus) => {
                                const { employee, shiftStartTime, status, statusText } = employeeStatus;
                                const colorClasses = {
                                    ontime: 'border-green-500',
                                    late_warn: 'border-yellow-500',
                                    late_alert: 'border-orange-500',
                                    absent: 'border-red-500',
                                };
                                return (
                                    <div 
                                        key={employee.id} 
                                        className={`flex items-center justify-between p-2 rounded-lg border-l-4 ${colorClasses[status]} bg-gray-50 dark:bg-gray-700/50 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/40 transition-colors duration-150`}
                                        onDoubleClick={() => onUpcomingEmployeeDoubleClick(employeeStatus)}
                                        title="Doble click para registrar entrada"
                                    >
                                    <div>
                                        <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm">{employee.name}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                        Turno: {shiftStartTime.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                    <p className={`font-bold text-sm ${status === 'ontime' ? 'text-green-600 dark:text-green-300' : 'text-red-600 dark:text-red-300'}`}>
                                        {statusText}
                                    </p>
                                    </div>
                                );
                                })
                            ) : (
                                <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">No hay empleados próximos a entrar.</p>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {missingClockOuts.length > 0 ? (
                                missingClockOuts.map(item => {
                                    const isUpcoming = item.status === 'upcoming';
                                    const statusText = isUpcoming ? `Sale en ${Math.abs(item.timeDifferenceMinutes)} min` : `${item.timeDifferenceMinutes} min pasado`;
                                    const textColor = isUpcoming ? 'text-yellow-600 dark:text-yellow-300' : 'text-red-600 dark:text-red-300';
                                    const borderColor = isUpcoming ? 'border-yellow-500' : 'border-red-500';
                                    const hoverBg = isUpcoming ? 'hover:bg-yellow-50 dark:hover:bg-yellow-900/40' : 'hover:bg-red-50 dark:hover:bg-red-900/40';
                                    const cursorStyle = isUpcoming ? 'cursor-default' : 'cursor-pointer';
                                    const title = isUpcoming ? 'Salida próxima' : 'Doble click para registrar salida';

                                    return (
                                        <div 
                                            key={item.employee.id} 
                                            className={`flex items-center justify-between p-2 rounded-lg border-l-4 ${borderColor} bg-gray-50 dark:bg-gray-700/50 ${hoverBg} ${cursorStyle}`}
                                            onDoubleClick={() => onMissingClockOutDoubleClick(item)}
                                            title={title}
                                        >
                                            <div>
                                            <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm">{item.employee.name}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">Salida prog: {item.shiftEndTime}</p>
                                            </div>
                                            <p className={`font-bold text-sm ${textColor}`}>
                                                {statusText}
                                            </p>
                                        </div>
                                    );
                                })
                            ) : (
                                <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">No hay salidas pendientes.</p>
                            )}
                        </div>
                    )}
                </div>
            </Card>

            <Card title="Estado del Equipo">
                <div className="flex justify-around items-center h-full text-center">
                    <div>
                    <p className="text-4xl font-bold text-green-500">{teamStatus.present}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Presentes</p>
                    </div>
                    <div>
                    <p className="text-4xl font-bold text-gray-700 dark:text-gray-200">{teamStatus.total}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Activos</p>
                    </div>
                    <div 
                    className="cursor-pointer"
                    title={teamStatus.anomalies.map(a => `${a.employeeName}: ${a.date}`).join(', ')}
                    onClick={() => teamStatus.anomalies.length > 0 && navigate(ROUTES.TIME_CONTROL)}
                    >
                    <p className={`text-4xl font-bold ${teamStatus.anomalies.length > 0 ? 'text-yellow-500' : 'text-gray-700 dark:text-gray-200'}`}>
                        {teamStatus.anomalies.length}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Anomalías</p>
                    </div>
                </div>
            </Card>

            <Card title="Últimos Reportes de Turno">
                <div className="max-h-52 overflow-y-auto">
                    {shiftReports.slice(0, 5).map(report => (
                        <div 
                            key={report.id} 
                            className="p-2 border-b last:border-b-0 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                            onDoubleClick={() => setShowReportDetailsModal(report)}
                            title="Doble click para ver detalles"
                        >
                            <div className="flex justify-between items-center text-sm">
                                <p className="font-semibold text-gray-800 dark:text-gray-100">Folio: {report.folio} ({report.shiftName})</p>
                                <p className={`font-bold text-xs px-2 py-1 rounded-full ${report.status === 'open' ? 'bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100' : 'bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200'}`}>
                                    {report.status === 'open' ? 'Abierto' : 'Cerrado'}
                                </p>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Responsable: {getResponsibleDisplayName(report.responsibleUser)}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Inicio: {new Date(report.startTime).toLocaleString('es-CL')}</p>
                        </div>
                    ))}
                    {shiftReports.length === 0 && <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">No hay reportes de turno.</p>}
                </div>
            </Card>
        </>
    );
};