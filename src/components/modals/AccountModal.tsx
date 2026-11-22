import React, { useState, useEffect } from 'react';
import { X, BookOpen, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Account, AccountType, AccountSubtype, JournalEntry } from '../../types/accounting';
import { canDeleteAccount } from '../../services/accounting/chartOfAccounts';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (account: Account) => void;
  onDeactivate?: (accountId: string) => void;
  accountToEdit?: Account | null;
  existingAccounts: Account[];
  journalEntries: JournalEntry[];
}

const ACCOUNT_CATEGORIES: { type: AccountType; label: string }[] = [
  { type: 'asset', label: '1. Asset' },
  { type: 'liability', label: '2. Liability' },
  { type: 'equity', label: '3. Equity' },
  { type: 'income', label: '4. Income' },
  { type: 'expense', label: '5. Expense' },
];

const SUBTYPES_BY_TYPE: Record<AccountType, { subtype: AccountSubtype; label: string }[]> = {
  asset: [
    { subtype: 'cash', label: 'Cash in Hand' },
    { subtype: 'bank', label: 'Bank Account' },
    { subtype: 'accounts_receivable', label: 'Accounts Receivable (Debtors)' },
    { subtype: 'inventory', label: 'Inventory / Stock' },
    { subtype: 'fixed_assets', label: 'Fixed Assets' },
    { subtype: 'tax_credit', label: 'Input Tax Credit (GST)' },
    { subtype: 'other_current_assets', label: 'Other Current Assets' },
  ],
  liability: [
    { subtype: 'accounts_payable', label: 'Accounts Payable (Creditors)' },
    { subtype: 'loans', label: 'Loans & Borrowings' },
    { subtype: 'tax_payable', label: 'Output Tax Liabilities (GST)' },
    { subtype: 'other_current_liabilities', label: 'Other Current Liabilities' },
  ],
  equity: [
    { subtype: 'equity', label: "Owner's Capital" },
    { subtype: 'drawings', label: 'Drawings' },
    { subtype: 'retained_earnings', label: 'Retained Earnings' },
  ],
  income: [
    { subtype: 'sales', label: 'Sales Revenue' },
    { subtype: 'other_income', label: 'Other Operating Income' },
    { subtype: 'sales_returns', label: 'Sales Returns (Contra-Income)' },
    { subtype: 'discounts_received', label: 'Discounts Received' },
  ],
  expense: [
    { subtype: 'cogs', label: 'Cost of Goods Sold' },
    { subtype: 'purchases', label: 'Purchase Expense' },
    { subtype: 'purchase_returns', label: 'Purchase Returns (Contra-Expense)' },
    { subtype: 'rent', label: 'Rent Expense' },
    { subtype: 'salary', label: 'Salary & Wages' },
    { subtype: 'electricity', label: 'Electricity & Utilities' },
    { subtype: 'transportation', label: 'Transportation & Freight' },
    { subtype: 'advertising', label: 'Advertising & Marketing' },
    { subtype: 'office_expense', label: 'Office & Admin Expenses' },
    { subtype: 'discounts_allowed', label: 'Discounts Allowed' },
    { subtype: 'round_off', label: 'Round Off Differences' },
    { subtype: 'other_expense', label: 'Other Operating Expenses' },
  ],
};

