import React, { useState, useMemo } from 'react';
import { 
  Package, Plus, Search, Filter, AlertTriangle, ArrowRightLeft, 
  SlidersHorizontal, Calendar, Layers, Barcode, DollarSign, 
  CheckCircle, ShieldAlert, ArrowUpRight, ArrowDownRight, Warehouse as WarehouseIcon
} from 'lucide-react';
import { Product, Warehouse, StockMovement, StockTransfer, StockAdjustment, ProductBatch } from '../../types/inventory';
import { buildStockSummary, buildStockLedger, detectLowStockAlerts } from '../../services/inventory/stockMovementService';
import { getNearExpiryBatches, getExpiredBatches } from '../../services/inventory/batchService';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface InventoryViewProps {
  products: Product[];
  warehouses: Warehouse[];
  movements: StockMovement[];
  transfers: StockTransfer[];
  adjustments: StockAdjustment[];
  batches: ProductBatch[];
  onAddProduct: () => void;
  onEditProduct: (p: Product) => void;
  onOpenTransferModal: () => void;
  onOpenAdjustmentModal: () => void;
}

export default function InventoryView({
  products,
  warehouses,
  movements,
  transfers,
  adjustments,
  batches,
  onAddProduct,
  onEditProduct,
  onOpenTransferModal,
  onOpenAdjustmentModal
}: InventoryViewProps) {
  const [activeTab, setActiveTab] = useState<'products' | 'summary' | 'ledger' | 'transfers' | 'adjustments' | 'batches' | 'alerts'>('products');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedProductType, setSelectedProductType] = useState<string>('');

  // Stock Summary & Ledger derived strictly from movements
  const stockSummary = useMemo(() => {
    return buildStockSummary(products, movements, selectedWarehouseId || undefined);
  }, [products, movements, selectedWarehouseId]);

  const stockLedger = useMemo(() => {
    return buildStockLedger(movements, undefined, selectedWarehouseId || undefined);
  }, [movements, selectedWarehouseId]);

  const lowStockAlerts = useMemo(() => {
    return detectLowStockAlerts(products, movements);
  }, [products, movements]);

  const nearExpiryBatches = useMemo(() => {
    return getNearExpiryBatches(batches, 60);
  }, [batches]);

  const expiredBatches = useMemo(() => {
    return getExpiredBatches(batches);
  }, [batches]);

  // Aggregate KPIs
  const totalValuation = stockSummary.reduce((sum, s) => sum + s.valuation, 0);
  const totalProducts = products.length;
  const lowStockCount = lowStockAlerts.length;

  // Filtered Products
  const filteredProducts = products.filter(p => {
    const matchesSearch = 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.barcode && p.barcode.includes(searchTerm)) ||
      (p.hsnCode && p.hsnCode.includes(searchTerm));
    const matchesCategory = !selectedCategory || p.category === selectedCategory;
    const matchesType = !selectedProductType || p.itemType === selectedProductType;
    return matchesSearch && matchesCategory && matchesType;
  });

  const categories = Array.from(new Set(products.map(p => p.category || 'General')));

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Inventory & Stock Management Hub</h2>
          <p className="text-sm text-slate-500">
            Real-time stock valuation, multi-godown transfers, batch/expiry alerts, and movement ledgers.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onOpenTransferModal}
            className="flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 text-purple-700 px-3.5 py-2 text-xs font-bold hover:bg-purple-100 transition shadow-xs cursor-pointer"
          >
            <ArrowRightLeft size={15} /> Transfer Stock
          </button>
          <button
            onClick={onOpenAdjustmentModal}
            className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 px-3.5 py-2 text-xs font-bold hover:bg-amber-100 transition shadow-xs cursor-pointer"
          >
            <SlidersHorizontal size={15} /> Stock Adjustment
          </button>
          <button
            onClick={onAddProduct}
            className="flex items-center gap-1.5 rounded-xl bg-blue-700 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-800 transition cursor-pointer"
          >
            <Plus size={16} /> Add Product
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs uppercase font-bold tracking-wider">Total Stock Valuation</span>
            <DollarSign size={18} className="text-emerald-600" />
          </div>
          <h3 className="text-2xl font-bold font-mono text-slate-900">{formatCurrency(totalValuation)}</h3>
          <p className="text-[11px] text-slate-400 mt-1">Based on Weighted Average Cost</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs uppercase font-bold tracking-wider">Catalogue Items</span>
            <Package size={18} className="text-blue-600" />
          </div>
          <h3 className="text-2xl font-bold font-mono text-slate-900">{totalProducts}</h3>
          <p className="text-[11px] text-slate-400 mt-1">Goods, Raw Materials & Services</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs uppercase font-bold tracking-wider">Low Stock Alerts</span>
            <AlertTriangle size={18} className="text-amber-500" />
          </div>
          <h3 className="text-2xl font-bold font-mono text-amber-600">{lowStockCount}</h3>
          <p className="text-[11px] text-slate-400 mt-1">Items at or below reorder level</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs uppercase font-bold tracking-wider">Active Godowns</span>
            <WarehouseIcon size={18} className="text-purple-600" />
          </div>
          <h3 className="text-2xl font-bold font-mono text-slate-900">{warehouses.length}</h3>
          <p className="text-[11px] text-slate-400 mt-1">Multi-location storage locations</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto bg-white rounded-t-xl px-2">
        {[
          { id: 'products', label: 'Product Master' },
          { id: 'summary', label: 'Stock Summary' },
          { id: 'ledger', label: 'Stock Movement Ledger' },
          { id: 'transfers', label: 'Godown Transfers' },
          { id: 'adjustments', label: 'Stock Adjustments' },
          { id: 'batches', label: `Batches & Expiry (${nearExpiryBatches.length + expiredBatches.length})` },
          { id: 'alerts', label: `Low Stock Alerts (${lowStockCount})` },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 whitespace-nowrap transition cursor-pointer ${
              activeTab === tab.id
                ? 'border-blue-700 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: PRODUCT MASTER */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
            <div className="relative w-full sm:w-80">
              <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by Name, SKU, Barcode, HSN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-600 outline-none"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white text-slate-700 focus:ring-2 focus:ring-blue-600 outline-none"
              >
                <option value="">All Categories</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              <select
                value={selectedProductType}
                onChange={(e) => setSelectedProductType(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white text-slate-700 focus:ring-2 focus:ring-blue-600 outline-none"
              >
                <option value="">All Item Types</option>
                <option value="goods">Goods</option>
                <option value="service">Services</option>
                <option value="raw_material">Raw Materials</option>
                <option value="finished_goods">Finished Goods</option>
              </select>
            </div>
          </div>

          {/* Products Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map(p => (
              <div
                key={p.id}
                onClick={() => onEditProduct(p)}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between hover:border-blue-400 hover:shadow-md transition cursor-pointer"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm truncate">{p.name}</h4>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                        {p.sku && <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">SKU: {p.sku}</span>}
                        {p.barcode && <span className="font-mono flex items-center gap-1"><Barcode size={12} /> {p.barcode}</span>}
                      </div>
                    </div>
                    <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                      GST {p.gstRate}%
                    </span>
                  </div>

                  <div className="mt-3 space-y-1.5 text-xs text-slate-500 font-medium">
                    <div className="flex justify-between">
                      <span>HSN / SAC:</span>
                      <span className="text-slate-700 font-mono font-bold">{p.hsnCode}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Selling Price:</span>
                      <span className="text-slate-900 font-bold font-mono">{formatCurrency(p.unitPrice)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Purchase Cost:</span>
                      <span className="text-slate-600 font-mono">{formatCurrency(p.purchasePrice || p.averageCost || 0)}</span>
                    </div>
                    {p.mrp && p.mrp > 0 && (
                      <div className="flex justify-between">
                        <span>MRP:</span>
                        <span className="text-slate-500 font-mono">{formatCurrency(p.mrp)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">Stock in Hand:</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full font-bold text-xs font-mono ${
                      p.itemType === 'service'
                        ? 'bg-purple-50 text-purple-700 border border-purple-100'
                        : p.stockQty <= (p.reorderLevel || 10)
                        ? 'bg-red-50 text-red-600 border border-red-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    {p.itemType === 'service' ? 'Service' : `${p.stockQty} ${p.unit}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: STOCK SUMMARY */}
      {activeTab === 'summary' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">Product-wise Stock Summary & Closing Valuation</h3>
            <span className="text-xs text-slate-500 font-medium">Reconciled from stock movements</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">Product Name</th>
                  <th className="p-3">SKU</th>
                  <th className="p-3">Category</th>
                  <th className="p-3 text-right">Opening</th>
                  <th className="p-3 text-right">Stock In</th>
                  <th className="p-3 text-right">Stock Out</th>
                  <th className="p-3 text-right">Closing Stock</th>
                  <th className="p-3 text-right">Avg Cost</th>
                  <th className="p-3 text-right">Valuation</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stockSummary.map(row => (
                  <tr key={row.productId} className="hover:bg-slate-50/80 transition">
                    <td className="p-3 font-bold text-slate-900">{row.productName}</td>
                    <td className="p-3 font-mono text-slate-500">{row.sku}</td>
                    <td className="p-3 text-slate-600">{row.category}</td>
                    <td className="p-3 text-right font-mono text-slate-600">{row.openingStock} {row.unit}</td>
                    <td className="p-3 text-right font-mono text-emerald-600">+{row.stockIn}</td>
                    <td className="p-3 text-right font-mono text-red-600">-{row.stockOut}</td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900">{row.closingStock} {row.unit}</td>
                    <td className="p-3 text-right font-mono text-slate-600">{formatCurrency(row.averageCost)}</td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900">{formatCurrency(row.valuation)}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        row.status === 'Out of Stock' ? 'bg-red-100 text-red-700' :
                        row.status === 'Low Stock' ? 'bg-amber-100 text-amber-700' :
                        'bg-emerald-100 text-emerald-700'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: STOCK MOVEMENT LEDGER */}
      {activeTab === 'ledger' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">Chronological Stock Movement Audit Ledger</h3>
            <span className="text-xs text-slate-500 font-mono font-semibold">{stockLedger.length} Movements Logged</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Movement Type</th>
                  <th className="p-3">Ref Type</th>
                  <th className="p-3">Ref Number</th>
                  <th className="p-3">Godown</th>
                  <th className="p-3 text-right">In</th>
                  <th className="p-3 text-right">Out</th>
                  <th className="p-3 text-right">Balance</th>
                  <th className="p-3 text-right">Unit Cost</th>
                  <th className="p-3 text-right">Total Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {stockLedger.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3 text-slate-600">{formatDate(m.date)}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-sans uppercase ${
                        m.quantityIn > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                      }`}>
                        {m.movementType.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-3 text-slate-600 uppercase font-sans text-[11px]">{m.referenceType}</td>
                    <td className="p-3 font-bold text-blue-700">{m.referenceNumber}</td>
                    <td className="p-3 font-sans text-slate-700">{m.warehouseName}</td>
                    <td className="p-3 text-right text-emerald-600">{m.quantityIn > 0 ? `+${m.quantityIn}` : '-'}</td>
                    <td className="p-3 text-right text-red-600">{m.quantityOut > 0 ? `-${m.quantityOut}` : '-'}</td>
                    <td className="p-3 text-right font-bold text-slate-900">{m.runningBalance}</td>
                    <td className="p-3 text-right text-slate-600">{formatCurrency(m.unitCost)}</td>
                    <td className="p-3 text-right font-bold text-slate-900">{formatCurrency(m.totalValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: GODOWN TRANSFERS */}
      {activeTab === 'transfers' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">Inter-Godown Stock Transfers</h3>
            <button
              onClick={onOpenTransferModal}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-700 text-white rounded-xl text-xs font-bold hover:bg-purple-800 transition cursor-pointer"
            >
              <Plus size={14} /> New Transfer
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">Transfer No</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Source Godown</th>
                  <th className="p-3">Destination Godown</th>
                  <th className="p-3">Items Transferred</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-400">
                      No inter-godown transfers recorded yet.
                    </td>
                  </tr>
                ) : (
                  transfers.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3 font-mono font-bold text-purple-700">{t.transferNumber}</td>
                      <td className="p-3 font-mono text-slate-600">{formatDate(t.date)}</td>
                      <td className="p-3 font-medium text-slate-800">{t.sourceWarehouseName || t.sourceWarehouseId}</td>
                      <td className="p-3 font-medium text-slate-800">{t.destinationWarehouseName || t.destinationWarehouseId}</td>
                      <td className="p-3">
                        <div className="space-y-0.5">
                          {t.lines.map((l, i) => (
                            <span key={i} className="block text-[11px] text-slate-700">
                              {l.productName} • <strong>{l.quantity}</strong> (Value: {formatCurrency(l.totalValue)})
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 uppercase">
                          {t.status}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500 italic">{t.notes || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: STOCK ADJUSTMENTS */}
      {activeTab === 'adjustments' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">Stock Adjustment & Physical Count Vouchers</h3>
            <button
              onClick={onOpenAdjustmentModal}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 transition cursor-pointer"
            >
              <Plus size={14} /> New Adjustment
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">Voucher No</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Warehouse</th>
                  <th className="p-3">Adjusted Items & Reasons</th>
                  <th className="p-3 text-right">Valuation Impact</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3">Narration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {adjustments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-400">
                      No stock adjustment vouchers recorded yet.
                    </td>
                  </tr>
                ) : (
                  adjustments.map(a => (
                    <tr key={a.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3 font-mono font-bold text-amber-700">{a.adjustmentNumber}</td>
                      <td className="p-3 font-mono text-slate-600">{formatDate(a.date)}</td>
                      <td className="p-3 font-medium text-slate-800">{a.warehouseName || a.warehouseId}</td>
                      <td className="p-3">
                        <div className="space-y-0.5">
                          {a.lines.map((l, i) => (
                            <span key={i} className="block text-[11px] text-slate-700">
                              {l.productName}: Diff <strong className={l.differenceQuantity < 0 ? 'text-red-600' : 'text-emerald-600'}>
                                {l.differenceQuantity > 0 ? `+${l.differenceQuantity}` : l.differenceQuantity}
                              </strong> ({l.reason})
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className={`p-3 text-right font-mono font-bold ${
                        a.totalAdjustmentValue < 0 ? 'text-red-600' : a.totalAdjustmentValue > 0 ? 'text-emerald-600' : 'text-slate-700'
                      }`}>
                        {formatCurrency(a.totalAdjustmentValue)}
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 uppercase">
                          {a.status}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500 italic">{a.narration || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: BATCHES & EXPIRY */}
      {activeTab === 'batches' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
              <h4 className="font-bold text-red-900 text-xs uppercase flex items-center gap-1.5 mb-2">
                <AlertTriangle size={15} /> Expired Stock ({expiredBatches.length})
              </h4>
              <div className="space-y-1.5 text-xs">
                {expiredBatches.length === 0 ? (
                  <p className="text-red-600 italic">No expired stock recorded.</p>
                ) : (
                  expiredBatches.map(b => (
                    <div key={b.id} className="flex justify-between bg-white p-2 rounded-lg border border-red-100 font-mono">
                      <span>Batch: {b.batchNumber}</span>
                      <span className="font-bold text-red-700">Expired: {b.expiryDate} (Qty: {b.remainingQuantity})</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <h4 className="font-bold text-amber-900 text-xs uppercase flex items-center gap-1.5 mb-2">
                <AlertTriangle size={15} /> Near Expiry in 60 Days ({nearExpiryBatches.length})
              </h4>
              <div className="space-y-1.5 text-xs">
                {nearExpiryBatches.length === 0 ? (
                  <p className="text-amber-600 italic">No batches expiring within 60 days.</p>
                ) : (
                  nearExpiryBatches.map(b => (
                    <div key={b.id} className="flex justify-between bg-white p-2 rounded-lg border border-amber-100 font-mono">
                      <span>Batch: {b.batchNumber}</span>
                      <span className="font-bold text-amber-700">Expires: {b.expiryDate} (Qty: {b.remainingQuantity})</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">All Product Batches</h3>
              <span className="text-xs text-slate-500 font-mono font-semibold">{batches.length} Batches Tracked</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Batch Number</th>
                    <th className="p-3">Product</th>
                    <th className="p-3">Mfg Date</th>
                    <th className="p-3">Expiry Date</th>
                    <th className="p-3 text-right">Received Qty</th>
                    <th className="p-3 text-right">Remaining Qty</th>
                    <th className="p-3 text-right">Batch Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {batches.map(b => (
                    <tr key={b.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3 font-bold text-slate-900">{b.batchNumber}</td>
                      <td className="p-3 font-sans text-slate-700">{b.productName || b.productId}</td>
                      <td className="p-3 text-slate-500">{b.manufacturingDate ? formatDate(b.manufacturingDate) : '—'}</td>
                      <td className="p-3 font-bold text-amber-700">{formatDate(b.expiryDate)}</td>
                      <td className="p-3 text-right text-slate-600">{b.quantityReceived}</td>
                      <td className="p-3 text-right font-bold text-slate-900">{b.remainingQuantity}</td>
                      <td className="p-3 text-right text-slate-600">{formatCurrency(b.unitCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: LOW STOCK ALERTS */}
      {activeTab === 'alerts' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">Items Below Minimum / Reorder Level</h3>
            <span className="text-xs text-red-600 font-bold">{lowStockAlerts.length} Action Items Required</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">Product Name</th>
                  <th className="p-3">SKU</th>
                  <th className="p-3 text-right">Current Stock</th>
                  <th className="p-3 text-right">Reorder Level</th>
                  <th className="p-3 text-right">Min Buffer</th>
                  <th className="p-3 text-right">Deficit to Order</th>
                  <th className="p-3 text-center">Urgency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lowStockAlerts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-emerald-600 font-bold">
                      All products have healthy inventory levels above reorder thresholds!
                    </td>
                  </tr>
                ) : (
                  lowStockAlerts.map(a => (
                    <tr key={a.productId} className="hover:bg-slate-50/80 transition">
                      <td className="p-3 font-bold text-slate-900">{a.productName}</td>
                      <td className="p-3 font-mono text-slate-500">{a.sku}</td>
                      <td className="p-3 text-right font-mono font-bold text-red-600">{a.currentStock} {a.unit}</td>
                      <td className="p-3 text-right font-mono text-slate-600">{a.reorderLevel} {a.unit}</td>
                      <td className="p-3 text-right font-mono text-slate-600">{a.minStockLevel} {a.unit}</td>
                      <td className="p-3 text-right font-mono font-bold text-amber-700">+{a.deficit} {a.unit}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          a.currentStock <= 0 ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {a.currentStock <= 0 ? 'CRITICAL: OUT OF STOCK' : 'LOW STOCK REORDER'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
