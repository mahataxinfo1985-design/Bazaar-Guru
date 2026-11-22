import { GlobalSearchResult } from '../../types/workspace';
import { idbGetAll } from '../storage/idb';

/**
 * Searches across all business entities:
 * Invoices, Bills, Quotations, Sales Orders, Challans, Purchase Orders, Parties, Products, Vouchers, Documents.
 */
export async function performGlobalSearch(query: string): Promise<GlobalSearchResult[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const q = query.trim().toLowerCase();
  const results: GlobalSearchResult[] = [];

  // 1. Invoices & Bills
  const invoices = await idbGetAll('invoices');
  for (const inv of invoices) {
    if (inv.deleted) continue;
    const matchInvNumber = inv.invoiceNumber.toLowerCase().includes(q);
    const matchParty = (inv as any).partyName?.toLowerCase()?.includes(q);
    const matchRef = inv.referenceNumber?.toLowerCase()?.includes(q);
    const matchPo = inv.poNumber?.toLowerCase()?.includes(q);

    if (matchInvNumber || matchParty || matchRef || matchPo) {
      results.push({
        id: inv.id,
        type: inv.partyType === 'supplier' ? 'purchase_bill' : 'invoice',
        title: `${inv.type}: ${inv.invoiceNumber}`,
        subtitle: `Total: ₹${inv.grandTotal.toFixed(2)} | Status: ${inv.status} | Date: ${inv.date}`,
        badge: inv.type,
        date: inv.date,
        amount: inv.grandTotal,
        linkUrl: inv.partyType === 'supplier' ? '/purchases' : '/sales'
      });
    }
  }

  // 2. Quotations
  const quotations = await idbGetAll('quotations');
  for (const quo of quotations) {
    if (quo.quotationNumber.toLowerCase().includes(q) || quo.partyName.toLowerCase().includes(q)) {
      results.push({
        id: quo.id,
        type: 'quotation',
        title: `Quotation: ${quo.quotationNumber}`,
        subtitle: `Party: ${quo.partyName} | Total: ₹${quo.grandTotal.toFixed(2)} | Status: ${quo.status}`,
        badge: 'Quotation',
        date: quo.date,
        amount: quo.grandTotal,
        linkUrl: '/sales'
      });
    }
  }

  // 3. Sales Orders
  const salesOrders = await idbGetAll('sales_orders');
  for (const so of salesOrders) {
    if (so.orderNumber.toLowerCase().includes(q) || so.partyName.toLowerCase().includes(q)) {
      results.push({
        id: so.id,
        type: 'sales_order',
        title: `Sales Order: ${so.orderNumber}`,
        subtitle: `Party: ${so.partyName} | Total: ₹${so.grandTotal.toFixed(2)} | Status: ${so.status}`,
        badge: 'Sales Order',
        date: so.date,
        amount: so.grandTotal,
        linkUrl: '/sales'
      });
    }
  }

  // 4. Delivery Challans
  const challans = await idbGetAll('delivery_challans');
  for (const dc of challans) {
    if (dc.challanNumber.toLowerCase().includes(q) || dc.partyName.toLowerCase().includes(q)) {
      results.push({
        id: dc.id,
        type: 'challan',
        title: `Delivery Challan: ${dc.challanNumber}`,
        subtitle: `Party: ${dc.partyName} | Status: ${dc.status}`,
        badge: 'Challan',
        date: dc.date,
        amount: dc.grandTotal,
        linkUrl: '/sales'
      });
    }
  }

  // 5. Purchase Orders
  const pos = await idbGetAll('purchase_orders');
  for (const po of pos) {
    if (po.orderNumber.toLowerCase().includes(q) || po.supplierName.toLowerCase().includes(q)) {
      results.push({
        id: po.id,
        type: 'purchase_order',
        title: `Purchase Order: ${po.orderNumber}`,
        subtitle: `Supplier: ${po.supplierName} | Total: ₹${po.grandTotal.toFixed(2)} | Status: ${po.status}`,
        badge: 'Purchase Order',
        date: po.date,
        amount: po.grandTotal,
        linkUrl: '/purchases'
      });
    }
  }

  // 6. Parties
  const parties = await idbGetAll('parties');
  for (const party of parties) {
    const matchName = party.name.toLowerCase().includes(q);
    const matchPhone = party.phone?.includes(q);
    const matchGstin = party.gstin?.toLowerCase().includes(q);

    if (matchName || matchPhone || matchGstin) {
      results.push({
        id: party.id,
        type: 'party',
        title: party.name,
        subtitle: `${party.type.toUpperCase()} | Phone: ${party.phone} ${party.gstin ? '| GSTIN: ' + party.gstin : ''}`,
        badge: party.type === 'customer' ? 'Customer' : 'Supplier',
        linkUrl: '/parties'
      });
    }
  }

  // 7. Products / Items
  const items = await idbGetAll('items');
  for (const item of items) {
    const it = item as any;
    const matchName = item.name.toLowerCase().includes(q);
    const matchHsn = item.hsnCode?.includes(q);
    const matchSku = it.sku?.toLowerCase().includes(q);
    const matchBarcode = it.barcode?.toLowerCase().includes(q);

    if (matchName || matchHsn || matchSku || matchBarcode) {
      results.push({
        id: item.id,
        type: 'product',
        title: item.name,
        subtitle: `Stock: ${item.stockQty} ${item.unit} | Rate: ₹${item.unitPrice} ${it.sku ? '| SKU: ' + it.sku : ''}`,
        badge: 'Product',
        amount: item.unitPrice,
        linkUrl: '/inventory'
      });
    }
  }

  // 8. Payment Vouchers
  const vouchers = await idbGetAll('payment_vouchers');
  for (const v of vouchers) {
    if (v.voucherNumber.toLowerCase().includes(q) || v.partyName?.toLowerCase().includes(q)) {
      results.push({
        id: v.id,
        type: 'payment_voucher',
        title: `Voucher: ${v.voucherNumber}`,
        subtitle: `Party: ${v.partyName || 'N/A'} | Amount: ₹${v.amount.toFixed(2)} | Mode: ${v.paymentMode}`,
        badge: v.voucherType === 'payment' ? 'Payment Out' : 'Payment In',
        date: v.date,
        amount: v.amount,
        linkUrl: '/banking'
      });
    }
  }

  return results.slice(0, 20); // Cap at top 20 results for responsive Omnibar
}
