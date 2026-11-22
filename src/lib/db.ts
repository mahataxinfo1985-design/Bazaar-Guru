import { supabase } from './supabase';
import { BusinessProfile, Party, Item, Invoice, InvoiceItem } from '../types';

// Let's declare Expense interfaces locally as well in case they aren't fully compiled yet
export interface Expense {
  id: string;
  businessId?: string;
  date: string;
  category: string;
  amount: number;
  paymentMode: string;
  vendorName: string;
  description?: string;
  receiptUrl?: string;
  gstAmount?: number;
  vendorGstin?: string;
  createdAt: string;
}

// MAPPING HELPERS

// Profiles
function mapProfileToDb(profile: BusinessProfile, userId: string) {
  return {
    id: userId,
    name: profile.name,
    gstin: profile.gstin || '',
    address: profile.address || '',
    state: profile.state || '',
    phone: profile.phone || '',
    email: profile.email || '',
    logo_url: profile.logoUrl || null,
    signature_url: profile.signatureUrl || null,
    bank_name: profile.bankName || '',
    bank_account: profile.bankAccount || '',
    bank_ifsc: profile.bankIFSC || '',
    bank_branch: profile.bankBranch || '',
    terms_template: profile.termsTemplate || null,
    upi_id: profile.upiId || null,
    updated_at: new Date().toISOString(),
  };
}

function mapProfileFromDb(db: any): BusinessProfile {
  return {
    name: db.name || '',
    gstin: db.gstin || '',
    address: db.address || '',
    state: db.state || '',
    phone: db.phone || '',
    email: db.email || '',
    logoUrl: db.logo_url || undefined,
    signatureUrl: db.signature_url || undefined,
    bankName: db.bank_name || '',
    bankAccount: db.bank_account || '',
    bankIFSC: db.bank_ifsc || '',
    bankBranch: db.bank_branch || '',
    termsTemplate: db.terms_template || undefined,
    upiId: db.upi_id || undefined,
  };
}

// Parties
function mapPartyToDb(party: Party, userId: string) {
  return {
    id: party.id,
    business_id: userId,
    name: party.name,
    phone: party.phone,
    email: party.email || null,
    gstin: party.gstin || null,
    billing_address: party.billingAddress,
    shipping_address: party.shippingAddress || null,
    state: party.state,
    outstanding_balance: party.outstandingBalance,
    type: party.type,
  };
}

function mapPartyFromDb(db: any): Party {
  return {
    id: db.id,
    name: db.name,
    phone: db.phone,
    email: db.email || undefined,
    gstin: db.gstin || undefined,
    billingAddress: db.billing_address,
    shippingAddress: db.shipping_address || undefined,
    state: db.state,
    outstandingBalance: Number(db.outstanding_balance || 0),
    type: db.type as any,
  };
}

// Items
function mapItemToDb(item: Item, userId: string) {
  return {
    id: item.id,
    business_id: userId,
    name: item.name,
    hsn_code: item.hsnCode || null,
    unit: item.unit,
    unit_price: item.unitPrice,
    mrp: item.mrp,
    gst_rate: item.gstRate,
    stock_qty: item.stockQty,
  };
}

function mapItemFromDb(db: any): Item {
  return {
    id: db.id,
    name: db.name,
    hsnCode: db.hsn_code || '',
    unit: db.unit,
    unitPrice: Number(db.unit_price || 0),
    mrp: Number(db.mrp || 0),
    gstRate: Number(db.gst_rate || 0),
    stockQty: Number(db.stock_qty || 0),
  };
}

