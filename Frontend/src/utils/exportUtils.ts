import * as XLSX from 'xlsx';
import { ShiftReport } from '../types';

const escapeCsvCell = (cell: any): string => {
    const stringCell = String(cell ?? '');
    if (stringCell.includes(',') || stringCell.includes('"') || stringCell.includes('\n')) {
        return `"${stringCell.replace(/"/g, '""')}"`;
    }
    return stringCell;
};

export const exportToCSV = (headers: string[], data: any[][], fileName: string) => {
    const rows = data.map(row => row.map(escapeCsvCell).join(','));
    const csvContent = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${fileName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

export const exportToExcel = (headers: string[], data: any[][], fileName: string, sheetName: string = 'Datos') => {
    const dataAsArray = [headers, ...data];
    const worksheet = XLSX.utils.aoa_to_sheet(dataAsArray);
    const columnWidths = headers.map((header, i) => {
        const maxLength = Math.max(header.length, ...dataAsArray.slice(1).map(row => (row[i] ? String(row[i]).length : 0)));
        return { wch: maxLength + 2 };
    });
    worksheet['!cols'] = columnWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

const escapeHtml = (str: any): string => {
    if (str === null || str === undefined) return '';
    const p = document.createElement('p');
    p.textContent = String(str);
    return p.innerHTML;
};

export const exportToPDF = (
    title: string,
    headers: string[],
    data: any[][],
    filtersString: string,
    columnStyles: { [key: number]: string } = {}
) => {
    const htmlRows = data.map(row => 
        `<tr>${row.map((cell, index) => {
            const styleClass = columnStyles[index] || '';
            const cellValue = escapeHtml(cell);
            if (styleClass) {
                return `<td class="${styleClass}">${cellValue}</td>`;
            }
            return `<td>${cellValue}</td>`;
        }).join('')}</tr>`
    ).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <style>
          @media print {
            @page { size: A4 landscape; margin: 20px; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
          h1 { text-align: center; color: #005792; }
          table { width: 100%; border-collapse: collapse; font-size: 10px; }
          th, td { border: 1px solid #cccccc; padding: 6px; text-align: left; word-break: break-word; }
          thead { background-color: #f0f2f5; }
          th { font-weight: 600; color: #343a40; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          .status-activo { color: green; font-weight: bold; }
          .status-inactivo { color: red; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        <p>Exportado el: ${new Date().toLocaleString('es-CL')}</p>
        <p>Filtros aplicados: ${escapeHtml(filtersString)}</p>
        <table>
          <thead>
            <tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr>
          </thead>
          <tbody>${htmlRows}</tbody>
        </table>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            try {
                printWindow.print();
                printWindow.onafterprint = () => printWindow.close();
            } catch (e) {
                console.error("Error al imprimir:", e);
                // Can't use addToast here as this is a util file
                alert("Error al abrir la ventana de impresión.");
                printWindow.close();
            }
        }, 500);
    } else {
        alert("No se pudo abrir la ventana de impresión. Verifique los bloqueadores de pop-ups.");
    }
};

export const exportShiftReportToPDF = (report: ShiftReport, responsibleDisplayName: string) => {
    const title = `Reporte de Turno: Folio ${report.folio}`;
    
    const generalInfoHtml = `
        <h2>Información General</h2>
        <p><strong>Folio:</strong> ${escapeHtml(report.folio)}</p>
        <p><strong>Fecha:</strong> ${escapeHtml(new Date(report.date + 'T00:00:00').toLocaleDateString('es-CL'))}</p>
        <p><strong>Turno:</strong> ${escapeHtml(report.shiftName)}</p>
        <p><strong>Responsable:</strong> ${escapeHtml(responsibleDisplayName)}</p>
        <p><strong>Inicio:</strong> ${escapeHtml(new Date(report.startTime).toLocaleString('es-CL'))}</p>
        <p><strong>Cierre:</strong> ${report.endTime ? escapeHtml(new Date(report.endTime).toLocaleString('es-CL')) : 'N/A'}</p>
    `;

    const noveltiesHtml = `
        <h2>Novedades Registradas (${report.logEntries.length})</h2>
        ${report.logEntries.length > 0 ? `
            <ul>
                ${report.logEntries.map(le => `<li><strong>${escapeHtml(le.time)}:</strong> ${escapeHtml(le.annotation)}</li>`).join('')}
            </ul>
        ` : '<p>Ninguna.</p>'}
    `;

    const suppliersHtml = `
        <h2>Ingresos de Proveedores (${report.supplierEntries.length})</h2>
        ${report.supplierEntries.length > 0 ? `
            <ul>
                ${report.supplierEntries.map(se => `
                    <li class="supplier-entry">
                        <strong>${escapeHtml(se.time)}</strong> - ${escapeHtml(se.company)} (Cond: ${escapeHtml(se.driverName)}, Pat: ${escapeHtml(se.licensePlate)}, Pax: ${escapeHtml(se.paxCount)}). Motivo: ${escapeHtml(se.reason)}
                    </li>
                `).join('')}
            </ul>
        ` : '<p>Ninguno.</p>'}
    `;

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${escapeHtml(title)}</title>
            <style>
                @media print {
                    @page { size: A4; margin: 25px; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; line-height: 1.5; color: #333; }
                h1 { text-align: center; color: #005792; font-size: 1.5em; margin-bottom: 20px; }
                h2 { font-size: 1.2em; color: #005792; border-bottom: 1px solid #dee2e6; padding-bottom: 5px; margin-top: 20px; }
                p { margin: 5px 0; }
                ul { list-style-type: disc; padding-left: 20px; margin: 0; }
                li { margin-bottom: 5px; }
                .supplier-entry { border-bottom: 1px dotted #ccc; padding-bottom: 5px; margin-bottom: 5px; list-style-type: none; }
                .footer { text-align: center; font-size: 0.8em; color: #777; margin-top: 30px; border-top: 1px solid #ccc; padding-top: 10px; }
            </style>
        </head>
        <body>
            <h1>${escapeHtml(title)}</h1>
            <div class="footer">Exportado el: ${new Date().toLocaleString('es-CL')}</div>
            
            ${generalInfoHtml}
            ${noveltiesHtml}
            ${suppliersHtml}
        </body>
        </html>
    `;
    
     const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            try {
                printWindow.print();
                printWindow.onafterprint = () => printWindow.close();
            } catch (e) {
                console.error("Error al imprimir:", e);
                alert("Error al abrir la ventana de impresión.");
                printWindow.close();
            }
        }, 500);
    } else {
        alert("No se pudo abrir la ventana de impresión. Verifique los bloqueadores de pop-ups.");
    }
};