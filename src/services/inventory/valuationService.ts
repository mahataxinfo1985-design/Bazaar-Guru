/**
 * Inventory Valuation Service
 * Supports Weighted Average Cost (WAC) and FIFO (First In, First Out)
 * Decimal-safe calculations via decimal.ts
 */

import { InventoryValuationLayer, StockMovement, ValuationMethod } from '../../types/inventory';
import { round2, safeAdd, safeSub, safeMul, safeDiv } from '../../utils/decimal';

/**
 * Calculates new Weighted Average Cost after an incoming purchase.
 * WAC = (Existing Inventory Value + Incoming Purchase Value) / (Existing Qty + Incoming Qty)
 */
export function computeWeightedAverageCost(
  currentQty: number,
  currentValuation: number,
  incomingQty: number,
  incomingCost: number
): number {
  if (incomingQty <= 0) {
    return currentQty > 0 ? round2(safeDiv(currentValuation, currentQty)) : 0;
  }

  const incomingTotal = safeMul(incomingQty, incomingCost);

  // If current quantity is 0 or negative (overdraft/negative stock), new incoming cost establishes base
  if (currentQty <= 0) {
    return round2(incomingCost);
  }

  const newTotalQty = safeAdd(currentQty, incomingQty);
  const newTotalValuation = safeAdd(currentValuation, incomingTotal);

  if (newTotalQty <= 0) return 0;
  return round2(safeDiv(newTotalValuation, newTotalQty));
}

/**
 * Calculates Cost of Goods Sold (COGS) and remaining valuation using Weighted Average Cost.
 */
export function calculateCOGSWeightedAverage(
  quantitySold: number,
  currentQty: number,
  averageCost: number
): {
  cogsAmount: number;
  newQuantity: number;
  newValuation: number;
} {
  const cogsAmount = round2(safeMul(quantitySold, averageCost));
  const newQuantity = round2(safeSub(currentQty, quantitySold));
  const newValuation = round2(Math.max(0, safeMul(newQuantity, averageCost)));

  return {
    cogsAmount,
    newQuantity,
    newValuation
  };
}

/**
 * Adds a new purchase layer to FIFO layers list.
 */
