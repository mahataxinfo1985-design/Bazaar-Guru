import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { BusinessProfile, Party, Item, Invoice, Expense } from '../../types';
import { 
  Account, JournalEntry, PaymentVoucher, OfflineMutation, AccountingPeriod,
  BankAccount, CashAccount, FundTransfer, ChequeRecord, BankStatementImport,
  BankStatementLine, BankReconciliation 
} from '../../types/accounting';
import { 
  Warehouse, StockMovement, InventoryValuationLayer, ProductBatch, 
  StockTransfer, StockAdjustment 
} from '../../types/inventory';
import {
  OutboxOperation, SyncConflict, SyncDevice, OfflineAttachment
} from '../../types/sync';
import {
  Quotation, SalesOrder, DeliveryChallan, PurchaseOrder, GoodsReceiptNote,
  StoredBusinessDocument, BusinessNotification, BusinessAuditEvent,
  BusinessUser, BusinessNumberingConfig
} from '../../types/workspace';
import { DEFAULT_WAREHOUSE } from '../inventory/warehouseService';
import { DEFAULT_BUSINESS_PROFILE, MOCK_PARTIES, MOCK_ITEMS, MOCK_INVOICES } from '../../data/mockData';
import { generateDefaultAccounts } from '../accounting/chartOfAccounts';
import { createSalesInvoiceJournalEntry, createPurchaseInvoiceJournalEntry } from '../accounting/journalEngine';
import { DEFAULT_ACCOUNTING_PERIODS } from '../accounting/periodService';
import { DEFAULT_BANK_ACCOUNTS, DEFAULT_CASH_ACCOUNTS } from '../banking/bankAccountService';

export interface BackupHistoryEntry {
  id: string;
  timestamp: string;
  filename: string;
  checksum: string;
  recordCount: number;
  snapshotType: 'manual' | 'pre_restore' | 'automated';
}

