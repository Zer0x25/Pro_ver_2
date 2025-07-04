
/**
 * Formats a Date object into a user-friendly time-only string (HH:mm).
 * @param date The Date object to format.
 * @returns The formatted time string.
 */
export const formatTime = (date: Date): string => {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return '--:--';
  }
  return date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
};

/**
 * Formats an ISO-like datetime string (YYYY-MM-DDTHH:mm) or "SIN REGISTRO" into a user-friendly format (DD/MM/YYYY HH:mm).
 * Returns '-' for invalid or empty inputs.
 * @param isoDateTimeString The date-time string to format.
 * @returns The formatted string.
 */
export const formatDisplayDateTime = (isoDateTimeString?: string | "SIN REGISTRO"): string => {
  if (!isoDateTimeString || isoDateTimeString === "SIN REGISTRO") {
    return isoDateTimeString || '-';
  }
  try {
    const date = new Date(String(isoDateTimeString));
    if (isNaN(date.getTime())) return '-';
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch (e) {
    console.error("Error formatting date:", isoDateTimeString, e);
    return '-';
  }
};

/**
 * Formats an ISO-like datetime string into a user-friendly time-only format (HH:mm).
 * Returns 'Sin Registro' or '-' for invalid inputs.
 * @param isoDateTimeString The date-time string to format.
 * @returns The formatted time string.
 */
export const formatDisplayTime = (isoDateTimeString?: string | "SIN REGISTRO"): string => {
    if (!isoDateTimeString || isoDateTimeString === "SIN REGISTRO") return "Sin Registro";
    try {
        const date = new Date(String(isoDateTimeString));
        if (isNaN(date.getTime())) return '-';
        return formatTime(date);
    } catch (e) {
        return '-';
    }
};

/**
 * Formats a Date object into a string suitable for an <input type="datetime-local">.
 * @param date The Date object.
 * @returns The formatted string (YYYY-MM-DDTHH:mm).
 */
export const formatDateToDateTimeLocal = (date: Date): string => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

/**
 * Formats an ISO timestamp string into a detailed, user-friendly format for logs.
 * @param isoDateTimeString The ISO string from the log.
 * @returns The formatted string (DD/MM/YYYY HH:mm:ss).
 */
export const formatLogTimestamp = (isoDateTimeString?: string): string => {
  if (!isoDateTimeString) return '-';
  try {
    const date = new Date(isoDateTimeString);
    if (isNaN(date.getTime())) return '-';
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  } catch (e) {
    console.error("Error formatting log timestamp:", isoDateTimeString, e);
    return '-';
  }
};