export function addValuationLayer(
  layers: InventoryValuationLayer[],
  newLayer: {
    productId: string;
    warehouseId?: string;
    purchaseDate: string;
    referenceType: 'purchase' | 'opening' | 'adjustment';
    referenceId?: string;
    quantity: number;
    unitCost: number;
  }
): InventoryValuationLayer[] {
  if (newLayer.quantity <= 0) return layers;

  const layer: InventoryValuationLayer = {
    id: `layer_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    productId: newLayer.productId,
    warehouseId: newLayer.warehouseId,
    purchaseDate: newLayer.purchaseDate,
    referenceType: newLayer.referenceType,
    referenceId: newLayer.referenceId,
    originalQuantity: newLayer.quantity,
    remainingQuantity: newLayer.quantity,
    unitCost: round2(newLayer.unitCost),
    totalCost: round2(safeMul(newLayer.quantity, newLayer.unitCost)),
    createdAt: new Date().toISOString()
  };

  return [...layers, layer];
}

/**
 * Consumes FIFO inventory layers chronologically (oldest layer first).
 */
export function consumeFIFOLayers(
  layers: InventoryValuationLayer[],
  productId: string,
  quantityToConsume: number,
  warehouseId?: string
): {
  cogsAmount: number;
  updatedLayers: InventoryValuationLayer[];
  consumedLayers: { layerId: string; quantityConsumed: number; unitCost: number }[];
} {
  if (quantityToConsume <= 0) {
    return { cogsAmount: 0, updatedLayers: layers, consumedLayers: [] };
  }

  // Filter relevant product layers, sorted by purchase date ascending
  const relevantLayers = layers
    .filter(l => l.productId === productId && (!warehouseId || !l.warehouseId || l.warehouseId === warehouseId))
    .sort((a, b) => a.purchaseDate.localeCompare(b.purchaseDate));

  let needed = quantityToConsume;
  let totalCogs = 0;
  const consumed: { layerId: string; quantityConsumed: number; unitCost: number }[] = [];
  const updatedLayers = layers.map(l => ({ ...l }));

  for (const layer of updatedLayers) {
    if (layer.productId !== productId) continue;
    if (warehouseId && layer.warehouseId && layer.warehouseId !== warehouseId) continue;
    if (layer.remainingQuantity <= 0) continue;

    const consumeFromThisLayer = Math.min(layer.remainingQuantity, needed);
    const layerCost = round2(safeMul(consumeFromThisLayer, layer.unitCost));

    layer.remainingQuantity = round2(safeSub(layer.remainingQuantity, consumeFromThisLayer));
    layer.totalCost = round2(safeMul(layer.remainingQuantity, layer.unitCost));

    totalCogs = safeAdd(totalCogs, layerCost);
    consumed.push({
      layerId: layer.id,
      quantityConsumed: consumeFromThisLayer,
      unitCost: layer.unitCost
    });

    needed = round2(safeSub(needed, consumeFromThisLayer));
    if (needed <= 0) break;
  }

  // If needed quantity exceeds available FIFO layers (e.g. negative stock permitted), fallback to last layer cost or 0
  if (needed > 0) {
    const fallbackCost = relevantLayers.length > 0 ? relevantLayers[relevantLayers.length - 1].unitCost : 0;
    const provisionalCost = round2(safeMul(needed, fallbackCost));
    totalCogs = safeAdd(totalCogs, provisionalCost);
  }

  return {
    cogsAmount: round2(totalCogs),
    updatedLayers,
    consumedLayers: consumed
  };
}

/**
 * Restores FIFO layers on Sales Return.
 */
export function restoreFIFOLayers(
  layers: InventoryValuationLayer[],
  productId: string,
  quantityToRestore: number,
  unitCost: number,
  referenceId?: string
): InventoryValuationLayer[] {
  if (quantityToRestore <= 0) return layers;

  const returnLayer: InventoryValuationLayer = {
    id: `layer_ret_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    productId,
    purchaseDate: new Date().toISOString().split('T')[0],
    referenceType: 'adjustment',
    referenceId,
    originalQuantity: quantityToRestore,
    remainingQuantity: quantityToRestore,
    unitCost: round2(unitCost),
    totalCost: round2(safeMul(quantityToRestore, unitCost)),
    createdAt: new Date().toISOString()
  };

  // Returned layer goes to top of available FIFO queue
  return [returnLayer, ...layers];
}

/**
 * Reconstructs historical inventory valuation as of a specific date from immutable StockMovements.
 */
export function getHistoricalInventoryValuation(
  movements: StockMovement[],
  asOfDate: string
): {
  totalQuantity: number;
  totalValuation: number;
  productBreakdown: { [productId: string]: { qty: number; valuation: number; averageCost: number } };
} {
  const filtered = movements.filter(m => m.date <= asOfDate);
  const productBreakdown: { [productId: string]: { qty: number; valuation: number; averageCost: number } } = {};

  for (const m of filtered) {
    if (!productBreakdown[m.productId]) {
      productBreakdown[m.productId] = { qty: 0, valuation: 0, averageCost: 0 };
    }

    const current = productBreakdown[m.productId];

    if (m.quantityIn > 0) {
      const incomingVal = round2(safeMul(m.quantityIn, m.unitCost));
      const newQty = safeAdd(current.qty, m.quantityIn);
      const newVal = safeAdd(current.valuation, incomingVal);
      current.qty = newQty;
      current.valuation = newVal;
      current.averageCost = newQty > 0 ? round2(safeDiv(newVal, newQty)) : 0;
    } else if (m.quantityOut > 0) {
      const outVal = round2(safeMul(m.quantityOut, current.averageCost || m.unitCost));
      current.qty = safeSub(current.qty, m.quantityOut);
      current.valuation = Math.max(0, safeSub(current.valuation, outVal));
    }
  }

  let totalQuantity = 0;
  let totalValuation = 0;

  for (const p of Object.values(productBreakdown)) {
    totalQuantity = safeAdd(totalQuantity, p.qty);
    totalValuation = safeAdd(totalValuation, p.valuation);
  }

  return {
    totalQuantity: round2(totalQuantity),
    totalValuation: round2(totalValuation),
    productBreakdown
  };
}
