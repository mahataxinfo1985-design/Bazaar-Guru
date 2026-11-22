import React, { useState } from 'react';
import { X, SlidersHorizontal, Plus, Trash2, AlertCircle, Check } from 'lucide-react';
import { Product, Warehouse, StockAdjustmentReason, StockMovement } from '../../types/inventory';
import { calculateCurrentStockFromMovements } from '../../services/inventory/stockMovementService';
import { calculateAdjustmentDifferences } from '../../services/inventory/adjustmentService';
import { formatCurrency } from '../../utils/formatters';

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  warehouses: Warehouse[];
  products: Product[];
  movements: StockMovement[];
  onSave: (adjustmentData: {
    warehouseId: string;
    date: string;
    narration?: string;
    lines: {
      productId: string;
      productName: string;
      sku?: string;
      systemQuantity: number;
      physicalQuantity: number;
      unitCost: number;
      reason: StockAdjustmentReason;
    }[];
  }) => Promise<void> | void;
}

export default function StockAdjustmentModal({
  isOpen,
  onClose,
  warehouses,
  products,
  movements,
  onSave
}: StockAdjustmentModalProps) {
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id || 'wh_default');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [narration, setNarration] = useState('');
  const [lines, setLines] = useState<Array<{
    productId: string;
    physicalQuantity: number;
    reason: StockAdjustmentReason;
  }>>([
    { productId: products[0]?.id || '', physicalQuantity: 0, reason: 'physical_count' }
  ]);

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleAddLine = () => {
    setLines([...lines, { productId: products[0]?.id || '', physicalQuantity: 0, reason: 'physical_count' }]);
  };

  const handleRemoveLine = (idx: number) => {
    setLines(lines.filter((_, i) => i !== idx));
  };

  const handleLineChange = (idx: number, field: string, val: any) => {
    const updated = [...lines];
    updated[idx] = { ...updated[idx], [field]: val };
    setLines(updated);
  };

  const fullLines = lines.map(l => {
    const p = products.find(prod => prod.id === l.productId);
    const systemQty = p ? calculateCurrentStockFromMovements(movements, p.id, warehouseId) : 0;
    const unitCost = p?.averageCost || p?.purchasePrice || p?.unitPrice || 0;
    return {
      productId: l.productId,
      productName: p?.name || 'Unknown Item',
      sku: p?.sku,
      systemQuantity: systemQty,
      physicalQuantity: l.physicalQuantity,
      unitCost,
      reason: l.reason
    };
  });

  const { processedLines, totalAdjustmentValue, netQuantityDifference } = calculateAdjustmentDifferences(fullLines);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouseId) return setError('Warehouse selection is required');
    if (lines.length === 0) return setError('At least one item is required');

    try {
      setIsSubmitting(true);
      setError('');

      await onSave({
        warehouseId,
        date,
        narration: narration.trim() || 'Physical Stock Reconciliation',
        lines: fullLines
      });

      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to post stock adjustment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const reasonLabels: { [key in StockAdjustmentReason]: string } = {
    physical_count: 'Physical Stock Count',
    damage: 'Damaged / Broken Goods',
    expired: 'Expired Goods Write-off',
    missing: 'Missing / Shrinkage',
    found: 'Surplus Stock Found',
    opening_correction: 'Opening Stock Correction',
    other: 'Other'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <SlidersHorizontal size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">New Stock Adjustment Voucher</h3>
              <p className="text-xs text-slate-500">Record physical stock counts, write off damages/shrinkage, and reconcile book variances</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700 font-medium">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Godown / Warehouse *</label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-amber-600 outline-none"
              >
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Adjustment Date *</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 font-mono text-slate-900 focus:ring-2 focus:ring-amber-600 outline-none"
              />
            </div>
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Adjustment Lines</label>
              <button
                type="button"
                onClick={handleAddLine}
                className="flex items-center gap-1 text-xs font-bold text-amber-700 hover:text-amber-800 cursor-pointer"
              >
                <Plus size={14} /> Add Item
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-200">
              {processedLines.map((line, idx) => (
                <div key={idx} className="p-3 bg-white flex flex-col sm:flex-row items-center gap-3">
                  <div className="flex-1 w-full">
                    <select
                      value={line.productId}
                      onChange={(e) => handleLineChange(idx, 'productId', e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-amber-600 outline-none"
                    >
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.sku || p.unit})</option>
                      ))}
                    </select>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      System Stock: <strong>{line.systemQuantity}</strong> • Unit Cost: {formatCurrency(line.unitCost)}
                    </span>
                  </div>

                  <div className="w-24">
                    <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Physical Count</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.physicalQuantity}
                      onChange={(e) => handleLineChange(idx, 'physicalQuantity', parseFloat(e.target.value) || 0)}
                      placeholder="Count"
                      className="w-full px-2 py-1 text-xs rounded-lg border border-slate-300 font-mono text-center font-bold text-slate-900 focus:ring-2 focus:ring-amber-600 outline-none"
                    />
                  </div>

                  <div className="w-28">
                    <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Difference</label>
                    <span className={`block font-mono text-xs font-bold ${
                      line.differenceQuantity < 0 ? 'text-red-600' : line.differenceQuantity > 0 ? 'text-emerald-600' : 'text-slate-400'
                    }`}>
                      {line.differenceQuantity > 0 ? `+${line.differenceQuantity}` : line.differenceQuantity}
                    </span>
                  </div>

                  <div className="w-36">
                    <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Reason</label>
                    <select
                      value={line.reason}
                      onChange={(e) => handleLineChange(idx, 'reason', e.target.value)}
                      className="w-full px-2 py-1 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 focus:ring-2 focus:ring-amber-600 outline-none"
                    >
                      {Object.entries(reasonLabels).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>

                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveLine(idx)}
                      className="p-1 text-slate-400 hover:text-red-600 transition"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Total Valuation Impact */}
            <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-600">Net Valuation Impact on Inventory (1400):</span>
              <span className={`font-mono font-bold text-sm ${totalAdjustmentValue < 0 ? 'text-red-600' : totalAdjustmentValue > 0 ? 'text-emerald-600' : 'text-slate-700'}`}>
                {totalAdjustmentValue >= 0 ? `+${formatCurrency(totalAdjustmentValue)}` : `-${formatCurrency(Math.abs(totalAdjustmentValue))}`}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Adjustment Narration</label>
            <input
              type="text"
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              placeholder="e.g. End of month physical inventory verification"
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-600 outline-none"
            />
          </div>

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
              className="flex items-center gap-1.5 px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md transition disabled:opacity-50 cursor-pointer"
            >
              <Check size={16} />
              {isSubmitting ? 'Posting...' : 'Post Stock Adjustment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
