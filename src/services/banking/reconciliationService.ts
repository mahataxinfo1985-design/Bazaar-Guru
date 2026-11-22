import { BankStatementLine, BankReconciliation, BankReconciliationMatch } from '../../types/banking';
import { PaymentVoucher, FundTransfer, ChequeRecord } from '../../types';
import { JournalEntry, Account } from '../../types/accounting';
import { round2, safeAdd, safeSub } from '../../utils/decimal';

export interface BookTransactionItem {
  id: string;
  date: string;
  type: 'payment_in' | 'payment_out' | 'transfer_in' | 'transfer_out' | 'expense' | 'journal';
  referenceNumber?: string;
  particulars: string;
  debit: number; // Deposit into bank
  credit: number; // Withdrawal from bank
  isMatched: boolean;
  matchedStatementLineId?: string;
}

export interface ReconciliationStatusSummary {
  statementClosingBalance: number;
  bookClosingBalance: number;
  unpresentedCheques: number; // In books but not yet in statement
  depositsInTransit: number; // In books but not yet in statement
  unrecordedBankDebits: number; // On statement but not in books (e.g. bank charges)
  unrecordedBankCredits: number; // On statement but not in books (e.g. interest)
  adjustedBookBalance: number;
  adjustedStatementBalance: number;
  reconciliationDifference: number;
  isReconciled: boolean;
  matchedLinesCount: number;
  unmatchedLinesCount: number;
}

/**
 * Extracts and prepares book transactions for a specific bank account from all sources.
 */
export function extractBankBookTransactions(
  bankAccountId: string,
  journalEntries: JournalEntry[],
  paymentVouchers: PaymentVoucher[],
  fundTransfers: FundTransfer[] = [],
  asOfDate?: string
): BookTransactionItem[] {
  const items: BookTransactionItem[] = [];

  // 1. From Journal Entries affecting this bank account (acc_1020 or specific id)
  for (const entry of journalEntries) {
    if (entry.status !== 'posted') continue;
    if (asOfDate && entry.date > asOfDate) continue;

    for (const line of entry.lines) {
      if (line.accountId === bankAccountId || (bankAccountId.includes('bank') && line.accountCode === '1020')) {
        let type: BookTransactionItem['type'] = 'journal';
        if (entry.sourceType === 'payment_in') type = 'payment_in';
        else if (entry.sourceType === 'payment_out') type = 'payment_out';
        else if (entry.sourceType === 'fund_transfer') {
          type = line.debit > 0 ? 'transfer_in' : 'transfer_out';
        } else if (entry.sourceType === 'expense') {
          type = 'expense';
        }

        items.push({
          id: `${entry.id}_${line.id}`,
          date: entry.date,
          type,
          referenceNumber: entry.entryNumber,
          particulars: line.description || entry.narration || 'Bank Entry',
          debit: line.debit,
          credit: line.credit,
          isMatched: false
        });
      }
    }
  }

  return items;
}

/**
 * Automatically suggests matches between statement lines and book transactions.
 * Matches if:
 * 1. Exact amount match (Statement Credit matches Book Debit, or Statement Debit matches Book Credit)
 * 2. AND (Reference numbers match OR date is within +/- 3 days)
 */
export function autoMatchBankTransactions(
  statementLines: BankStatementLine[],
  bookItems: BookTransactionItem[]
): {
  matches: Array<{ statementLineId: string; bookTransactionId: string }>;
  matchedStatementIds: Set<string>;
  matchedBookIds: Set<string>;
} {
  const matches: Array<{ statementLineId: string; bookTransactionId: string }> = [];
  const matchedStatementIds = new Set<string>();
  const matchedBookIds = new Set<string>();

  for (const sLine of statementLines) {
    if (sLine.matchedStatus === 'matched' || matchedStatementIds.has(sLine.id)) continue;

    // Find candidate book transaction
    for (const bItem of bookItems) {
      if (bItem.isMatched || matchedBookIds.has(bItem.id)) continue;

      // Amount match check
      const amountMatches = (sLine.credit > 0 && Math.abs(sLine.credit - bItem.debit) <= 0.01) ||
                            (sLine.debit > 0 && Math.abs(sLine.debit - bItem.credit) <= 0.01);

      if (!amountMatches) continue;

      // Date window check (+/- 3 days)
      const sDate = new Date(sLine.date).getTime();
      const bDate = new Date(bItem.date).getTime();
      const daysDiff = Math.abs((sDate - bDate) / (1000 * 60 * 60 * 24));

      // Reference match check
      const refMatches = sLine.referenceNumber && bItem.referenceNumber &&
        (sLine.referenceNumber.toLowerCase() === bItem.referenceNumber.toLowerCase() ||
         bItem.particulars.toLowerCase().includes(sLine.referenceNumber.toLowerCase()));

      if (refMatches || daysDiff <= 4) {
        matches.push({
          statementLineId: sLine.id,
          bookTransactionId: bItem.id
        });
        matchedStatementIds.add(sLine.id);
        matchedBookIds.add(bItem.id);
        break;
      }
    }
  }

  return { matches, matchedStatementIds, matchedBookIds };
}

/**
 * Computes complete bank reconciliation difference and balances.
 * Supports both options object signature and traditional 4-parameter positional signature.
 */
