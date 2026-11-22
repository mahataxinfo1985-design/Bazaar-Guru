/**
 * Centralized Stock Movement Service
 * The single source of truth for stock quantities and stock movements in Invoice Pro.
 */

import { 
  Product, 
  StockMovement, 
  StockMovementType, 
  StockSummaryRow, 
  StockLedgerRow, 
  LowStockAlert,
  Warehouse
} from '../../types/inventory';
import { round2, safeAdd, safeSub, safeMul } from '../../utils/decimal';
import { idbGetAll, idbPut } from '../storage/idb';

/**
 * Checks if an item type tracks physical inventory.
 * Services and non-stock items MUST NOT generate physical stock movements!
 */
export function isPhysicalInventoryTracked(itemType?: string, trackStock: boolean = true): boolean {
  if (!trackStock) return false;
  if (!itemType) return true;
  const t = itemType.toLowerCase();
  return t !== 'service' && t !== 'non_stock';
}

/**
 * Computes exact current stock quantity for a product across all warehouses or in a specific warehouse
 * strictly from immutable StockMovement ledger records.
 */
export function calculateCurrentStockFromMovements(
  movements: StockMovement[],
  productId: string,
  warehouseId?: string
): number {
  let netQty = 0;
  for (const m of movements) {
    if (m.productId !== productId) continue;
    if (warehouseId && m.warehouseId !== warehouseId) continue;
    netQty = safeAdd(netQty, m.quantityIn);
    netQty = safeSub(netQty, m.quantityOut);
  }
  return round2(netQty);
}

/**
 * Validates whether sufficient stock exists for a proposed stock-out movement.
 */
export function validateStockAvailability(
  currentStock: number,
  quantityRequested: number,
  allowNegativeStock: boolean = false
): { allowed: boolean; error?: string } {
  if (quantityRequested <= 0) {
    return { allowed: false, error: 'Quantity must be greater than zero' };
  }
  if (!allowNegativeStock && currentStock < quantityRequested) {
    return {
      allowed: false,
      error: `Insufficient stock in hand. Available: ${currentStock}, Requested: ${quantityRequested}`
    };
  }
  return { allowed: true };
}

/**
 * Creates a stock movement record with audit trail.
 */
