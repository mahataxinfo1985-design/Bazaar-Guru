import { Party, Invoice } from '../../types';
import { 
  Account, JournalEntry, AccountLedgerStatement, AccountLedgerRow, 
  AccountingOverviewMetrics, AccountingPeriod 
} from '../../types/accounting';
import { round2, safeAdd, safeSub } from '../../utils/decimal';

/**
 * Computes live balances for all accounts based strictly on posted journal lines.
 * Handles normal balance rules:
 * - Assets & Expenses: Normal Debit (Balance = Opening + Debits - Credits)
 * - Liabilities, Equity, Income: Normal Credit (Balance = Opening + Credits - Debits)
 */
export function getComputedAccountBalances(
  accounts: Account[],
  journalEntries: JournalEntry[],
  asOfDate?: string
): Account[] {
  const accountMap = new Map<string, Account>();
  for (const acc of accounts) {
    accountMap.set(acc.id, {
      ...acc,
      currentBalance: acc.openingBalance || 0
    });
  }

  const posted = journalEntries.filter((e) => {
    if (e.status !== 'posted') return false;
    if (asOfDate && e.date > asOfDate) return false;
    return true;
  });

  for (const entry of posted) {
    for (const line of entry.lines) {
      const acc = accountMap.get(line.accountId);
      if (!acc) continue;

      if (acc.type === 'asset' || acc.type === 'expense') {
        acc.currentBalance = safeAdd(acc.currentBalance, line.debit);
        acc.currentBalance = safeSub(acc.currentBalance, line.credit);
      } else {
        acc.currentBalance = safeAdd(acc.currentBalance, line.credit);
        acc.currentBalance = safeSub(acc.currentBalance, line.debit);
      }
    }
  }

  return Array.from(accountMap.values());
}

/**
 * Generates an Account Ledger Statement for any specific account in the Chart of Accounts.
 * Produces chronological transaction lines and running balance.
 */
export function getAccountLedger(
  accountId: string,
  accounts: Account[],
  journalEntries: JournalEntry[],
  startDate?: string,
  endDate?: string
): AccountLedgerStatement | null {
  const account = accounts.find((a) => a.id === accountId);
  if (!account) return null;

  const isDebitNormal = account.type === 'asset' || account.type === 'expense';
  const normalBalance: 'Dr' | 'Cr' = isDebitNormal ? 'Dr' : 'Cr';

  // Filter posted entries affecting this account
  const matchingEntries = journalEntries
    .filter((e) => e.status === 'posted')
    .filter((e) => e.lines.some((l) => l.accountId === accountId))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let preOpeningBalance = account.openingBalance || 0;
  const inRangeEntries: JournalEntry[] = [];

  for (const entry of matchingEntries) {
    if (startDate && entry.date < startDate) {
      // Prior transactions accumulate into opening balance for the selected period
      const line = entry.lines.find((l) => l.accountId === accountId);
      if (line) {
        if (isDebitNormal) {
          preOpeningBalance = safeAdd(preOpeningBalance, line.debit);
          preOpeningBalance = safeSub(preOpeningBalance, line.credit);
        } else {
          preOpeningBalance = safeAdd(preOpeningBalance, line.credit);
          preOpeningBalance = safeSub(preOpeningBalance, line.debit);
        }
      }
    } else if (!endDate || entry.date <= endDate) {
      inRangeEntries.push(entry);
    }
  }

  let runningBalance = preOpeningBalance;
  let totalDebit = 0;
  let totalCredit = 0;

  const rows: AccountLedgerRow[] = [];

  for (const entry of inRangeEntries) {
    const line = entry.lines.find((l) => l.accountId === accountId);
    if (!line) continue;

    totalDebit = safeAdd(totalDebit, line.debit);
    totalCredit = safeAdd(totalCredit, line.credit);

    if (isDebitNormal) {
      runningBalance = safeAdd(runningBalance, line.debit);
      runningBalance = safeSub(runningBalance, line.credit);
    } else {
      runningBalance = safeAdd(runningBalance, line.credit);
      runningBalance = safeSub(runningBalance, line.debit);
    }

    rows.push({
      id: line.id,
      date: entry.date,
      entryNumber: entry.entryNumber,
      sourceType: entry.sourceType,
      narration: line.description || entry.narration,
      partyName: line.partyName,
      debit: line.debit,
      credit: line.credit,
      runningBalance
    });
  }

  return {
    account,
    openingBalance: preOpeningBalance,
    totalDebit,
    totalCredit,
    closingBalance: runningBalance,
    normalBalance,
    rows
  };
}

