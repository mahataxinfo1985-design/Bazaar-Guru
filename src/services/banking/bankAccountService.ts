import { BankAccount, CashAccount } from '../../types/banking';
import { JournalEntry, Account } from '../../types/accounting';
import { safeAdd, safeSub } from '../../utils/decimal';

/**
 * Masks a bank account number for UI security.
 * Displays only the last 4 digits (e.g. "•••• •••• 1234").
 */
export function maskAccountNumber(accNumber: string): string {
  if (!accNumber) return '••••';
  const clean = accNumber.trim();
  if (clean.length <= 4) return `•••• ${clean}`;
  const last4 = clean.slice(-4);
  return `•••• •••• •••• ${last4}`;
}

export const DEFAULT_BANK_ACCOUNTS: BankAccount[] = [];

export const DEFAULT_CASH_ACCOUNTS: CashAccount[] = [
  {
    id: 'cash_default_1',
    businessId: 'default',
    accountName: 'Main Cash Register',
    name: 'Main Cash Register',
    accountType: 'main_cash',
    openingBalance: 0,
    currentBalance: 0,
    linkedAccountId: 'acc_1010',
    isDefault: true,
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'cash_default_2',
    businessId: 'default',
    accountName: 'Petty Cash Box',
    name: 'Petty Cash Box',
    accountType: 'petty_cash',
    openingBalance: 0,
    currentBalance: 0,
    linkedAccountId: 'acc_1010',
    isDefault: false,
    isActive: true,
    createdAt: new Date().toISOString()
  }
];

/**
 * Computes live balance of a bank account from posted journal entries.
 */
export function calculateBankAccountBalance(
  bankAccount: BankAccount,
  journalEntries: JournalEntry[]
): number {
  let bal = bankAccount.openingBalance || 0;
  const targetId = bankAccount.linkedAccountId || 'acc_1020';

  for (const entry of journalEntries) {
    if (entry.status !== 'posted') continue;
    for (const line of entry.lines) {
      if (line.accountId === targetId || line.accountId === bankAccount.id) {
        bal = safeAdd(bal, line.debit);
        bal = safeSub(bal, line.credit);
      }
    }
  }

  return bal;
}

/**
 * Computes live balance of a cash account from posted journal entries.
 */
export function calculateCashAccountBalance(
  cashAccount: CashAccount,
  journalEntries: JournalEntry[]
): number {
  let bal = cashAccount.openingBalance || 0;
  const targetId = cashAccount.linkedAccountId || 'acc_1010';

  for (const entry of journalEntries) {
    if (entry.status !== 'posted') continue;
    for (const line of entry.lines) {
      if (line.accountId === targetId || line.accountId === cashAccount.id) {
        bal = safeAdd(bal, line.debit);
        bal = safeSub(bal, line.credit);
      }
    }
  }

  return bal;
}

/**
 * Checks whether a bank account can be deleted or must be deactivated instead.
 * Prohibits deletion if any journal entry or transaction references this account.
 */
export function canDeleteBankAccount(
  bankAccountId: string,
  journalEntries: JournalEntry[]
): { allowed: boolean; reason?: string } {
  const isUsed = journalEntries.some((e) =>
    e.lines.some((l) => l.accountId === bankAccountId)
  );

  if (isUsed) {
    return {
      allowed: false,
      reason: 'This bank account has historical financial transactions and cannot be deleted. You may deactivate it instead.'
    };
  }

  return { allowed: true };
}
