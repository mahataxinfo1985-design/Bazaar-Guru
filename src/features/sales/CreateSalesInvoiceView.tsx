import React, { useState, useEffect } from 'react';
import { Plus, Trash2, ArrowLeft, Save, FileCheck, CheckCircle2 } from 'lucide-react';
import { Invoice, InvoiceItem, Party, Item, BusinessProfile, InvoiceType, PaymentMode, InvoiceStatus } from '../../types';
import { calculateInvoiceTotals, INDIAN_STATES } from '../../utils/gstEngine';
import { round2, safeSub } from '../../utils/decimal';

interface CreateSalesInvoiceViewProps {
  businessProfile: BusinessProfile;
  parties: Party[];
  items: Item[];
  editingInvoice?: Invoice | null;
  onSave: (invoice: Invoice, status: InvoiceStatus) => void;
  onCancel: () => void;
  onOpenPartyModal: () => void;
  onOpenItemModal: () => void;
}

export default function CreateSalesInvoiceView({
  businessProfile,
  parties,
  items,
  editingInvoice,
  onSave,
  onCancel,
  onOpenPartyModal,
  onOpenItemModal,
}: CreateSalesInvoiceViewProps) {
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('Tax Invoice');
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${Date.now().toString().slice(-6)}`);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0]);
  const [partyId, setPartyId] = useState('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('Cash');
  const [amountReceived, setAmountReceived] = useState<number>(0);
  const [invoiceLevelDiscount, setInvoiceLevelDiscount] = useState<number>(0);
  const [cessRate, setCessRate] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState(businessProfile.termsTemplate || '');

  // Line items state
  const [billItems, setBillItems] = useState<
    Omit<InvoiceItem, 'taxableValue' | 'cgst' | 'sgst' | 'igst' | 'total'>[]
  >([]);

  useEffect(() => {
    if (editingInvoice) {
      setInvoiceType(editingInvoice.type);
      setInvoiceNumber(editingInvoice.invoiceNumber);
      setReferenceNumber(editingInvoice.referenceNumber || '');
      setInvoiceDate(editingInvoice.date);
      setDueDate(editingInvoice.dueDate);
      setPartyId(editingInvoice.partyId);
      setPaymentMode(editingInvoice.paymentMode);
      setAmountReceived(editingInvoice.amountReceived);
      setNotes(editingInvoice.notes || '');
      setTerms(editingInvoice.terms || '');
      setBillItems(
        editingInvoice.items.map((it) => ({
          id: it.id,
          itemId: it.itemId,
          name: it.name,
          hsnCode: it.hsnCode,
          qty: it.qty,
          unit: it.unit,
          unitPrice: it.unitPrice,
          mrp: it.mrp,
          discount: it.discount,
          discountType: it.discountType,
          gstRate: it.gstRate,
        }))
      );
    }
  }, [editingInvoice]);

  const selectedParty = parties.find((p) => p.id === partyId);
  const partyState = selectedParty?.state || businessProfile.state;

  // Real-time GST calculation
  const calculationResults = calculateInvoiceTotals(
    billItems,
    businessProfile.state,
    partyState,
    cessRate,
    true
  );

  const balanceDue = Math.max(0, safeSub(calculationResults.grandTotal, amountReceived));

  const handleAddLineItem = (itemId: string) => {
    const it = items.find((i) => i.id === itemId);
    if (!it) return;

    const existingIdx = billItems.findIndex((bi) => bi.itemId === itemId);
    if (existingIdx > -1) {
      const updated = [...billItems];
      updated[existingIdx].qty += 1;
      setBillItems(updated);
    } else {
      setBillItems([
        ...billItems,
        {
          id: `li_${Date.now()}_${it.id}`,
          itemId: it.id,
          name: it.name,
          hsnCode: it.hsnCode,
          qty: 1,
          unit: it.unit,
          unitPrice: it.unitPrice,
          mrp: it.mrp,
          discount: 0,
          discountType: 'percentage',
          gstRate: it.gstRate,
        },
      ]);
    }
  };

  const handleRemoveLineItem = (id: string) => {
    setBillItems(billItems.filter((bi) => bi.id !== id));
  };

  const handleUpdateLineItem = (id: string, property: string, value: any) => {
    setBillItems(
      billItems.map((item) => {
        if (item.id === id) {
          return { ...item, [property]: value };
        }
        return item;
      })
    );
  };

  const handleSave = (status: InvoiceStatus) => {
    if (!partyId) {
      alert('Please select a Customer first!');
      return;
    }
    if (billItems.length === 0) {
      alert('Please add at least one line item.');
      return;
    }

    let paymentStatus: 'Paid' | 'Partial' | 'Unpaid' = 'Unpaid';
    if (amountReceived >= calculationResults.grandTotal) {
      paymentStatus = 'Paid';
    } else if (amountReceived > 0) {
      paymentStatus = 'Partial';
    }

    const payload: Invoice = {
      id: editingInvoice?.id || `inv_${Date.now()}`,
      invoiceNumber,
      referenceNumber: referenceNumber.trim() || undefined,
      type: invoiceType,
      date: invoiceDate,
      dueDate,
      partyId,
      partyType: 'customer',
      items: calculationResults.items,
      subtotal: calculationResults.subtotal,
      discount: calculationResults.discount,
      taxableAmount: calculationResults.taxableAmount,
      cgst: calculationResults.cgst,
      sgst: calculationResults.sgst,
      igst: calculationResults.igst,
      cess: cessRate > 0 ? (calculationResults.taxableAmount * cessRate) / 100 : 0,
      roundOff: calculationResults.roundOff,
      grandTotal: calculationResults.grandTotal,
      amountInWords: calculationResults.amountInWords,
      paymentMode,
      amountReceived: status === 'Draft' ? 0 : amountReceived,
      balanceDue: status === 'Draft' ? calculationResults.grandTotal : balanceDue,
      paymentStatus: status === 'Draft' ? 'Unpaid' : paymentStatus,
      notes: notes.trim() || undefined,
      terms: terms.trim() || undefined,
      status,
      createdAt: editingInvoice?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      auditTrail: [
        ...(editingInvoice?.auditTrail || []),
        {
          timestamp: new Date().toISOString(),
          action: editingInvoice ? `Invoice Edited (${status})` : `Invoice Created (${status})`,
          user: businessProfile.email,
        },
      ],
    };

    onSave(payload, status);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              {editingInvoice ? `Edit Invoice: ${editingInvoice.invoiceNumber}` : 'Create New Sales Document'}
            </h2>
            <p className="text-xs text-slate-500">GST-compliant tax invoicing with automated ledger postings.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSave('Draft')}
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          >
            Save as Draft
          </button>
          <button
            onClick={() => handleSave('Active')}
            className="flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-blue-800 transition cursor-pointer"
          >
            <Save size={14} />
            <span>Generate & Finalize Invoice</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Form Left, Summary Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Form Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Document Metadata Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">Invoice Particulars</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-medium">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Doc Type</label>
                <select
                  value={invoiceType}
                  onChange={(e) => setInvoiceType(e.target.value as any)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden bg-white"
                >
                  <option value="Tax Invoice">Tax Invoice</option>
                  <option value="Non-GST Invoice">Non-GST Invoice</option>
                  <option value="Bill of Supply">Bill of Supply</option>
                  <option value="Proforma Invoice">Proforma Invoice</option>
                  <option value="Credit Note">Credit Note</option>
                  <option value="Debit Note">Debit Note</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Invoice Number</label>
                <input
                  type="text"
                  required
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono font-bold focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">PO / Ref Number</label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="Optional reference"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Invoice Date</label>
                <input
                  type="date"
                  required
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Due Date</label>
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Payment Mode</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value as any)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden bg-white"
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank">Bank Transfer (NEFT/RTGS)</option>
                  <option value="Card">Card</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Credit">Credit (Unpaid)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Customer Selection Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="font-bold text-sm text-slate-900">Customer Details</h3>
              <button
                type="button"
                onClick={onOpenPartyModal}
                className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus size={14} /> Add New Customer
              </button>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Select Customer <span className="text-red-500">*</span>
              </label>
              <select
                value={partyId}
                onChange={(e) => setPartyId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium focus:border-blue-500 focus:outline-hidden bg-white"
              >
                <option value="">-- Choose Registered Customer --</option>
                {parties
                  .filter((p) => p.type === 'customer')
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.gstin ? `(${p.gstin})` : '(Unregistered)'} - {p.state}
                    </option>
                  ))}
              </select>

              {selectedParty && (
                <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div>
                    <span className="font-bold text-slate-700">Billing Address: </span>
                    {selectedParty.billingAddress}
                  </div>
                  <div>
                    <span className="font-bold text-slate-700">GSTIN: </span>
                    <span className="font-mono">{selectedParty.gstin || 'Unregistered'}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-700">Place of Supply: </span>
                    {selectedParty.state} (
                    {selectedParty.state.toLowerCase() === businessProfile.state.toLowerCase()
                      ? 'Intrastate CGST+SGST'
                      : 'Interstate IGST'}
                    )
                  </div>
                  <div>
                    <span className="font-bold text-slate-700">Current Outstanding: </span>
                    <span className="font-mono font-bold text-slate-900">
                      ₹{selectedParty.outstandingBalance || 0}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Line Items Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="font-bold text-sm text-slate-900">Invoice Items</h3>
              <button
                type="button"
                onClick={onOpenItemModal}
                className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus size={14} /> Add Product Master
              </button>
            </div>

            {/* Quick Add Dropdown */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Select Item from Catalog to Add
              </label>
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) handleAddLineItem(e.target.value);
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium focus:border-blue-500 focus:outline-hidden bg-white"
              >
                <option value="">-- Choose item to add line --</option>
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name} (HSN: {it.hsnCode} | ₹{it.unitPrice} | Stock: {it.stockQty})
                  </option>
                ))}
              </select>
            </div>

            {/* Line Items List */}
            <div className="space-y-3">
              {billItems.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                  No line items added. Choose an item from the dropdown above.
                </div>
              ) : (
                billItems.map((item, idx) => (
                  <div key={item.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-900">
                        #{idx + 1}. {item.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveLineItem(item.id)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      <div>
                        <label className="block text-[9px] uppercase font-bold text-slate-400">Qty</label>
                        <input
                          type="number"
                          min="1"
                          value={item.qty}
                          onChange={(e) => handleUpdateLineItem(item.id, 'qty', parseFloat(e.target.value) || 0)}
                          className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase font-bold text-slate-400">Rate (₹)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) =>
                            handleUpdateLineItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)
                          }
                          className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase font-bold text-slate-400">Discount (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={item.discount}
                          onChange={(e) =>
                            handleUpdateLineItem(item.id, 'discount', parseFloat(e.target.value) || 0)
                          }
                          className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase font-bold text-slate-400">GST %</label>
                        <select
                          value={item.gstRate}
                          onChange={(e) =>
                            handleUpdateLineItem(item.id, 'gstRate', parseFloat(e.target.value) || 0)
                          }
                          className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                        >
                          <option value="0">0%</option>
                          <option value="5">5%</option>
                          <option value="12">12%</option>
                          <option value="18">18%</option>
                          <option value="28">28%</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase font-bold text-slate-400 text-right">Line Total</label>
                        <div className="pt-1 text-right font-mono font-bold text-slate-900">
                          ₹{((item.qty * item.unitPrice) * (1 - item.discount / 100) * (1 + item.gstRate / 100)).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Summary & Payment Allocation */}
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">Calculation Summary</h3>

            <div className="space-y-2 text-xs font-medium text-slate-600">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-mono text-slate-900">₹{calculationResults.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-red-600">
                <span>Total Discount:</span>
                <span className="font-mono">-₹{calculationResults.discount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-100">
                <span>Taxable Amount:</span>
                <span className="font-mono font-bold text-slate-900">₹{calculationResults.taxableAmount.toFixed(2)}</span>
              </div>

              {calculationResults.cgst > 0 && (
                <div className="flex justify-between">
                  <span>CGST:</span>
                  <span className="font-mono">₹{calculationResults.cgst.toFixed(2)}</span>
                </div>
              )}
              {calculationResults.sgst > 0 && (
                <div className="flex justify-between">
                  <span>SGST:</span>
                  <span className="font-mono">₹{calculationResults.sgst.toFixed(2)}</span>
                </div>
              )}
              {calculationResults.igst > 0 && (
                <div className="flex justify-between">
                  <span>IGST:</span>
                  <span className="font-mono">₹{calculationResults.igst.toFixed(2)}</span>
                </div>
              )}
              {calculationResults.roundOff !== 0 && (
                <div className="flex justify-between">
                  <span>Round Off:</span>
                  <span className="font-mono">₹{calculationResults.roundOff.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-2 border-t-2 border-slate-900 font-bold text-sm text-slate-950">
                <span>Grand Total:</span>
                <span className="font-mono text-blue-700 text-base">₹{calculationResults.grandTotal.toFixed(2)}</span>
              </div>
              <p className="font-serif italic text-[10px] text-slate-400">{calculationResults.amountInWords}</p>
            </div>

            {/* Payment Received Input */}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Amount Received Now (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amountReceived || ''}
                  onChange={(e) => setAmountReceived(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono font-bold focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="flex justify-between items-center text-xs font-bold pt-1">
                <span className="text-slate-500">Balance Due:</span>
                <span className="font-mono text-red-600">₹{balanceDue.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
