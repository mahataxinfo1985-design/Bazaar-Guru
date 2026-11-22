import { Invoice, Expense, Party } from '../../types';
import { 
  Account, JournalEntry, JournalLine, PaymentVoucher, 
  ManualJournalInput, AccountingPeriod,
  FundTransfer, ChequeRecord
} from '../../types/accounting';
import { round2, safeAdd, safeSub, isEqualZero } from '../../utils/decimal';
import { findAccountBySubtype, findAccountByCode } from './chartOfAccounts';

/**
 * Validates that a journal entry conforms strictly to double-entry principles:
 * 1. Contains at least two line items.
 * 2. Total Debits strictly equal Total Credits (tolerance <= 0.01).
 * 3. Line amounts are non-negative and single-directional.
 * 4. Referenced accounts are active.
 * 5. Belongs to an open accounting period if a period is provided.
 */
export function validateJournalEntry(
  entry: JournalEntry,
  accounts?: Account[],
  period?: AccountingPeriod
): { valid: boolean; error?: string } {
  if (!entry.lines || entry.lines.length < 2) {
    return { valid: false, error: 'A journal entry must contain at least two line items.' };
  }

  // Accounting Period lock check
  if (period && period.status !== 'open') {
    return { 
      valid: false, 
      error: `Accounting period '${period.name}' is ${period.status}. Postings to locked or closed financial periods are prohibited.` 
    };
  }

  let totalDebit = 0;
  let totalCredit = 0;

  for (const line of entry.lines) {
    if (line.debit < 0 || line.credit < 0) {
      return { valid: false, error: 'Debit and credit amounts cannot be negative.' };
    }
    if (line.debit > 0 && line.credit > 0) {
      return { valid: false, error: 'A line cannot have both debit and credit amounts.' };
    }
    if (line.debit === 0 && line.credit === 0) {
      return { valid: false, error: 'Every journal line must have either a non-zero debit or credit.' };
    }

    // Account active check
    if (accounts) {
      const acc = accounts.find((a) => a.id === line.accountId);
      if (!acc) {
        return { valid: false, error: `Account ID '${line.accountId}' does not exist in chart of accounts.` };
      }
      if (!acc.isActive) {
        return { valid: false, error: `Account '${acc.name}' (${acc.code}) is inactive and cannot receive new postings.` };
      }
    }

    totalDebit = safeAdd(totalDebit, line.debit);
    totalCredit = safeAdd(totalCredit, line.credit);
  }

  const imbalance = Math.abs(safeSub(totalDebit, totalCredit));
  if (imbalance > 0.01) {
    return {
      valid: false,
      error: `Journal entry is out of balance by ₹${imbalance.toFixed(2)} (Debits: ₹${totalDebit.toFixed(2)}, Credits: ₹${totalCredit.toFixed(2)})`
    };
  }

  return { valid: true };
}

/**
 * Creates balanced double-entry journal records for a Sales Invoice.
 * 
 * Accounting Flow:
 * - Debit: Accounts Receivable (or Cash/Bank if direct cash sale)
 * - Credit: Sales Revenue (Taxable Amount)
 * - Credit: Output CGST (if intrastate)
 * - Credit: Output SGST (if intrastate)
 * - Credit: Output IGST (if interstate)
 * - Credit: Output Cess (if any)
 * - Debit/Credit: Round Off Difference (if any)
 * 
 * If immediate payment was received on a credit sale:
 * - Debit: Cash/Bank (amountReceived)
 * - Credit: Accounts Receivable (amountReceived)
 */
export function createSalesInvoiceJournalEntry(
  invoice: Invoice,
  accounts: Account[],
  partyName: string
): JournalEntry {
  const arAcc = findAccountBySubtype(accounts, 'accounts_receivable') || findAccountByCode(accounts, '1200')!;
  const salesAcc = findAccountBySubtype(accounts, 'sales') || findAccountByCode(accounts, '4010')!;
  const cgstAcc = findAccountByCode(accounts, '2210')!;
  const sgstAcc = findAccountByCode(accounts, '2220')!;
  const igstAcc = findAccountByCode(accounts, '2230')!;
  const cessAcc = findAccountByCode(accounts, '2240')!;
  const roundOffAcc = findAccountByCode(accounts, '6080') || findAccountByCode(accounts, '6020')!;
  const cashAcc = invoice.paymentMode !== 'Cash'
    ? (findAccountBySubtype(accounts, 'bank') || findAccountByCode(accounts, '1020')!)
    : (findAccountBySubtype(accounts, 'cash') || findAccountByCode(accounts, '1010')!);

  const isFullCashSale = invoice.amountReceived >= invoice.grandTotal;
  const lines: JournalLine[] = [];
  const entryId = `je_sale_${invoice.id}`;

  // 1. Debit side: Accounts Receivable or Cash/Bank
  if (isFullCashSale) {
    lines.push({
      id: `${entryId}_cash`,
      entryId,
      accountId: cashAcc.id,
      accountCode: cashAcc.code,
      accountName: cashAcc.name,
      partyId: invoice.partyId,
      partyName,
      description: `Cash Sale ${invoice.invoiceNumber} to ${partyName}`,
      debit: invoice.grandTotal,
      credit: 0
    });
  } else {
    lines.push({
      id: `${entryId}_ar`,
      entryId,
      accountId: arAcc.id,
      accountCode: arAcc.code,
      accountName: arAcc.name,
      partyId: invoice.partyId,
      partyName,
      description: `Sales Invoice ${invoice.invoiceNumber} to ${partyName}`,
      debit: invoice.grandTotal,
      credit: 0
    });
  }

  // 2. Credit Sales Revenue
  lines.push({
    id: `${entryId}_rev`,
    entryId,
    accountId: salesAcc.id,
    accountCode: salesAcc.code,
    accountName: salesAcc.name,
    description: `Taxable revenue on ${invoice.invoiceNumber}`,
    debit: 0,
    credit: invoice.taxableAmount
  });

  // 3. Credit Output Taxes
  if (invoice.cgst > 0) {
    lines.push({
      id: `${entryId}_cgst`,
      entryId,
      accountId: cgstAcc.id,
      accountCode: cgstAcc.code,
      accountName: cgstAcc.name,
      description: `CGST Output on ${invoice.invoiceNumber}`,
      debit: 0,
      credit: invoice.cgst
    });
  }

  if (invoice.sgst > 0) {
    lines.push({
      id: `${entryId}_sgst`,
      entryId,
      accountId: sgstAcc.id,
      accountCode: sgstAcc.code,
      accountName: sgstAcc.name,
      description: `SGST Output on ${invoice.invoiceNumber}`,
      debit: 0,
      credit: invoice.sgst
    });
  }

  if (invoice.igst > 0) {
    lines.push({
      id: `${entryId}_igst`,
      entryId,
      accountId: igstAcc.id,
      accountCode: igstAcc.code,
      accountName: igstAcc.name,
      description: `IGST Output on ${invoice.invoiceNumber}`,
      debit: 0,
      credit: invoice.igst
    });
  }

  if (invoice.cess > 0) {
    lines.push({
      id: `${entryId}_cess`,
      entryId,
      accountId: cessAcc.id,
      accountCode: cessAcc.code,
      accountName: cessAcc.name,
      description: `Cess Output on ${invoice.invoiceNumber}`,
      debit: 0,
      credit: invoice.cess
    });
  }

  // 4. Round off difference
  if (!isEqualZero(invoice.roundOff)) {
    if (invoice.roundOff > 0) {
      lines.push({
        id: `${entryId}_ro`,
        entryId,
        accountId: roundOffAcc.id,
        accountCode: roundOffAcc.code,
        accountName: roundOffAcc.name,
        description: `Rounding difference on ${invoice.invoiceNumber}`,
        debit: 0,
        credit: invoice.roundOff
      });
    } else {
      lines.push({
        id: `${entryId}_ro`,
        entryId,
        accountId: roundOffAcc.id,
        accountCode: roundOffAcc.code,
        accountName: roundOffAcc.name,
        description: `Rounding difference on ${invoice.invoiceNumber}`,
        debit: Math.abs(invoice.roundOff),
        credit: 0
      });
    }
  }

  // 5. If partial payment was received on credit invoice
  if (!isFullCashSale && invoice.amountReceived > 0) {
    lines.push({
      id: `${entryId}_pay_rec`,
      entryId,
      accountId: cashAcc.id,
      accountCode: cashAcc.code,
      accountName: cashAcc.name,
      description: `Advance/Immediate payment for ${invoice.invoiceNumber}`,
      debit: invoice.amountReceived,
      credit: 0
    });
    lines.push({
      id: `${entryId}_ar_rec`,
      entryId,
      accountId: arAcc.id,
      accountCode: arAcc.code,
      accountName: arAcc.name,
      partyId: invoice.partyId,
      partyName,
      description: `A/R offset for payment on ${invoice.invoiceNumber}`,
      debit: 0,
      credit: invoice.amountReceived
    });
  }

  const totalDebit = lines.reduce((sum, l) => safeAdd(sum, l.debit), 0);
  const totalCredit = lines.reduce((sum, l) => safeAdd(sum, l.credit), 0);

  const entry: JournalEntry = {
    id: entryId,
    entryNumber: `JE-SL-${invoice.invoiceNumber}`,
    date: invoice.date,
    sourceType: 'sales_invoice',
    sourceId: invoice.id,
    partyId: invoice.partyId,
    narration: `Sales Invoice ${invoice.invoiceNumber} to ${partyName}`,
    totalDebit,
    totalCredit,
    status: 'posted',
    lines,
    createdAt: new Date().toISOString()
  };

  const validation = validateJournalEntry(entry, accounts);
  if (!validation.valid) {
    console.error('Accounting Error in Sales Invoice:', validation.error, entry);
  }

  return entry;
}

