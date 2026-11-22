import { Party, Invoice } from '../../types';
import { PartyLedgerEntry, PaymentVoucher, PaymentAllocation, JournalEntry } from '../../types/accounting';
import { round2, safeAdd, safeSub } from '../../utils/decimal';

/**
 * Builds a chronological party ledger statement with running balances.
 * Supports date filtering with automatic pre-period opening balance calculation.
 * 
 * Rules for Customer:
 * - Opening balance (Debit = customer owes us, Credit = customer has advance/overpaid)
 * - Sales Invoice: Debit (increases receivable amount)
 * - Payment Received / Advance: Credit (reduces receivable amount)
 * - Sales Return / Credit Note: Credit (reduces receivable amount)
 * 
 * Rules for Supplier:
 * - Opening balance (Credit = we owe supplier, Debit = we have paid advance)
 * - Purchase Bill: Credit (increases payable amount)
 * - Payment Made: Debit (reduces payable amount)
 * - Purchase Return / Debit Note: Debit (reduces payable amount)
 */
export function buildPartyLedger(
  party: Party,
  invoices: Invoice[],
  vouchers: PaymentVoucher[],
  journalEntries?: JournalEntry[],
  startDate?: string,
  endDate?: string
): {
  entries: PartyLedgerEntry[];
  openingBalance: number;
  openingBalanceType: 'Dr' | 'Cr';
  totalInvoiced: number;
  totalPaid: number;
  closingBalance: number;
  closingBalanceType: 'Dr' | 'Cr';
} {
  const isCustomer = party.type === 'customer';
  const rawEvents: Array<{
    date: string;
    type: 'Invoice' | 'Payment' | 'Return' | 'Opening Balance' | 'Debit Note' | 'Credit Note' | 'Journal';
    ref: string;
    narration: string;
    debit: number;
    credit: number;
  }> = [];

  // 1. Initial Master Opening Balance
  const opBal = party.openingBalance || 0;
  if (opBal > 0) {
    const isDr = party.openingBalanceType ? party.openingBalanceType === 'debit' : isCustomer;
    rawEvents.push({
      date: party.state ? '2024-04-01' : '2024-04-01',
      type: 'Opening Balance',
      ref: 'OP-BAL',
      narration: `Opening balance brought forward`,
      debit: isDr ? opBal : 0,
      credit: isDr ? 0 : opBal
    });
  }

  // 2. Party Invoices
  const partyInvoices = invoices.filter(
    (inv) => inv.partyId === party.id && !inv.deleted && inv.status !== 'Cancelled'
  );

  for (const inv of partyInvoices) {
    const isSales = !inv.type.includes('Purchase') && inv.type !== 'Purchase Return';
    if (isSales) {
      if (inv.type === 'Credit Note') {
        rawEvents.push({
          date: inv.date,
          type: 'Credit Note',
          ref: inv.invoiceNumber,
          narration: `Credit Note / Return: ${inv.invoiceNumber}`,
          debit: 0,
          credit: inv.grandTotal
        });
      } else {
        rawEvents.push({
          date: inv.date,
          type: 'Invoice',
          ref: inv.invoiceNumber,
          narration: `${inv.type}: ${inv.invoiceNumber}`,
          debit: inv.grandTotal,
          credit: 0
        });
        if (inv.amountReceived > 0) {
          rawEvents.push({
            date: inv.date,
            type: 'Payment',
            ref: `REC-${inv.invoiceNumber}`,
            narration: `Payment received at invoice generation (${inv.paymentMode})`,
            debit: 0,
            credit: inv.amountReceived
          });
        }
      }
    } else {
      if (inv.type === 'Purchase Return' || inv.type === 'Debit Note') {
        rawEvents.push({
          date: inv.date,
          type: 'Debit Note',
          ref: inv.invoiceNumber,
          narration: `Purchase Return / Debit Note: ${inv.invoiceNumber}`,
          debit: inv.grandTotal,
          credit: 0
        });
      } else {
        rawEvents.push({
          date: inv.date,
          type: 'Invoice',
          ref: inv.invoiceNumber,
          narration: `Purchase Bill: ${inv.invoiceNumber}`,
          debit: 0,
          credit: inv.grandTotal
        });
        if (inv.amountReceived > 0) {
          rawEvents.push({
            date: inv.date,
            type: 'Payment',
            ref: `PAY-${inv.invoiceNumber}`,
            narration: `Payment disbursed at bill entry (${inv.paymentMode})`,
            debit: inv.amountReceived,
            credit: 0
          });
        }
      }
    }
  }

  // 3. Standalone Payment Vouchers
  const partyVouchers = vouchers.filter(
    (v) => v.partyId === party.id && v.status === 'completed'
  );

  for (const v of partyVouchers) {
    if (v.type === 'payment_in') {
      rawEvents.push({
        date: v.date,
        type: 'Payment',
        ref: v.voucherNumber,
        narration: `Payment Received via ${v.paymentMode}${v.referenceNumber ? ` (Ref: ${v.referenceNumber})` : ''}`,
        debit: 0,
        credit: v.amount
      });
    } else {
      rawEvents.push({
        date: v.date,
        type: 'Payment',
        ref: v.voucherNumber,
        narration: `Payment Disbursed via ${v.paymentMode}${v.referenceNumber ? ` (Ref: ${v.referenceNumber})` : ''}`,
        debit: v.amount,
        credit: 0
      });
    }
  }

  // 4. Manual Journal Vouchers targeting this party
  if (journalEntries) {
    const manualJournals = journalEntries.filter(
      (j) => j.status === 'posted' && j.sourceType === 'journal_voucher' && j.lines.some((l) => l.partyId === party.id)
    );

    for (const j of manualJournals) {
      for (const line of j.lines) {
        if (line.partyId === party.id) {
          rawEvents.push({
            date: j.date,
            type: 'Journal',
            ref: j.entryNumber,
            narration: line.description || j.narration,
            debit: line.debit,
            credit: line.credit
          });
        }
      }
    }
  }

  // Sort chronologically by date
  rawEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Split events before startDate into opening balance
  let preRunningBal = 0;
  const inRangeEvents: typeof rawEvents = [];

  for (const evt of rawEvents) {
    if (startDate && evt.date < startDate) {
      if (isCustomer) {
        preRunningBal = safeAdd(preRunningBal, evt.debit);
        preRunningBal = safeSub(preRunningBal, evt.credit);
      } else {
        preRunningBal = safeAdd(preRunningBal, evt.credit);
        preRunningBal = safeSub(preRunningBal, evt.debit);
      }
    } else if (!endDate || evt.date <= endDate) {
      inRangeEvents.push(evt);
    }
  }

  let runningBal = preRunningBal;
  let totalInvoiced = 0;
  let totalPaid = 0;

  const entries: PartyLedgerEntry[] = inRangeEvents.map((evt, idx) => {
    if (isCustomer) {
      runningBal = safeAdd(runningBal, evt.debit);
      runningBal = safeSub(runningBal, evt.credit);
      if (evt.type === 'Invoice') totalInvoiced = safeAdd(totalInvoiced, evt.debit);
      if (evt.type === 'Payment') totalPaid = safeAdd(totalPaid, evt.credit);
    } else {
      runningBal = safeAdd(runningBal, evt.credit);
      runningBal = safeSub(runningBal, evt.debit);
      if (evt.type === 'Invoice') totalInvoiced = safeAdd(totalInvoiced, evt.credit);
      if (evt.type === 'Payment') totalPaid = safeAdd(totalPaid, evt.debit);
    }

    const isDr = isCustomer ? runningBal >= 0 : runningBal < 0;

    return {
      id: `ple_${party.id}_${idx}`,
      date: evt.date,
      type: evt.type,
      referenceNumber: evt.ref,
      narration: evt.narration,
      debit: evt.debit,
      credit: evt.credit,
      runningBalance: Math.abs(runningBal),
      balanceType: isDr ? 'Dr' : 'Cr'
    };
  });

  const finalClosing = round2(runningBal);
  const closingType = isCustomer
    ? (finalClosing >= 0 ? 'Dr' : 'Cr')
    : (finalClosing >= 0 ? 'Cr' : 'Dr');

  const preClosingType = isCustomer
    ? (preRunningBal >= 0 ? 'Dr' : 'Cr')
    : (preRunningBal >= 0 ? 'Cr' : 'Dr');

  return {
    entries,
    openingBalance: Math.abs(preRunningBal),
    openingBalanceType: preClosingType,
    totalInvoiced,
    totalPaid,
    closingBalance: Math.abs(finalClosing),
    closingBalanceType: closingType
  };
}

