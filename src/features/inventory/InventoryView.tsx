import React, { useState, useMemo } from 'react';
import { 
  Package, Plus, Search, Filter, AlertTriangle, ArrowRightLeft, 
  SlidersHorizontal, Calendar, Layers, Barcode, IndianRupee, 
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

  const critical7DayBatches = useMemo(() => {
    return getNearExpiryBatches(batches, 7);
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
    <div className="space-y-5 animate-in fade-in duration-200">
      
      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#12263A]">Inventory & Stock Management Hub</h2>
          <p className="text-xs text-[#3E5368] mt-0.5">
            Real-time stock valuation, multi-godown transfers, batch/expiry alerts, and movement ledgers.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onOpenTransferModal}
            className="flex items-center gap-1.5 rounded-lg border border-[#E8DFCF] bg-white text-[#12263A] px-3.5 py-2 text-xs font-semibold hover:bg-[#FFFBF3] transition shadow-2xs cursor-pointer"
          >
            <ArrowRightLeft size={14} className="text-[#1F86CC]" /> Transfer Stock
          </button>
          <button
            onClick={onOpenAdjustmentModal}
            className="flex items-center gap-1.5 rounded-lg border border-[#E8DFCF] bg-white text-[#12263A] px-3.5 py-2 text-xs font-semibold hover:bg-[#FFFBF3] transition shadow-2xs cursor-pointer"
          >
            <SlidersHorizontal size={14} className="text-[#E0771A]" /> Stock Adjustment
          </button>
          <button
            onClick={onAddProduct}
            className="flex items-center gap-1.5 rounded-lg bg-[#E0771A] hover:bg-[#B85D0F] px-4 py-2 text-xs font-semibold text-white shadow-2xs transition-all cursor-pointer"
          >
            <Plus size={15} /> Add Product
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-xl border border-[#E8DFCF] bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-[#3E5368] mb-1">
            <span className="text-[11px] font-semibold">Total Stock Valuation</span>
            <IndianRupee size={16} className="text-[#1E8E5A]" />
          </div>
          <h3 className="text-xl font-bold tabular-nums text-[#12263A]">{formatCurrency(totalValuation)}</h3>
          <p className="text-[11px] text-[#3E5368]/80 mt-1">Weighted average cost</p>
        </div>

        <div className="rounded-xl border border-[#E8DFCF] bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-[#3E5368] mb-1">
            <span className="text-[11px] font-semibold">Catalogue Items</span>
            <Package size={16} className="text-[#1F86CC]" />
          </div>
          <h3 className="text-xl font-bold tabular-nums text-[#12263A]">{totalProducts}</h3>
          <p className="text-[11px] text-[#3E5368]/80 mt-1">Goods, raw materials & services</p>
        </div>

        <div className="rounded-xl border border-[#E8DFCF] bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-[#3E5368] mb-1">
            <span className="text-[11px] font-semibold">Low Stock Alerts</span>
            <AlertTriangle size={16} className="text-[#B7791F]" />
          </div>
          <h3 className={`text-xl font-bold tabular-nums ${lowStockCount > 0 ? 'text-[#C23B3B]' : 'text-[#1E8E5A]'}`}>
            {lowStockCount}
          </h3>
          <p className="text-[11px] text-[#3E5368]/80 mt-1">Items at or below reorder level</p>
        </div>

        <div className="rounded-xl border border-[#E8DFCF] bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-[#3E5368] mb-1">
            <span className="text-[11px] font-semibold">Active Godowns</span>
            <WarehouseIcon size={16} className="text-[#1F86CC]" />
          </div>
          <h3 className="text-xl font-bold tabular-nums text-[#12263A]">{warehouses.length}</h3>
          <p className="text-[11px] text-[#3E5368]/80 mt-1">Multi-location godowns</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-[#E8DFCF] pb-2 text-xs font-semibold scrollbar-none">
        {[
          { id: 'products', label: 'Product Master' },
          { id: 'summary', label: 'Stock Summary' },
          { id: 'ledger', label: 'Stock Movement Ledger' },
          { id: 'transfers', label: 'Godown Transfers' },
          { id: 'adjustments', label: 'Stock Adjustments' },
          { id: 'batches', label: `Batches & Expiry (${nearExpiryBatches.length + expiredBatches.length})` },
          { id: 'alerts', label: `Low Stock Alerts (${lowStockCount})` },
        ].map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-2 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#EAF5FD] text-[#1F86CC] border border-[#3BA0E6]/30 shadow-2xs font-semibold'
                  : 'text-[#3E5368] hover:bg-[#FFFBF3] hover:text-[#12263A]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: PRODUCT MASTER */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row gap-2.5 items-center justify-between bg-white p-2.5 rounded-xl border border-[#E8DFCF] shadow-2xs">
            <div className="relative w-full sm:w-80">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#3E5368]" />
              <input
                type="text"
                placeholder="Search by name, SKU, barcode, HSN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 h-10 text-xs rounded-lg border border-[#E8DFCF] bg-[#FFFBF3] text-[#12263A] placeholder-[#3E5368]/60 focus:bg-white focus:outline-hidden focus:border-[#3BA0E6] focus:ring-1 focus:ring-[#3BA0E6]"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="h-10 px-3 text-xs rounded-lg border border-[#E8DFCF] bg-[#FFFBF3] text-[#12263A] focus:outline-hidden focus:border-[#3BA0E6]"
              >
                <option value="">All Categories</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              <select
                value={selectedProductType}
                onChange={(e) => setSelectedProductType(e.target.value)}
                className="h-10 px-3 text-xs rounded-lg border border-[#E8DFCF] bg-[#FFFBF3] text-[#12263A] focus:outline-hidden focus:border-[#3BA0E6]"
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredProducts.map(p => (
              <div
                key={p.id}
                onClick={() => onEditProduct(p)}
                className="rounded-xl border border-[#E8DFCF] bg-white p-4 shadow-2xs flex flex-col justify-between hover:border-[#3BA0E6]/50 transition cursor-pointer"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h4 className="font-bold text-[#12263A] text-sm truncate">{p.name}</h4>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[#3E5368]">
                        {p.sku && <span className="bg-[#EEF2F6] px-1.5 py-0.5 rounded text-[#12263A]">SKU: {p.sku}</span>}
                        {p.barcode && <span className="flex items-center gap-1"><Barcode size={12} /> {p.barcode}</span>}
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-[#1F86CC] bg-[#EAF5FD] border border-[#3BA0E6]/30 px-2 py-0.5 rounded-sm">
                      GST {p.gstRate}%
                    </span>
                  </div>

                  <div className="mt-3 space-y-1 text-xs text-[#3E5368]">
                    <div className="flex justify-between">
                      <span>HSN / SAC:</span>
                      <span className="text-[#12263A] font-semibold">{p.hsnCode}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Selling Price:</span>
                      <span className="text-[#12263A] font-bold tabular-nums">{formatCurrency(p.unitPrice)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Purchase Cost:</span>
                      <span className="text-[#3E5368] tabular-nums">{formatCurrency(p.purchasePrice || p.averageCost || 0)}</span>
                    </div>
                    {p.mrp && p.mrp > 0 && (
                      <div className="flex justify-between">
                        <span>MRP:</span>
                        <span className="text-[#3E5368] tabular-nums">{formatCurrency(p.mrp)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3.5 pt-2.5 border-t border-[#E8DFCF] flex items-center justify-between text-xs">
                  <span className="text-[#3E5368] font-medium">Stock in Hand:</span>
                  <span
                    className={`px-2 py-0.5 rounded-sm font-semibold text-xs tabular-nums ${
                      p.itemType === 'service'
                        ? 'bg-[#EAF5FD] text-[#1F86CC] border border-[#3BA0E6]/30'
                        : p.stockQty <= (p.reorderLevel || 10)
                        ? 'bg-[#FDECEC] text-[#C23B3B] border border-[#C23B3B]/20'
                        : 'bg-[#E6F6EE] text-[#1E8E5A] border border-[#1E8E5A]/20'
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
        <div className="bg-white rounded-xl border border-[#E8DFCF] overflow-hidden shadow-2xs">
          <div className="p-3.5 border-b border-[#E8DFCF] flex items-center justify-between">
            <h3 className="font-bold text-[#12263A] text-sm">Product-wise Stock Summary & Closing Valuation</h3>
            <span className="text-xs text-[#3E5368]">Reconciled from stock movements</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FFFBF3] text-[#3E5368] font-semibold border-b border-[#E8DFCF]">
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
              <tbody className="divide-y divide-[#E8DFCF]">
                {stockSummary.map(row => (
                  <tr key={row.productId} className="hover:bg-[#FFFBF3] transition">
                    <td className="p-3 font-semibold text-[#12263A]">{row.productName}</td>
                    <td className="p-3 text-[#3E5368]">{row.sku}</td>
                    <td className="p-3 text-[#3E5368]">{row.category}</td>
                    <td className="p-3 text-right tabular-nums text-[#3E5368]">{row.openingStock} {row.unit}</td>
                    <td className="p-3 text-right tabular-nums text-[#1E8E5A]">+{row.stockIn}</td>
                    <td className="p-3 text-right tabular-nums text-[#C23B3B]">-{row.stockOut}</td>
                    <td className="p-3 text-right tabular-nums font-bold text-[#12263A]">{row.closingStock} {row.unit}</td>
                    <td className="p-3 text-right tabular-nums text-[#3E5368]">{formatCurrency(row.averageCost)}</td>
                    <td className="p-3 text-right tabular-nums font-bold text-[#12263A]">{formatCurrency(row.valuation)}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-sm text-[10px] font-semibold ${
                        row.status === 'Out of Stock' ? 'bg-[#FDECEC] text-[#C23B3B] border border-[#C23B3B]/20' :
                        row.status === 'Low Stock' ? 'bg-[#FFF3DC] text-[#B7791F] border border-[#B7791F]/20' :
                        'bg-[#E6F6EE] text-[#1E8E5A] border border-[#1E8E5A]/20'
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
        <div className="bg-white rounded-xl border border-[#E8DFCF] overflow-hidden shadow-2xs">
          <div className="p-3.5 border-b border-[#E8DFCF] flex items-center justify-between">
            <h3 className="font-bold text-[#12263A] text-sm">Chronological Stock Movement Audit Ledger</h3>
            <span className="text-xs text-[#3E5368] font-semibold">{stockLedger.length} Movements Logged</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FFFBF3] text-[#3E5368] font-semibold border-b border-[#E8DFCF]">
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
              <tbody className="divide-y divide-[#E8DFCF]">
                {stockLedger.map(m => (
                  <tr key={m.id} className="hover:bg-[#FFFBF3] transition">
                    <td className="p-3 text-[#3E5368]">{formatDate(m.date)}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-sm text-[10px] font-semibold ${
                        m.quantityIn > 0 ? 'bg-[#E6F6EE] text-[#1E8E5A] border border-[#1E8E5A]/20' : 'bg-[#FDECEC] text-[#C23B3B] border border-[#C23B3B]/20'
                      }`}>
                        {m.movementType.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-3 text-[#3E5368] uppercase text-[11px]">{m.referenceType}</td>
                    <td className="p-3 font-semibold text-[#1F86CC]">{m.referenceNumber}</td>
                    <td className="p-3 text-[#12263A]">{m.warehouseName}</td>
                    <td className="p-3 text-right tabular-nums text-[#1E8E5A]">{m.quantityIn > 0 ? `+${m.quantityIn}` : '-'}</td>
                    <td className="p-3 text-right tabular-nums text-[#C23B3B]">{m.quantityOut > 0 ? `-${m.quantityOut}` : '-'}</td>
                    <td className="p-3 text-right tabular-nums font-bold text-[#12263A]">{m.runningBalance}</td>
                    <td className="p-3 text-right tabular-nums text-[#3E5368]">{formatCurrency(m.unitCost)}</td>
                    <td className="p-3 text-right tabular-nums font-bold text-[#12263A]">{formatCurrency(m.totalValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: GODOWN TRANSFERS */}
      {activeTab === 'transfers' && (
        <div className="bg-white rounded-xl border border-[#E8DFCF] overflow-hidden shadow-2xs">
          <div className="p-3.5 border-b border-[#E8DFCF] flex items-center justify-between">
            <h3 className="font-bold text-[#12263A] text-sm">Inter-Godown Stock Transfers</h3>
            <button
              onClick={onOpenTransferModal}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#E0771A] hover:bg-[#B85D0F] text-white rounded-lg text-xs font-semibold transition cursor-pointer"
            >
              <Plus size={14} /> New Transfer
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FFFBF3] text-[#3E5368] font-semibold border-b border-[#E8DFCF]">
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
              <tbody className="divide-y divide-[#E8DFCF]">
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-[#3E5368]">
                      No inter-godown transfers recorded yet.
                    </td>
                  </tr>
                ) : (
                  transfers.map(t => (
                    <tr key={t.id} className="hover:bg-[#FFFBF3] transition">
                      <td className="p-3 font-semibold text-[#1F86CC]">{t.transferNumber}</td>
                      <td className="p-3 text-[#3E5368]">{formatDate(t.date)}</td>
                      <td className="p-3 font-medium text-[#12263A]">{t.sourceWarehouseName || t.sourceWarehouseId}</td>
                      <td className="p-3 font-medium text-[#12263A]">{t.destinationWarehouseName || t.destinationWarehouseId}</td>
                      <td className="p-3">
                        <div className="space-y-0.5">
                          {t.lines.map((l, i) => (
                            <span key={i} className="block text-[11px] text-[#3E5368]">
                              {l.productName} • <strong className="text-[#12263A]">{l.quantity}</strong> (Value: {formatCurrency(l.totalValue)})
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded-sm text-[10px] font-semibold bg-[#EAF5FD] text-[#1F86CC] border border-[#3BA0E6]/30 uppercase">
                          {t.status}
                        </span>
                      </td>
                      <td className="p-3 text-[#3E5368] italic">{t.notes || '—'}</td>
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
        <div className="bg-white rounded-xl border border-[#E8DFCF] overflow-hidden shadow-2xs">
          <div className="p-3.5 border-b border-[#E8DFCF] flex items-center justify-between">
            <h3 className="font-bold text-[#12263A] text-sm">Stock Adjustment & Physical Count Vouchers</h3>
            <button
              onClick={onOpenAdjustmentModal}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#E0771A] hover:bg-[#B85D0F] text-white rounded-lg text-xs font-semibold transition cursor-pointer"
            >
              <Plus size={14} /> New Adjustment
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FFFBF3] text-[#3E5368] font-semibold border-b border-[#E8DFCF]">
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
              <tbody className="divide-y divide-[#E8DFCF]">
                {adjustments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-[#3E5368]">
                      No stock adjustment vouchers recorded yet.
                    </td>
                  </tr>
                ) : (
                  adjustments.map(a => (
                    <tr key={a.id} className="hover:bg-[#FFFBF3] transition">
                      <td className="p-3 font-semibold text-[#E0771A]">{a.adjustmentNumber}</td>
                      <td className="p-3 text-[#3E5368]">{formatDate(a.date)}</td>
                      <td className="p-3 font-medium text-[#12263A]">{a.warehouseName || a.warehouseId}</td>
                      <td className="p-3">
                        <div className="space-y-0.5">
                          {a.lines.map((l, i) => (
                            <span key={i} className="block text-[11px] text-[#3E5368]">
                              {l.productName}: Diff <strong className={l.differenceQuantity < 0 ? 'text-[#C23B3B]' : 'text-[#1E8E5A]'}>
                                {l.differenceQuantity > 0 ? `+${l.differenceQuantity}` : l.differenceQuantity}
                              </strong> ({l.reason})
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className={`p-3 text-right tabular-nums font-bold ${
                        a.totalAdjustmentValue < 0 ? 'text-[#C23B3B]' : a.totalAdjustmentValue > 0 ? 'text-[#1E8E5A]' : 'text-[#12263A]'
                      }`}>
                        {formatCurrency(a.totalAdjustmentValue)}
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded-sm text-[10px] font-semibold bg-[#FFF3DC] text-[#B7791F] border border-[#B7791F]/20 uppercase">
                          {a.status}
                        </span>
                      </td>
                      <td className="p-3 text-[#3E5368] italic">{a.narration || '—'}</td>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="bg-[#FDECEC] border border-[#C23B3B]/20 rounded-xl p-4">
              <h4 className="font-bold text-[#C23B3B] text-xs flex items-center gap-1.5 mb-2">
                <AlertTriangle size={15} /> Expired Stock ({expiredBatches.length})
              </h4>
              <div className="space-y-1.5 text-xs">
                {expiredBatches.length === 0 ? (
                  <p className="text-[#C23B3B] italic">No expired stock recorded.</p>
                ) : (
                  expiredBatches.map(b => (
                    <div key={b.id} className="flex justify-between bg-white p-2 rounded-lg border border-[#C23B3B]/20 tabular-nums">
                      <span>Batch: {b.batchNumber}</span>
                      <span className="font-bold text-[#C23B3B]">Expired: {b.expiryDate} (Qty: {b.remainingQuantity})</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-[#FFF3DC] border border-[#B7791F]/20 rounded-xl p-4">
              <h4 className="font-bold text-[#B7791F] text-xs flex items-center gap-1.5 mb-2">
                <AlertTriangle size={15} /> Near Expiry ({nearExpiryBatches.length})
                {critical7DayBatches.length > 0 && (
                  <span className="ml-auto px-2 py-0.5 text-[10px] font-bold bg-[#C23B3B] text-white rounded-sm animate-pulse">
                    {critical7DayBatches.length} Expiring &lt;7 Days
                  </span>
                )}
              </h4>
              <div className="space-y-1.5 text-xs">
                {nearExpiryBatches.length === 0 ? (
                  <p className="text-[#B7791F] italic">No batches expiring within 60 days.</p>
                ) : (
                  nearExpiryBatches.map(b => (
                    <div key={b.id} className="flex justify-between bg-white p-2 rounded-lg border border-[#B7791F]/20 tabular-nums">
                      <span>Batch: {b.batchNumber}</span>
                      <span className="font-bold text-[#B7791F]">Expires: {b.expiryDate} (Qty: {b.remainingQuantity})</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#E8DFCF] overflow-hidden shadow-2xs">
            <div className="p-3.5 border-b border-[#E8DFCF] flex items-center justify-between">
              <h3 className="font-bold text-[#12263A] text-sm">All Product Batches</h3>
              <span className="text-xs text-[#3E5368] font-semibold">{batches.length} Batches Tracked</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FFFBF3] text-[#3E5368] font-semibold border-b border-[#E8DFCF]">
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
                <tbody className="divide-y divide-[#E8DFCF]">
                  {batches.map(b => (
                    <tr key={b.id} className="hover:bg-[#FFFBF3] transition">
                      <td className="p-3 font-semibold text-[#12263A]">{b.batchNumber}</td>
                      <td className="p-3 text-[#3E5368]">{b.productName || b.productId}</td>
                      <td className="p-3 text-[#3E5368]">{b.manufacturingDate ? formatDate(b.manufacturingDate) : '—'}</td>
                      <td className="p-3 font-semibold text-[#B7791F]">{formatDate(b.expiryDate)}</td>
                      <td className="p-3 text-right tabular-nums text-[#3E5368]">{b.quantityReceived}</td>
                      <td className="p-3 text-right tabular-nums font-bold text-[#12263A]">{b.remainingQuantity}</td>
                      <td className="p-3 text-right tabular-nums text-[#3E5368]">{formatCurrency(b.unitCost)}</td>
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
        <div className="bg-white rounded-xl border border-[#E8DFCF] overflow-hidden shadow-2xs">
          <div className="p-3.5 border-b border-[#E8DFCF] flex items-center justify-between">
            <h3 className="font-bold text-[#12263A] text-sm">Items Below Minimum / Reorder Level</h3>
            <span className="text-xs text-[#C23B3B] font-semibold">{lowStockAlerts.length} Action Items Required</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FFFBF3] text-[#3E5368] font-semibold border-b border-[#E8DFCF]">
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
              <tbody className="divide-y divide-[#E8DFCF]">
                {lowStockAlerts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-[#1E8E5A] font-semibold">
                      All products have healthy inventory levels above reorder thresholds!
                    </td>
                  </tr>
                ) : (
                  lowStockAlerts.map(a => (
                    <tr key={a.productId} className="hover:bg-[#FFFBF3] transition">
                      <td className="p-3 font-semibold text-[#12263A]">{a.productName}</td>
                      <td className="p-3 text-[#3E5368]">{a.sku}</td>
                      <td className="p-3 text-right tabular-nums font-bold text-[#C23B3B]">{a.currentStock} {a.unit}</td>
                      <td className="p-3 text-right tabular-nums text-[#3E5368]">{a.reorderLevel} {a.unit}</td>
                      <td className="p-3 text-right tabular-nums text-[#3E5368]">{a.minStockLevel} {a.unit}</td>
                      <td className="p-3 text-right tabular-nums font-bold text-[#B7791F]">+{a.deficit} {a.unit}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-sm text-[10px] font-semibold ${
                          a.currentStock <= 0 ? 'bg-[#FDECEC] text-[#C23B3B] border border-[#C23B3B]/20' : 'bg-[#FFF3DC] text-[#B7791F] border border-[#B7791F]/20'
                        }`}>
                          {a.currentStock <= 0 ? 'Out of Stock' : 'Low Stock'}
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
