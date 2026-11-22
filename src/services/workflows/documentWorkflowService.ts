import { 
  Quotation, SalesOrder, DeliveryChallan, PurchaseOrder, GoodsReceiptNote, 
  WorkflowItemLine, DocumentConversionRecord, WorkflowDocType, WorkflowDocStatus 
} from '../../types/workspace';
import { Invoice, InvoiceItem } from '../../types';
import { idbPut, idbGetAll } from '../storage/idb';
import { recordStockMovement } from '../inventory/stockMovementService';
import { createSalesInvoiceJournalEntry, createPurchaseInvoiceJournalEntry } from '../accounting/journalEngine';

/**
 * Calculates item totals, taxes, and grand totals for workflow documents.
 */
export function calculateWorkflowDocumentTotals(items: WorkflowItemLine[]): {
  subtotal: number;
  discountTotal: number;
  taxableTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  grandTotal: number;
} {
  let subtotal = 0;
  let discountTotal = 0;
  let taxableTotal = 0;
  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;

  for (const item of items) {
    const lineGross = item.orderedQty * item.unitPrice;
    subtotal += lineGross;

    let lineDiscount = 0;
    if (item.discountType === 'percentage') {
      lineDiscount = (lineGross * (item.discount || 0)) / 100;
    } else {
      lineDiscount = item.discount || 0;
    }
    discountTotal += lineDiscount;

    const lineTaxable = Math.max(0, lineGross - lineDiscount);
    taxableTotal += lineTaxable;

    cgstTotal += item.cgst || 0;
    sgstTotal += item.sgst || 0;
    igstTotal += item.igst || 0;
  }

  const grandTotal = Math.round(taxableTotal + cgstTotal + sgstTotal + igstTotal);
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discountTotal: Math.round(discountTotal * 100) / 100,
    taxableTotal: Math.round(taxableTotal * 100) / 100,
    cgstTotal: Math.round(cgstTotal * 100) / 100,
    sgstTotal: Math.round(sgstTotal * 100) / 100,
    igstTotal: Math.round(igstTotal * 100) / 100,
    grandTotal
  };
}

export type CreateQuotationInput = Omit<Quotation, 'id' | 'status' | 'conversions' | 'createdAt' | 'updatedAt' | 'subtotal' | 'discountTotal' | 'taxableTotal' | 'cgstTotal' | 'sgstTotal' | 'igstTotal' | 'grandTotal'> & Partial<Pick<Quotation, 'subtotal' | 'discountTotal' | 'taxableTotal' | 'cgstTotal' | 'sgstTotal' | 'igstTotal' | 'grandTotal'>>;

export type CreatePurchaseOrderInput = Omit<PurchaseOrder, 'id' | 'status' | 'conversions' | 'createdAt' | 'updatedAt' | 'subtotal' | 'discountTotal' | 'taxableTotal' | 'cgstTotal' | 'sgstTotal' | 'igstTotal' | 'grandTotal'> & Partial<Pick<PurchaseOrder, 'subtotal' | 'discountTotal' | 'taxableTotal' | 'cgstTotal' | 'sgstTotal' | 'igstTotal' | 'grandTotal'>>;

/**
 * Creates a Quotation. Non-posting: no accounting or inventory side-effects.
 */
