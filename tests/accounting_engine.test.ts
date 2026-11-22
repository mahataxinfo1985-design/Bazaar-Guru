/**
 * Comprehensive Double-Entry Accounting Test Suite
 * Validating all core rules, journal mapping, balances, and period constraints
 */

import { DEFAULT_CHART_OF_ACCOUNTS } from '../src/services/accounting/chartOfAccounts';
import { 
  validateJournalEntry, 
  createSalesInvoiceJournalEntry,
  createSalesReturnJournalEntry,
  createPurchaseInvoiceJournalEntry,
  createPurchaseReturnJournalEntry,
  createPaymentInJournalEntry,
  createPaymentOutJournalEntry,
  createExpenseJournalEntry,
  createManualJournalEntry,
  createPartyOpeningBalanceJournalEntry
} from '../src/services/accounting/journalEngine';
import { 
  getComputedAccountBalances, 
  getAccountLedger, 
  getPartyAccountingBalance,
  getAccountingOverviewMetrics
} from '../src/services/accounting/accountingService';
import { 
  allocatePaymentAcrossInvoices 
} from '../src/services/accounting/partyLedger';
import { 
  canPostToDate, 
  lockPeriod, 
  generateStandardPeriods 
} from '../src/services/accounting/periodService';
import { 
  migrateExistingBusinessData 
} from '../src/services/accounting/migration';
import { Invoice, Expense, Party } from '../src/types';
import { JournalEntry, PaymentVoucher } from '../src/types/accounting';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`TEST FAILED: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

function runTests() {
  console.log('=== STARTING INVOICE PRO PHASE 2 ACCOUNTING TEST SUITE ===\n');

  const accounts = [...DEFAULT_CHART_OF_ACCOUNTS];

  // ----------------------------------------------------
  // TEST 1: Balanced Entry Validation
  // ----------------------------------------------------
  console.log('Test Group 1: Journal Entry Validation');
  const cashAcc = accounts.find(a => a.code === '1010')!;
  const bankAcc = accounts.find(a => a.code === '1020')!;
  const capitalAcc = accounts.find(a => a.code === '3010')!;

  const validEntry: JournalEntry = {
    id: 'je-1',
    businessId: 'biz-1',
    entryNumber: 'JV-001',
    date: '2024-05-10',
    sourceType: 'manual',
    description: 'Initial Capital Infusion into Bank',
    lines: [
      { id: 'l1', accountId: bankAcc.id, accountCode: bankAcc.code, accountName: bankAcc.name, debit: 100000, credit: 0 },
      { id: 'l2', accountId: capitalAcc.id, accountCode: capitalAcc.code, accountName: capitalAcc.name, debit: 0, credit: 100000 }
    ],
    totalAmount: 100000,
    status: 'posted',
    createdAt: new Date().toISOString()
  };
  const valResult = validateJournalEntry(validEntry, accounts);
  assert(valResult.valid, `Valid balanced entry should pass validation: ${valResult.error}`);

  // ----------------------------------------------------
  // TEST 2: Unbalanced Entry Rejection & Inactive Accounts
  // ----------------------------------------------------
  const unbalancedEntry: JournalEntry = {
    ...validEntry,
    id: 'je-unbalanced',
    lines: [
      { id: 'l1', accountId: cashAcc.id, accountCode: cashAcc.code, accountName: cashAcc.name, debit: 1000, credit: 0 },
      { id: 'l2', accountId: capitalAcc.id, accountCode: capitalAcc.code, accountName: capitalAcc.name, debit: 0, credit: 950 }
    ]
  };
  const unbalResult = validateJournalEntry(unbalancedEntry, accounts);
  assert(!unbalResult.valid, 'Unbalanced entry must fail validation with Dr != Cr');

  // Inactive account rejection
  const accountsWithInactive = accounts.map(a => a.code === '1020' ? { ...a, isActive: false } : a);
  const inactiveResult = validateJournalEntry(validEntry, accountsWithInactive);
  assert(!inactiveResult.valid, 'Posting to inactive account must fail validation');

  // ----------------------------------------------------
  // TEST 3: Sales Invoice Double-Entry (Credit Sale)
  // ----------------------------------------------------
  console.log('\nTest Group 2: Sales Invoices Double-Entry');
  const creditSalesInvoice: Invoice = {
    id: 'inv-sales-1',
    invoiceNumber: 'INV-001',
    partyId: 'party-cust-1',
    partyType: 'customer',
    date: '2024-06-15',
    dueDate: '2024-07-15',
    status: 'Active',
    paymentStatus: 'Unpaid',
    type: 'Tax Invoice',
    paymentMode: 'Credit',
    items: [],
    subtotal: 1000,
    discount: 0,
    taxableAmount: 1000,
    cgst: 90,
    sgst: 90,
    igst: 0,
    cess: 0,
    roundOff: 0,
    grandTotal: 1180,
    balanceDue: 1180,
    amountReceived: 0,
    amountInWords: 'One Thousand One Hundred Eighty Only',
    createdAt: '',
    updatedAt: '',
    auditTrail: []
  };

  const salesJournal = createSalesInvoiceJournalEntry(creditSalesInvoice, accounts, 'Acme Corp');
  const salesVal = validateJournalEntry(salesJournal, accounts);
  assert(salesVal.valid, `Credit Sales Invoice generates strictly balanced journal: ${salesVal.error}`);
  
  // Verify Lines: Dr Debtors (1200: 1180), Cr Sales (4010: 1000), Cr Output CGST (2210: 90), Cr Output SGST (2220: 90)
  const drDebtors = salesJournal.lines.find(l => l.accountCode === '1200')?.debit || 0;
  const crSales = salesJournal.lines.find(l => l.accountCode === '4010')?.credit || 0;
  const crCgst = salesJournal.lines.find(l => l.accountCode === '2210')?.credit || 0;
  const crSgst = salesJournal.lines.find(l => l.accountCode === '2220')?.credit || 0;

  assert(drDebtors === 1180, 'Debtors (1200) debited for gross amount 1180');
  assert(crSales === 1000, 'Sales revenue (4010) credited for taxable 1000');
  assert(crCgst === 90, 'Output CGST (2210) credited for 90');
  assert(crSgst === 90, 'Output SGST (2220) credited for 90');

  // ----------------------------------------------------
  // TEST 4: Cash Sale with Discount & Round-off
  // ----------------------------------------------------
  const cashSaleInvoice: Invoice = {
    ...creditSalesInvoice,
    id: 'inv-cash-1',
    invoiceNumber: 'INV-002',
    paymentStatus: 'Paid',
    amountReceived: 1121,
    balanceDue: 0,
    subtotal: 1000,
    discount: 50,
    taxableAmount: 950,
    cgst: 85.5,
    sgst: 85.5,
    igst: 0,
    cess: 0,
    roundOff: 0,
    grandTotal: 1121,
    paymentMode: 'Cash'
  };
  const cashSaleJournal = createSalesInvoiceJournalEntry(cashSaleInvoice, accounts, 'Walk-in Customer');
  const cashVal = validateJournalEntry(cashSaleJournal, accounts);
  assert(cashVal.valid, `Cash Sale with discount generates balanced journal: ${cashVal.error}`);
  const cashDr = cashSaleJournal.lines.find(l => l.accountCode === '1010')?.debit || 0;
  assert(cashDr === 1121, 'Cash (1010) debited directly on cash sale for 1121');

  // ----------------------------------------------------
  // TEST 5: Sales Return (Credit Note)
  // ----------------------------------------------------
  console.log('\nTest Group 3: Sales Returns (Credit Notes)');
  const creditNote: Invoice = {
    ...creditSalesInvoice,
    id: 'cn-1',
    invoiceNumber: 'CN-001',
    type: 'Credit Note',
    taxableAmount: 500,
    cgst: 45,
    sgst: 45,
    grandTotal: 590,
    balanceDue: 0
  };
  const returnJournal = createSalesReturnJournalEntry(creditNote, accounts, 'Acme Corp');
  const retVal = validateJournalEntry(returnJournal, accounts);
  assert(retVal.valid, `Sales Return generates balanced journal: ${retVal.error}`);
  const drReturn = returnJournal.lines.find(l => l.accountCode === '4030')?.debit || 0;
  const drCgstRev = returnJournal.lines.find(l => l.accountCode === '2210')?.debit || 0;
  const crDebtorsRev = returnJournal.lines.find(l => l.accountCode === '1200')?.credit || 0;
  assert(drReturn === 500, 'Sales Returns (4030) debited for 500');
  assert(drCgstRev === 45, 'Output CGST liability (2210) debited/reversed for 45');
  assert(crDebtorsRev === 590, 'Debtors (1200) credited for 590');

  // ----------------------------------------------------
  // TEST 6: Purchase Invoice (Credit Purchase)
  // ----------------------------------------------------
  console.log('\nTest Group 4: Purchase Bills & Debit Notes');
  const purchaseBill: Invoice = {
    id: 'bill-1',
    invoiceNumber: 'BILL-101',
    partyId: 'party-supp-1',
    partyType: 'supplier',
    date: '2024-06-20',
    dueDate: '2024-07-20',
    status: 'Active',
    paymentStatus: 'Unpaid',
    items: [],
    subtotal: 2000,
    discount: 0,
    taxableAmount: 2000,
    cgst: 180,
    sgst: 180,
    igst: 0,
    cess: 0,
    roundOff: 0,
    grandTotal: 2360,
    balanceDue: 2360,
    amountReceived: 0,
    paymentMode: 'Credit',
    type: 'Purchase Invoice',
    amountInWords: 'Two Thousand Three Hundred Sixty Only',
    createdAt: '',
    updatedAt: '',
    auditTrail: []
  };
  const purchaseJournal = createPurchaseInvoiceJournalEntry(purchaseBill, accounts, 'Global Supplies Ltd');
  const purVal = validateJournalEntry(purchaseJournal, accounts);
  assert(purVal.valid, `Purchase Bill generates balanced journal: ${purVal.error}`);
  const drPurchases = purchaseJournal.lines.find(l => l.accountCode === '5020')?.debit || 0;
  const drInputCgst = purchaseJournal.lines.find(l => l.accountCode === '1510')?.debit || 0;
  const crCreditors = purchaseJournal.lines.find(l => l.accountCode === '2010')?.credit || 0;
  assert(drPurchases === 2000, 'Purchases (5020) debited 2000');
  assert(drInputCgst === 180, 'Input CGST ITC (1510) debited 180');
  assert(crCreditors === 2360, 'Creditors AP (2010) credited 2360');

  // ----------------------------------------------------
  // TEST 7: Purchase Return (Debit Note)
  // ----------------------------------------------------
  const debitNote: Invoice = {
    ...purchaseBill,
    id: 'dn-1',
    invoiceNumber: 'DN-001',
    type: 'Debit Note',
    taxableAmount: 1000,
    cgst: 90,
    sgst: 90,
    grandTotal: 1180
  };
  const debitNoteJournal = createPurchaseReturnJournalEntry(debitNote, accounts, 'Global Supplies Ltd');
  const dnVal = validateJournalEntry(debitNoteJournal, accounts);
  assert(dnVal.valid, `Debit Note generates balanced journal: ${dnVal.error}`);
  const drCreditorsRev = debitNoteJournal.lines.find(l => l.accountCode === '2010')?.debit || 0;
  const crInputCgstRev = debitNoteJournal.lines.find(l => l.accountCode === '1510')?.credit || 0;
  const crPurchReturn = debitNoteJournal.lines.find(l => l.accountCode === '5030')?.credit || 0;
  assert(drCreditorsRev === 1180, 'Creditors debited/reduced by 1180');
  assert(crPurchReturn === 1000, 'Purchase returns (5030) credited by 1000');
  assert(crInputCgstRev === 90, 'Input CGST ITC (1510) reversed/credited by 90');

  // ----------------------------------------------------
  // TEST 8: Payment In (Customer Receipt)
  // ----------------------------------------------------
  console.log('\nTest Group 5: Payment Vouchers');
  const paymentIn: PaymentVoucher = {
    id: 'pv-in-1',
    businessId: 'biz-1',
    voucherNumber: 'RC-001',
    partyId: 'party-cust-1',
    type: 'payment_in',
    date: '2024-06-25',
    amount: 1180,
    paymentMode: 'bank',
    bankAccountId: 'acc_1020',
    allocations: [{ invoiceId: 'inv-sales-1', amount: 1180 }],
    status: 'posted',
    createdAt: new Date().toISOString()
  };
  const payInJournal = createPaymentInJournalEntry(paymentIn, accounts);
  const payInVal = validateJournalEntry(payInJournal, accounts);
  assert(payInVal.valid, `Payment In generates balanced journal: ${payInVal.error}`);
  const drBank = payInJournal.lines.find(l => l.accountCode === '1020')?.debit || 0;
  const crCust = payInJournal.lines.find(l => l.accountCode === '1200')?.credit || 0;
  assert(drBank === 1180, 'Bank account (1020) debited 1180');
  assert(crCust === 1180, 'Debtors (1200) credited 1180');

  // ----------------------------------------------------
  // TEST 9: Payment Out (Supplier Disbursement)
  // ----------------------------------------------------
  const paymentOut: PaymentVoucher = {
    id: 'pv-out-1',
    businessId: 'biz-1',
    voucherNumber: 'PV-001',
    partyId: 'party-supp-1',
    type: 'payment_out',
    date: '2024-06-28',
    amount: 1180,
    paymentMode: 'bank',
    bankAccountId: 'acc_1020',
    allocations: [{ invoiceId: 'bill-1', amount: 1180 }],
    status: 'posted',
    createdAt: new Date().toISOString()
  };
  const payOutJournal = createPaymentOutJournalEntry(paymentOut, accounts);
  const payOutVal = validateJournalEntry(payOutJournal, accounts);
  assert(payOutVal.valid, `Payment Out generates balanced journal: ${payOutVal.error}`);
  const drSupp = payOutJournal.lines.find(l => l.accountCode === '2010')?.debit || 0;
  const crBank = payOutJournal.lines.find(l => l.accountCode === '1020')?.credit || 0;
  assert(drSupp === 1180, 'Accounts Payable (2010) debited 1180');
  assert(crBank === 1180, 'Bank (1020) credited 1180');

  // ----------------------------------------------------
  // TEST 10: Operating Expenses (Paid vs Unpaid)
  // ----------------------------------------------------
  console.log('\nTest Group 6: Operating Expenses');
  const paidExpense: Expense = {
    id: 'exp-1',
    businessId: 'biz-1',
    date: '2024-06-10',
    category: 'Rent',
    amount: 25000,
    paymentMode: 'Bank Transfer',
    vendorName: 'City Properties',
    createdAt: new Date().toISOString()
  };
  const expJournal = createExpenseJournalEntry(paidExpense, accounts);
  const expVal = validateJournalEntry(expJournal, accounts);
  assert(expVal.valid, `Paid Rent expense generates balanced journal: ${expVal.error}`);
  const drRent = expJournal.lines.find(l => l.accountCode === '6010')?.debit || 0;
  const crExpBank = expJournal.lines.find(l => l.accountCode === '1020')?.credit || 0;
  assert(drRent === 25000, 'Rent expense (6010) debited 25000');
  assert(crExpBank === 25000, 'Bank (1020) credited 25000');

  const unpaidExpense: Expense = {
    ...paidExpense,
    id: 'exp-2',
    category: 'Electricity',
    amount: 3500,
    paymentMode: 'Unpaid'
  };
  const unpaidExpJournal = createExpenseJournalEntry(unpaidExpense, accounts);
  const unpaidVal = validateJournalEntry(unpaidExpJournal, accounts);
  assert(unpaidVal.valid, `Unpaid electricity expense creates AP entry: ${unpaidVal.error}`);
  const crPayable = unpaidExpJournal.lines.find(l => l.accountCode === '2010' || l.accountCode === '2300')?.credit || 0;
  assert(crPayable === 3500, 'Current liabilities/payables credited 3500');

  // ----------------------------------------------------
  // TEST 11: Multi-Invoice FIFO Payment Allocation
  // ----------------------------------------------------
  console.log('\nTest Group 7: FIFO Payment Allocation');
  const invoicesToAllocate: Invoice[] = [
    { ...creditSalesInvoice, id: 'inv-a', invoiceNumber: 'A-01', date: '2024-05-01', balanceDue: 500 },
    { ...creditSalesInvoice, id: 'inv-b', invoiceNumber: 'B-02', date: '2024-05-15', balanceDue: 800 },
    { ...creditSalesInvoice, id: 'inv-c', invoiceNumber: 'C-03', date: '2024-05-20', balanceDue: 400 }
  ];
  const allocation = allocatePaymentAcrossInvoices('pv-test-alloc', 1000, invoicesToAllocate);
  const allocatedTotal = allocation.allocations.reduce((sum, a) => sum + a.amount, 0);
  assert(allocatedTotal === 1000, 'Total allocated matches 1000');
  assert(allocation.unallocatedAmount === 0, 'Zero unallocated amount');
  assert(allocation.allocations.length === 2, 'Allocated across first 2 invoices');
  assert(allocation.allocations[0].invoiceId === 'inv-a' && allocation.allocations[0].amount === 500, 'First invoice fully paid');
  assert(allocation.allocations[1].invoiceId === 'inv-b' && allocation.allocations[1].amount === 500, 'Second invoice partially paid');

  // ----------------------------------------------------
  // TEST 12: Account Balances & Trial Balance Invariant
  // ----------------------------------------------------
  console.log('\nTest Group 8: Account Balances & Trial Balance Invariant');
  const allTestJournals = [
    validEntry,
    salesJournal,
    cashSaleJournal,
    returnJournal,
    purchaseJournal,
    debitNoteJournal,
    payInJournal,
    payOutJournal,
    expJournal,
    unpaidExpJournal
  ];

  let totalJournalDr = 0;
  let totalJournalCr = 0;
  allTestJournals.forEach(j => {
    j.lines.forEach(l => {
      totalJournalDr += l.debit;
      totalJournalCr += l.credit;
    });
  });

  const diff = Math.abs(totalJournalDr - totalJournalCr);
  assert(diff <= 0.01, `Journal invariant holds across all transactions: Total Dr (${totalJournalDr.toFixed(2)}) == Total Cr (${totalJournalCr.toFixed(2)})`);

  // Overview metrics
  const metrics = getAccountingOverviewMetrics(accounts, allTestJournals);
  assert(metrics.isTrialBalanceBalanced, `Overview reports trial balance is balanced (difference: ${metrics.trialBalanceDifference})`);
  assert(metrics.totalAssets > 0, `Total assets computed correctly: ${metrics.totalAssets}`);

  // ----------------------------------------------------
  // TEST 13: Financial Periods & Lock Enforcement
  // ----------------------------------------------------
  console.log('\nTest Group 9: Financial Periods & Locks');
  const standardPeriods = generateStandardPeriods('biz-1');
  assert(standardPeriods.length >= 3, 'Standard financial year periods generated');

  // Closed period check (FY 2024-25 is closed)
  const closedCheck = canPostToDate(standardPeriods, '2024-06-15');
  assert(!closedCheck.allowed, 'Posting to closed FY 2024-25 is strictly rejected');

  // Open period check (FY 2025-26 is open)
  const openCheck = canPostToDate(standardPeriods, '2025-06-15');
  assert(openCheck.allowed, 'Posting to open FY 2025-26 is allowed');

  // Lock open period
  const lockedPeriods = lockPeriod('fy_2025_26', standardPeriods);
  const lockedCheck = canPostToDate(lockedPeriods, '2025-06-15');
  assert(!lockedCheck.allowed, 'Posting to locked FY 2025-26 is rejected');

  // ----------------------------------------------------
  // TEST 14: Historical Data Migration Idempotence
  // ----------------------------------------------------
  console.log('\nTest Group 10: Historical Migration');
  const legacyInvoices = [creditSalesInvoice, purchaseBill];
  const legacyExpenses = [paidExpense];
  const legacyParties: Party[] = [
    {
      id: 'party-cust-1',
      name: 'Acme Corp',
      type: 'customer',
      phone: '9876543210',
      billingAddress: 'Mumbai',
      state: 'Maharashtra',
      openingBalance: 5000,
      outstandingBalance: 5000
    }
  ];

  // First Migration Run
  const migrationResult1 = migrateExistingBusinessData(
    legacyInvoices,
    legacyExpenses,
    legacyParties,
    accounts,
    [] // No existing journals
  );
  assert(migrationResult1.migratedJournals === 4, `4 legacy transactions migrated to journals (got ${migrationResult1.migratedJournals})`);
  assert(migrationResult1.errors.length === 0, '0 errors in migration');

  // Second Migration Run (Idempotency check)
  const migrationResult2 = migrateExistingBusinessData(
    legacyInvoices,
    legacyExpenses,
    legacyParties,
    accounts,
    migrationResult1.generatedEntries // Existing journals passed
  );
  assert(migrationResult2.migratedJournals === 0, `Migration is strictly idempotent: 0 duplicate journals created (got ${migrationResult2.migratedJournals})`);
  assert(migrationResult2.skippedCount === 4, `All 4 records skipped on rerun (got ${migrationResult2.skippedCount})`);

  console.log('\n======================================================');
  console.log('✓ ALL 14 PHASE 2 ACCOUNTING TEST GROUPS PASSED CLEANLY');
  console.log('======================================================\n');
}

runTests();
