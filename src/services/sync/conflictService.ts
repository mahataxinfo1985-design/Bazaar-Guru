/**
 * Conflict Detection & Resolution Service
 * Handles version-based optimistic concurrency, field difference analysis,
 * master data safe merge, and strict financial transaction conflict protection.
 */

import { SyncConflict, ConflictType, ConflictResolutionStrategy, OutboxEntityType, OutboxOperation } from '../../types/sync';
import { getIDB, idbPut, idbGetAll } from '../storage/idb';
import { markOperationConflict } from './outboxEngine';

/**
 * Builds a field-by-field difference array comparing local and server payloads
 */
export function buildFieldDifferences(
  localObj: Record<string, any>,
  serverObj: Record<string, any>,
  ignoredFields: string[] = ['updated_at', 'updatedAt', 'localRevision', 'serverVersion']
): { field: string; localValue: any; serverValue: any }[] {
  const diffs: { field: string; localValue: any; serverValue: any }[] = [];
  const allKeys = new Set([...Object.keys(localObj || {}), ...Object.keys(serverObj || {})]);

  for (const key of allKeys) {
    if (ignoredFields.includes(key)) continue;

    const valL = localObj ? localObj[key] : undefined;
    const valS = serverObj ? serverObj[key] : undefined;

    if (JSON.stringify(valL) !== JSON.stringify(valS)) {
      diffs.push({
        field: key,
        localValue: valL,
        serverValue: valS
      });
    }
  }

  return diffs;
}

/**
 * Detects if a conflict exists between a local operation and remote server record
 */
export function evaluateConcurrencyConflict(
  localOp: OutboxOperation,
  serverRecord: any
): { hasConflict: boolean; conflictType?: ConflictType; diffs?: any[] } {
  if (!serverRecord) {
    // If server record was deleted while client is updating it
    if (localOp.operationType === 'update' || localOp.operationType === 'cancel') {
      const isFinancial = isFinancialEntity(localOp.entityType);
      return {
        hasConflict: true,
        conflictType: isFinancial 
          ? 'financial_record_deleted_remotely' 
          : 'master_data_concurrent_edit'
      };
    }
    return { hasConflict: false };
  }

  const serverVersion = serverRecord.server_version || serverRecord.version || 0;
  const clientBaseVersion = localOp.serverVersion || 0;

  const serverUpdatedAt = serverRecord.updated_at || serverRecord.updatedAt;
  const clientCreatedAt = localOp.createdAt;

  const versionMismatch = serverVersion > clientBaseVersion && clientBaseVersion > 0;
  const timeMismatch = serverUpdatedAt && clientCreatedAt && new Date(serverUpdatedAt).getTime() > new Date(clientCreatedAt).getTime();

  if (versionMismatch || timeMismatch) {
    const isFinancial = isFinancialEntity(localOp.entityType);
    const diffs = buildFieldDifferences(localOp.payload, serverRecord);

    if (diffs.length > 0) {
      return {
        hasConflict: true,
        conflictType: isFinancial
          ? 'financial_record_modified_remotely'
          : 'master_data_concurrent_edit',
        diffs
      };
    }
  }

  return { hasConflict: false };
}

/**
 * Checks if an entity type is a financial/accounting entity requiring strict non-overwriting protection
 */
export function isFinancialEntity(entityType: OutboxEntityType): boolean {
  const financialTypes: OutboxEntityType[] = [
    'invoice',
    'payment_voucher',
    'journal_entry',
    'fund_transfer',
    'cheque_record',
    'stock_movement',
    'stock_adjustment',
    'stock_transfer'
  ];
  return financialTypes.includes(entityType);
}

/**
 * Records a new conflict into IndexedDB and marks the corresponding outbox operation
 */
