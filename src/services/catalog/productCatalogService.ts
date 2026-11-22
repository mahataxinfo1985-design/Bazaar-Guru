import { 
  ProductCatalogItem, HSNSACCatalogEntry, BulkImportProductRow, 
  BulkImportResult, GSTTaxRate, TaxClassification, UOMType 
} from '../../types/workspace';
import { Item } from '../../types';
import { idbGetAll, idbPut } from '../storage/idb';

/**
 * Standard Indian HSN / SAC Catalog with official GST slabs
 */
export const HSN_SAC_REGISTRY: HSNSACCatalogEntry[] = [
  // Goods (HSN)
  { code: '1006', type: 'hsn', description: 'Rice and Cereals (unbranded/loose)', defaultGstRate: 0 },
  { code: '0401', type: 'hsn', description: 'Fresh milk and pasteurised milk', defaultGstRate: 0 },
  { code: '7102', type: 'hsn', description: 'Diamonds, unworked or worked', defaultGstRate: 0.25 },
  { code: '7108', type: 'hsn', description: 'Gold and gold jewellery', defaultGstRate: 3 },
  { code: '0902', type: 'hsn', description: 'Tea, whether or not flavoured', defaultGstRate: 5 },
  { code: '0901', type: 'hsn', description: 'Coffee, whether or not roasted', defaultGstRate: 5 },
  { code: '1905', type: 'hsn', description: 'Biscuits, bread, pastry, cakes', defaultGstRate: 18 },
  { code: '8471', type: 'hsn', description: 'Automatic data processing machines (Computers/Laptops)', defaultGstRate: 18 },
  { code: '8517', type: 'hsn', description: 'Smartphones, mobile phones and telephone sets', defaultGstRate: 18 },
  { code: '8703', type: 'hsn', description: 'Motor cars and passenger motor vehicles', defaultGstRate: 28, cessRate: 15 },
  { code: '2402', type: 'hsn', description: 'Cigars, cheroots, cigarillos and cigarettes', defaultGstRate: 28, cessRate: 290 },
  { code: '2202', type: 'hsn', description: 'Aerated waters containing added sugar', defaultGstRate: 28, cessRate: 12 },
  { code: '9403', type: 'hsn', description: 'Other furniture and parts thereof', defaultGstRate: 18 },
  { code: '6109', type: 'hsn', description: 'T-shirts, singlets and other vests, knitted', defaultGstRate: 5 },
  { code: '3004', type: 'hsn', description: 'Medicaments for therapeutic or prophylactic uses', defaultGstRate: 12 },

  // Services (SAC)
  { code: '9983', type: 'sac', description: 'Other professional, technical and business services (IT/Consulting)', defaultGstRate: 18 },
  { code: '9982', type: 'sac', description: 'Legal and accounting services', defaultGstRate: 18 },
  { code: '9954', type: 'sac', description: 'Construction services and civil engineering works', defaultGstRate: 18 },
  { code: '9963', type: 'sac', description: 'Accommodation, food and beverage services (Restaurant/Hotel)', defaultGstRate: 5 },
  { code: '9965', type: 'sac', description: 'Goods transport services (GTA)', defaultGstRate: 5 },
  { code: '9972', type: 'sac', description: 'Real estate services', defaultGstRate: 18 },
  { code: '9992', type: 'sac', description: 'Education services (exempt)', defaultGstRate: 0 },
  { code: '9993', type: 'sac', description: 'Human health and social care services (exempt)', defaultGstRate: 0 }
];

export function getHsnSacEntry(code: string): HSNSACCatalogEntry | undefined {
  if (!code) return undefined;
  const cleanCode = code.trim();
  return HSN_SAC_REGISTRY.find(entry => entry.code === cleanCode);
}

export function searchHsnSacRegistry(query: string): HSNSACCatalogEntry[] {
  if (!query) return HSN_SAC_REGISTRY.slice(0, 10);
  const q = query.toLowerCase().trim();
  return HSN_SAC_REGISTRY.filter(
    entry => entry.code.includes(q) || entry.description.toLowerCase().includes(q)
  );
}

