import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Check, AlertCircle, Building2, User, Wallet, FileText, 
  CreditCard, Calendar, Hash, ArrowUpRight, ShieldCheck, ChevronRight 
} from 'lucide-react';
import { Party, Invoice, Purchase } from '../../types';
import { BankAccount, CashAccount, PaymentCategory, PaymentVoucher } from '../../types/banking';
import { maskAccountNumber } from '../../services/banking/bankAccountService';
import { formatCurrency } from '../../utils/formatters';

interface PaymentOutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (paymentData: {
    voucherNumber: string;
    date: string;
    partyId?: string;
    partyName?: string;
    payeeType: 'supplier' | 'employee' | 'other';
    category: PaymentCategory;
    amount: number;
    paymentMode: 'cash' | 'bank_transfer' | 'cheque' | 'upi' | 'neft' | 'rtgs' | 'imps' | 'card' | 'other';
    sourceAccountId: string;
    sourceAccountType: 'bank' | 'cash';
    referenceNumber?: string;
    chequeDetails?: {
      chequeNumber: string;
      chequeDate: string;
      bankName: string;
    };
    allocations?: { invoiceId: string; invoiceNumber: string; amountAllocated: number }[];
    advanceAmount?: number;
    narration?: string;
    attachmentUrl?: string;
  }) => Promise<void>;
  suppliers: Party[];
  purchases: Purchase[];
  bankAccounts: BankAccount[];
  cashAccounts: CashAccount[];
  isDateLocked: (date: string) => boolean;
  initialSupplierId?: string;
}

