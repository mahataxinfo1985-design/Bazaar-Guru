import { ChequeRecord, ChequeStatus } from '../../types/banking';
import { Account, JournalEntry } from '../../types/accounting';
import { createChequeBounceJournalEntry } from '../accounting/journalEngine';

/**
 * Validates allowable state transitions for cheque lifecycle.
 */
export function canTransitionChequeStatus(
  currentStatus: ChequeStatus,
  targetStatus: ChequeStatus
): boolean {
  if (currentStatus === targetStatus) return true;
  if (currentStatus === 'cleared' || currentStatus === 'cancelled') return false;

  switch (currentStatus) {
    case 'received':
    case 'issued':
      return ['deposited', 'pending_clearance', 'cleared', 'bounced', 'cancelled'].includes(targetStatus);
    case 'deposited':
      return ['pending_clearance', 'cleared', 'bounced', 'cancelled'].includes(targetStatus);
    case 'pending_clearance':
      return ['cleared', 'bounced', 'cancelled'].includes(targetStatus);
    case 'bounced':
      return ['cancelled'].includes(targetStatus);
    default:
      return false;
  }
}

/**
 * Updates a cheque's lifecycle status.
 */
export function transitionChequeStatus(
  cheque: ChequeRecord,
  targetStatus: ChequeStatus,
  metadata?: {
    depositDate?: string;
    clearingDate?: string;
    bounceReason?: string;
    bounceCharges?: number;
    notes?: string;
  }
): ChequeRecord {
  if (!canTransitionChequeStatus(cheque.status, targetStatus)) {
    throw new Error(`Invalid cheque status transition from '${cheque.status}' to '${targetStatus}'.`);
  }

  return {
    ...cheque,
    status: targetStatus,
    depositDate: metadata?.depositDate || cheque.depositDate,
    clearingDate: metadata?.clearingDate || cheque.clearingDate,
    bounceReason: metadata?.bounceReason || cheque.bounceReason,
    bounceCharges: metadata?.bounceCharges !== undefined ? metadata.bounceCharges : cheque.bounceCharges,
    notes: metadata?.notes || cheque.notes,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Handles a bounced cheque by transitioning its state and generating
 * the double-entry reversal and bank bounce charges journal.
 */
export function processChequeBounce(
  cheque: ChequeRecord,
  bounceReason: string,
  bounceCharges: number,
  accounts: Account[]
): { updatedCheque: ChequeRecord; bounceJournal: JournalEntry } {
  const updatedCheque = transitionChequeStatus(cheque, 'bounced', {
    bounceReason,
    bounceCharges
  });

  const bounceJournal = createChequeBounceJournalEntry(updatedCheque, accounts, bounceReason);
  updatedCheque.bounceJournalId = bounceJournal.id;

  return { updatedCheque, bounceJournal };
}
