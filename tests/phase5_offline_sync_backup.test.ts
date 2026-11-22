import { describe, it } from 'node:test';
import assert from 'node:assert';

// Phase 5 Types
import { 
  OutboxOperation, 
  SyncConflict, 
  SyncDevice, 
  BusinessBackupV3, 
  BackupMetadata 
} from '../src/types/sync';
import { Invoice, Party, Item, Expense, BusinessProfile } from '../src/types';
import { JournalEntry, PaymentVoucher, Account } from '../src/types/accounting';

// Phase 5 Services
import { calculateSha256 } from '../src/services/sync/cryptoUtils';
import { 
  generateIdempotencyKey, 
  calculateBackoffDelay, 
  isTemporaryOfflineId, 
  sortOperationsByDependency,
  remapTemporaryIdAcrossOutbox
} from '../src/services/sync/outboxEngine';
import { 
  buildFieldDifferences, 
  evaluateConcurrencyConflict, 
  isFinancialEntity, 
  safeMergeMasterData 
} from '../src/services/sync/conflictService';
import { 
  validateBackupFile, 
  previewBackup 
} from '../src/services/storage/backupRestore';
import { detectDeviceType } from '../src/services/sync/deviceService';

describe('Phase 5: Offline-First Architecture, Reliable Sync & Backup Engine', () => {

  // =========================================================================
  // 1. OUTBOX ENGINE & IDEMPOTENCY
  // =========================================================================
  describe('1. Outbox Engine, Idempotency & Backoff Scheduling', () => {
    it('should generate collision-resistant idempotency keys with entity prefix', () => {
      const key1 = generateIdempotencyKey('invoice', 'inv_1001');
      const key2 = generateIdempotencyKey('invoice', 'inv_1001');

      assert.ok(key1.startsWith('idemp_invoice_inv_1001_'));
      assert.notStrictEqual(key1, key2, 'Two idempotency keys generated for same entity must be unique');
    });

    it('should correctly identify temporary offline IDs vs official numbers', () => {
      assert.strictEqual(isTemporaryOfflineId('TEMP-INV-001'), true);
      assert.strictEqual(isTemporaryOfflineId('temp_voucher_99'), true);
      assert.strictEqual(isTemporaryOfflineId('offline_party_12'), true);
      assert.strictEqual(isTemporaryOfflineId('INV-2024-0001'), false);
      assert.strictEqual(isTemporaryOfflineId('pv_2024_0042'), false);
    });

    it('should calculate correct exponential backoff delays with caps', () => {
      assert.strictEqual(calculateBackoffDelay(0), 1000); // 1s
      assert.strictEqual(calculateBackoffDelay(1), 2000); // 2s
      assert.strictEqual(calculateBackoffDelay(2), 4000); // 4s
      assert.strictEqual(calculateBackoffDelay(3), 8000); // 8s
      assert.strictEqual(calculateBackoffDelay(4), 16000); // 16s
      assert.strictEqual(calculateBackoffDelay(5), 32000); // 32s
      // High retry should cap at 300,000ms (5 mins)
      assert.strictEqual(calculateBackoffDelay(12), 300000);
    });

    it('should topologically sort operations respecting dependencies over arrival order', () => {
      const opParty: OutboxOperation = {
        id: 'op_party_1',
        idempotencyKey: 'idemp_party_1',
        businessId: 'biz_1',
        deviceId: 'dev_1',
        entityType: 'party',
        entityId: 'cust_101',
        operationType: 'create',
        payload: { name: 'Acme Corp' },
        status: 'pending',
        retryCount: 0,
        maxRetries: 5,
        createdAt: '2026-11-20T10:05:00.000Z', // Created later
        updatedAt: '2026-11-20T10:05:00.000Z',
        localRevision: 1,
        schemaVersion: 5
      };

      const opInvoice: OutboxOperation = {
        id: 'op_inv_1',
        idempotencyKey: 'idemp_inv_1',
        businessId: 'biz_1',
        deviceId: 'dev_1',
        entityType: 'invoice',
        entityId: 'inv_201',
        operationType: 'create',
        payload: { partyId: 'cust_101', amount: 5000 },
        dependencies: ['op_party_1'], // Explicit dependency on op_party_1
        status: 'pending',
        retryCount: 0,
        maxRetries: 5,
        createdAt: '2026-11-20T10:00:00.000Z', // Created earlier
        updatedAt: '2026-11-20T10:00:00.000Z',
        localRevision: 1,
        schemaVersion: 5
      };

      // Even though opInvoice has earlier timestamp, opParty must be ordered first
      const readyOps = [opInvoice, opParty];
      const allOps = [opInvoice, opParty];
      const sorted = sortOperationsByDependency(readyOps, allOps);

      assert.strictEqual(sorted.length, 2);
      assert.strictEqual(sorted[0].id, 'op_party_1', 'Dependent party creation must precede invoice creation');
      assert.strictEqual(sorted[1].id, 'op_inv_1');
    });
  });

  // =========================================================================
  // 2. CONFLICT DETECTION & STRICT FINANCIAL INVARIANT
  // =========================================================================
  describe('2. Conflict Detection & Financial Transaction Protection', () => {
    it('should accurately detect field differences between local and server objects', () => {
      const local = { name: 'Acme Traders', phone: '9876543210', creditLimit: 50000, updatedAt: '2026-11-20' };
      const server = { name: 'Acme Traders LLP', phone: '9876543210', creditLimit: 75000, updatedAt: '2026-11-21' };

      const diffs = buildFieldDifferences(local, server);
      assert.strictEqual(diffs.length, 2);

      const nameDiff = diffs.find(d => d.field === 'name');
      assert.ok(nameDiff);
      assert.strictEqual(nameDiff.localValue, 'Acme Traders');
      assert.strictEqual(nameDiff.serverValue, 'Acme Traders LLP');

      const limitDiff = diffs.find(d => d.field === 'creditLimit');
      assert.ok(limitDiff);
      assert.strictEqual(limitDiff.localValue, 50000);
      assert.strictEqual(limitDiff.serverValue, 75000);
    });

    it('should classify financial entities for strict non-overwriting protection', () => {
      assert.strictEqual(isFinancialEntity('invoice'), true);
      assert.strictEqual(isFinancialEntity('payment_voucher'), true);
      assert.strictEqual(isFinancialEntity('journal_entry'), true);
      assert.strictEqual(isFinancialEntity('fund_transfer'), true);
      assert.strictEqual(isFinancialEntity('stock_movement'), true);
      assert.strictEqual(isFinancialEntity('stock_adjustment'), true);

      // Non-financial
      assert.strictEqual(isFinancialEntity('party'), false);
      assert.strictEqual(isFinancialEntity('item'), false);
      assert.strictEqual(isFinancialEntity('business_profile'), false);
    });

    it('should flag financial_record_modified_remotely and prevent silent overwriting', () => {
      const localOp: OutboxOperation = {
        id: 'op_inv_sync',
        idempotencyKey: 'idemp_inv_sync',
        businessId: 'biz_1',
        deviceId: 'dev_1',
        entityType: 'invoice',
        entityId: 'inv_101',
        operationType: 'update',
        payload: { grandTotal: 12000, notes: 'Client update' },
        status: 'pending',
        retryCount: 0,
        maxRetries: 5,
        createdAt: '2026-11-20T10:00:00.000Z',
        updatedAt: '2026-11-20T10:00:00.000Z',
        serverVersion: 1,
        localRevision: 2,
        schemaVersion: 5
      };

      const serverRecord = {
        id: 'inv_101',
        grandTotal: 12500,
        server_version: 2, // Server has evolved ahead
        updated_at: '2026-11-20T10:10:00.000Z'
      };

      const evalResult = evaluateConcurrencyConflict(localOp, serverRecord);
      assert.strictEqual(evalResult.hasConflict, true);
      assert.strictEqual(evalResult.conflictType, 'financial_record_modified_remotely');
      assert.ok(evalResult.diffs && evalResult.diffs.length > 0);
    });

    it('should flag financial_record_deleted_remotely if server record was deleted', () => {
      const localOp: OutboxOperation = {
        id: 'op_inv_cancel',
        idempotencyKey: 'idemp_inv_cancel',
        businessId: 'biz_1',
        deviceId: 'dev_1',
        entityType: 'invoice',
        entityId: 'inv_999',
        operationType: 'cancel',
        payload: { cancellationReason: 'Void' },
        status: 'pending',
        retryCount: 0,
        maxRetries: 5,
        createdAt: '2026-11-20T10:00:00.000Z',
        updatedAt: '2026-11-20T10:00:00.000Z',
        localRevision: 1,
        schemaVersion: 5
      };

      const evalResult = evaluateConcurrencyConflict(localOp, null);
      assert.strictEqual(evalResult.hasConflict, true);
      assert.strictEqual(evalResult.conflictType, 'financial_record_deleted_remotely');
    });

    it('should safely merge master data combining non-overlapping fields', () => {
      const localObj = {
        id: 'party_1',
        name: 'Sharma Distributors',
        phone: '9898989898',
        email: 'sharma@local.com'
      };

      const serverObj = {
        id: 'party_1',
        name: 'Sharma Distributors Pvt Ltd',
        gstin: '27AAAAA0000A1Z5',
        server_version: 3
      };

      const merged = safeMergeMasterData(localObj, serverObj, true);
      assert.strictEqual(merged.id, 'party_1');
      assert.strictEqual(merged.gstin, '27AAAAA0000A1Z5', 'Non-overlapping server field preserved');
      assert.strictEqual(merged.phone, '9898989898', 'Local field preserved');
      assert.strictEqual(merged.server_version, 4, 'Server version incremented');
    });
  });

  // =========================================================================
  // 3. CRYPTOGRAPHIC CHECKSUM & ATTACHMENT INTEGRITY
  // =========================================================================
  describe('3. Cryptographic SHA-256 Hashing & Deduplication', () => {
    it('should calculate reproducible SHA-256 hash for identical data payloads', async () => {
      const payload1 = JSON.stringify({ invoiceNumber: 'INV-001', amount: 5000 });
      const payload2 = JSON.stringify({ invoiceNumber: 'INV-001', amount: 5000 });

      const hash1 = await calculateSha256(payload1);
      const hash2 = await calculateSha256(payload2);

      assert.strictEqual(hash1.length, 64, 'SHA-256 hex string must be 64 characters');
      assert.strictEqual(hash1, hash2, 'Identical payloads must yield identical SHA-256');
    });

    it('should produce distinct SHA-256 hashes when content is tampered with', async () => {
      const original = JSON.stringify({ invoiceNumber: 'INV-001', amount: 5000 });
      const tampered = JSON.stringify({ invoiceNumber: 'INV-001', amount: 5001 });

      const hashOrig = await calculateSha256(original);
      const hashTamp = await calculateSha256(tampered);

      assert.notStrictEqual(hashOrig, hashTamp, 'Modified payload must produce distinct hash');
    });
  });

  // =========================================================================
  // 4. BACKUP & RESTORE ENGINE (V3.0)
  // =========================================================================
  describe('4. Backup & Restore Engine (v3.0) with Cryptographic Verification', () => {
    const mockBackupData: BusinessBackupV3['data'] = {
      profile: {
        id: 'primary_profile',
        name: 'Alpha Traders',
        gstin: '27ABCDE1234F1Z5',
        state: 'Maharashtra',
        address: '101 Trade Center, Mumbai',
        phone: '9876543210',
        email: 'info@alphatraders.com',
        bankName: 'HDFC Bank',
        bankAccount: '50200012345678',
        bankIFSC: 'HDFC0001234',
        bankBranch: 'Mumbai Fort'
      },
      parties: [
        {
          id: 'party_1',
          name: 'Customer One',
          type: 'customer',
          phone: '9800000001',
          gstin: '27AAAAA0000A1Z5',
          state: 'Maharashtra',
          billingAddress: '101 Trade Center, Mumbai',
          outstandingBalance: 5000,
          openingBalance: 0
        }
      ],
      items: [
        {
          id: 'item_1',
          name: 'Widget Pro',
          hsnCode: '8471',
          unit: 'PCS',
          purchasePrice: 100,
          unitPrice: 150,
          costPrice: 100,
          gstRate: 18,
          stockQty: 50
        }
      ],
      warehouses: [
        {
          id: 'wh_main',
          name: 'Main Central Godown',
          code: 'MAIN-01',
          isDefault: true,
          isActive: true,
          createdAt: '2026-01-01'
        }
      ],
      invoices: [
        {
          id: 'inv_101',
          invoiceNumber: 'INV-2024-001',
          date: '2026-11-15',
          dueDate: '2026-11-30',
          partyId: 'party_1',
          partyType: 'customer',
          type: 'Tax Invoice',
          status: 'Active',
          items: [
            {
              id: 'line_1',
              itemId: 'item_1',
              name: 'Widget Pro',
              qty: 10,
              unit: 'PCS',
              unitPrice: 150,
              discount: 0,
              discountType: 'fixed',
              taxableValue: 1500,
              hsnCode: '8471',
              gstRate: 18,
              cgst: 135,
              sgst: 135,
              igst: 0,
              total: 1770
            }
          ],
          subtotal: 1500,
          discount: 0,
          taxableAmount: 1500,
          cgst: 135,
          sgst: 135,
          igst: 0,
          cess: 0,
          roundOff: 0,
          grandTotal: 1770,
          amountInWords: 'One Thousand Seven Hundred Seventy Rupees Only',
          paymentMode: 'Cash',
          amountReceived: 1770,
          balanceDue: 0,
          paymentStatus: 'Paid',
          createdAt: '2026-11-15T10:00:00.000Z',
          updatedAt: '2026-11-15T10:00:00.000Z',
          auditTrail: []
        }
      ],
      expenses: [],
      accounts: [
        {
          id: 'acc_sales',
          code: '4001',
          name: 'Sales Revenue',
          type: 'income',
          subtype: 'sales',
          openingBalance: 0,
          isActive: true,
          isSystem: true,
          currentBalance: 1500,
          createdAt: '2026-01-01'
        }
      ],
      journalEntries: [
        {
          id: 'je_101',
          entryNumber: 'JE-2024-001',
          date: '2026-11-15',
          sourceType: 'sales_invoice',
          sourceId: 'inv_101',
          narration: 'Sales invoice INV-2024-001',
          totalDebit: 1770,
          totalCredit: 1770,
          status: 'posted',
          isSystemGenerated: true,
          lines: [
            { id: 'jl_1', entryId: 'je_101', accountId: 'acc_debtors', accountCode: '1200', accountName: 'Debtors', description: 'AR', debit: 1770, credit: 0 },
            { id: 'jl_2', entryId: 'je_101', accountId: 'acc_sales', accountCode: '4001', accountName: 'Sales', description: 'Rev', debit: 0, credit: 1500 },
            { id: 'jl_3', entryId: 'je_101', accountId: 'acc_cgst', accountCode: '2210', accountName: 'CGST', description: 'Tax', debit: 0, credit: 135 },
            { id: 'jl_4', entryId: 'je_101', accountId: 'acc_sgst', accountCode: '2220', accountName: 'SGST', description: 'Tax', debit: 0, credit: 135 }
          ],
          createdAt: '2026-11-15'
        }
      ],
      paymentVouchers: [],
      accountingPeriods: [],
      bankAccounts: [],
      cashAccounts: [],
      fundTransfers: [],
      chequeRecords: [],
      bankStatements: [],
      bankStatementLines: [],
      bankReconciliations: [],
      stockMovements: [],
      inventoryLayers: [],
      productBatches: [],
      stockTransfers: [],
      stockAdjustments: []
    };

    it('should validate authentic v3.0 backup with matching SHA-256 checksum', async () => {
      const dataString = JSON.stringify(mockBackupData);
      const checksum = await calculateSha256(dataString);

      const metadata: BackupMetadata = {
        version: '3.0',
        generator: 'InvoicePro_Backup_Engine',
        businessId: 'biz_test_1',
        businessName: 'Alpha Traders',
        gstin: '27ABCDE1234F1Z5',
        exportedAt: new Date().toISOString(),
        schemaVersion: 5,
        environment: 'production',
        checksum,
        counts: {
          parties: 1,
          items: 1,
          warehouses: 1,
          invoices: 1,
          expenses: 0,
          accounts: 1,
          journalEntries: 1,
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

      const backupPayload: BusinessBackupV3 = { metadata, data: mockBackupData };
      const jsonString = JSON.stringify(backupPayload);

      const valResult = await validateBackupFile(jsonString);
      assert.strictEqual(valResult.valid, true);
      assert.strictEqual(valResult.checksumMatch, true);
      assert.strictEqual(valResult.errors.length, 0);
      assert.strictEqual(valResult.metadata?.businessName, 'Alpha Traders');
    });

    it('should reject corrupted or tampered backup file with checksum mismatch', async () => {
      const dataString = JSON.stringify(mockBackupData);
      const originalChecksum = await calculateSha256(dataString);

      // Create tampered copy where grandTotal was secretly modified
      const tamperedData = JSON.parse(JSON.stringify(mockBackupData));
      tamperedData.invoices[0].grandTotal = 999999;

      const metadata: BackupMetadata = {
        version: '3.0',
        generator: 'InvoicePro_Backup_Engine',
        businessId: 'biz_test_1',
        businessName: 'Alpha Traders',
        gstin: '27ABCDE1234F1Z5',
        exportedAt: new Date().toISOString(),
        schemaVersion: 5,
        environment: 'production',
        checksum: originalChecksum, // Still carries old checksum!
        counts: {
          parties: 1,
          items: 1,
          warehouses: 1,
          invoices: 1,
          expenses: 0,
          accounts: 1,
          journalEntries: 1,
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

      const backupPayload: BusinessBackupV3 = { metadata, data: tamperedData };
      const jsonString = JSON.stringify(backupPayload);

      const valResult = await validateBackupFile(jsonString);
      assert.strictEqual(valResult.valid, false, 'Tampered backup must fail validation');
      assert.strictEqual(valResult.checksumMatch, false, 'Checksum match must be false');
      assert.ok(valResult.errors.some(e => e.includes('checksum mismatch')));
    });

    it('should generate informative restore preview with record statistics', async () => {
      const dataString = JSON.stringify(mockBackupData);
      const checksum = await calculateSha256(dataString);

      const metadata: BackupMetadata = {
        version: '3.0',
        generator: 'InvoicePro_Backup_Engine',
        businessId: 'biz_test_1',
        businessName: 'Alpha Traders',
        gstin: '27ABCDE1234F1Z5',
        exportedAt: '2026-11-20T12:00:00.000Z',
        schemaVersion: 5,
        environment: 'production',
        checksum,
        counts: {
          parties: 1,
          items: 1,
          warehouses: 1,
          invoices: 1,
          expenses: 0,
          accounts: 1,
          journalEntries: 1,
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

      const backupPayload: BusinessBackupV3 = { metadata, data: mockBackupData };
      const preview = await previewBackup(JSON.stringify(backupPayload));

      assert.strictEqual(preview.valid, true);
      assert.strictEqual(preview.checksumMatch, true);
      assert.strictEqual(preview.schemaCompatible, true);
      assert.strictEqual(preview.summary.businessName, 'Alpha Traders');
      assert.strictEqual(preview.summary.gstin, '27ABCDE1234F1Z5');
      assert.strictEqual(preview.summary.details.invoices, 1);
      assert.strictEqual(preview.summary.details.parties, 1);
      assert.strictEqual(preview.summary.details.journalEntries, 1);
      assert.strictEqual(preview.summary.totalRecords, 6);
    });

    it('should maintain backward compatibility with legacy v2.0 backups', async () => {
      const legacyPayload = {
        version: '2.0',
        timestamp: '2026-10-01T10:00:00.000Z',
        checksum: 'chk_123456_1_1',
        business: { name: 'Legacy Enterprise', gstin: '27AAAAA1111A1Z1' },
        parties: [{ id: 'lp_1', name: 'Legacy Party' }],
        items: [{ id: 'li_1', name: 'Legacy Item' }],
        invoices: [{ id: 'linv_1', invoiceNumber: 'LEG-001' }],
        expenses: [],
        accounts: [],
        journalEntries: [],
        paymentVouchers: []
      };

      const valResult = await validateBackupFile(JSON.stringify(legacyPayload));
      assert.strictEqual(valResult.valid, true);
      assert.strictEqual(valResult.metadata?.version, '3.0');
      assert.strictEqual(valResult.metadata?.businessName, 'Legacy Enterprise');
      assert.ok(valResult.warnings.some(w => w.includes('Legacy v2.0 backup detected')));
    });
  });

  // =========================================================================
  // 5. DEVICE DETECTION & REVOCATION
  // =========================================================================
  describe('5. Device Identification & Environment Detection', () => {
    it('should detect environment device type gracefully', () => {
      const type = detectDeviceType();
      assert.ok(['desktop', 'laptop', 'mobile', 'tablet'].includes(type));
    });
  });
});
