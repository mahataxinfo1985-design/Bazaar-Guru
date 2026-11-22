const fs = require('fs');

let code = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Add Inventory & Stock Tracking imports
const invImports = `// Inventory & Stock Tracking
import { 
  Product, Warehouse, StockMovement, StockTransfer, StockAdjustment, 
  ProductBatch, InventoryValuationLayer 
} from './types/inventory';
import { DEFAULT_WAREHOUSE, executeStockTransfer } from './services/inventory/warehouseService';
import { 
  createStockMovement, validateStockAvailability, isPhysicalInventoryTracked 
} from './services/inventory/stockMovementService';
import { 
  computeWeightedAverageCost, calculateCOGSWeightedAverage, 
  consumeFIFOLayers, addValuationLayer, restoreFIFOLayers 
} from './services/inventory/valuationService';
import { processStockAdjustment } from './services/inventory/adjustmentService';
import { 
  createCOGSJournalEntry, 
  createStockAdjustmentJournalEntry 
} from './services/accounting/journalEngine';
import ProductModal from './components/modals/ProductModal';
import StockTransferModal from './components/modals/StockTransferModal';
import StockAdjustmentModal from './components/modals/StockAdjustmentModal';
`;

if (!code.includes('createCOGSJournalEntry')) {
  code = code.replace("// Banking & Treasury", invImports + "\n// Banking & Treasury");
}

// 2. Add inventory state
const invStates = `  // Inventory State
  const [warehouses, setWarehouses] = useState<Warehouse[]>([DEFAULT_WAREHOUSE]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [inventoryLayers, setInventoryLayers] = useState<InventoryValuationLayer[]>([]);
  const [productBatches, setProductBatches] = useState<ProductBatch[]>([]);
  const [stockTransfers, setStockTransfers] = useState<StockTransfer[]>([]);
  const [stockAdjustments, setStockAdjustments] = useState<StockAdjustment[]>([]);

  // Inventory Modals State
  const [productModal, setProductModal] = useState<{ isOpen: boolean; productToEdit: Product | null }>({
    isOpen: false,
    productToEdit: null
  });
  const [stockTransferModalOpen, setStockTransferModalOpen] = useState(false);
  const [stockAdjustmentModalOpen, setStockAdjustmentModalOpen] = useState(false);
`;

if (!code.includes('const [stockMovements, setStockMovements]')) {
  code = code.replace("  // Banking & Treasury State", invStates + "\n  // Banking & Treasury State");
}

// 3. Hydrate in useEffect bootstrap
const invHydrate = `        // Inventory & Stock Tracking
        if (localData.warehouses && localData.warehouses.length > 0) setWarehouses(localData.warehouses);
        if (localData.stockMovements) setStockMovements(localData.stockMovements);
        if (localData.inventoryLayers) setInventoryLayers(localData.inventoryLayers);
        if (localData.productBatches) setProductBatches(localData.productBatches);
        if (localData.stockTransfers) setStockTransfers(localData.stockTransfers);
        if (localData.stockAdjustments) setStockAdjustments(localData.stockAdjustments);
`;

if (!code.includes('setStockMovements(localData.stockMovements)')) {
  code = code.replace(
    "if (localData.bankReconciliations) setBankReconciliations(localData.bankReconciliations);",
    "if (localData.bankReconciliations) setBankReconciliations(localData.bankReconciliations);\n\n" + invHydrate
  );
}

// 4. Update handleSaveSalesInvoice
const oldSalesPattern = /const handleSaveSalesInvoice = async \(invoice: Invoice, status: InvoiceStatus\) => \{[\s\S]*?alert\(`Error saving sales invoice: \${err\.message}`\);\s*\}\s*\};/;

