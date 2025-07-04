
import { useState, useMemo } from 'react';
import { getWeekStartDate, getDateRange } from '../utils/dateUtils';

export type PeriodViewMode = 'day' | 'week' | 'month';

export const usePeriodNavigator = (initialMode: PeriodViewMode = 'week') => {
  const [viewMode, setViewMode] = useState<PeriodViewMode>(initialMode);
  const [currentDate, setCurrentDate] = useState(new Date());

  const handlePrev = () => {
    setCurrentDate(prevDate => {
      const newDate = new Date(prevDate);
      if (viewMode === 'day') newDate.setDate(newDate.getDate() - 1);
      else if (viewMode === 'week') newDate.setDate(newDate.getDate() - 7);
      else newDate.setMonth(newDate.getMonth() - 1);
      return newDate;
    });
  };
  
  const handleNext = () => {
    setCurrentDate(prevDate => {
      const newDate = new Date(prevDate);
      if (viewMode === 'day') newDate.setDate(newDate.getDate() + 1);
      else if (viewMode === 'week') newDate.setDate(newDate.getDate() + 7);
      else newDate.setMonth(newDate.getMonth() + 1);
      return newDate;
    });
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };
  
  const isViewingCurrentPeriod = useMemo(() => {
    const today = new Date();
    const { startDate, endDate } = getDateRange(viewMode, currentDate);
    return today.getTime() >= startDate.getTime() && today.getTime() <= endDate.getTime();
  }, [viewMode, currentDate]);

  const headerDisplay = useMemo(() => {
    const { startDate, endDate } = getDateRange(viewMode, currentDate);
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };

    switch (viewMode) {
      case 'day':
        return startDate.toLocaleDateString('es-CL', options);
      case 'week':
        const startStr = startDate.toLocaleDateString('es-CL', { day: 'numeric', month: 'long' });
        const endStr = endDate.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
        return `${startStr} - ${endStr}`;
      case 'month':
        return startDate.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase());
    }
  }, [viewMode, currentDate]);

  return {
    viewMode,
    setViewMode,
    currentDate,
    setCurrentDate,
    handlePrev,
    handleNext,
    handleToday,
    isViewingCurrentPeriod,
    headerDisplay
  };
};