export function computeReconciliationSummary(
  statementLinesOrOptions: BankStatementLine[] | {
    bankAccountId: string;
    statementClosingBalance: number;
    bankStatementLines?: BankStatementLine[];
    chequeRecords?: ChequeRecord[];
    journalEntries?: JournalEntry[];
  },
  bookItemsArg?: BookTransactionItem[],
  statementClosingBalanceArg?: number,
  bookClosingBalanceArg?: number
): ReconciliationStatusSummary & {
  unpresentedChequesAmount: number;
  uncreditedDepositsAmount: number;
  bankChargesNotInBooks: number;
  interestNotInBooks: number;
  reconciledBalance: number;
  difference: number;
  isBalanced: boolean;
} {
  if (!Array.isArray(statementLinesOrOptions)) {
    const opts = statementLinesOrOptions;
    const bankAccountId = opts.bankAccountId;
    const stmtBal = opts.statementClosingBalance || 0;
    const lines = opts.bankStatementLines || [];
    const cheques = opts.chequeRecords || [];
    const journals = opts.journalEntries || [];

    // Calculate book balance from journal entries
    let bookBal = 0;
    for (const j of journals) {
      if (j.status !== 'posted') continue;
      for (const l of j.lines) {
        if (l.accountId === bankAccountId || l.accountCode === '1020') {
          bookBal = safeAdd(bookBal, l.debit);
          bookBal = safeSub(bookBal, l.credit);
        }
      }
    }

    // Unpresented cheques: issued cheques not yet cleared by bank
    let unpresented = 0;
    for (const c of cheques) {
      const isIssued = c.type === 'issued' || c.chequeType === 'issued';
      if (isIssued && (c.status === 'issued' || c.status === 'pending_clearance')) {
        unpresented = safeAdd(unpresented, c.amount);
      }
    }

    // Uncredited deposits: received cheques deposited but not yet cleared
    let uncredited = 0;
    for (const c of cheques) {
      const isReceived = c.type === 'received' || c.chequeType === 'received';
      if (isReceived && (c.status === 'deposited' || c.status === 'received' || c.status === 'pending_clearance')) {
        uncredited = safeAdd(uncredited, c.amount);
      }
    }

    // Standard Bank Reconciliation Equation:
    // Reconciled Statement Balance = Statement Balance + Unpresented Cheques - Uncredited Deposits
    const reconciledStatementBalance = round2(stmtBal + unpresented - uncredited);
    const diff = round2(Math.abs(safeSub(reconciledStatementBalance, bookBal)));
    const isBalanced = diff <= 0.01;

    return {
      statementClosingBalance: stmtBal,
      bookClosingBalance: round2(bookBal),
      unpresentedCheques: unpresented,
      unpresentedChequesAmount: unpresented,
      depositsInTransit: uncredited,
      uncreditedDepositsAmount: uncredited,
      unrecordedBankDebits: 0,
      bankChargesNotInBooks: 0,
      unrecordedBankCredits: 0,
      interestNotInBooks: 0,
      adjustedBookBalance: round2(bookBal),
      adjustedStatementBalance: reconciledStatementBalance,
      reconciledBalance: reconciledStatementBalance,
      reconciliationDifference: diff,
      difference: diff,
      isReconciled: isBalanced,
      isBalanced: isBalanced,
      matchedLinesCount: lines.filter(l => l.matchedStatus === 'matched' || l.isReconciled).length,
      unmatchedLinesCount: lines.filter(l => l.matchedStatus !== 'matched' && !l.isReconciled).length
    };
  }

  const statementLines = statementLinesOrOptions;
  const bookItems = bookItemsArg || [];
  const statementClosingBalance = statementClosingBalanceArg || 0;
  const bookClosingBalance = bookClosingBalanceArg || 0;

  let unpresentedCheques = 0; // Book credits not matched
  let depositsInTransit = 0; // Book debits not matched
  let unrecordedBankDebits = 0; // Statement debits not matched
  let unrecordedBankCredits = 0; // Statement credits not matched
  let matchedCount = 0;
  let unmatchedCount = 0;

  for (const s of statementLines) {
    if (s.matchedStatus === 'matched' || s.isReconciled) {
      matchedCount++;
    } else {
      unmatchedCount++;
      const dr = s.debit || s.withdrawalAmount || 0;
      const cr = s.credit || s.depositAmount || 0;
      if (dr > 0) unrecordedBankDebits = safeAdd(unrecordedBankDebits, dr);
      if (cr > 0) unrecordedBankCredits = safeAdd(unrecordedBankCredits, cr);
    }
  }

  for (const b of bookItems) {
    if (!b.isMatched) {
      if (b.credit > 0) unpresentedCheques = safeAdd(unpresentedCheques, b.credit);
      if (b.debit > 0) depositsInTransit = safeAdd(depositsInTransit, b.debit);
    }
  }

  // Standard Bank Reconciliation Equations:
  // Adjusted Statement Balance = Statement Balance + Deposits in Transit - Outstanding Cheques
  const adjustedStatementBalance = round2(
    statementClosingBalance + depositsInTransit - unpresentedCheques
  );

  // Adjusted Book Balance = Book Balance + Unrecorded Credits - Unrecorded Debits
  const adjustedBookBalance = round2(
    bookClosingBalance + unrecordedBankCredits - unrecordedBankDebits
  );

  const diff = round2(Math.abs(safeSub(adjustedStatementBalance, adjustedBookBalance)));
  const isReconciled = diff <= 0.01;

  return {
    statementClosingBalance,
    bookClosingBalance,
    unpresentedCheques,
    unpresentedChequesAmount: unpresentedCheques,
    depositsInTransit,
    uncreditedDepositsAmount: depositsInTransit,
    unrecordedBankDebits,
    bankChargesNotInBooks: unrecordedBankDebits,
    unrecordedBankCredits,
    interestNotInBooks: unrecordedBankCredits,
    adjustedBookBalance,
    adjustedStatementBalance,
    reconciledBalance: adjustedStatementBalance,
    reconciliationDifference: diff,
    difference: diff,
    isReconciled,
    isBalanced: isReconciled,
    matchedLinesCount: matchedCount,
    unmatchedLinesCount: unmatchedCount
  };
}