const newSalesFunc = `const handleSaveSalesInvoice = async (invoice: Invoice, status: InvoiceStatus) => {
    try {
      if (!checkPeriodOpen(invoice.date)) return;
      const finalInvoice: Invoice = { ...invoice, status };
      const customer = parties.find(p => p.id === invoice.partyId);
      const customerName = customer?.name || 'Customer';

      // Stock availability check if negative stock is disallowed
      const allowNegative = profile.inventoryConfig?.allowNegativeStock ?? false;
      for (const line of finalInvoice.items) {
        const prod = items.find(it => it.id === line.itemId || it.name.toLowerCase() === line.name.toLowerCase()) as Product | undefined;
        if (prod && isPhysicalInventoryTracked(prod)) {
          const check = validateStockAvailability(prod, line.qty, stockMovements, allowNegative);
          if (!check.allowed) {
            alert(check.reason || \`Insufficient stock for \${prod.name}\`);
            return;
          }
        }
      }

      // A. Generate Double Entry Journal
      const journal = createSalesInvoiceJournalEntry(finalInvoice, accounts, customerName);

      // B. Compute COGS and create Stock Movements for line items
      const newMovements: StockMovement[] = [];
      let updatedLayers = [...inventoryLayers];
      let totalInvoiceCOGS = 0;
      const valuationMethod = profile.inventoryConfig?.defaultValuationMethod || 'weighted_average';

      const updatedItems = items.map(item => {
        const line = finalInvoice.items.find(i => i.name.toLowerCase() === item.name.toLowerCase() || i.itemId === item.id);
        if (line) {
          const prod = item as Product;
          let lineCOGS = 0;

          if (isPhysicalInventoryTracked(prod)) {
            if (valuationMethod === 'fifo') {
              const { totalCost, remainingLayers } = consumeFIFOLayers(updatedLayers, item.id, line.qty);
              lineCOGS = totalCost;
              updatedLayers = remainingLayers;
            } else {
              const unitCost = item.purchasePrice || item.costPrice || 0;
              lineCOGS = calculateCOGSWeightedAverage(unitCost, line.qty);
            }
            totalInvoiceCOGS = safeAdd(totalInvoiceCOGS, lineCOGS);

            const movement = createStockMovement({
              productId: item.id,
              movementType: 'sales',
              quantity: line.qty,
              unitCost: line.qty > 0 ? (lineCOGS / line.qty) : (item.purchasePrice || 0),
              referenceType: 'sales_invoice',
              referenceId: finalInvoice.id,
              warehouseId: DEFAULT_WAREHOUSE.id,
              notes: \`Sales invoice \${finalInvoice.invoiceNumber}\`
            });
            newMovements.push(movement);
          }

          const newQty = Math.max(0, safeSub(item.stockQty, line.qty));
          const updatedItem = { ...item, stockQty: newQty };
          idbPut('items', updatedItem);
          enqueueMutation('upsert_item', updatedItem.id, updatedItem);
          return updatedItem;
        }
        return item;
      });

      // C. Generate COGS Journal Entry if applicable
      let cogsJournal: JournalEntry | null = null;
      if (totalInvoiceCOGS > 0) {
        cogsJournal = createCOGSJournalEntry(
          finalInvoice.id,
          finalInvoice.invoiceNumber,
          finalInvoice.date,
          totalInvoiceCOGS,
          accounts
        );
        await idbPut('journal_entries', cogsJournal);
      }

      // D. Update Customer Outstanding Balance
      const updatedParties = parties.map(p => {
        if (p.id === finalInvoice.partyId) {
          const newBal = safeAdd(p.outstandingBalance || 0, finalInvoice.balanceDue);
          const updatedParty = { ...p, outstandingBalance: newBal };
          idbPut('parties', updatedParty);
          enqueueMutation('upsert_party', updatedParty.id, updatedParty);
          return updatedParty;
        }
        return p;
      });

      // E. Persist Invoice & Journal to IDB
      await idbPut('invoices', finalInvoice);
      await idbPut('journal_entries', journal);

      // F. Persist Stock Movements & Layers
      for (const m of newMovements) {
        await idbPut('stock_movements', m);
        await enqueueMutation('insert_stock_movement', m.id, m);
      }
      for (const l of updatedLayers) {
        await idbPut('inventory_layers', l);
      }

      // G. Enqueue Sync
      await enqueueMutation('upsert_invoice', finalInvoice.id, finalInvoice);

      // H. Update in-memory state
      setInvoices(prev => [finalInvoice, ...prev.filter(inv => inv.id !== finalInvoice.id)]);
      setItems(updatedItems);
      setParties(updatedParties);
      setJournalEntries(prev => cogsJournal ? [cogsJournal, journal, ...prev] : [journal, ...prev]);
      setStockMovements(prev => [...newMovements, ...prev]);
      setInventoryLayers(updatedLayers);

      await refreshPendingCount();
      setCurrentTab('sales');
      if (isOnline) triggerSync();
    } catch (err: any) {
      alert(\`Error saving sales invoice: \${err.message}\`);
    }
  };`;