export async function createQuotation(data: CreateQuotationInput): Promise<Quotation> {
  const totals = calculateWorkflowDocumentTotals(data.items);
  const now = new Date().toISOString();
  const quote: Quotation = {
    ...data,
    id: `quo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    ...totals,
    status: 'open',
    conversions: [],
    createdAt: now,
    updatedAt: now
  };
  await idbPut('quotations', quote);
  return quote;
}

/**
 * Converts a Quotation to a Sales Order. Non-posting.
 */
export async function convertQuotationToSalesOrder(
  quotation: Quotation,
  soNumber: string,
  quantitiesToConvert?: Record<string, number> // itemId -> qty
): Promise<{ salesOrder: SalesOrder; updatedQuotation: Quotation }> {
  const soItems: WorkflowItemLine[] = [];
  const convertedQtyMap: Record<string, number> = {};

  const updatedQuoteItems = quotation.items.map(item => {
    const qtyToConvert = quantitiesToConvert ? (quantitiesToConvert[item.itemId] ?? item.pendingQty) : item.pendingQty;
    if (qtyToConvert <= 0) return { ...item };

    if (qtyToConvert > item.pendingQty) {
      throw new Error(`Cannot convert ${qtyToConvert} for ${item.name}; only ${item.pendingQty} pending.`);
    }

    convertedQtyMap[item.itemId] = qtyToConvert;
    const fulfilled = item.fulfilledQty + qtyToConvert;
    const pending = item.orderedQty - fulfilled;

    soItems.push({
      ...item,
      id: `so_item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      orderedQty: qtyToConvert,
      fulfilledQty: 0,
      pendingQty: qtyToConvert
    });

    return {
      ...item,
      fulfilledQty: fulfilled,
      pendingQty: pending
    };
  });

  if (soItems.length === 0) {
    throw new Error('No items or quantities eligible for conversion to Sales Order.');
  }

  const totals = calculateWorkflowDocumentTotals(soItems);
  const now = new Date().toISOString();
  const soId = `so_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  const salesOrder: SalesOrder = {
    id: soId,
    businessId: quotation.businessId,
    orderNumber: soNumber,
    date: new Date().toISOString().split('T')[0],
    partyId: quotation.partyId,
    partyName: quotation.partyName,
    quotationId: quotation.id,
    quotationNumber: quotation.quotationNumber,
    items: soItems,
    ...totals,
    terms: quotation.terms,
    notes: quotation.notes,
    status: 'open',
    conversions: [],
    createdAt: now,
    updatedAt: now
  };

  const isAllFulfilled = updatedQuoteItems.every(i => i.pendingQty <= 0);
  const conversionRecord: DocumentConversionRecord = {
    conversionId: `conv_${Date.now()}`,
    timestamp: now,
    sourceDocType: 'quotation',
    sourceDocId: quotation.id,
    sourceDocNumber: quotation.quotationNumber,
    targetDocType: 'sales_order',
    targetDocId: soId,
    targetDocNumber: soNumber,
    convertedQtyMap
  };

  const updatedQuotation: Quotation = {
    ...quotation,
    items: updatedQuoteItems,
    status: isAllFulfilled ? 'fulfilled' : 'partially_fulfilled',
    conversions: [...(quotation.conversions || []), conversionRecord],
    updatedAt: now
  };

  await idbPut('sales_orders', salesOrder);
  await idbPut('quotations', updatedQuotation);

  return { salesOrder, updatedQuotation };
}

/**
 * Converts Sales Order to Delivery Challan.
 * Side-effect: Deducts physical inventory movements from specified warehouse.
 */
export async function convertSalesOrderToChallan(
  salesOrder: SalesOrder,
  challanNumber: string,
  warehouseId: string = 'wh_default_01',
  quantitiesToDeliver?: Record<string, number>
): Promise<{ deliveryChallan: DeliveryChallan; updatedSalesOrder: SalesOrder }> {
  const dcItems: WorkflowItemLine[] = [];
  const convertedQtyMap: Record<string, number> = {};

  const updatedSOItems = salesOrder.items.map(item => {
    const qtyToDeliver = quantitiesToDeliver ? (quantitiesToDeliver[item.itemId] ?? item.pendingQty) : item.pendingQty;
    if (qtyToDeliver <= 0) return { ...item };

    if (qtyToDeliver > item.pendingQty) {
      throw new Error(`Cannot deliver ${qtyToDeliver} for ${item.name}; only ${item.pendingQty} pending on Sales Order.`);
    }

    convertedQtyMap[item.itemId] = qtyToDeliver;
    const fulfilled = item.fulfilledQty + qtyToDeliver;
    const pending = item.orderedQty - fulfilled;

    dcItems.push({
      ...item,
      id: `dc_item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      orderedQty: qtyToDeliver,
      fulfilledQty: 0,
      pendingQty: qtyToDeliver
    });

    return {
      ...item,
      fulfilledQty: fulfilled,
      pendingQty: pending
    };
  });

  if (dcItems.length === 0) {
    throw new Error('No items or quantities eligible for Delivery Challan.');
  }

  const totals = calculateWorkflowDocumentTotals(dcItems);
  const now = new Date().toISOString();
  const dcId = `dc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  // Record Stock Movements for outward delivery
  for (const item of dcItems) {
    await recordStockMovement({
      productId: item.itemId,
      warehouseId,
      movementType: 'out',
      quantity: item.orderedQty,
      referenceType: 'delivery_challan',
      referenceId: dcId,
      date: new Date().toISOString().split('T')[0],
      notes: `Delivery Challan ${challanNumber} for SO ${salesOrder.orderNumber}`
    });
  }

  const deliveryChallan: DeliveryChallan = {
    id: dcId,
    businessId: salesOrder.businessId,
    challanNumber,
    date: new Date().toISOString().split('T')[0],
    partyId: salesOrder.partyId,
    partyName: salesOrder.partyName,
    salesOrderId: salesOrder.id,
    salesOrderNumber: salesOrder.orderNumber,
    warehouseId,
    items: dcItems,
    subtotal: totals.subtotal,
    taxableTotal: totals.taxableTotal,
    grandTotal: totals.grandTotal,
    status: 'open',
    stockDeducted: true,
    conversions: [],
    createdAt: now,
    updatedAt: now
  };

  const isAllFulfilled = updatedSOItems.every(i => i.pendingQty <= 0);
  const conversionRecord: DocumentConversionRecord = {
    conversionId: `conv_${Date.now()}`,
    timestamp: now,
    sourceDocType: 'sales_order',
    sourceDocId: salesOrder.id,
    sourceDocNumber: salesOrder.orderNumber,
    targetDocType: 'delivery_challan',
    targetDocId: dcId,
    targetDocNumber: challanNumber,
    convertedQtyMap
  };

  const updatedSalesOrder: SalesOrder = {
    ...salesOrder,
    items: updatedSOItems,
    status: isAllFulfilled ? 'fulfilled' : 'partially_fulfilled',
    conversions: [...(salesOrder.conversions || []), conversionRecord],
    updatedAt: now
  };

  await idbPut('delivery_challans', deliveryChallan);
  await idbPut('sales_orders', updatedSalesOrder);

  return { deliveryChallan, updatedSalesOrder };
}

/**
 * Converts Sales Order directly to a Tax Invoice.
 * Posts accounting journal entry and deducts stock.
 */
export async function convertSalesOrderToInvoice(
  salesOrder: SalesOrder,
  invoiceNumber: string,
  quantitiesToInvoice?: Record<string, number>,
  warehouseId: string = 'wh_default_01'
): Promise<{ invoice: Invoice; updatedSalesOrder: SalesOrder }> {
  const invItems: InvoiceItem[] = [];
  const convertedQtyMap: Record<string, number> = {};

  const updatedSOItems = salesOrder.items.map(item => {
    const qtyToInv = quantitiesToInvoice ? (quantitiesToInvoice[item.itemId] ?? item.pendingQty) : item.pendingQty;
    if (qtyToInv <= 0) return { ...item };

    if (qtyToInv > item.pendingQty) {
      throw new Error(`Cannot invoice ${qtyToInv} for ${item.name}; only ${item.pendingQty} pending.`);
    }

    convertedQtyMap[item.itemId] = qtyToInv;
    const fulfilled = item.fulfilledQty + qtyToInv;
    const pending = item.orderedQty - fulfilled;

    const lineGross = qtyToInv * item.unitPrice;
    let lineDiscount = 0;
    if (item.discountType === 'percentage') {
      lineDiscount = (lineGross * (item.discount || 0)) / 100;
    } else {
      lineDiscount = item.discount || 0;
    }
    const lineTaxable = Math.max(0, lineGross - lineDiscount);

    const cgst = Math.round((lineTaxable * (item.gstRate / 2)) / 100 * 100) / 100;
    const sgst = cgst;
    const igst = 0;
    const total = Math.round((lineTaxable + cgst + sgst + igst) * 100) / 100;

    invItems.push({
      id: `inv_item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      itemId: item.itemId,
      name: item.name,
      hsnCode: item.hsnCode,
      qty: qtyToInv,
      unit: item.unit,
      unitPrice: item.unitPrice,
      discount: item.discount,
      discountType: item.discountType,
      taxableValue: lineTaxable,
      gstRate: item.gstRate,
      cgst,
      sgst,
      igst,
      total
    });

    return {
      ...item,
      fulfilledQty: fulfilled,
      pendingQty: pending
    };
  });

  if (invItems.length === 0) {
    throw new Error('No items or quantities eligible for Tax Invoice.');
  }

  const subtotal = invItems.reduce((acc, i) => acc + i.qty * i.unitPrice, 0);
  const discount = invItems.reduce((acc, i) => acc + (i.discountType === 'percentage' ? (i.qty * i.unitPrice * i.discount) / 100 : i.discount), 0);
  const taxableAmount = invItems.reduce((acc, i) => acc + i.taxableValue, 0);
  const cgst = invItems.reduce((acc, i) => acc + i.cgst, 0);
  const sgst = invItems.reduce((acc, i) => acc + i.sgst, 0);
  const igst = invItems.reduce((acc, i) => acc + i.igst, 0);
  const grandTotal = Math.round(taxableAmount + cgst + sgst + igst);
  const now = new Date().toISOString();
  const invId = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  const invoice: Invoice = {
    id: invId,
    invoiceNumber,
    poNumber: salesOrder.orderNumber,
    type: 'Tax Invoice',
    date: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    partyId: salesOrder.partyId,
    partyType: 'customer',
    items: invItems,
    subtotal,
    discount,
    taxableAmount,
    cgst,
    sgst,
    igst,
    cess: 0,
    roundOff: 0,
    grandTotal,
    amountInWords: '',
    paymentMode: 'Credit',
    amountReceived: 0,
    balanceDue: grandTotal,
    paymentStatus: 'Unpaid',
    status: 'Active',
    createdAt: now,
    updatedAt: now,
    auditTrail: [{
      timestamp: now,
      action: `Created Tax Invoice from Sales Order ${salesOrder.orderNumber}`,
      user: 'system'
    }]
  };

  // Stock deduction for items
  for (const item of invItems) {
    if (item.itemId) {
      await recordStockMovement({
        productId: item.itemId,
        warehouseId,
        movementType: 'out',
        quantity: item.qty,
        referenceType: 'sale',
        referenceId: invId,
        date: invoice.date,
        notes: `Direct Invoice for SO ${salesOrder.orderNumber}`
      });
    }
  }

  // Accounting Journal Posting
  const accounts = await idbGetAll('accounts');
  const je = createSalesInvoiceJournalEntry(invoice, accounts, salesOrder.partyName);
  await idbPut('journal_entries', je);

  const isAllFulfilled = updatedSOItems.every(i => i.pendingQty <= 0);
  const conversionRecord: DocumentConversionRecord = {
    conversionId: `conv_${Date.now()}`,
    timestamp: now,
    sourceDocType: 'sales_order',
    sourceDocId: salesOrder.id,
    sourceDocNumber: salesOrder.orderNumber,
    targetDocType: 'tax_invoice',
    targetDocId: invId,
    targetDocNumber: invoiceNumber,
    convertedQtyMap
  };

  const updatedSalesOrder: SalesOrder = {
    ...salesOrder,
    items: updatedSOItems,
    status: isAllFulfilled ? 'fulfilled' : 'partially_fulfilled',
    conversions: [...(salesOrder.conversions || []), conversionRecord],
    updatedAt: now
  };

  await idbPut('invoices', invoice);
  await idbPut('sales_orders', updatedSalesOrder);

  return { invoice, updatedSalesOrder };
}

