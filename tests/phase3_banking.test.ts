import { describe, it } from 'node:test';
import assert from 'node:assert';

// Core Types
import { 
  BankAccount, CashAccount, FundTransfer, ChequeRecord, 
  BankStatementLine, PaymentVoucher 
} from '../src/types/banking';
import { Invoice, Party, Item } from '../src/types';
import { JournalEntry, Account } from '../src/types/accounting';

// Services
import { DEFAULT_CHART_OF_ACCOUNTS } from '../src/services/accounting/chartOfAccounts';
import { 
  createPaymentInJournalEntry, 
  createPaymentOutJournalEntry, 
  createFundTransferJournalEntry,
  createChequeBounceJournalEntry,
  createReversalJournalEntry,
  validateJournalEntry
} from '../src/services/accounting/journalEngine';
import { 
  maskAccountNumber, 
  DEFAULT_BANK_ACCOUNTS, 
  DEFAULT_CASH_ACCOUNTS,
  canDeleteBankAccount 
} from '../src/services/banking/bankAccountService';
import { 
  validateFundTransfer, 
  executeFundTransfer 
} from '../src/services/banking/fundTransferService';
import { 
  canTransitionChequeStatus, 
  transitionChequeStatus, 
  processChequeBounce 
} from '../src/services/banking/chequeService';
import { 
  parseCSVStatement, 
  buildStatementImport 
} from '../src/services/banking/statementImportService';
import { 
  computeReconciliationSummary, 
  autoMatchBankTransactions 
} from '../src/services/banking/reconciliationService';
import { 
  generateCashBankBookReport, 
  exportCashBankBookCSV 
} from '../src/services/banking/cashBankBookService';
import { 
  calculateDaysOverdue, 
  assignToAgeingBucket, 
  computeReceivablesPayablesAgeing, 
  generatePaymentReminderText 
} from '../src/services/banking/ageingService';
import { allocatePaymentAcrossInvoices } from '../src/services/accounting/partyLedger';
import { safeAdd, safeSub } from '../src/utils/decimal';

