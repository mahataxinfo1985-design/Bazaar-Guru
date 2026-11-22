import React, { useState } from 'react';
import { X, AlertTriangle, Check, ShieldAlert, ArrowDownRight, ArrowUpRight, DollarSign, Calendar } from 'lucide-react';
import { ChequeRecord, ChequeStatus, BankAccount } from '../../types/banking';
import { maskAccountNumber } from '../../services/banking/bankAccountService';
import { formatCurrency } from '../../utils/formatters';

interface ChequeActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  cheque: ChequeRecord | null;
  bankAccounts: BankAccount[];
  onDeposit: (chequeId: string, depositBankAccountId: string, depositDate: string) => Promise<void>;
  onClear: (chequeId: string, clearanceDate: string) => Promise<void>;
  onBounce: (chequeId: string, bounceDate: string, bounceReason: string, bankCharges: number) => Promise<void>;
  onCancel: (chequeId: string, cancelReason: string) => Promise<void>;
}

export const ChequeActionModal: React.FC<ChequeActionModalProps> = ({
  isOpen,
  onClose,
  cheque,
  bankAccounts,
  onDeposit,
  onClear,
  onBounce,
  onCancel
}) => {
  if (!isOpen || !cheque) return null;

  const [actionType, setActionType] = useState<'deposit' | 'clear' | 'bounce' | 'cancel'>(
    cheque.status === 'received' ? 'deposit' :
    cheque.status === 'deposited' || cheque.status === 'issued' ? 'clear' : 'clear'
  );

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [depositBankId, setDepositBankId] = useState<string>(
    cheque.bankAccountId || (bankAccounts.length > 0 ? bankAccounts[0].id : '')
  );
  const [bounceReason, setBounceReason] = useState('Insufficient Funds (Refer to Drawer)');
  const [bankCharges, setBankCharges] = useState<number>(250); // Typical bank bounce charge
  const [cancelReason, setCancelReason] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      setIsSubmitting(true);
      if (actionType === 'deposit') {
        if (!depositBankId) {
          setError('Please select a deposit bank account');
          return;
        }
        await onDeposit(cheque.id, depositBankId, date);
      } else if (actionType === 'clear') {
        await onClear(cheque.id, date);
      } else if (actionType === 'bounce') {
        if (!bounceReason.trim()) {
          setError('Please enter reason for cheque bounce');
          return;
        }
        await onBounce(cheque.id, date, bounceReason.trim(), Number(bankCharges) || 0);
      } else if (actionType === 'cancel') {
        if (!cancelReason.trim()) {
          setError('Please provide a reason for cancelling this cheque');
          return;
        }
        await onCancel(cheque.id, cancelReason.trim());
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Cheque action failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 my-8 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              Cheque Action: #{cheque.chequeNumber}
            </h2>
            <p className="text-xs text-slate-500">
              {cheque.partyName} • {formatCurrency(cheque.amount)} ({cheque.chequeType === 'received' ? 'Customer Cheque' : 'Issued Cheque'})
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600:text-slate-200 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Type Selector */}
        <div className="p-4 bg-slate-100/60 border-b border-slate-200 flex gap-2 overflow-x-auto">
          {cheque.status === 'received' && (
            <button
              type="button"
              onClick={() => setActionType('deposit')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                actionType === 'deposit' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-700'
              }`}
            >
              Deposit in Bank
            </button>
          )}

          {(cheque.status === 'deposited' || cheque.status === 'issued') && (
            <button
              type="button"
              onClick={() => setActionType('clear')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                actionType === 'clear' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white text-slate-700'
              }`}
            >
              Mark Cleared
            </button>
          )}

          {(cheque.status === 'deposited' || cheque.status === 'issued') && (
            <button
              type="button"
              onClick={() => setActionType('bounce')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                actionType === 'bounce' ? 'bg-rose-600 text-white shadow-sm' : 'bg-white text-slate-700'
              }`}
            >
              Record Cheque Bounce
            </button>
          )}

          <button
            type="button"
            onClick={() => setActionType('cancel')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              actionType === 'cancel' ? 'bg-slate-800 text-white shadow-sm' : 'bg-white text-slate-700'
            }`}
          >
            Cancel Cheque
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {actionType === 'deposit' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Deposit to Bank Account *
                </label>
                <select
                  value={depositBankId}
                  onChange={(e) => setDepositBankId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 outline-none"
                >
                  {bankAccounts.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.bankName} ({maskAccountNumber(b.accountNumber)}) — Bal: {formatCurrency(b.currentBalance)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Deposit Date *
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 outline-none"
                />
              </div>
            </>
          )}

          {actionType === 'clear' && (
            <>
              <div className="p-3 bg-emerald-50 rounded-xl text-xs text-emerald-800">
                Cheque will be marked as cleared. Bank book balance will officially reflect the clearance.
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Clearance Date *
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 outline-none"
                />
              </div>
            </>
          )}

          {actionType === 'bounce' && (
            <>
              <div className="p-3 bg-rose-50 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <strong>Accounting Reversal & Penalties:</strong>
                  <p className="mt-0.5">
                    This automatically reverses the payment entry, reinstating the customer receivable / supplier liability, and creates an expense entry for bank dishonour charges.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Bounce / Return Date *
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Reason for Dishonour *
                </label>
                <select
                  value={bounceReason}
                  onChange={(e) => setBounceReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 outline-none"
                >
                  <option value="Insufficient Funds (Refer to Drawer)">Insufficient Funds (Refer to Drawer)</option>
                  <option value="Signature Mismatch">Signature Mismatch</option>
                  <option value="Stop Payment Instructed by Drawer">Stop Payment Instructed by Drawer</option>
                  <option value="Account Closed">Account Closed</option>
                  <option value="Post-dated / Stale Cheque">Post-dated / Stale Cheque</option>
                  <option value="Cheque Irregularly Drawn / Overwritten">Cheque Irregularly Drawn / Overwritten</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Bank Bounce Penalty Charges (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={bankCharges}
                  onChange={(e) => setBankCharges(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Debited to Bank Charges Expense (Account 6090) and credited from Bank
                </p>
              </div>
            </>
          )}

          {actionType === 'cancel' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Cancellation Reason *
                </label>
                <textarea
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g., Replaced with online bank transfer"
                  required
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 outline-none resize-none"
                />
              </div>
            </>
          )}

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-6 py-2 rounded-xl text-sm font-semibold text-white transition-colors flex items-center gap-2 ${
                actionType === 'bounce' ? 'bg-rose-600 hover:bg-rose-700' :
                actionType === 'clear' ? 'bg-emerald-600 hover:bg-emerald-700' :
                actionType === 'cancel' ? 'bg-slate-800 hover:bg-slate-900' :
                'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isSubmitting ? 'Processing...' : `Confirm ${actionType.charAt(0).toUpperCase() + actionType.slice(1)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
