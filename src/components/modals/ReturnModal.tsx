import React, { useState } from 'react';
import { X, RotateCcw, AlertTriangle } from 'lucide-react';
import { Invoice } from '../../types';
import { ReturnItemRequest, ReturnReason } from '../../types/workspace';
import { processSalesReturn, processPurchaseReturn } from '../../services/workflows/returnService';
import { generateNextDocumentNumber } from '../../services/settings/numberingService';

interface ReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalInvoice: Invoice | null;
  onSuccess: (returnNumber: string) => void;
}

const RETURN_REASONS: { value: ReturnReason; label: string }[] = [
  { value: 'defective_goods', label: 'Defective Goods' },
  { value: 'damaged_in_transit', label: 'Damaged in Transit' },
  { value: 'incorrect_item', label: 'Incorrect Item Shipped' },
  { value: 'customer_cancellation', label: 'Customer Cancellation' },
  { value: 'quality_issue', label: 'Quality Issue' },
  { value: 'price_difference', label: 'Price Difference' },
  { value: 'other', label: 'Other Reason' }
];

export default function ReturnModal({
  isOpen,
  onClose,
  originalInvoice,
  onSuccess
}: ReturnModalProps) {
  if (!isOpen || !originalInvoice) return null;

  const isSale = originalInvoice.partyType !== 'supplier';
  const docTypeLabel = isSale ? 'Sales Return (Credit Note)' : 'Purchase Return (Debit Note)';

  // Initial form state with each item's max eligible return quantity
  const [returnQtys, setReturnQtys] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const item of originalInvoice.items) {
      if (item.itemId) map[item.itemId] = 0;
    }
    return map;
  });

  const [returnReasons, setReturnReasons] = useState<Record<string, ReturnReason>>(() => {
    const map: Record<string, ReturnReason> = {};
    for (const item of originalInvoice.items) {
      if (item.itemId) map[item.itemId] = 'defective_goods';
    }
    return map;
  });

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleQtyChange = (itemId: string, maxQty: number, val: string) => {
    const parsed = parseFloat(val) || 0;
    const clamped = Math.max(0, Math.min(parsed, maxQty));
    setReturnQtys(prev => ({ ...prev, [itemId]: clamped }));
  };

  const handleReasonChange = (itemId: string, reason: ReturnReason) => {
    setReturnReasons(prev => ({ ...prev, [itemId]: reason }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const itemsToReturn: ReturnItemRequest[] = [];
    for (const item of originalInvoice.items) {
      const qty = item.itemId ? (returnQtys[item.itemId] || 0) : 0;
      if (qty > 0) {
        itemsToReturn.push({
          itemId: item.itemId || item.id,
          name: item.name,
          returnQty: qty,
          unitPrice: item.unitPrice,
          gstRate: item.gstRate,
          reason: item.itemId ? (returnReasons[item.itemId] || 'defective_goods') : 'defective_goods'
        });
      }
    }

    if (itemsToReturn.length === 0) {
      setError('Please specify a return quantity of at least 1 unit for at least one item.');
      return;
    }

    setProcessing(true);
    try {
      if (isSale) {
        const cnNumber = await generateNextDocumentNumber('CN');
        const result = await processSalesReturn(
          originalInvoice,
          cnNumber,
          itemsToReturn,
          'wh_default_01',
          (originalInvoice as any).partyName || 'Customer'
        );
        onSuccess(result.returnDocNumber);
      } else {
        const dnNumber = await generateNextDocumentNumber('DN');
        const result = await processPurchaseReturn(
          originalInvoice,
          dnNumber,
          itemsToReturn,
          'wh_default_01',
          (originalInvoice as any).partyName || 'Supplier'
        );
        onSuccess(result.returnDocNumber);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to process return.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <RotateCcw size={18} className="text-blue-600" />
            <h2 className="font-bold text-sm text-slate-800">{docTypeLabel}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
            Original Document: <span className="font-bold">{originalInvoice.invoiceNumber}</span> | Date: {originalInvoice.date} | Grand Total: ₹{originalInvoice.grandTotal.toFixed(2)}
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Item Name</th>
                  <th className="p-2.5 text-right">Invoiced Qty</th>
                  <th className="p-2.5 text-right">Return Qty</th>
                  <th className="p-2.5">Return Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {originalInvoice.items.map((item) => {
                  const itemId = item.itemId || item.id;
                  return (
                    <tr key={itemId} className="hover:bg-slate-50">
                      <td className="p-2.5 font-medium text-slate-800">
                        {item.name}
                        <div className="text-[10px] text-slate-400">Rate: ₹{item.unitPrice} | GST: {item.gstRate}%</div>
                      </td>
                      <td className="p-2.5 text-right font-mono">{item.qty} {item.unit}</td>
                      <td className="p-2.5 text-right">
                        <input
                          type="number"
                          min="0"
                          max={item.qty}
                          step="any"
                          value={returnQtys[itemId] ?? 0}
                          onChange={(e) => handleQtyChange(itemId, item.qty, e.target.value)}
                          className="w-20 px-2 py-1 text-right text-xs border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                        />
                      </td>
                      <td className="p-2.5">
                        <select
                          value={returnReasons[itemId] || 'defective_goods'}
                          onChange={(e) => handleReasonChange(itemId, e.target.value as ReturnReason)}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:border-blue-500 focus:outline-none bg-white"
                        >
                          {RETURN_REASONS.map(r => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={processing}
              className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={processing}
              className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {processing ? 'Processing Return...' : `Generate ${isSale ? 'Credit Note' : 'Debit Note'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
