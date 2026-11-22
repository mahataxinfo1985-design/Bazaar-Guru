import React, { useState } from 'react';
import { X, ArrowRightLeft, Plus, Trash2, AlertCircle, Check } from 'lucide-react';
import { Product, Warehouse, StockTransfer, StockMovement } from '../../types/inventory';
import { calculateCurrentStockFromMovements } from '../../services/inventory/stockMovementService';
import { validateStockTransfer } from '../../services/inventory/warehouseService';
import { formatCurrency } from '../../utils/formatters';

interface StockTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  warehouses: Warehouse[];
  products: Product[];
  movements: StockMovement[];
  onSave: (transferData: {
    sourceWarehouseId: string;
    destinationWarehouseId: string;
    date: string;
    notes?: string;
    lines: {
      productId: string;
      productName: string;
      sku?: string;
      quantity: number;
      unitCost: number;
      totalValue: number;
    }[];
  }) => Promise<void> | void;
}

export default function StockTransferModal({
  isOpen,
  onClose,
  warehouses,
  products,
  movements,
  onSave
}: StockTransferModalProps) {
  const [sourceWarehouseId, setSourceWarehouseId] = useState(warehouses[0]?.id || 'wh_default');
  const [destinationWarehouseId, setDestinationWarehouseId] = useState(warehouses[1]?.id || '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Array<{
    productId: string;
    quantity: number;
  }>>([
    { productId: products[0]?.id || '', quantity: 1 }
  ]);

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleAddLine = () => {
    setLines([...lines, { productId: products[0]?.id || '', quantity: 1 }]);
  };

  const handleRemoveLine = (idx: number) => {
    setLines(lines.filter((_, i) => i !== idx));
  };

  const handleLineChange = (idx: number, field: 'productId' | 'quantity', val: any) => {
    const updated = [...lines];
    updated[idx] = { ...updated[idx], [field]: val };
    setLines(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const formattedItems = lines.map(l => {
      const p = products.find(prod => prod.id === l.productId);
      return {
        productId: l.productId,
        productName: p?.name || 'Unknown Item',
        quantity: l.quantity
      };
    });

    const validation = validateStockTransfer(sourceWarehouseId, destinationWarehouseId, formattedItems, movements);
    if (!validation.valid) {
      return setError(validation.error || 'Invalid stock transfer');
    }

    try {
      setIsSubmitting(true);
      const fullLines = lines.map(l => {
        const p = products.find(prod => prod.id === l.productId);
        const cost = p?.averageCost || p?.purchasePrice || p?.unitPrice || 0;
        return {
          productId: l.productId,
          productName: p?.name || 'Unknown Item',
          sku: p?.sku,
          quantity: l.quantity,
          unitCost: cost,
          totalValue: cost * l.quantity
        };
      });

      await onSave({
        sourceWarehouseId,
        destinationWarehouseId,
        date,
        notes,
        lines: fullLines
      });

      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to execute stock transfer');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
              <ArrowRightLeft size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">New Inter-Godown Stock Transfer</h3>
              <p className="text-xs text-slate-500">Transfer physical stock between multiple warehouses with full audit traceability</p>
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Source Godown *</label>
              <select
                value={sourceWarehouseId}
                onChange={(e) => setSourceWarehouseId(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-purple-600 outline-none"
              >
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Destination Godown *</label>
              <select
                value={destinationWarehouseId}
                onChange={(e) => setDestinationWarehouseId(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-purple-600 outline-none"
              >
                <option value="">-- Select Destination --</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id} disabled={w.id === sourceWarehouseId}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Transfer Date *</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 font-mono text-slate-900 focus:ring-2 focus:ring-purple-600 outline-none"
              >
              </input>
            </div>
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Transfer Items</label>
              <button
                type="button"
                onClick={handleAddLine}
                className="flex items-center gap-1 text-xs font-bold text-purple-700 hover:text-purple-800 cursor-pointer"
              >
                <Plus size={14} /> Add Line
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-200">
              {lines.map((line, idx) => {
                const product = products.find(p => p.id === line.productId);
                const available = product ? calculateCurrentStockFromMovements(movements, product.id, sourceWarehouseId) : 0;
                const unitCost = product?.averageCost || product?.purchasePrice || product?.unitPrice || 0;

                return (
                  <div key={idx} className="p-3 bg-white flex flex-col sm:flex-row items-center gap-3">
                    <div className="flex-1 w-full">
                      <select
                        value={line.productId}
                        onChange={(e) => handleLineChange(idx, 'productId', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-purple-600 outline-none"
                      >
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.name} ({p.sku || p.unit})</option>
                        ))}
                      </select>
                      <span className="text-[10px] text-slate-400 mt-0.5 block">
                        Available at Source: <strong className={available < line.quantity ? 'text-red-600' : 'text-slate-700'}>{available} {product?.unit}</strong> • Cost: {formatCurrency(unitCost)}
                      </span>
                    </div>

                    <div className="w-28">
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={line.quantity || ''}
                        onChange={(e) => handleLineChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                        placeholder="Qty"
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 font-mono text-center font-bold text-slate-900 focus:ring-2 focus:ring-purple-600 outline-none"
                      />
                    </div>

                    <div className="w-24 text-right font-mono text-xs font-bold text-slate-700">
                      {formatCurrency(unitCost * (line.quantity || 0))}
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
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Transfer Narration / Transport Reference</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Vehicle MH-12-AB-1234, driver Ramesh"
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-purple-600 outline-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-[#E8DFCF]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#3E5368] hover:bg-[#FFFBF3] border border-[#E8DFCF] rounded-lg transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-6 py-2 bg-[#E0771A] hover:bg-[#B85D0F] text-white rounded-lg text-xs font-semibold shadow-2xs transition disabled:opacity-50 cursor-pointer"
            >
              <Check size={16} />
              {isSubmitting ? 'Transferring...' : 'Execute Stock Transfer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