export function createStockMovement(params: {
  businessId?: string;
  productId: string;
  productName: string;
  sku?: string;
  warehouseId: string;
  warehouseName?: string;
  movementType: StockMovementType;
  quantityIn?: number;
  quantityOut?: number;
  unitCost: number;
  date?: string;
  referenceType: 'invoice' | 'purchase' | 'credit_note' | 'debit_note' | 'transfer' | 'adjustment' | 'opening' | 'manual';
  referenceId?: string;
  referenceNumber?: string;
  batchId?: string;
  batchNumber?: string;
  notes?: string;
  createdBy?: string;
  previousBalance?: number;
}): StockMovement {
  const qtyIn = round2(params.quantityIn || 0);
  const qtyOut = round2(params.quantityOut || 0);
  const qtyChange = round2(safeSub(qtyIn, qtyOut));
  const activeQty = qtyIn > 0 ? qtyIn : qtyOut;
  const totalCost = round2(safeMul(activeQty, params.unitCost));
  const previous = params.previousBalance !== undefined ? params.previousBalance : 0;
  const runningBalance = round2(safeAdd(previous, qtyChange));

  return {
    id: `sm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    businessId: params.businessId,
    productId: params.productId,
    productName: params.productName,
    sku: params.sku,
    warehouseId: params.warehouseId,
    warehouseName: params.warehouseName,
    movementType: params.movementType,
    quantityIn: qtyIn,
    quantityOut: qtyOut,
    quantityChange: qtyChange,
    runningBalance,
    unitCost: round2(params.unitCost),
    totalCost,
    date: params.date || new Date().toISOString().split('T')[0],
    referenceType: params.referenceType,
    referenceId: params.referenceId,
    referenceNumber: params.referenceNumber,
    batchId: params.batchId,
    batchNumber: params.batchNumber,
    notes: params.notes,
    createdBy: params.createdBy,
    createdAt: new Date().toISOString()
  };
}

/**
 * Builds the comprehensive Stock Summary report by aggregating movements per product.
 */
export function buildStockSummary(
  products: Product[],
  movements: StockMovement[],
  warehouseId?: string
): StockSummaryRow[] {
  const summaryMap = new Map<string, StockSummaryRow>();

  for (const p of products) {
    if (!isPhysicalInventoryTracked(p.itemType, p.trackStock)) continue;

    summaryMap.set(p.id, {
      productId: p.id,
      productName: p.name,
      sku: p.sku || p.barcode || p.hsnCode || 'N/A',
      category: p.category || 'General',
      unit: p.unit || 'PCS',
      openingStock: round2(p.openingStock || 0),
      stockIn: 0,
      stockOut: 0,
      closingStock: round2(p.openingStock || 0),
      averageCost: p.averageCost || p.purchasePrice || 0,
      valuation: round2(safeMul(p.openingStock || 0, p.averageCost || p.purchasePrice || 0)),
      reorderLevel: p.reorderLevel || p.minStockLevel || 10,
      status: 'In Stock'
    });
  }

  // Aggregate movements
  for (const m of movements) {
    if (warehouseId && m.warehouseId !== warehouseId) continue;
    const row = summaryMap.get(m.productId);
    if (!row) continue;

    if (m.movementType === 'opening_stock') {
      // already represented or synced
      row.openingStock = round2(m.quantityIn);
    } else {
      row.stockIn = round2(safeAdd(row.stockIn, m.quantityIn));
      row.stockOut = round2(safeAdd(row.stockOut, m.quantityOut));
    }
  }

  // Finalize closing stock & valuation
  const rows: StockSummaryRow[] = [];
  for (const row of summaryMap.values()) {
    const netChange = safeSub(row.stockIn, row.stockOut);
    row.closingStock = round2(safeAdd(row.openingStock, netChange));
    row.valuation = round2(Math.max(0, safeMul(row.closingStock, row.averageCost)));

    if (row.closingStock <= 0) {
      row.status = 'Out of Stock';
    } else if (row.closingStock <= row.reorderLevel) {
      row.status = 'Low Stock';
    } else {
      row.status = 'In Stock';
    }

    rows.push(row);
  }

  return rows.sort((a, b) => a.productName.localeCompare(b.productName));
}

/**
 * Builds chronological Stock Ledger report with running quantities.
 */
export function buildStockLedger(
  movements: StockMovement[],
  productId?: string,
  warehouseId?: string
): StockLedgerRow[] {
  const filtered = movements
    .filter(m => (!productId || m.productId === productId) && (!warehouseId || m.warehouseId === warehouseId))
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

  let running = 0;
  const rows: StockLedgerRow[] = [];

  for (const m of filtered) {
    running = round2(safeAdd(running, m.quantityChange));
    rows.push({
      id: m.id,
      date: m.date,
      movementType: m.movementType,
      referenceType: m.referenceType,
      referenceNumber: m.referenceNumber || 'N/A',
      warehouseName: m.warehouseName || 'Default Godown',
      quantityIn: m.quantityIn,
      quantityOut: m.quantityOut,
      runningBalance: running,
      unitCost: m.unitCost,
      totalValue: m.totalCost,
      notes: m.notes
    });
  }

  return rows;
}

/**
 * Detects low stock and reorder alerts.
 */
export function detectLowStockAlerts(
  products: Product[],
  movements: StockMovement[]
): LowStockAlert[] {
  const alerts: LowStockAlert[] = [];

  for (const p of products) {
    if (!isPhysicalInventoryTracked(p.itemType, p.trackStock)) continue;
    const hasMovements = movements.some(m => m.productId === p.id);
    const currentStock = hasMovements 
      ? calculateCurrentStockFromMovements(movements, p.id) 
      : (p.stockQty ?? 0);
    const threshold = p.reorderLevel || p.minStockLevel || 10;

    if (currentStock <= threshold) {
      alerts.push({
        productId: p.id,
        productName: p.name,
        sku: p.sku || p.barcode || p.hsnCode || 'N/A',
        currentStock,
        reorderLevel: threshold,
        minStockLevel: p.minStockLevel || 5,
        deficit: round2(Math.max(0, safeSub(threshold, currentStock))),
        unit: p.unit || 'PCS'
      });
    }
  }

  return alerts.sort((a, b) => a.currentStock - b.currentStock);
}

/**
 * Persists a stock movement and updates product inventory balance atomically.
 */
export async function recordStockMovement(params: {
  businessId?: string;
  productId: string;
  warehouseId: string;
  movementType: 'in' | 'out';
  quantity: number;
  unitCost?: number;
  referenceType: 'sale' | 'purchase' | 'credit_note' | 'debit_note' | 'delivery_challan' | 'grn' | 'adjustment' | 'transfer' | 'manual';
  referenceId?: string;
  referenceNumber?: string;
  date?: string;
  notes?: string;
}): Promise<StockMovement> {
  const [items, movements] = await Promise.all([
    idbGetAll('items'),
    idbGetAll('stock_movements')
  ]);

  const item = items.find(i => i.id === params.productId);
  const currentStock = calculateCurrentStockFromMovements(movements, params.productId, params.warehouseId);

  const sm = createStockMovement({
    businessId: params.businessId,
    productId: params.productId,
    productName: item?.name || 'Product',
    sku: (item as any)?.sku,
    warehouseId: params.warehouseId,
    movementType: params.movementType === 'in' ? 'inward' : 'outward',
    quantityIn: params.movementType === 'in' ? params.quantity : 0,
    quantityOut: params.movementType === 'out' ? params.quantity : 0,
    unitCost: params.unitCost ?? (item?.unitPrice || 0),
    referenceType: (params.referenceType === 'sale' ? 'invoice' : params.referenceType === 'delivery_challan' ? 'transfer' : params.referenceType === 'grn' ? 'purchase' : params.referenceType) as any,
    referenceId: params.referenceId,
    referenceNumber: params.referenceNumber,
    date: params.date,
    notes: params.notes,
    previousBalance: currentStock
  });

  await idbPut('stock_movements', sm);

  // Update Item stockQty in master store
  if (item) {
    if (params.movementType === 'in') {
      item.stockQty = safeAdd(item.stockQty || 0, params.quantity);
    } else {
      item.stockQty = safeSub(item.stockQty || 0, params.quantity);
    }
    await idbPut('items', item);
  }

  return sm;
}
