// Helper function to get the start of the week (Monday)
export const getWeekStartDate = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay(); // 0 for Sunday, 1 for Monday, etc.
    // Adjust diff to make Monday the first day (0)
    // If day is Sunday (0), we want to go back 6 days. If day is Monday (1), we go back 0 days.
    const diff = d.getDate() - (day === 0 ? 6 : day - 1);
    return new Date(d.setDate(diff));
};
  
export const getDateRange = (mode: 'day' | 'week' | 'month', date: Date): { startDate: Date; endDate: Date } => {
      const d = new Date(date);
      let startDate: Date;
      let endDate: Date;
    
      switch (mode) {
        case 'day':
          startDate = new Date(d);
          endDate = new Date(d);
          break;
        case 'week':
          startDate = getWeekStartDate(d);
          endDate = new Date(startDate);
          endDate.setDate(startDate.getDate() + 6);
          break;
        case 'month':
          startDate = new Date(d.getFullYear(), d.getMonth(), 1);
          endDate = new Date(d.getFullYear(), d.getMonth() + 1, 0);
          break;
      }
    
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      return { startDate, endDate };
};
  