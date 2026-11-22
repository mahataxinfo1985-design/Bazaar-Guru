import React, { useState } from 'react';
import { X, Plus, Trash2, Calendar, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { Account, Party } from '../../types';
import { JournalEntry } from '../../types/accounting';
import { createManualJournalEntry } from '../../services/accounting/journalEngine';
import { safeAdd, safeSub, round2 } from '../../utils/decimal';

interface JournalVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: JournalEntry) => void;
  accounts: Account[];
  parties: Party[];
}

interface JournalLineDraft {
  id: string;
  accountId: string;
  partyId?: string;
  description: string;
  debit: number;
  credit: number;
}

export default function JournalVoucherModal({
  isOpen,
  onClose,
  onSave,
  accounts,
  parties,
}: JournalVoucherModalProps) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [narration, setNarration] = useState('');
  const [lines, setLines] = useState<JournalLineDraft[]>([
    { id: '1', accountId: '', description: '', debit: 0, credit: 0 },
    { id: '2', accountId: '', description: '', debit: 0, credit: 0 },
  ]);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const activeAccounts = accounts.filter((a) => a.isActive);

  const handleAddLine = () => {
    setLines((prev) => [
      ...prev,
      { id: Date.now().toString(), accountId: '', description: '', debit: 0, credit: 0 },
    ]);
  };

  const handleRemoveLine = (id: string) => {
    if (lines.length <= 2) {
      setError('A journal entry must contain at least two line items.');
      return;
    }
    setLines((prev) => prev.filter((l) => l.id !== id));
  };

  const handleUpdateLine = (id: string, field: keyof JournalLineDraft, value: any) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id === id) {
          const updated = { ...l, [field]: value };
          // If updating debit, zero out credit and vice versa
          if (field === 'debit' && value > 0) updated.credit = 0;
          if (field === 'credit' && value > 0) updated.debit = 0;
          return updated;
        }
        return l;
      })
    );
    setError(null);
  };

  const totalDebit = lines.reduce((sum, l) => safeAdd(sum, Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, l) => safeAdd(sum, Number(l.credit) || 0), 0);
  const diff = Math.abs(safeSub(totalDebit, totalCredit));
  const isBalanced = diff <= 0.01 && totalDebit > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!narration.trim()) return setError('Journal narration is required.');
    if (!isBalanced) {
      return setError(`Journal is out of balance by ₹${diff.toFixed(2)}. Total Debits must strictly equal Total Credits.`);
    }

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.accountId) return setError(`Row #${i + 1} has no account selected.`);
      if (l.debit <= 0 && l.credit <= 0) return setError(`Row #${i + 1} must have a non-zero Debit or Credit amount.`);
    }

    try {
      const entry = createManualJournalEntry(
        {
          date,
          narration: narration.trim(),
          lines: lines.map((l) => {
            const p = parties.find((party) => party.id === l.partyId);
            return {
              accountId: l.accountId,
              debit: Number(l.debit) || 0,
              credit: Number(l.credit) || 0,
              partyId: l.partyId || undefined,
              partyName: p?.name,
              description: l.description.trim() || undefined,
            };
          }),
        },
        accounts
      );

      onSave(entry);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error creating journal voucher.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-4xl rounded-xl bg-white shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6 shrink-0">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-blue-700" />
            <span className="text-sm font-bold tracking-wide uppercase text-slate-900">
              New Manual Journal Voucher (JV)
            </span>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition">
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200 flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Top row: Date & Narration */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Transaction Date
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Calendar size={14} />
                </div>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-hidden font-mono"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Voucher Narration / Purpose <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Month-end depreciation adjustment or capital transfer"
                value={narration}
                onChange={(e) => setNarration(e.target.value)}
                className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Lines Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
            <div className="p-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
              <span>Journal Entries (Debit & Credit Accounts)</span>
              <button
                type="button"
                onClick={handleAddLine}
                className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer bg-white px-2.5 py-1 rounded border border-slate-200 shadow-2xs"
              >
                <Plus size={13} /> Add Row
              </button>
            </div>

            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                  <th className="p-3">#</th>
                  <th className="p-3 w-1/3">Account (COA)</th>
                  <th className="p-3">Party (Optional)</th>
                  <th className="p-3">Line Description</th>
                  <th className="p-3 text-right w-28">Debit (₹)</th>
                  <th className="p-3 text-right w-28">Credit (₹)</th>
                  <th className="p-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {lines.map((line, idx) => (
                  <tr key={line.id} className="hover:bg-slate-50/80">
                    <td className="p-3 text-slate-400 font-mono text-[11px] font-bold">{idx + 1}</td>
                    <td className="p-3">
                      <select
                        required
                        value={line.accountId}
                        onChange={(e) => handleUpdateLine(line.id, 'accountId', e.target.value)}
                        className="w-full rounded border border-slate-300 p-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-hidden"
                      >
                        <option value="">-- Select Account --</option>
                        {activeAccounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.code} - {a.name} ({a.type})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3">
                      <select
                        value={line.partyId || ''}
                        onChange={(e) => handleUpdateLine(line.id, 'partyId', e.target.value)}
                        className="w-full rounded border border-slate-300 p-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-hidden"
                      >
                        <option value="">-- None --</option>
                        {parties.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3">
                      <input
                        type="text"
                        placeholder="Narration..."
                        value={line.description}
                        onChange={(e) => handleUpdateLine(line.id, 'description', e.target.value)}
                        className="w-full rounded border border-slate-300 p-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-hidden"
                      />
                    </td>
                    <td className="p-3 text-right">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0.00"
                        value={line.debit || ''}
                        onChange={(e) => handleUpdateLine(line.id, 'debit', Number(e.target.value))}
                        className="w-full rounded border border-slate-300 p-1.5 text-xs text-right font-mono text-slate-800 focus:border-blue-500 focus:outline-hidden"
                      />
                    </td>
                    <td className="p-3 text-right">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0.00"
                        value={line.credit || ''}
                        onChange={(e) => handleUpdateLine(line.id, 'credit', Number(e.target.value))}
                        className="w-full rounded border border-slate-300 p-1.5 text-xs text-right font-mono text-slate-800 focus:border-blue-500 focus:outline-hidden"
                      />
                    </td>
                    <td className="p-3 text-center">
                      {lines.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(line.id)}
                          className="text-slate-400 hover:text-red-600 transition p-1"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-200 font-mono font-bold text-xs text-slate-900">
                  <td colSpan={4} className="p-3 text-right uppercase text-[11px] text-slate-600">Total:</td>
                  <td className="p-3 text-right text-blue-700">₹{totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className="p-3 text-right text-blue-700">₹{totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Balance Status Banner */}
          <div className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
            isBalanced 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}>
            <div className="flex items-center gap-2 font-bold">
              {isBalanced ? (
                <>
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span>Entry is Balanced and Ready to Post</span>
                </>
              ) : (
                <>
                  <AlertCircle size={16} className="text-amber-600" />
                  <span>Difference: ₹{diff.toFixed(2)} (Debits must equal Credits)</span>
                </>
              )}
            </div>
            <span className="font-mono text-[11px]">
              Dr: ₹{totalDebit.toFixed(2)} | Cr: ₹{totalCredit.toFixed(2)}
            </span>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="flex h-14 items-center justify-end gap-2.5 border-t border-[#E8DFCF] bg-[#FFFBF3] px-6 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#E8DFCF] bg-white px-4 py-2 text-xs font-semibold text-[#3E5368] hover:bg-[#FFFBF3] transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isBalanced}
            className="rounded-lg bg-[#E0771A] hover:bg-[#B85D0F] disabled:opacity-40 px-5 py-2 text-xs font-semibold text-white transition cursor-pointer shadow-2xs"
          >
            Post Journal Voucher
          </button>
        </div>
      </div>
    </div>
  );
}
