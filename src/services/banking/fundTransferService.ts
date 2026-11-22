import { FundTransfer, BankAccount, CashAccount } from '../../types/banking';
import { Account, JournalEntry } from '../../types/accounting';
import { round2, safeSub } from '../../utils/decimal';
import { createFundTransferJournalEntry, createReversalJournalEntry } from '../accounting/journalEngine';

export interface ValidateTransferParams {
  sourceAccountId: string;
  sourceAccountType: 'bank' | 'cash';
  destinationAccountId: string;
  destinationAccountType: 'bank' | 'cash';
  amount: number;
  date?: string;
  bankAccounts?: BankAccount[];
  cashAccounts?: CashAccount[];
  sourceAccount?: BankAccount | CashAccount;
}

/**
 * Validates whether an internal fund transfer is valid before recording.
 */
export function validateFundTransfer(
  params: ValidateTransferParams
): { valid: boolean; error?: string } {
  if (!params.sourceAccountId || !params.destinationAccountId) {
    return { valid: false, error: 'Both source and destination accounts must be selected.' };
  }

  if (params.sourceAccountId === params.destinationAccountId) {
    return { valid: false, error: 'Source and destination accounts cannot be the same.' };
  }

  if (params.amount <= 0) {
    return { valid: false, error: 'Transfer amount must be greater than zero.' };
  }

  // If sourceAccount is passed directly
  if (params.sourceAccount) {
    const acc = params.sourceAccount;
    const isOverdraft = (acc as any).accountType === 'overdraft' || (acc as any).accountType === 'cash_credit';
    const limit = (acc as any).overdraftLimit || 0;
    const maxAvailable = isOverdraft ? acc.currentBalance + limit : acc.currentBalance;

    if (maxAvailable < params.amount) {
      return {
        valid: false,
        error: `Insufficient funds in ${(acc as any).accountName || (acc as any).bankName || (acc as any).name || 'account'}. Available: ₹${maxAvailable.toFixed(2)}, Requested: ₹${params.amount.toFixed(2)}`
      };
    }
    return { valid: true };
  }

  // Check source account balance limits via lists
  if (params.sourceAccountType === 'cash') {
    const cashAcc = params.cashAccounts?.find((c) => c.id === params.sourceAccountId);
    if (cashAcc && cashAcc.currentBalance < params.amount) {
      return { 
        valid: false, 
        error: `Insufficient cash in ${cashAcc.accountName || cashAcc.name}. Available: ₹${cashAcc.currentBalance.toFixed(2)}, Requested: ₹${params.amount.toFixed(2)}` 
      };
    }
  } else {
    const bankAcc = params.bankAccounts?.find((b) => b.id === params.sourceAccountId);
    const isCreditFacility = bankAcc?.accountType === 'overdraft' || bankAcc?.accountType === 'cash_credit';
    const limit = bankAcc?.overdraftLimit || 0;
    const maxAvailable = isCreditFacility ? (bankAcc?.currentBalance || 0) + limit : (bankAcc?.currentBalance || 0);

    if (bankAcc && maxAvailable < params.amount) {
      return {
        valid: false,
        error: `Insufficient funds in ${bankAcc.accountName || bankAcc.bankName}. Available: ₹${maxAvailable.toFixed(2)}, Requested: ₹${params.amount.toFixed(2)}`
      };
    }
  }

  return { valid: true };
}

/**
 * Creates an internal fund transfer voucher and its balanced contra journal entry.
 */
export function executeFundTransfer(
  params: {
    sourceAccountId: string;
    sourceAccountType: 'bank' | 'cash';
    sourceAccountName: string;
    destinationAccountId: string;
    destinationAccountType: 'bank' | 'cash';
    destinationAccountName: string;
    amount: number;
    date: string;
    referenceNumber?: string;
    narration?: string;
    attachmentUrl?: string;
    businessId?: string;
    createdBy?: string;
  },
  accounts: Account[]
): { transfer: FundTransfer; journal: JournalEntry } {
  const transferId = `trf_${Date.now()}`;
  const transferNumber = `TRF-${Date.now().toString().slice(-6)}`;

  const transfer: FundTransfer = {
    id: transferId,
    businessId: params.businessId,
    transferNumber,
    date: params.date,
    sourceAccountId: params.sourceAccountId,
    sourceAccountType: params.sourceAccountType,
    sourceAccountName: params.sourceAccountName,
    destinationAccountId: params.destinationAccountId,
    destinationAccountType: params.destinationAccountType,
    destinationAccountName: params.destinationAccountName,
    amount: round2(params.amount),
    referenceNumber: params.referenceNumber?.trim() || undefined,
    narration: params.narration?.trim() || undefined,
    attachmentUrl: params.attachmentUrl,
    status: 'completed',
    createdBy: params.createdBy,
    createdAt: new Date().toISOString()
  };

  const journal = createFundTransferJournalEntry(transfer, accounts);

  return { transfer, journal };
}

/**
 * Cancels a posted fund transfer by producing a complete double-entry reversal journal.
 */
export function cancelFundTransfer(
  transfer: FundTransfer,
  reason: string,
  originalJournal?: JournalEntry
): { updatedTransfer: FundTransfer; reversalJournal?: JournalEntry } {
  const updatedTransfer: FundTransfer = {
    ...transfer,
    status: 'cancelled',
    cancelledReason: reason
  };

  const reversalJournal = originalJournal 
    ? createReversalJournalEntry(originalJournal, reason)
    : undefined;

  return { updatedTransfer, reversalJournal };
}