/**
 * Creates balanced journal entry for a Sales Return (Credit Note).
 * 
 * Accounting Flow:
 * - Debit: Sales Returns (Taxable Amount)
 * - Debit: Output CGST / SGST / IGST (reversal of tax liability)
 * - Debit: Output Cess (if any)
 * - Credit: Accounts Receivable (or Cash if refunded)
 * - Debit/Credit: Round Off difference
 */
export function createSalesReturnJournalEntry(
  creditNote: Invoice,
  accounts: Account[],
  partyName: string
): JournalEntry {
  const arAcc = findAccountBySubtype(accounts, 'accounts_receivable') || findAccountByCode(accounts, '1200')!;
  const salesReturnAcc = findAccountBySubtype(accounts, 'sales_returns') || findAccountByCode(accounts, '4030')!;
  const cgstAcc = findAccountByCode(accounts, '2210')!;
  const sgstAcc = findAccountByCode(accounts, '2220')!;
  const igstAcc = findAccountByCode(accounts, '2230')!;
  const cessAcc = findAccountByCode(accounts, '2240')!;
  const roundOffAcc = findAccountByCode(accounts, '6080') || findAccountByCode(accounts, '6020')!;

  const lines: JournalLine[] = [];
  const entryId = `je_ret_${creditNote.id}`;

  // 1. Debit Sales Returns (Contra-Revenue)
  lines.push({
    id: `${entryId}_ret`,
    entryId,
    accountId: salesReturnAcc.id,
    accountCode: salesReturnAcc.code,
    accountName: salesReturnAcc.name,
    description: `Sales Return on ${creditNote.invoiceNumber}`,
    debit: creditNote.taxableAmount,
    credit: 0
  });

  // 2. Debit Output Taxes (Reversing tax liability)
  if (creditNote.cgst > 0) {
    lines.push({
      id: `${entryId}_cgst`,
      entryId,
      accountId: cgstAcc.id,
      accountCode: cgstAcc.code,
      accountName: cgstAcc.name,
      description: `CGST reversal on Credit Note ${creditNote.invoiceNumber}`,
      debit: creditNote.cgst,
      credit: 0
    });
  }

  if (creditNote.sgst > 0) {
    lines.push({
      id: `${entryId}_sgst`,
      entryId,
      accountId: sgstAcc.id,
      accountCode: sgstAcc.code,
      accountName: sgstAcc.name,
      description: `SGST reversal on Credit Note ${creditNote.invoiceNumber}`,
      debit: creditNote.sgst,
      credit: 0
    });
  }

  if (creditNote.igst > 0) {
    lines.push({
      id: `${entryId}_igst`,
      entryId,
      accountId: igstAcc.id,
      accountCode: igstAcc.code,
      accountName: igstAcc.name,
      description: `IGST reversal on Credit Note ${creditNote.invoiceNumber}`,
      debit: creditNote.igst,
      credit: 0
    });
  }

  if (creditNote.cess > 0) {
    lines.push({
      id: `${entryId}_cess`,
      entryId,
      accountId: cessAcc.id,
      accountCode: cessAcc.code,
      accountName: cessAcc.name,
      description: `Cess reversal on Credit Note ${creditNote.invoiceNumber}`,
      debit: creditNote.cess,
      credit: 0
    });
  }

  // 3. Round off
  if (!isEqualZero(creditNote.roundOff)) {
    if (creditNote.roundOff > 0) {
      lines.push({
        id: `${entryId}_ro`,
        entryId,
        accountId: roundOffAcc.id,
        accountCode: roundOffAcc.code,
        accountName: roundOffAcc.name,
        description: `Rounding difference on ${creditNote.invoiceNumber}`,
        debit: creditNote.roundOff,
        credit: 0
      });
    } else {
      lines.push({
        id: `${entryId}_ro`,
        entryId,
        accountId: roundOffAcc.id,
        accountCode: roundOffAcc.code,
        accountName: roundOffAcc.name,
        description: `Rounding difference on ${creditNote.invoiceNumber}`,
        debit: 0,
        credit: Math.abs(creditNote.roundOff)
      });
    }
  }

  // 4. Credit Accounts Receivable (reducing customer debt)
  lines.push({
    id: `${entryId}_ar`,
    entryId,
    accountId: arAcc.id,
    accountCode: arAcc.code,
    accountName: arAcc.name,
    partyId: creditNote.partyId,
    partyName,
    description: `Credit Note ${creditNote.invoiceNumber} to ${partyName}`,
    debit: 0,
    credit: creditNote.grandTotal
  });

  const totalDebit = lines.reduce((sum, l) => safeAdd(sum, l.debit), 0);
  const totalCredit = lines.reduce((sum, l) => safeAdd(sum, l.credit), 0);

  const entry: JournalEntry = {
    id: entryId,
    entryNumber: `JE-CN-${creditNote.invoiceNumber}`,
    date: creditNote.date,
    sourceType: 'sales_return',
    sourceId: creditNote.id,
    partyId: creditNote.partyId,
    narration: `Sales Return / Credit Note ${creditNote.invoiceNumber} for ${partyName}`,
    totalDebit,
    totalCredit,
    status: 'posted',
    lines,
    createdAt: new Date().toISOString()
  };

  const validation = validateJournalEntry(entry, accounts);
  if (!validation.valid) {
    console.error('Accounting Error in Sales Return:', validation.error, entry);
  }

  return entry;
}