export const PaymentOutModal: React.FC<PaymentOutModalProps> = ({
  isOpen,
  onClose,
  onSave,
  suppliers,
  purchases,
  bankAccounts,
  cashAccounts,
  isDateLocked,
  initialSupplierId
}) => {
  const [payeeType, setPayeeType] = useState<'supplier' | 'employee' | 'other'>('supplier');
  const [category, setCategory] = useState<PaymentCategory>('supplier_payment');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(initialSupplierId || '');
  const [customPayeeName, setCustomPayeeName] = useState<string>('');
  
  const [voucherNumber, setVoucherNumber] = useState(`PAY-${Date.now().toString().slice(-6)}`);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<'cash' | 'bank_transfer' | 'cheque' | 'upi' | 'neft' | 'rtgs' | 'imps' | 'card' | 'other'>('bank_transfer');
  
  const [selectedSourceId, setSelectedSourceId] = useState<string>('');
  const [referenceNumber, setReferenceNumber] = useState('');
  
  // Cheque Fields
  const [chequeNumber, setChequeNumber] = useState('');
  const [chequeDate, setChequeDate] = useState(new Date().toISOString().split('T')[0]);
  const [chequeBank, setChequeBank] = useState('');
  
  const [narration, setNarration] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bill Allocations
  const [allocations, setAllocations] = useState<{ [purchaseId: string]: number }>({});
  const [allocationMode, setAllocationMode] = useState<'fifo' | 'manual'>('fifo');

  // Set default source account
  useEffect(() => {
    if (!selectedSourceId) {
      if (paymentMode === 'cash' && cashAccounts.length > 0) {
        setSelectedSourceId(cashAccounts[0].id);
      } else if (bankAccounts.length > 0) {
        setSelectedSourceId(bankAccounts[0].id);
      }
    }
  }, [paymentMode, bankAccounts, cashAccounts]);

  useEffect(() => {
    if (initialSupplierId) {
      setSelectedSupplierId(initialSupplierId);
      setCategory('supplier_payment');
      setPayeeType('supplier');
    }
  }, [initialSupplierId]);

  // Unpaid purchases for selected supplier
  const unpaidPurchases = useMemo(() => {
    if (!selectedSupplierId || category !== 'supplier_payment') return [];
    return purchases.filter(p => {
      const matchSupplier = p.partyId === selectedSupplierId;
      const unpaid = p.balanceDue !== undefined ? p.balanceDue : ((p.grandTotal || 0) - (p.amountReceived || 0));
      return matchSupplier && unpaid > 0;
    });
  }, [purchases, selectedSupplierId, category]);

  // Auto-allocate FIFO
  useEffect(() => {
    if (allocationMode === 'fifo' && category === 'supplier_payment') {
      let remaining = Number(amount) || 0;
      const newAllocations: { [purchaseId: string]: number } = {};

      for (const pur of unpaidPurchases) {
        const balanceDue = pur.balanceDue !== undefined ? pur.balanceDue : ((pur.grandTotal || 0) - (pur.amountReceived || 0));
        if (remaining <= 0) {
          newAllocations[pur.id] = 0;
        } else if (remaining >= balanceDue) {
          newAllocations[pur.id] = balanceDue;
          remaining -= balanceDue;
        } else {
          newAllocations[pur.id] = remaining;
          remaining = 0;
        }
      }
      setAllocations(newAllocations);
    }
  }, [amount, unpaidPurchases, allocationMode, category]);

  const totalAllocated = useMemo(() => {
    return Object.values(allocations).reduce((sum, v) => sum + (Number(v) || 0), 0);
  }, [allocations]);

  const advanceAmount = useMemo(() => {
    if (category !== 'supplier_payment') return 0;
    const diff = (Number(amount) || 0) - totalAllocated;
    return diff > 0 ? diff : 0;
  }, [amount, totalAllocated, category]);

  const isLocked = isDateLocked(date);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isLocked) {
      setError(`Cannot create payment voucher in locked accounting period for date ${date}`);
      return;
    }

    if (amount <= 0) {
      setError('Payment amount must be greater than 0');
      return;
    }

    if (category === 'supplier_payment' && !selectedSupplierId) {
      setError('Please select a supplier');
      return;
    }

    if (category !== 'supplier_payment' && !customPayeeName.trim()) {
      setError('Please enter payee / description');
      return;
    }

    if (!selectedSourceId) {
      setError('Please select a paying cash or bank account');
      return;
    }

    if (paymentMode === 'cheque' && (!chequeNumber.trim() || !chequeBank.trim())) {
      setError('Cheque number and bank name are required for cheque payments');
      return;
    }

    const selectedBank = bankAccounts.find(b => b.id === selectedSourceId);
    const sourceAccountType = selectedBank ? 'bank' : 'cash';

    const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);

    const formattedAllocations = Object.entries(allocations)
      .filter(([_, allocAmt]) => allocAmt > 0)
      .map(([purId, allocAmt]) => {
        const pur = unpaidPurchases.find(p => p.id === purId);
        return {
          invoiceId: purId,
          invoiceNumber: pur?.invoiceNumber || pur?.id || 'BILL',
          amountAllocated: allocAmt
        };
      });

    try {
      setIsSubmitting(true);
      await onSave({
        voucherNumber,
        date,
        partyId: category === 'supplier_payment' ? selectedSupplierId : undefined,
        partyName: category === 'supplier_payment' ? selectedSupplier?.name : customPayeeName,
        payeeType,
        category,
        amount,
        paymentMode,
        sourceAccountId: selectedSourceId,
        sourceAccountType,
        referenceNumber: referenceNumber.trim() || undefined,
        chequeDetails: paymentMode === 'cheque' ? {
          chequeNumber: chequeNumber.trim(),
          chequeDate,
          bankName: chequeBank.trim()
        } : undefined,
        allocations: formattedAllocations,
        advanceAmount,
        narration: narration.trim() || undefined
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 my-8 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-rose-50 to-orange-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-600 text-white shadow-md shadow-rose-200">
              <ArrowUpRight className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Payment Out / Payment Voucher</h2>
              <p className="text-xs text-slate-500">Record supplier payments, business expenses, and fund outflows</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
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

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          
          {/* Top Row: Category & Basic Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Payment Category
              </label>
              <select
                value={category}
                onChange={(e) => {
                  const cat = e.target.value as PaymentCategory;
                  setCategory(cat);
                  if (cat === 'supplier_payment') setPayeeType('supplier');
                  else if (cat === 'expense_payment') setPayeeType('other');
                  else setPayeeType('other');
                }}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-rose-500 outline-none"
              >
                <option value="supplier_payment">Supplier Bill Settlement</option>
                <option value="expense_payment">Direct Business Expense</option>
                <option value="loan_repayment">Loan Repayment</option>
                <option value="advance_payment">Advance to Supplier</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Voucher Number
              </label>
              <div className="relative">
                <Hash className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={voucherNumber}
                  onChange={(e) => setVoucherNumber(e.target.value)}
                  required
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-rose-500 outline-none font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Payment Date
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
                  } text-slate-900 focus:ring-2 focus:ring-rose-500 outline-none`}
                />
              </div>
              {isLocked && <p className="text-[10px] text-red-500 mt-0.5">Period is locked</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Amount Paid (₹) *
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount || ''}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                required
                className="w-full px-3 py-2 text-sm font-bold text-rose-600 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-rose-500 outline-none"
              />
            </div>
          </div>

          {/* Payee Selection */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            {category === 'supplier_payment' || category === 'advance_payment' ? (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Select Supplier *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <select
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    required
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-rose-500 outline-none"
                  >
                    <option value="">-- Choose a Supplier --</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.phone ? `(${s.phone})` : ''} — Current Bal: {formatCurrency(s.currentBalance || s.outstandingBalance || 0)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Payee / Vendor Name / Beneficiary *
                </label>
                <input
                  type="text"
                  value={customPayeeName}
                  onChange={(e) => setCustomPayeeName(e.target.value)}
                  placeholder="e.g., Office Landlord, Electricity Board, Staff Name"
                  required
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-rose-500 outline-none"
                />
              </div>
            )}
          </div>

          {/* Payment Method & Source Account */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Payment Mode
              </label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as any)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-rose-500 outline-none"
              >
                <option value="bank_transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                <option value="upi">UPI / QR Code</option>
                <option value="cheque">Cheque</option>
                <option value="cash">Cash</option>
                <option value="card">Debit / Credit Card</option>
                <option value="other">Other Mode</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Paying Account (Cash / Bank) *
              </label>
              <select
                value={selectedSourceId}
                onChange={(e) => setSelectedSourceId(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-rose-500 outline-none"
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
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Txn / Reference No.
              </label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="UTR, UPI Ref, or slip no."
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-rose-500 outline-none"
              />
            </div>
          </div>

          {/* Cheque Details if paymentMode === 'cheque' */}
          {paymentMode === 'cheque' && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-amber-900 mb-1">
                  Cheque Number *
                </label>
                <input
                  type="text"
                  value={chequeNumber}
                  onChange={(e) => setChequeNumber(e.target.value)}
                  placeholder="e.g., 000452"
                  required
                  className="w-full px-3 py-2 text-sm font-mono rounded-xl border border-amber-300 bg-white text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-amber-900 mb-1">
                  Cheque Date *
                </label>
                <input
                  type="date"
                  value={chequeDate}
                  onChange={(e) => setChequeDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm rounded-xl border border-amber-300 bg-white text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-amber-900 mb-1">
                  Issuing Bank Name *
                </label>
                <input
                  type="text"
                  value={chequeBank}
                  onChange={(e) => setChequeBank(e.target.value)}
                  placeholder="e.g., HDFC Bank"
                  required
                  className="w-full px-3 py-2 text-sm rounded-xl border border-amber-300 bg-white text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
            </div>
          )}

          {/* Supplier Bill Settlement Table (if supplier_payment) */}
          {category === 'supplier_payment' && selectedSupplierId && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="p-3 bg-slate-50 flex items-center justify-between border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Unpaid Supplier Bills ({unpaidPurchases.length})
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">Allocation Mode:</span>
                  <button
                    type="button"
                    onClick={() => setAllocationMode('fifo')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                      allocationMode === 'fifo' ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    Auto (FIFO)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllocationMode('manual')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                      allocationMode === 'manual' ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    Manual
                  </button>
                </div>
              </div>

              {unpaidPurchases.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  No unpaid purchase bills found for this supplier. Full amount will be recorded as Advance Payment.
                </div>
              ) : (
                <div className="max-h-56 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100/60 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Bill Number</th>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5 text-right">Total Bill</th>
                        <th className="p-2.5 text-right">Balance Due</th>
                        <th className="p-2.5 text-right">Allocated (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {unpaidPurchases.map(pur => {
                        const due = pur.balanceDue !== undefined ? pur.balanceDue : ((pur.grandTotal || 0) - (pur.amountReceived || 0));
                        const allocated = allocations[pur.id] || 0;
                        return (
                          <tr key={pur.id} className="hover:bg-slate-50:bg-slate-800/40">
                            <td className="p-2.5 font-medium">{pur.invoiceNumber || pur.id}</td>
                            <td className="p-2.5 text-slate-500">{pur.date}</td>
                            <td className="p-2.5 text-right">{formatCurrency(pur.grandTotal || 0)}</td>
                            <td className="p-2.5 text-right font-medium text-amber-600">{formatCurrency(due)}</td>
                            <td className="p-2.5 text-right">
                              <input
                                type="number"
                                min="0"
                                max={due}
                                step="0.01"
                                disabled={allocationMode === 'fifo'}
                                value={allocated || ''}
                                onChange={(e) => {
                                  const val = Math.min(due, Math.max(0, parseFloat(e.target.value) || 0));
                                  setAllocations(prev => ({ ...prev, [pur.id]: val }));
                                }}
                                className="w-28 px-2 py-1 text-right text-xs rounded-lg border border-slate-300 bg-white text-slate-900 disabled:bg-slate-100:bg-slate-800/50"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Allocation Summary Bar */}
              <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-4">
                  <span>Total Allocated: <strong className="text-slate-900">{formatCurrency(totalAllocated)}</strong></span>
                  {advanceAmount > 0 && (
                    <span className="text-emerald-600 font-medium">
                      Advance / Unallocated: <strong>{formatCurrency(advanceAmount)}</strong>
                    </span>
                  )}
                </div>
                <div className="text-slate-400 text-[11px]">
                  Double-entry: Dr Accounts Payable, Cr Bank/Cash
                </div>
              </div>
            </div>
          )}

          {/* Narration */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Narration / Notes
            </label>
            <textarea
              rows={2}
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              placeholder="e.g. Paid supplier invoice in full via NEFT UTR #45920"
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-rose-500 outline-none resize-none"
            />
          </div>

          {/* Modal Actions */}
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
              disabled={isSubmitting || isLocked}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 transition-colors shadow-lg shadow-rose-200 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Recording...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Record Payment Voucher</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