code = code.replace(oldSalesPattern, newSalesFunc);

// 5. Update handleSavePurchaseBill
const oldPurchasePattern = /const handleSavePurchaseBill = async \(bill: Invoice, status: InvoiceStatus\) => \{[\s\S]*?alert\(`Error saving purchase bill: \${err\.message}`\);\s*\}\s*\};/;

const newPurchaseFunc = `const handleSavePurchaseBill = async (bill: Invoice, status: InvoiceStatus) => {
    try {
      if (!checkPeriodOpen(bill.date)) return;
      const finalBill: Invoice = { ...bill, status };
      const supplier = parties.find(p => p.id === bill.partyId);
      const supplierName = supplier?.name || 'Supplier';

      // A. Generate Double Entry Journal
      const journal = createPurchaseInvoiceJournalEntry(finalBill, accounts, supplierName);

      // B. Increase Inventory Stock and update valuation for line items
      const newMovements: StockMovement[] = [];
      let updatedLayers = [...inventoryLayers];
      const valuationMethod = profile.inventoryConfig?.defaultValuationMethod || 'weighted_average';

      const updatedItems = items.map(item => {
        const line = finalBill.items.find(i => i.name.toLowerCase() === item.name.toLowerCase() || i.itemId === item.id);
        if (line) {
          const prod = item as Product;
          let newCost = item.purchasePrice || item.costPrice || line.rate;

          if (isPhysicalInventoryTracked(prod)) {
            if (valuationMethod === 'weighted_average') {
              newCost = computeWeightedAverageCost(item.stockQty, item.purchasePrice || item.costPrice || 0, line.qty, line.rate);
            } else {
              const newLayer = addValuationLayer(item.id, line.qty, line.rate, finalBill.date, finalBill.id);
              updatedLayers.push(newLayer);
              idbPut('inventory_layers', newLayer);
            }

            const movement = createStockMovement({
              productId: item.id,
              movementType: 'purchase',
              quantity: line.qty,
              unitCost: line.rate,
              referenceType: 'purchase_bill',
              referenceId: finalBill.id,
              warehouseId: DEFAULT_WAREHOUSE.id,
              notes: \`Purchase bill \${finalBill.invoiceNumber}\`
            });
            newMovements.push(movement);
          }

          const newQty = safeAdd(item.stockQty, line.qty);
          const updatedItem = { ...item, stockQty: newQty, purchasePrice: newCost, costPrice: newCost };
          idbPut('items', updatedItem);
          enqueueMutation('upsert_item', updatedItem.id, updatedItem);
          return updatedItem;
        }
        return item;
      });

      // C. Update Supplier Outstanding Balance (Payable increases)
      const updatedParties = parties.map(p => {
        if (p.id === finalBill.partyId) {
          const newBal = safeSub(p.outstandingBalance || 0, finalBill.balanceDue);
          const updatedParty = { ...p, outstandingBalance: newBal };
          idbPut('parties', updatedParty);
          enqueueMutation('upsert_party', updatedParty.id, updatedParty);
          return updatedParty;
        }
        return p;
      });

      // D. Persist Bill & Journal to IDB
      await idbPut('invoices', finalBill);
      await idbPut('journal_entries', journal);

      // E. Persist Movements & Layers
      for (const m of newMovements) {
        await idbPut('stock_movements', m);
        await enqueueMutation('insert_stock_movement', m.id, m);
      }
      for (const l of updatedLayers) {
        await idbPut('inventory_layers', l);
      }

      // F. Enqueue Sync
      await enqueueMutation('upsert_invoice', finalBill.id, finalBill);

      // G. Update in-memory state
      setInvoices(prev => [finalBill, ...prev.filter(inv => inv.id !== finalBill.id)]);
      setItems(updatedItems);
      setParties(updatedParties);
      setJournalEntries(prev => [journal, ...prev]);
      setStockMovements(prev => [...newMovements, ...prev]);
      setInventoryLayers(updatedLayers);

      await refreshPendingCount();
      setCurrentTab('purchase');
      if (isOnline) triggerSync();
    } catch (err: any) {
      alert(\`Error saving purchase bill: \${err.message}\`);
    }
  };`;