export async function recordConflict(params: {
  operationId: string;
  entityType: OutboxEntityType;
  entityId: string;
  conflictType: ConflictType;
  localPayload: any;
  serverPayload: any;
  fieldDifferences?: { field: string; localValue: any; serverValue: any }[];
}): Promise<SyncConflict> {
  const id = `conf_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const now = new Date().toISOString();

  const conflict: SyncConflict = {
    id,
    operationId: params.operationId,
    entityType: params.entityType,
    entityId: params.entityId,
    conflictType: params.conflictType,
    localPayload: params.localPayload,
    serverPayload: params.serverPayload,
    fieldDifferences: params.fieldDifferences || buildFieldDifferences(params.localPayload, params.serverPayload),
    detectedAt: now,
    status: 'unresolved'
  };

  await idbPut('sync_conflicts', conflict);
  await markOperationConflict(params.operationId, `Conflict: ${params.conflictType}`);

  return conflict;
}

/**
 * Gets all conflicts from IndexedDB
 */
export async function getAllConflicts(): Promise<SyncConflict[]> {
  return idbGetAll('sync_conflicts');
}

/**
 * Gets all unresolved conflicts
 */
export async function getUnresolvedConflicts(): Promise<SyncConflict[]> {
  const all = await getAllConflicts();
  return all.filter(c => c.status === 'unresolved');
}

/**
 * Performs a safe field-level merge for master data (parties, items, settings)
 * Non-overlapping fields are combined; for conflicting fields, chooses specified precedence.
 */
export function safeMergeMasterData(
  localObj: Record<string, any>,
  serverObj: Record<string, any>,
  preferLocal: boolean = true
): Record<string, any> {
  const base = preferLocal ? { ...serverObj, ...localObj } : { ...localObj, ...serverObj };
  // Keep server timestamps/identifiers intact
  if (serverObj.id) base.id = serverObj.id;
  if (serverObj.server_version) base.server_version = (serverObj.server_version || 0) + 1;
  base.updated_at = new Date().toISOString();
  return base;
}

/**
 * Resolves a conflict with a chosen strategy
 */
export async function resolveConflict(
  conflictId: string,
  strategy: ConflictResolutionStrategy,
  finalPayload?: any,
  resolvedBy: string = 'User',
  notes?: string
): Promise<SyncConflict | null> {
  const db = await getIDB();
  const conflict = await db.get('sync_conflicts', conflictId);
  if (!conflict) return null;

  conflict.status = 'resolved';
  conflict.resolutionStrategy = strategy;
  conflict.resolvedAt = new Date().toISOString();
  conflict.resolvedBy = resolvedBy;
  conflict.resolutionNotes = notes;

  let computedFinalPayload = finalPayload;

  if (!computedFinalPayload) {
    switch (strategy) {
      case 'keep_local':
        computedFinalPayload = conflict.localPayload;
        break;
      case 'keep_server':
        computedFinalPayload = conflict.serverPayload;
        break;
      case 'merge':
        computedFinalPayload = safeMergeMasterData(conflict.localPayload, conflict.serverPayload);
        break;
      default:
        computedFinalPayload = conflict.serverPayload;
    }
  }

  conflict.finalPayload = computedFinalPayload;
  await idbPut('sync_conflicts', conflict);

  // If there's an associated outbox operation, update its payload and reset to pending
  if (conflict.operationId) {
    const op = await db.get('sync_outbox', conflict.operationId);
    if (op) {
      if (strategy === 'keep_server') {
        // If keeping server, cancel outbox op since server already has the truth
        op.status = 'synced';
        op.syncedAt = new Date().toISOString();
      } else {
        op.payload = computedFinalPayload;
        op.status = 'pending';
        op.nextRetryAt = undefined;
        op.lastError = undefined;
      }
      op.updatedAt = new Date().toISOString();
      await idbPut('sync_outbox', op);
    }
  }

  return conflict;
}

/**
 * Dismisses a conflict without changing underlying records
 */
export async function dismissConflict(conflictId: string): Promise<void> {
  const db = await getIDB();
  const conflict = await db.get('sync_conflicts', conflictId);
  if (conflict) {
    conflict.status = 'dismissed';
    conflict.resolvedAt = new Date().toISOString();
    await idbPut('sync_conflicts', conflict);
  }
}
