export interface InventoryConfig {
  defaultValuationMethod: 'weighted_average' | 'fifo';
  allowNegativeStock: boolean;
  lowStockAlertThreshold?: number;
  enableBatches?: boolean;
}

export interface BusinessProfile {
  id?: string;
  name: string;
  gstin: string;
  address: string;
  state: string;
  phone: string;
  email: string;
  logoUrl?: string;
  signatureUrl?: string;
  bankName: string;
  bankAccount: string;
  bankIFSC: string;
  bankBranch: string;
  termsTemplate?: string;
  upiId?: string;
  inventoryConfig?: InventoryConfig;
}

export type PartyType = 'customer' | 'supplier';

export interface Party {
  id: string;
  name: string;
  phone: string;
  email?: string;
  gstin?: string;
  billingAddress: string;
  shippingAddress?: string;
  state: string;
  outstandingBalance: number;
  currentBalance?: number;
  balance?: number;
  openingBalance?: number;
  openingBalanceType?: 'debit' | 'credit';
  type: PartyType;
}

import { Product } from './types/inventory';
export * from './types/accounting';
export * from './types/inventory';

export interface Item extends Partial<Product> {
  id: string;
  name: string;
  hsnCode: string;
  unit: string;
  unitPrice: number;
  mrp?: number;
  gstRate: number; // e.g. 18 for 18%
  stockQty: number; // Current quantity in stock
}

export interface InvoiceItem {
  id: string;
  itemId?: string;
  name: string;
  hsnCode: string;
  qty: number;
  unit: string;
  unitPrice: number;
  mrp?: number;
  discount: number; // percent or raw
  discountType: 'percentage' | 'fixed';
  taxableValue: number;
  gstRate: number; // e.g., 18
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  batchNumber?: string;
  expiryDate?: string;
  manufacturingDate?: string;
}

export type InvoiceType = 
  | 'Tax Invoice' 
  | 'Non-GST Invoice' 
  | 'Proforma Invoice' 
  | 'Credit Note' 
  | 'Debit Note' 
  | 'Bill of Supply'
  | 'Purchase Invoice'
  | 'Purchase Return'
  | 'Delivery Challan'
  | 'Reverse Charge'
  | 'Import Invoice'
  | 'Purchase Order';

export type PaymentMode = 
  | 'Cash' 
  | 'UPI' 
  | 'Card' 
  | 'NEFT' 
  | 'RTGS' 
  | 'IMPS' 
  | 'Cheque' 
  | 'Credit' 
  | 'Bank Transfer' 
  | 'cash' 
  | 'bank' 
  | 'bank_transfer' 
  | 'cheque' 
  | 'other';

export type PaymentStatus = 'Paid' | 'Partial' | 'Unpaid' | 'Overdue';

export type InvoiceStatus = 'Draft' | 'Active' | 'Cancelled';

export interface AuditLog {
  timestamp: string;
  action: string;
  user: string;
  reason?: string;
}

export type ExpenseCategory = 
  | 'Rent' | 'Salary' | 'Electricity' | 'Internet' | 'Travel' 
  | 'Food' | 'Office Supplies' | 'Marketing' | 'Maintenance' | 'Others';

export interface Expense {
  id: string;
  businessId?: string;
  date: string;
  category: ExpenseCategory;
  amount: number;
  paymentMode: string;
  vendorName: string;
  description?: string;
  receiptUrl?: string;
  gstAmount?: number;
  vendorGstin?: string;
  createdAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  referenceNumber?: string;
  poNumber?: string;
  type: InvoiceType;
  date: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  partyId: string; // references Party.id
  partyType: PartyType;
  items: InvoiceItem[];
  subtotal: number;
  discount: number; // total discount
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  roundOff: number;
  grandTotal: number;
  amountInWords: string;
  paymentMode: PaymentMode;
  amountReceived: number;
  balanceDue: number;
  paymentStatus: PaymentStatus;
  notes?: string;
  terms?: string;
  status: InvoiceStatus;
  cancelReason?: string;
  deleted?: boolean; // soft-delete flag — invoice is hidden from list but not removed
  createdAt: string;
  updatedAt: string;
  auditTrail: AuditLog[];
  autoStockAddition?: boolean; // relevant for PurchaseInvoices
  
  // Phase 1 fields
  billOfEntryNumber?: string;
  portDetails?: string;
  reverseChargeApplicable?: boolean;
  deliveryDate?: string;
  expectedReturnDate?: string;
  challanStatus?: string;
}

export interface FinancialSummary {
  totalSales: number;
  totalPurchases: number;
  totalPaidSales: number;
  totalUnpaidSales: number;
  totalPaidPurchases: number;
  totalUnpaidPurchases: number;
  gstCollected: number;
  gstPaid: number;
}

export type Purchase = Invoice;

export * from './types/sync';
export * from './types/workspace';