/**
 * Calculates a Party's true outstanding balance derived strictly from posted double-entry journal lines.
 * For Customer: Sum of Debits to A/R (1200) minus Credits to A/R. (Positive = Customer owes us).
 * For Supplier: Sum of Credits to A/P (2010) minus Debits to A/P. (Positive = We owe supplier).
 */
export function getPartyAccountingBalance(
  partyId: string,
  partyType: 'customer' | 'supplier',
  journalEntries: JournalEntry[],
  accounts: Account[]
): { balance: number; balanceType: 'Dr' | 'Cr' } {
  const targetCode = partyType === 'customer' ? '1200' : '2010';
  const targetAcc = accounts.find((a) => a.code === targetCode);
  if (!targetAcc) return { balance: 0, balanceType: 'Dr' };

  let totalDr = 0;
  let totalCr = 0;

  for (const entry of journalEntries) {
    if (entry.status !== 'posted') continue;
    for (const line of entry.lines) {
      if (line.accountId === targetAcc.id && line.partyId === partyId) {
        totalDr = safeAdd(totalDr, line.debit);
        totalCr = safeAdd(totalCr, line.credit);
      }
    }
  }

  if (partyType === 'customer') {
    const net = safeSub(totalDr, totalCr);
    return {
      balance: Math.abs(net),
      balanceType: net >= 0 ? 'Dr' : 'Cr'
    };
  } else {
    const net = safeSub(totalCr, totalDr);
    return {
      balance: Math.abs(net),
      balanceType: net >= 0 ? 'Cr' : 'Dr'
    };
  }
}

/**
 * Computes high-level accounting metrics for executive dashboards and accounting views.
 * All numbers are derived from posted journals and the Chart of Accounts.
 */
export function getAccountingOverviewMetrics(
  accounts: Account[],
  journalEntries: JournalEntry[]
): AccountingOverviewMetrics {
  const updatedAccounts = getComputedAccountBalances(accounts, journalEntries);

  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquity = 0;
  let totalIncome = 0;
  let totalExpenses = 0;
  let costOfGoodsSold = 0;

  let totalDebits = 0;
  let totalCredits = 0;

  for (const acc of updatedAccounts) {
    const bal = acc.currentBalance;
    switch (acc.type) {
      case 'asset':
        totalAssets = safeAdd(totalAssets, bal);
        totalDebits = safeAdd(totalDebits, bal);
        break;
      case 'liability':
        totalLiabilities = safeAdd(totalLiabilities, bal);
        totalCredits = safeAdd(totalCredits, bal);
        break;
      case 'equity':
        totalEquity = safeAdd(totalEquity, bal);
        totalCredits = safeAdd(totalCredits, bal);
        break;
      case 'income':
        totalIncome = safeAdd(totalIncome, bal);
        totalCredits = safeAdd(totalCredits, bal);
        break;
      case 'expense':
        totalExpenses = safeAdd(totalExpenses, bal);
        totalDebits = safeAdd(totalDebits, bal);
        if (acc.subtype === 'cogs' || acc.subtype === 'purchases') {
          costOfGoodsSold = safeAdd(costOfGoodsSold, bal);
        }
        break;
    }
  }

  const grossProfit = safeSub(totalIncome, costOfGoodsSold);
  const netProfit = safeSub(totalIncome, totalExpenses);

  const arAcc = updatedAccounts.find((a) => a.code === '1200');
  const apAcc = updatedAccounts.find((a) => a.code === '2010');
  const cashAcc = updatedAccounts.find((a) => a.code === '1010');
  const bankAcc = updatedAccounts.find((a) => a.code === '1020');

  const currentReceivables = Math.max(0, arAcc?.currentBalance || 0);
  const currentPayables = Math.max(0, apAcc?.currentBalance || 0);
  const cashAndBankBalance = safeAdd(cashAcc?.currentBalance || 0, bankAcc?.currentBalance || 0);

  const diff = Math.abs(safeSub(totalDebits, totalCredits));
  const isTrialBalanceBalanced = diff <= 0.01;

  return {
    totalAssets,
    totalLiabilities,
    totalEquity,
    totalIncome,
    totalExpenses,
    grossProfit,
    netProfit,
    currentReceivables,
    currentPayables,
    cashAndBankBalance,
    isTrialBalanceBalanced,
    trialBalanceDifference: diff
  };
}
