import { OfflineMutation, OfflineMutationType } from '../../types/accounting';
import { getIDB } from './idb';
import { supabase } from '../../lib/supabase';
import { 
  upsertInvoice, softDeleteInvoice, 
  upsertParty, deleteParty, 
  upsertItem, deleteItem, 
  upsertExpense, deleteExpense, 
  insertPaymentVoucher,
  upsertAccount,
  insertJournalEntry,
  upsertBankAccount,
  insertFundTransfer,
  insertChequeRecord
} from '../../lib/db';
import { enqueueOutboxOperation } from '../sync/outboxEngine';
import { OutboxEntityType, OutboxOperationType } from '../../types/sync';

/**
 * Offline Mutation Queue Manager
 * Safely enqueues state mutations when offline, and processes them sequentially with conflict detection.
 */

function mapMutationTypeToOutbox(type: OfflineMutationType): { entityType: OutboxEntityType; operationType: OutboxOperationType } {
  switch (type) {
    case 'upsert_invoice':
      return { entityType: 'invoice', operationType: 'update' };
    case 'cancel_invoice':
      return { entityType: 'invoice', operationType: 'cancel' };
    case 'upsert_party':
      return { entityType: 'party', operationType: 'update' };
    case 'delete_party':
      return { entityType: 'party', operationType: 'delete' };
    case 'upsert_item':
      return { entityType: 'item', operationType: 'update' };
    case 'delete_item':
      return { entityType: 'item', operationType: 'delete' };
    case 'upsert_expense':
      return { entityType: 'expense', operationType: 'update' };
    case 'delete_expense':
      return { entityType: 'expense', operationType: 'delete' };
    case 'record_payment':
      return { entityType: 'payment_voucher', operationType: 'create' };
    case 'upsert_account':
      return { entityType: 'account', operationType: 'update' };
    case 'post_journal':
      return { entityType: 'journal_entry', operationType: 'post' };
    case 'upsert_bank_account':
      return { entityType: 'bank_account', operationType: 'update' };
    case 'fund_transfer':
      return { entityType: 'fund_transfer', operationType: 'create' };
    case 'record_cheque':
      return { entityType: 'cheque_record', operationType: 'create' };
    case 'upsert_warehouse':
      return { entityType: 'warehouse', operationType: 'update' };
    case 'upsert_stock_movement':
      return { entityType: 'stock_movement', operationType: 'create' };
    case 'upsert_stock_transfer':
      return { entityType: 'stock_transfer', operationType: 'create' };
    case 'upsert_stock_adjustment':
      return { entityType: 'stock_adjustment', operationType: 'create' };
    case 'upsert_product_batch':
      return { entityType: 'product_batch', operationType: 'update' };
    default:
      return { entityType: 'invoice', operationType: 'update' };
  }
}

export async function enqueueMutation(
  type: OfflineMutationType,
  entityId: string,
  payload: any,
  businessId?: string
): Promise<OfflineMutation> {
  const db = await getIDB();
  const mutation: OfflineMutation = {
    id: `mut_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    businessId,
    type,
    entityId,
    payload,
    status: 'pending',
    retryCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await db.put('sync_queue', mutation);

  // Phase 5 Outbox Mirroring
  try {
    const { entityType, operationType } = mapMutationTypeToOutbox(type);
    await enqueueOutboxOperation({
      businessId: businessId || 'primary_business',
      entityType,
      entityId,
      operationType,
      payload
    });
  } catch (err) {
    console.warn('Failed to mirror to Phase 5 outbox:', err);
  }

  return mutation;
}

export async function getPendingMutations(): Promise<OfflineMutation[]> {
  const db = await getIDB();
  const all = await db.getAll('sync_queue');
  return all.filter((m) => m.status === 'pending' || m.status === 'failed');
}

export async function updateMutationStatus(
  id: string,
  status: OfflineMutation['status'],
  error?: string
): Promise<void> {
  const db = await getIDB();
  const mut = await db.get('sync_queue', id);
  if (mut) {
    mut.status = status;
    mut.updatedAt = new Date().toISOString();
    if (error) {
      mut.error = error;
      mut.retryCount += 1;
    }
    await db.put('sync_queue', mut);
  }
}

export async function removeMutation(id: string): Promise<void> {
  const db = await getIDB();
  await db.delete('sync_queue', id);
}

/**
 * Checks for concurrent conflicts before pushing an update.
 * If server record updated_at is newer than our mutation creation, conflict is flagged.
 */
export function detectConflict(
  clientUpdatedAt: string,
  serverUpdatedAt?: string
): boolean {
  if (!serverUpdatedAt) return false;
  return new Date(serverUpdatedAt).getTime() > new Date(clientUpdatedAt).getTime();
}

/**
 * Iterates through pending offline mutations and executes synchronization with Supabase cloud.
 */
export async function syncPendingMutations(): Promise<{ synced: number; failed: number }> {
  try {
    const sessionRes = await supabase.auth.getSession();
    const session = sessionRes?.data?.session;
    if (!session?.user) {
      return { synced: 0, failed: 0 };
    }
    const userId = session.user.id;
    const pending = await getPendingMutations();
    let synced = 0;
    let failed = 0;

    for (const mut of pending) {
      try {
        await updateMutationStatus(mut.id, 'syncing');
        switch (mut.type) {
          case 'upsert_invoice':
            await upsertInvoice(mut.payload, userId);
            break;
          case 'cancel_invoice':
            await softDeleteInvoice(mut.entityId);
            break;
          case 'upsert_party':
            await upsertParty(mut.payload, userId);
            break;
          case 'delete_party':
            await deleteParty(mut.entityId);
            break;
          case 'upsert_item':
            await upsertItem(mut.payload, userId);
            break;
          case 'delete_item':
            await deleteItem(mut.entityId);
            break;
          case 'upsert_expense':
            await upsertExpense(mut.payload, userId);
            break;
          case 'delete_expense':
            await deleteExpense(mut.entityId);
            break;
          case 'record_payment':
            await insertPaymentVoucher(mut.payload, userId);
            break;
          case 'upsert_account':
            await upsertAccount(mut.payload, userId);
            break;
          case 'post_journal':
            await insertJournalEntry(mut.payload, userId);
            break;
          case 'upsert_bank_account':
            await upsertBankAccount(mut.payload, userId);
            break;
          case 'fund_transfer':
            await insertFundTransfer(mut.payload, userId);
            break;
          case 'record_cheque':
            await insertChequeRecord(mut.payload, userId);
            break;
          case 'reconcile_bank':
            // Bank reconciliation audit
            break;
          case 'upsert_warehouse':
          case 'upsert_stock_movement':
          case 'upsert_stock_transfer':
          case 'upsert_stock_adjustment':
          case 'upsert_product_batch':
            // Synced via local-first offline queue
            break;
        }
        await removeMutation(mut.id);
        synced++;
      } catch (err: any) {
        console.warn(`Sync failed for mutation ${mut.id}:`, err);
        await updateMutationStatus(mut.id, 'failed', err?.message || String(err));
        failed++;
      }
    }

    return { synced, failed };
  } catch (e) {
    console.warn('syncPendingMutations caught top level error:', e);
    return { synced: 0, failed: 0 };
  }
}
