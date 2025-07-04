/**
 * Calculates the number of hours between two HH:MM time strings, accounting for overnight shifts and optional breaks.
 * @param startTime - The start time in "HH:MM" format.
 * @param endTime - The end time in "HH:MM" format.
 * @param breakMinutes - The duration of the break in minutes.
 * @returns The total hours as a number, rounded to two decimal places. Returns 0 if inputs are invalid.
 */
export const calculateHoursBetween = (startTime?: string, endTime?: string, breakMinutes: number = 0): number => {
  if (!startTime || !endTime) return 0;

  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);

  if (isNaN(startHour) || isNaN(startMinute) || isNaN(endHour) || isNaN(endMinute)) return 0;

  const startDate = new Date(0, 0, 0, startHour, startMinute, 0);
  let endDate = new Date(0, 0, 0, endHour, endMinute, 0);

  if (endDate.getTime() < startDate.getTime()) { // Handles overnight shifts by adding a day
    endDate.setDate(endDate.getDate() + 1);
  }
  
  let diffMs = endDate.getTime() - startDate.getTime();
  if (diffMs < 0) return 0; 

  const breakMs = breakMinutes * 60 * 1000;
  diffMs -= breakMs;
  if (diffMs < 0) diffMs = 0; // Hours cannot be negative

  return parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2)); // Convert ms to hours, round to 2 decimal
};