export interface InvoiceProDBSchema extends DBSchema {
  profile: {
    key: string;
    value: BusinessProfile & { id: string };
  };
  parties: {
    key: string;
    value: Party;
    indexes: { 'by-name': string; 'by-type': string };
  };
  items: {
    key: string;
    value: Item;
    indexes: { 'by-name': string; 'by-hsn': string };
  };
  invoices: {
    key: string;
    value: Invoice;
    indexes: { 'by-date': string; 'by-type': string; 'by-party': string };
  };
  expenses: {
    key: string;
    value: Expense;
    indexes: { 'by-date': string; 'by-category': string };
  };
  accounts: {
    key: string;
    value: Account;
    indexes: { 'by-code': string; 'by-type': string };
  };
  journal_entries: {
    key: string;
    value: JournalEntry;
    indexes: { 'by-date': string; 'by-source': string; 'by-party': string };
  };
  payment_vouchers: {
    key: string;
    value: PaymentVoucher;
    indexes: { 'by-date': string; 'by-party': string; 'by-type': string };
  };
  accounting_periods: {
    key: string;
    value: AccountingPeriod;
    indexes: { 'by-status': string };
  };
  bank_accounts: {
    key: string;
    value: BankAccount;
    indexes: { 'by-status': string };
  };
  cash_accounts: {
    key: string;
    value: CashAccount;
    indexes: { 'by-status': string };
  };
  fund_transfers: {
    key: string;
    value: FundTransfer;
    indexes: { 'by-date': string };
  };
  cheque_records: {
    key: string;
    value: ChequeRecord;
    indexes: { 'by-status': string; 'by-date': string };
  };
  bank_statements: {
    key: string;
    value: BankStatementImport;
  };
  bank_statement_lines: {
    key: string;
    value: BankStatementLine;
    indexes: { 'by-account': string; 'by-status': string };
  };
  bank_reconciliations: {
    key: string;
    value: BankReconciliation;
    indexes: { 'by-account': string };
  };
  warehouses: {
    key: string;
    value: Warehouse;
    indexes: { 'by-code': string };
  };
  stock_movements: {
    key: string;
    value: StockMovement;
    indexes: { 'by-product': string; 'by-warehouse': string; 'by-date': string };
  };
  inventory_layers: {
    key: string;
    value: InventoryValuationLayer;
    indexes: { 'by-product': string; 'by-date': string };
  };
  product_batches: {
    key: string;
    value: ProductBatch;
    indexes: { 'by-product': string; 'by-expiry': string };
  };
  stock_transfers: {
    key: string;
    value: StockTransfer;
    indexes: { 'by-date': string };
  };
  stock_adjustments: {
    key: string;
    value: StockAdjustment;
    indexes: { 'by-date': string };
  };
  sync_queue: {
    key: string;
    value: OfflineMutation;
    indexes: { 'by-status': string; 'by-created': string };
  };
  sync_outbox: {
    key: string;
    value: OutboxOperation;
    indexes: { 
      'by-status': string; 
      'by-entity-type': string; 
      'by-created-at': string; 
      'by-idempotency': string;
    };
  };
  sync_conflicts: {
    key: string;
    value: SyncConflict;
    indexes: { 
      'by-status': string; 
      'by-entity-type': string; 
      'by-detected-at': string; 
    };
  };
  sync_devices: {
    key: string;
    value: SyncDevice;
    indexes: { 
      'by-status': string; 
      'by-business': string; 
    };
  };
  sync_attachments: {
    key: string;
    value: OfflineAttachment;
    indexes: { 
      'by-status': string; 
      'by-entity': string; 
      'by-hash': string; 
    };
  };
  backup_history: {
    key: string;
    value: BackupHistoryEntry;
    indexes: { 
      'by-date': string; 
    };
  };
  // Phase 6: Business Workspace Stores
  quotations: {
    key: string;
    value: Quotation;
    indexes: { 'by-date': string; 'by-party': string; 'by-status': string };
  };
  sales_orders: {
    key: string;
    value: SalesOrder;
    indexes: { 'by-date': string; 'by-party': string; 'by-status': string };
  };
  delivery_challans: {
    key: string;
    value: DeliveryChallan;
    indexes: { 'by-date': string; 'by-party': string; 'by-status': string };
  };
  purchase_orders: {
    key: string;
    value: PurchaseOrder;
    indexes: { 'by-date': string; 'by-supplier': string; 'by-status': string };
  };
  goods_receipt_notes: {
    key: string;
    value: GoodsReceiptNote;
    indexes: { 'by-date': string; 'by-supplier': string; 'by-status': string };
  };
  business_documents: {
    key: string;
    value: StoredBusinessDocument;
    indexes: { 'by-category': string; 'by-date': string };
  };
  notifications: {
    key: string;
    value: BusinessNotification;
    indexes: { 'by-category': string; 'by-read': string; 'by-date': string };
  };
  audit_events: {
    key: string;
    value: BusinessAuditEvent;
    indexes: { 'by-entity': string; 'by-date': string; 'by-user': string };
  };
  business_users: {
    key: string;
    value: BusinessUser;
    indexes: { 'by-role': string; 'by-status': string };
  };
  numbering_sequences: {
    key: string;
    value: BusinessNumberingConfig;
  };
}

const DB_NAME = 'invoicepro_local_db';
const DB_VERSION = 6;

let dbPromise: Promise<IDBPDatabase<InvoiceProDBSchema>> | null = null;