// Invoices
function mapInvoiceToDb(invoice: Invoice, userId: string) {
  return {
    id: invoice.id,
    business_id: userId,
    invoice_number: invoice.invoiceNumber,
    reference_number: invoice.referenceNumber || null,
    po_number: invoice.poNumber || null,
    type: invoice.type,
    date: invoice.date,
    due_date: invoice.dueDate,
    party_id: invoice.partyId,
    party_type: invoice.partyType,
    subtotal: invoice.subtotal,
    discount: invoice.discount,
    taxable_amount: invoice.taxableAmount,
    cgst: invoice.cgst,
    sgst: invoice.sgst,
    igst: invoice.igst,
    cess: invoice.cess,
    round_off: invoice.roundOff,
    grand_total: invoice.grandTotal,
    amount_in_words: invoice.amountInWords,
    payment_mode: invoice.paymentMode,
    amount_received: invoice.amountReceived,
    balance_due: invoice.balanceDue,
    payment_status: invoice.paymentStatus,
    notes: invoice.notes || null,
    terms: invoice.terms || null,
    status: invoice.status,
    cancel_reason: invoice.cancelReason || null,
    deleted: invoice.deleted || false,
    created_at: invoice.createdAt,
    updated_at: invoice.updatedAt || new Date().toISOString(),
    audit_trail: invoice.auditTrail || [],
    auto_stock_addition: invoice.autoStockAddition || null,
    
    // Phase 1 specific fields
    bill_of_entry_number: (invoice as any).billOfEntryNumber || null,
    port_details: (invoice as any).portDetails || null,
    reverse_charge_applicable: (invoice as any).reverseChargeApplicable || false,
    delivery_date: (invoice as any).deliveryDate || null,
    expected_return_date: (invoice as any).expectedReturnDate || null,
    challan_status: (invoice as any).challanStatus || null,
  };
}

function mapInvoiceFromDb(db: any, dbItems: any[]): Invoice {
  return {
    id: db.id,
    invoiceNumber: db.invoice_number,
    referenceNumber: db.reference_number || undefined,
    poNumber: db.po_number || undefined,
    type: db.type as any,
    date: db.date,
    dueDate: db.due_date,
    partyId: db.party_id,
    partyType: db.party_type as any,
    subtotal: Number(db.subtotal || 0),
    discount: Number(db.discount || 0),
    taxableAmount: Number(db.taxable_amount || 0),
    cgst: Number(db.cgst || 0),
    sgst: Number(db.sgst || 0),
    igst: Number(db.igst || 0),
    cess: Number(db.cess || 0),
    roundOff: Number(db.round_off || 0),
    grandTotal: Number(db.grand_total || 0),
    amountInWords: db.amount_in_words,
    paymentMode: db.payment_mode as any,
    amountReceived: Number(db.amount_received || 0),
    balanceDue: Number(db.balance_due || 0),
    paymentStatus: db.payment_status as any,
    notes: db.notes || undefined,
    terms: db.terms || undefined,
    status: db.status as any,
    cancelReason: db.cancel_reason || undefined,
    deleted: db.deleted,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
    auditTrail: db.audit_trail || [],
    autoStockAddition: db.auto_stock_addition !== null ? db.auto_stock_addition : undefined,
    
    // Phase 1 specific fields
    billOfEntryNumber: db.bill_of_entry_number || undefined,
    portDetails: db.port_details || undefined,
    reverseChargeApplicable: db.reverse_charge_applicable !== null ? db.reverse_charge_applicable : undefined,
    deliveryDate: db.delivery_date || undefined,
    expectedReturnDate: db.expected_return_date || undefined,
    challanStatus: db.challan_status || undefined,

    items: dbItems.map(mapInvoiceItemFromDb),
  };
}

// Invoice Items
function mapInvoiceItemToDb(item: InvoiceItem, invoiceId: string) {
  return {
    id: item.id,
    invoice_id: invoiceId,
    item_id: item.itemId || null,
    name: item.name,
    hsn_code: item.hsnCode || '',
    qty: item.qty,
    unit: item.unit,
    unit_price: item.unitPrice,
    mrp: item.mrp || null,
    discount: item.discount,
    discount_type: item.discountType,
    taxable_value: item.taxableValue,
    gst_rate: item.gstRate,
    cgst: item.cgst,
    sgst: item.sgst,
    igst: item.igst,
    total: item.total,
    batch_number: item.batchNumber || null,
    expiry_date: item.expiryDate || null,
    manufacturing_date: item.manufacturingDate || null,
  };
}