/**
 * Creates balanced double-entry journal records for a Purchase Invoice (Bill).
 * 
 * Accounting Flow:
 * - Debit: Purchase Expense / Inventory (Taxable Amount)
 * - Debit: Input CGST (if intrastate)
 * - Debit: Input SGST (if intrastate)
 * - Debit: Input IGST (if interstate)
 * - Credit: Accounts Payable (or Cash/Bank if direct cash purchase)
 */
export function createPurchaseInvoiceJournalEntry(
  invoice: Invoice,
  accounts: Account[],
  partyName: string
): JournalEntry {
  const apAcc = findAccountBySubtype(accounts, 'accounts_payable') || findAccountByCode(accounts, '2010')!;
  const purchaseAcc = findAccountBySubtype(accounts, 'purchases') || findAccountByCode(accounts, '5020')!;
  const inputCgstAcc = findAccountByCode(accounts, '1510')!;
  const inputSgstAcc = findAccountByCode(accounts, '1520')!;
  const inputIgstAcc = findAccountByCode(accounts, '1530')!;
  const roundOffAcc = findAccountByCode(accounts, '6080') || findAccountByCode(accounts, '6020')!;
  const cashAcc = invoice.paymentMode !== 'Cash'
    ? (findAccountBySubtype(accounts, 'bank') || findAccountByCode(accounts, '1020')!)
    : (findAccountBySubtype(accounts, 'cash') || findAccountByCode(accounts, '1010')!);

  const isFullCashPurchase = invoice.amountReceived >= invoice.grandTotal;
  const lines: JournalLine[] = [];
  const entryId = `je_pur_${invoice.id}`;

  // 1. Debit Purchase Expense for taxable value
  lines.push({
    id: `${entryId}_1`,
    entryId,
    accountId: purchaseAcc.id,
    accountCode: purchaseAcc.code,
    accountName: purchaseAcc.name,
    description: `Purchase from ${partyName} (Bill: ${invoice.invoiceNumber})`,
    debit: invoice.taxableAmount,
    credit: 0
  });

  // 2. Debit Input Tax Credits (ITC)
  if (invoice.cgst > 0) {
    lines.push({
      id: `${entryId}_cgst`,
      entryId,
      accountId: inputCgstAcc.id,
      accountCode: inputCgstAcc.code,
      accountName: inputCgstAcc.name,
      description: `CGST ITC on Bill ${invoice.invoiceNumber}`,
      debit: invoice.cgst,
      credit: 0
    });
  }

  if (invoice.sgst > 0) {
    lines.push({
      id: `${entryId}_sgst`,
      entryId,
      accountId: inputSgstAcc.id,
      accountCode: inputSgstAcc.code,
      accountName: inputSgstAcc.name,
      description: `SGST ITC on Bill ${invoice.invoiceNumber}`,
      debit: invoice.sgst,
      credit: 0
    });
  }

  if (invoice.igst > 0) {
    lines.push({
      id: `${entryId}_igst`,
      entryId,
      accountId: inputIgstAcc.id,
      accountCode: inputIgstAcc.code,
      accountName: inputIgstAcc.name,
      description: `IGST ITC on Bill ${invoice.invoiceNumber}`,
      debit: invoice.igst,
      credit: 0
    });
  }

  // 3. Round off handling
  if (!isEqualZero(invoice.roundOff)) {
    if (invoice.roundOff > 0) {
      lines.push({
        id: `${entryId}_ro`,
        entryId,
        accountId: roundOffAcc.id,
        accountCode: roundOffAcc.code,
        accountName: roundOffAcc.name,
        description: `Rounding difference on ${invoice.invoiceNumber}`,
        debit: invoice.roundOff,
        credit: 0
      });
    } else {
      lines.push({
        id: `${entryId}_ro`,
        entryId,
        accountId: roundOffAcc.id,
        accountCode: roundOffAcc.code,
        accountName: roundOffAcc.name,
        description: `Rounding difference on ${invoice.invoiceNumber}`,
        debit: 0,
        credit: Math.abs(invoice.roundOff)
      });
    }
  }

  // 4. Credit Accounts Payable or Cash/Bank
  if (isFullCashPurchase) {
    lines.push({
      id: `${entryId}_cash`,
      entryId,
      accountId: cashAcc.id,
      accountCode: cashAcc.code,
      accountName: cashAcc.name,
      partyId: invoice.partyId,
      partyName,
      description: `Cash Purchase ${invoice.invoiceNumber} from ${partyName}`,
      debit: 0,
      credit: invoice.grandTotal
    });
  } else {
    lines.push({
      id: `${entryId}_ap`,
      entryId,
      accountId: apAcc.id,
      accountCode: apAcc.code,
      accountName: apAcc.name,
      partyId: invoice.partyId,
      partyName,
      description: `Accounts Payable for Bill ${invoice.invoiceNumber}`,
      debit: 0,
      credit: invoice.grandTotal
    });
  }

  // 5. If partial payment was made immediately
  if (!isFullCashPurchase && invoice.amountReceived > 0) {
    lines.push({
      id: `${entryId}_pay_out`,
      entryId,
      accountId: apAcc.id,
      accountCode: apAcc.code,
      accountName: apAcc.name,
      partyId: invoice.partyId,
      partyName,
      description: `Immediate payment on Bill ${invoice.invoiceNumber}`,
      debit: invoice.amountReceived,
      credit: 0
    });
    lines.push({
      id: `${entryId}_cash_out`,
      entryId,
      accountId: cashAcc.id,
      accountCode: cashAcc.code,
      accountName: cashAcc.name,
      description: `Cash/Bank payout on Bill ${invoice.invoiceNumber}`,
      debit: 0,
      credit: invoice.amountReceived
    });
  }

  const totalDebit = lines.reduce((sum, l) => safeAdd(sum, l.debit), 0);
  const totalCredit = lines.reduce((sum, l) => safeAdd(sum, l.credit), 0);

  const entry: JournalEntry = {
    id: entryId,
    entryNumber: `JE-PUR-${invoice.invoiceNumber}`,
    date: invoice.date,
    sourceType: 'purchase_invoice',
    sourceId: invoice.id,
    partyId: invoice.partyId,
    narration: `Purchase Invoice from ${partyName} (Bill: ${invoice.invoiceNumber})`,
    totalDebit,
    totalCredit,
    status: 'posted',
    lines,
    createdAt: new Date().toISOString()
  };

  const validation = validateJournalEntry(entry, accounts);
  if (!validation.valid) {
    console.error('Accounting Error in Purchase Invoice:', validation.error, entry);
  }

  return entry;
}

