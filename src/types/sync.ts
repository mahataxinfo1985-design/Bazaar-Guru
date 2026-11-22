/**
 * Invoice Pro Phase 5: Offline-First, Synchronization, Conflicts & Backup Types
 */

import { BusinessProfile, Party, Item, Invoice, Expense } from '../types';
import { Account, JournalEntry, PaymentVoucher, AccountingPeriod } from './accounting';
import { 
  Warehouse, StockMovement, InventoryValuationLayer, ProductBatch, 
  StockTransfer, StockAdjustment 
} from './inventory';
import { 
  BankAccount, CashAccount, FundTransfer, ChequeRecord, 
  BankStatementImport, BankStatementLine, BankReconciliation 
} from './banking';

// ==========================================
// OUTBOX & SYNC TYPES
// ==========================================

export type OutboxStatus = 
  | 'pending' 
  | 'processing' 
  | 'synced' 
  | 'failed' 
  | 'conflict' 
  | 'action_required';

export type OutboxEntityType = 
  | 'invoice' 
  | 'party' 
  | 'item' 
  | 'expense' 
  | 'payment_voucher' 
  | 'journal_entry' 
  | 'account' 
  | 'bank_account' 
  | 'cash_account' 
  | 'fund_transfer' 
  | 'cheque_record' 
  | 'warehouse' 
  | 'stock_movement' 
  | 'stock_transfer' 
  | 'stock_adjustment' 
  | 'product_batch' 
  | 'business_profile';

export type OutboxOperationType = 
  | 'create' 
  | 'update' 
  | 'cancel' 
  | 'delete' 
  | 'post';

export interface OutboxOperation {
  id: string; // Unique operation ID (op_...)
  idempotencyKey: string; // Unique idempotency key (uuid or sha256)
  businessId: string;
  userId?: string;
  deviceId: string;
  entityType: OutboxEntityType;
  entityId: string;
  operationType: OutboxOperationType;
  payload: any;
  payloadHash?: string; // SHA-256 hash of payload for change detection
  dependencies?: string[]; // IDs of other operations that must sync first
  status: OutboxStatus;
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: string; // ISO date string for exponential backoff
  lastError?: string;
  createdAt: string; // Local creation timestamp
  updatedAt: string;
  syncedAt?: string;
  serverVersion?: number;
  localRevision: number;
  schemaVersion: number;
}

// ==========================================
// CONFLICT MANAGEMENT TYPES
// ==========================================

export type ConflictType = 
  | 'master_data_concurrent_edit' 
  | 'financial_record_modified_remotely' 
  | 'financial_record_deleted_remotely' 
  | 'inventory_insufficient_on_server' 
  | 'payment_allocation_mismatch';

export type ConflictResolutionStrategy = 
  | 'keep_local' 
  | 'keep_server' 
  | 'merge' 
  | 'create_reversal_and_reissue' 
  | 'manual_review';

export interface SyncConflict {
  id: string; // conf_...
  operationId: string;
  entityType: OutboxEntityType;
  entityId: string;
  conflictType: ConflictType;
  localPayload: any;
  serverPayload: any;
  fieldDifferences?: {
    field: string;
    localValue: any;
    serverValue: any;
  }[];
  detectedAt: string;
  status: 'unresolved' | 'resolved' | 'dismissed';
  resolutionStrategy?: ConflictResolutionStrategy;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNotes?: string;
  finalPayload?: any;
}

// ==========================================
// DEVICE MANAGEMENT TYPES
// ==========================================

export type DeviceType = 'desktop' | 'laptop' | 'mobile' | 'tablet' | 'unknown';
export type DeviceStatus = 'active' | 'revoked' | 'pending_approval';

export interface SyncDevice {
  id: string; // dev_...
  businessId: string;
  userId: string;
  deviceName: string;
  deviceType: DeviceType;
  clientVersion: string;
  ipAddress?: string;
  userAgent?: string;
  registeredAt: string;
  lastSeenAt: string;
  lastSyncedAt?: string;
  status: DeviceStatus;
  syncCheckpoint?: {
    lastServerSeq: number;
    lastOutboxOperationId?: string;
    timestamp: string;
  };
}

// ==========================================
// ATTACHMENT SYNC TYPES
// ==========================================

export type AttachmentStatus = 'local_only' | 'uploading' | 'synced' | 'failed';

export interface OfflineAttachment {
  id: string; // att_...
  businessId: string;
  entityType: OutboxEntityType;
  entityId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  fileHash: string; // SHA-256 for deduplication
  base64Data?: string; // Local storage in IndexedDB
  storageUrl?: string; // Cloud / server URL once synced
  status: AttachmentStatus;
  retryCount: number;
  error?: string;
  createdAt: string;
  uploadedAt?: string;
}

// ==========================================
// BACKUP & RESTORE V3 TYPES
// ==========================================

export interface BackupMetadata {
  version: '3.0';
  generator: 'InvoicePro_Backup_Engine';
  businessId: string;
  businessName: string;
  gstin: string;
  exportedAt: string;
  schemaVersion: number;
  environment: 'production' | 'offline_local';
  checksum: string; // SHA-256 of the data payload
  counts: {
    parties: number;
    items: number;
    warehouses: number;
    invoices: number;
    expenses: number;
    accounts: number;
    journalEntries: number;
    paymentVouchers: number;
    bankAccounts: number;
    fundTransfers: number;
    chequeRecords: number;
    stockMovements: number;
    stockTransfers: number;
    stockAdjustments: number;
    batches: number;
  };
}

export interface BusinessBackupV3 {
  metadata: BackupMetadata;
  data: {
    profile: BusinessProfile;
    parties: Party[];
    items: Item[];
    warehouses: Warehouse[];
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
    stockMovements: StockMovement[];
    inventoryLayers: InventoryValuationLayer[];
    productBatches: ProductBatch[];
    stockTransfers: StockTransfer[];
    stockAdjustments: StockAdjustment[];
    attachmentsManifest?: {
      id: string;
      fileName: string;
      fileSize: number;
      mimeType: string;
      fileHash: string;
      entityType: string;
      entityId: string;
    }[];
  };
}

export interface RestorePreviewResult {
  valid: boolean;
  checksumMatch: boolean;
  schemaCompatible: boolean;
  metadata: BackupMetadata;
  validationErrors: string[];
  warnings: string[];
  summary: {
    businessName: string;
    gstin: string;
    exportDate: string;
    totalRecords: number;
    details: { [key: string]: number };
  };
}

export interface RestoreExecutionResult {
  success: boolean;
  mode: 'empty_business' | 'safe_merge' | 'validate_only';
  restoredAt: string;
  recordsRestored: number;
  snapshotBackupId?: string;
  message: string;
  errors?: string[];
}