/**
 * Distributes a payment amount across multiple unpaid invoices using FIFO or priority order.
 * Handles full payments, partial payments, and identifies unallocated advance balance.
 */
export function allocatePaymentAcrossInvoices(
  voucherId: string,
  totalAmount: number,
  unpaidInvoices: Invoice[]
): {
  allocations: PaymentAllocation[];
  unallocatedAmount: number;
  updatedInvoices: Array<{ id: string; balanceDue: number; paymentStatus: 'Paid' | 'Partial' | 'Unpaid' }>;
} {
  let remaining = totalAmount;
  const allocations: PaymentAllocation[] = [];
  const updatedInvoices: Array<{ id: string; balanceDue: number; paymentStatus: 'Paid' | 'Partial' | 'Unpaid' }> = [];

  // Sort unpaid invoices oldest first (FIFO)
  const sorted = [...unpaidInvoices].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  for (const inv of sorted) {
    if (remaining <= 0) break;
    const due = inv.balanceDue || 0;
    if (due <= 0) continue;

    const allocated = Math.min(remaining, due);
    remaining = safeSub(remaining, allocated);

    allocations.push({
      id: `alloc_${voucherId}_${inv.id}`,
      voucherId,
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      amount: allocated
    });

    const newBalanceDue = safeSub(due, allocated);
    const newStatus: 'Paid' | 'Partial' | 'Unpaid' = newBalanceDue <= 0.01 ? 'Paid' : 'Partial';

    updatedInvoices.push({
      id: inv.id,
      balanceDue: newBalanceDue,
      paymentStatus: newStatus
    });
  }

  return {
    allocations,
    unallocatedAmount: remaining,
    updatedInvoices
  };
}