/**
 * Creates balanced journal entry for a Purchase Return (Debit Note).
 * 
 * Accounting Flow:
 * - Debit: Accounts Payable (reducing supplier debt)
 * - Credit: Purchase Returns (Contra-Expense)
 * - Credit: Input CGST / SGST / IGST (ITC reversal)
 */
export function createPurchaseReturnJournalEntry(
  debitNote: Invoice,
  accounts: Account[],
  partyName: string
): JournalEntry {
  const apAcc = findAccountBySubtype(accounts, 'accounts_payable') || findAccountByCode(accounts, '2010')!;
  const purchaseReturnAcc = findAccountBySubtype(accounts, 'purchase_returns') || findAccountByCode(accounts, '5030')!;
  const inputCgstAcc = findAccountByCode(accounts, '1510')!;
  const inputSgstAcc = findAccountByCode(accounts, '1520')!;
  const inputIgstAcc = findAccountByCode(accounts, '1530')!;

  const lines: JournalLine[] = [];
  const entryId = `je_dn_${debitNote.id}`;

  // 1. Debit Accounts Payable
  lines.push({
    id: `${entryId}_ap`,
    entryId,
    accountId: apAcc.id,
    accountCode: apAcc.code,
    accountName: apAcc.name,
    partyId: debitNote.partyId,
    partyName,
    description: `Debit Note ${debitNote.invoiceNumber} to ${partyName}`,
    debit: debitNote.grandTotal,
    credit: 0
  });

  // 2. Credit Purchase Returns
  lines.push({
    id: `${entryId}_ret`,
    entryId,
    accountId: purchaseReturnAcc.id,
    accountCode: purchaseReturnAcc.code,
    accountName: purchaseReturnAcc.name,
    description: `Purchase Return for ${debitNote.invoiceNumber}`,
    debit: 0,
    credit: debitNote.taxableAmount
  });

  // 3. Credit Input Tax (Reversing ITC claimed)
  if (debitNote.cgst > 0) {
    lines.push({
      id: `${entryId}_cgst`,
      entryId,
      accountId: inputCgstAcc.id,
      accountCode: inputCgstAcc.code,
      accountName: inputCgstAcc.name,
      description: `CGST ITC reversal on Debit Note ${debitNote.invoiceNumber}`,
      debit: 0,
      credit: debitNote.cgst
    });
  }

  if (debitNote.sgst > 0) {
    lines.push({
      id: `${entryId}_sgst`,
      entryId,
      accountId: inputSgstAcc.id,
      accountCode: inputSgstAcc.code,
      accountName: inputSgstAcc.name,
      description: `SGST ITC reversal on Debit Note ${debitNote.invoiceNumber}`,
      debit: 0,
      credit: debitNote.sgst
    });
  }

  if (debitNote.igst > 0) {
    lines.push({
      id: `${entryId}_igst`,
      entryId,
      accountId: inputIgstAcc.id,
      accountCode: inputIgstAcc.code,
      accountName: inputIgstAcc.name,
      description: `IGST ITC reversal on Debit Note ${debitNote.invoiceNumber}`,
      debit: 0,
      credit: debitNote.igst
    });
  }

  const totalDebit = lines.reduce((sum, l) => safeAdd(sum, l.debit), 0);
  const totalCredit = lines.reduce((sum, l) => safeAdd(sum, l.credit), 0);

  const entry: JournalEntry = {
    id: entryId,
    entryNumber: `JE-DN-${debitNote.invoiceNumber}`,
    date: debitNote.date,
    sourceType: 'purchase_return',
    sourceId: debitNote.id,
    partyId: debitNote.partyId,
    narration: `Purchase Return / Debit Note ${debitNote.invoiceNumber} to ${partyName}`,
    totalDebit,
    totalCredit,
    status: 'posted',
    lines,
    createdAt: new Date().toISOString()
  };

  const validation = validateJournalEntry(entry, accounts);
  if (!validation.valid) {
    console.error('Accounting Error in Purchase Return:', validation.error, entry);
  }

  return entry;
}

/**
 * Creates balanced journal entry for a Customer Payment Receipt (Payment In).
 * Debit: Cash/Bank
 * Credit: Accounts Receivable
 */
export function createPaymentInJournalEntry(
  voucher: PaymentVoucher,
  accounts: Account[]
): JournalEntry {
  const arAcc = findAccountBySubtype(accounts, 'accounts_receivable') || findAccountByCode(accounts, '1200')!;
  const targetAcc = accounts.find(a => a.id === voucher.accountId) ||
    (voucher.paymentMode === 'Cash' ? findAccountByCode(accounts, '1010')! : findAccountByCode(accounts, '1020')!);

  const entryId = `je_rec_${voucher.id}`;
  const lines: JournalLine[] = [
    {
      id: `${entryId}_1`,
      entryId,
      accountId: targetAcc.id,
      accountCode: targetAcc.code,
      accountName: targetAcc.name,
      description: `Collection from ${voucher.partyName || 'Customer'} via ${voucher.paymentMode}`,
      debit: voucher.amount,
      credit: 0
    },
    {
      id: `${entryId}_2`,
      entryId,
      accountId: arAcc.id,
      accountCode: arAcc.code,
      accountName: arAcc.name,
      partyId: voucher.partyId,
      partyName: voucher.partyName,
      description: `Credit to ${voucher.partyName || 'Customer'} account`,
      debit: 0,
      credit: voucher.amount
    }
  ];

  return {
    id: entryId,
    entryNumber: `JE-REC-${voucher.voucherNumber}`,
    date: voucher.date,
    sourceType: 'payment_in',
    sourceId: voucher.id,
    partyId: voucher.partyId,
    narration: `Payment received from customer ${voucher.partyName || 'Customer'}`,
    totalDebit: voucher.amount,
    totalCredit: voucher.amount,
    status: 'posted',
    lines,
    createdAt: new Date().toISOString()
  };
}

