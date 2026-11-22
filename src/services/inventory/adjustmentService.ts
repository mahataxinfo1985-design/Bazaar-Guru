/**
 * Stock Adjustment & Stocktaking Service
 * Handles physical stock count reconciliation, shrinkage/damage write-offs, and surplus found stock.
 */

import { StockAdjustment, StockAdjustmentLine, StockMovement } from '../../types/inventory';
import { createStockMovement, calculateCurrentStockFromMovements } from './stockMovementService';
import { round2, safeAdd, safeSub, safeMul } from '../../utils/decimal';

/**
 * Calculates differences and financial impact between system quantity and physical count.
 */
export function calculateAdjustmentDifferences(
  lines: {
    productId: string;
    productName: string;
    sku?: string;
    systemQuantity: number;
    physicalQuantity: number;
    unitCost: number;
    reason: StockAdjustmentLine['reason'];
    batchNumber?: string;
  }[]
): {
  processedLines: StockAdjustmentLine[];
  totalAdjustmentValue: number;
  netQuantityDifference: number;
} {
  let totalAdjustmentValue = 0;
  let netQuantityDifference = 0;

  const processedLines: StockAdjustmentLine[] = lines.map((l, index) => {
    const diff = round2(safeSub(l.physicalQuantity, l.systemQuantity));
    const val = round2(safeMul(Math.abs(diff), l.unitCost));

    if (diff > 0) {
      // Surplus: adds value
      totalAdjustmentValue = safeAdd(totalAdjustmentValue, val);
    } else if (diff < 0) {
      // Loss: decreases value
      totalAdjustmentValue = safeSub(totalAdjustmentValue, val);
    }

    netQuantityDifference = safeAdd(netQuantityDifference, diff);

    return {
      id: `adj_line_${index}_${Date.now()}`,
      productId: l.productId,
      productName: l.productName,
      sku: l.sku,
      systemQuantity: round2(l.systemQuantity),
      physicalQuantity: round2(l.physicalQuantity),
      differenceQuantity: diff,
      unitCost: round2(l.unitCost),
      totalValue: val,
      reason: l.reason,
      batchNumber: l.batchNumber
    };
  });

  return {
    processedLines,
    totalAdjustmentValue: round2(totalAdjustmentValue),
    netQuantityDifference: round2(netQuantityDifference)
  };
}

/**
 * Processes a stock adjustment voucher and generates corresponding StockMovements.
 */
export function processStockAdjustment(
  adjustment: StockAdjustment,
  existingMovements: StockMovement[]
): {
  newMovements: StockMovement[];
  accountingImpact: {
    isLoss: boolean;
    lossAmount: number;
    gainAmount: number;
    netAdjustment: number;
  };
} {
  const newMovements: StockMovement[] = [];
  let lossAmount = 0;
  let gainAmount = 0;

  for (const line of adjustment.lines) {
    if (line.differenceQuantity === 0) continue;

    const currentStock = calculateCurrentStockFromMovements(
      [...existingMovements, ...newMovements],
      line.productId,
      adjustment.warehouseId
    );

    if (line.differenceQuantity > 0) {
      // Surplus stock found: quantity in
      gainAmount = safeAdd(gainAmount, line.totalValue);
      const movement = createStockMovement({
        businessId: adjustment.businessId,
        productId: line.productId,
        productName: line.productName,
        sku: line.sku,
        warehouseId: adjustment.warehouseId,
        warehouseName: adjustment.warehouseName,
        movementType: 'stock_adjustment',
        quantityIn: line.differenceQuantity,
        unitCost: line.unitCost,
        date: adjustment.date,
        referenceType: 'adjustment',
        referenceId: adjustment.id,
        referenceNumber: adjustment.adjustmentNumber,
        batchNumber: line.batchNumber,
        notes: `Stock surplus: ${line.reason}`,
        previousBalance: currentStock
      });
      newMovements.push(movement);
    } else {
      // Deficit/Damage/Shrinkage: quantity out
      const qtyOut = Math.abs(line.differenceQuantity);
      lossAmount = safeAdd(lossAmount, line.totalValue);

      const movementType = line.reason === 'damage' ? 'damage' : line.reason === 'expired' ? 'expiry' : 'write_off';

      const movement = createStockMovement({
        businessId: adjustment.businessId,
        productId: line.productId,
        productName: line.productName,
        sku: line.sku,
        warehouseId: adjustment.warehouseId,
        warehouseName: adjustment.warehouseName,
        movementType,
        quantityOut: qtyOut,
        unitCost: line.unitCost,
        date: adjustment.date,
        referenceType: 'adjustment',
        referenceId: adjustment.id,
        referenceNumber: adjustment.adjustmentNumber,
        batchNumber: line.batchNumber,
        notes: `Stock reduction: ${line.reason}`,
        previousBalance: currentStock
      });
      newMovements.push(movement);
    }
  }

  const netAdjustment = round2(safeSub(gainAmount, lossAmount));

  return {
    newMovements,
    accountingImpact: {
      isLoss: lossAmount > gainAmount,
      lossAmount: round2(lossAmount),
      gainAmount: round2(gainAmount),
      netAdjustment
    }
  };
}
