import { describe, it } from 'node:test';
import assert from 'node:assert';

// Inventory Types
import { 
  Product, Warehouse, StockMovement, InventoryValuationLayer, 
  ProductBatch, StockTransfer, StockAdjustment 
} from '../src/types/inventory';
import { Account, JournalEntry } from '../src/types/accounting';
import { DEFAULT_CHART_OF_ACCOUNTS } from '../src/services/accounting/chartOfAccounts';

// Inventory Services
import { 
  computeWeightedAverageCost, 
  calculateCOGSWeightedAverage, 
  addValuationLayer, 
  consumeFIFOLayers, 
  restoreFIFOLayers, 
  getHistoricalInventoryValuation 
} from '../src/services/inventory/valuationService';

import { 
  isPhysicalInventoryTracked, 
  calculateCurrentStockFromMovements, 
  validateStockAvailability, 
  createStockMovement, 
  buildStockSummary, 
  buildStockLedger, 
  detectLowStockAlerts 
} from '../src/services/inventory/stockMovementService';

import { 
  DEFAULT_WAREHOUSE, 
  validateStockTransfer, 
  executeStockTransfer 
} from '../src/services/inventory/warehouseService';

import { 
  validateBatch, 
  deductBatchStock, 
  getNearExpiryBatches, 
  getExpiredBatches 
} from '../src/services/inventory/batchService';

import { 
  calculateAdjustmentDifferences, 
  processStockAdjustment 
} from '../src/services/inventory/adjustmentService';

// Accounting Journal Services
import { 
  createCOGSJournalEntry, 
  createSalesReturnCOGSJournalEntry, 
  createStockAdjustmentJournalEntry 
} from '../src/services/accounting/journalEngine';

// Financial Reporting Engine
import { 
  computeAccountBalances, 
  generateTrialBalance, 
  generateProfitAndLoss, 
  generateBalanceSheet, 
  generateCashFlowStatement, 
  generateDaybook, 
  generateGeneralLedger, 
  generateItemProfitability 
} from '../src/services/accounting/financialReports';

