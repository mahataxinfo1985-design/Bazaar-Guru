export type BankAccountType = 'savings' | 'current' | 'cash_credit' | 'overdraft' | 'other';
export type CashAccountType = 'main' | 'branch' | 'petty_cash' | 'other' | 'main_cash';

export interface BankAccount {
  id: string;
  businessId?: string;
  accountName: string; // e.g., "HDFC Current Account"
  bankName: string; // e.g., "HDFC Bank"
  accountHolderName?: string;
  accountNumber: string; // Stored as entered, masked in UI
  ifscCode?: string;
  branchName?: string;
  accountType: BankAccountType;
  openingBalance: number;
  openingBalanceDate?: string;
  currentBalance: number;
  linkedAccountId?: string; // Links to Chart of Accounts (e.g. 'acc_1020')
  overdraftLimit?: number;
  upiId?: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface CashAccount {
  id: string;
  businessId?: string;
  accountName?: string; // e.g., "Main Cash Drawer", "Petty Cash"
  name?: string; // convenient alias
  accountType: CashAccountType;
  openingBalance: number;
  openingBalanceDate?: string;
  currentBalance: number;
  linkedAccountId?: string; // Links to Chart of Accounts (e.g. 'acc_1010')
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface FundTransfer {
  id: string;
  businessId?: string;
  transferNumber: string; // e.g. "TRF-0001"
  date: string; // YYYY-MM-DD
  sourceAccountId: string; // Cash or Bank account id
  sourceAccountType: 'bank' | 'cash';
  sourceAccountName?: string;
  destinationAccountId: string; // Cash or Bank account id
  destinationAccountType: 'bank' | 'cash';
  destinationAccountName?: string;
  amount: number;
  transferMode?: 'bank_transfer' | 'cash_deposit' | 'cash_withdrawal' | 'cheque' | 'internal_transfer';
  referenceNumber?: string;
  narration?: string;
  attachmentUrl?: string;
  journalEntryId?: string;
  status: 'completed' | 'cancelled';
  cancelledReason?: string;
  createdBy?: string;
  createdAt: string;
}

export type ChequeStatus = 
  | 'received' 
  | 'issued' 
  | 'deposited' 
  | 'pending_clearance' 
  | 'cleared' 
  | 'bounced' 
  | 'cancelled';

export interface ChequeRecord {
  id: string;
  businessId?: string;
  chequeNumber: string;
  chequeDate: string; // YYYY-MM-DD
  amount: number;
  partyId?: string;
  partyName: string;
  partyType?: 'customer' | 'supplier';
  type?: 'received' | 'issued';
  chequeType?: 'received' | 'issued'; // alias for type
  bankName: string;
  bankAccountId?: string;
  depositDate?: string;
  clearingDate?: string;
  clearanceDate?: string; // alias
  bounceDate?: string;
  status: ChequeStatus;
  bounceReason?: string;
  bounceCharges?: number;
  bankCharges?: number; // alias
  bounceJournalId?: string;
  journalEntryId?: string; // alias
  voucherId?: string; // links to PaymentVoucher
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface BankStatementImport {
  id: string;
  businessId?: string;
  bankAccountId: string;
  bankAccountName?: string;
  fileName: string;
  fileType?: 'csv' | 'xlsx';
  importedAt?: string;
  importDate?: string;
  transactionCount?: number;
  totalRows?: number;
  importedRowsCount?: number;
  duplicateRowsCount?: number;
  openingBalance?: number;
  closingBalance?: number;
  checksum?: string;
  status: 'imported' | 'reconciled' | 'partially_reconciled';
}

export type StatementMatchStatus = 'unmatched' | 'matched' | 'adjusted' | 'ignored';

export interface BankStatementLine {
  id: string;
  businessId?: string;
  importId?: string;
  statementId?: string;
  bankAccountId: string;
  date?: string; // YYYY-MM-DD
  transactionDate?: string; // alias
  valueDate?: string;
  description: string;
  referenceNumber?: string;
  debit?: number; // Withdrawals
  withdrawalAmount?: number; // alias
  credit?: number; // Deposits
  depositAmount?: number; // alias
  balance?: number;
  balanceAfter?: number; // alias
  matchedStatus?: StatementMatchStatus;
  isReconciled?: boolean;
  matchedTransactionId?: string;
  matchedVoucherId?: string;
  matchedJournalLineId?: string;
  matchedType?: 'voucher' | 'transfer' | 'expense' | 'manual';
  rowChecksum?: string;
}

export interface BankReconciliationMatch {
  id: string;
  reconciliationId: string;
  statementLineId: string;
  bookTransactionId: string; // Voucher or Journal ID
  matchedAmount: number;
  matchedDate: string;
  matchType: 'exact' | 'manual' | 'adjusted';
}

export interface BankReconciliation {
  id: string;
  businessId?: string;
  bankAccountId: string;
  statementId?: string;
  statementDate?: string; // As of date
  reconciliationDate?: string; // alias
  statementClosingBalance: number;
  bookClosingBalance: number;
  unreconciledAmount?: number;
  unpresentedChequesAmount?: number;
  uncreditedDepositsAmount?: number;
  bankChargesNotInBooks?: number;
  interestNotInBooks?: number;
  reconciledBalance?: number;
  difference?: number;
  isBalanced?: boolean;
  matchedCount?: number;
  status: 'in_progress' | 'reconciled' | 'draft' | 'completed';
  completedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CashBankBookRow {
  id: string;
  date: string;
  voucherNumber: string;
  voucherType: string;
  particulars: string;
  counterParty?: string;
  narration?: string;
  referenceNumber?: string;
  debit: number; // Receipt / Deposit
  debitAmount?: number; // alias
  credit: number; // Payment / Withdrawal
  creditAmount?: number; // alias
  runningBalance: number;
}

export interface CashBankBookReport {
  accountId: string;
  accountName: string;
  accountType: 'cash' | 'bank';
  startDate?: string;
  endDate?: string;
  fromDate?: string; // alias
  toDate?: string; // alias
  openingBalance: number;
  totalDebit?: number;
  totalDebits?: number; // alias
  totalCredit?: number;
  totalCredits?: number; // alias
  closingBalance: number;
  rows?: CashBankBookRow[];
  transactions?: CashBankBookRow[]; // alias
}

export interface AgeingBucket {
  notDue: number;
  days1_30: number;
  days31_60: number;
  days61_90: number;
  above90: number;
  total: number;
}

export interface PartyAgeingInvoice {
  invoiceId: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  total: number;
  balanceDue: number;
  daysOverdue: number;
}

export interface PartyAgeingItem {
  partyId: string;
  partyName: string;
  partyType?: 'customer' | 'supplier';
  phone?: string;
  totalOutstanding: number;
  oldestInvoiceDate?: string;
  buckets: AgeingBucket;
  invoices?: PartyAgeingInvoice[];
}

export interface ReceivablesPayablesAgeingSummary {
  totalReceivables: number;
  totalPayables: number;
  receivablesBuckets: AgeingBucket;
  payablesBuckets: AgeingBucket;
  customerAgeing: PartyAgeingItem[];
  supplierAgeing: PartyAgeingItem[];
  // Conveniences for UI nested access
  receivables?: {
    totalReceivable: number;
    totalOverdue: number;
    buckets: AgeingBucket;
    partyBreakdown: PartyAgeingItem[];
  };
  payables?: {
    totalPayable: number;
    totalOverdue: number;
    buckets: AgeingBucket;
    partyBreakdown: PartyAgeingItem[];
  };
}

export type PaymentCategory = 
  | 'customer_receipt' 
  | 'supplier_payment' 
  | 'expense_payment' 
  | 'loan_repayment' 
  | 'advance_payment' 
  | 'other';

export interface RawStatementRow {
  date: string;
  description: string;
  referenceNumber?: string;
  debit?: number;
  credit?: number;
  withdrawalAmount?: number;
  depositAmount?: number;
  balance?: number;
  isDuplicate?: boolean;
}

export type RawParsedRow = RawStatementRow;

export type PaymentVoucherStatus = 'posted' | 'completed' | 'draft' | 'cancelled';

export interface PaymentVoucher {
  id: string;
  businessId?: string;
  voucherNumber: string;
  voucherType?: 'receipt' | 'payment';
  type: 'payment_in' | 'payment_out';
  category?: PaymentCategory;
  date: string; // YYYY-MM-DD
  partyId?: string;
  partyName?: string;
  payeeType?: 'customer' | 'supplier' | 'vendor' | 'employee' | 'other';
  amount: number;
  advanceAmount?: number;
  paymentMode: 'cash' | 'bank_transfer' | 'cheque' | 'upi' | 'neft' | 'rtgs' | 'imps' | 'card' | 'other' | any;
  referenceNumber?: string;
  accountId?: string;
  bankAccountId?: string;
  sourceAccountId?: string;
  sourceAccountType?: 'bank' | 'cash';
  destinationAccountId?: string;
  destinationAccountType?: 'bank' | 'cash';
  chequeDetails?: {
    chequeNumber: string;
    chequeDate: string;
    bankName: string;
  };
  narration?: string;
  attachmentUrl?: string;
  status: PaymentVoucherStatus;
  reversalOf?: string;
  cancelledReason?: string;
  journalEntryId?: string;
  allocations?: {
    id?: string;
    voucherId?: string;
    invoiceId: string;
    invoiceNumber?: string;
    amount: number;
    amountAllocated?: number;
  }[];
  createdAt?: string;
}