/**
 * Creates COGS Journal Entry for physical stock sold on a sales invoice.
 * Dr Cost of Goods Sold (5010)
 * Cr Inventory / Stock-in-Hand (1400)
 */
export function createCOGSJournalEntry(params: {
  invoiceId: string;
  invoiceNumber: string;
  date: string;
  cogsAmount: number;
  accounts: Account[];
  businessId?: string;
}): JournalEntry | null {
  if (params.cogsAmount <= 0) return null;

  const cogsAcc = findAccountByCode(params.accounts, '5010') || findAccountBySubtype(params.accounts, 'cogs');
  const invAcc = findAccountByCode(params.accounts, '1400') || findAccountBySubtype(params.accounts, 'inventory');

  if (!cogsAcc || !invAcc) return null;

  const entryId = `je_cogs_${params.invoiceId}`;
  const lines: JournalLine[] = [
    {
      id: `${entryId}_dr`,
      entryId,
      accountId: cogsAcc.id,
      accountCode: cogsAcc.code,
      accountName: cogsAcc.name,
      description: `COGS for Invoice ${params.invoiceNumber}`,
      debit: params.cogsAmount,
      credit: 0
    },
    {
      id: `${entryId}_cr`,
      entryId,
      accountId: invAcc.id,
      accountCode: invAcc.code,
      accountName: invAcc.name,
      description: `Inventory reduction for Invoice ${params.invoiceNumber}`,
      debit: 0,
      credit: params.cogsAmount
    }
  ];

  return {
    id: entryId,
    businessId: params.businessId,
    entryNumber: `JE-COGS-${params.invoiceNumber}`,
    date: params.date,
    sourceType: 'cogs',
    sourceId: params.invoiceId,
    narration: `Cost of Goods Sold for Sales Invoice ${params.invoiceNumber}`,
    totalDebit: params.cogsAmount,
    totalCredit: params.cogsAmount,
    status: 'posted',
    isSystemGenerated: true,
    lines,
    createdAt: new Date().toISOString()
  };
}

/**
 * Creates COGS reversal Journal Entry on Sales Return (Credit Note).
 * Dr Inventory / Stock-in-Hand (1400)
 * Cr Cost of Goods Sold (5010)
 */
export function createSalesReturnCOGSJournalEntry(params: {
  creditNoteId: string;
  creditNoteNumber: string;
  date: string;
  returnedCostAmount: number;
  accounts: Account[];
  businessId?: string;
}): JournalEntry | null {
  if (params.returnedCostAmount <= 0) return null;

  const cogsAcc = findAccountByCode(params.accounts, '5010') || findAccountBySubtype(params.accounts, 'cogs');
  const invAcc = findAccountByCode(params.accounts, '1400') || findAccountBySubtype(params.accounts, 'inventory');

  if (!cogsAcc || !invAcc) return null;

  const entryId = `je_cogs_rev_${params.creditNoteId}`;
  const lines: JournalLine[] = [
    {
      id: `${entryId}_dr`,
      entryId,
      accountId: invAcc.id,
      accountCode: invAcc.code,
      accountName: invAcc.name,
      description: `Inventory restored for Return ${params.creditNoteNumber}`,
      debit: params.returnedCostAmount,
      credit: 0
    },
    {
      id: `${entryId}_cr`,
      entryId,
      accountId: cogsAcc.id,
      accountCode: cogsAcc.code,
      accountName: cogsAcc.name,
      description: `COGS reversed for Return ${params.creditNoteNumber}`,
      debit: 0,
      credit: params.returnedCostAmount
    }
  ];

  return {
    id: entryId,
    businessId: params.businessId,
    entryNumber: `JE-COGS-REV-${params.creditNoteNumber}`,
    date: params.date,
    sourceType: 'cogs',
    sourceId: params.creditNoteId,
    narration: `Cost of Goods Sold reversed for Sales Return ${params.creditNoteNumber}`,
    totalDebit: params.returnedCostAmount,
    totalCredit: params.returnedCostAmount,
    status: 'posted',
    isSystemGenerated: true,
    lines,
    createdAt: new Date().toISOString()
  };
}

/**
 * Creates Stock Adjustment Journal Entry.
 * If Net Loss (Shrinkage/Damage/Deficit):
 *   Dr Stock Adjustment Loss / Other Operating Expense (6090)
 *   Cr Inventory (1400)
 * If Net Surplus (Found stock / Correction):
 *   Dr Inventory (1400)
 *   Cr Other Operating Income / Stock Adjustment Gain (4040/6090)
 */
export function createStockAdjustmentJournalEntry(params: {
  adjustmentId: string;
  adjustmentNumber: string;
  date: string;
  lossAmount: number;
  gainAmount: number;
  accounts: Account[];
  businessId?: string;
  narration?: string;
}): JournalEntry | null {
  const invAcc = findAccountByCode(params.accounts, '1400') || findAccountBySubtype(params.accounts, 'inventory');
  const expenseAcc = findAccountByCode(params.accounts, '6090') || findAccountByCode(params.accounts, '5010') || params.accounts.find(a => a.type === 'expense');
  const incomeAcc = findAccountByCode(params.accounts, '4040') || findAccountByCode(params.accounts, '4010') || params.accounts.find(a => a.type === 'income');

  if (!invAcc) return null;

  const entryId = `je_adj_${params.adjustmentId}`;
  const lines: JournalLine[] = [];
  let totalDr = 0;
  let totalCr = 0;

  if (params.lossAmount > 0 && expenseAcc) {
    lines.push({
      id: `${entryId}_loss_dr`,
      entryId,
      accountId: expenseAcc.id,
      accountCode: expenseAcc.code,
      accountName: expenseAcc.name,
      description: `Stock adjustment loss/shrinkage for ${params.adjustmentNumber}`,
      debit: params.lossAmount,
      credit: 0
    });
    lines.push({
      id: `${entryId}_loss_cr`,
      entryId,
      accountId: invAcc.id,
      accountCode: invAcc.code,
      accountName: invAcc.name,
      description: `Inventory written off for ${params.adjustmentNumber}`,
      debit: 0,
      credit: params.lossAmount
    });
    totalDr += params.lossAmount;
    totalCr += params.lossAmount;
  }

  if (params.gainAmount > 0 && incomeAcc) {
    lines.push({
      id: `${entryId}_gain_dr`,
      entryId,
      accountId: invAcc.id,
      accountCode: invAcc.code,
      accountName: invAcc.name,
      description: `Inventory reinstated/surplus for ${params.adjustmentNumber}`,
      debit: params.gainAmount,
      credit: 0
    });
    lines.push({
      id: `${entryId}_gain_cr`,
      entryId,
      accountId: incomeAcc.id,
      accountCode: incomeAcc.code,
      accountName: incomeAcc.name,
      description: `Stock adjustment surplus for ${params.adjustmentNumber}`,
      debit: 0,
      credit: params.gainAmount
    });
    totalDr += params.gainAmount;
    totalCr += params.gainAmount;
  }

  if (lines.length === 0) return null;

  return {
    id: entryId,
    businessId: params.businessId,
    entryNumber: `JE-ADJ-${params.adjustmentNumber}`,
    date: params.date,
    sourceType: 'stock_adjustment',
    sourceId: params.adjustmentId,
    narration: params.narration || `Stock Adjustment ${params.adjustmentNumber}`,
    totalDebit: round2(totalDr),
    totalCredit: round2(totalCr),
    status: 'posted',
    isSystemGenerated: true,
    lines,
    createdAt: new Date().toISOString()
  };
}

