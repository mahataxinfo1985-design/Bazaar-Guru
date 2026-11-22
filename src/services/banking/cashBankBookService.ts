import { CashBankBookReport, CashBankBookRow } from '../../types/banking';
import { JournalEntry, Account } from '../../types/accounting';
import { round2, safeAdd, safeSub } from '../../utils/decimal';

/**
 * Generates an official Cashbook or Bankbook report for an account over a date range.
 * Balances derive strictly from posted double-entry journal entries.
 * Supports both options object and positional arguments.
 */
export function generateCashBankBookReport(
  accountIdOrOptions: string | {
    accountId: string;
    accountName: string;
    accountType: 'cash' | 'bank';
    journalEntries: JournalEntry[];
    openingBalance?: number;
    fromDate?: string;
    toDate?: string;
    startDate?: string;
    endDate?: string;
  },
  accountNameArg?: string,
  accountTypeArg?: 'cash' | 'bank',
  journalEntriesArg?: JournalEntry[],
  baseOpeningBalanceArg: number = 0,
  startDateArg?: string,
  endDateArg?: string
): CashBankBookReport {
  let accountId: string;
  let accountName: string;
  let accountType: 'cash' | 'bank';
  let journalEntries: JournalEntry[];
  let baseOpeningBalance = 0;
  let startDate: string | undefined;
  let endDate: string | undefined;

  if (typeof accountIdOrOptions === 'object') {
    accountId = accountIdOrOptions.accountId;
    accountName = accountIdOrOptions.accountName;
    accountType = accountIdOrOptions.accountType;
    journalEntries = accountIdOrOptions.journalEntries;
    baseOpeningBalance = accountIdOrOptions.openingBalance || 0;
    startDate = accountIdOrOptions.fromDate || accountIdOrOptions.startDate;
    endDate = accountIdOrOptions.toDate || accountIdOrOptions.endDate;
  } else {
    accountId = accountIdOrOptions;
    accountName = accountNameArg || 'Account';
    accountType = accountTypeArg || 'bank';
    journalEntries = journalEntriesArg || [];
    baseOpeningBalance = baseOpeningBalanceArg;
    startDate = startDateArg;
    endDate = endDateArg;
  }

  // Sort entries chronologically
  const sorted = [...journalEntries]
    .filter((e) => e.status === 'posted')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // 1. Calculate opening balance as of startDate
  let openingBalance = baseOpeningBalance;
  if (startDate) {
    for (const entry of sorted) {
      if (entry.date >= startDate) break;
      for (const line of entry.lines) {
        if (line.accountId === accountId || (accountType === 'cash' && line.accountCode === '1010') || (accountType === 'bank' && line.accountCode === '1020')) {
          openingBalance = safeAdd(openingBalance, line.debit);
          openingBalance = safeSub(openingBalance, line.credit);
        }
      }
    }
  }

  // 2. Build rows within [startDate, endDate]
  const rows: CashBankBookRow[] = [];
  let runningBalance = openingBalance;
  let totalDebit = 0;
  let totalCredit = 0;

  for (const entry of sorted) {
    if (startDate && entry.date < startDate) continue;
    if (endDate && entry.date > endDate) continue;

    for (const line of entry.lines) {
      const isTarget = line.accountId === accountId || 
        (accountType === 'cash' && line.accountCode === '1010') || 
        (accountType === 'bank' && line.accountCode === '1020');

      if (!isTarget) continue;

      runningBalance = safeAdd(runningBalance, line.debit);
      runningBalance = safeSub(runningBalance, line.credit);
      totalDebit = safeAdd(totalDebit, line.debit);
      totalCredit = safeAdd(totalCredit, line.credit);

      rows.push({
        id: `${entry.id}_${line.id}`,
        date: entry.date,
        voucherNumber: entry.entryNumber,
        voucherType: formatVoucherType(entry.sourceType),
        particulars: line.description || entry.narration || `${accountName} Movement`,
        counterParty: line.partyName || (entry as any).partyName,
        narration: entry.narration,
        referenceNumber: entry.sourceId,
        debit: line.debit,
        debitAmount: line.debit,
        credit: line.credit,
        creditAmount: line.credit,
        runningBalance: round2(runningBalance)
      });
    }
  }

  return {
    accountId,
    accountName,
    accountType,
    startDate: startDate || 'All Time',
    endDate: endDate || 'Present',
    fromDate: startDate,
    toDate: endDate,
    openingBalance: round2(openingBalance),
    totalDebit: round2(totalDebit),
    totalDebits: round2(totalDebit),
    totalCredit: round2(totalCredit),
    totalCredits: round2(totalCredit),
    closingBalance: round2(runningBalance),
    rows,
    transactions: rows
  };
}

function formatVoucherType(sourceType: string): string {
  switch (sourceType) {
    case 'payment_in': return 'Receipt (Payment In)';
    case 'payment_out': return 'Payment Voucher';
    case 'fund_transfer': return 'Contra (Transfer)';
    case 'sales_invoice': return 'Cash Sale';
    case 'purchase_invoice': return 'Cash Purchase';
    case 'expense': return 'Expense Voucher';
    case 'cheque_bounce': return 'Cheque Bounce Reversal';
    default: return 'Journal Voucher';
  }
}

/**
 * Exports a Cash/Bank book report into standard CSV format.
 * Returns CSV string and optionally triggers browser download.
 */
export function exportCashBankBookCSV(report: CashBankBookReport): string {
  const headers = ['Date', 'Voucher No', 'Type', 'Particulars', 'Debit (Receipt)', 'Credit (Payment)', 'Running Balance'];
  const dataRows = (report.rows || report.transactions || []).map((r) => [
    r.date,
    `"${r.voucherNumber}"`,
    `"${r.voucherType}"`,
    `"${(r.particulars || '').replace(/"/g, '""')}"`,
    r.debit > 0 ? r.debit.toFixed(2) : '',
    r.credit > 0 ? r.credit.toFixed(2) : '',
    r.runningBalance.toFixed(2)
  ]);

  const csvContent = [
    `"Cash / Bank Register: ${report.accountName}"`,
    `"Period: ${report.startDate || report.fromDate || 'All'} to ${report.endDate || report.toDate || 'All'}"`,
    `"Opening Balance: ₹${report.openingBalance.toFixed(2)}"`,
    headers.join(','),
    ...dataRows.map((row) => row.join(',')),
    `"TOTALS",,,,"₹${(report.totalDebit || report.totalDebits || 0).toFixed(2)}","₹${(report.totalCredit || report.totalCredits || 0).toFixed(2)}","₹${report.closingBalance.toFixed(2)}"`
  ].join('\n');

  if (typeof document !== 'undefined') {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${report.accountName.replace(/\s+/g, '_')}_Register.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return csvContent;
}
