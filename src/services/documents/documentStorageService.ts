import { StoredBusinessDocument, BusinessDocCategory } from '../../types/workspace';
import { idbGetAll, idbPut, idbDelete } from '../storage/idb';

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
];

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Validates and saves a business compliance or operational document.
 */
export async function saveBusinessDocument(
  doc: Omit<StoredBusinessDocument, 'id' | 'uploadedAt'>
): Promise<StoredBusinessDocument> {
  if (doc.fileSize > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File size ${(doc.fileSize / (1024 * 1024)).toFixed(1)}MB exceeds 5MB limit.`);
  }

  if (doc.mimeType && !ALLOWED_MIME_TYPES.includes(doc.mimeType) && !doc.mimeType.startsWith('image/')) {
    throw new Error(`File type ${doc.mimeType} is not supported. Please upload PDF or image files.`);
  }

  const storedDoc: StoredBusinessDocument = {
    ...doc,
    id: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    uploadedAt: new Date().toISOString()
  };

  await idbPut('business_documents', storedDoc);
  return storedDoc;
}

/**
 * Retrieves all stored documents with optional category filter.
 */
export async function getBusinessDocuments(category?: BusinessDocCategory): Promise<StoredBusinessDocument[]> {
  const docs = await idbGetAll('business_documents');
  if (category) {
    return docs.filter(d => d.category === category);
  }
  return docs.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
}

/**
 * Deletes a stored document by ID.
 */
export async function deleteBusinessDocument(id: string): Promise<void> {
  await idbDelete('business_documents', id);
}
