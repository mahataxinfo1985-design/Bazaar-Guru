import { ReturnItemRequest, ReturnProcessingResult, ReturnReason } from '../../types/workspace';
import { Invoice, InvoiceItem } from '../../types';
import { idbGetAll, idbPut } from '../storage/idb';
import { recordStockMovement } from '../inventory/stockMovementService';
import { createSalesReturnJournalEntry, createPurchaseReturnJournalEntry } from '../accounting/journalEngine';

/**
 * Validates whether the requested return quantities are within the eligible limits of the original invoice.
 */
export async function validateReturnEligibility(
  originalInvoice: Invoice,
  requestedItems: ReturnItemRequest[]
): Promise<{ isEligible: boolean; errors: string[] }> {
  const errors: string[] = [];

  // Fetch all existing credit notes / debit notes referencing this invoice
  const allInvoices = await idbGetAll('invoices');
  const existingNotes = allInvoices.filter(
    inv => inv.referenceNumber === originalInvoice.invoiceNumber && inv.status !== 'Cancelled'
  );

  // Calculate previously returned quantities per itemId
  const previouslyReturnedMap: Record<string, number> = {};
  for (const note of existingNotes) {
    for (const item of note.items) {
      if (item.itemId) {
        previouslyReturnedMap[item.itemId] = (previouslyReturnedMap[item.itemId] || 0) + item.qty;
      }
    }
  }

  // Check each requested item
  for (const req of requestedItems) {
    const origItem = originalInvoice.items.find(i => i.itemId === req.itemId || i.name === req.name);
    if (!origItem) {
      errors.push(`Item "${req.name}" was not part of original invoice ${originalInvoice.invoiceNumber}.`);
      continue;
    }

    const prevReturned = previouslyReturnedMap[req.itemId] || 0;
    const eligibleQty = origItem.qty - prevReturned;

    if (req.returnQty <= 0) {
      errors.push(`Return quantity for "${req.name}" must be greater than zero.`);
    } else if (req.returnQty > eligibleQty) {
      errors.push(
        `Cannot return ${req.returnQty} units of "${req.name}". Eligible quantity is ${eligibleQty} (Original: ${origItem.qty}, Previously returned: ${prevReturned}).`
      );
    }
  }

  return {
    isEligible: errors.length === 0,
    errors
  };
}

/**
 * Processes a Sales Return: creates Credit Note, restocks inventory, posts journal entry.
 */
