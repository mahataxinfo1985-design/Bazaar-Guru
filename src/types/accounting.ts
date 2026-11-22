import { PaymentMode } from '../types';

export * from './banking';

export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

export type AccountSubtype = 
  // ASSETS
  | 'cash' 
  | 'bank' 
  | 'accounts_receivable' 
  | 'inventory' 
  | 'fixed_assets'
  | 'other_current_assets'
  | 'tax_credit' 
  // LIABILITIES
  | 'accounts_payable' 
  | 'tax_payable' 
  | 'loans'
  | 'other_current_liabilities'
  // EQUITY
  | 'equity' 
  | 'drawings'
  | 'retained_earnings'
  // INCOME
  | 'sales' 
  | 'sales_returns'
  | 'other_income'
  | 'discounts_received'
  // EXPENSES
  | 'purchases'
  | 'purchase_returns'
  | 'cogs' 
  | 'operating_expense' 
  | 'rent'
  | 'salary'
  | 'electricity'
  | 'transportation'
  | 'advertising'
  | 'office_expense'
  | 'discounts_allowed'
  | 'other_expense'
  | 'round_off';

export interface Account {
  id: string;
  businessId?: string;
  code: string;
  name: string;
  type: AccountType;
  subtype: AccountSubtype;
  parentId?: string;
  parentCode?: string;
  level?: number;
  description?: string;
  openingBalance: number;
  openingBalanceType?: 'debit' | 'credit';
  openingBalanceDate?: string;
  currentBalance: number;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface JournalLine {
  id: string;
  entryId?: string;
  accountId: string;
  accountCode?: string;
  accountName?: string;
  partyId?: string;
  partyName?: string;
  description?: string;
  debit: number;
  credit: number;
}

export type JournalSourceType =
  | 'sales_invoice' 
  | 'purchase_invoice' 
  | 'invoice'
  | 'purchase'
  | 'payment_in' 
  | 'payment_out' 
  | 'receipt'
  | 'payment'
  | 'fund_transfer'
  | 'cheque_bounce'
  | 'expense' 
  | 'sales_return' 
  | 'purchase_return' 
  | 'credit_note'
  | 'debit_note'
  | 'stock_adjustment'
  | 'cogs'
  | 'opening_balance' 
  | 'period_closing'
  | 'journal_voucher'
  | 'manual';

export interface JournalEntry {
  id: string;
  businessId?: string;
  entryNumber: string;
  date: string;
  sourceType: JournalSourceType;
  sourceId?: string;
  partyId?: string;
  narration?: string;
  description?: string;
  totalDebit?: number;
  totalCredit?: number;
  totalAmount?: number;
  status: 'draft' | 'posted' | 'voided';
  periodId?: string;
  reversalOf?: string;
  reversalEntryId?: string;
  isSystemGenerated?: boolean;
  lines: JournalLine[];
  createdAt: string;
  createdBy?: string;
}

export interface ManualJournalInput {
  date: string;
  narration: string;
  lines: Array<{
    accountId: string;
    debit: number;
    credit: number;
    partyId?: string;
    partyName?: string;
    description?: string;
  }>;
}

export interface AccountingPeriod {
  id: string;
  businessId?: string;
  name: string; // e.g. "FY 2024-25"
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  status: 'open' | 'locked' | 'closed';
  closedAt?: string;
  closedBy?: string;
  reopenedAt?: string;
  reopenedBy?: string;
  reopenReason?: string;
}

export interface PaymentAllocation {
  id: string;
  voucherId: string;
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
}

export type PaymentCategory = 
  | 'customer_receipt'
  | 'supplier_payment' 
  | 'expense_payment' 
  | 'loan_repayment' 
  | 'advance_payment' 
  | 'other';

export interface PaymentVoucher {
  id: string;
  businessId?: string;
  voucherNumber: string;
  voucherType?: 'receipt' | 'payment';
  type: 'payment_in' | 'payment_out';
  category?: PaymentCategory;
  partyId?: string;
  partyName?: string;
  payeeType?: 'customer' | 'supplier' | 'vendor' | 'employee' | 'other';
  date: string;
  paymentMode: PaymentMode;
  accountId?: string; // Cash or Bank account id
  bankAccountId?: string; // alias
  sourceAccountId?: string;
  sourceAccountType?: 'bank' | 'cash';
  destinationAccountId?: string;
  destinationAccountType?: 'bank' | 'cash';
  amount: number;
  unallocatedAmount?: number;
  advanceAmount?: number;
  referenceNumber?: string;
  chequeDetails?: {
    chequeNumber: string;
    chequeDate: string;
    bankName: string;
    clearingStatus?: string;
  };
  attachmentUrl?: string;
  notes?: string;
  narration?: string;
  allocations?: PaymentAllocation[] | any[];
  status: 'completed' | 'cancelled' | 'posted' | 'draft';
  cancelledReason?: string;
  reversalOf?: string;
  journalEntryId?: string;
  createdAt?: string;
  createdBy?: string;
}

export interface PartyLedgerEntry {
  id: string;
  date: string;
  type: 'Invoice' | 'Payment' | 'Return' | 'Opening Balance' | 'Debit Note' | 'Credit Note' | 'Journal';
  referenceNumber: string;
  narration: string;
  debit: number;
  credit: number;
  runningBalance: number;
  balanceType: 'Dr' | 'Cr';
}

export interface AccountLedgerRow {
  id: string;
  date: string;
  entryNumber: string;
  sourceType: JournalSourceType;
  narration: string;
  partyName?: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

export interface AccountLedgerStatement {
  account: Account;
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  normalBalance: 'Dr' | 'Cr';
  rows: AccountLedgerRow[];
}

export interface AccountingOverviewMetrics {
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  totalIncome: number;
  totalExpenses: number;
  grossProfit: number;
  netProfit: number;
  currentReceivables: number;
  currentPayables: number;
  cashAndBankBalance: number;
  isTrialBalanceBalanced: boolean;
  trialBalanceDifference: number;
}

export type OfflineMutationType = 
  | 'upsert_invoice' 
  | 'cancel_invoice' 
  | 'upsert_party' 
  | 'delete_party' 
  | 'upsert_item' 
  | 'delete_item' 
  | 'upsert_expense' 
  | 'delete_expense' 
  | 'record_payment'
  | 'upsert_account'
  | 'upsert_bank_account'
  | 'upsert_cash_account'
  | 'upsert_fund_transfer'
  | 'upsert_cheque'
  | 'upsert_warehouse'
  | 'upsert_stock_movement'
  | 'upsert_stock_transfer'
  | 'upsert_stock_adjustment'
  | 'upsert_product_batch'
  | 'post_journal'
  | 'upsert_bank_account'
  | 'fund_transfer'
  | 'record_cheque'
  | 'reconcile_bank';

export interface OfflineMutation {
  id: string;
  businessId?: string;
  type: OfflineMutationType;
  entityId: string;
  payload: any;
  status: 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict';
  retryCount: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TrialBalanceRow {
  accountCode: string;
  accountName: string;
  type: AccountType;
  debit: number;
  credit: number;
}

export interface ProfitAndLossReport {
  totalRevenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  totalOperatingExpenses: number;
  netProfit: number;
  revenueLines: { accountName: string; amount: number }[];
  expenseLines: { accountName: string; amount: number }[];
}
