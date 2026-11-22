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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl border border-[#E8DFCF] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex h-14 items-center justify-between border-b border-[#E8DFCF] bg-[#FDECEC] px-6 text-[#C23B3B]">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} />
            <span className="text-xs font-bold tracking-wide uppercase">Cancel Invoice</span>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-[#C23B3B] hover:bg-[#FDECEC]/80 cursor-pointer">
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

          <div className="flex gap-2.5 pt-2 border-t border-[#E8DFCF]">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-[#E8DFCF] px-4 py-2 text-xs font-semibold text-[#3E5368] hover:bg-[#FFFBF3] transition cursor-pointer"
            >
              Keep Active
            </button>
            <button
              type="submit"
              disabled={!reason.trim()}
              className="flex-1 rounded-lg bg-[#C23B3B] hover:bg-[#A82B2B] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 transition cursor-pointer shadow-2xs"
            >
              Confirm Cancellation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
