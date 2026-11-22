import { EnhancedParty, GSTRegistrationType, PartyRole } from '../../types/workspace';
import { Party } from '../../types';
import { buildPartyLedger } from '../accounting/partyLedger';
import { idbGetAll } from '../storage/idb';

export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
export const PIN_CODE_REGEX = /^[1-9][0-9]{5}$/;
export const PHONE_REGEX = /^[6-9]\d{9}$/;

export interface PartyValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates GSTIN format and structure.
 */
export function validateGSTIN(gstin: string): boolean {
  if (!gstin) return false;
  return GSTIN_REGEX.test(gstin.trim().toUpperCase());
}

/**
 * Extracts PAN from GSTIN (characters 3-12).
 */
export function extractPANFromGSTIN(gstin: string): string | null {
  if (!validateGSTIN(gstin)) return null;
  return gstin.trim().toUpperCase().substring(2, 12);
}

/**
 * Validates Permanent Account Number (PAN).
 */
export function validatePAN(pan: string): boolean {
  if (!pan) return false;
  return PAN_REGEX.test(pan.trim().toUpperCase());
}

/**
 * Validates Indian PIN code (6 digits).
 */
export function validatePinCode(pin: string): boolean {
  if (!pin) return false;
  return PIN_CODE_REGEX.test(pin.trim());
}

/**
 * Validates Party entity including mandatory fields, tax compliance, and credit policies.
 */
export function validateParty(party: Partial<EnhancedParty | Party>): PartyValidationResult {
  const errors: string[] = [];

  const name = party.name || (party as any).displayName || (party as any).legalName;
  if (!name || name.trim() === '') {
    errors.push('Party name is required.');
  }

  if (!party.phone || party.phone.trim() === '') {
    errors.push('Contact phone number is required.');
  }

  if (party.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(party.email)) {
    errors.push('Invalid email address format.');
  }

  const p = party as any;
  if (p.registrationType && p.registrationType !== 'unregistered' && p.registrationType !== 'consumer') {
    if (!party.gstin || !validateGSTIN(party.gstin)) {
      errors.push(`A valid 15-character GSTIN is required for ${p.registrationType} taxpayers.`);
    }
  } else if (party.gstin && party.gstin.trim() !== '') {
    if (!validateGSTIN(party.gstin)) {
      errors.push('Invalid GSTIN format (e.g., 27AAAAA0000A1Z5).');
    }
  }

  if (p.pan && p.pan.trim() !== '') {
    if (!validatePAN(p.pan)) {
      errors.push('Invalid PAN format (e.g., ABCDE1234F).');
    }
  }

  if (p.pinCode && p.pinCode.trim() !== '') {
    if (!validatePinCode(p.pinCode)) {
      errors.push('PIN code must be a valid 6-digit Indian postal code.');
    }
  }

  if (p.creditLimit !== undefined && p.creditLimit < 0) {
    errors.push('Credit limit cannot be negative.');
  }

  if (p.creditPeriodDays !== undefined && p.creditPeriodDays < 0) {
    errors.push('Credit period days cannot be negative.');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Checks for duplicate parties by GSTIN, PAN, or Phone number.
 */
export function checkPartyDuplicates(
  party: Partial<EnhancedParty | Party>,
  existingParties: (EnhancedParty | Party)[]
): { hasDuplicates: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const currentId = party.id;

  const currentGstin = party.gstin ? party.gstin.trim().toUpperCase() : null;
  const currentPan = (party as any).pan ? (party as any).pan.trim().toUpperCase() : null;
  const currentPhone = party.phone ? party.phone.trim() : null;

  for (const existing of existingParties) {
    if (existing.id === currentId) continue;

    if (currentGstin && existing.gstin && existing.gstin.trim().toUpperCase() === currentGstin) {
      reasons.push(`A party with GSTIN ${currentGstin} already exists (${existing.name}).`);
    }

    if (currentPan && (existing as any).pan && (existing as any).pan.trim().toUpperCase() === currentPan) {
      reasons.push(`A party with PAN ${currentPan} already exists (${existing.name}).`);
    }

    if (currentPhone && existing.phone && existing.phone.trim() === currentPhone) {
      reasons.push(`A party with phone number ${currentPhone} already exists (${existing.name}).`);
    }
  }

  return {
    hasDuplicates: reasons.length > 0,
    reasons
  };
}

/**
 * Derives real-time party balance strictly from the double-entry accounting ledger.
 * This guarantees single source of truth without independent or divergent balance counters.
 */
export async function getAuthoritativePartyBalance(
  partyId: string,
  partyType: 'customer' | 'supplier'
): Promise<{ currentBalance: number; balanceType: 'debit' | 'credit'; totalDebit: number; totalCredit: number }> {
  const [parties, invoices, vouchers, journals] = await Promise.all([
    idbGetAll('parties'),
    idbGetAll('invoices'),
    idbGetAll('payment_vouchers'),
    idbGetAll('journal_entries')
  ]);
  const party = parties.find(p => p.id === partyId);
  if (!party) {
    return { currentBalance: 0, balanceType: 'debit', totalDebit: 0, totalCredit: 0 };
  }
  const ledger = buildPartyLedger(party, invoices, vouchers, journals);
  const closingBalance = ledger.closingBalance;
  
  return {
    currentBalance: Math.abs(closingBalance),
    balanceType: ledger.closingBalanceType === 'Dr' ? 'debit' : 'credit',
    totalDebit: ledger.totalInvoiced,
    totalCredit: ledger.totalPaid
  };
}

/**
 * Verifies if a proposed transaction amount exceeds the customer's credit limit.
 */
export async function verifyCreditLimit(
  party: EnhancedParty | Party,
  proposedAmount: number
): Promise<{ allowed: boolean; availableCredit: number; creditLimit: number; currentBalance: number; reason?: string }> {
  const creditLimit = (party as any).creditLimit || 0;
  if (creditLimit <= 0) {
    // 0 means no credit limit restriction
    return {
      allowed: true,
      availableCredit: Infinity,
      creditLimit: 0,
      currentBalance: party.currentBalance || party.outstandingBalance || 0
    };
  }

  const { currentBalance } = await getAuthoritativePartyBalance(party.id, 'customer');
  const availableCredit = creditLimit - currentBalance;

  if (proposedAmount > availableCredit) {
    return {
      allowed: false,
      availableCredit,
      creditLimit,
      currentBalance,
      reason: `Transaction amount ₹${proposedAmount.toFixed(2)} exceeds available credit limit of ₹${Math.max(0, availableCredit).toFixed(2)} (Limit: ₹${creditLimit}, Current Outstanding: ₹${currentBalance.toFixed(2)}).`
    };
  }

  return {
    allowed: true,
    availableCredit,
    creditLimit,
    currentBalance
  };
}
