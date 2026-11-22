import * as XLSX from 'xlsx';
import { BankStatementImport, BankStatementLine } from '../../types/banking';
import { round2 } from '../../utils/decimal';

export interface RawParsedRow {
  date: string;
  description: string;
  referenceNumber?: string;
  debit?: number;
  credit?: number;
  withdrawalAmount?: number;
  depositAmount?: number;
  balance?: number;
  isDuplicate?: boolean;
}

export interface StatementParseResult {
  importRecord: BankStatementImport;
  lines: BankStatementLine[];
  duplicateCount: number;
  totalParsed: number;
}

/**
 * Normalizes different date string formats into standard YYYY-MM-DD.
 */
export function normalizeStatementDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  const cleaned = dateStr.trim();

  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;

  // If DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = cleaned.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // If MM/DD/YYYY or parsing via Date object
  const parsed = new Date(cleaned);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return new Date().toISOString().split('T')[0];
}

/**
 * Parses a CSV text string into normalized statement transaction rows.
 */
export function parseCSVStatement(csvContent: string): RawParsedRow[] {
  const lines = csvContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const dateIdx = headers.findIndex((h) => h.includes('date'));
  const descIdx = headers.findIndex((h) => h.includes('desc') || h.includes('narration') || h.includes('particular'));
  const refIdx = headers.findIndex((h) => h.includes('ref') || h.includes('chq') || h.includes('cheque') || h.includes('utr'));
  const debitIdx = headers.findIndex((h) => h.includes('debit') || h.includes('withdrawal') || h === 'dr' || h.startsWith('dr '));
  const creditIdx = headers.findIndex((h) => h.includes('credit') || h.includes('deposit') || h === 'cr' || h.startsWith('cr '));
  const balIdx = headers.findIndex((h) => h.includes('balance') || h.includes('bal'));

  const parsedRows: RawParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
    if (cols.length < 3) continue;

    const rawDate = dateIdx >= 0 ? cols[dateIdx] : cols[0];
    const desc = descIdx >= 0 ? cols[descIdx] : cols[1];
    const ref = refIdx >= 0 ? cols[refIdx] : '';
    const debit = debitIdx >= 0 ? parseFloat(cols[debitIdx].replace(/[^0-9.-]+/g, '')) || 0 : 0;
    const credit = creditIdx >= 0 ? parseFloat(cols[creditIdx].replace(/[^0-9.-]+/g, '')) || 0 : 0;
    const bal = balIdx >= 0 ? parseFloat(cols[balIdx].replace(/[^0-9.-]+/g, '')) || undefined : undefined;

    if (debit === 0 && credit === 0) continue;

    parsedRows.push({
      date: normalizeStatementDate(rawDate),
      description: desc || 'Bank Transaction',
      referenceNumber: ref || undefined,
      debit: round2(Math.abs(debit)),
      credit: round2(Math.abs(credit)),
      balance: bal !== undefined ? round2(bal) : undefined
    });
  }

  return parsedRows;
}

/**
 * Parses an XLSX buffer/array into normalized statement transaction rows using xlsx library.
 */
export function parseXLSXStatement(data: ArrayBuffer | Uint8Array): RawParsedRow[] {
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  if (rawJson.length < 2) return [];

  // Find header row (first row with at least 3 non-empty cells)
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(10, rawJson.length); i++) {
    const row = rawJson[i];
    if (Array.isArray(row) && row.filter(Boolean).length >= 3) {
      headerRowIdx = i;
      break;
    }
  }

  const headers = (rawJson[headerRowIdx] as any[]).map((h) => String(h || '').trim().toLowerCase());
  const dateIdx = headers.findIndex((h) => h.includes('date'));
  const descIdx = headers.findIndex((h) => h.includes('desc') || h.includes('narration') || h.includes('particular'));
  const refIdx = headers.findIndex((h) => h.includes('ref') || h.includes('chq') || h.includes('cheque') || h.includes('utr'));
  const debitIdx = headers.findIndex((h) => h.includes('debit') || h.includes('withdrawal') || h === 'dr' || h.startsWith('dr '));
  const creditIdx = headers.findIndex((h) => h.includes('credit') || h.includes('deposit') || h === 'cr' || h.startsWith('cr '));
  const balIdx = headers.findIndex((h) => h.includes('balance') || h.includes('bal'));

  const parsedRows: RawParsedRow[] = [];

  for (let i = headerRowIdx + 1; i < rawJson.length; i++) {
    const row = rawJson[i];
    if (!Array.isArray(row) || row.length === 0) continue;

    const rawDate = dateIdx >= 0 ? String(row[dateIdx] || '') : String(row[0] || '');
    const desc = descIdx >= 0 ? String(row[descIdx] || '') : String(row[1] || '');
    const ref = refIdx >= 0 ? String(row[refIdx] || '') : '';
    const debit = debitIdx >= 0 ? parseFloat(String(row[debitIdx] || '0').replace(/[^0-9.-]+/g, '')) || 0 : 0;
    const credit = creditIdx >= 0 ? parseFloat(String(row[creditIdx] || '0').replace(/[^0-9.-]+/g, '')) || 0 : 0;
    const bal = balIdx >= 0 ? parseFloat(String(row[balIdx] || '').replace(/[^0-9.-]+/g, '')) || undefined : undefined;

    if (debit === 0 && credit === 0) continue;

    parsedRows.push({
      date: normalizeStatementDate(rawDate),
      description: desc.trim() || 'Bank Transaction',
      referenceNumber: ref.trim() || undefined,
      debit: round2(Math.abs(debit)),
      credit: round2(Math.abs(credit)),
      balance: bal !== undefined ? round2(bal) : undefined
    });
  }

  return parsedRows;
}

