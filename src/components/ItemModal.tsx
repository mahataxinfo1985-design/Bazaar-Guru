import React, { useState } from 'react';
import { X, Plus, Package } from 'lucide-react';
import { Item } from '../types';

interface ItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: Item) => void;
}

// Auto-detect HSN code based on product name keywords
export function getAutomatedHsn(productName: string): string {
  const name = productName.toLowerCase();
  if (name.includes('salt')) return '2501';
  if (name.includes('mustard') || name.includes('oil')) return '1514';
  if (name.includes('milk') || name.includes('silk') || name.includes('chocolate')) return '1806';
  if (name.includes('atta') || name.includes('flour')) return '1101';
  if (name.includes('bottle')) return '3924';
  return '';
}

export default function ItemModal({ isOpen, onClose, onSave }: ItemModalProps) {
  const [name, setName] = useState('');
  const [hsnCode, setHsnCode] = useState('');
  const [unit, setUnit] = useState('PCS');
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [mrp, setMrp] = useState<number>(0);
  const [gstRate, setGstRate] = useState<number>(18);
  const [stockQty, setStockQty] = useState<number>(0);
  const [error, setError] = useState('');

  // Auto-detect HSN from product name when user finishes typing
  const handleNameBlur = () => {
    if (!hsnCode.trim() && name.trim()) {
      const detected = getAutomatedHsn(name.trim());
      if (detected) {
        setHsnCode(detected);
      }
    }
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Product or Service Name is required');
    if (!hsnCode.trim()) return setError('HSN code is required (e.g., 2501)');
    if (unitPrice < 0) return setError('Unit Price cannot be negative');
    if (mrp < unitPrice && mrp > 0) return setError('MRP should generally be greater than or equal to unit price');

    const newItem: Item = {
      id: `item_${Date.now()}`,
      name: name.trim(),
      hsnCode: hsnCode.trim(),
      unit,
      unitPrice: Number(unitPrice),
      mrp: mrp > 0 ? Number(mrp) : Number(unitPrice),
      gstRate: Number(gstRate),
      stockQty: Number(stockQty)
    };

    onSave(newItem);
    // Reset state
    setName('');
    setHsnCode('');
    setUnit('PCS');
    setUnitPrice(0);
    setMrp(0);
    setGstRate(18);
    setStockQty(0);
    setError('');
    onClose();
  };

  const gstRates = [0, 5, 12, 18, 28];
  const unitOptions = ['PCS', 'BOX', 'LTR', 'KGS', 'NOS', 'MTR', 'BAG', 'HRS', 'SET'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-[#E8DFCF]">
        
        {/* Header */}
        <div className="flex items-center justify-between bg-[#FFFBF3] px-6 py-4 border-b border-[#E8DFCF]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#EAF5FD] text-[#1F86CC] border border-[#3BA0E6]/30">
              <Package size={18} />
            </div>
            <h2 className="text-base font-bold text-[#12263A]">Add New Product / Service</h2>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="rounded-lg p-1.5 text-[#3E5368] hover:bg-[#EAF5FD] hover:text-[#12263A] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-600 border border-red-100">
              {error}
            </div>
          )}

          <div className="space-y-3.5">
            {/* Item Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Item Description / Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={handleNameBlur}
                placeholder="e.g. Tata Salt 1kg, Consulting Hour"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              {/* HSN CODE */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  HSN / SAC Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={hsnCode}
                  onChange={(e) => setHsnCode(e.target.value)}
                  placeholder="e.g. 2106"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              {/* Unit */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Selling Unit
                </label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-hidden bg-white"
                >
                  {unitOptions.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              {/* Unit Price */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Unit Sales Price (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={unitPrice || ''}
                  onChange={(e) => setUnitPrice(Number(e.target.value))}
                  placeholder="Before GST"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              {/* MRP */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  MRP Tag (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={mrp || ''}
                  onChange={(e) => setMrp(Number(e.target.value))}
                  placeholder="Ref Retail tag"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              {/* GST rate */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  GST Rate (%)
                </label>
                <select
                  value={gstRate}
                  onChange={(e) => setGstRate(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-hidden bg-white"
                >
                  {gstRates.map((rate) => (
                    <option key={rate} value={rate}>{rate}%</option>
                  ))}
                </select>
              </div>

              {/* Stock Quantity */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Initial Stock Qty
                </label>
                <input
                  type="number"
                  value={stockQty || ''}
                  onChange={(e) => setStockQty(Number(e.target.value))}
                  placeholder="Available qty"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2.5 border-t border-[#E8DFCF] pt-3.5 mt-5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#E8DFCF] px-4 py-2 text-xs font-semibold text-[#3E5368] hover:bg-[#FFFBF3] transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-lg bg-[#E0771A] hover:bg-[#B85D0F] px-5 py-2 text-xs font-semibold text-white shadow-2xs transition cursor-pointer"
            >
              <Plus size={15} />
              <span>Save Product</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