function mapInvoiceItemFromDb(db: any): InvoiceItem {
  return {
    id: db.id,
    itemId: db.item_id || undefined,
    name: db.name,
    hsnCode: db.hsn_code || '',
    qty: Number(db.qty || 0),
    unit: db.unit,
    unitPrice: Number(db.unit_price || 0),
    mrp: db.mrp ? Number(db.mrp) : undefined,
    discount: Number(db.discount || 0),
    discountType: db.discount_type as any,
    taxableValue: Number(db.taxable_value || 0),
    gstRate: Number(db.gst_rate || 0),
    cgst: Number(db.cgst || 0),
    sgst: Number(db.sgst || 0),
    igst: Number(db.igst || 0),
    total: Number(db.total || 0),
    batchNumber: db.batch_number || undefined,
    expiryDate: db.expiry_date || undefined,
    manufacturingDate: db.manufacturing_date || undefined,
  };
}

// Expenses
function mapExpenseToDb(expense: Expense, userId: string) {
  return {
    id: expense.id,
    business_id: userId,
    date: expense.date,
    category: expense.category,
    amount: expense.amount,
    payment_mode: expense.paymentMode,
    vendor_name: expense.vendorName,
    description: expense.description || null,
    receipt_url: expense.receiptUrl || null,
    gst_amount: expense.gstAmount || 0,
    vendor_gstin: expense.vendorGstin || null,
    created_at: expense.createdAt || new Date().toISOString(),
  };
}

function mapExpenseFromDb(db: any): Expense {
  return {
    id: db.id,
    businessId: db.business_id,
    date: db.date,
    category: db.category,
    amount: Number(db.amount || 0),
    paymentMode: db.payment_mode,
    vendorName: db.vendor_name,
    description: db.description || undefined,
    receiptUrl: db.receipt_url || undefined,
    gstAmount: db.gst_amount ? Number(db.gst_amount) : undefined,
    vendorGstin: db.vendor_gstin || undefined,
    createdAt: db.created_at,
  };
}

// CRUD OPERATORS

// Business Profile
export async function fetchProfile(userId: string): Promise<BusinessProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // No profile found
    throw error;
  }
  return mapProfileFromDb(data);
}

export async function upsertProfile(profile: BusinessProfile, userId: string): Promise<void> {
  const dbProfile = mapProfileToDb(profile, userId);
  const { error } = await supabase
    .from('profiles')
    .upsert(dbProfile);

  if (error) throw error;
}

// Parties
export async function fetchParties(): Promise<Party[]> {
  const { data, error } = await supabase
    .from('parties')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;
  return (data || []).map(mapPartyFromDb);
}

export async function upsertParty(party: Party, userId: string): Promise<void> {
  const dbParty = mapPartyToDb(party, userId);
  const { error } = await supabase
    .from('parties')
    .upsert(dbParty);

  if (error) throw error;
}