/**
 * Validates a Product Catalog item ensuring pricing rules and mandatory attributes.
 */
export function validateProduct(product: Partial<ProductCatalogItem>): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!product.sku || product.sku.trim() === '') {
    errors.push('SKU is required.');
  }

  if (!product.name || product.name.trim() === '') {
    errors.push('Product name is required.');
  }

  if (product.purchasePrice !== undefined && product.purchasePrice < 0) {
    errors.push('Purchase price cannot be negative.');
  }

  if (product.unitPrice !== undefined && product.unitPrice < 0) {
    errors.push('Selling price cannot be negative.');
  }

  if (
    product.minSellingPrice !== undefined &&
    product.unitPrice !== undefined &&
    product.unitPrice < product.minSellingPrice
  ) {
    errors.push(`Selling price (₹${product.unitPrice}) cannot be lower than Minimum Selling Price (₹${product.minSellingPrice}).`);
  }

  if (
    product.mrp !== undefined &&
    product.unitPrice !== undefined &&
    product.mrp > 0 &&
    product.unitPrice > product.mrp
  ) {
    errors.push(`Selling price (₹${product.unitPrice}) cannot exceed Maximum Retail Price (₹${product.mrp}).`);
  }

  if (product.productType === 'composite') {
    if (!product.components || product.components.length === 0) {
      errors.push('Composite item must contain at least one component.');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Calculates estimated cost for composite product based on component costs.
 */
export function calculateCompositeCost(components: ProductCatalogItem['components']): number {
  if (!components || components.length === 0) return 0;
  return components.reduce((sum, comp) => sum + (comp.costEstimate || 0) * comp.quantity, 0);
}

/**
 * Parses and validates CSV string for Bulk Product Import with duplicate detection.
 */
export async function bulkImportProductsFromCSV(
  csvContent: string,
  existingItems: (Item | ProductCatalogItem)[] = []
): Promise<BulkImportResult> {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length <= 1) {
    return {
      totalRows: 0,
      importedCount: 0,
      skippedCount: 0,
      errors: [{ row: 0, error: 'Empty or invalid CSV file. Header row required.' }],
      importedItems: []
    };
  }

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[\s_]+/g, ''));
  const skuIdx = headers.findIndex(h => h === 'sku');
  const nameIdx = headers.findIndex(h => h === 'name' || h === 'productname');
  const typeIdx = headers.findIndex(h => h === 'type' || h === 'producttype');
  const categoryIdx = headers.findIndex(h => h === 'category');
  const uomIdx = headers.findIndex(h => h === 'uom' || h === 'unit');
  const hsnIdx = headers.findIndex(h => h === 'hsn' || h === 'hsncode' || h === 'sac');
  const gstIdx = headers.findIndex(h => h === 'gstrate' || h === 'taxrate' || h === 'gst');
  const purchasePriceIdx = headers.findIndex(h => h === 'purchaseprice' || h === 'costprice');
  const sellingPriceIdx = headers.findIndex(h => h === 'sellingprice' || h === 'price' || h === 'rate');
  const mrpIdx = headers.findIndex(h => h === 'mrp');
  const stockIdx = headers.findIndex(h => h === 'stock' || h === 'openingstock' || h === 'qty');
  const barcodeIdx = headers.findIndex(h => h === 'barcode');

  if (skuIdx === -1 || nameIdx === -1) {
    return {
      totalRows: lines.length - 1,
      importedCount: 0,
      skippedCount: lines.length - 1,
      errors: [{ row: 1, error: 'CSV missing required headers: "sku" and "name".' }],
      importedItems: []
    };
  }

  const existingSkus = new Set(
    existingItems.map(item => ((item as any).sku || '').toLowerCase().trim()).filter(Boolean)
  );
  const existingBarcodes = new Set(
    existingItems.map(item => ((item as any).barcode || '').toLowerCase().trim()).filter(Boolean)
  );

  const importedItems: ProductCatalogItem[] = [];
  const errors: { row: number; sku?: string; error: string }[] = [];
  let skippedCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const rawCols = lines[i].split(',').map(c => c.trim().replace(/^"(.*)"$/, '$1'));
    if (rawCols.every(c => c === '')) continue;

    const rowNum = i + 1;
    const sku = (rawCols[skuIdx] || '').trim();
    const name = (rawCols[nameIdx] || '').trim();

    if (!sku) {
      errors.push({ row: rowNum, error: 'SKU cannot be empty.' });
      skippedCount++;
      continue;
    }

    if (!name) {
      errors.push({ row: rowNum, sku, error: 'Name cannot be empty.' });
      skippedCount++;
      continue;
    }

    if (existingSkus.has(sku.toLowerCase())) {
      errors.push({ row: rowNum, sku, error: `Duplicate SKU "${sku}" already exists in the system.` });
      skippedCount++;
      continue;
    }

    const barcode = barcodeIdx >= 0 ? (rawCols[barcodeIdx] || '').trim() : undefined;
    if (barcode && existingBarcodes.has(barcode.toLowerCase())) {
      errors.push({ row: rowNum, sku, error: `Barcode "${barcode}" is already assigned to another item.` });
      skippedCount++;
      continue;
    }

    const pPrice = purchasePriceIdx >= 0 ? parseFloat(rawCols[purchasePriceIdx]) || 0 : 0;
    const sPrice = sellingPriceIdx >= 0 ? parseFloat(rawCols[sellingPriceIdx]) || 0 : 0;
    const mrp = mrpIdx >= 0 ? parseFloat(rawCols[mrpIdx]) || undefined : undefined;
    const gst = gstIdx >= 0 ? (parseFloat(rawCols[gstIdx]) as GSTTaxRate) || 18 : 18;
    const stock = stockIdx >= 0 ? parseFloat(rawCols[stockIdx]) || 0 : 0;
    const uom = (uomIdx >= 0 && rawCols[uomIdx] ? rawCols[uomIdx].toUpperCase() : 'PCS') as UOMType;
    const hsn = hsnIdx >= 0 && rawCols[hsnIdx] ? rawCols[hsnIdx] : '8471';
    const cat = categoryIdx >= 0 && rawCols[categoryIdx] ? rawCols[categoryIdx] : 'General';
    const prodType = typeIdx >= 0 && rawCols[typeIdx] ? rawCols[typeIdx].toLowerCase() : 'goods';

    const item: ProductCatalogItem = {
      id: `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      sku,
      barcode: barcode || undefined,
      name,
      productType: (prodType as any) || 'goods',
      category: cat,
      uom,
      unit: uom,
      purchasePrice: pPrice,
      unitPrice: sPrice,
      mrp,
      taxClassification: 'taxable',
      hsnCode: hsn,
      gstRate: gst,
      stockQty: stock,
      openingStock: stock,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const validation = validateProduct(item);
    if (!validation.isValid) {
      errors.push({ row: rowNum, sku, error: validation.errors.join('; ') });
      skippedCount++;
      continue;
    }

    existingSkus.add(sku.toLowerCase());
    if (barcode) existingBarcodes.add(barcode.toLowerCase());
    importedItems.push(item);
  }

  return {
    totalRows: lines.length - 1,
    importedCount: importedItems.length,
    skippedCount,
    errors,
    importedItems
  };
}

/**
 * Exports products to standard CSV format.
 */
export function exportProductsToCSV(items: (Item | ProductCatalogItem)[]): string {
  const headers = [
    'SKU', 'Name', 'Type', 'Category', 'UOM', 'HSN_Code', 
    'GST_Rate', 'Purchase_Price', 'Selling_Price', 'MRP', 'Stock_Qty', 'Barcode'
  ];

  const rows = items.map(item => {
    const it = item as any;
    return [
      `"${it.sku || ''}"`,
      `"${it.name || ''}"`,
      `"${it.productType || 'goods'}"`,
      `"${it.category || ''}"`,
      `"${it.uom || it.unit || 'PCS'}"`,
      `"${it.hsnCode || ''}"`,
      it.gstRate ?? 18,
      it.purchasePrice ?? 0,
      it.unitPrice ?? 0,
      it.mrp ?? '',
      it.stockQty ?? 0,
      `"${it.barcode || ''}"`
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}
