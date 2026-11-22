/**
 * Multi-Warehouse & Stock Transfer Management Service
 */

import { Warehouse, StockTransfer, StockMovement, Product } from '../../types/inventory';
import { calculateCurrentStockFromMovements, createStockMovement } from './stockMovementService';
import { round2, safeAdd, safeSub, safeMul } from '../../utils/decimal';

export const DEFAULT_WAREHOUSE: Warehouse = {
  id: 'wh_default',
  name: 'Main Godown',
  code: 'MAIN',
  address: 'Central Business Warehouse',
  isDefault: true,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z'
};

/**
 * Validates inter-warehouse stock transfer.
 * Enforces:
 * 1. Source and Destination warehouses must be different.
 * 2. Sufficient stock must exist at source warehouse for every line item.
 * 3. Transfer quantities must be strictly positive.
 */
export function validateStockTransfer(
  sourceWarehouseId: string,
  destinationWarehouseId: string,
  items: { productId: string; quantity: number; productName?: string }[],
  movements: StockMovement[]
): { valid: boolean; error?: string } {
  if (!sourceWarehouseId || !destinationWarehouseId) {
    return { valid: false, error: 'Source and destination warehouses are required' };
  }

  if (sourceWarehouseId === destinationWarehouseId) {
    return { valid: false, error: 'Source and destination warehouse cannot be the same' };
  }

  if (!items || items.length === 0) {
    return { valid: false, error: 'At least one item is required for transfer' };
  }

  for (const item of items) {
    if (item.quantity <= 0) {
      return { valid: false, error: `Transfer quantity for ${item.productName || item.productId} must be greater than zero` };
    }

    const availableAtSource = calculateCurrentStockFromMovements(movements, item.productId, sourceWarehouseId);
    if (availableAtSource < item.quantity) {
      return {
        valid: false,
        error: `Insufficient stock at source warehouse for ${item.productName || item.productId}. Available: ${availableAtSource}, Requested: ${item.quantity}`
      };
    }
  }

  return { valid: true };
}

/**
 * Executes a stock transfer:
 * Creates paired stock movements:
 * 1. stock_transfer_out from source warehouse.
 * 2. stock_transfer_in to destination warehouse.
 * Total business inventory valuation remains constant!
 */
export function executeStockTransfer(
  transfer: StockTransfer,
  movements: StockMovement[],
  products: Product[],
  warehouses: Warehouse[]
): {
  newMovements: StockMovement[];
  updatedTransfer: StockTransfer;
} {
  const sourceWh = warehouses.find(w => w.id === transfer.sourceWarehouseId);
  const destWh = warehouses.find(w => w.id === transfer.destinationWarehouseId);

  const newMovements: StockMovement[] = [];

  for (const line of transfer.lines) {
    const product = products.find(p => p.id === line.productId);
    const unitCost = line.unitCost || product?.averageCost || product?.purchasePrice || 0;

    const sourceCurrent = calculateCurrentStockFromMovements(
      [...movements, ...newMovements],
      line.productId,
      transfer.sourceWarehouseId
    );

    // 1. Stock Out from Source
    const outMovement = createStockMovement({
      businessId: transfer.businessId,
      productId: line.productId,
      productName: line.productName,
      sku: line.sku,
      warehouseId: transfer.sourceWarehouseId,
      warehouseName: sourceWh?.name || 'Source Godown',
      movementType: 'stock_transfer_out',
      quantityOut: line.quantity,
      unitCost,
      date: transfer.date,
      referenceType: 'transfer',
      referenceId: transfer.id,
      referenceNumber: transfer.transferNumber,
      batchNumber: line.batchNumber,
      notes: `Transfer out to ${destWh?.name || 'Destination'}`,
      previousBalance: sourceCurrent
    });
    newMovements.push(outMovement);

    const destCurrent = calculateCurrentStockFromMovements(
      [...movements, ...newMovements],
      line.productId,
      transfer.destinationWarehouseId
    );

    // 2. Stock In to Destination
    const inMovement = createStockMovement({
      businessId: transfer.businessId,
      productId: line.productId,
      productName: line.productName,
      sku: line.sku,
      warehouseId: transfer.destinationWarehouseId,
      warehouseName: destWh?.name || 'Destination Godown',
      movementType: 'stock_transfer_in',
      quantityIn: line.quantity,
      unitCost,
      date: transfer.date,
      referenceType: 'transfer',
      referenceId: transfer.id,
      referenceNumber: transfer.transferNumber,
      batchNumber: line.batchNumber,
      notes: `Transfer in from ${sourceWh?.name || 'Source'}`,
      previousBalance: destCurrent
    });
    newMovements.push(inMovement);
  }

  const updatedTransfer: StockTransfer = {
    ...transfer,
    status: 'completed'
  };

  return {
    newMovements,
    updatedTransfer
  };
}