/**
 * Creates a Purchase Order. Non-posting: no accounting or inventory side-effects.
 */
export async function createPurchaseOrder(data: CreatePurchaseOrderInput): Promise<PurchaseOrder> {
  const totals = calculateWorkflowDocumentTotals(data.items);
  const now = new Date().toISOString();
  const po: PurchaseOrder = {
    ...data,
    id: `po_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    ...totals,
    status: 'open',
    conversions: [],
    createdAt: now,
    updatedAt: now
  };
  await idbPut('purchase_orders', po);
  return po;
}

/**
 * Converts a Purchase Order to Goods Receipt Note (GRN).
 * Side-effect: Adds physical stock to the warehouse.
 */
export async function convertPOToGRN(
  purchaseOrder: PurchaseOrder,
  grnNumber: string,
  warehouseId: string = 'wh_default_01',
  quantitiesToReceive?: Record<string, number>
): Promise<{ goodsReceiptNote: GoodsReceiptNote; updatedPurchaseOrder: PurchaseOrder }> {
  const grnItems: WorkflowItemLine[] = [];
  const convertedQtyMap: Record<string, number> = {};

  const updatedPOItems = purchaseOrder.items.map(item => {
    const qtyToReceive = quantitiesToReceive ? (quantitiesToReceive[item.itemId] ?? item.pendingQty) : item.pendingQty;
    if (qtyToReceive <= 0) return { ...item };

    if (qtyToReceive > item.pendingQty) {
      throw new Error(`Cannot receive ${qtyToReceive} for ${item.name}; only ${item.pendingQty} pending on PO.`);
    }

    convertedQtyMap[item.itemId] = qtyToReceive;
    const fulfilled = item.fulfilledQty + qtyToReceive;
    const pending = item.orderedQty - fulfilled;

    grnItems.push({
      ...item,
      id: `grn_item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      orderedQty: qtyToReceive,
      fulfilledQty: 0,
      pendingQty: qtyToReceive
    });

    return {
      ...item,
      fulfilledQty: fulfilled,
      pendingQty: pending
    };
  });

  if (grnItems.length === 0) {
    throw new Error('No items or quantities eligible for Goods Receipt Note.');
  }

  const now = new Date().toISOString();
  const grnId = `grn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  // Record Inward Stock Movements
  for (const item of grnItems) {
    await recordStockMovement({
      productId: item.itemId,
      warehouseId,
      movementType: 'in',
      quantity: item.orderedQty,
      unitCost: item.unitPrice,
      referenceType: 'purchase',
      referenceId: grnId,
      date: new Date().toISOString().split('T')[0],
      notes: `GRN ${grnNumber} for PO ${purchaseOrder.orderNumber}`
    });
  }

  const goodsReceiptNote: GoodsReceiptNote = {
    id: grnId,
    businessId: purchaseOrder.businessId,
    grnNumber,
    date: new Date().toISOString().split('T')[0],
    supplierId: purchaseOrder.supplierId,
    supplierName: purchaseOrder.supplierName,
    purchaseOrderId: purchaseOrder.id,
    purchaseOrderNumber: purchaseOrder.orderNumber,
    warehouseId,
    items: grnItems,
    status: 'open',
    stockAdded: true,
    conversions: [],
    createdAt: now,
    updatedAt: now
  };

  const isAllFulfilled = updatedPOItems.every(i => i.pendingQty <= 0);
  const conversionRecord: DocumentConversionRecord = {
    conversionId: `conv_${Date.now()}`,
    timestamp: now,
    sourceDocType: 'purchase_order',
    sourceDocId: purchaseOrder.id,
    sourceDocNumber: purchaseOrder.orderNumber,
    targetDocType: 'goods_receipt_note',
    targetDocId: grnId,
    targetDocNumber: grnNumber,
    convertedQtyMap
  };

  const updatedPurchaseOrder: PurchaseOrder = {
    ...purchaseOrder,
    items: updatedPOItems,
    status: isAllFulfilled ? 'fulfilled' : 'partially_fulfilled',
    conversions: [...(purchaseOrder.conversions || []), conversionRecord],
    updatedAt: now
  };

  await idbPut('goods_receipt_notes', goodsReceiptNote);
  await idbPut('purchase_orders', updatedPurchaseOrder);

  return { goodsReceiptNote, updatedPurchaseOrder };
}
