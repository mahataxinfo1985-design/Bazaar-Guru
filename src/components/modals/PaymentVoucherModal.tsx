import React, { useState } from 'react';
import { X, DollarSign, Calendar, FileText, CheckCircle2 } from 'lucide-react';
import { Party, Invoice, PaymentMode } from '../../types';
import { Account, PaymentVoucher, PaymentAllocation } from '../../types/accounting';
import { round2, safeSub } from '../../utils/decimal';

interface PaymentVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  parties: Party[];
  invoices: Invoice[];
  accounts: Account[];
  initialType?: 'payment_in' | 'payment_out';
  preselectedPartyId?: string;
  preselectedInvoiceId?: string;
  onSave: (voucher: PaymentVoucher) => void;
}

const PAYMENT_MODES: PaymentMode[] = ['Cash', 'UPI', 'NEFT', 'RTGS', 'IMPS', 'Cheque', 'Card'];

export default function PaymentVoucherModal({
  isOpen,
  onClose,
  parties,
  invoices,
  accounts,
  initialType = 'payment_in',
  preselectedPartyId,
  preselectedInvoiceId,
  onSave,
}: PaymentVoucherModalProps) {
  const [type, setType] = useState<'payment_in' | 'payment_out'>(initialType);
  const [partyId, setPartyId] = useState(preselectedPartyId || '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('Cash');
  const [accountId, setAccountId] = useState(
    accounts.find((a) => a.subtype === 'cash')?.id || 'acc_1010'
  );
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const relevantParties = parties.filter((p) =>
    type === 'payment_in' ? p.type === 'customer' : p.type === 'supplier'
  );

  // Unpaid invoices for this party
  const partyUnpaidInvoices = invoices.filter((inv) => {
    if (inv.partyId !== partyId || inv.deleted || inv.status === 'Cancelled') return false;
    const isSales = !inv.type.includes('Purchase') && inv.type !== 'Purchase Return';
    if (type === 'payment_in' && !isSales) return false;
    if (type === 'payment_out' && isSales) return false;
    return inv.balanceDue > 0.01;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyId) {
      setError('Please select a party.');
      return;
    }
    if (amount <= 0) {
      setError('Payment amount must be greater than zero.');
      return;
    }

    const selectedParty = parties.find((p) => p.id === partyId);
    let remainingToAllocate = amount;
    const allocations: PaymentAllocation[] = [];

    // Automatically allocate payment amount against oldest unpaid invoices first (FIFO)
    for (const inv of partyUnpaidInvoices) {
      if (remainingToAllocate <= 0) break;
      const allocAmt = Math.min(remainingToAllocate, inv.balanceDue);
      allocations.push({
        id: `alloc_${Date.now()}_${inv.id}`,
        voucherId: '',
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        amount: round2(allocAmt),
      });
      remainingToAllocate = safeSub(remainingToAllocate, allocAmt);
    }

    const voucherId = `pv_${Date.now()}`;
    allocations.forEach((a) => (a.voucherId = voucherId));

    const voucher: PaymentVoucher = {
      id: voucherId,
      voucherNumber: `${type === 'payment_in' ? 'REC' : 'PAY'}-${Date.now().toString().slice(-6)}`,
      type,
      partyId,
      partyName: selectedParty?.name || 'Party',
      date,
      paymentMode,
      accountId,
      amount: round2(amount),
      referenceNumber: referenceNumber.trim() || undefined,
      notes: notes.trim() || undefined,
      allocations,
      status: 'completed',
      createdAt: new Date().toISOString(),
    };

    onSave(voucher);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            <span className="font-bold text-sm tracking-wide text-slate-900">
              {type === 'payment_in' ? 'Record Customer Receipt (Payment In)' : 'Record Supplier Payment (Payment Out)'}
            </span>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-600 border border-red-100">
              {error}
            </div>
          )}

          {/* Type Toggle */}
          <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-lg text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setType('payment_in');
                setPartyId('');
              }}
              className={`py-2 rounded-md transition ${type === 'payment_in' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Payment In (From Customer)
            </button>
            <button
              type="button"
              onClick={() => {
                setType('payment_out');
                setPartyId('');
              }}
              className={`py-2 rounded-md transition ${type === 'payment_out' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Payment Out (To Supplier)
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Party Selection */}
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Select {type === 'payment_in' ? 'Customer' : 'Supplier'} <span className="text-red-500">*</span>
              </label>
              <select
                value={partyId}
                onChange={(e) => setPartyId(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden font-medium bg-white"
              >
                <option value="">-- Choose Party --</option>
                {relevantParties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (Balance: ₹{p.outstandingBalance || 0})
                  </option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Payment Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            {/* Amount */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Amount Received / Paid (₹) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={amount || ''}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900 font-mono focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            {/* Payment Mode */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Payment Mode</label>
              <select
                value={paymentMode}
                onChange={(e) => {
                  const m = e.target.value as PaymentMode;
                  setPaymentMode(m);
                  if (m === 'Cash') {
                    const c = accounts.find((a) => a.subtype === 'cash');
                    if (c) setAccountId(c.id);
                  } else {
                    const b = accounts.find((a) => a.subtype === 'bank');
                    if (b) setAccountId(b.id);
                  }
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden bg-white"
              >
                {PAYMENT_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Deposit/Disbursed Account */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                {type === 'payment_in' ? 'Deposit Into Account' : 'Paid From Account'}
              </label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden bg-white font-medium"
              >
                {accounts
                  .filter((a) => a.subtype === 'cash' || a.subtype === 'bank')
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.code})
                    </option>
                  ))}
              </select>
            </div>

            {/* Ref Number */}
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Reference / UTR / Cheque No.
              </label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="e.g. UPI-123456789 or Cheque #004312"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden font-mono"
              />
            </div>

            {/* Notes */}
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Notes / Narration</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional payment notes"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Pending Invoices for Allocation Preview */}
          {partyId && partyUnpaidInvoices.length > 0 && (
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Unpaid Invoices Allocation (Auto-FIFO)</span>
                <span className="text-[10px] font-bold text-blue-600">{partyUnpaidInvoices.length} Pending</span>
              </div>
              <div className="space-y-1.5 max-h-32 overflow-y-auto bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                {partyUnpaidInvoices.map((inv) => (
                  <div key={inv.id} className="flex justify-between items-center text-xs">
                    <div>
                      <span className="font-bold text-slate-800">{inv.invoiceNumber}</span>
                      <span className="text-[10px] text-slate-400 ml-2">Due: {inv.dueDate}</span>
                    </div>
                    <span className="font-mono font-bold text-red-600">Due: ₹{inv.balanceDue.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition"
            >
              Confirm & Post Entry
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
