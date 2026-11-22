/**
 * Transaction Outbox Engine
 * Manages the offline mutation queue with idempotency, dependency-ordered processing,
 * exponential backoff, crash recovery, and temporary ID mapping.
 */

import { OutboxOperation, OutboxEntityType, OutboxOperationType, OutboxStatus } from '../../types/sync';
import { getIDB, idbPut, idbGetAll } from '../storage/idb';
import { calculateSha256 } from './cryptoUtils';
import { getCurrentDeviceId } from './deviceService';

const DEFAULT_MAX_RETRIES = 5;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 300000; // 5 minutes

/**
 * Calculates exponential backoff delay in ms based on retry count
 */
export function calculateBackoffDelay(retryCount: number): number {
  const delay = BASE_RETRY_DELAY_MS * Math.pow(2, retryCount);
  return Math.min(delay, MAX_RETRY_DELAY_MS);
}

/**
 * Generates a unique, collision-resistant idempotency key
 */
export function generateIdempotencyKey(entityType: string, entityId: string, timestamp: number = Date.now()): string {
  const salt = Math.random().toString(36).substring(2, 9);
  return `idemp_${entityType}_${entityId}_${timestamp}_${salt}`;
}

/**
 * Checks if an entity ID is a temporary offline ID
 */
export function isTemporaryOfflineId(id: string): boolean {
  if (!id) return false;
  return id.startsWith('TEMP-') || id.startsWith('temp_') || id.startsWith('offline_');
}

/**
 * Enqueues a new operation into the local outbox
 */