code = code.replace(oldPurchasePattern, newPurchaseFunc);

// 6. Add Inventory CRUD Handlers (handleSaveProduct, handleSaveStockTransfer, handleSaveStockAdjustment)
const invHandlers = `  // 7. Product Master CRUD (Goods, Services, Inventory Tracking)
  const handleSaveProduct = async (product: Product) => {
    try {
      const isNew = !items.some(i => i.id === product.id);
      await idbPut('items', product);
      await enqueueMutation('upsert_item', product.id, product);
      
      setItems(prev => [product, ...prev.filter(i => i.id !== product.id)]);

      // If new item and has opening stock, record opening stock movement & valuation layer
      if (isNew && product.openingStock && product.openingStock > 0 && isPhysicalInventoryTracked(product)) {
        const openingMovement = createStockMovement({
          productId: product.id,
          movementType: 'opening_stock',
          quantity: product.openingStock,
          unitCost: product.openingStockRate || product.purchasePrice || 0,
          referenceType: 'manual_adjustment',
          referenceId: product.id,
          warehouseId: product.warehouseId || DEFAULT_WAREHOUSE.id,
          notes: 'Opening stock entry'
        });
        await idbPut('stock_movements', openingMovement);
        await enqueueMutation('insert_stock_movement', openingMovement.id, openingMovement);
        setStockMovements(prev => [openingMovement, ...prev]);

        const layer = addValuationLayer(
          product.id,
          product.openingStock,
          product.openingStockRate || product.purchasePrice || 0,
          new Date().toISOString().split('T')[0]
        );
        await idbPut('inventory_layers', layer);
        setInventoryLayers(prev => [...prev, layer]);
      }

      setProductModal({ isOpen: false, productToEdit: null });
      await refreshPendingCount();
      if (isOnline) triggerSync();
    } catch (err: any) {
      alert(\`Error saving product: \${err.message}\`);
    }
  };

  // Inter-Godown Stock Transfer Handler
  const handleSaveStockTransfer = async (transferData: any) => {
    try {
      const { transfer, outMovement, inMovement } = executeStockTransfer(
        transferData,
        stockMovements
      );

      await idbPut('stock_transfers', transfer);
      await idbPut('stock_movements', outMovement);
      await idbPut('stock_movements', inMovement);

      await enqueueMutation('insert_stock_transfer', transfer.id, transfer);
      await enqueueMutation('insert_stock_movement', outMovement.id, outMovement);
      await enqueueMutation('insert_stock_movement', inMovement.id, inMovement);

      setStockTransfers(prev => [transfer, ...prev]);
      setStockMovements(prev => [inMovement, outMovement, ...prev]);
      setStockTransferModalOpen(false);

      await refreshPendingCount();
      if (isOnline) triggerSync();
    } catch (err: any) {
      alert(\`Error transferring stock: \${err.message}\`);
    }
  };

  // Physical Stock Adjustment Handler
  const handleSaveStockAdjustment = async (adjustmentData: any) => {
    try {
      const { adjustment, movements, journalEntry } = processStockAdjustment(
        adjustmentData,
        items as Product[],
        accounts
      );

      await idbPut('stock_adjustments', adjustment);
      await enqueueMutation('insert_stock_adjustment', adjustment.id, adjustment);

      for (const m of movements) {
        await idbPut('stock_movements', m);
        await enqueueMutation('insert_stock_movement', m.id, m);
      }

      if (journalEntry) {
        await idbPut('journal_entries', journalEntry);
      }

      // Update item physical stock in state and IDB
      const updatedItems = items.map(it => {
        const line = adjustment.lines.find(l => l.productId === it.id);
        if (line) {
          const updated = { ...it, stockQty: line.physicalStock };
          idbPut('items', updated);
          enqueueMutation('upsert_item', updated.id, updated);
          return updated;
        }
        return it;
      });

      setStockAdjustments(prev => [adjustment, ...prev]);
      setStockMovements(prev => [...movements, ...prev]);
      if (journalEntry) {
        setJournalEntries(prev => [journalEntry, ...prev]);
      }
      setItems(updatedItems);
      setStockAdjustmentModalOpen(false);

      await refreshPendingCount();
      if (isOnline) triggerSync();
    } catch (err: any) {
      alert(\`Error saving stock adjustment: \${err.message}\`);
    }
  };
`;

