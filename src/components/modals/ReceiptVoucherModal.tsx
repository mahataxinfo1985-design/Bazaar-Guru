import React, { useState, useEffect } from 'react';
import { X, Receipt, Calendar, CreditCard, Layers, ShieldCheck, AlertCircle } from 'lucide-react';
import { Party, Invoice, PaymentMode } from '../../types';
import { Account, PaymentVoucher, PaymentAllocation } from '../../types/accounting';
import { BankAccount, CashAccount } from '../../types/banking';
import { round2, safeAdd, safeSub } from '../../utils/decimal';

export interface ReceiptVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  parties?: Party[];
  customers?: Party[];
  invoices: Invoice[];
  accounts?: Account[];
  bankAccounts: BankAccount[];
  cashAccounts: CashAccount[];
  preselectedPartyId?: string;
  preselectedInvoiceId?: string;
  isDateLocked?: (d: any) => boolean;
  onSave: (voucher: any) => void | Promise<void>;
}

const PAYMENT_MODES: PaymentMode[] = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'NEFT', 'RTGS', 'IMPS', 'Card'];

export function ReceiptVoucherModal({
  isOpen,
  onClose,
  parties,
  customers,
  invoices,
  accounts = [],
  bankAccounts,
  cashAccounts,
  preselectedPartyId,
  preselectedInvoiceId,
  isDateLocked,
  onSave,
}: ReceiptVoucherModalProps) {
  const partyList = parties || customers || [];
  const [partyId, setPartyId] = useState(preselectedPartyId || '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('Bank Transfer');
  const [accountId, setAccountId] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [chequeNumber, setChequeNumber] = useState('');
  const [chequeDate, setChequeDate] = useState(new Date().toISOString().split('T')[0]);
  const [chequeBank, setChequeBank] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  // Manual allocation table state: invoiceId -> allocated amount
  const [allocationsMap, setAllocationsMap] = useState<Record<string, number>>({});
  const [autoFifo, setAutoFifo] = useState(true);

  // Default account initialization
  useEffect(() => {
    if (paymentMode === 'Cash') {
      const defaultCash = cashAccounts.find(c => c.isDefault) || cashAccounts[0];
      setAccountId(defaultCash ? defaultCash.linkedAccountId : 'acc_1010');
    } else {
      const defaultBank = bankAccounts.find(b => b.isDefault) || bankAccounts[0];
      setAccountId(defaultBank ? defaultBank.linkedAccountId : 'acc_1020');
    }
  }, [paymentMode, bankAccounts, cashAccounts]);

  // Unpaid sales invoices for selected customer
  const unpaidInvoices = invoices.filter((inv) => {
    if (inv.partyId !== partyId || inv.deleted || inv.status === 'Cancelled') return false;
    const isSales = !inv.type.includes('Purchase') && inv.type !== 'Purchase Return';
    return isSales && (inv.balanceDue || 0) > 0.01;
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Auto FIFO calculation when amount or party changes and autoFifo is enabled
  useEffect(() => {
    if (!autoFifo) return;
    let remaining = amount;
    const newMap: Record<string, number> = {};

    for (const inv of unpaidInvoices) {
      if (remaining <= 0) break;
      const alloc = Math.min(remaining, inv.balanceDue);
      newMap[inv.id] = round2(alloc);
      remaining = safeSub(remaining, alloc);
    }
    setAllocationsMap(newMap);
  }, [amount, partyId, autoFifo, unpaidInvoices.length]);

  if (!isOpen) return null;

  const customerList = partyList.filter((p) => p.type?.toLowerCase() === 'customer');
  const selectedCustomer = partyList.find((p) => p.id === partyId);

  const totalAllocated = Object.values(allocationsMap).reduce((sum, a) => safeAdd(sum, a || 0), 0);
  const unallocatedAmount = round2(Math.max(0, safeSub(amount, totalAllocated)));

  const handleManualAllocationChange = (invId: string, val: number, maxDue: number) => {
    setAutoFifo(false);
    const clamped = Math.max(0, Math.min(val, maxDue));
    setAllocationsMap((prev) => ({
      ...prev,
      [invId]: round2(clamped)
    }));
  };

  const handleApplyFullDue = (inv: Invoice) => {
    setAutoFifo(false);
    setAllocationsMap((prev) => ({
      ...prev,
      [inv.id]: inv.balanceDue
    }));
    // If current amount is less than total allocated, bump amount
    const otherAlloc = Object.entries(allocationsMap)
      .filter(([id]) => id !== inv.id)
      .reduce((sum, [, a]) => safeAdd(sum, a || 0), 0);
    const needed = safeAdd(otherAlloc, inv.balanceDue);
    if (amount < needed) setAmount(needed);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyId) {
      setError('Please select a customer.');
      return;
    }
    if (amount <= 0) {
      setError('Receipt amount must be greater than zero.');
      return;
    }

    if (totalAllocated > safeAdd(amount, 0.01)) {
      setError(`Allocated total (₹${totalAllocated.toFixed(2)}) cannot exceed receipt amount (₹${amount.toFixed(2)}).`);
      return;
    }

    const allocations: PaymentAllocation[] = Object.entries(allocationsMap)
      .filter(([, allocAmt]) => (allocAmt || 0) > 0)
      .map(([invId, allocAmt]) => {
        const inv = unpaidInvoices.find((i) => i.id === invId);
        return {
          id: `alloc_${Date.now()}_${invId}`,
          voucherId: '',
          invoiceId: invId,
          invoiceNumber: inv?.invoiceNumber || '',
          amount: round2(allocAmt)
        };
      });

    const voucherId = `rec_${Date.now()}`;
    allocations.forEach((a) => (a.voucherId = voucherId));

    const voucher: PaymentVoucher = {
      id: voucherId,
      voucherNumber: `REC-${Date.now().toString().slice(-6)}`,
      type: 'payment_in',
      category: 'customer_receipt',
      partyId,
      partyName: selectedCustomer?.name || 'Customer',
      payeeType: 'customer',
      date,
      paymentMode,
      accountId,
      amount: round2(amount),
      unallocatedAmount,
      advanceAmount: unallocatedAmount > 0 ? unallocatedAmount : undefined,
      referenceNumber: referenceNumber.trim() || undefined,
      chequeDetails: paymentMode === 'Cheque' ? {
        chequeNumber: chequeNumber.trim(),
        chequeDate,
        bankName: chequeBank.trim(),
        clearingStatus: 'pending_clearance'
      } : undefined,
      notes: notes.trim() || undefined,
      allocations,
      status: 'completed',
      createdAt: new Date().toISOString()
    };

    onSave(voucher);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex h-14 items-center justify-between border-b border-slate-100 bg-slate-900 px-6 text-white shrink-0">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-400" />
            <span className="font-bold text-sm tracking-wide">Record Customer Receipt (Payment In)</span>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-600 border border-red-100 flex items-center gap-2">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Customer */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Customer *</label>
              <select
                value={partyId}
                onChange={(e) => {
                  setPartyId(e.target.value);
                  setAllocationsMap({});
                }}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                required
              >
                <option value="">-- Select Customer --</option>
                {customerList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.outstandingBalance > 0 ? `(Due: ₹${c.outstandingBalance.toFixed(2)})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Receipt Date *</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Amount Received (₹) *</label>
              <input
                type="number"
                step="any"
                min="0.01"
                value={amount || ''}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            {/* Payment Mode */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Payment Method *</label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {PAYMENT_MODES.map((mode) => (
                  <option key={mode} value={mode}>{mode}</option>
                ))}
              </select>
            </div>

            {/* Destination Account */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Deposit To (Cash / Bank) *</label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <optgroup label="Bank Accounts">
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.linkedAccountId}>
                      {b.bankName} - {b.accountName} (•••• {b.accountNumber.slice(-4)})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Cash Registers">
                  {cashAccounts.map((c) => (
                    <option key={c.id} value={c.linkedAccountId}>
                      {c.accountName}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Reference Number */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Transaction Ref / UTR</label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="e.g. UTR12345678, UPI Ref"
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Cheque Specific Fields */}
          {paymentMode === 'Cheque' && (
            <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-lg space-y-3">
              <span className="text-xs font-bold text-amber-900 uppercase tracking-wider block">Cheque Details</span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Cheque Number *</label>
                  <input
                    type="text"
                    value={chequeNumber}
                    onChange={(e) => setChequeNumber(e.target.value)}
                    placeholder="e.g. 000452"
                    className="w-full h-9 px-2 rounded border border-slate-200 text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Cheque Date *</label>
                  <input
                    type="date"
                    value={chequeDate}
                    onChange={(e) => setChequeDate(e.target.value)}
                    className="w-full h-9 px-2 rounded border border-slate-200 text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Issuing Bank</label>
                  <input
                    type="text"
                    value={chequeBank}
                    onChange={(e) => setChequeBank(e.target.value)}
                    placeholder="e.g. State Bank of India"
                    className="w-full h-9 px-2 rounded border border-slate-200 text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Invoice Allocation Section */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Layers size={15} className="text-blue-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Invoice Settlement & Allocation</span>
              </div>
              <button
                type="button"
                onClick={() => setAutoFifo(!autoFifo)}
                className={`text-[11px] font-semibold px-2 py-0.5 rounded border transition-colors ${
                  autoFifo ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                {autoFifo ? 'FIFO Auto-Allocating' : 'Manual Allocation'}
              </button>
            </div>

            {unpaidInvoices.length === 0 ? (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 text-center">
                No unpaid invoices found for this customer. Any receipt amount will be recorded as an <strong>Advance Payment</strong> on account.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Invoice No</th>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3 text-right">Total</th>
                      <th className="py-2 px-3 text-right">Balance Due</th>
                      <th className="py-2 px-3 text-right w-36">Allocated (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {unpaidInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 font-semibold text-slate-800">{inv.invoiceNumber}</td>
                        <td className="py-2 px-3 text-slate-500">{inv.date}</td>
                        <td className="py-2 px-3 text-right text-slate-600">₹{inv.grandTotal.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right font-medium text-amber-600">₹{inv.balanceDue.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleApplyFullDue(inv)}
                              className="text-[10px] text-blue-600 hover:underline"
                              title="Set full due amount"
                            >
                              Max
                            </button>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              max={inv.balanceDue}
                              value={allocationsMap[inv.id] !== undefined ? allocationsMap[inv.id] : ''}
                              onChange={(e) => handleManualAllocationChange(inv.id, parseFloat(e.target.value) || 0, inv.balanceDue)}
                              placeholder="0.00"
                              className="w-24 h-7 px-2 text-right border border-slate-200 rounded text-xs focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Allocation summary strip */}
            <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg mt-2 text-xs">
              <span className="text-slate-600">Total Allocated: <strong className="text-slate-900">₹{totalAllocated.toFixed(2)}</strong></span>
              {unallocatedAmount > 0 && (
                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                  <ShieldCheck size={14} />
                  Advance Balance: ₹{unallocatedAmount.toFixed(2)}
                </span>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Narration / Internal Remarks</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Received via NEFT towards outstanding settlement"
              className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm flex items-center gap-1.5"
            >
              <Receipt size={14} />
              <span>Post Receipt Voucher</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ReceiptVoucherModal;
