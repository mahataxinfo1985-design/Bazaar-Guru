const fs = require('fs');

let code = fs.readFileSync('src/App.tsx', 'utf8');

// Replace handleSaveSalesInvoice
const salesStart = code.indexOf('const handleSaveSalesInvoice = async (invoice: Invoice');
const salesEnd = code.indexOf('// 2. Create / Save Purchase Bill');

const newSales = `const handleSaveSalesInvoice = async (invoice: Invoice, status: InvoiceStatus) => {
    try {
      if (!checkPeriodOpen(invoice.date)) return;
      const finalInvoice: Invoice = { ...invoice, status };
      const customer = parties.find(p => p.id === invoice.partyId);
      const customerName = customer?.name || 'Customer';

      // Stock availability check if negative stock is disallowed
      const allowNegative = profile.inventoryConfig?.allowNegativeStock ?? false;
      for (const line of finalInvoice.items) {
        const prod = items.find(it => it.id === line.itemId || it.name.toLowerCase() === line.name.toLowerCase()) as Product | undefined;
        if (prod && isPhysicalInventoryTracked(prod.itemType, prod.trackStock)) {
          const check = validateStockAvailability(prod.stockQty || 0, line.qty, allowNegative);
          if (!check.allowed) {
            alert(check.error || \`Insufficient stock for \${prod.name}\`);
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

          if (isPhysicalInventoryTracked(prod.itemType, prod.trackStock)) {
            if (valuationMethod === 'fifo') {
              const fifoRes = consumeFIFOLayers(updatedLayers, item.id, line.qty);
              lineCOGS = fifoRes.cogsAmount;
              updatedLayers = fifoRes.updatedLayers;
            } else {
              const unitCost = item.purchasePrice || item.costPrice || 0;
              const wacRes = calculateCOGSWeightedAverage(line.qty, item.stockQty, unitCost);
              lineCOGS = wacRes.cogsAmount;
            }
            totalInvoiceCOGS = safeAdd(totalInvoiceCOGS, lineCOGS);

            const movement = createStockMovement({
              productId: item.id,
              productName: item.name,
              sku: prod.sku,
              warehouseId: DEFAULT_WAREHOUSE.id,
              warehouseName: DEFAULT_WAREHOUSE.name,
              movementType: 'sales',
              quantityOut: line.qty,
              unitCost: line.qty > 0 ? (lineCOGS / line.qty) : (item.purchasePrice || 0),
              referenceType: 'invoice',
              referenceId: finalInvoice.id,
              referenceNumber: finalInvoice.invoiceNumber,
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
        cogsJournal = createCOGSJournalEntry({
          invoiceId: finalInvoice.id,
          invoiceNumber: finalInvoice.invoiceNumber,
          date: finalInvoice.date,
          cogsAmount: totalInvoiceCOGS,
          accounts
        });
        if (cogsJournal) {
          await idbPut('journal_entries', cogsJournal);
        }
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
        await enqueueMutation('upsert_stock_movement', m.id, m);
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
  };

  `;

code = code.slice(0, salesStart) + newSales + code.slice(salesEnd);

// Replace handleSavePurchaseBill
const purStart = code.indexOf('const handleSavePurchaseBill = async (bill: Invoice');
const purEnd = code.indexOf('// 3. Record Payment Voucher');

const newPurchase = `const handleSavePurchaseBill = async (bill: Invoice, status: InvoiceStatus) => {
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
          const unitRate = line.unitPrice || 0;
          let newCost = item.purchasePrice || item.costPrice || unitRate;

          if (isPhysicalInventoryTracked(prod.itemType, prod.trackStock)) {
            if (valuationMethod === 'weighted_average') {
              newCost = computeWeightedAverageCost(item.stockQty, item.purchasePrice || item.costPrice || 0, line.qty, unitRate);
            } else {
              updatedLayers = addValuationLayer(updatedLayers, {
                productId: item.id,
                quantity: line.qty,
                unitCost: unitRate,
                purchaseDate: finalBill.date,
                referenceType: 'purchase',
                referenceId: finalBill.id
              });
            }

            const movement = createStockMovement({
              productId: item.id,
              productName: item.name,
              sku: prod.sku,
              warehouseId: DEFAULT_WAREHOUSE.id,
              warehouseName: DEFAULT_WAREHOUSE.name,
              movementType: 'purchase',
              quantityIn: line.qty,
              unitCost: unitRate,
              referenceType: 'purchase',
              referenceId: finalBill.id,
              referenceNumber: finalBill.invoiceNumber,
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
        await enqueueMutation('upsert_stock_movement', m.id, m);
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
  };

  `;

