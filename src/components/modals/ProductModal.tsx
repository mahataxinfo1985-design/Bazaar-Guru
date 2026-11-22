import React, { useState, useEffect } from 'react';
import { 
  X, Package, Barcode, ShieldCheck, DollarSign, Layers, 
  Calendar, AlertCircle, Check, Tag 
} from 'lucide-react';
import { Product, ItemType, Warehouse } from '../../types/inventory';
import { getAutomatedHsn } from '../ItemModal';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: Partial<Product>) => Promise<void> | void;
  editingProduct?: Product | null;
  warehouses: Warehouse[];
  existingSkus?: string[];
  existingBarcodes?: string[];
}

export default function ProductModal({
  isOpen,
  onClose,
  onSave,
  editingProduct,
  warehouses,
  existingSkus = [],
  existingBarcodes = []
}: ProductModalProps) {
  const [activeTab, setActiveTab] = useState<'basic' | 'pricing' | 'tax' | 'inventory'>('basic');

  // Basic Details
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [brand, setBrand] = useState('');
  const [itemType, setItemType] = useState<ItemType>('goods');
  const [unit, setUnit] = useState('PCS');

  // Pricing
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [purchasePrice, setPurchasePrice] = useState<number>(0);
  const [mrp, setMrp] = useState<number>(0);
  const [wholesalePrice, setWholesalePrice] = useState<number>(0);
  const [minSellingPrice, setMinSellingPrice] = useState<number>(0);
  const [taxInclusive, setTaxInclusive] = useState(false);

  // Tax
  const [hsnCode, setHsnCode] = useState('');
  const [gstRate, setGstRate] = useState<number>(18);
  const [cess, setCess] = useState<number>(0);

  // Inventory
  const [openingStock, setOpeningStock] = useState<number>(0);
  const [openingStockDate, setOpeningStockDate] = useState(new Date().toISOString().split('T')[0]);
  const [minStockLevel, setMinStockLevel] = useState<number>(5);
  const [reorderLevel, setReorderLevel] = useState<number>(10);
  const [trackStock, setTrackStock] = useState(true);
  const [trackBatch, setTrackBatch] = useState(false);
  const [trackExpiry, setTrackExpiry] = useState(false);
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id || 'wh_default');

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingProduct) {
      setName(editingProduct.name || '');
      setSku(editingProduct.sku || '');
      setBarcode(editingProduct.barcode || '');
      setDescription(editingProduct.description || '');
      setCategory(editingProduct.category || 'General');
      setBrand(editingProduct.brand || '');
      setItemType(editingProduct.itemType || 'goods');
      setUnit(editingProduct.unit || 'PCS');
      setUnitPrice(editingProduct.unitPrice || 0);
      setPurchasePrice(editingProduct.purchasePrice || 0);
      setMrp(editingProduct.mrp || 0);
      setWholesalePrice(editingProduct.wholesalePrice || 0);
      setMinSellingPrice(editingProduct.minSellingPrice || 0);
      setTaxInclusive(editingProduct.taxInclusive || false);
      setHsnCode(editingProduct.hsnCode || '');
      setGstRate(editingProduct.gstRate ?? 18);
      setCess(editingProduct.cess || 0);
      setOpeningStock(editingProduct.openingStock || 0);
      setOpeningStockDate(editingProduct.openingStockDate || new Date().toISOString().split('T')[0]);
      setMinStockLevel(editingProduct.minStockLevel || 5);
      setReorderLevel(editingProduct.reorderLevel || 10);
      setTrackStock(editingProduct.trackStock ?? true);
      setTrackBatch(editingProduct.trackBatch || false);
      setTrackExpiry(editingProduct.trackExpiry || false);
      setWarehouseId(editingProduct.warehouseId || warehouses[0]?.id || 'wh_default');
    } else {
      setName('');
      setSku('');
      setBarcode('');
      setDescription('');
      setCategory('General');
      setBrand('');
      setItemType('goods');
      setUnit('PCS');
      setUnitPrice(0);
      setPurchasePrice(0);
      setMrp(0);
      setWholesalePrice(0);
      setMinSellingPrice(0);
      setTaxInclusive(false);
      setHsnCode('');
      setGstRate(18);
      setCess(0);
      setOpeningStock(0);
      setOpeningStockDate(new Date().toISOString().split('T')[0]);
      setMinStockLevel(5);
      setReorderLevel(10);
      setTrackStock(true);
      setTrackBatch(false);
      setTrackExpiry(false);
      setWarehouseId(warehouses[0]?.id || 'wh_default');
    }
    setError('');
  }, [editingProduct, isOpen, warehouses]);

  // Auto-detect HSN on product name blur
  const handleNameBlur = () => {
    if (!hsnCode.trim() && name.trim()) {
      const detected = getAutomatedHsn(name.trim());
      if (detected) setHsnCode(detected);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Product or Service Name is required');
    if (!hsnCode.trim()) return setError('HSN/SAC Code is required');

    // Duplicate SKU validation
    if (sku.trim() && (!editingProduct || editingProduct.sku !== sku.trim())) {
      if (existingSkus.includes(sku.trim())) {
        return setError(`SKU "${sku.trim()}" is already assigned to another product.`);
      }
    }

    // Duplicate Barcode validation
    if (barcode.trim() && (!editingProduct || editingProduct.barcode !== barcode.trim())) {
      if (existingBarcodes.includes(barcode.trim())) {
        return setError(`Barcode "${barcode.trim()}" is already assigned to another product.`);
      }
    }

    try {
      setIsSubmitting(true);
      setError('');

      const productPayload: Partial<Product> = {
        id: editingProduct?.id || `item_${Date.now()}`,
        name: name.trim(),
        sku: sku.trim() || undefined,
        barcode: barcode.trim() || undefined,
        description: description.trim(),
        category: category.trim() || 'General',
        brand: brand.trim(),
        itemType,
        unit,
        unitPrice: Number(unitPrice),
        purchasePrice: Number(purchasePrice),
        mrp: mrp > 0 ? Number(mrp) : Number(unitPrice),
        wholesalePrice: wholesalePrice > 0 ? Number(wholesalePrice) : undefined,
        minSellingPrice: minSellingPrice > 0 ? Number(minSellingPrice) : undefined,
        taxInclusive,
        hsnCode: hsnCode.trim(),
        gstRate: Number(gstRate),
        cess: Number(cess),
        openingStock: Number(openingStock),
        openingStockDate,
        minStockLevel: Number(minStockLevel),
        reorderLevel: Number(reorderLevel),
        trackStock: itemType === 'service' || itemType === 'non_stock' ? false : trackStock,
        trackBatch: itemType === 'service' || itemType === 'non_stock' ? false : trackBatch,
        trackExpiry: itemType === 'service' || itemType === 'non_stock' ? false : trackExpiry,
        warehouseId,
        stockQty: editingProduct?.stockQty !== undefined ? editingProduct.stockQty : Number(openingStock),
        averageCost: Number(purchasePrice) || Number(unitPrice),
        isActive: true
      };

      await onSave(productPayload);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save product');
    } finally {
      setIsSubmitting(false);
    }
  };

  const gstRates = [0, 5, 12, 18, 28];
  const unitOptions = ['PCS', 'BOX', 'LTR', 'KGS', 'NOS', 'MTR', 'BAG', 'HRS', 'SET', 'PAIR'];
  const categoryOptions = ['General', 'Groceries', 'Electronics', 'Apparel', 'Hardware', 'Pharmaceuticals', 'Raw Materials', 'Finished Goods', 'Services'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
              <Package size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                {editingProduct ? 'Edit Product Master' : 'New Product / Service Master'}
              </h3>
              <p className="text-xs text-slate-500">Configure catalog details, pricing, tax rates and inventory tracking</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition">
            <X size={18} />
          </button>
        </div>

        {/* Tab Nav */}
        <div className="flex border-b border-slate-200 bg-white px-6">
          {(['basic', 'pricing', 'tax', 'inventory'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition ${
                activeTab === tab
                  ? 'border-blue-700 text-blue-700'
                  : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              {tab === 'basic' && '1. Basic Info'}
              {tab === 'pricing' && '2. Pricing'}
              {tab === 'tax' && '3. Tax & HSN'}
              {tab === 'inventory' && '4. Stock & Tracking'}
            </button>
          ))}
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700 font-medium">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {/* TAB 1: BASIC INFO */}
          {activeTab === 'basic' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Product / Service Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={handleNameBlur}
                  required
                  placeholder="e.g. Tata Salt 1kg, Consulting Hour, Cotton Shirt"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-600 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Product SKU / Code</label>
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value.toUpperCase())}
                    placeholder="e.g. SKU-SALT-01"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 font-mono focus:ring-2 focus:ring-blue-600 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Barcode size={14} /> Barcode / UPC / EAN
                  </label>
                  <input
                    type="text"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="e.g. 8901234567890"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 font-mono focus:ring-2 focus:ring-blue-600 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Item Classification</label>
                  <select
                    value={itemType}
                    onChange={(e) => setItemType(e.target.value as ItemType)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-600 outline-none"
                  >
                    <option value="goods">Physical Goods</option>
                    <option value="service">Service (No Stock Movement)</option>
                    <option value="raw_material">Raw Material</option>
                    <option value="finished_goods">Finished Goods</option>
                    <option value="consumable">Consumable</option>
                    <option value="non_stock">Non-Stock Item</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    list="category-suggestions"
                    placeholder="Category"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-600 outline-none"
                  />
                  <datalist id="category-suggestions">
                    {categoryOptions.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Unit of Measurement</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white font-mono focus:ring-2 focus:ring-blue-600 outline-none"
                  >
                    {unitOptions.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description / Notes</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Optional technical specifications or description..."
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-600 outline-none resize-none"
                />
              </div>
            </div>
          )}

          {/* TAB 2: PRICING */}
          {activeTab === 'pricing' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Selling Price (Unit Price) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-sm">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={unitPrice || ''}
                      onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                      required
                      placeholder="0.00"
                      className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border border-slate-300 font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Purchase Cost (Base Cost) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-sm">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={purchasePrice || ''}
                      onChange={(e) => setPurchasePrice(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border border-slate-300 font-mono text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Maximum Retail Price (MRP)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={mrp || ''}
                    onChange={(e) => setMrp(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 font-mono text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Wholesale Price</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={wholesalePrice || ''}
                    onChange={(e) => setWholesalePrice(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 font-mono text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Min Selling Price</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={minSellingPrice || ''}
                    onChange={(e) => setMinSellingPrice(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 font-mono text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-900">Tax Inclusive Pricing</span>
                  <p className="text-[11px] text-slate-500">Unit sales price entered already includes GST</p>
                </div>
                <input
                  type="checkbox"
                  checked={taxInclusive}
                  onChange={(e) => setTaxInclusive(e.target.checked)}
                  className="h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* TAB 3: TAX & HSN */}
          {activeTab === 'tax' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">HSN Code (Goods) / SAC (Services) *</label>
                  <input
                    type="text"
                    value={hsnCode}
                    onChange={(e) => setHsnCode(e.target.value.trim())}
                    required
                    placeholder="e.g. 2501, 8504, 9983"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">GST Tax Rate (%)</label>
                  <select
                    value={gstRate}
                    onChange={(e) => setGstRate(parseFloat(e.target.value))}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white font-mono font-bold text-blue-700 focus:ring-2 focus:ring-blue-600 outline-none"
                  >
                    {gstRates.map(r => (
                      <option key={r} value={r}>{r}% GST</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Compensation Cess (%) (Optional)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={cess || ''}
                  onChange={(e) => setCess(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 font-mono text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none"
                />
              </div>
            </div>
          )}

          {/* TAB 4: STOCK & TRACKING */}
          {activeTab === 'inventory' && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-900">Enable Physical Stock Tracking</span>
                    <p className="text-[11px] text-slate-500">Records purchases, sales stock-out, and calculates COGS</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={trackStock && itemType !== 'service' && itemType !== 'non_stock'}
                    disabled={itemType === 'service' || itemType === 'non_stock'}
                    onChange={(e) => setTrackStock(e.target.checked)}
                    className="h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                  />
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <div>
                    <span className="text-xs font-bold text-slate-900">Enable Batch Tracking</span>
                    <p className="text-[11px] text-slate-500">Track batch numbers on purchase and sale</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={trackBatch}
                    disabled={!trackStock}
                    onChange={(e) => setTrackBatch(e.target.checked)}
                    className="h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                  />
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <div>
                    <span className="text-xs font-bold text-slate-900">Enable Expiry Date Tracking</span>
                    <p className="text-[11px] text-slate-500">Receive alerts before product expires</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={trackExpiry}
                    disabled={!trackStock}
                    onChange={(e) => setTrackExpiry(e.target.checked)}
                    className="h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Opening Stock Quantity</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    disabled={!!editingProduct}
                    value={openingStock || ''}
                    onChange={(e) => setOpeningStock(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 font-mono text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none disabled:bg-slate-100 disabled:text-slate-500"
                  />
                  {editingProduct && (
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Use Stock Adjustment to modify post-opening quantities</span>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Primary Godown / Warehouse</label>
                  <select
                    value={warehouseId}
                    onChange={(e) => setWarehouseId(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none"
                  >
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Reorder Level Alert Quantity</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={reorderLevel || ''}
                    onChange={(e) => setReorderLevel(parseFloat(e.target.value) || 0)}
                    placeholder="10"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 font-mono text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Minimum Buffer Stock</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={minStockLevel || ''}
                    onChange={(e) => setMinStockLevel(parseFloat(e.target.value) || 0)}
                    placeholder="5"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 font-mono text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-6 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-md transition disabled:opacity-50 cursor-pointer"
            >
              <Check size={16} />
              {isSubmitting ? 'Saving...' : editingProduct ? 'Update Product' : 'Save Product Master'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
