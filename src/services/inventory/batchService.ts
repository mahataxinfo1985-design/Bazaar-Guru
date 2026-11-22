/**
 * Product Batch & Expiry Tracking Service
 */

import { ProductBatch } from '../../types/inventory';
import { round2, safeSub } from '../../utils/decimal';

/**
 * Validates batch creation parameters.
 */
export function validateBatch(params: {
  batchNumber: string;
  expiryDate: string;
  manufacturingDate?: string;
  quantityReceived: number;
}): { valid: boolean; error?: string } {
  if (!params.batchNumber.trim()) {
    return { valid: false, error: 'Batch number is required' };
  }
  if (!params.expiryDate) {
    return { valid: false, error: 'Expiry date is required for batch tracking' };
  }
  if (params.quantityReceived <= 0) {
    return { valid: false, error: 'Quantity received must be greater than zero' };
  }
  if (params.manufacturingDate && params.manufacturingDate > params.expiryDate) {
    return { valid: false, error: 'Manufacturing date cannot be after expiry date' };
  }
  return { valid: true };
}

/**
 * Deducts stock from a specific batch on sale/transfer.
 */
export function deductBatchStock(
  batches: ProductBatch[],
  batchNumber: string,
  productId: string,
  quantityToDeduct: number
): {
  updatedBatches: ProductBatch[];
  success: boolean;
  error?: string;
} {
  const batch = batches.find(b => b.productId === productId && b.batchNumber === batchNumber);
  if (!batch) {
    return { updatedBatches: batches, success: false, error: `Batch ${batchNumber} not found for product` };
  }

  if (batch.remainingQuantity < quantityToDeduct) {
    return {
      updatedBatches: batches,
      success: false,
      error: `Insufficient quantity in batch ${batchNumber}. Available: ${batch.remainingQuantity}, Requested: ${quantityToDeduct}`
    };
  }

  const updatedBatches = batches.map(b => {
    if (b.id === batch.id) {
      return {
        ...b,
        remainingQuantity: round2(safeSub(b.remainingQuantity, quantityToDeduct)),
        updatedAt: new Date().toISOString()
      };
    }
    return b;
  });

  return { updatedBatches, success: true };
}

/**
 * Identifies batches nearing expiry within a specified number of days (e.g. 30, 60, 90 days).
 */
export function getNearExpiryBatches(
  batches: ProductBatch[],
  daysThreshold: number = 60,
  referenceDateStr?: string
): ProductBatch[] {
  const refDate = referenceDateStr ? new Date(referenceDateStr) : new Date();
  const thresholdDate = new Date(refDate.getTime() + daysThreshold * 24 * 60 * 60 * 1000);
  const refDateStr = refDate.toISOString().split('T')[0];
  const thresholdDateStr = thresholdDate.toISOString().split('T')[0];

  return batches
    .filter(b => b.remainingQuantity > 0 && b.expiryDate >= refDateStr && b.expiryDate <= thresholdDateStr)
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
}

/**
 * Identifies expired batches with remaining stock.
 */
export function getExpiredBatches(
  batches: ProductBatch[],
  asOfDateStr?: string
): ProductBatch[] {
  const asOf = asOfDateStr || new Date().toISOString().split('T')[0];
  return batches
    .filter(b => b.remainingQuantity > 0 && b.expiryDate < asOf)
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
}