export default function AccountModal({
  isOpen,
  onClose,
  onSave,
  onDeactivate,
  accountToEdit,
  existingAccounts,
  journalEntries,
}: AccountModalProps) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('asset');
  const [subtype, setSubtype] = useState<AccountSubtype>('bank');
  const [parentId, setParentId] = useState('');
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [openingBalanceType, setOpeningBalanceType] = useState<'debit' | 'credit'>('debit');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (accountToEdit) {
      setCode(accountToEdit.code);
      setName(accountToEdit.name);
      setType(accountToEdit.type);
      setSubtype(accountToEdit.subtype);
      setParentId(accountToEdit.parentId || '');
      setOpeningBalance(accountToEdit.openingBalance || 0);
      setOpeningBalanceType(accountToEdit.openingBalanceType || (accountToEdit.type === 'asset' || accountToEdit.type === 'expense' ? 'debit' : 'credit'));
      setDescription(accountToEdit.description || '');
      setIsActive(accountToEdit.isActive);
    } else {
      setCode('');
      setName('');
      setType('asset');
      setSubtype('bank');
      setParentId('');
      setOpeningBalance(0);
      setOpeningBalanceType('debit');
      setDescription('');
      setIsActive(true);
    }
    setError(null);
  }, [accountToEdit, isOpen]);

  if (!isOpen) return null;

  const handleTypeChange = (newType: AccountType) => {
    setType(newType);
    const available = SUBTYPES_BY_TYPE[newType];
    if (available && available.length > 0) {
      setSubtype(available[0].subtype);
    }
    setOpeningBalanceType(newType === 'asset' || newType === 'expense' ? 'debit' : 'credit');
    setParentId('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return setError('Account code is required (e.g. 1030).');
    if (!name.trim()) return setError('Account name is required.');

    // Check duplicate code if new
    if (!accountToEdit) {
      const exists = existingAccounts.some((a) => a.code.trim().toLowerCase() === code.trim().toLowerCase());
      if (exists) return setError(`Account code '${code}' already exists.`);
    }

    const payload: Account = {
      id: accountToEdit?.id || `acc_${code.trim()}`,
      businessId: accountToEdit?.businessId,
      code: code.trim(),
      name: name.trim(),
      type,
      subtype,
      parentId: parentId || undefined,
      description: description.trim() || undefined,
      openingBalance: Number(openingBalance) || 0,
      openingBalanceType,
      currentBalance: accountToEdit?.currentBalance || Number(openingBalance) || 0,
      isSystem: accountToEdit?.isSystem || false,
      isActive,
      createdAt: accountToEdit?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSave(payload);
  };

  const candidateParents = existingAccounts.filter((a) => a.type === type && a.id !== accountToEdit?.id);
  const deleteSafety = accountToEdit ? canDeleteAccount(accountToEdit.id, journalEntries) : { allowed: true };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6 shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-blue-700" />
            <span className="text-sm font-bold tracking-wide uppercase text-slate-900">
              {accountToEdit ? 'Edit Account Master' : 'Create New Account in Chart of Accounts'}
            </span>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200 flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Row 1: Category & Subtype */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Account Category <span className="text-red-500">*</span>
              </label>
              <select
                value={type}
                onChange={(e) => handleTypeChange(e.target.value as AccountType)}
                disabled={accountToEdit?.isSystem}
                className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-hidden disabled:bg-slate-100"
              >
                {ACCOUNT_CATEGORIES.map((c) => (
                  <option key={c.type} value={c.type}>{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Subtype Classification <span className="text-red-500">*</span>
              </label>
              <select
                value={subtype}
                onChange={(e) => setSubtype(e.target.value as AccountSubtype)}
                disabled={accountToEdit?.isSystem}
                className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-hidden disabled:bg-slate-100"
              >
                {(SUBTYPES_BY_TYPE[type] || []).map((s) => (
                  <option key={s.subtype} value={s.subtype}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Code & Name */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Account Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 1025"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={accountToEdit?.isSystem}
                className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 font-mono font-bold focus:border-blue-500 focus:outline-hidden disabled:bg-slate-100"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Account Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. HDFC Current Account - 9876"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Row 3: Parent Account (Hierarchy) */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Parent Group / Account (Optional)
            </label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-hidden"
            >
              <option value="">-- Top-Level Account Group --</option>
              {candidateParents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} - {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Row 4: Opening Balance & Normal Direction */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Opening Balance (₹)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={openingBalance || ''}
                onChange={(e) => setOpeningBalance(Number(e.target.value))}
                placeholder="0.00"
                className="block w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 font-mono focus:border-blue-500 focus:outline-hidden bg-white"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Balance Type
              </label>
              <select
                value={openingBalanceType}
                onChange={(e) => setOpeningBalanceType(e.target.value as 'debit' | 'credit')}
                className="block w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 font-bold focus:border-blue-500 focus:outline-hidden bg-white uppercase"
              >
                <option value="debit">Dr (Debit)</option>
                <option value="credit">Cr (Credit)</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Description / Audit Notes
            </label>
            <input
              type="text"
              placeholder="e.g. Operating primary bank account for vendor payouts"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-hidden"
            />
          </div>

          {/* Active Status */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div>
              <p className="text-xs font-bold text-slate-800">Account Active Status</p>
              <p className="text-[11px] text-slate-500">
                Inactive accounts cannot receive new journal postings but retain all historical reports.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Deletion protection alert if editing account with transactions */}
          {accountToEdit && !deleteSafety.allowed && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px] flex gap-2 items-start">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{deleteSafety.reason}</span>
            </div>
          )}
        </form>

        {/* Footer Actions */}
        <div className="flex h-16 items-center justify-between border-t border-slate-200 bg-slate-50 px-6 shrink-0">
          <div>
            {accountToEdit && !accountToEdit.isSystem && (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Deactivate account ${accountToEdit.name}? It will no longer appear in transaction selectors.`)) {
                    setIsActive(false);
                    onDeactivate?.(accountToEdit.id);
                    onClose();
                  }
                }}
                className="text-xs font-bold text-amber-600 hover:text-amber-800 cursor-pointer"
              >
                Deactivate Account
              </button>
            )}
          </div>

          <div className="flex gap-2">
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
              className="rounded-lg bg-[#E0771A] hover:bg-[#B85D0F] px-5 py-2 text-xs font-semibold text-white transition cursor-pointer shadow-2xs"
            >
              Save Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