/**
 * Validates parsed statement rows, detects duplicates against existing lines,
 * and builds BankStatementImport and BankStatementLine records.
 * Supports both options object and positional arguments.
 */
export function buildStatementImport(
  rawRowsOrOptions: RawParsedRow[] | {
    rawRows: RawParsedRow[];
    bankAccountId: string;
    bankAccountName?: string;
    fileName: string;
    fileType?: 'csv' | 'xlsx';
    existingLines?: BankStatementLine[];
    businessId?: string;
  },
  bankAccountIdArg?: string,
  bankAccountNameArg?: string,
  fileNameArg?: string,
  existingLinesArg: BankStatementLine[] = [],
  businessIdArg?: string
): StatementParseResult & {
  statementLines: BankStatementLine[];
} {
  let rawRows: RawParsedRow[];
  let bankAccountId: string;
  let bankAccountName: string;
  let fileName: string;
  let existingLines: BankStatementLine[];
  let businessId: string | undefined;

  if (!Array.isArray(rawRowsOrOptions)) {
    const opts = rawRowsOrOptions;
    rawRows = opts.rawRows || [];
    bankAccountId = opts.bankAccountId;
    bankAccountName = opts.bankAccountName || 'Bank Account';
    fileName = opts.fileName;
    existingLines = opts.existingLines || [];
    businessId = opts.businessId;
  } else {
    rawRows = rawRowsOrOptions;
    bankAccountId = bankAccountIdArg || '';
    bankAccountName = bankAccountNameArg || 'Bank Account';
    fileName = fileNameArg || 'statement';
    existingLines = existingLinesArg;
    businessId = businessIdArg;
  }

  const importId = `bsi_${Date.now()}`;
  let duplicateCount = 0;
  const lines: BankStatementLine[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];

    // Duplicate detection: same bank account, date, debit, credit, and similar description or ref
    const isDuplicate = existingLines.some((existing) => {
      const existingDate = existing.date || existing.transactionDate;
      const existingDr = existing.debit !== undefined ? existing.debit : (existing.withdrawalAmount || 0);
      const existingCr = existing.credit !== undefined ? existing.credit : (existing.depositAmount || 0);

      if (existing.bankAccountId !== bankAccountId) return false;
      if (existingDate !== row.date) return false;
      if (Math.abs(existingDr - row.debit) > 0.01 || Math.abs(existingCr - row.credit) > 0.01) return false;
      if (row.referenceNumber && existing.referenceNumber && row.referenceNumber.toLowerCase() === existing.referenceNumber.toLowerCase()) {
        return true;
      }
      return existing.description.toLowerCase() === row.description.toLowerCase();
    });

    if (isDuplicate) {
      duplicateCount++;
      continue; // Skip duplicate rows
    }

    lines.push({
      id: `bsl_${importId}_${i + 1}`,
      importId,
      statementId: importId,
      bankAccountId,
      date: row.date,
      transactionDate: row.date,
      description: row.description,
      referenceNumber: row.referenceNumber,
      debit: row.debit,
      withdrawalAmount: row.debit,
      credit: row.credit,
      depositAmount: row.credit,
      balance: row.balance,
      balanceAfter: row.balance,
      matchedStatus: 'unmatched',
      isReconciled: false
    });
  }

  const importRecord: BankStatementImport = {
    id: importId,
    businessId,
    bankAccountId,
    bankAccountName,
    fileName,
    importedAt: new Date().toISOString(),
    transactionCount: lines.length,
    totalRows: rawRows.length,
    importedRowsCount: lines.length,
    duplicateRowsCount: duplicateCount,
    status: 'imported'
  };

  return {
    importRecord,
    lines,
    statementLines: lines,
    duplicateCount,
    totalParsed: rawRows.length
  };
}