/**
 * Creates balanced journal entry for a Supplier Payment Disbursement (Payment Out).
 * Debit: Accounts Payable (or Expense / Loan depending on category)
 * Credit: Cash/Bank
 */
export function createPaymentOutJournalEntry(
  voucher: PaymentVoucher,
  accounts: Account[]
): JournalEntry {
  let debitAccount: Account;
  if (voucher.category === 'expense_payment') {
    debitAccount = findAccountByCode(accounts, '6090') || findAccountByCode(accounts, '6000')!;
  } else if (voucher.category === 'loan_repayment') {
    debitAccount = findAccountByCode(accounts, '2100') || findAccountByCode(accounts, '2000')!;
  } else {
    debitAccount = findAccountBySubtype(accounts, 'accounts_payable') || findAccountByCode(accounts, '2010')!;
  }

  const targetAcc = accounts.find(a => a.id === voucher.accountId) ||
    (voucher.paymentMode === 'Cash' ? findAccountByCode(accounts, '1010')! : findAccountByCode(accounts, '1020')!);

  const entryId = `je_pay_${voucher.id}`;
  const lines: JournalLine[] = [
    {
      id: `${entryId}_1`,
      entryId,
      accountId: debitAccount.id,
      accountCode: debitAccount.code,
      accountName: debitAccount.name,
      partyId: voucher.partyId,
      partyName: voucher.partyName,
      description: `Payment to ${voucher.partyName || 'Supplier'} (${voucher.category || 'supplier_payment'})`,
      debit: voucher.amount,
      credit: 0
    },
    {
      id: `${entryId}_2`,
      entryId,
      accountId: targetAcc.id,
      accountCode: targetAcc.code,
      accountName: targetAcc.name,
      description: `Disbursement to ${voucher.partyName || 'Supplier'} via ${voucher.paymentMode}`,
      debit: 0,
      credit: voucher.amount
    }
  ];

  const entry: JournalEntry = {
    id: entryId,
    entryNumber: `JE-PAY-${voucher.voucherNumber}`,
    date: voucher.date,
    sourceType: 'payment_out',
    sourceId: voucher.id,
    partyId: voucher.partyId,
    narration: voucher.notes || `Payment made to supplier ${voucher.partyName || 'Supplier'}`,
    totalDebit: voucher.amount,
    totalCredit: voucher.amount,
    status: 'posted',
    lines,
    createdAt: new Date().toISOString()
  };

  const validation = validateJournalEntry(entry, accounts);
  if (!validation.valid) {
    throw new Error(`Invalid payment out journal: ${validation.error}`);
  }
  return entry;
}

/**
 * Creates balanced double-entry contra journal entry for an Internal Fund Transfer.
 * Debit: Destination Cash or Bank Account
 * Credit: Source Cash or Bank Account
 */
export function createFundTransferJournalEntry(
  transfer: FundTransfer,
  accounts: Account[],
  sourceAccountNameArg?: string,
  destinationAccountNameArg?: string
): JournalEntry {
  const sourceAcc = accounts.find(a => a.id === transfer.sourceAccountId) ||
    (transfer.sourceAccountType === 'cash' ? findAccountByCode(accounts, '1010')! : findAccountByCode(accounts, '1020')!);
  const destAcc = accounts.find(a => a.id === transfer.destinationAccountId) ||
    (transfer.destinationAccountType === 'cash' ? findAccountByCode(accounts, '1010')! : findAccountByCode(accounts, '1020')!);

  const sourceName = transfer.sourceAccountName || sourceAccountNameArg || sourceAcc.name;
  const destName = transfer.destinationAccountName || destinationAccountNameArg || destAcc.name;

  const entryId = `je_trf_${transfer.id}`;
  const lines: JournalLine[] = [
    {
      id: `${entryId}_dr`,
      entryId,
      accountId: destAcc.id,
      accountCode: destAcc.code,
      accountName: destAcc.name,
      description: `Transfer in from ${sourceName}`,
      debit: transfer.amount,
      credit: 0
    },
    {
      id: `${entryId}_cr`,
      entryId,
      accountId: sourceAcc.id,
      accountCode: sourceAcc.code,
      accountName: sourceAcc.name,
      description: `Transfer out to ${destName}`,
      debit: 0,
      credit: transfer.amount
    }
  ];

  const entry: JournalEntry = {
    id: entryId,
    entryNumber: `JE-TRF-${transfer.transferNumber}`,
    date: transfer.date,
    sourceType: 'fund_transfer',
    sourceId: transfer.id,
    narration: transfer.narration || `Internal fund transfer from ${sourceName} to ${destName}`,
    totalDebit: transfer.amount,
    totalCredit: transfer.amount,
    status: 'posted',
    lines,
    createdAt: new Date().toISOString()
  };

  const validation = validateJournalEntry(entry, accounts);
  if (!validation.valid) {
    throw new Error(`Invalid fund transfer journal: ${validation.error}`);
  }
  return entry;
}

/**
 * Creates balanced journal entry for a Bounced Cheque.
 * Reinstates Accounts Receivable / Accounts Payable and records bank charges.
 */