describe('Invoice Pro Phase 4: Inventory & Financial Reporting Engine', () => {

  // ==========================================
  // SECTION 1: Product Master & Tracking
  // ==========================================
  describe('Product Master & Physical Tracking Exclusions', () => {
    it('should correctly distinguish between physical inventory items and services/non-stock', () => {
      assert.strictEqual(isPhysicalInventoryTracked('goods', true), true);
      assert.strictEqual(isPhysicalInventoryTracked('raw_material', true), true);
      assert.strictEqual(isPhysicalInventoryTracked('finished_goods', true), true);
      assert.strictEqual(isPhysicalInventoryTracked('service', true), false);
      assert.strictEqual(isPhysicalInventoryTracked('non_stock', true), false);
      assert.strictEqual(isPhysicalInventoryTracked('goods', false), false);
    });

    it('should calculate opening stock valuation accurately', () => {
      const product: Product = {
        id: 'p_test_1',
        name: 'Industrial Widget A',
        sku: 'WID-001',
        barcode: '8901234567890',
        itemType: 'goods',
        unit: 'pcs',
        unitPrice: 200,
        purchasePrice: 120,
        costPrice: 120,
        hsnCode: '8483',
        gstRate: 18,
        openingStock: 50,
        openingStockRate: 120,
        trackStock: true,
        trackBatch: false,
        trackExpiry: false,
        stockQty: 50,
        isActive: true
      };

      const openingMovement = createStockMovement({
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        warehouseId: DEFAULT_WAREHOUSE.id,
        movementType: 'opening_stock',
        quantityIn: product.openingStock,
        unitCost: product.openingStockRate || 0,
        referenceType: 'opening',
        referenceId: product.id
      });

      assert.strictEqual(openingMovement.quantityIn, 50);
      assert.strictEqual(openingMovement.quantityChange, 50);
      assert.strictEqual(openingMovement.unitCost, 120);
      assert.strictEqual(openingMovement.totalCost, 6000);
    });
  });

  // ==========================================
  // SECTION 2: Stock Movement Ledger Engine
  // ==========================================
  describe('Stock Movement Ledger & Stock Reconstruction', () => {
    it('should reconstruct current stock from immutable movement history', () => {
      const movements: StockMovement[] = [
        createStockMovement({
          productId: 'prod_m1',
          productName: 'Item M1',
          warehouseId: DEFAULT_WAREHOUSE.id,
          movementType: 'opening_stock',
          quantityIn: 100,
          unitCost: 50,
          referenceType: 'opening'
        }),
        createStockMovement({
          productId: 'prod_m1',
          productName: 'Item M1',
          warehouseId: DEFAULT_WAREHOUSE.id,
          movementType: 'purchase',
          quantityIn: 50,
          unitCost: 55,
          referenceType: 'purchase'
        }),
        createStockMovement({
          productId: 'prod_m1',
          productName: 'Item M1',
          warehouseId: DEFAULT_WAREHOUSE.id,
          movementType: 'sales',
          quantityOut: 40,
          unitCost: 50,
          referenceType: 'invoice'
        }),
        createStockMovement({
          productId: 'prod_m1',
          productName: 'Item M1',
          warehouseId: DEFAULT_WAREHOUSE.id,
          movementType: 'sales_return',
          quantityIn: 5,
          unitCost: 50,
          referenceType: 'credit_note'
        })
      ];

      // 100 in + 50 in - 40 out + 5 in = 115
      const currentStock = calculateCurrentStockFromMovements(movements, 'prod_m1');
      assert.strictEqual(currentStock, 115);
    });

    it('should build accurate Stock Summary rows with opening, in, out, and closing', () => {
      const products: Product[] = [{
        id: 'prod_s1',
        name: 'Item S1',
        sku: 'S1',
        itemType: 'goods',
        unit: 'pcs',
        unitPrice: 100,
        purchasePrice: 60,
        hsnCode: '8400',
        gstRate: 18,
        openingStock: 20,
        trackStock: true,
        trackBatch: false,
        trackExpiry: false,
        stockQty: 20,
        isActive: true
      }];

      const movements: StockMovement[] = [
        createStockMovement({
          productId: 'prod_s1',
          productName: 'Item S1',
          warehouseId: DEFAULT_WAREHOUSE.id,
          movementType: 'opening_stock',
          quantityIn: 20,
          unitCost: 60,
          referenceType: 'opening',
          date: '2026-04-01'
        }),
        createStockMovement({
          productId: 'prod_s1',
          productName: 'Item S1',
          warehouseId: DEFAULT_WAREHOUSE.id,
          movementType: 'purchase',
          quantityIn: 30,
          unitCost: 60,
          referenceType: 'purchase',
          date: '2026-04-10'
        }),
        createStockMovement({
          productId: 'prod_s1',
          productName: 'Item S1',
          warehouseId: DEFAULT_WAREHOUSE.id,
          movementType: 'sales',
          quantityOut: 15,
          unitCost: 60,
          referenceType: 'invoice',
          date: '2026-04-15'
        })
      ];

      const summary = buildStockSummary(products, movements);
      assert.strictEqual(summary.length, 1);
      assert.strictEqual(summary[0].openingStock, 20);
      assert.strictEqual(summary[0].stockIn, 30);
      assert.strictEqual(summary[0].stockOut, 15);
      assert.strictEqual(summary[0].closingStock, 35);
      assert.strictEqual(summary[0].valuation, 2100);
    });

    it('should build chronological Stock Ledger with running balances', () => {
      const movements: StockMovement[] = [
        createStockMovement({
          productId: 'prod_sl',
          productName: 'Item SL',
          warehouseId: DEFAULT_WAREHOUSE.id,
          movementType: 'opening_stock',
          quantityIn: 10,
          unitCost: 100,
          referenceType: 'opening',
          date: '2026-04-01'
        }),
        createStockMovement({
          productId: 'prod_sl',
          productName: 'Item SL',
          warehouseId: DEFAULT_WAREHOUSE.id,
          movementType: 'purchase',
          quantityIn: 20,
          unitCost: 100,
          referenceType: 'purchase',
          date: '2026-04-05'
        }),
        createStockMovement({
          productId: 'prod_sl',
          productName: 'Item SL',
          warehouseId: DEFAULT_WAREHOUSE.id,
          movementType: 'sales',
          quantityOut: 12,
          unitCost: 100,
          referenceType: 'invoice',
          date: '2026-04-10'
        })
      ];

      const ledger = buildStockLedger(movements, 'prod_sl');
      assert.strictEqual(ledger.length, 3);
      assert.strictEqual(ledger[0].runningBalance, 10);
      assert.strictEqual(ledger[1].runningBalance, 30);
      assert.strictEqual(ledger[2].runningBalance, 18);
    });

    it('should detect low-stock items based on minStockLevel or reorderLevel', () => {
      const products: Product[] = [
        {
          id: 'prod_low',
          name: 'Critical Widget',
          itemType: 'goods',
          unit: 'pcs',
          unitPrice: 100,
          purchasePrice: 50,
          hsnCode: '8400',
          gstRate: 18,
          openingStock: 5,
          minStockLevel: 10,
          reorderLevel: 15,
          trackStock: true,
          trackBatch: false,
          trackExpiry: false,
          stockQty: 5,
          isActive: true
        },
        {
          id: 'prod_ok',
          name: 'Surplus Widget',
          itemType: 'goods',
          unit: 'pcs',
          unitPrice: 100,
          purchasePrice: 50,
          hsnCode: '8400',
          gstRate: 18,
          openingStock: 100,
          minStockLevel: 10,
          reorderLevel: 20,
          trackStock: true,
          trackBatch: false,
          trackExpiry: false,
          stockQty: 100,
          isActive: true
        }
      ];

      const alerts = detectLowStockAlerts(products, []);
      assert.strictEqual(alerts.length, 1);
      assert.strictEqual(alerts[0].productId, 'prod_low');
      assert.strictEqual(alerts[0].currentStock, 5);
      assert.strictEqual(alerts[0].reorderLevel, 15);
    });
  });

  // ==========================================
  // SECTION 3: Inventory Valuation (WAC & FIFO)
  // ==========================================
  describe('Inventory Valuation Engine', () => {
    it('should compute Weighted Average Cost (WAC) correctly across purchases', () => {
      // Existing 10 units @ 100 = 1000 total valuation
      // Purchase 10 units @ 150 = 1500 incoming total
      // Total value: 2500 for 20 units => WAC = 125/unit
      const newCost = computeWeightedAverageCost(10, 1000, 10, 150);
      assert.strictEqual(newCost, 125);

      // COGS for sale of 8 units @ 125 = 1000
      const cogsRes = calculateCOGSWeightedAverage(8, 20, newCost);
      assert.strictEqual(cogsRes.cogsAmount, 1000);
      assert.strictEqual(cogsRes.newQuantity, 12);
      assert.strictEqual(cogsRes.newValuation, 1500);
    });

    it('should accurately consume FIFO valuation layers strictly in chronological order', () => {
      let layers: InventoryValuationLayer[] = [];

      // Layer 1: 10 units @ 100 on April 1
      layers = addValuationLayer(layers, {
        productId: 'prod_fifo',
        quantity: 10,
        unitCost: 100,
        purchaseDate: '2026-04-01',
        referenceType: 'purchase',
        referenceId: 'p_01'
      });

      // Layer 2: 10 units @ 120 on April 5
      layers = addValuationLayer(layers, {
        productId: 'prod_fifo',
        quantity: 10,
        unitCost: 120,
        purchaseDate: '2026-04-05',
        referenceType: 'purchase',
        referenceId: 'p_02'
      });

      // Sale of 15 units: 10 @ 100 + 5 @ 120 = 1000 + 600 = 1600
      const { cogsAmount, updatedLayers, consumedLayers } = consumeFIFOLayers(layers, 'prod_fifo', 15);
      assert.strictEqual(cogsAmount, 1600);
      assert.strictEqual(consumedLayers.length, 2);
      assert.strictEqual(consumedLayers[0].quantityConsumed, 10);
      assert.strictEqual(consumedLayers[1].quantityConsumed, 5);

      // Remaining layer should have exactly 5 units @ 120 = 600
      const remainingForProduct = updatedLayers.filter(l => l.productId === 'prod_fifo' && l.remainingQuantity > 0);
      assert.strictEqual(remainingForProduct.length, 1);
      assert.strictEqual(remainingForProduct[0].remainingQuantity, 5);
      assert.strictEqual(remainingForProduct[0].unitCost, 120);
    });

    it('should restore FIFO valuation layers when sales return occurs', () => {
      let layers: InventoryValuationLayer[] = [];
      layers = addValuationLayer(layers, {
        productId: 'prod_ret',
        quantity: 10,
        unitCost: 150,
        purchaseDate: '2026-04-01',
        referenceType: 'purchase'
      });

      // Consume 8 units
      const { updatedLayers } = consumeFIFOLayers(layers, 'prod_ret', 8);
      assert.strictEqual(updatedLayers[0].remainingQuantity, 2);

      // Customer returns 3 units
      const restored = restoreFIFOLayers(updatedLayers, 'prod_ret', 3, 150, '2026-04-10');
      const totalRemaining = restored.reduce((sum, l) => sum + l.remainingQuantity, 0);
      assert.strictEqual(totalRemaining, 5);
    });

    it('should validate stock availability and enforce negative stock policy', () => {
      // Disallow negative:
      const checkBlocked = validateStockAvailability(5, 10, false);
      assert.strictEqual(checkBlocked.allowed, false);
      assert.ok(checkBlocked.error?.includes('Insufficient stock'));

      // Allow negative:
      const checkAllowed = validateStockAvailability(5, 10, true);
      assert.strictEqual(checkAllowed.allowed, true);
    });
  });

  // ==========================================
  // SECTION 4: Sales/Purchase Accounting Journals
  // ==========================================
  describe('COGS & Inventory Double-Entry Journals', () => {
    it('should generate balanced COGS journal entry on sales (Dr 5010, Cr 1400)', () => {
      const cogsJournal = createCOGSJournalEntry({
        invoiceId: 'inv_101',
        invoiceNumber: 'INV-101',
        date: '2026-04-15',
        cogsAmount: 4500,
        accounts: DEFAULT_CHART_OF_ACCOUNTS
      });

      assert.ok(cogsJournal);
      assert.strictEqual(cogsJournal?.totalDebit, 4500);
      assert.strictEqual(cogsJournal?.totalCredit, 4500);

      const drLine = cogsJournal?.lines.find(l => l.debit > 0);
      const crLine = cogsJournal?.lines.find(l => l.credit > 0);

      assert.strictEqual(drLine?.accountCode, '5010'); // Cost of Goods Sold
      assert.strictEqual(crLine?.accountCode, '1400'); // Inventory Asset
    });

    it('should generate balanced Sales Return COGS reversal journal (Dr 1400, Cr 5010)', () => {
      const returnJournal = createSalesReturnCOGSJournalEntry({
        creditNoteId: 'ret_101',
        creditNoteNumber: 'CN-101',
        date: '2026-04-18',
        returnedCostAmount: 900,
        accounts: DEFAULT_CHART_OF_ACCOUNTS
      });

      assert.ok(returnJournal);
      assert.strictEqual(returnJournal?.totalDebit, 900);
      assert.strictEqual(returnJournal?.totalCredit, 900);

      const drLine = returnJournal?.lines.find(l => l.debit > 0);
      const crLine = returnJournal?.lines.find(l => l.credit > 0);

      assert.strictEqual(drLine?.accountCode, '1400'); // Inventory Asset increased
      assert.strictEqual(crLine?.accountCode, '5010'); // COGS reduced
    });
  });

  // ==========================================
  // SECTION 5: Multi-Warehouse & Inter-Godown Transfers
  // ==========================================
  describe('Multi-Warehouse & Inter-Godown Transfers', () => {
    it('should validate warehouse existence and check stock at source location', () => {
      const movements: StockMovement[] = [
        createStockMovement({
          productId: 'prod_wh',
          productName: 'Widget WH',
          movementType: 'opening_stock',
          quantityIn: 20,
          unitCost: 100,
          referenceType: 'opening',
          warehouseId: DEFAULT_WAREHOUSE.id
        })
      ];

      // Transfer 25 units (more than 20 available)
      const check = validateStockTransfer(
        DEFAULT_WAREHOUSE.id,
        'wh_delhi',
        [{ productId: 'prod_wh', quantity: 25, productName: 'Widget WH' }],
        movements
      );

      assert.strictEqual(check.valid, false);
      assert.ok(check.error?.includes('Insufficient stock'));
    });

    it('should execute inter-godown transfer with paired movements and preserve total inventory quantity', () => {
      const warehouses: Warehouse[] = [
        DEFAULT_WAREHOUSE,
        {
          id: 'wh_mumbai',
          name: 'Mumbai Central Godown',
          code: 'MUM-01',
          isDefault: false,
          isActive: true,
          createdAt: new Date().toISOString()
        }
      ];

      const products: Product[] = [{
        id: 'prod_trf',
        name: 'Transfer Item',
        itemType: 'goods',
        unit: 'pcs',
        unitPrice: 200,
        purchasePrice: 100,
        costPrice: 100,
        hsnCode: '8400',
        gstRate: 18,
        openingStock: 50,
        trackStock: true,
        trackBatch: false,
        trackExpiry: false,
        stockQty: 50,
        isActive: true
      }];

      const initialMovements: StockMovement[] = [
        createStockMovement({
          productId: 'prod_trf',
          productName: 'Transfer Item',
          movementType: 'opening_stock',
          quantityIn: 50,
          unitCost: 100,
          referenceType: 'opening',
          warehouseId: DEFAULT_WAREHOUSE.id
        })
      ];

      const transferObj: StockTransfer = {
        id: 'trf_100',
        transferNumber: 'TRF-100',
        sourceWarehouseId: DEFAULT_WAREHOUSE.id,
        destinationWarehouseId: 'wh_mumbai',
        date: '2026-04-22',
        status: 'completed',
        lines: [{
          id: 'l_1',
          productId: 'prod_trf',
          productName: 'Transfer Item',
          quantity: 20,
          unitCost: 100,
          totalValue: 2000
        }],
        createdAt: new Date().toISOString()
      };

      const { newMovements, updatedTransfer } = executeStockTransfer(
        transferObj,
        initialMovements,
        products,
        warehouses
      );

      assert.strictEqual(updatedTransfer.status, 'completed');
      assert.strictEqual(newMovements.length, 2);

      const outMov = newMovements.find(m => m.movementType === 'stock_transfer_out');
      const inMov = newMovements.find(m => m.movementType === 'stock_transfer_in');

      assert.strictEqual(outMov?.warehouseId, DEFAULT_WAREHOUSE.id);
      assert.strictEqual(outMov?.quantityOut, 20);
      assert.strictEqual(inMov?.warehouseId, 'wh_mumbai');
      assert.strictEqual(inMov?.quantityIn, 20);

      // Check stock at source, destination, and overall invariant
      const allMovements = [...initialMovements, ...newMovements];
      const sourceStock = calculateCurrentStockFromMovements(allMovements, 'prod_trf', DEFAULT_WAREHOUSE.id);
      const destStock = calculateCurrentStockFromMovements(allMovements, 'prod_trf', 'wh_mumbai');
      const totalStock = calculateCurrentStockFromMovements(allMovements, 'prod_trf');

      assert.strictEqual(sourceStock, 30);
      assert.strictEqual(destStock, 20);
      assert.strictEqual(totalStock, 50); // Invariant maintained!
    });
  });

  // ==========================================
  // SECTION 6: Batch & Expiry Management
  // ==========================================
  describe('Batch & Expiry Management', () => {
    it('should detect near-expiry and expired batches accurately', () => {
      const today = new Date();
      const pastDate = new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const soonDate = new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const safeDate = new Date(today.getTime() + 120 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const batches: ProductBatch[] = [
        {
          id: 'b_expired',
          productId: 'p_med',
          warehouseId: DEFAULT_WAREHOUSE.id,
          batchNumber: 'B-EXPIRED',
          expiryDate: pastDate,
          quantityReceived: 10,
          remainingQuantity: 10,
          unitCost: 50,
          createdAt: new Date().toISOString()
        },
        {
          id: 'b_soon',
          productId: 'p_med',
          warehouseId: DEFAULT_WAREHOUSE.id,
          batchNumber: 'B-SOON',
          expiryDate: soonDate,
          quantityReceived: 25,
          remainingQuantity: 25,
          unitCost: 50,
          createdAt: new Date().toISOString()
        },
        {
          id: 'b_safe',
          productId: 'p_med',
          warehouseId: DEFAULT_WAREHOUSE.id,
          batchNumber: 'B-SAFE',
          expiryDate: safeDate,
          quantityReceived: 100,
          remainingQuantity: 100,
          unitCost: 50,
          createdAt: new Date().toISOString()
        }
      ];

      const expired = getExpiredBatches(batches);
      assert.strictEqual(expired.length, 1);
      assert.strictEqual(expired[0].batchNumber, 'B-EXPIRED');

      const nearExpiry = getNearExpiryBatches(batches, 30);
      assert.strictEqual(nearExpiry.length, 1);
      assert.strictEqual(nearExpiry[0].batchNumber, 'B-SOON');
    });

    it('should deduct stock correctly from selected batch', () => {
      const batches: ProductBatch[] = [{
        id: 'b_1',
        productId: 'p_1',
        warehouseId: DEFAULT_WAREHOUSE.id,
        batchNumber: 'BATCH-001',
        quantityReceived: 50,
        remainingQuantity: 50,
        unitCost: 100,
        expiryDate: '2028-12-31',
        createdAt: new Date().toISOString()
      }];

      const { updatedBatches, success } = deductBatchStock(batches, 'BATCH-001', 'p_1', 15);
      assert.strictEqual(success, true);
      assert.strictEqual(updatedBatches[0].remainingQuantity, 35);
    });
  });

  // ==========================================
  // SECTION 7: Stock Adjustments & Vouchers
  // ==========================================
  describe('Physical Stock Adjustments & Vouchers', () => {
    it('should compute discrepancy differences and process stock write-off loss', () => {
      const initialMovements: StockMovement[] = [
        createStockMovement({
          productId: 'p_adj',
          productName: 'Adjusted Item',
          warehouseId: DEFAULT_WAREHOUSE.id,
          movementType: 'opening_stock',
          quantityIn: 40,
          unitCost: 200,
          referenceType: 'opening'
        })
      ];

      // Physical count finds 35 units (5 units shortage loss = 1,000)
      const adjustment: StockAdjustment = {
        id: 'adj_01',
        adjustmentNumber: 'ADJ-001',
        warehouseId: DEFAULT_WAREHOUSE.id,
        date: '2026-04-25',
        status: 'posted',
        totalAdjustmentValue: 1000,
        lines: [{
          id: 'al_1',
          productId: 'p_adj',
          productName: 'Adjusted Item',
          systemQuantity: 40,
          physicalQuantity: 35,
          differenceQuantity: -5,
          unitCost: 200,
          totalValue: 1000,
          reason: 'damage'
        }],
        createdAt: new Date().toISOString()
      };

      const { newMovements, accountingImpact } = processStockAdjustment(adjustment, initialMovements);

      assert.strictEqual(newMovements.length, 1);
      assert.strictEqual(newMovements[0].movementType, 'damage');
      assert.strictEqual(newMovements[0].quantityOut, 5);

      assert.strictEqual(accountingImpact.isLoss, true);
      assert.strictEqual(accountingImpact.lossAmount, 1000);

      // Verify double-entry adjustment journal
      const journal = createStockAdjustmentJournalEntry({
        adjustmentId: adjustment.id,
        adjustmentNumber: adjustment.adjustmentNumber,
        date: adjustment.date,
        lossAmount: accountingImpact.lossAmount,
        gainAmount: accountingImpact.gainAmount,
        accounts: DEFAULT_CHART_OF_ACCOUNTS
      });

      assert.ok(journal);
      assert.strictEqual(journal?.totalDebit, 1000);
      assert.strictEqual(journal?.totalCredit, 1000);

      const drLine = journal?.lines.find(l => l.debit > 0);
      const crLine = journal?.lines.find(l => l.credit > 0);

      assert.strictEqual(drLine?.accountCode, '6090'); // Inventory Adjustment Expense
      assert.strictEqual(crLine?.accountCode, '1400'); // Inventory Asset reduced
    });
  });

  // ==========================================
  // SECTION 8: Financial Reporting Engine
  // ==========================================
  describe('Centralized Financial Reporting Engine', () => {
    const accounts = JSON.parse(JSON.stringify(DEFAULT_CHART_OF_ACCOUNTS)) as Account[];

    const testJournals: JournalEntry[] = [
      {
        id: 'je_cap',
        entryNumber: 'JE-001',
        date: '2026-04-01',
        sourceType: 'opening_balance',
        sourceId: 'cap_01',
        narration: 'Owner capital introduced',
        totalDebit: 100000,
        totalCredit: 100000,
        status: 'posted',
        createdAt: '2026-04-01T00:00:00Z',
        lines: [
          { id: 'l1', entryId: 'je_cap', accountId: 'acc_bank', accountCode: '1020', accountName: 'Bank Account', debit: 100000, credit: 0 },
          { id: 'l2', entryId: 'je_cap', accountId: 'acc_cap', accountCode: '3010', accountName: "Owner's Equity", debit: 0, credit: 100000 }
        ]
      },
      {
        id: 'je_pur',
        entryNumber: 'JE-002',
        date: '2026-04-05',
        sourceType: 'purchase_invoice',
        sourceId: 'pur_01',
        narration: 'Purchase of goods',
        totalDebit: 40000,
        totalCredit: 40000,
        status: 'posted',
        createdAt: '2026-04-05T00:00:00Z',
        lines: [
          { id: 'l3', entryId: 'je_pur', accountId: 'acc_inv', accountCode: '1400', accountName: 'Inventory', debit: 40000, credit: 0 },
          { id: 'l4', entryId: 'je_pur', accountId: 'acc_ap', accountCode: '2010', accountName: 'Creditors', debit: 0, credit: 40000 }
        ]
      },
      {
        id: 'je_sales',
        entryNumber: 'JE-003',
        date: '2026-04-10',
        sourceType: 'sales_invoice',
        sourceId: 'sl_01',
        narration: 'Sales to customer',
        totalDebit: 60000,
        totalCredit: 60000,
        status: 'posted',
        createdAt: '2026-04-10T00:00:00Z',
        lines: [
          { id: 'l5', entryId: 'je_sales', accountId: 'acc_ar', accountCode: '1200', accountName: 'Debtors', debit: 60000, credit: 0 },
          { id: 'l6', entryId: 'je_sales', accountId: 'acc_sales', accountCode: '4010', accountName: 'Sales', debit: 0, credit: 60000 }
        ]
      },
      {
        id: 'je_cogs',
        entryNumber: 'JE-004',
        date: '2026-04-10',
        sourceType: 'cogs',
        sourceId: 'sl_01',
        narration: 'COGS for sales',
        totalDebit: 25000,
        totalCredit: 25000,
        status: 'posted',
        createdAt: '2026-04-10T00:00:00Z',
        lines: [
          { id: 'l7', entryId: 'je_cogs', accountId: 'acc_cogs', accountCode: '5010', accountName: 'Cost of Goods Sold', debit: 25000, credit: 0 },
          { id: 'l8', entryId: 'je_cogs', accountId: 'acc_inv', accountCode: '1400', accountName: 'Inventory', debit: 0, credit: 25000 }
        ]
      },
      {
        id: 'je_exp',
        entryNumber: 'JE-005',
        date: '2026-04-15',
        sourceType: 'expense',
        sourceId: 'exp_01',
        narration: 'Office Rent',
        totalDebit: 5000,
        totalCredit: 5000,
        status: 'posted',
        createdAt: '2026-04-15T00:00:00Z',
        lines: [
          { id: 'l9', entryId: 'je_exp', accountId: 'acc_rent', accountCode: '6010', accountName: 'Rent Expense', debit: 5000, credit: 0 },
          { id: 'l10', entryId: 'je_exp', accountId: 'acc_bank', accountCode: '1020', accountName: 'Bank Account', debit: 0, credit: 5000 }
        ]
      },
      {
        id: 'je_payin',
        entryNumber: 'JE-006',
        date: '2026-04-20',
        sourceType: 'payment_in',
        sourceId: 'payin_01',
        narration: 'Receipt from customer',
        totalDebit: 50000,
        totalCredit: 50000,
        status: 'posted',
        createdAt: '2026-04-20T00:00:00Z',
        lines: [
          { id: 'l11', entryId: 'je_payin', accountId: 'acc_bank', accountCode: '1020', accountName: 'Bank Account', debit: 50000, credit: 0 },
          { id: 'l12', entryId: 'je_payin', accountId: 'acc_ar', accountCode: '1200', accountName: 'Debtors', debit: 0, credit: 50000 }
        ]
      },
      {
        id: 'je_payout',
        entryNumber: 'JE-007',
        date: '2026-04-25',
        sourceType: 'payment_out',
        sourceId: 'payout_01',
        narration: 'Payment to vendor',
        totalDebit: 30000,
        totalCredit: 30000,
        status: 'posted',
        createdAt: '2026-04-25T00:00:00Z',
        lines: [
          { id: 'l13', entryId: 'je_payout', accountId: 'acc_ap', accountCode: '2010', accountName: 'Creditors', debit: 30000, credit: 0 },
          { id: 'l14', entryId: 'je_payout', accountId: 'acc_bank', accountCode: '1020', accountName: 'Bank Account', debit: 0, credit: 30000 }
        ]
      }
    ];

    it('should calculate balanced Trial Balance (Total Debits == Total Credits)', () => {
      const tb = generateTrialBalance(accounts, testJournals);
      assert.strictEqual(tb.isBalanced, true);
      assert.strictEqual(tb.totalDebit, tb.totalCredit);
      assert.strictEqual(tb.difference, 0);
    });

    it('should generate accurate Profit & Loss Statement (Gross & Net Profit)', () => {
      const pnl = generateProfitAndLoss(accounts, testJournals);
      // Revenue = 60,000 (Sales 4010)
      assert.strictEqual(pnl.totalRevenue, 60000);
      // COGS = 25,000 (Account 5010)
      assert.strictEqual(pnl.costOfGoodsSold, 25000);
      // Gross Profit = 60,000 - 25,000 = 35,000
      assert.strictEqual(pnl.grossProfit, 35000);
      // Operating Expenses = 5,000 (Rent 6010)
      assert.strictEqual(pnl.totalOperatingExpenses, 5000);
      // Net Profit = 35,000 - 5,000 = 30,000
      assert.strictEqual(pnl.netProfit, 30000);
    });

    it('should generate balanced Balance Sheet where Assets == Liabilities + Equity', () => {
      const bs = generateBalanceSheet(accounts, testJournals);
      
      // Expected Assets:
      // Bank 1020: 100,000 - 5,000 + 50,000 - 30,000 = 115,000
      // Debtors 1200: 60,000 - 50,000 = 10,000
      // Inventory 1400: 40,000 - 25,000 = 15,000
      // Total Assets = 115,000 + 10,000 + 15,000 = 140,000
      assert.strictEqual(bs.assets.totalAssets, 140000);

      // Expected Liabilities:
      // Creditors 2010: 40,000 - 30,000 = 10,000
      assert.strictEqual(bs.liabilities.totalLiabilities, 10000);

      // Expected Equity:
      // Capital 3010: 100,000
      // Current Year Earnings (Net Profit transferred): 30,000
      // Total Equity = 130,000
      assert.strictEqual(bs.equity.totalEquity, 130000);

      // Balance Sheet Equation Check:
      // Assets (140,000) == Liabilities (10,000) + Equity (130,000)
      assert.strictEqual(bs.isBalanced, true);
      assert.strictEqual(bs.difference, 0);
    });

    it('should generate Cash Flow Statement where net cash change matches liquid funds', () => {
      const cf = generateCashFlowStatement(accounts, testJournals, '2026-04-01', '2026-04-30');
      // Starting Bank was 0, Ending Bank is 115,000
      // Net Cash Flow should be exactly 115,000
      assert.strictEqual(cf.netCashChange, 115000);
      assert.strictEqual(cf.closingCashAndBank, 115000);
    });

    it('should generate Daybook chronologically with accurate cumulative totals', () => {
      const daybook = generateDaybook(testJournals);
      assert.strictEqual(daybook.length, 7);
      // Entries are sorted by date
      assert.strictEqual(daybook[0].date, '2026-04-01');
      assert.strictEqual(daybook[6].date, '2026-04-25');
    });

    it('should generate General Ledger with running debit/credit balances per account', () => {
      const bankAcc = accounts.find(a => a.code === '1020')!;
      const bankReport = generateGeneralLedger(bankAcc, testJournals);
      assert.strictEqual(bankReport.closingBalance, 115000);
      assert.strictEqual(bankReport.transactions.length, 4); // Capital, Rent, Customer receipt, Vendor payment
    });

    it('should generate Item Profitability report computing margin and margin %', () => {
      const invoices = [
        {
          id: 'inv_p1',
          type: 'Tax Invoice',
          invoiceNumber: 'INV-P1',
          date: '2026-04-10',
          status: 'Paid',
          items: [{
            id: 'li_1',
            itemId: 'p_prof_1',
            name: 'High Margin Tool',
            hsnCode: '8205',
            qty: 20,
            unit: 'pcs',
            unitPrice: 500,
            discount: 0,
            discountType: 'percentage',
            taxableValue: 10000,
            gstRate: 18,
            cgst: 900,
            sgst: 900,
            igst: 0,
            total: 11800
          }]
        }
      ] as any[];

      const cogsMap = {
        'inv_p1': {
          'p_prof_1': 4000
        }
      };

      const profitability = generateItemProfitability(invoices, cogsMap);
      assert.strictEqual(profitability.length, 1);
      assert.strictEqual(profitability[0].quantitySold, 20);
      assert.strictEqual(profitability[0].salesRevenue, 10000);
      assert.strictEqual(profitability[0].costOfGoodsSold, 4000);
      assert.strictEqual(profitability[0].grossProfit, 6000);
      assert.strictEqual(profitability[0].grossMarginPercentage, 60); // 60%
    });
  });

});
