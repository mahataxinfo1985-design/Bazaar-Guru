/**
 * Invoice Pro Phase 4: Inventory Management & Financial Reporting Types
 */

export type ItemType = 
  | 'goods' 
  | 'service' 
  | 'raw_material' 
  | 'finished_goods' 
  | 'consumable' 
  | 'non_stock';

export type ValuationMethod = 'weighted_average' | 'fifo';

export interface Product {
  id: string;
  businessId?: string;
  name: string;
  sku?: string;
  barcode?: string;
  description?: string;
  category?: string;
  brand?: string;
  itemType: ItemType;
  unit: string;
  unitPrice: number; // Selling price
  purchasePrice: number;
  costPrice?: number;
  mrp?: number;
  wholesalePrice?: number;
  minSellingPrice?: number;
  taxInclusive?: boolean;
  hsnCode: string;
  gstRate: number;
  cess?: number;
  openingStock: number;
  openingStockValue?: number;
  openingStockRate?: number;
  openingStockDate?: string;
  minStockLevel?: number;
  reorderLevel?: number;
  maxStockLevel?: number;
  trackStock: boolean;
  trackBatch: boolean;
  trackExpiry: boolean;
  stockQty: number; // Reconciled stock balance
  currentValuation?: number;
  averageCost?: number;
  warehouseId?: string;
  isActive: boolean;
  imageUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Warehouse {
  id: string;
  businessId?: string;
  name: string;
  code: string;
  address?: string;
  contactNumber?: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export type StockMovementType = 
  | 'opening_stock'
  | 'purchase'
  | 'sales'
  | 'sales_return'
  | 'purchase_return'
  | 'stock_adjustment'
  | 'stock_transfer_in'
  | 'stock_transfer_out'
  | 'write_off'
  | 'damage'
  | 'expiry'
  | 'production_in'
  | 'consumption_out'
  | 'inward'
  | 'outward';

export interface StockMovement {
  id: string;
  businessId?: string;
  productId: string;
  productName: string;
  sku?: string;
  warehouseId: string;
  warehouseName?: string;
  movementType: StockMovementType;
  quantityIn: number;
  quantityOut: number;
  quantityChange: number; // positive for in, negative for out
  runningBalance?: number;
  unitCost: number;
  totalCost: number;
  date: string; // YYYY-MM-DD
  referenceType: 'invoice' | 'purchase' | 'credit_note' | 'debit_note' | 'transfer' | 'adjustment' | 'opening' | 'manual';
  referenceId?: string;
  referenceNumber?: string;
  batchId?: string;
  batchNumber?: string;
  notes?: string;
  createdBy?: string;
  createdAt: string;
}

export interface InventoryValuationLayer {
  id: string;
  businessId?: string;
  productId: string;
  warehouseId?: string;
  purchaseDate: string;
  referenceType: 'purchase' | 'opening' | 'adjustment';
  referenceId?: string;
  originalQuantity: number;
  remainingQuantity: number;
  unitCost: number;
  totalCost: number;
  createdAt: string;
}

export interface ProductBatch {
  id: string;
  businessId?: string;
  productId: string;
  productName?: string;
  warehouseId: string;
  batchNumber: string;
  manufacturingDate?: string;
  expiryDate: string; // YYYY-MM-DD
  purchaseReference?: string;
  quantityReceived: number;
  remainingQuantity: number;
  unitCost: number;
  mrp?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface StockTransferLine {
  id: string;
  productId: string;
  productName: string;
  sku?: string;
  quantity: number;
  unitCost: number;
  totalValue: number;
  batchNumber?: string;
}

export interface StockTransfer {
  id: string;
  businessId?: string;
  transferNumber: string;
  date: string;
  sourceWarehouseId: string;
  sourceWarehouseName?: string;
  destinationWarehouseId: string;
  destinationWarehouseName?: string;
  status: 'completed' | 'in_transit' | 'cancelled';
  notes?: string;
  lines: StockTransferLine[];
  createdAt: string;
  createdBy?: string;
}

export type StockAdjustmentReason = 
  | 'physical_count'
  | 'damage'
  | 'expired'
  | 'missing'
  | 'found'
  | 'opening_correction'
  | 'other';

export interface StockAdjustmentLine {
  id: string;
  productId: string;
  productName: string;
  sku?: string;
  systemQuantity: number;
  physicalQuantity: number;
  differenceQuantity: number; // positive = found/surplus, negative = loss/damage
  unitCost: number;
  totalValue: number;
  reason: StockAdjustmentReason;
  batchNumber?: string;
}

export interface StockAdjustment {
  id: string;
  businessId?: string;
  adjustmentNumber: string;
  date: string;
  warehouseId: string;
  warehouseName?: string;
  status: 'posted' | 'draft' | 'cancelled';
  narration?: string;
  lines: StockAdjustmentLine[];
  totalAdjustmentValue: number;
  journalEntryId?: string;
  createdAt: string;
  createdBy?: string;
}

// ----------------------------------------------------------------------------
// INVENTORY & FINANCIAL REPORTING INTERFACES
// ----------------------------------------------------------------------------

export interface StockSummaryRow {
  productId: string;
  productName: string;
  sku: string;
  category: string;
  unit: string;
  openingStock: number;
  stockIn: number;
  stockOut: number;
  closingStock: number;
  averageCost: number;
  valuation: number;
  reorderLevel: number;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
}

export interface StockLedgerRow {
  id: string;
  date: string;
  movementType: StockMovementType;
  referenceType: string;
  referenceNumber: string;
  warehouseName: string;
  quantityIn: number;
  quantityOut: number;
  runningBalance: number;
  unitCost: number;
  totalValue: number;
  notes?: string;
}

export interface LowStockAlert {
  productId: string;
  productName: string;
  sku: string;
  currentStock: number;
  reorderLevel: number;
  minStockLevel: number;
  deficit: number;
  unit: string;
}

export interface BalanceSheetSection {
  title: string;
  lines: { accountCode: string; accountName: string; amount: number }[];
  total: number;
}

export interface BalanceSheetReport {
  asOfDate: string;
  assets: {
    cashAndBank: BalanceSheetSection;
    accountsReceivable: BalanceSheetSection;
    inventory: BalanceSheetSection;
    otherCurrentAssets: BalanceSheetSection;
    fixedAssets: BalanceSheetSection;
    totalAssets: number;
  };
  liabilities: {
    accountsPayable: BalanceSheetSection;
    gstLiabilities: BalanceSheetSection;
    loans: BalanceSheetSection;
    otherCurrentLiabilities: BalanceSheetSection;
    totalLiabilities: number;
  };
  equity: {
    ownerCapital: BalanceSheetSection;
    drawings: BalanceSheetSection;
    retainedEarnings: BalanceSheetSection;
    currentPeriodProfit: number;
    totalEquity: number;
  };
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
  difference: number;
  diagnosticNotes?: string[];
}

export interface CashFlowActivity {
  title: string;
  items: { description: string; amount: number }[];
  netCashFlow: number;
}

export interface CashFlowStatementReport {
  startDate: string;
  endDate: string;
  openingCashAndBank: number;
  operatingActivities: CashFlowActivity;
  investingActivities: CashFlowActivity;
  financingActivities: CashFlowActivity;
  netCashChange: number;
  closingCashAndBank: number;
  isReconciled: boolean;
}

export interface DaybookRow {
  id: string;
  date: string;
  voucherNumber: string;
  voucherType: string;
  partyName?: string;
  narration: string;
  accountNames: string;
  debit: number;
  credit: number;
}

export interface GeneralLedgerReport {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  transactions: {
    id: string;
    date: string;
    voucherNumber: string;
    sourceType: string;
    particulars: string;
    debit: number;
    credit: number;
    runningBalance: number;
  }[];
}

export interface ItemProfitabilityRow {
  productId: string;
  productName: string;
  sku: string;
  category: string;
  quantitySold: number;
  salesRevenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  grossMarginPercentage: number;
}
