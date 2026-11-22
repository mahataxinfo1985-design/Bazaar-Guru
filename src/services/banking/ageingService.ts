import { Party, Invoice } from '../../types';
import { 
  ReceivablesPayablesAgeingSummary, 
  PartyAgeingItem, 
  AgeingBucket, 
  PartyAgeingInvoice 
} from '../../types/banking';
import { round2, safeAdd } from '../../utils/decimal';

/**
 * Computes overdue days based on today's date vs due date.
 */
export function calculateDaysOverdue(dueDateStr: string, asOfDateStr?: string): number {
  const asOf = asOfDateStr ? new Date(asOfDateStr) : new Date();
  const due = new Date(dueDateStr);
  const diffTime = asOf.getTime() - due.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Categorizes an unpaid amount into standard Indian commercial ageing buckets.
 */
export function assignToAgeingBucket(
  amount: number,
  daysOverdue: number,
  bucket: AgeingBucket
): void {
  if (daysOverdue === 0) {
    bucket.notDue = safeAdd(bucket.notDue, amount);
  } else if (daysOverdue <= 30) {
    bucket.days1_30 = safeAdd(bucket.days1_30, amount);
  } else if (daysOverdue <= 60) {
    bucket.days31_60 = safeAdd(bucket.days31_60, amount);
  } else if (daysOverdue <= 90) {
    bucket.days61_90 = safeAdd(bucket.days61_90, amount);
  } else {
    bucket.above90 = safeAdd(bucket.above90, amount);
  }
  bucket.total = safeAdd(bucket.total, amount);
}

/**
 * Computes comprehensive Accounts Receivable and Accounts Payable Ageing reports.
 */
export function computeReceivablesPayablesAgeing(
  parties: Party[],
  invoices: Invoice[],
  asOfDateStr?: string
): ReceivablesPayablesAgeingSummary {
  const customerAgeing: PartyAgeingItem[] = [];
  const supplierAgeing: PartyAgeingItem[] = [];

  const receivablesBuckets: AgeingBucket = {
    notDue: 0,
    days1_30: 0,
    days31_60: 0,
    days61_90: 0,
    above90: 0,
    total: 0
  };

  const payablesBuckets: AgeingBucket = {
    notDue: 0,
    days1_30: 0,
    days31_60: 0,
    days61_90: 0,
    above90: 0,
    total: 0
  };

  // Group unpaid invoices by party
  for (const party of parties) {
    const isCustomer = party.type === 'customer';
    const partyInvoices = invoices.filter((inv) => {
      if (inv.partyId !== party.id || inv.deleted || inv.status === 'Cancelled') return false;
      const isSales = !inv.type.includes('Purchase') && inv.type !== 'Purchase Return';
      if (isCustomer && !isSales) return false;
      if (!isCustomer && isSales) return false;
      return (inv.balanceDue || 0) > 0.01;
    });

    const partyBucket: AgeingBucket = {
      notDue: 0,
      days1_30: 0,
      days31_60: 0,
      days61_90: 0,
      above90: 0,
      total: 0
    };

    const invoiceItems: PartyAgeingInvoice[] = [];

    for (const inv of partyInvoices) {
      const daysOverdue = calculateDaysOverdue(inv.dueDate || inv.date, asOfDateStr);
      const due = inv.balanceDue;

      assignToAgeingBucket(due, daysOverdue, partyBucket);
      if (isCustomer) {
        assignToAgeingBucket(due, daysOverdue, receivablesBuckets);
      } else {
        assignToAgeingBucket(due, daysOverdue, payablesBuckets);
      }

      invoiceItems.push({
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        date: inv.date,
        dueDate: inv.dueDate || inv.date,
        total: inv.grandTotal,
        balanceDue: due,
        daysOverdue
      });
    }

    if (partyBucket.total > 0) {
      const item: PartyAgeingItem = {
        partyId: party.id,
        partyName: party.name,
        partyType: party.type,
        phone: party.phone,
        totalOutstanding: round2(partyBucket.total),
        buckets: {
          notDue: round2(partyBucket.notDue),
          days1_30: round2(partyBucket.days1_30),
          days31_60: round2(partyBucket.days31_60),
          days61_90: round2(partyBucket.days61_90),
          above90: round2(partyBucket.above90),
          total: round2(partyBucket.total)
        },
        invoices: invoiceItems.sort((a, b) => b.daysOverdue - a.daysOverdue)
      };

      if (isCustomer) {
        customerAgeing.push(item);
      } else {
        supplierAgeing.push(item);
      }
    }
  }

  // Sort by highest total outstanding
  customerAgeing.sort((a, b) => b.totalOutstanding - a.totalOutstanding);
  supplierAgeing.sort((a, b) => b.totalOutstanding - a.totalOutstanding);

  return {
    totalReceivables: round2(receivablesBuckets.total),
    totalPayables: round2(payablesBuckets.total),
    receivablesBuckets: {
      notDue: round2(receivablesBuckets.notDue),
      days1_30: round2(receivablesBuckets.days1_30),
      days31_60: round2(receivablesBuckets.days31_60),
      days61_90: round2(receivablesBuckets.days61_90),
      above90: round2(receivablesBuckets.above90),
      total: round2(receivablesBuckets.total)
    },
    payablesBuckets: {
      notDue: round2(payablesBuckets.notDue),
      days1_30: round2(payablesBuckets.days1_30),
      days31_60: round2(payablesBuckets.days31_60),
      days61_90: round2(payablesBuckets.days61_90),
      above90: round2(payablesBuckets.above90),
      total: round2(payablesBuckets.total)
    },
    customerAgeing,
    supplierAgeing,
    receivables: {
      totalReceivable: round2(receivablesBuckets.total),
      totalOverdue: round2(receivablesBuckets.total - receivablesBuckets.notDue),
      buckets: {
        notDue: round2(receivablesBuckets.notDue),
        days1_30: round2(receivablesBuckets.days1_30),
        days31_60: round2(receivablesBuckets.days31_60),
        days61_90: round2(receivablesBuckets.days61_90),
        above90: round2(receivablesBuckets.above90),
        total: round2(receivablesBuckets.total)
      },
      partyBreakdown: customerAgeing
    },
    payables: {
      totalPayable: round2(payablesBuckets.total),
      totalOverdue: round2(payablesBuckets.total - payablesBuckets.notDue),
      buckets: {
        notDue: round2(payablesBuckets.notDue),
        days1_30: round2(payablesBuckets.days1_30),
        days31_60: round2(payablesBuckets.days31_60),
        days61_90: round2(payablesBuckets.days61_90),
        above90: round2(payablesBuckets.above90),
        total: round2(payablesBuckets.total)
      },
      partyBreakdown: supplierAgeing
    }
  };
}

/**
 * Generates copyable, courteous payment reminder message for WhatsApp or Email.
 * Supports both object parameter and positional parameters.
 */
export function generatePaymentReminderText(
  businessOrOptions: string | {
    partyName: string;
    amountDue: number;
    oldestInvoiceDate?: string;
    businessName: string;
    overdueInvoices?: PartyAgeingInvoice[];
  },
  partyNameArg?: string,
  totalDueArg?: number,
  overdueInvoicesArg?: PartyAgeingInvoice[]
): string {
  let businessName = 'Bazaar-Guru Enterprise';
  let partyName = 'Valued Customer';
  let totalDue = 0;
  let overdueInvoices: PartyAgeingInvoice[] = [];

  if (typeof businessOrOptions === 'object') {
    businessName = businessOrOptions.businessName || businessName;
    partyName = businessOrOptions.partyName || partyName;
    totalDue = businessOrOptions.amountDue || 0;
    overdueInvoices = businessOrOptions.overdueInvoices || [];
  } else {
    businessName = businessOrOptions;
    partyName = partyNameArg || partyName;
    totalDue = totalDueArg || 0;
    overdueInvoices = overdueInvoicesArg || [];
  }

  const invoiceList = overdueInvoices && overdueInvoices.length > 0
    ? overdueInvoices
        .slice(0, 5)
        .map((inv) => `• Inv #${inv.invoiceNumber} (Due: ${inv.dueDate}): ₹${inv.balanceDue.toFixed(2)} (${inv.daysOverdue} days overdue)`)
        .join('\n')
    : `• Outstanding Balance: ₹${totalDue.toLocaleString('en-IN')}`;

  return `Dear ${partyName},\n\nGreetings from ${businessName}.\n\nThis is a gentle reminder that an outstanding payment of ₹${totalDue.toLocaleString('en-IN')} is due on your account.\n\nOverdue Invoices:\n${invoiceList}\n\nPlease arrange for the payment at your earliest convenience. If you have already made this payment, kindly disregard this message.\n\nThank you,\n${businessName}`;
}