export async function processSalesReturn(
  originalInvoice: Invoice,
  creditNoteNumber: string,
  returnItems: ReturnItemRequest[],
  warehouseId: string = 'wh_default_01',
  partyName: string = 'Customer'
): Promise<ReturnProcessingResult> {
  const eligibility = await validateReturnEligibility(originalInvoice, returnItems);
  if (!eligibility.isEligible) {
    throw new Error(`Sales Return validation failed: ${eligibility.errors.join('; ')}`);
  }

  const accounts = await idbGetAll('accounts');
  const now = new Date().toISOString();
  const cnId = `cn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  // Build Credit Note items
  const cnItems: InvoiceItem[] = returnItems.map(req => {
    const origItem = originalInvoice.items.find(i => i.itemId === req.itemId || i.name === req.name)!;
    const lineGross = req.returnQty * req.unitPrice;
    const cgst = Math.round((lineGross * (req.gstRate / 2)) / 100 * 100) / 100;
    const sgst = cgst;
    const total = Math.round((lineGross + cgst + sgst) * 100) / 100;

    return {
      id: `cn_item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      itemId: req.itemId,
      name: req.name,
      hsnCode: origItem.hsnCode || '8471',
      qty: req.returnQty,
      unit: origItem.unit || 'PCS',
      unitPrice: req.unitPrice,
      discount: 0,
      discountType: 'percentage',
      taxableValue: lineGross,
      gstRate: req.gstRate,
      cgst,
      sgst,
      igst: 0,
      total,
      batchNumber: req.batchNumber
    };
  });

  const subtotalReturned = cnItems.reduce((acc, i) => acc + i.taxableValue, 0);
  const cgstReturned = cnItems.reduce((acc, i) => acc + i.cgst, 0);
  const sgstReturned = cnItems.reduce((acc, i) => acc + i.sgst, 0);
  const taxReturned = cgstReturned + sgstReturned;
  const totalReturned = Math.round(subtotalReturned + taxReturned);

  const creditNote: Invoice = {
    id: cnId,
    invoiceNumber: creditNoteNumber,
    referenceNumber: originalInvoice.invoiceNumber,
    type: 'Credit Note',
    date: new Date().toISOString().split('T')[0],
    dueDate: new Date().toISOString().split('T')[0],
    partyId: originalInvoice.partyId,
    partyType: 'customer',
    items: cnItems,
    subtotal: subtotalReturned,
    discount: 0,
    taxableAmount: subtotalReturned,
    cgst: cgstReturned,
    sgst: sgstReturned,
    igst: 0,
    cess: 0,
    roundOff: 0,
    grandTotal: totalReturned,
    amountInWords: '',
    paymentMode: 'Credit',
    amountReceived: 0,
    balanceDue: totalReturned,
    paymentStatus: 'Unpaid',
    status: 'Active',
    createdAt: now,
    updatedAt: now,
    notes: `Return reason(s): ${returnItems.map(r => `${r.name}: ${r.reason}`).join(', ')}`,
    auditTrail: [{
      timestamp: now,
      action: `Credit Note created against Sales Invoice ${originalInvoice.invoiceNumber}`,
      user: 'system'
    }]
  };

  // Re-stock physical inventory (goods returned back to warehouse)
  const stockMovementIds: string[] = [];
  for (const item of cnItems) {
    if (item.itemId) {
      const sm = await recordStockMovement({
        productId: item.itemId,
        warehouseId,
        movementType: 'in',
        quantity: item.qty,
        unitCost: item.unitPrice,
        referenceType: 'credit_note',
        referenceId: cnId,
        date: creditNote.date,
        notes: `Sales Return Restock for ${originalInvoice.invoiceNumber}`
      });
      stockMovementIds.push(sm.id);
    }
  }

  // Accounting Journal Entry
  const je = createSalesReturnJournalEntry(creditNote, accounts, partyName);
  await idbPut('journal_entries', je);
  await idbPut('invoices', creditNote);

  // Non-destructive update to original invoice audit trail
  const updatedOriginal: Invoice = {
    ...originalInvoice,
    auditTrail: [
      ...(originalInvoice.auditTrail || []),
      {
        timestamp: now,
        action: `Sales Return processed: Credit Note ${creditNoteNumber} for ₹${totalReturned}`,
        user: 'system'
      }
    ],
    updatedAt: now
  };
  await idbPut('invoices', updatedOriginal);

  return {
    returnDocType: 'credit_note',
    returnDocId: cnId,
    returnDocNumber: creditNoteNumber,
    originalInvoiceId: originalInvoice.id,
    originalInvoiceNumber: originalInvoice.invoiceNumber,
    subtotalReturned,
    taxReturned,
    totalReturned,
    journalEntryId: je.id,
    stockMovementIds
  };
}

/**
 * Processes a Purchase Return: creates Debit Note, removes stock, posts journal entry.
 */