export function createChequeBounceJournalEntry(
  cheque: ChequeRecord,
  accounts: Account[],
  bankNameOrReason?: string,
  bankChargesArg?: number
): JournalEntry {
  const bankAcc = accounts.find(a => a.code === '1020') || accounts.find(a => a.subtype === 'bank')!;
  const arAcc = findAccountBySubtype(accounts, 'accounts_receivable') || findAccountByCode(accounts, '1200')!;
  const apAcc = findAccountBySubtype(accounts, 'accounts_payable') || findAccountByCode(accounts, '2010')!;
  const bankChargesAcc = findAccountByCode(accounts, '6090') || findAccountByCode(accounts, '6000')!;

  const entryId = `je_bnc_${cheque.id}_${Date.now()}`;
  const lines: JournalLine[] = [];
  const charges = bankChargesArg !== undefined ? bankChargesArg : (cheque.bounceCharges || cheque.bankCharges || 0);
  const chqType = cheque.type || cheque.chequeType || 'received';
  const bounceReason = typeof bankNameOrReason === 'string' && bankChargesArg === undefined ? bankNameOrReason : (cheque.bounceReason || 'Cheque Bounced');
  let totalDebit = 0;
  let totalCredit = 0;

  if (chqType === 'received') {
    // 1. Reinstate Debtors (Debit AR)
    lines.push({
      id: `${entryId}_dr_ar`,
      entryId,
      accountId: arAcc.id,
      accountCode: arAcc.code,
      accountName: arAcc.name,
      partyId: cheque.partyId,
      partyName: cheque.partyName,
      description: `Dishonoured Cheque #${cheque.chequeNumber} reinstatement - ${bounceReason || 'Bounced'}`,
      debit: cheque.amount,
      credit: 0
    });
    totalDebit = safeAdd(totalDebit, cheque.amount);

    // 2. Reduce Bank Balance (Credit Bank)
    lines.push({
      id: `${entryId}_cr_bank`,
      entryId,
      accountId: bankAcc.id,
      accountCode: bankAcc.code,
      accountName: bankAcc.name,
      description: `Dishonoured Cheque #${cheque.chequeNumber} reversal credit`,
      debit: 0,
      credit: cheque.amount
    });
    totalCredit = safeAdd(totalCredit, cheque.amount);

    // 3. Bank Charges if any
    if (charges > 0) {
      lines.push({
        id: `${entryId}_dr_chg`,
        entryId,
        accountId: bankChargesAcc.id,
        accountCode: bankChargesAcc.code,
        accountName: bankChargesAcc.name,
        description: `Bank bounce penalty charges on Cheque #${cheque.chequeNumber}`,
        debit: charges,
        credit: 0
      });
      lines.push({
        id: `${entryId}_cr_chg_bank`,
        entryId,
        accountId: bankAcc.id,
        accountCode: bankAcc.code,
        accountName: bankAcc.name,
        description: `Bank charges deducted for cheque bounce`,
        debit: 0,
        credit: charges
      });
      totalDebit = safeAdd(totalDebit, charges);
      totalCredit = safeAdd(totalCredit, charges);
    }
  } else {
    // Issued Cheque Bounced:
    // 1. Debit Bank (Cash remains in bank)
    lines.push({
      id: `${entryId}_dr_bank`,
      entryId,
      accountId: bankAcc.id,
      accountCode: bankAcc.code,
      accountName: bankAcc.name,
      description: `Issued Cheque #${cheque.chequeNumber} dishonour return`,
      debit: cheque.amount,
      credit: 0
    });
    totalDebit = safeAdd(totalDebit, cheque.amount);

    // 2. Credit AP (Liability reinstated)
    lines.push({
      id: `${entryId}_cr_ap`,
      entryId,
      accountId: apAcc.id,
      accountCode: apAcc.code,
      accountName: apAcc.name,
      partyId: cheque.partyId,
      partyName: cheque.partyName,
      description: `Reinstated supplier liability on Cheque #${cheque.chequeNumber} bounce`,
      debit: 0,
      credit: cheque.amount
    });
    totalCredit = safeAdd(totalCredit, cheque.amount);

    if (charges > 0) {
      lines.push({
        id: `${entryId}_dr_chg`,
        entryId,
        accountId: bankChargesAcc.id,
        accountCode: bankChargesAcc.code,
        accountName: bankChargesAcc.name,
        description: `Bank bounce charges on Cheque #${cheque.chequeNumber}`,
        debit: charges,
        credit: 0
      });
      lines.push({
        id: `${entryId}_cr_chg_bank`,
        entryId,
        accountId: bankAcc.id,
        accountCode: bankAcc.code,
        accountName: bankAcc.name,
        description: `Bank charges deducted`,
        debit: 0,
        credit: charges
      });
      totalDebit = safeAdd(totalDebit, charges);
      totalCredit = safeAdd(totalCredit, charges);
    }
  }

  const entry: JournalEntry = {
    id: entryId,
    entryNumber: `JE-BNC-${cheque.chequeNumber}`,
    date: new Date().toISOString().split('T')[0],
    sourceType: 'cheque_bounce',
    sourceId: cheque.id,
    partyId: cheque.partyId,
    narration: `Cheque #${cheque.chequeNumber} for ${cheque.partyName} bounced: ${bounceReason || 'Dishonoured'}`,
    totalDebit,
    totalCredit,
    status: 'posted',
    lines,
    createdAt: new Date().toISOString()
  };

  const validation = validateJournalEntry(entry, accounts);
  if (!validation.valid) {
    throw new Error(`Invalid cheque bounce journal: ${validation.error}`);
  }
  return entry;
}

/**
 * Maps an expense category to its specific ledger code in the Chart of Accounts.
 */
export function getExpenseAccountCode(category: string): string {
  switch (category.toLowerCase()) {
    case 'rent': return '6010';
    case 'salary': return '6020';
    case 'electricity':
    case 'internet': return '6030';
    case 'travel': return '6040';
    case 'marketing': return '6050';
    case 'office supplies':
    case 'maintenance': return '6060';
    default: return '6090';
  }
}

/**
 * Creates balanced journal entry for an Operating Expense.
 * Debit: Specific Operating Expense
 * Debit: Input Tax Credit (if GST included)
 * Credit: Cash/Bank (if paid) OR Accounts Payable (if unpaid)
 */
export function createExpenseJournalEntry(
  expense: Expense,
  accounts: Account[]
): JournalEntry {
  const code = getExpenseAccountCode(expense.category);
  const expAcc = findAccountByCode(accounts, code) || findAccountByCode(accounts, '6090')!;
  const inputGstAcc = findAccountByCode(accounts, '1510')!;
  
  // If unpaid/credit expense, credit Accounts Payable / Other Current Liabilities
  const isCredit = expense.paymentMode.toLowerCase() === 'credit' || expense.paymentMode.toLowerCase() === 'unpaid';
  const targetAcc = isCredit
    ? (findAccountByCode(accounts, '2300') || findAccountByCode(accounts, '2010')!)
    : (expense.paymentMode === 'Cash'
        ? findAccountByCode(accounts, '1010')!
        : findAccountByCode(accounts, '1020')!);

  const gstAmount = expense.gstAmount || 0;
  const netExpense = safeSub(expense.amount, gstAmount);
  const entryId = `je_exp_${expense.id}`;

  const lines: JournalLine[] = [];

  // Debit Expense Account
  lines.push({
    id: `${entryId}_1`,
    entryId,
    accountId: expAcc.id,
    accountCode: expAcc.code,
    accountName: `${expAcc.name} (${expense.category})`,
    description: `Expense: ${expense.category} - ${expense.vendorName}`,
    debit: netExpense,
    credit: 0
  });

  // Debit GST Input if applicable
  if (gstAmount > 0) {
    lines.push({
      id: `${entryId}_gst`,
      entryId,
      accountId: inputGstAcc.id,
      accountCode: inputGstAcc.code,
      accountName: inputGstAcc.name,
      description: `GST ITC on ${expense.category}`,
      debit: gstAmount,
      credit: 0
    });
  }

  // Credit Cash/Bank/Payable
  lines.push({
    id: `${entryId}_credit`,
    entryId,
    accountId: targetAcc.id,
    accountCode: targetAcc.code,
    accountName: targetAcc.name,
    description: `Disbursement for ${expense.category} via ${expense.paymentMode}`,
    debit: 0,
    credit: expense.amount
  });

  return {
    id: entryId,
    entryNumber: `JE-EXP-${expense.id.slice(-6)}`,
    date: expense.date,
    sourceType: 'expense',
    sourceId: expense.id,
    narration: `Expense: ${expense.category} paid to ${expense.vendorName}`,
    totalDebit: expense.amount,
    totalCredit: expense.amount,
    status: 'posted',
    lines,
    createdAt: new Date().toISOString()
  };
}

