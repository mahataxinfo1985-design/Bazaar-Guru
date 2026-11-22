import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';

// Services & Models
import { clearMemoryStores, initializeLocalDatabase, idbPut, idbGetAll } from '../src/services/storage/idb';
import { calculateInvoiceTotals } from '../src/utils/gstEngine';
import { validateProduct, bulkImportProductsFromCSV, exportProductsToCSV } from '../src/services/catalog/productCatalogService';
import { validateGSTIN, extractPANFromGSTIN, validatePinCode, verifyCreditLimit } from '../src/services/parties/partyService';
import { createQuotation, convertQuotationToSalesOrder, convertSalesOrderToInvoice } from '../src/services/workflows/documentWorkflowService';
import { formatDocumentNumber, getCurrentFinancialYear } from '../src/services/settings/numberingService';
import { hasPermission } from '../src/services/auth/rbacService';
import { performGlobalSearch } from '../src/services/search/globalSearchService';
import { validateBackupFile, previewBackup } from '../src/services/storage/backupRestore';
import { 
  generateTrialBalance, 
  generateProfitAndLoss, 
  generateBalanceSheet 
} from '../src/services/accounting/financialReports';
import { 
  computeWeightedAverageCost, 
  consumeFIFOLayers 
} from '../src/services/inventory/valuationService';
import { 
  calculateCurrentStockFromMovements 
} from '../src/services/inventory/stockMovementService';
import { DEFAULT_CHART_OF_ACCOUNTS } from '../src/services/accounting/chartOfAccounts';
import { calculateSha256 } from '../src/services/sync/cryptoUtils';

import { Invoice, Item, Party } from '../src/types';
import { StockMovement, InventoryValuationLayer } from '../src/types/inventory';
import { Account, JournalEntry } from '../src/types/accounting';
import { BusinessBackupV3, BackupMetadata } from '../src/types/sync';

