import React, { useState, useEffect } from 'react';
import { X, ArrowRightLeft, AlertCircle, Check, Building2, Wallet, Calendar, Hash, ArrowRight } from 'lucide-react';
import { BankAccount, CashAccount } from '../../types/banking';
import { maskAccountNumber } from '../../services/banking/bankAccountService';
import { validateFundTransfer } from '../../services/banking/fundTransferService';
import { formatCurrency } from '../../utils/formatters';

interface FundTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (transferData: {
    transferNumber: string;
    date: string;
    sourceAccountId: string;
    sourceAccountType: 'bank' | 'cash';
    destinationAccountId: string;
    destinationAccountType: 'bank' | 'cash';
    amount: number;
    transferMode: 'bank_transfer' | 'cash_deposit' | 'cash_withdrawal' | 'cheque' | 'internal_transfer';
    referenceNumber?: string;
    narration?: string;
  }) => Promise<void>;
  bankAccounts: BankAccount[];
  cashAccounts: CashAccount[];
  isDateLocked: (date: string) => boolean;
}

export const FundTransferModal: React.FC<FundTransferModalProps> = ({
  isOpen,
  onClose,
  onSave,
  bankAccounts,
  cashAccounts,
  isDateLocked
}) => {
  const [transferNumber, setTransferNumber] = useState(`TRF-${Date.now().toString().slice(-6)}`);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState<number>(0);
  const [transferMode, setTransferMode] = useState<'bank_transfer' | 'cash_deposit' | 'cash_withdrawal' | 'cheque' | 'internal_transfer'>('internal_transfer');
  
  const [sourceId, setSourceId] = useState<string>('');
  const [destinationId, setDestinationId] = useState<string>('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [narration, setNarration] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set smart default accounts
  useEffect(() => {
    if (!sourceId && bankAccounts.length > 0) {
      setSourceId(bankAccounts[0].id);
    }
    if (!destinationId && cashAccounts.length > 0) {
      setDestinationId(cashAccounts[0].id);
    }
  }, [bankAccounts, cashAccounts]);

  // Find selected accounts
  const sourceBank = bankAccounts.find(b => b.id === sourceId);
  const sourceCash = cashAccounts.find(c => c.id === sourceId);
  const sourceAccount = sourceBank || sourceCash;
  const sourceAccountType = sourceBank ? 'bank' : 'cash';

  const destBank = bankAccounts.find(b => b.id === destinationId);
  const destCash = cashAccounts.find(c => c.id === destinationId);
  const destAccount = destBank || destCash;
  const destAccountType = destBank ? 'bank' : 'cash';

  // Automatically adapt transferMode based on source & dest
  useEffect(() => {
    if (sourceAccountType === 'cash' && destAccountType === 'bank') {
      setTransferMode('cash_deposit');
    } else if (sourceAccountType === 'bank' && destAccountType === 'cash') {
      setTransferMode('cash_withdrawal');
    } else if (sourceAccountType === 'bank' && destAccountType === 'bank') {
      setTransferMode('bank_transfer');
    } else {
      setTransferMode('internal_transfer');
    }
  }, [sourceAccountType, destAccountType]);

  const isLocked = isDateLocked(date);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isLocked) {
      setError(`Cannot create transfer in locked period for date ${date}`);
      return;
    }

    if (amount <= 0) {
      setError('Transfer amount must be greater than 0');
      return;
    }

    if (!sourceId || !destinationId) {
      setError('Please select both source and destination accounts');
      return;
    }

    if (!sourceAccount || !destAccount) {
      setError('Invalid accounts selected');
      return;
    }

    const validation = validateFundTransfer({
      sourceAccountId: sourceId,
      sourceAccountType,
      sourceAccount,
      destinationAccountId: destinationId,
      destinationAccountType: destAccountType,
      amount
    });

    if (!validation.valid) {
      setError(validation.error || 'Transfer validation failed');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSave({
        transferNumber,
        date,
        sourceAccountId: sourceId,
        sourceAccountType,
        destinationAccountId: destinationId,
        destinationAccountType: destAccountType,
        amount,
        transferMode,
        referenceNumber: referenceNumber.trim() || undefined,
        narration: narration.trim() || undefined
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record fund transfer');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 my-8 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-200">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Internal Fund Transfer (Contra)</h2>
              <p className="text-xs text-slate-500">Move funds between Bank accounts, Main Cash, and Petty Cash</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600:text-slate-200 rounded-lg hover:bg-white/80:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3 text-red-700 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          {/* Metadata Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Transfer Number
              </label>
              <div className="relative">
                <Hash className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={transferNumber}
                  onChange={(e) => setTransferNumber(e.target.value)}
                  required
                  className="w-full pl-9 pr-3 py-2 text-sm font-mono rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Transfer Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className={`w-full pl-9 pr-3 py-2 text-sm rounded-xl border ${
                    isLocked ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white'
                  } text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none`}
                />
              </div>
              {isLocked && <p className="text-[10px] text-red-500 mt-0.5">Period is locked</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Transfer Amount (₹) *
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount || ''}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                required
                className="w-full px-3 py-2 text-sm font-bold text-blue-600 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Accounts Flow: Source -> Destination */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center relative">
              
              {/* Source Account */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  From (Source Account) *
                </label>
                <select
                  value={sourceId}
                  onChange={(e) => setSourceId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <optgroup label="Bank Accounts">
                    {bankAccounts.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.bankName} ({maskAccountNumber(b.accountNumber)}) — Bal: {formatCurrency(b.currentBalance)}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Cash Accounts">
                    {cashAccounts.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} — Bal: {formatCurrency(c.currentBalance)}
                      </option>
                    ))}
                  </optgroup>
                </select>
                {sourceAccount && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    Available: <span className="font-semibold">{formatCurrency(sourceAccount.currentBalance)}</span>
                    {'overdraftLimit' in sourceAccount && sourceAccount.overdraftLimit && sourceAccount.overdraftLimit > 0 ? (
                      <span className="text-amber-600 ml-1">(+ OD {formatCurrency(sourceAccount.overdraftLimit)})</span>
                    ) : null}
                  </p>
                )}
              </div>

              {/* Destination Account */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  To (Destination Account) *
                </label>
                <select
                  value={destinationId}
                  onChange={(e) => setDestinationId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <optgroup label="Cash Accounts">
                    {cashAccounts.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} — Bal: {formatCurrency(c.currentBalance)}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Bank Accounts">
                    {bankAccounts.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.bankName} ({maskAccountNumber(b.accountNumber)}) — Bal: {formatCurrency(b.currentBalance)}
                      </option>
                    ))}
                  </optgroup>
                </select>
                {destAccount && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    Current Balance: <span className="font-semibold">{formatCurrency(destAccount.currentBalance)}</span>
                  </p>
                )}
              </div>

            </div>
          </div>

          {/* Mode & Reference */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Transfer Mode
              </label>
              <select
                value={transferMode}
                onChange={(e) => setTransferMode(e.target.value as any)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="internal_transfer">Internal Transfer (Contra)</option>
                <option value="bank_transfer">Bank to Bank (NEFT/RTGS/IMPS)</option>
                <option value="cash_deposit">Cash Deposit to Bank</option>
                <option value="cash_withdrawal">Cash Withdrawal from Bank</option>
                <option value="cheque">Cheque Transfer</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Reference / Slip / Cheque No.
              </label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="Deposit slip or UTR number"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Narration */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Narration / Notes
            </label>
            <textarea
              rows={2}
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              placeholder="e.g., Cash deposited to HDFC Current Account"
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
          </div>

          {/* Double-Entry Preview Box */}
          <div className="p-3 bg-blue-50/60 border border-blue-200/80 rounded-xl text-xs space-y-1">
            <div className="font-semibold text-blue-900 flex items-center gap-1.5">
              <span>Double-Entry Contra Voucher Posting:</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Debit: <strong>{destAccount ? ('bankName' in destAccount ? `${destAccount.bankName} (1020)` : `${destAccount.name} (1010)`) : 'Destination'}</strong></span>
              <span className="font-mono text-emerald-600 font-medium">+{formatCurrency(amount || 0)}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Credit: <strong>{sourceAccount ? ('bankName' in sourceAccount ? `${sourceAccount.bankName} (1020)` : `${sourceAccount.name} (1010)`) : 'Source'}</strong></span>
              <span className="font-mono text-rose-600 font-medium">-{formatCurrency(amount || 0)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isLocked}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-lg shadow-blue-200 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Transferring...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Execute Transfer</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