/**
 * Creates balanced journal entry for a Manual Journal Voucher.
 */
export function createManualJournalEntry(
  input: ManualJournalInput,
  accounts: Account[],
  entryNumber?: string,
  businessId?: string
): JournalEntry {
  const entryId = `je_man_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const lines: JournalLine[] = input.lines.map((l, idx) => {
    const acc = accounts.find((a) => a.id === l.accountId);
    return {
      id: `${entryId}_${idx}`,
      entryId,
      accountId: l.accountId,
      accountCode: acc?.code,
      accountName: acc?.name,
      partyId: l.partyId,
      partyName: l.partyName,
      description: l.description || input.narration,
      debit: round2(l.debit || 0),
      credit: round2(l.credit || 0)
    };
  });

  const totalDebit = lines.reduce((sum, l) => safeAdd(sum, l.debit), 0);
  const totalCredit = lines.reduce((sum, l) => safeAdd(sum, l.credit), 0);

  const entry: JournalEntry = {
    id: entryId,
    businessId,
    entryNumber: entryNumber || `JV-${Date.now().toString().slice(-6)}`,
    date: input.date,
    sourceType: 'journal_voucher',
    sourceId: entryId,
    narration: input.narration,
    totalDebit,
    totalCredit,
    status: 'posted',
    lines,
    createdAt: new Date().toISOString()
  };

  const validation = validateJournalEntry(entry, accounts);
  if (!validation.valid) {
    throw new Error(validation.error || 'Manual journal voucher is invalid.');
  }

  return entry;
}

/**
 * Creates balanced journal entry for Party Opening Balances.
 * Customer: Debit Accounts Receivable (1200), Credit Owner's Capital / Retained Earnings (3010/3030)
 * Supplier: Debit Owner's Capital (3010), Credit Accounts Payable (2010)
 */
export function createPartyOpeningBalanceJournalEntry(
  party: Party,
  accounts: Account[],
  date: string = '2026-04-01'
): JournalEntry | null {
  const opBal = party.openingBalance || 0;
  if (opBal <= 0) return null;

  const isCustomer = party.type === 'customer';
  const isDr = party.openingBalanceType ? party.openingBalanceType === 'debit' : isCustomer;

  const arAcc = findAccountByCode(accounts, '1200')!;
  const apAcc = findAccountByCode(accounts, '2010')!;
  const equityAcc = findAccountByCode(accounts, '3010') || findAccountByCode(accounts, '3030')!;

  const entryId = `je_opb_${party.id}`;
  const lines: JournalLine[] = [];

  if (isDr) {
    // Debit Party (A/R) and Credit Equity
    lines.push({
      id: `${entryId}_dr`,
      entryId,
      accountId: arAcc.id,
      accountCode: arAcc.code,
      accountName: arAcc.name,
      partyId: party.id,
      partyName: party.name,
      description: `Opening balance for ${party.name}`,
      debit: opBal,
      credit: 0
    });
    lines.push({
      id: `${entryId}_cr`,
      entryId,
      accountId: equityAcc.id,
      accountCode: equityAcc.code,
      accountName: equityAcc.name,
      description: `Opening equity offset for ${party.name}`,
      debit: 0,
      credit: opBal
    });
  } else {
    // Debit Equity and Credit Party (A/P)
    lines.push({
      id: `${entryId}_dr`,
      entryId,
      accountId: equityAcc.id,
      accountCode: equityAcc.code,
      accountName: equityAcc.name,
      description: `Opening equity offset for ${party.name}`,
      debit: opBal,
      credit: 0
    });
    lines.push({
      id: `${entryId}_cr`,
      entryId,
      accountId: apAcc.id,
      accountCode: apAcc.code,
      accountName: apAcc.name,
      partyId: party.id,
      partyName: party.name,
      description: `Opening balance for ${party.name}`,
      debit: 0,
      credit: opBal
    });
  }

  return {
    id: entryId,
    entryNumber: `OPB-${party.id.slice(-6)}`,
    date,
    sourceType: 'opening_balance',
    sourceId: party.id,
    partyId: party.id,
    narration: `Opening balance recorded for ${party.name}`,
    totalDebit: opBal,
    totalCredit: opBal,
    status: 'posted',
    lines,
    createdAt: new Date().toISOString()
  };
}

/**
 * Reverses a previously posted journal entry (for cancellations or returns)
 * Swaps all debits and credits with explicit cancellation narration.
 */
export function createReversalJournalEntry(
  originalEntry: JournalEntry,
  reason: string
): JournalEntry {
  const reversalId = `je_rev_${originalEntry.id}_${Date.now()}`;
  const lines: JournalLine[] = originalEntry.lines.map((line, idx) => ({
    id: `${reversalId}_${idx}`,
    entryId: reversalId,
    accountId: line.accountId,
    accountCode: line.accountCode,
    accountName: line.accountName,
    partyId: line.partyId,
    partyName: line.partyName,
    description: `[REVERSAL] ${line.description}`,
    debit: line.credit, // Swap credit to debit
    credit: line.debit  // Swap debit to credit
  }));

  return {
    id: reversalId,
    entryNumber: `REV-${originalEntry.entryNumber}`,
    date: new Date().toISOString().split('T')[0],
    sourceType: originalEntry.sourceType,
    sourceId: originalEntry.sourceId,
    partyId: originalEntry.partyId,
    reversalOf: originalEntry.id,
    narration: `Reversal of ${originalEntry.entryNumber}. Reason: ${reason}`,
    totalDebit: originalEntry.totalCredit,
    totalCredit: originalEntry.totalDebit,
    status: 'posted',
    lines,
    createdAt: new Date().toISOString()
  };
}

