/**
 * Offline Attachment Synchronization Service
 * Handles local binary/base64 storage, SHA-256 deduplication, queueing, and upload progress.
 */

import { OfflineAttachment, OutboxEntityType } from '../../types/sync';
import { getIDB, idbPut, idbGetAll } from '../storage/idb';
import { calculateSha256 } from './cryptoUtils';

/**
 * Stores an attachment file locally in IndexedDB and queues it for sync
 */
export async function storeAttachmentLocally(params: {
  businessId: string;
  entityType: OutboxEntityType;
  entityId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  base64Data: string;
}): Promise<OfflineAttachment> {
  const fileHash = await calculateSha256(params.base64Data);
  const db = await getIDB();

  // Deduplication check: if identical hash already exists for this entity, return it
  const all = await db.getAll('sync_attachments');
  const existing = all.find(a => a.fileHash === fileHash && a.entityId === params.entityId);
  if (existing) {
    return existing;
  }

  const id = `att_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const now = new Date().toISOString();

  const attachment: OfflineAttachment = {
    id,
    businessId: params.businessId,
    entityType: params.entityType,
    entityId: params.entityId,
    fileName: params.fileName,
    fileSize: params.fileSize,
    mimeType: params.mimeType,
    fileHash,
    base64Data: params.base64Data,
    status: 'local_only',
    retryCount: 0,
    createdAt: now
  };

  await idbPut('sync_attachments', attachment);
  return attachment;
}

/**
 * Retrieves all attachments that are local only or failed to upload
 */
export async function getPendingAttachments(): Promise<OfflineAttachment[]> {
  const all = await idbGetAll('sync_attachments');
  return all.filter(a => a.status === 'local_only' || a.status === 'failed');
}

/**
 * Retrieves all attachments for a specific business entity (e.g. invoice, expense)
 */
export async function getAttachmentsForEntity(
  entityType: OutboxEntityType,
  entityId: string
): Promise<OfflineAttachment[]> {
  const all = await idbGetAll('sync_attachments');
  return all.filter(a => a.entityType === entityType && a.entityId === entityId);
}

/**
 * Marks an attachment as uploaded to cloud storage
 */
export async function markAttachmentUploaded(
  attachmentId: string,
  storageUrl: string
): Promise<void> {
  const db = await getIDB();
  const att = await db.get('sync_attachments', attachmentId);
  if (att) {
    att.status = 'synced';
    att.storageUrl = storageUrl;
    att.uploadedAt = new Date().toISOString();
    // Clear base64 data to save local storage once confirmed uploaded
    att.base64Data = undefined;
    await idbPut('sync_attachments', att);
  }
}

/**
 * Marks an attachment upload as failed
 */
export async function markAttachmentUploadFailed(
  attachmentId: string,
  error: string
): Promise<void> {
  const db = await getIDB();
  const att = await db.get('sync_attachments', attachmentId);
  if (att) {
    att.status = 'failed';
    att.retryCount += 1;
    att.error = error;
    await idbPut('sync_attachments', att);
  }
}

/**
 * Deletes an attachment from local storage
 */
export async function deleteAttachment(attachmentId: string): Promise<void> {
  const db = await getIDB();
  await db.delete('sync_attachments', attachmentId);
}