describe('INVOICE PRO PHASE 3: PAYMENTS, RECEIPTS & BANKING MANAGEMENT TEST SUITE', () => {

  const accounts = DEFAULT_CHART_OF_ACCOUNTS;

  // --------------------------------------------------------------------------
  // 1. CUSTOMER RECEIPTS & MULTI-INVOICE ALLOCATION
  // --------------------------------------------------------------------------
  describe('1. Customer Receipts (Payment In)', () => {
    
    it('1.1 should create balanced double-entry journal for full customer receipt', () => {
      const voucher: PaymentVoucher = {
        id: 'v_rcpt_01',
        voucherNumber: 'RCPT-001',
        voucherType: 'receipt',
        type: 'payment_in',
        category: 'customer_receipt',
        date: '2026-11-21',
        partyId: 'party_cust_01',
        partyName: 'Reliance Retail Ltd',
        amount: 25000,
        paymentMode: 'bank_transfer',
        destinationAccountId: 'bank_hdfc_01',
        destinationAccountType: 'bank',
        referenceNumber: 'UTR99887766',
        status: 'posted',
        allocations: [{ invoiceId: 'inv_01', amount: 25000 }]
      };

      const journal = createPaymentInJournalEntry(voucher, accounts);
      assert.strictEqual(journal.entryNumber.startsWith('JE-'), true);
      assert.strictEqual(journal.lines.length, 2);

      const drLine = journal.lines.find(l => l.debit > 0);
      const crLine = journal.lines.find(l => l.credit > 0);

      // Dr Bank (1020), Cr Accounts Receivable (1200)
      assert.strictEqual(drLine?.accountCode, '1020');
      assert.strictEqual(drLine?.debit, 25000);
      assert.strictEqual(crLine?.accountCode, '1200');
      assert.strictEqual(crLine?.credit, 25000);

      const val = validateJournalEntry(journal);
      assert.strictEqual(val.valid, true, 'Payment In journal must be balanced');
    });

    it('1.2 should correctly allocate a single receipt across multiple invoices (FIFO)', () => {
      const invoices: Invoice[] = [
        {
          id: 'inv_01',
          invoiceNumber: 'INV-101',
          date: '2026-10-01',
          dueDate: '2026-10-31',
          partyId: 'party_01',
          partyType: 'customer',
          type: 'Tax Invoice',
          items: [],
          subtotal: 10000,
          discount: 0,
          taxableAmount: 10000,
          cgst: 900,
          sgst: 900,
          igst: 0,
          cess: 0,
          roundOff: 0,
          grandTotal: 11800,
          amountInWords: '',
          paymentMode: 'Cash',
          amountReceived: 0,
          balanceDue: 11800,
          paymentStatus: 'Unpaid',
          status: 'Active',
          createdAt: '',
          updatedAt: '',
          auditTrail: []
        },
        {
          id: 'inv_02',
          invoiceNumber: 'INV-102',
          date: '2026-10-15',
          dueDate: '2026-11-15',
          partyId: 'party_01',
          partyType: 'customer',
          type: 'Tax Invoice',
          items: [],
          subtotal: 15000,
          discount: 0,
          taxableAmount: 15000,
          cgst: 1350,
          sgst: 1350,
          igst: 0,
          cess: 0,
          roundOff: 0,
          grandTotal: 17700,
          amountInWords: '',
          paymentMode: 'Cash',
          amountReceived: 0,
          balanceDue: 17700,
          paymentStatus: 'Unpaid',
          status: 'Active',
          createdAt: '',
          updatedAt: '',
          auditTrail: []
        }
      ];

      // Receipt of 20,000 settles inv_01 in full (11,800) and inv_02 partially (8,200)
      const { allocations } = allocatePaymentAcrossInvoices('rcpt_100', 20000, invoices);
      assert.strictEqual(allocations.length, 2);
      assert.strictEqual(allocations[0].amount, 11800);
      assert.strictEqual(allocations[1].amount, 8200);
      assert.strictEqual(allocations[0].amount + allocations[1].amount, 20000);
    });

    it('1.3 should record advance payment when receipt exceeds unpaid invoices', () => {
      const invoices: Invoice[] = [
        {
          id: 'inv_03',
          invoiceNumber: 'INV-103',
          date: '2026-11-01',
          dueDate: '2026-11-30',
          partyId: 'party_01',
          partyType: 'customer',
          type: 'Tax Invoice',
          items: [],
          subtotal: 5000,
          discount: 0,
          taxableAmount: 5000,
          cgst: 0,
          sgst: 0,
          igst: 0,
          cess: 0,
          roundOff: 0,
          grandTotal: 5000,
          amountInWords: '',
          paymentMode: 'Cash',
          amountReceived: 0,
          balanceDue: 5000,
          paymentStatus: 'Unpaid',
          status: 'Active',
          createdAt: '',
          updatedAt: '',
          auditTrail: []
        }
      ];

      const { allocations, unallocatedAmount } = allocatePaymentAcrossInvoices('rcpt_101', 8000, invoices);
      const totalAllocated = allocations.reduce((s, a) => s + a.amount, 0);

      assert.strictEqual(totalAllocated, 5000);
      assert.strictEqual(unallocatedAmount, 3000, 'Remaining 3,000 must be marked as advance customer payment');
    });

    it('1.4 should reverse receipt and reinstate invoice balance upon cancellation', () => {
      const originalVoucher: PaymentVoucher = {
        id: 'v_rcpt_cancel',
        voucherNumber: 'RCPT-099',
        voucherType: 'receipt',
        type: 'payment_in',
        category: 'customer_receipt',
        date: '2026-11-20',
        partyId: 'cust_01',
        partyName: 'Tata Consumer',
        amount: 10000,
        paymentMode: 'bank_transfer',
        destinationAccountId: 'bank_01',
        destinationAccountType: 'bank',
        status: 'posted',
        allocations: [{ invoiceId: 'inv_rev_01', amount: 10000 }]
      };

      const origJournal = createPaymentInJournalEntry(originalVoucher, accounts);
      const reversalJournal = createReversalJournalEntry(origJournal, 'Customer cheque dishonoured');

      const val = validateJournalEntry(reversalJournal);
      assert.strictEqual(val.valid, true);

      // Reversal should Dr AR (1200) and Cr Bank (1020)
      const drLine = reversalJournal.lines.find(l => l.debit > 0);
      const crLine = reversalJournal.lines.find(l => l.credit > 0);
      assert.strictEqual(drLine?.accountCode, '1200'); // AR reinstated
      assert.strictEqual(crLine?.accountCode, '1020'); // Bank reversed
    });
  });

  // --------------------------------------------------------------------------
  // 2. SUPPLIER & BUSINESS PAYMENTS (PAYMENT OUT)
  // --------------------------------------------------------------------------
  describe('2. Supplier & Business Payments (Payment Out)', () => {

    it('2.1 should create balanced journal for supplier bill payment', () => {
      const voucher: PaymentVoucher = {
        id: 'v_pmt_01',
        voucherNumber: 'PAY-001',
        voucherType: 'payment',
        type: 'payment_out',
        category: 'supplier_payment',
        date: '2026-11-21',
        partyId: 'supp_01',
        partyName: 'Infosys BPM',
        payeeType: 'supplier',
        amount: 40000,
        paymentMode: 'bank_transfer',
        sourceAccountId: 'bank_hdfc_01',
        sourceAccountType: 'bank',
        status: 'posted',
        allocations: [{ invoiceId: 'bill_01', amount: 40000 }]
      };

      const journal = createPaymentOutJournalEntry(voucher, accounts);
      const val = validateJournalEntry(journal);
      assert.strictEqual(val.valid, true);

      // Dr Accounts Payable (2010), Cr Bank (1020)
      const drLine = journal.lines.find(l => l.debit > 0);
      const crLine = journal.lines.find(l => l.credit > 0);
      assert.strictEqual(drLine?.accountCode, '2010');
      assert.strictEqual(crLine?.accountCode, '1020');
      assert.strictEqual(drLine?.debit, 40000);
      assert.strictEqual(crLine?.credit, 40000);
    });

    it('2.2 should record direct expense payment posting to Expense account 6090', () => {
      const voucher: PaymentVoucher = {
        id: 'v_pmt_exp',
        voucherNumber: 'PAY-EXP-01',
        voucherType: 'payment',
        type: 'payment_out',
        category: 'expense_payment',
        date: '2026-11-21',
        partyName: 'Office Landlord (Rent)',
        payeeType: 'other',
        amount: 35000,
        paymentMode: 'bank_transfer',
        sourceAccountId: 'bank_hdfc_01',
        sourceAccountType: 'bank',
        status: 'posted'
      };

      const journal = createPaymentOutJournalEntry(voucher, accounts);
      const val = validateJournalEntry(journal);
      assert.strictEqual(val.valid, true);

      // Dr Operating/Admin Expense (6090), Cr Bank (1020)
      const drLine = journal.lines.find(l => l.debit > 0);
      const crLine = journal.lines.find(l => l.credit > 0);
      assert.strictEqual(drLine?.accountCode, '6090');
      assert.strictEqual(crLine?.accountCode, '1020');
      assert.strictEqual(drLine?.debit, 35000);
    });

    it('2.3 should record loan repayment posting to Loan Liability account 2100', () => {
      const voucher: PaymentVoucher = {
        id: 'v_pmt_loan',
        voucherNumber: 'PAY-LOAN-01',
        voucherType: 'payment',
        type: 'payment_out',
        category: 'loan_repayment',
        date: '2026-11-21',
        partyName: 'SBI Term Loan',
        payeeType: 'other',
        amount: 50000,
        paymentMode: 'bank_transfer',
        sourceAccountId: 'bank_hdfc_01',
        sourceAccountType: 'bank',
        status: 'posted'
      };

      const journal = createPaymentOutJournalEntry(voucher, accounts);
      const val = validateJournalEntry(journal);
      assert.strictEqual(val.valid, true);

      // Dr Loans Liability (2100), Cr Bank (1020)
      const drLine = journal.lines.find(l => l.debit > 0);
      assert.strictEqual(drLine?.accountCode, '2100');
      assert.strictEqual(drLine?.debit, 50000);
    });
  });

  // --------------------------------------------------------------------------
  // 3. MULTI-ACCOUNT BANKING & INTERNAL FUND TRANSFERS (CONTRA)
  // --------------------------------------------------------------------------
  describe('3. Multi-Account Banking & Fund Transfers (Contra)', () => {

    it('3.1 should correctly mask bank account numbers for security', () => {
      assert.strictEqual(maskAccountNumber('50200012345678'), '•••• •••• •••• 5678');
      assert.strictEqual(maskAccountNumber('1234'), '•••• 1234');
      assert.strictEqual(maskAccountNumber(''), '••••');
    });

    it('3.2 should validate fund transfer against source account balance and overdraft limit', () => {
      const bankCurrent: BankAccount = {
        id: 'bank_01',
        businessId: 'biz_01',
        bankName: 'HDFC Bank',
        accountName: 'Acme Current',
        accountNumber: '502000112233',
        accountType: 'current',
        openingBalance: 10000,
        openingBalanceDate: '2026-04-01',
        currentBalance: 10000,
        isDefault: true,
        isActive: true,
        createdAt: '2026-04-01',
        updatedAt: '2026-04-01'
      };

      // Attempt transfer of 15,000 without overdraft
      const invalidTransfer = validateFundTransfer({
        sourceAccountId: 'bank_01',
        sourceAccountType: 'bank',
        sourceAccount: bankCurrent,
        destinationAccountId: 'cash_01',
        destinationAccountType: 'cash',
        amount: 15000
      });
      assert.strictEqual(invalidTransfer.valid, false, 'Should fail without sufficient balance');

      // Now with overdraft limit of 10,000 (total available = 20,000)
      const bankOverdraft: BankAccount = {
        ...bankCurrent,
        accountType: 'overdraft',
        overdraftLimit: 10000
      };

      const validTransfer = validateFundTransfer({
        sourceAccountId: 'bank_01',
        sourceAccountType: 'bank',
        sourceAccount: bankOverdraft,
        destinationAccountId: 'cash_01',
        destinationAccountType: 'cash',
        amount: 15000
      });
      assert.strictEqual(validTransfer.valid, true, 'Should succeed with overdraft protection');
    });

    it('3.3 should reject fund transfer when source and destination are the same account', () => {
      const bank: BankAccount = { ...DEFAULT_BANK_ACCOUNTS[0], currentBalance: 50000 };
      const res = validateFundTransfer({
        sourceAccountId: bank.id,
        sourceAccountType: 'bank',
        sourceAccount: bank,
        destinationAccountId: bank.id,
        destinationAccountType: 'bank',
        amount: 5000
      });
      assert.strictEqual(res.valid, false);
      assert.match(res.error || '', /cannot be the same/i);
    });

    it('3.4 should create balanced Contra journal for Cash Deposit to Bank', () => {
      const transfer: FundTransfer = {
        id: 'trf_01',
        businessId: 'biz_01',
        transferNumber: 'TRF-001',
        date: '2026-11-21',
        sourceAccountId: 'cash_main_01',
        sourceAccountType: 'cash',
        destinationAccountId: 'bank_hdfc_01',
        destinationAccountType: 'bank',
        amount: 18000,
        transferMode: 'cash_deposit',
        status: 'completed',
        createdAt: '2026-11-21'
      };

      const journal = createFundTransferJournalEntry(transfer, accounts, 'Main Cash', 'HDFC Bank');
      const val = validateJournalEntry(journal);
      assert.strictEqual(val.valid, true);

      // Contra: Dr Destination Bank (1020), Cr Source Cash (1010)
      const drLine = journal.lines.find(l => l.debit > 0);
      const crLine = journal.lines.find(l => l.credit > 0);
      assert.strictEqual(drLine?.accountCode, '1020');
      assert.strictEqual(crLine?.accountCode, '1010');
      assert.strictEqual(drLine?.debit, 18000);
      assert.strictEqual(crLine?.credit, 18000);
    });
  });

  // --------------------------------------------------------------------------
  // 4. CHEQUE MANAGEMENT & BOUNCE HANDLING
  // --------------------------------------------------------------------------
  describe('4. Cheque Lifecycle & Bounced Cheque Accounting', () => {

    it('4.1 should validate legal cheque state transitions', () => {
      assert.strictEqual(canTransitionChequeStatus('received', 'deposited'), true);
      assert.strictEqual(canTransitionChequeStatus('deposited', 'cleared'), true);
      assert.strictEqual(canTransitionChequeStatus('deposited', 'bounced'), true);
      assert.strictEqual(canTransitionChequeStatus('cleared', 'deposited'), false, 'Cannot re-deposit cleared cheque');
      assert.strictEqual(canTransitionChequeStatus('bounced', 'cleared'), false, 'Cannot directly clear bounced cheque');
    });

    it('4.2 should process cheque bounce, reinstating AR and posting bank charges', () => {
      const cheque: ChequeRecord = {
        id: 'chq_bounce_01',
        businessId: 'biz_01',
        chequeNumber: '000123',
        chequeDate: '2026-11-10',
        partyId: 'cust_01',
        partyName: 'Apex Enterprises',
        amount: 30000,
        bankName: 'ICICI Bank',
        bankAccountId: 'bank_01',
        chequeType: 'received',
        status: 'deposited',
        createdAt: '2026-11-10',
        updatedAt: '2026-11-10'
      };

      const bounceJournal = createChequeBounceJournalEntry(
        cheque,
        accounts,
        'ICICI Bank',
        350 // ₹350 bank bounce penalty
      );

      const val = validateJournalEntry(bounceJournal);
      assert.strictEqual(val.valid, true);

      // Lines should:
      // Dr Accounts Receivable (1200) - 30,000 (reinstates debt)
      // Dr Bank Charges Expense (6090) - 350 (penalty charge)
      // Cr Bank (1020) - 30,350 (deducted from bank)
      const arLine = bounceJournal.lines.find(l => l.accountCode === '1200');
      const chargesLine = bounceJournal.lines.find(l => l.accountCode === '6090');
      const totalBankCredit = bounceJournal.lines.filter(l => l.accountCode === '1020').reduce((s, l) => s + l.credit, 0);

      assert.strictEqual(arLine?.debit, 30000);
      assert.strictEqual(chargesLine?.debit, 350);
      assert.strictEqual(totalBankCredit, 30350);
    });
  });

  // --------------------------------------------------------------------------
  // 5. BANK STATEMENT IMPORT & RECONCILIATION
  // --------------------------------------------------------------------------
  describe('5. Bank Statement Import & Reconciliation (BRS)', () => {

    it('5.1 should parse CSV bank statements and filter duplicate lines', () => {
      const csvData = `Date,Description,Reference,Debit,Credit,Balance
2026-11-01,Opening Balance,,0,0,50000.00
2026-11-05,NEFT CR FROM RELIANCE,UTR11223344,,25000.00,75000.00
2026-11-10,CHQ PAID TO INFOSYS,CHQ000451,15000.00,,60000.00
2026-11-12,BANK CHARGES,CHG001,250.00,,59750.00`;

      const rows = parseCSVStatement(csvData);
      assert.strictEqual(rows.length >= 3, true);

      const importResult1 = buildStatementImport({
        bankAccountId: 'bank_01',
        fileName: 'hdfc_nov_statement.csv',
        fileType: 'csv',
        rawRows: rows,
        existingLines: []
      });

      assert.strictEqual(importResult1.statementLines.length >= 3, true);
      assert.strictEqual(importResult1.importRecord.duplicateRowsCount, 0);

      // Re-importing same lines should detect 100% duplicates
      const importResult2 = buildStatementImport({
        bankAccountId: 'bank_01',
        fileName: 'hdfc_nov_statement_reimport.csv',
        fileType: 'csv',
        rawRows: rows,
        existingLines: importResult1.statementLines
      });

      assert.strictEqual(importResult2.statementLines.length, 0);
      assert.strictEqual(importResult2.importRecord.duplicateRowsCount, importResult1.statementLines.length);
    });

    it('5.2 should verify mathematical BRS equation and identify reconciliation differences', () => {
      const statementLines: BankStatementLine[] = [
        {
          id: 'sl_01',
          businessId: 'biz_01',
          statementId: 'stmt_01',
          bankAccountId: 'bank_01',
          transactionDate: '2026-11-05',
          description: 'Customer RTGS',
          depositAmount: 50000,
          isReconciled: true,
          rowChecksum: 'c1'
        }
      ];

      const cheques: ChequeRecord[] = [
        {
          id: 'chq_unpresented',
          businessId: 'biz_01',
          chequeNumber: '99001',
          chequeDate: '2026-11-20',
          partyId: 'supp_01',
          partyName: 'Supplier A',
          amount: 12000,
          bankName: 'HDFC',
          bankAccountId: 'bank_01',
          chequeType: 'issued',
          status: 'issued', // Not cleared yet by bank
          createdAt: '2026-11-20',
          updatedAt: '2026-11-20'
        },
        {
          id: 'chq_uncredited',
          businessId: 'biz_01',
          chequeNumber: '88001',
          chequeDate: '2026-11-21',
          partyId: 'cust_01',
          partyName: 'Customer B',
          amount: 8000,
          bankName: 'HDFC',
          bankAccountId: 'bank_01',
          chequeType: 'received',
          status: 'deposited', // Deposited but not credited by bank yet
          createdAt: '2026-11-21',
          updatedAt: '2026-11-21'
        }
      ];

      // Book balance: 46,000
      // Bank statement closing balance: 50,000
      // Unpresented cheques (+12,000)
      // Uncredited deposits (-8,000)
      // Reconciled balance = 50,000 + 12,000 - 8,000 = 54,000
      // Difference = 54,000 - 46,000 = 8,000
      const rec = computeReconciliationSummary({
        bankAccountId: 'bank_01',
        statementClosingBalance: 50000,
        bankStatementLines: statementLines,
        chequeRecords: cheques,
        journalEntries: [
          {
            id: 'je_book',
            entryNumber: 'JE-001',
            date: '2026-11-01',
            sourceType: 'opening_balance',
            description: 'Opening Bank Bal',
            isSystemGenerated: true,
            status: 'posted',
            createdAt: '2026-11-01',
            lines: [
              { id: 'l1', entryId: 'je_book', accountId: '1020', accountCode: '1020', accountName: 'Bank', debit: 46000, credit: 0 }
            ]
          }
        ]
      });

      assert.strictEqual(rec.bookClosingBalance, 46000);
      assert.strictEqual(rec.unpresentedChequesAmount, 12000);
      assert.strictEqual(rec.uncreditedDepositsAmount, 8000);
      assert.strictEqual(rec.reconciledBalance, 54000);
      assert.strictEqual(rec.difference, 8000);
      assert.strictEqual(rec.isBalanced, false);
    });
  });

  // --------------------------------------------------------------------------
  // 6. CASHBOOK & BANKBOOK REGISTERS
  // --------------------------------------------------------------------------
  describe('6. Cashbook & Bankbook Registers', () => {

    it('6.1 should generate chronological register report with running balances', () => {
      const journals: JournalEntry[] = [
        {
          id: 'j1',
          entryNumber: 'JE-001',
          date: '2026-11-02',
          sourceType: 'receipt',
          description: 'Customer payment received',
          isSystemGenerated: true,
          status: 'posted',
          createdAt: '2026-11-02',
          lines: [
            { id: 'l1', entryId: 'j1', accountId: '1020', accountCode: '1020', accountName: 'HDFC Bank', debit: 20000, credit: 0 },
            { id: 'l2', entryId: 'j1', accountId: '1030', accountCode: '1030', accountName: 'AR', debit: 0, credit: 20000 }
          ]
        },
        {
          id: 'j2',
          entryNumber: 'JE-002',
          date: '2026-11-05',
          sourceType: 'payment',
          description: 'Supplier payment',
          isSystemGenerated: true,
          status: 'posted',
          createdAt: '2026-11-05',
          lines: [
            { id: 'l3', entryId: 'j2', accountId: '2010', accountCode: '2010', accountName: 'AP', debit: 5000, credit: 0 },
            { id: 'l4', entryId: 'j2', accountId: '1020', accountCode: '1020', accountName: 'HDFC Bank', debit: 0, credit: 5000 }
          ]
        }
      ];

      const report = generateCashBankBookReport({
        accountId: 'bank_hdfc_01',
        accountType: 'bank',
        accountName: 'HDFC Current Account',
        fromDate: '2026-11-01',
        toDate: '2026-11-30',
        openingBalance: 10000,
        journalEntries: journals
      });

      assert.strictEqual(report.openingBalance, 10000);
      assert.strictEqual(report.totalDebits, 20000);
      assert.strictEqual(report.totalCredits, 5000);
      assert.strictEqual(report.closingBalance, 25000);
      assert.strictEqual(report.transactions.length, 2);

      // Verify running balance at each row
      assert.strictEqual(report.transactions?.[0].runningBalance, 30000); // 10k + 20k
      assert.strictEqual(report.transactions?.[1].runningBalance, 25000); // 30k - 5k

      // Verify CSV export string
      const csv = exportCashBankBookCSV(report);
      assert.strictEqual(csv.includes('HDFC Current Account'), true);
      assert.strictEqual(csv.includes('Running Balance'), true);
    });
  });

  // --------------------------------------------------------------------------
  // 7. RECEIVABLES & PAYABLES AGEING ANALYSIS
  // --------------------------------------------------------------------------
  describe('7. Receivables & Payables Ageing Analysis', () => {

    it('7.1 should compute overdue days and bucket amounts accurately', () => {
      // Due today -> 0 days overdue -> notDue
      const days0 = calculateDaysOverdue('2026-11-21', '2026-11-21');
      assert.strictEqual(days0, 0);

      // Due 15 days ago -> 15 days overdue -> days1_30
      const days15 = calculateDaysOverdue('2026-11-06', '2026-11-21');
      assert.strictEqual(days15, 15);

      // Due 45 days ago -> 45 days overdue -> days31_60
      const days45 = calculateDaysOverdue('2026-10-07', '2026-11-21');
      assert.strictEqual(days45, 45);

      // Due 75 days ago -> 75 days overdue -> days61_90
      const days75 = calculateDaysOverdue('2026-09-07', '2026-11-21');
      assert.strictEqual(days75, 75);

      // Due 100 days ago -> 100 days overdue -> above90
      const days100 = calculateDaysOverdue('2026-08-13', '2026-11-21');
      assert.strictEqual(days100, 100);
    });

    it('7.2 should generate polite, professional payment reminder messages for WhatsApp/SMS', () => {
      const msg = generatePaymentReminderText({
        partyName: 'Sharma Traders',
        amountDue: 45000,
        oldestInvoiceDate: '2026-10-15',
        businessName: 'Invoice Pro Enterprise'
      });

      assert.strictEqual(msg.includes('Sharma Traders'), true);
      assert.strictEqual(msg.includes('45,000'), true);
      assert.strictEqual(msg.includes('Invoice Pro Enterprise'), true);
    });
  });

  // --------------------------------------------------------------------------
  // 8. DOUBLE-ENTRY GLOBAL INVARIANTS
  // --------------------------------------------------------------------------
  describe('8. Double-Entry Accounting Invariants', () => {
    
    it('8.1 ensures sum of all debits equals sum of all credits across all generated vouchers', () => {
      const testJournals: JournalEntry[] = [];

      // 1. Receipt
      testJournals.push(createPaymentInJournalEntry({
        id: 'v1',
        voucherNumber: 'R1',
        voucherType: 'receipt',
        type: 'payment_in',
        date: '2026-11-21',
        amount: 15000,
        paymentMode: 'bank_transfer',
        status: 'posted'
      }, accounts));

      // 2. Payment Out (Expense)
      testJournals.push(createPaymentOutJournalEntry({
        id: 'v2',
        voucherNumber: 'P1',
        voucherType: 'payment',
        type: 'payment_out',
        category: 'expense_payment',
        date: '2026-11-21',
        amount: 8000,
        paymentMode: 'cash',
        status: 'posted'
      }, accounts));

      // 3. Fund Transfer (Contra)
      testJournals.push(createFundTransferJournalEntry({
        id: 'v3',
        businessId: 'biz_1',
        transferNumber: 'T1',
        date: '2026-11-21',
        sourceAccountId: 'cash_01',
        sourceAccountType: 'cash',
        destinationAccountId: 'bank_01',
        destinationAccountType: 'bank',
        amount: 12000,
        transferMode: 'cash_deposit',
        status: 'completed',
        createdAt: '2026-11-21'
      }, accounts, 'Main Cash', 'HDFC Bank'));

      // Verify every single journal entry individually
      for (const j of testJournals) {
        const val = validateJournalEntry(j);
        assert.strictEqual(val.valid, true, `Journal ${j.entryNumber} must be perfectly balanced`);
      }

      // Verify cumulative debits == cumulative credits
      let totalDr = 0;
      let totalCr = 0;
      for (const j of testJournals) {
        for (const l of j.lines) {
          totalDr = safeAdd(totalDr, l.debit);
          totalCr = safeAdd(totalCr, l.credit);
        }
      }

      assert.strictEqual(totalDr, totalCr, `Total Dr (${totalDr}) must equal Total Cr (${totalCr})`);
      assert.strictEqual(totalDr, 35000); // 15,000 + 8,000 + 12,000
    });
  });

});