if (!code.includes('handleSaveStockTransfer')) {
  code = code.replace("  // 7. Item CRUD", invHandlers + "\n  // 7. Item CRUD (Legacy Support)");
}

// 7. Update DashboardView props in JSX
code = code.replace(
  `<DashboardView
              invoices={invoices}
              parties={parties}
              items={items}
              expenses={expenses}
              accounts={accounts}`,
  `<DashboardView
              invoices={invoices}
              parties={parties}
              items={items}
              expenses={expenses}
              accounts={accounts}
              journalEntries={journalEntries}
              stockMovements={stockMovements}`
);

// 8. Update InventoryView props in JSX
const oldInvView = `{currentTab === 'items' && (
            <InventoryView
              items={items}
              onAddItem={() => setItemModalOpen(true)}
            />
          )}`;

const newInvView = `{currentTab === 'items' && (
            <InventoryView
              products={items as Product[]}
              warehouses={warehouses}
              movements={stockMovements}
              transfers={stockTransfers}
              adjustments={stockAdjustments}
              batches={productBatches}
              onAddProduct={() => setProductModal({ isOpen: true, productToEdit: null })}
              onEditProduct={(p) => setProductModal({ isOpen: true, productToEdit: p })}
              onOpenTransferModal={() => setStockTransferModalOpen(true)}
              onOpenAdjustmentModal={() => setStockAdjustmentModalOpen(true)}
            />
          )}`;

code = code.replace(oldInvView, newInvView);

// 9. Add ProductModal, StockTransferModal, StockAdjustmentModal in JSX
const invModals = `      {/* Inventory Management Modals */}
      {productModal.isOpen && (
        <ProductModal
          isOpen={productModal.isOpen}
          productToEdit={productModal.productToEdit}
          onClose={() => setProductModal({ isOpen: false, productToEdit: null })}
          onSave={handleSaveProduct}
        />
      )}

      {stockTransferModalOpen && (
        <StockTransferModal
          isOpen={stockTransferModalOpen}
          products={items as Product[]}
          warehouses={warehouses}
          stockMovements={stockMovements}
          onClose={() => setStockTransferModalOpen(false)}
          onSave={handleSaveStockTransfer}
        />
      )}

      {stockAdjustmentModalOpen && (
        <StockAdjustmentModal
          isOpen={stockAdjustmentModalOpen}
          products={items as Product[]}
          warehouses={warehouses}
          stockMovements={stockMovements}
          onClose={() => setStockAdjustmentModalOpen(false)}
          onSave={handleSaveStockAdjustment}
        />
      )}
`;

if (!code.includes('<ProductModal')) {
  code = code.replace("{/* 6. Inventory Item Modal */}", invModals + "\n      {/* 6. Inventory Item Modal */}");
}

fs.writeFileSync('src/App.tsx', code, 'utf8');
console.log('src/App.tsx successfully updated with all Phase 4 Inventory & Accounting integrations!');
