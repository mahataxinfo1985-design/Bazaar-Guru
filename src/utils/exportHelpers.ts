import { Invoice, Party } from '../types';

/**
 * Escapes a single value for CSV compliance.
 * If value contains double quotes, commas, or newlines, it wraps the value
 * in double quotes and escapes existing double quotes by doubling them.
 */
export function escapeCSVValue(val: any): string {
  const str = val === undefined || val === null ? '' : String(val);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Converts a list of records into a valid CSV string.
 */
export function convertToCSV(data: any[]): string {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const csvRows: string[] = [];

  // Header row
  csvRows.push(headers.map(h => escapeCSVValue(h)).join(','));

  // Data rows
  for (const row of data) {
    const values = headers.map(header => escapeCSVValue(row[header]));
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}

/**
 * Downloads a CSV string as a file, inserting a UTF-8 BOM to ensure Excel opens non-ASCII characters correctly.
 */
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Exports a single invoice to pretty-printed JSON.
 * Filename format: {invoice_number}_{date}.json
 */
export function exportInvoiceJSON(invoice: Invoice, party: Party | null): void {
  const payload = {
    ...invoice,
    partyDetails: party || null
  };
  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  // Safe filename
  const cleanInvNo = invoice.invoiceNumber.replace(/[^a-zA-Z0-9-_]/g, '_');
  const filename = `${cleanInvNo}_${invoice.date}.json`;
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Exports a list of invoices to pretty-printed JSON.
 * Filename format: {report_name}_{date}.json
 */
export function exportBulkInvoicesJSON(invoicesList: Invoice[], parties: Party[], prefix: string): void {
  const payload = invoicesList.map(inv => ({
    ...inv,
    partyDetails: parties.find(p => p.id === inv.partyId) || null
  }));
  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  const currentDate = new Date().toISOString().split('T')[0];
  const filename = `${prefix}_${currentDate}.json`;
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Exports invoices as a CSV file.
 */
export function exportInvoicesCSV(invoices: Invoice[], filenamePrefix: string = 'Invoices'): void {
  const rows = invoices.map(inv => ({
    'Invoice Number': inv.invoiceNumber,
    'Date': inv.date,
    'Type': inv.type,
    'Status': inv.status,
    'Payment Status': inv.paymentStatus,
    'Grand Total': inv.grandTotal,
    'Amount Received': inv.amountReceived,
    'Balance Due': inv.balanceDue,
    'Taxable Amount': inv.taxableAmount,
    'CGST': inv.cgst,
    'SGST': inv.sgst,
    'IGST': inv.igst,
  }));
  const csv = convertToCSV(rows);
  downloadCSV(csv, `${filenamePrefix}_${new Date().toISOString().split('T')[0]}.csv`);
}

/**
 * Exports invoices as Excel-compatible CSV.
 */
export function exportInvoicesExcel(invoices: Invoice[], filenamePrefix: string = 'Invoices'): void {
  exportInvoicesCSV(invoices, filenamePrefix);
}