export async function deleteParty(id: string): Promise<void> {
  const { error } = await supabase
    .from('parties')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Items
export async function fetchItems(): Promise<Item[]> {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;
  return (data || []).map(mapItemFromDb);
}

export async function upsertItem(item: Item, userId: string): Promise<void> {
  const dbItem = mapItemToDb(item, userId);
  const { error } = await supabase
    .from('items')
    .upsert(dbItem);

  if (error) throw error;
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('items')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Invoices
export async function fetchInvoices(): Promise<Invoice[]> {
  // Fetch both invoices and all invoice items
  const { data: invData, error: invError } = await supabase
    .from('invoices')
    .select('*')
    .order('created_at', { ascending: false });

  if (invError) throw invError;

  const { data: itemsData, error: itemsError } = await supabase
    .from('invoice_items')
    .select('*');

  if (itemsError) throw itemsError;

  const invoiceItemsMap: Record<string, any[]> = {};
  (itemsData || []).forEach(item => {
    if (!invoiceItemsMap[item.invoice_id]) {
      invoiceItemsMap[item.invoice_id] = [];
    }
    invoiceItemsMap[item.invoice_id].push(item);
  });

  return (invData || []).map(dbInv => {
    const items = invoiceItemsMap[dbInv.id] || [];
    return mapInvoiceFromDb(dbInv, items);
  });
}

export async function upsertInvoice(invoice: Invoice, userId: string): Promise<void> {
  const dbInvoice = mapInvoiceToDb(invoice, userId);
  
  // Upsert the main invoice
  const { error: invError } = await supabase
    .from('invoices')
    .upsert(dbInvoice);

  if (invError) throw invError;

  // Delete existing items for this invoice
  const { error: delError } = await supabase
    .from('invoice_items')
    .delete()
    .eq('invoice_id', invoice.id);

  if (delError) throw delError;

  // Insert current items
  if (invoice.items && invoice.items.length > 0) {
    const dbItems = invoice.items.map(item => mapInvoiceItemToDb(item, invoice.id));
    const { error: itemsError } = await supabase
      .from('invoice_items')
      .insert(dbItems);

    if (itemsError) throw itemsError;
  }
}

export async function softDeleteInvoice(id: string): Promise<void> {
  const { error } = await supabase
    .from('invoices')
    .update({ deleted: true, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

// Expenses
export async function fetchExpenses(): Promise<Expense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .order('date', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapExpenseFromDb);
}

export async function upsertExpense(expense: Expense, userId: string): Promise<void> {
  const dbExpense = mapExpenseToDb(expense, userId);
  const { error } = await supabase
    .from('expenses')
    .upsert(dbExpense);

  if (error) throw error;
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Asset upload (Storage)
export async function uploadAsset(bucket: string, path: string, file: File): Promise<string> {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      upsert: true,
      cacheControl: '3600',
    });

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);

  return publicUrl;
}


// ====================================================================
// ACCOUNTING ENTITIES CLOUD ACCESS
// ====================================================================

import { Account, JournalEntry, PaymentVoucher } from '../types/accounting';

export async function fetchAccounts(): Promise<Account[]> {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .order('code', { ascending: true });

  if (error) {
    // If table doesn't exist yet, return empty list safely
    if (error.code === '42P01') return [];
    throw error;
  }
  return (data || []).map((db: any) => ({
    id: db.id,
    businessId: db.business_id,
    code: db.code,
    name: db.name,
    type: db.type,
    subtype: db.subtype,
    openingBalance: Number(db.opening_balance || 0),
    currentBalance: Number(db.current_balance || 0),
    isSystem: Boolean(db.is_system),
    isActive: Boolean(db.is_active),
    createdAt: db.created_at,
  }));
}

export async function upsertAccount(account: Account, userId: string): Promise<void> {
  const { error } = await supabase
    .from('accounts')
    .upsert({
      id: account.id,
      business_id: userId,
      code: account.code,
      name: account.name,
      type: account.type,
      subtype: account.subtype,
      opening_balance: account.openingBalance,
      current_balance: account.currentBalance,
      is_system: account.isSystem,
      is_active: account.isActive,
      created_at: account.createdAt,
    });

  if (error) throw error;
}

export async function fetchJournalEntries(): Promise<JournalEntry[]> {
  const { data: entriesData, error: entriesError } = await supabase
    .from('journal_entries')
    .select('*')
    .order('date', { ascending: false });

  if (entriesError) {
    if (entriesError.code === '42P01') return [];
    throw entriesError;
  }

  const { data: linesData, error: linesError } = await supabase
    .from('journal_lines')
    .select('*');

  if (linesError) throw linesError;

  const linesMap: Record<string, any[]> = {};
  (linesData || []).forEach((l) => {
    if (!linesMap[l.entry_id]) linesMap[l.entry_id] = [];
    linesMap[l.entry_id].push({
      id: l.id,
      entryId: l.entry_id,
      accountId: l.account_id,
      partyId: l.party_id,
      description: l.description,
      debit: Number(l.debit || 0),
      credit: Number(l.credit || 0),
    });
  });

  return (entriesData || []).map((e: any) => ({
    id: e.id,
    businessId: e.business_id,
    entryNumber: e.entry_number,
    date: e.date,
    sourceType: e.source_type,
    sourceId: e.source_id,
    partyId: e.party_id,
    narration: e.narration,
    totalDebit: Number(e.total_debit || 0),
    totalCredit: Number(e.total_credit || 0),
    status: e.status,
    createdAt: e.created_at,
    lines: linesMap[e.id] || [],
  }));
}

export async function insertJournalEntry(entry: JournalEntry, userId: string): Promise<void> {
  const { error: entryErr } = await supabase
    .from('journal_entries')
    .upsert({
      id: entry.id,
      business_id: userId,
      entry_number: entry.entryNumber,
      date: entry.date,
      source_type: entry.sourceType,
      source_id: entry.sourceId,
      party_id: entry.partyId || null,
      narration: entry.narration,
      total_debit: entry.totalDebit,
      total_credit: entry.totalCredit,
      status: entry.status,
      created_at: entry.createdAt,
      created_by: userId,
    });

  if (entryErr) throw entryErr;

  if (entry.lines && entry.lines.length > 0) {
    await supabase.from('journal_lines').delete().eq('entry_id', entry.id);
    const dbLines = entry.lines.map((l) => ({
      id: l.id,
      entry_id: entry.id,
      business_id: userId,
      account_id: l.accountId,
      party_id: l.partyId || null,
      description: l.description || null,
      debit: l.debit,
      credit: l.credit,
    }));
    const { error: lineErr } = await supabase.from('journal_lines').insert(dbLines);
    if (lineErr) throw lineErr;
  }
}

export async function fetchPaymentVouchers(): Promise<PaymentVoucher[]> {
  const { data, error } = await supabase
    .from('payment_vouchers')
    .select('*')
    .order('date', { ascending: false });

  if (error) {
    if (error.code === '42P01') return [];
    throw error;
  }

  const { data: allocData, error: allocError } = await supabase
    .from('payment_allocations')
    .select('*');

  if (allocError) throw allocError;

  const allocMap: Record<string, any[]> = {};
  (allocData || []).forEach((a) => {
    if (!allocMap[a.voucher_id]) allocMap[a.voucher_id] = [];
    allocMap[a.voucher_id].push({
      id: a.id,
      voucherId: a.voucher_id,
      invoiceId: a.invoice_id,
      amount: Number(a.amount || 0),
    });
  });

  return (data || []).map((pv: any) => ({
    id: pv.id,
    businessId: pv.business_id,
    voucherNumber: pv.voucher_number,
    type: pv.type,
    partyId: pv.party_id,
    date: pv.date,
    paymentMode: pv.payment_mode,
    accountId: pv.account_id,
    amount: Number(pv.amount || 0),
    referenceNumber: pv.reference_number,
    notes: pv.notes,
    status: pv.status,
    allocations: allocMap[pv.id] || [],
    createdAt: pv.created_at,
  }));
}

export async function insertPaymentVoucher(voucher: PaymentVoucher, userId: string): Promise<void> {
  const { error: vError } = await supabase
    .from('payment_vouchers')
    .upsert({
      id: voucher.id,
      business_id: userId,
      voucher_number: voucher.voucherNumber,
      type: voucher.type,
      party_id: voucher.partyId,
      date: voucher.date,
      payment_mode: voucher.paymentMode,
      account_id: voucher.accountId,
      amount: voucher.amount,
      reference_number: voucher.referenceNumber || null,
      notes: voucher.notes || null,
      status: voucher.status,
      created_at: voucher.createdAt,
    });

  if (vError) throw vError;

  if (voucher.allocations && voucher.allocations.length > 0) {
    const dbAlloc = voucher.allocations.map((a) => ({
      id: a.id,
      voucher_id: voucher.id,
      invoice_id: a.invoiceId,
      business_id: userId,
      amount: a.amount,
      created_at: voucher.createdAt,
    }));
    await supabase.from('payment_allocations').delete().eq('voucher_id', voucher.id);
    const { error: aError } = await supabase.from('payment_allocations').insert(dbAlloc);
    if (aError) throw aError;
  }
}

// Atomic Stored Procedure RPC Wrappers
export async function dbCreateSalesInvoiceAtomic(
  invoice: Invoice,
  userId: string
): Promise<void> {
  const { error } = await supabase.rpc('create_sales_invoice_atomic', {
    p_invoice: invoice,
    p_items: invoice.items || [],
    p_business_id: userId,
  });

  if (error) {
    // If RPC is missing in development database, fallback gracefully to standard upsert
    console.warn('create_sales_invoice_atomic RPC unavailable, falling back to standard upsert:', error.message);
    await upsertInvoice(invoice, userId);
  }
}

export async function dbRecordPaymentVoucherAtomic(
  voucher: PaymentVoucher,
  userId: string
): Promise<void> {
  const { error } = await supabase.rpc('record_payment_voucher_atomic', {
    p_voucher: voucher,
    p_allocations: voucher.allocations || [],
    p_business_id: userId,
  });

  if (error) {
    console.warn('record_payment_voucher_atomic RPC unavailable, falling back to standard insert:', error.message);
    await insertPaymentVoucher(voucher, userId);
  }
}

export async function upsertBankAccount(bankAccount: any, userId: string): Promise<void> {
  const { error } = await supabase.from('bank_accounts').upsert({
    id: bankAccount.id,
    business_id: bankAccount.businessId || userId,
    account_name: bankAccount.accountName,
    bank_name: bankAccount.bankName,
    account_holder_name: bankAccount.accountHolderName,
    account_number: bankAccount.accountNumber,
    ifsc_code: bankAccount.ifscCode,
    branch_name: bankAccount.branchName,
    account_type: bankAccount.accountType,
    opening_balance: bankAccount.openingBalance,
    opening_balance_date: bankAccount.openingBalanceDate,
    current_balance: bankAccount.currentBalance,
    linked_account_id: bankAccount.linkedAccountId,
    is_default: bankAccount.isDefault,
    is_active: bankAccount.isActive,
    created_at: bankAccount.createdAt
  });
  if (error && error.code !== '42P01') throw error;
}

export async function insertFundTransfer(transfer: any, userId: string): Promise<void> {
  const { error } = await supabase.from('fund_transfers').insert({
    id: transfer.id,
    business_id: transfer.businessId || userId,
    transfer_number: transfer.transferNumber,
    date: transfer.date,
    source_account_id: transfer.sourceAccountId,
    destination_account_id: transfer.destinationAccountId,
    amount: transfer.amount,
    reference_number: transfer.referenceNumber,
    narration: transfer.narration,
    status: transfer.status,
    created_by: userId,
    created_at: transfer.createdAt
  });
  if (error && error.code !== '42P01') throw error;
}

export async function insertChequeRecord(cheque: any, userId: string): Promise<void> {
  const { error } = await supabase.from('cheque_records').upsert({
    id: cheque.id,
    business_id: cheque.businessId || userId,
    cheque_number: cheque.chequeNumber,
    cheque_date: cheque.chequeDate,
    amount: cheque.amount,
    party_id: cheque.partyId,
    type: cheque.type,
    bank_name: cheque.bankName,
    status: cheque.status,
    deposit_date: cheque.depositDate,
    clearing_date: cheque.clearingDate,
    bounce_reason: cheque.bounceReason,
    bounce_charges: cheque.bounceCharges,
    voucher_id: cheque.voucherId,
    created_at: cheque.createdAt
  });
  if (error && error.code !== '42P01') throw error;
}