export async function processPurchaseReturn(
  originalInvoice: Invoice,
  debitNoteNumber: string,
  returnItems: ReturnItemRequest[],
  warehouseId: string = 'wh_default_01',
  partyName: string = 'Supplier'
): Promise<ReturnProcessingResult> {
  const eligibility = await validateReturnEligibility(originalInvoice, returnItems);
  if (!eligibility.isEligible) {
    throw new Error(`Purchase Return validation failed: ${eligibility.errors.join('; ')}`);
  }

  const accounts = await idbGetAll('accounts');
  const now = new Date().toISOString();
  const dnId = `dn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  // Build Debit Note items
  const dnItems: InvoiceItem[] = returnItems.map(req => {
    const origItem = originalInvoice.items.find(i => i.itemId === req.itemId || i.name === req.name)!;
    const lineGross = req.returnQty * req.unitPrice;
    const cgst = Math.round((lineGross * (req.gstRate / 2)) / 100 * 100) / 100;
    const sgst = cgst;
    const total = Math.round((lineGross + cgst + sgst) * 100) / 100;

    return {
      id: `dn_item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      itemId: req.itemId,
      name: req.name,
      hsnCode: origItem.hsnCode || '8471',
      qty: req.returnQty,
      unit: origItem.unit || 'PCS',
      unitPrice: req.unitPrice,
      discount: 0,
      discountType: 'percentage',
      taxableValue: lineGross,
      gstRate: req.gstRate,
      cgst,
      sgst,
      igst: 0,
      total,
      batchNumber: req.batchNumber
    };
  });

  const subtotalReturned = dnItems.reduce((acc, i) => acc + i.taxableValue, 0);
  const cgstReturned = dnItems.reduce((acc, i) => acc + i.cgst, 0);
  const sgstReturned = dnItems.reduce((acc, i) => acc + i.sgst, 0);
  const taxReturned = cgstReturned + sgstReturned;
  const totalReturned = Math.round(subtotalReturned + taxReturned);

  const debitNote: Invoice = {
    id: dnId,
    invoiceNumber: debitNoteNumber,
    referenceNumber: originalInvoice.invoiceNumber,
    type: 'Debit Note',
    date: new Date().toISOString().split('T')[0],
    dueDate: new Date().toISOString().split('T')[0],
    partyId: originalInvoice.partyId,
    partyType: 'supplier',
    items: dnItems,
    subtotal: subtotalReturned,
    discount: 0,
    taxableAmount: subtotalReturned,
    cgst: cgstReturned,
    sgst: sgstReturned,
    igst: 0,
    cess: 0,
    roundOff: 0,
    grandTotal: totalReturned,
    amountInWords: '',
    paymentMode: 'Credit',
    amountReceived: 0,
    balanceDue: totalReturned,
    paymentStatus: 'Unpaid',
    status: 'Active',
    createdAt: now,
    updatedAt: now,
    notes: `Return reason(s): ${returnItems.map(r => `${r.name}: ${r.reason}`).join(', ')}`,
    auditTrail: [{
      timestamp: now,
      action: `Debit Note created against Purchase Bill ${originalInvoice.invoiceNumber}`,
      user: 'system'
    }]
  };

  // Stock deduction (goods returned out to supplier)
  const stockMovementIds: string[] = [];
  for (const item of dnItems) {
    if (item.itemId) {
      const sm = await recordStockMovement({
        productId: item.itemId,
        warehouseId,
        movementType: 'out',
        quantity: item.qty,
        unitCost: item.unitPrice,
        referenceType: 'debit_note',
        referenceId: dnId,
        date: debitNote.date,
        notes: `Purchase Return for ${originalInvoice.invoiceNumber}`
      });
      stockMovementIds.push(sm.id);
    }
  }

  // Accounting Journal Entry
  const je = createPurchaseReturnJournalEntry(debitNote, accounts, partyName);
  await idbPut('journal_entries', je);
  await idbPut('invoices', debitNote);

  // Non-destructive update to original invoice audit trail
  const updatedOriginal: Invoice = {
    ...originalInvoice,
    auditTrail: [
      ...(originalInvoice.auditTrail || []),
      {
        timestamp: now,
        action: `Purchase Return processed: Debit Note ${debitNoteNumber} for ₹${totalReturned}`,
        user: 'system'
      }
    ],
    updatedAt: now
  };
  await idbPut('invoices', updatedOriginal);

  return {
    returnDocType: 'debit_note',
    returnDocId: dnId,
    returnDocNumber: debitNoteNumber,
    originalInvoiceId: originalInvoice.id,
    originalInvoiceNumber: originalInvoice.invoiceNumber,
    subtotalReturned,
    taxReturned,
    totalReturned,
    journalEntryId: je.id,
    stockMovementIds
  };
}
