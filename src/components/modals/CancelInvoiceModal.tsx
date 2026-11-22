import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { Invoice } from '../../types';

interface CancelInvoiceModalProps {
  invoice: Invoice | null;
  onClose: () => void;
  onConfirm: (invoice: Invoice, reason: string) => void;
}

export default function CancelInvoiceModal({
  invoice,
  onClose,
  onConfirm,
}: CancelInvoiceModalProps) {
  const [reason, setReason] = useState('');

  if (!invoice) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    onConfirm(invoice, reason.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex h-14 items-center justify-between border-b border-slate-100 bg-red-600 px-6 text-white">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} />
            <span className="text-xs font-bold tracking-wide uppercase">Cancel Invoice</span>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-red-100 hover:bg-red-700">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-slate-600">
            You are cancelling invoice <strong className="text-slate-900">{invoice.invoiceNumber}</strong>.
            This action will reverse accounting journal entries and restore inventory stocks.
          </p>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Cancellation Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Order cancelled by client, duplicate entry, incorrect tax rate..."
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-red-500 focus:outline-hidden resize-none"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              Keep Active
            </button>
            <button
              type="submit"
              disabled={!reason.trim()}
              className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50 transition cursor-pointer"
            >
              Confirm Cancellation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