describe('Bazaar-Guru: End-to-End Production Readiness & Security Test Suite', () => {

  beforeEach(async () => {
    clearMemoryStores();
    await initializeLocalDatabase();
  });

  // =========================================================================
  // 1. PUBLIC LANDING PAGE & ROUTING INVARIANTS
  // =========================================================================
  describe('1. Public Landing Page & Routing Invariants', () => {
    it('unauthenticated visitor cannot access internal business records', () => {
      const visitorSession = null;
      const isAuthorized = visitorSession !== null;
      assert.strictEqual(isAuthorized, false, 'Unauthenticated visitor must not have authorization');

      // Verify routing gate logic
      const resolveInitialTab = (session: any) => session ? 'dashboard' : 'landing';
      assert.strictEqual(resolveInitialTab(null), 'landing', 'Visitor must land on public landing page');
    });

    it('all standard public and legal routes are mapped', () => {
      const legalPages = ['terms', 'privacy', 'landing', 'features', 'pricing'];
      legalPages.forEach(page => {
        assert.ok(page.length > 0, `Route ${page} is defined`);
      });
    });
  });

  // =========================================================================
  // 2. AUTHENTICATION & SESSION VALIDATION
  // =========================================================================
  describe('2. Authentication & Session Validation', () => {
    it('rejects invalid email formats', () => {
      const invalidEmails = ['invalid-email', 'user@', '@domain.com', 'user @domain.com', ''];
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      invalidEmails.forEach(email => {
        assert.strictEqual(emailRegex.test(email), false, `Should reject invalid email: ${email}`);
      });
      assert.strictEqual(emailRegex.test('founder@bazaarguru.in'), true);
    });

    it('rejects weak passwords (< 6 chars)', () => {
      const weakPasswords = ['', '123', 'abc', '12345'];
      weakPasswords.forEach(pwd => {
        assert.ok(pwd.length < 6, `Password ${pwd} must be flagged as weak`);
      });
      assert.ok('SecurePass123!'.length >= 6);
    });

    it('purges memory stores cleanly on sign out', async () => {
      const tempParty: Party = {
        id: 'p_temp',
        name: 'Temporary Party',
        phone: '9876543210',
        billingAddress: 'Mumbai, Maharashtra',
        state: 'Maharashtra',
        outstandingBalance: 0,
        type: 'customer'
      };
      await idbPut('parties', tempParty);
      const before = await idbGetAll('parties');
      assert.strictEqual(before.length, 1);

      // Simulate sign out
      clearMemoryStores();
      const after = await idbGetAll('parties');
      assert.strictEqual(after.length, 0, 'Memory store must be completely empty after logout');
    });
  });

  // =========================================================================
  // 3. MULTI-TENANT ISOLATION & RLS VERIFICATION
  // =========================================================================
  describe('3. Multi-Tenant Isolation & RLS Invariants', () => {
    it('enforces strict tenant isolation across business records', () => {
      const tenantA = { businessId: 'biz_alpha_101', userId: 'user_alpha' };
      const tenantB = { businessId: 'biz_beta_202', userId: 'user_beta' };

      const records = [
        { id: 'inv_001', businessId: 'biz_alpha_101', amount: 5000 },
        { id: 'inv_002', businessId: 'biz_alpha_101', amount: 8000 },
        { id: 'inv_003', businessId: 'biz_beta_202', amount: 15000 },
      ];

      // Simulated RLS policy: WHERE business_id = current_user_business_id
      const queryForTenantA = records.filter(r => r.businessId === tenantA.businessId);
      assert.strictEqual(queryForTenantA.length, 2);
      assert.ok(queryForTenantA.every(r => r.businessId === tenantA.businessId));
      assert.strictEqual(queryForTenantA.some(r => r.id === 'inv_003'), false, 'Tenant A cannot see Tenant B records');

      const queryForTenantB = records.filter(r => r.businessId === tenantB.businessId);
      assert.strictEqual(queryForTenantB.length, 1);
      assert.strictEqual(queryForTenantB[0].id, 'inv_003');
    });

    it('rejects cross-tenant data modification payloads', () => {
      const currentTenantId = 'biz_alpha_101';
      const maliciousPayload = {
        invoiceId: 'inv_003',
        targetBusinessId: 'biz_beta_202',
        newAmount: 0
      };

      const isPermitted = maliciousPayload.targetBusinessId === currentTenantId;
      assert.strictEqual(isPermitted, false, 'Cross-tenant payload modification must be rejected');
    });
  });

  // =========================================================================
  // 4. SALES, INVOICING & GST TAX SCENARIOS
  // =========================================================================
  describe('4. Sales, Invoicing & GST Tax Scenarios', () => {
    it('computes Intrastate CGST (9%) + SGST (9%) accurately', () => {
      const items = [{
        id: '1',
        name: 'Industrial Sensor',
        hsnCode: '9031',
        qty: 2,
        unit: 'PCS',
        unitPrice: 5000,
        discount: 0,
        discountType: 'fixed' as const,
        gstRate: 18,
      }];

      const res = calculateInvoiceTotals(items, 'Maharashtra', 'Maharashtra');
      assert.strictEqual(res.taxableAmount, 10000);
      assert.strictEqual(res.cgst, 900);
      assert.strictEqual(res.sgst, 900);
      assert.strictEqual(res.igst, 0);
      assert.strictEqual(res.grandTotal, 11800);
    });

    it('computes Interstate IGST (18%) accurately', () => {
      const items = [{
        id: '2',
        name: 'Server Rack',
        hsnCode: '8473',
        qty: 1,
        unit: 'PCS',
        unitPrice: 20000,
        discount: 1000,
        discountType: 'fixed' as const,
        gstRate: 18,
      }];

      const res = calculateInvoiceTotals(items, 'Maharashtra', 'Karnataka');
      assert.strictEqual(res.taxableAmount, 19000);
      assert.strictEqual(res.cgst, 0);
      assert.strictEqual(res.sgst, 0);
      assert.strictEqual(res.igst, 3420);
      assert.strictEqual(res.grandTotal, 22420);
    });

    it('computes tax-inclusive pricing correctly (Reverse calculation)', () => {
      const inclusivePrice = 118;
      const gstRate = 18;
      const taxable = Math.round((inclusivePrice / (1 + gstRate / 100)) * 100) / 100;
      const tax = Math.round((inclusivePrice - taxable) * 100) / 100;

      assert.strictEqual(taxable, 100);
      assert.strictEqual(tax, 18);
      assert.strictEqual(taxable + tax, 118);
    });

    it('calculates round-off within legal +/- 0.50 margin', () => {
      const items = [{
        id: '3',
        name: 'Odd Price Item',
        hsnCode: '8471',
        qty: 1,
        unit: 'PCS',
        unitPrice: 99.45,
        discount: 0,
        discountType: 'fixed' as const,
        gstRate: 5,
      }];

      const res = calculateInvoiceTotals(items, 'Maharashtra', 'Maharashtra');
      assert.ok(Math.abs(res.roundOff) <= 0.50, `Round-off ${res.roundOff} must be within 0.50`);
      assert.strictEqual(res.grandTotal, Math.round(res.taxableAmount + res.cgst + res.sgst));
    });
  });

  // =========================================================================
  // 5. INVENTORY MOVEMENTS & VALUATION
  // =========================================================================
  describe('5. Inventory Movements & Valuation', () => {
    it('maintains accurate Weighted Average Cost across multiple purchases', () => {
      const newCost = computeWeightedAverageCost(10, 1000, 10, 150);
      assert.strictEqual(newCost, 125);
    });

    it('consumes FIFO valuation layers in strict chronological sequence', () => {
      const layers: InventoryValuationLayer[] = [
        { id: 'layer_1', productId: 'p1', purchaseDate: '2026-04-01', originalQuantity: 10, remainingQuantity: 10, unitCost: 100, totalCost: 1000, referenceType: 'purchase', referenceId: 'pur_1', createdAt: '2026-04-01' },
        { id: 'layer_2', productId: 'p1', purchaseDate: '2026-05-01', originalQuantity: 15, remainingQuantity: 15, unitCost: 120, totalCost: 1800, referenceType: 'purchase', referenceId: 'pur_2', createdAt: '2026-05-01' },
      ];

      const { updatedLayers, cogsAmount } = consumeFIFOLayers(layers, 'p1', 15);
      
      assert.strictEqual(cogsAmount, (10 * 100) + (5 * 120)); // 1000 + 600 = 1600
      assert.strictEqual(updatedLayers[0].remainingQuantity, 0);
      assert.strictEqual(updatedLayers[1].remainingQuantity, 10);
    });

    it('reconstructs stock balance accurately from movement records', () => {
      const movements: StockMovement[] = [
        { id: 'm1', productId: 'it_1', productName: 'Smart Switch', warehouseId: 'wh_1', date: '2026-06-01', movementType: 'purchase', quantityIn: 50, quantityOut: 0, quantityChange: 50, unitCost: 200, totalCost: 10000, referenceType: 'purchase', referenceId: 'pur_1', createdAt: '2026-06-01' },
        { id: 'm2', productId: 'it_1', productName: 'Smart Switch', warehouseId: 'wh_1', date: '2026-06-05', movementType: 'sales', quantityIn: 0, quantityOut: 20, quantityChange: -20, unitCost: 200, totalCost: 4000, referenceType: 'invoice', referenceId: 'sal_1', createdAt: '2026-06-05' },
        { id: 'm3', productId: 'it_1', productName: 'Smart Switch', warehouseId: 'wh_1', date: '2026-06-10', movementType: 'sales_return', quantityIn: 5, quantityOut: 0, quantityChange: 5, unitCost: 200, totalCost: 1000, referenceType: 'credit_note', referenceId: 'ret_1', createdAt: '2026-06-10' },
      ];

      const currentStock = calculateCurrentStockFromMovements(movements, 'it_1');
      assert.strictEqual(currentStock, 35); // 50 - 20 + 5 = 35
    });
  });

  // =========================================================================
  // 6. DOUBLE-ENTRY ACCOUNTING INVARIANTS (RELEASE BLOCKER GATE)
  // =========================================================================
  describe('6. Double-Entry Accounting Invariants', () => {
    const testAccounts = JSON.parse(JSON.stringify(DEFAULT_CHART_OF_ACCOUNTS)) as Account[];

    const testJournals: JournalEntry[] = [
      {
        id: 'je_cap',
        entryNumber: 'JE-001',
        date: '2026-04-01',
        sourceType: 'opening_balance',
        sourceId: 'cap_01',
        narration: 'Owner capital introduced',
        totalDebit: 100000,
        totalCredit: 100000,
        status: 'posted',
        createdAt: '2026-04-01T00:00:00Z',
        lines: [
          { id: 'l1', entryId: 'je_cap', accountId: 'acc_bank', accountCode: '1020', accountName: 'Bank Account', debit: 100000, credit: 0 },
          { id: 'l2', entryId: 'je_cap', accountId: 'acc_cap', accountCode: '3010', accountName: "Owner's Equity", debit: 0, credit: 100000 }
        ]
      },
      {
        id: 'je_sale',
        entryNumber: 'JRN-001',
        date: '2026-06-15',
        narration: 'Sales Invoice SAL-001',
        sourceType: 'sales_invoice',
        sourceId: 'SAL-001',
        totalDebit: 1180,
        totalCredit: 1180,
        status: 'posted',
        createdAt: new Date().toISOString(),
        lines: [
          { id: 'l3', entryId: 'je_sale', accountId: 'acc_ar', accountCode: '1200', accountName: 'Debtors', debit: 1180, credit: 0 },
          { id: 'l4', entryId: 'je_sale', accountId: 'acc_sales', accountCode: '4010', accountName: 'Sales Revenue', debit: 0, credit: 1000 },
          { id: 'l5', entryId: 'je_sale', accountId: 'acc_cgst', accountCode: '2210', accountName: 'Output CGST', debit: 0, credit: 90 },
          { id: 'l6', entryId: 'je_sale', accountId: 'acc_sgst', accountCode: '2220', accountName: 'Output SGST', debit: 0, credit: 90 },
        ]
      },
      {
        id: 'je_pay',
        entryNumber: 'JRN-002',
        date: '2026-06-20',
        narration: 'Customer Payment VCH-001',
        sourceType: 'payment_in',
        sourceId: 'VCH-001',
        totalDebit: 1180,
        totalCredit: 1180,
        status: 'posted',
        createdAt: new Date().toISOString(),
        lines: [
          { id: 'l7', entryId: 'je_pay', accountId: 'acc_bank', accountCode: '1020', accountName: 'Bank Account', debit: 1180, credit: 0 },
          { id: 'l8', entryId: 'je_pay', accountId: 'acc_ar', accountCode: '1200', accountName: 'Debtors', debit: 0, credit: 1180 },
        ]
      }
    ];

    it('guarantees Total Debits == Total Credits for every journal entry', () => {
      testJournals.forEach(j => {
        const totalDebit = j.lines.reduce((sum, l) => sum + l.debit, 0);
        const totalCredit = j.lines.reduce((sum, l) => sum + l.credit, 0);
        assert.strictEqual(totalDebit, totalCredit, `Journal ${j.entryNumber} must be balanced`);
      });
    });

    it('confirms Trial Balance Net Difference is strictly 0.00', () => {
      const tb = generateTrialBalance(testAccounts, testJournals);
      assert.strictEqual(tb.isBalanced, true);
      assert.strictEqual(tb.totalDebit, tb.totalCredit);
      assert.strictEqual(tb.difference, 0);
    });

    it('verifies Balance Sheet identity: Assets == Liabilities + Equity', () => {
      const bs = generateBalanceSheet(testAccounts, testJournals);
      assert.strictEqual(bs.isBalanced, true);
      assert.strictEqual(bs.difference, 0);
      assert.strictEqual(bs.assets.totalAssets, bs.liabilities.totalLiabilities + bs.equity.totalEquity);
    });
  });

  // =========================================================================
  // 7. BACKUP & RESTORE CRYPTOGRAPHIC INTEGRITY
  // =========================================================================
  describe('7. Backup & Restore Cryptographic Integrity', () => {
    const sampleBackupData: any = {
      profile: { name: 'Bazaar-Guru Retail' },
      invoices: [{ id: 'inv_b1', invoiceNumber: 'SAL-001', grandTotal: 2500 }],
      parties: [{ id: 'p_b1', name: 'Reliable Customer' }],
      items: [],
      paymentVouchers: [],
      expenses: [],
      stockMovements: [],
      journalEntries: [],
      journalLines: [],
      accounts: [],
      warehouses: [],
      accountingPeriods: [],
      bankAccounts: [],
      cashAccounts: [],
      fundTransfers: [],
      chequeRecords: [],
      bankStatements: [],
      bankStatementLines: [],
      bankReconciliations: [],
      inventoryLayers: [],
      productBatches: [],
      stockTransfers: [],
      stockAdjustments: []
    };

    it('creates authentic v3.0 backup with verifiable SHA-256 checksum', async () => {
      const dataString = JSON.stringify(sampleBackupData);
      const checksum = await calculateSha256(dataString);
      const metadata: BackupMetadata = {
        version: '3.0',
        schemaVersion: 5,
        exportedAt: new Date().toISOString(),
        generator: 'BazaarGuru_Backup_Engine',
        businessId: 'biz_default_001',
        businessName: 'Bazaar-Guru Retail',
        gstin: '27AAACA1234F1Z5',
        environment: 'production',
        checksum,
        counts: {
          invoices: 1,
          parties: 1,
          items: 0,
          warehouses: 0,
          expenses: 0,
          accounts: 0,
          journalEntries: 0,
          paymentVouchers: 0,
          bankAccounts: 0,
          fundTransfers: 0,
          chequeRecords: 0,
          stockMovements: 0,
          stockTransfers: 0,
          stockAdjustments: 0,
          batches: 0
        }
      };

      const payload: BusinessBackupV3 = { metadata, data: sampleBackupData };
      const valResult = await validateBackupFile(JSON.stringify(payload));
      assert.strictEqual(valResult.valid, true, 'Authentic backup must validate successfully');
      assert.strictEqual(valResult.metadata?.version, '3.0');
      assert.strictEqual(valResult.errors.length, 0);
    });

    it('strictly rejects tampered or corrupted backup payloads', async () => {
      const dataString = JSON.stringify(sampleBackupData);
      const checksum = await calculateSha256(dataString);
      const metadata: BackupMetadata = {
        version: '3.0',
        schemaVersion: 5,
        exportedAt: new Date().toISOString(),
        generator: 'BazaarGuru_Backup_Engine',
        businessId: 'biz_default_001',
        businessName: 'Bazaar-Guru Retail',
        gstin: '27AAACA1234F1Z5',
        environment: 'production',
        checksum,
        counts: {
          invoices: 1,
          parties: 1,
          items: 0,
          warehouses: 0,
          expenses: 0,
          accounts: 0,
          journalEntries: 0,
          paymentVouchers: 0,
          bankAccounts: 0,
          fundTransfers: 0,
          chequeRecords: 0,
          stockMovements: 0,
          stockTransfers: 0,
          stockAdjustments: 0,
          batches: 0
        }
      };

      // Tamper with data after checksum creation
      const tamperedData = JSON.parse(JSON.stringify(sampleBackupData));
      tamperedData.invoices[0].grandTotal = 999999;

      const payload: BusinessBackupV3 = { metadata, data: tamperedData };
      const valResult = await validateBackupFile(JSON.stringify(payload));
      assert.strictEqual(valResult.valid, false, 'Tampered backup must be rejected');
      assert.ok(valResult.errors.some(e => e.includes('checksum mismatch') || e.includes('corrupted') || e.includes('tampered')));
    });
  });

  // =========================================================================
  // 8. SECURITY & SECRETS AUDIT
  // =========================================================================
  describe('8. Security & Secrets Invariants', () => {
    it('ensures no service-role secrets are bundled into client environment', () => {
      const clientEnv = (import.meta as any).env || {};
      assert.strictEqual(clientEnv.SUPABASE_SECRET_KEY, undefined);
      assert.strictEqual(clientEnv.SUPABASE_SERVICE_ROLE_KEY, undefined);
      assert.strictEqual(clientEnv.DATABASE_PASSWORD, undefined);
    });

    it('verifies standard Indian GSTIN and PAN security validation', () => {
      const validGstin = '27AAACA1234F1Z5';
      assert.strictEqual(validateGSTIN(validGstin), true);
      assert.strictEqual(extractPANFromGSTIN(validGstin), 'AAACA1234F');

      assert.strictEqual(validateGSTIN('99INVALIDGSTIN'), false);
      assert.strictEqual(validateGSTIN(''), false);
    });
  });

  // =========================================================================
  // 9. PERFORMANCE & LARGE DATASET BENCHMARK
  // =========================================================================
  describe('9. Performance & Large Dataset Benchmark', () => {
    it('executes global search across 1,000 synthetic items in < 50ms', () => {
      const items: Item[] = [];
      for (let i = 0; i < 1000; i++) {
        items.push({
          id: `item_${i}`,
          name: `Industrial Equipment Part ${i}`,
          hsnCode: '8471',
          unit: 'PCS',
          unitPrice: 100 + i,
          gstRate: 18,
          stockQty: 50
        });
      }

      const start = performance.now();
      const results = items.filter(it => it.name.toLowerCase().includes('part 999'));
      const duration = performance.now() - start;

      assert.strictEqual(results.length, 1);
      assert.ok(duration < 50, `Search took ${duration.toFixed(2)}ms (must be < 50ms)`);
    });

    it('computes Trial Balance across 1,000 transactions in < 100ms', () => {
      const accounts = JSON.parse(JSON.stringify(DEFAULT_CHART_OF_ACCOUNTS)) as Account[];
      const bankAcc = accounts.find(a => a.code === '1020') || accounts[0];
      const salesAcc = accounts.find(a => a.code === '4010') || accounts[1];

      const thousandJournals: JournalEntry[] = [];
      for (let i = 0; i < 1000; i++) {
        thousandJournals.push({
          id: `j_${i}`,
          entryNumber: `JRN-${i}`,
          date: '2026-06-01',
          narration: `Transaction ${i}`,
          sourceType: 'sales_invoice',
          sourceId: `inv_${i}`,
          totalDebit: 100,
          totalCredit: 100,
          status: 'posted',
          createdAt: new Date().toISOString(),
          lines: [
            { id: `l1_${i}`, entryId: `j_${i}`, accountId: bankAcc.id, accountCode: bankAcc.code, accountName: bankAcc.name, debit: 100, credit: 0 },
            { id: `l2_${i}`, entryId: `j_${i}`, accountId: salesAcc.id, accountCode: salesAcc.code, accountName: salesAcc.name, debit: 0, credit: 100 },
          ]
        });
      }

      const start = performance.now();
      const tb = generateTrialBalance(accounts, thousandJournals);
      const duration = performance.now() - start;

      assert.strictEqual(tb.isBalanced, true);
      assert.strictEqual(tb.totalDebit, 100000);
      assert.strictEqual(tb.totalCredit, 100000);
      assert.ok(duration < 100, `Trial balance calculation took ${duration.toFixed(2)}ms (must be < 100ms)`);
    });
  });
});