code = code.slice(0, purStart) + newPurchase + code.slice(purEnd);

// Replace inventory handlers
const hStart = code.indexOf('// 7. Product Master CRUD');
const hEnd = code.indexOf('// 7. Item CRUD (Legacy Support)');

const newHandlers = `// 7. Product Master CRUD (Goods, Services, Inventory Tracking)
  const handleSaveProduct = async (productData: Partial<Product>) => {
    try {
      const product: Product = {
        id: productData.id || \`prod_\${Date.now()}\`,
        name: productData.name || 'Unnamed Product',
        sku: productData.sku,
        barcode: productData.barcode,
        description: productData.description,
        category: productData.category || 'General',
        brand: productData.brand,
        itemType: productData.itemType || 'goods',
        unit: productData.unit || 'pcs',
        unitPrice: productData.unitPrice || 0,
        purchasePrice: productData.purchasePrice || 0,
        costPrice: productData.purchasePrice || 0,
        mrp: productData.mrp,
        wholesalePrice: productData.wholesalePrice,
        minSellingPrice: productData.minSellingPrice,
        taxInclusive: productData.taxInclusive ?? false,
        hsnCode: productData.hsnCode || '',
        gstRate: productData.gstRate || 0,
        cess: productData.cess || 0,
        openingStock: productData.openingStock || 0,
        openingStockValue: (productData.openingStock || 0) * (productData.openingStockRate || productData.purchasePrice || 0),
        openingStockRate: productData.openingStockRate || productData.purchasePrice || 0,
        openingStockDate: productData.openingStockDate || new Date().toISOString().split('T')[0],
        minStockLevel: productData.minStockLevel || 10,
        reorderLevel: productData.reorderLevel || 10,
        trackStock: productData.trackStock ?? (productData.itemType !== 'service'),
        trackBatch: productData.trackBatch ?? false,
        trackExpiry: productData.trackExpiry ?? false,
        stockQty: productData.openingStock || 0,
        warehouseId: productData.warehouseId || DEFAULT_WAREHOUSE.id,
        isActive: productData.isActive ?? true
      };

      const isNew = !items.some(i => i.id === product.id);
      await idbPut('items', product as any);
      await enqueueMutation('upsert_item', product.id, product);

      setItems(prev => [product as any, ...prev.filter(i => i.id !== product.id)]);

      if (isNew && product.openingStock > 0 && isPhysicalInventoryTracked(product.itemType, product.trackStock)) {
        const openingMovement = createStockMovement({
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          movementType: 'opening_stock',
          quantityIn: product.openingStock,
          unitCost: product.openingStockRate || product.purchasePrice || 0,
          referenceType: 'opening',
          referenceId: product.id,
          warehouseId: product.warehouseId || DEFAULT_WAREHOUSE.id,
          warehouseName: DEFAULT_WAREHOUSE.name,
          notes: 'Opening stock entry'
        });
        await idbPut('stock_movements', openingMovement);
        await enqueueMutation('upsert_stock_movement', openingMovement.id, openingMovement);
        setStockMovements(prev => [openingMovement, ...prev]);

        const updatedLayers = addValuationLayer(inventoryLayers, {
          productId: product.id,
          quantity: product.openingStock,
          unitCost: product.openingStockRate || product.purchasePrice || 0,
          purchaseDate: product.openingStockDate || new Date().toISOString().split('T')[0],
          referenceType: 'opening',
          referenceId: product.id
        });
        for (const l of updatedLayers) {
          await idbPut('inventory_layers', l);
        }
        setInventoryLayers(updatedLayers);
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
      const transferObj: StockTransfer = {
        id: \`transfer_\${Date.now()}\`,
        transferNumber: \`TRF-\${Date.now().toString().slice(-5)}\`,
        sourceWarehouseId: transferData.sourceWarehouseId,
        destinationWarehouseId: transferData.destinationWarehouseId,
        date: transferData.date,
        status: 'completed',
        notes: transferData.notes,
        lines: transferData.lines.map((l: any, idx: number) => ({
          id: \`trf_line_\${Date.now()}_\${idx}\`,
          transferId: \`transfer_\${Date.now()}\`,
          productId: l.productId,
          productName: l.productName,
          sku: l.sku,
          quantity: l.quantity,
          unitCost: l.unitCost,
          totalValue: l.totalValue
        })),
        createdAt: new Date().toISOString()
      };

      const { newMovements, updatedTransfer } = executeStockTransfer(
        transferObj,
        stockMovements,
        items as Product[],
        warehouses
      );

      await idbPut('stock_transfers', updatedTransfer);
      await enqueueMutation('upsert_stock_transfer', updatedTransfer.id, updatedTransfer);

      for (const m of newMovements) {
        await idbPut('stock_movements', m);
        await enqueueMutation('upsert_stock_movement', m.id, m);
      }

      setStockTransfers(prev => [updatedTransfer, ...prev]);
      setStockMovements(prev => [...newMovements, ...prev]);
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
      const totalAdjValue = adjustmentData.lines.reduce((acc: number, l: any) => {
        const diff = safeSub(l.physicalQuantity, l.systemQuantity);
        return acc + Math.abs(diff * l.unitCost);
      }, 0);

      const adjObj: StockAdjustment = {
        id: \`adj_\${Date.now()}\`,
        adjustmentNumber: \`ADJ-\${Date.now().toString().slice(-5)}\`,
        warehouseId: adjustmentData.warehouseId,
        date: adjustmentData.date,
        status: 'posted',
        narration: adjustmentData.narration,
        totalAdjustmentValue: totalAdjValue,
        lines: adjustmentData.lines.map((l: any, idx: number) => {
          const diff = safeSub(l.physicalQuantity, l.systemQuantity);
          return {
            id: \`adj_line_\${Date.now()}_\${idx}\`,
            adjustmentId: \`adj_\${Date.now()}\`,
            productId: l.productId,
            productName: l.productName,
            sku: l.sku,
            systemQuantity: l.systemQuantity,
            physicalQuantity: l.physicalQuantity,
            differenceQuantity: diff,
            unitCost: l.unitCost,
            totalValue: Math.abs(diff * l.unitCost),
            reason: l.reason
          };
        }),
        createdAt: new Date().toISOString()
      };

      const { newMovements, accountingImpact } = processStockAdjustment(
        adjObj,
        stockMovements
      );

      await idbPut('stock_adjustments', adjObj);
      await enqueueMutation('upsert_stock_adjustment', adjObj.id, adjObj);

      for (const m of newMovements) {
        await idbPut('stock_movements', m);
        await enqueueMutation('upsert_stock_movement', m.id, m);
      }

      let journal: JournalEntry | null = null;
      if (accountingImpact.lossAmount > 0 || accountingImpact.gainAmount > 0) {
        journal = createStockAdjustmentJournalEntry({
          adjustmentId: adjObj.id,
          adjustmentNumber: adjObj.adjustmentNumber,
          date: adjObj.date,
          lossAmount: accountingImpact.lossAmount,
          gainAmount: accountingImpact.gainAmount,
          accounts
        });
        if (journal) {
          await idbPut('journal_entries', journal);
        }
      }

      // Update item physical stock in state and IDB
      const updatedItems = items.map(it => {
        const line = adjObj.lines.find(l => l.productId === it.id);
        if (line) {
          const updated = { ...it, stockQty: line.physicalQuantity };
          idbPut('items', updated);
          enqueueMutation('upsert_item', updated.id, updated);
          return updated;
        }
        return it;
      });

      setStockAdjustments(prev => [adjObj, ...prev]);
      setStockMovements(prev => [...newMovements, ...prev]);
      if (journal) {
        setJournalEntries(prev => [journal, ...prev]);
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

code = code.slice(0, hStart) + newHandlers + code.slice(hEnd);

fs.writeFileSync('src/App.tsx', code, 'utf8');
console.log('src/App.tsx patched successfully with updated signatures!');