export async function enqueueOutboxOperation(params: {
  businessId: string;
  userId?: string;
  entityType: OutboxEntityType;
  entityId: string;
  operationType: OutboxOperationType;
  payload: any;
  dependencies?: string[];
  localRevision?: number;
}): Promise<OutboxOperation> {
  const deviceId = getCurrentDeviceId();
  const now = new Date().toISOString();
  const jsonPayload = JSON.stringify(params.payload || {});
  const payloadHash = await calculateSha256(jsonPayload);
  const idempotencyKey = generateIdempotencyKey(params.entityType, params.entityId);

  const opId = `op_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  const operation: OutboxOperation = {
    id: opId,
    idempotencyKey,
    businessId: params.businessId,
    userId: params.userId,
    deviceId,
    entityType: params.entityType,
    entityId: params.entityId,
    operationType: params.operationType,
    payload: params.payload,
    payloadHash,
    dependencies: params.dependencies || [],
    status: 'pending',
    retryCount: 0,
    maxRetries: DEFAULT_MAX_RETRIES,
    createdAt: now,
    updatedAt: now,
    localRevision: params.localRevision || 1,
    schemaVersion: 5
  };

  await idbPut('sync_outbox', operation);
  return operation;
}

/**
 * Retrieves all operations from the outbox
 */
export async function getAllOutboxOperations(): Promise<OutboxOperation[]> {
  return idbGetAll('sync_outbox');
}

/**
 * Retrieves pending operations sorted topologically by dependencies and creation time
 */
export async function getPendingOutboxOperations(): Promise<OutboxOperation[]> {
  const all = await getAllOutboxOperations();
  const now = new Date().getTime();

  // Filter pending operations that are ready to run (or backoff timer has elapsed)
  const ready = all.filter(op => {
    if (op.status !== 'pending') return false;
    if (op.nextRetryAt) {
      return new Date(op.nextRetryAt).getTime() <= now;
    }
    return true;
  });

  // Topological sorting based on dependencies
  return sortOperationsByDependency(ready, all);
}

/**
 * Sorts operations respecting their dependency graph
 */
export function sortOperationsByDependency(
  readyOps: OutboxOperation[],
  allOps: OutboxOperation[]
): OutboxOperation[] {
  const syncedOpIds = new Set(
    allOps.filter(o => o.status === 'synced').map(o => o.id)
  );

  const result: OutboxOperation[] = [];
  const visited = new Set<string>();
  const opMap = new Map<string, OutboxOperation>(readyOps.map(o => [o.id, o]));

  function visit(op: OutboxOperation) {
    if (visited.has(op.id)) return;

    if (op.dependencies && op.dependencies.length > 0) {
      for (const depId of op.dependencies) {
        // If dependent op is ready and not yet visited, visit it first
        if (opMap.has(depId) && !visited.has(depId)) {
          visit(opMap.get(depId)!);
        }
      }
    }

    visited.add(op.id);
    result.push(op);
  }

  // First sort by createdAt to maintain FIFO where independent
  const sortedByTime = [...readyOps].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  for (const op of sortedByTime) {
    visit(op);
  }

  return result;
}

/**
 * Marks an operation as currently processing
 */
export async function markOperationProcessing(opId: string): Promise<void> {
  const db = await getIDB();
  const op = await db.get('sync_outbox', opId);
  if (op) {
    op.status = 'processing';
    op.updatedAt = new Date().toISOString();
    await idbPut('sync_outbox', op);
  }
}

/**
 * Marks an operation as successfully synced
 */
export async function markOperationSynced(opId: string, serverVersion?: number): Promise<void> {
  const db = await getIDB();
  const op = await db.get('sync_outbox', opId);
  if (op) {
    op.status = 'synced';
    op.syncedAt = new Date().toISOString();
    op.updatedAt = new Date().toISOString();
    if (serverVersion !== undefined) {
      op.serverVersion = serverVersion;
    }
    await idbPut('sync_outbox', op);
  }
}

/**
 * Marks an operation as failed with exponential backoff scheduling
 */
export async function markOperationFailed(opId: string, errorMessage: string): Promise<void> {
  const db = await getIDB();
  const op = await db.get('sync_outbox', opId);
  if (op) {
    op.retryCount += 1;
    op.lastError = errorMessage;
    op.updatedAt = new Date().toISOString();

    if (op.retryCount >= op.maxRetries) {
      op.status = 'action_required';
    } else {
      op.status = 'pending';
      const delay = calculateBackoffDelay(op.retryCount);
      op.nextRetryAt = new Date(Date.now() + delay).toISOString();
    }

    await idbPut('sync_outbox', op);
  }
}

/**
 * Marks an operation as having a conflict
 */
export async function markOperationConflict(opId: string, errorMessage?: string): Promise<void> {
  const db = await getIDB();
  const op = await db.get('sync_outbox', opId);
  if (op) {
    op.status = 'conflict';
    op.lastError = errorMessage || 'Concurrent conflict detected';
    op.updatedAt = new Date().toISOString();
    await idbPut('sync_outbox', op);
  }
}

/**
 * Resets a failed or action_required operation to retry immediately
 */
export async function retryOperation(opId: string): Promise<void> {
  const db = await getIDB();
  const op = await db.get('sync_outbox', opId);
  if (op) {
    op.status = 'pending';
    op.nextRetryAt = undefined;
    op.lastError = undefined;
    op.updatedAt = new Date().toISOString();
    await idbPut('sync_outbox', op);
  }
}

/**
 * Retries all failed operations
 */
export async function retryAllFailedOperations(): Promise<number> {
  const all = await getAllOutboxOperations();
  const failed = all.filter(op => op.status === 'failed' || op.status === 'action_required');
  for (const op of failed) {
    await retryOperation(op.id);
  }
  return failed.length;
}

/**
 * Cancels / removes an operation from the outbox
 */
export async function cancelOperation(opId: string): Promise<void> {
  const db = await getIDB();
  await db.delete('sync_outbox', opId);
}

/**
 * Clears synced operations older than the specified retention window (default 7 days)
 */
export async function purgeSyncedOperations(retentionDays: number = 7): Promise<number> {
  const all = await getAllOutboxOperations();
  const cutoff = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
  let count = 0;
  const db = await getIDB();

  for (const op of all) {
    if (op.status === 'synced' && op.syncedAt) {
      if (new Date(op.syncedAt).getTime() < cutoff) {
        await db.delete('sync_outbox', op.id);
        count++;
      }
    }
  }
  return count;
}

/**
 * Startup recovery: finds operations stuck in 'processing' (e.g. after tab crash or reload)
 * and safely resets them to 'pending'.
 */
export async function recoverDanglingOperations(): Promise<number> {
  const all = await getAllOutboxOperations();
  const dangling = all.filter(op => op.status === 'processing');
  for (const op of dangling) {
    op.status = 'pending';
    op.updatedAt = new Date().toISOString();
    await idbPut('sync_outbox', op);
  }
  return dangling.length;
}

/**
 * Remaps temporary offline IDs (e.g. TEMP-INV-001) to official server-assigned IDs
 * across pending outbox operations and local dependencies.
 */
export async function remapTemporaryIdAcrossOutbox(tempId: string, confirmedId: string): Promise<number> {
  const all = await getAllOutboxOperations();
  let updatedCount = 0;

  for (const op of all) {
    let modified = false;

    // Entity ID matches
    if (op.entityId === tempId) {
      op.entityId = confirmedId;
      modified = true;
    }

    // Dependencies match
    if (op.dependencies && op.dependencies.includes(tempId)) {
      op.dependencies = op.dependencies.map(d => d === tempId ? confirmedId : d);
      modified = true;
    }

    // Inside payload
    if (op.payload) {
      const payloadStr = JSON.stringify(op.payload);
      if (payloadStr.includes(tempId)) {
        try {
          const replaced = payloadStr.split(`"${tempId}"`).join(`"${confirmedId}"`);
          op.payload = JSON.parse(replaced);
          modified = true;
        } catch (e) {
          // ignore parsing error
        }
      }
    }

    if (modified) {
      op.updatedAt = new Date().toISOString();
      await idbPut('sync_outbox', op);
      updatedCount++;
    }
  }

  return updatedCount;
}