export function getIDB(): Promise<IDBPDatabase<InvoiceProDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<InvoiceProDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Profile
        if (!db.objectStoreNames.contains('profile')) {
          db.createObjectStore('profile', { keyPath: 'id' });
        }

        // Parties
        if (!db.objectStoreNames.contains('parties')) {
          const partyStore = db.createObjectStore('parties', { keyPath: 'id' });
          partyStore.createIndex('by-name', 'name');
          partyStore.createIndex('by-type', 'type');
        }

        // Items
        if (!db.objectStoreNames.contains('items')) {
          const itemStore = db.createObjectStore('items', { keyPath: 'id' });
          itemStore.createIndex('by-name', 'name');
          itemStore.createIndex('by-hsn', 'hsnCode');
        }

        // Invoices
        if (!db.objectStoreNames.contains('invoices')) {
          const invStore = db.createObjectStore('invoices', { keyPath: 'id' });
          invStore.createIndex('by-date', 'date');
          invStore.createIndex('by-type', 'type');
          invStore.createIndex('by-party', 'partyId');
        }

        // Expenses
        if (!db.objectStoreNames.contains('expenses')) {
          const expStore = db.createObjectStore('expenses', { keyPath: 'id' });
          expStore.createIndex('by-date', 'date');
          expStore.createIndex('by-category', 'category');
        }

        // Accounts
        if (!db.objectStoreNames.contains('accounts')) {
          const accStore = db.createObjectStore('accounts', { keyPath: 'id' });
          accStore.createIndex('by-code', 'code', { unique: true });
          accStore.createIndex('by-type', 'type');
        }

        // Journal Entries
        if (!db.objectStoreNames.contains('journal_entries')) {
          const jeStore = db.createObjectStore('journal_entries', { keyPath: 'id' });
          jeStore.createIndex('by-date', 'date');
          jeStore.createIndex('by-source', 'sourceId');
          jeStore.createIndex('by-party', 'partyId');
        }

        // Payment Vouchers
        if (!db.objectStoreNames.contains('payment_vouchers')) {
          const pvStore = db.createObjectStore('payment_vouchers', { keyPath: 'id' });
          pvStore.createIndex('by-date', 'date');
          pvStore.createIndex('by-party', 'partyId');
          pvStore.createIndex('by-type', 'type');
        }

        // Accounting Periods
        if (!db.objectStoreNames.contains('accounting_periods')) {
          const apStore = db.createObjectStore('accounting_periods', { keyPath: 'id' });
          apStore.createIndex('by-status', 'status');
        }

        // Bank Accounts
        if (!db.objectStoreNames.contains('bank_accounts')) {
          const baStore = db.createObjectStore('bank_accounts', { keyPath: 'id' });
          baStore.createIndex('by-status', 'isActive');
        }

        // Cash Accounts
        if (!db.objectStoreNames.contains('cash_accounts')) {
          const caStore = db.createObjectStore('cash_accounts', { keyPath: 'id' });
          caStore.createIndex('by-status', 'isActive');
        }

        // Fund Transfers
        if (!db.objectStoreNames.contains('fund_transfers')) {
          const ftStore = db.createObjectStore('fund_transfers', { keyPath: 'id' });
          ftStore.createIndex('by-date', 'date');
        }

        // Cheque Records
        if (!db.objectStoreNames.contains('cheque_records')) {
          const crStore = db.createObjectStore('cheque_records', { keyPath: 'id' });
          crStore.createIndex('by-status', 'status');
          crStore.createIndex('by-date', 'chequeDate');
        }

        // Bank Statement Imports
        if (!db.objectStoreNames.contains('bank_statements')) {
          db.createObjectStore('bank_statements', { keyPath: 'id' });
        }

        // Bank Statement Lines
        if (!db.objectStoreNames.contains('bank_statement_lines')) {
          const bslStore = db.createObjectStore('bank_statement_lines', { keyPath: 'id' });
          bslStore.createIndex('by-account', 'bankAccountId');
          bslStore.createIndex('by-status', 'matchedStatus');
        }

        // Bank Reconciliations
        if (!db.objectStoreNames.contains('bank_reconciliations')) {
          const brStore = db.createObjectStore('bank_reconciliations', { keyPath: 'id' });
          brStore.createIndex('by-account', 'bankAccountId');
        }

        // Warehouses
        if (!db.objectStoreNames.contains('warehouses')) {
          const whStore = db.createObjectStore('warehouses', { keyPath: 'id' });
          whStore.createIndex('by-code', 'code');
        }

        // Stock Movements
        if (!db.objectStoreNames.contains('stock_movements')) {
          const smStore = db.createObjectStore('stock_movements', { keyPath: 'id' });
          smStore.createIndex('by-product', 'productId');
          smStore.createIndex('by-warehouse', 'warehouseId');
          smStore.createIndex('by-date', 'date');
        }

        // Inventory Layers
        if (!db.objectStoreNames.contains('inventory_layers')) {
          const ilStore = db.createObjectStore('inventory_layers', { keyPath: 'id' });
          ilStore.createIndex('by-product', 'productId');
          ilStore.createIndex('by-date', 'purchaseDate');
        }

        // Product Batches
        if (!db.objectStoreNames.contains('product_batches')) {
          const pbStore = db.createObjectStore('product_batches', { keyPath: 'id' });
          pbStore.createIndex('by-product', 'productId');
          pbStore.createIndex('by-expiry', 'expiryDate');
        }

        // Stock Transfers
        if (!db.objectStoreNames.contains('stock_transfers')) {
          const stStore = db.createObjectStore('stock_transfers', { keyPath: 'id' });
          stStore.createIndex('by-date', 'date');
        }

        // Stock Adjustments
        if (!db.objectStoreNames.contains('stock_adjustments')) {
          const saStore = db.createObjectStore('stock_adjustments', { keyPath: 'id' });
          saStore.createIndex('by-date', 'date');
        }

        // Sync Queue
        if (!db.objectStoreNames.contains('sync_queue')) {
          const syncStore = db.createObjectStore('sync_queue', { keyPath: 'id' });
          syncStore.createIndex('by-status', 'status');
          syncStore.createIndex('by-created', 'createdAt');
        }

        // Phase 5: Sync Outbox
        if (!db.objectStoreNames.contains('sync_outbox')) {
          const outboxStore = db.createObjectStore('sync_outbox', { keyPath: 'id' });
          outboxStore.createIndex('by-status', 'status');
          outboxStore.createIndex('by-entity-type', 'entityType');
          outboxStore.createIndex('by-created-at', 'createdAt');
          outboxStore.createIndex('by-idempotency', 'idempotencyKey', { unique: true });
        }

        // Phase 5: Sync Conflicts
        if (!db.objectStoreNames.contains('sync_conflicts')) {
          const confStore = db.createObjectStore('sync_conflicts', { keyPath: 'id' });
          confStore.createIndex('by-status', 'status');
          confStore.createIndex('by-entity-type', 'entityType');
          confStore.createIndex('by-detected-at', 'detectedAt');
        }

        // Phase 5: Sync Devices
        if (!db.objectStoreNames.contains('sync_devices')) {
          const devStore = db.createObjectStore('sync_devices', { keyPath: 'id' });
          devStore.createIndex('by-status', 'status');
          devStore.createIndex('by-business', 'businessId');
        }

        // Phase 5: Sync Attachments
        if (!db.objectStoreNames.contains('sync_attachments')) {
          const attStore = db.createObjectStore('sync_attachments', { keyPath: 'id' });
          attStore.createIndex('by-status', 'status');
          attStore.createIndex('by-entity', 'entityId');
          attStore.createIndex('by-hash', 'fileHash');
        }

        // Phase 5: Backup History
        if (!db.objectStoreNames.contains('backup_history')) {
          const bakStore = db.createObjectStore('backup_history', { keyPath: 'id' });
          bakStore.createIndex('by-date', 'timestamp');
        }

        // Phase 6: Business Workspace Stores
        if (!db.objectStoreNames.contains('quotations')) {
          const quoStore = db.createObjectStore('quotations', { keyPath: 'id' });
          quoStore.createIndex('by-date', 'date');
          quoStore.createIndex('by-party', 'partyId');
          quoStore.createIndex('by-status', 'status');
        }

        if (!db.objectStoreNames.contains('sales_orders')) {
          const soStore = db.createObjectStore('sales_orders', { keyPath: 'id' });
          soStore.createIndex('by-date', 'date');
          soStore.createIndex('by-party', 'partyId');
          soStore.createIndex('by-status', 'status');
        }

        if (!db.objectStoreNames.contains('delivery_challans')) {
          const dcStore = db.createObjectStore('delivery_challans', { keyPath: 'id' });
          dcStore.createIndex('by-date', 'date');
          dcStore.createIndex('by-party', 'partyId');
          dcStore.createIndex('by-status', 'status');
        }

        if (!db.objectStoreNames.contains('purchase_orders')) {
          const poStore = db.createObjectStore('purchase_orders', { keyPath: 'id' });
          poStore.createIndex('by-date', 'date');
          poStore.createIndex('by-supplier', 'supplierId');
          poStore.createIndex('by-status', 'status');
        }

        if (!db.objectStoreNames.contains('goods_receipt_notes')) {
          const grnStore = db.createObjectStore('goods_receipt_notes', { keyPath: 'id' });
          grnStore.createIndex('by-date', 'date');
          grnStore.createIndex('by-supplier', 'supplierId');
          grnStore.createIndex('by-status', 'status');
        }

        if (!db.objectStoreNames.contains('business_documents')) {
          const docStore = db.createObjectStore('business_documents', { keyPath: 'id' });
          docStore.createIndex('by-category', 'category');
          docStore.createIndex('by-date', 'uploadedAt');
        }

        if (!db.objectStoreNames.contains('notifications')) {
          const notifStore = db.createObjectStore('notifications', { keyPath: 'id' });
          notifStore.createIndex('by-category', 'category');
          notifStore.createIndex('by-read', 'isRead');
          notifStore.createIndex('by-date', 'timestamp');
        }

        if (!db.objectStoreNames.contains('audit_events')) {
          const auditStore = db.createObjectStore('audit_events', { keyPath: 'id' });
          auditStore.createIndex('by-entity', 'entityId');
          auditStore.createIndex('by-date', 'timestamp');
          auditStore.createIndex('by-user', 'userId');
        }

        if (!db.objectStoreNames.contains('business_users')) {
          const userStore = db.createObjectStore('business_users', { keyPath: 'id' });
          userStore.createIndex('by-role', 'role');
          userStore.createIndex('by-status', 'isActive');
        }

        if (!db.objectStoreNames.contains('numbering_sequences')) {
          db.createObjectStore('numbering_sequences', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

// In-memory fallback for non-browser / unit test environments
const inMemoryStores = new Map<string, Map<string, any>>();

export function getMemoryStore(storeName: string): Map<string, any> {
  if (!inMemoryStores.has(storeName)) {
    inMemoryStores.set(storeName, new Map());
  }
  return inMemoryStores.get(storeName)!;
}

export function clearMemoryStores(): void {
  inMemoryStores.clear();
}

/**
 * Initializes local database with migration from legacy localStorage or defaults.
 */
export async function initializeLocalDatabase(): Promise<{
  profile: BusinessProfile;
  parties: Party[];
  items: Item[];
  invoices: Invoice[];
  expenses: Expense[];
  accounts: Account[];
  journalEntries: JournalEntry[];
  paymentVouchers: PaymentVoucher[];
  accountingPeriods: AccountingPeriod[];
  bankAccounts: BankAccount[];
  cashAccounts: CashAccount[];
  fundTransfers: FundTransfer[];
  chequeRecords: ChequeRecord[];
  bankStatements: BankStatementImport[];
  bankStatementLines: BankStatementLine[];
  bankReconciliations: BankReconciliation[];
  warehouses: Warehouse[];
  stockMovements: StockMovement[];
  inventoryLayers: InventoryValuationLayer[];
  productBatches: ProductBatch[];
  stockTransfers: StockTransfer[];
  stockAdjustments: StockAdjustment[];
}> {
  if (typeof indexedDB === 'undefined') {
    // Node.js / test environment
    const profile = DEFAULT_BUSINESS_PROFILE;
    const parties = [...MOCK_PARTIES];
    const items = [...MOCK_ITEMS];
    const invoices = [...MOCK_INVOICES];
    const accounts = generateDefaultAccounts('local_business');
    const accountingPeriods = [...DEFAULT_ACCOUNTING_PERIODS];
    const bankAccounts = [...DEFAULT_BANK_ACCOUNTS];
    const cashAccounts = [...DEFAULT_CASH_ACCOUNTS];
    const warehouses = [DEFAULT_WAREHOUSE];

    // Seed in-memory stores
    for (const p of parties) getMemoryStore('parties').set(p.id, p);
    for (const it of items) getMemoryStore('items').set(it.id, it);
    for (const inv of invoices) getMemoryStore('invoices').set(inv.id, inv);
    for (const acc of accounts) getMemoryStore('accounts').set(acc.id, acc);
    for (const ap of accountingPeriods) getMemoryStore('accounting_periods').set(ap.id, ap);
    for (const ba of bankAccounts) getMemoryStore('bank_accounts').set(ba.id, ba);
    for (const ca of cashAccounts) getMemoryStore('cash_accounts').set(ca.id, ca);
    for (const wh of warehouses) getMemoryStore('warehouses').set(wh.id, wh);

    return {
      profile,
      parties,
      items,
      invoices,
      expenses: [],
      accounts,
      journalEntries: [],
      paymentVouchers: [],
      accountingPeriods,
      bankAccounts,
      cashAccounts,
      fundTransfers: [],
      chequeRecords: [],
      bankStatements: [],
      bankStatementLines: [],
      bankReconciliations: [],
      warehouses,
      stockMovements: [],
      inventoryLayers: [],
      productBatches: [],
      stockTransfers: [],
      stockAdjustments: []
    };
  }

  const db = await getIDB();

  // Check if profile exists
  let profile = await db.get('profile', 'primary_profile');
  if (!profile) {
    const saved = localStorage.getItem('invoice_pro_profile');
    const initProfile = saved ? JSON.parse(saved) : DEFAULT_BUSINESS_PROFILE;
    profile = { ...initProfile, id: 'primary_profile' };
    await db.put('profile', profile);
  }

  // Parties
  let parties = await db.getAll('parties');
  if (parties.length === 0) {
    const saved = localStorage.getItem('invoice_pro_parties');
    parties = saved ? JSON.parse(saved) : MOCK_PARTIES;
    const tx = db.transaction('parties', 'readwrite');
    for (const p of parties) {
      await tx.store.put(p);
    }
    await tx.done;
  }

  // Items
  let items = await db.getAll('items');
  if (items.length === 0) {
    const saved = localStorage.getItem('invoice_pro_items');
    items = saved ? JSON.parse(saved) : MOCK_ITEMS;
    const tx = db.transaction('items', 'readwrite');
    for (const it of items) {
      await tx.store.put(it);
    }
    await tx.done;
  }

  // Invoices
  let invoices = await db.getAll('invoices');
  if (invoices.length === 0) {
    const saved = localStorage.getItem('invoice_pro_invoices');
    invoices = saved ? JSON.parse(saved) : MOCK_INVOICES;
    const tx = db.transaction('invoices', 'readwrite');
    for (const inv of invoices) {
      await tx.store.put(inv);
    }
    await tx.done;
  }

  // Expenses
  let expenses = await db.getAll('expenses');
  if (expenses.length === 0) {
    const saved = localStorage.getItem('invoice_pro_expenses');
    expenses = saved ? JSON.parse(saved) : [];
    if (expenses.length > 0) {
      const tx = db.transaction('expenses', 'readwrite');
      for (const exp of expenses) {
        await tx.store.put(exp);
      }
      await tx.done;
    }
  }

  // Accounts
  let accounts = await db.getAll('accounts');
  if (accounts.length === 0) {
    accounts = generateDefaultAccounts('local_business');
    const tx = db.transaction('accounts', 'readwrite');
    for (const acc of accounts) {
      await tx.store.put(acc);
    }
    await tx.done;
  }

  // Journal Entries
  let journalEntries = await db.getAll('journal_entries');
  if (journalEntries.length === 0 && invoices.length > 0) {
    // Generate accounting journals for initial invoices
    const partyMap = new Map(parties.map(p => [p.id, p.name]));
    const tx = db.transaction('journal_entries', 'readwrite');
    for (const inv of invoices) {
      if (inv.status === 'Cancelled' || inv.deleted) continue;
      const isSales = !inv.type.includes('Purchase') && inv.type !== 'Purchase Return';
      const pName = partyMap.get(inv.partyId) || 'Party';
      const je = isSales
        ? createSalesInvoiceJournalEntry(inv, accounts, pName)
        : createPurchaseInvoiceJournalEntry(inv, accounts, pName);
      journalEntries.push(je);
      await tx.store.put(je);
    }
    await tx.done;
  }

  // Payment Vouchers
  const paymentVouchers = await db.getAll('payment_vouchers');

  // Accounting Periods
  let accountingPeriods = await db.getAll('accounting_periods');
  if (accountingPeriods.length === 0) {
    accountingPeriods = DEFAULT_ACCOUNTING_PERIODS;
    const tx = db.transaction('accounting_periods', 'readwrite');
    for (const ap of accountingPeriods) {
      await tx.store.put(ap);
    }
    await tx.done;
  }

  // Bank Accounts
  let bankAccounts = await db.getAll('bank_accounts');
  if (bankAccounts.length === 0) {
    bankAccounts = DEFAULT_BANK_ACCOUNTS;
    const tx = db.transaction('bank_accounts', 'readwrite');
    for (const ba of bankAccounts) {
      await tx.store.put(ba);
    }
    await tx.done;
  }

  // Cash Accounts
  let cashAccounts = await db.getAll('cash_accounts');
  if (cashAccounts.length === 0) {
    cashAccounts = DEFAULT_CASH_ACCOUNTS;
    const tx = db.transaction('cash_accounts', 'readwrite');
    for (const ca of cashAccounts) {
      await tx.store.put(ca);
    }
    await tx.done;
  }

  // Fund Transfers, Cheques, Statements, Reconciliations
  const fundTransfers = await db.getAll('fund_transfers');
  const chequeRecords = await db.getAll('cheque_records');
  const bankStatements = await db.getAll('bank_statements');
  const bankStatementLines = await db.getAll('bank_statement_lines');
  const bankReconciliations = await db.getAll('bank_reconciliations');

  // Warehouses
  let warehouses = await db.getAll('warehouses');
  if (warehouses.length === 0) {
    warehouses = [DEFAULT_WAREHOUSE];
    const tx = db.transaction('warehouses', 'readwrite');
    for (const wh of warehouses) {
      await tx.store.put(wh);
    }
    await tx.done;
  }

  const stockMovements = await db.getAll('stock_movements');
  const inventoryLayers = await db.getAll('inventory_layers');
  const productBatches = await db.getAll('product_batches');
  const stockTransfers = await db.getAll('stock_transfers');
  const stockAdjustments = await db.getAll('stock_adjustments');

  return {
    profile,
    parties,
    items,
    invoices,
    expenses,
    accounts,
    journalEntries,
    paymentVouchers,
    accountingPeriods,
    bankAccounts,
    cashAccounts,
    fundTransfers,
    chequeRecords,
    bankStatements,
    bankStatementLines,
    bankReconciliations,
    warehouses,
    stockMovements,
    inventoryLayers,
    productBatches,
    stockTransfers,
    stockAdjustments
  };
}

// Generic CRUD operations
export async function idbPut<K extends keyof InvoiceProDBSchema>(
  storeName: K,
  value: InvoiceProDBSchema[K]['value']
): Promise<void> {
  if (typeof indexedDB === 'undefined') {
    const mem = getMemoryStore(storeName as string);
    const key = (value as any).id || (value as any).key || String(Date.now());
    mem.set(key, value);
    return;
  }
  const db = await getIDB();
  await (db as any).put(storeName, value);
}

export async function idbDelete<K extends keyof InvoiceProDBSchema>(
  storeName: K,
  key: string
): Promise<void> {
  if (typeof indexedDB === 'undefined') {
    getMemoryStore(storeName as string).delete(key);
    return;
  }
  const db = await getIDB();
  await (db as any).delete(storeName, key);
}

export async function idbGetAll<K extends keyof InvoiceProDBSchema>(
  storeName: K
): Promise<InvoiceProDBSchema[K]['value'][]> {
  if (typeof indexedDB === 'undefined') {
    return Array.from(getMemoryStore(storeName as string).values());
  }
  const db = await getIDB();
  return (db as any).getAll(storeName);
}

export { DEFAULT_BUSINESS_PROFILE };
