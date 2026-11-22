import React, { useState, useEffect } from 'react';
import { X, Building2, Wallet, Check, AlertCircle, Shield, CreditCard } from 'lucide-react';
import { BankAccount, CashAccount, BankAccountType, CashAccountType } from '../../types/banking';
import { maskAccountNumber } from '../../services/banking/bankAccountService';

interface BankAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveBank: (bankData: Partial<BankAccount>) => Promise<void>;
  onSaveCash: (cashData: Partial<CashAccount>) => Promise<void>;
  editingAccount?: BankAccount | CashAccount | null;
  accountKind?: 'bank' | 'cash';
}

export const BankAccountModal: React.FC<BankAccountModalProps> = ({
  isOpen,
  onClose,
  onSaveBank,
  onSaveCash,
  editingAccount,
  accountKind = 'bank'
}) => {
  const [activeTab, setActiveTab] = useState<'bank' | 'cash'>(
    editingAccount ? ('bankName' in editingAccount ? 'bank' : 'cash') : accountKind
  );

  // Bank Form State
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [branchName, setBranchName] = useState('');
  const [accountType, setAccountType] = useState<BankAccountType>('current');
  const [bankOpeningBalance, setBankOpeningBalance] = useState<number>(0);
  const [bankOpeningDate, setBankOpeningDate] = useState(new Date().toISOString().split('T')[0]);
  const [overdraftLimit, setOverdraftLimit] = useState<number>(0);
  const [upiId, setUpiId] = useState('');
  const [isDefaultBank, setIsDefaultBank] = useState(false);

  // Cash Form State
  const [cashName, setCashName] = useState('');
  const [cashType, setCashType] = useState<CashAccountType>('petty_cash');
  const [cashOpeningBalance, setCashOpeningBalance] = useState<number>(0);
  const [cashOpeningDate, setCashOpeningDate] = useState(new Date().toISOString().split('T')[0]);
  const [isDefaultCash, setIsDefaultCash] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingAccount) {
      if ('bankName' in editingAccount) {
        setActiveTab('bank');
        setBankName(editingAccount.bankName || '');
        setAccountName(editingAccount.accountName || '');
        setAccountNumber(editingAccount.accountNumber || '');
        setIfscCode(editingAccount.ifscCode || '');
        setBranchName(editingAccount.branchName || '');
        setAccountType(editingAccount.accountType || 'current');
        setBankOpeningBalance(editingAccount.openingBalance || 0);
        setBankOpeningDate(editingAccount.openingBalanceDate || new Date().toISOString().split('T')[0]);
        setOverdraftLimit(editingAccount.overdraftLimit || 0);
        setUpiId(editingAccount.upiId || '');
        setIsDefaultBank(editingAccount.isDefault || false);
      } else {
        setActiveTab('cash');
        setCashName(editingAccount.name || '');
        setCashType(editingAccount.accountType || 'petty_cash');
        setCashOpeningBalance(editingAccount.openingBalance || 0);
        setCashOpeningDate(editingAccount.openingBalanceDate || new Date().toISOString().split('T')[0]);
        setIsDefaultCash(editingAccount.isDefault || false);
      }
    } else {
      setActiveTab(accountKind);
      setBankName('');
      setAccountName('');
      setAccountNumber('');
      setIfscCode('');
      setBranchName('');
      setAccountType('current');
      setBankOpeningBalance(0);
      setBankOpeningDate(new Date().toISOString().split('T')[0]);
      setOverdraftLimit(0);
      setUpiId('');
      setIsDefaultBank(false);

      setCashName('');
      setCashType('petty_cash');
      setCashOpeningBalance(0);
      setCashOpeningDate(new Date().toISOString().split('T')[0]);
      setIsDefaultCash(false);
    }
  }, [editingAccount, accountKind]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      setIsSubmitting(true);
      if (activeTab === 'bank') {
        if (!bankName.trim() || !accountName.trim() || !accountNumber.trim()) {
          setError('Bank name, account holder name, and account number are required.');
          return;
        }

        if (ifscCode.trim() && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode.trim().toUpperCase())) {
          setError('Invalid IFSC Code format (e.g. HDFC0001234)');
          return;
        }

        await onSaveBank({
          id: editingAccount?.id,
          bankName: bankName.trim(),
          accountName: accountName.trim(),
          accountNumber: accountNumber.trim(),
          ifscCode: ifscCode.trim().toUpperCase() || undefined,
          branchName: branchName.trim() || undefined,
          accountType,
          openingBalance: Number(bankOpeningBalance) || 0,
          openingBalanceDate: bankOpeningDate,
          overdraftLimit: (accountType === 'overdraft' || accountType === 'cash_credit') ? Number(overdraftLimit) || 0 : 0,
          upiId: upiId.trim() || undefined,
          isDefault: isDefaultBank
        });
      } else {
        if (!cashName.trim()) {
          setError('Cash account name is required.');
          return;
        }

        await onSaveCash({
          id: editingAccount?.id,
          name: cashName.trim(),
          accountType: cashType,
          openingBalance: Number(cashOpeningBalance) || 0,
          openingBalanceDate: cashOpeningDate,
          isDefault: isDefaultCash
        });
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save account');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 my-8 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-700 text-white shadow-md">
              {activeTab === 'bank' ? <Building2 className="w-5 h-5" /> : <Wallet className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                {editingAccount ? 'Edit Account' : 'Add New Cash / Bank Account'}
              </h2>
              <p className="text-xs text-slate-500">
                Manage your enterprise treasury and payment endpoints
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600:text-slate-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector (only for new accounts) */}
        {!editingAccount && (
          <div className="flex border-b border-slate-200 bg-slate-100/60 p-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('bank')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'bank' 
                  ? 'bg-white text-blue-700 shadow-sm' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-4 h-4" />
              Bank Account
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('cash')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'cash' 
                  ? 'bg-white text-blue-700 shadow-sm' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Wallet className="w-4 h-4" />
              Cash / Petty Cash Account
            </button>
          </div>
        )}

        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3 text-red-700 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {activeTab === 'bank' ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Bank Name *
                  </label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g., HDFC Bank, ICICI Bank"
                    required
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Account Holder Name *
                  </label>
                  <input
                    type="text"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="e.g., Acme Corp Ltd."
                    required
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Account Number *
                  </label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="e.g., 50200012345678"
                    required
                    className="w-full px-3 py-2 text-sm font-mono rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  {accountNumber && (
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Masked preview: {maskAccountNumber(accountNumber)}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Account Type
                  </label>
                  <select
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="current">Current Account</option>
                    <option value="savings">Savings Account</option>
                    <option value="overdraft">Bank Overdraft (OD)</option>
                    <option value="cash_credit">Cash Credit (CC)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    IFSC Code
                  </label>
                  <input
                    type="text"
                    value={ifscCode}
                    onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                    placeholder="e.g., HDFC0001234"
                    maxLength={11}
                    className="w-full px-3 py-2 text-sm font-mono uppercase rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Branch Name
                  </label>
                  <input
                    type="text"
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    placeholder="e.g., Connaught Place"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Opening Balance (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={bankOpeningBalance || ''}
                    onChange={(e) => setBankOpeningBalance(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    As Of Date
                  </label>
                  <input
                    type="date"
                    value={bankOpeningDate}
                    onChange={(e) => setBankOpeningDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                {(accountType === 'overdraft' || accountType === 'cash_credit') && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Overdraft Limit (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={overdraftLimit || ''}
                      onChange={(e) => setOverdraftLimit(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    UPI ID / VPA (Optional)
                  </label>
                  <input
                    type="text"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="e.g., acme@okaxis"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={isDefaultBank}
                      onChange={(e) => setIsDefaultBank(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-700 border-slate-300 focus:ring-blue-500"
                    />
                    <span>Set as Default Bank Account</span>
                  </label>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl flex items-center gap-2 text-xs text-slate-500">
                <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Security Notice: Invoice Pro never stores banking credentials, passwords, PINs, or OTPs.</span>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Cash Account Name *
                </label>
                <input
                  type="text"
                  value={cashName}
                  onChange={(e) => setCashName(e.target.value)}
                  placeholder="e.g., Main Cash Register, Office Petty Cash"
                  required
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Cash Account Category
                  </label>
                  <select
                    value={cashType}
                    onChange={(e) => setCashType(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="main_cash">Main Cash Account</option>
                    <option value="petty_cash">Petty Cash Account</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Opening Balance (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={cashOpeningBalance || ''}
                    onChange={(e) => setCashOpeningBalance(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    As Of Date
                  </label>
                  <input
                    type="date"
                    value={cashOpeningDate}
                    onChange={(e) => setCashOpeningDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={isDefaultCash}
                      onChange={(e) => setIsDefaultCash(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-700 border-slate-300 focus:ring-blue-500"
                    />
                    <span>Set as Primary Cash Account</span>
                  </label>
                </div>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
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
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-700 hover:bg-blue-700/90 disabled:opacity-50 transition-colors shadow-lg shadow-primary/20 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{editingAccount ? 'Update Account' : 'Create Account'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
