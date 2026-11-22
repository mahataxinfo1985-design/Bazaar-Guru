import React, { useState, useEffect } from 'react';
import { Plus, Trash2, ArrowLeft, Save } from 'lucide-react';
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
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-[#E8DFCF] pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="p-2 hover:bg-[#EAF5FD] text-[#3E5368] rounded-lg transition cursor-pointer"
            title="Back to Sales"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-semibold text-[#12263A] tracking-tight">
              {editingInvoice ? `Edit Invoice: ${editingInvoice.invoiceNumber}` : 'Create Sales Invoice'}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleSave('Draft')}
            className="rounded-lg border border-[#14689F] bg-white px-4 py-2 text-[14px] font-semibold text-[#14689F] hover:bg-[#EAF5FD] transition cursor-pointer min-h-[40px]"
          >
            Save as Draft
          </button>
          <button
            onClick={() => handleSave('Active')}
            className="flex items-center gap-1.5 rounded-lg bg-[#E0771A] hover:bg-[#B85D0F] px-5 py-2 text-[14px] font-semibold text-white shadow-xs transition cursor-pointer min-h-[40px]"
          >
            <Save size={16} />
            <span>Save & Issue Invoice</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Form Left, Summary Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Form Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Document Particulars Card */}
          <div className="rounded-xl border border-[#E8DFCF] bg-white p-5 shadow-xs space-y-4">
            <h3 className="font-semibold text-base text-[#12263A] border-b border-[#E8DFCF] pb-2">Invoice Particulars</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-[13px]">
              <div>
                <label className="block text-[13px] font-medium text-[#12263A] mb-1">Document type</label>
                <select
                  value={invoiceType}
                  onChange={(e) => setInvoiceType(e.target.value as any)}
                  className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-[13px] text-[#12263A] focus:border-[#1F86CC] focus:ring-2 focus:ring-[#3BA0E6]/20 focus:outline-hidden bg-white"
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
                <label className="block text-[13px] font-medium text-[#12263A] mb-1">Invoice number</label>
                <input
                  type="text"
                  required
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-[13px] font-medium text-[#12263A] focus:border-[#1F86CC] focus:ring-2 focus:ring-[#3BA0E6]/20 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#12263A] mb-1">Reference number</label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="Optional PO / Ref"
                  className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-[13px] text-[#12263A] focus:border-[#1F86CC] focus:ring-2 focus:ring-[#3BA0E6]/20 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#12263A] mb-1">Invoice date</label>
                <input
                  type="date"
                  required
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-[13px] text-[#12263A] focus:border-[#1F86CC] focus:ring-2 focus:ring-[#3BA0E6]/20 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#12263A] mb-1">Due date</label>
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-[13px] text-[#12263A] focus:border-[#1F86CC] focus:ring-2 focus:ring-[#3BA0E6]/20 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#12263A] mb-1">Payment mode</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value as any)}
                  className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-[13px] text-[#12263A] focus:border-[#1F86CC] focus:ring-2 focus:ring-[#3BA0E6]/20 focus:outline-hidden bg-white"
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
          <div className="rounded-xl border border-[#E8DFCF] bg-white p-5 shadow-xs space-y-4">
            <div className="flex justify-between items-center border-b border-[#E8DFCF] pb-2">
              <h3 className="font-semibold text-base text-[#12263A]">Customer Details</h3>
              <button
                type="button"
                onClick={onOpenPartyModal}
                className="text-[13px] font-semibold text-[#14689F] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus size={15} /> Add customer
              </button>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[#12263A] mb-1">
                Select customer <span className="text-[#C23B3B]">*</span>
              </label>
              <select
                value={partyId}
                onChange={(e) => setPartyId(e.target.value)}
                className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-[13px] font-medium text-[#12263A] focus:border-[#1F86CC] focus:ring-2 focus:ring-[#3BA0E6]/20 focus:outline-hidden bg-white cursor-pointer"
              >
                <option value="">-- Choose registered customer --</option>
                {parties
                  .filter((p) => p.type === 'customer')
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.gstin ? `(${p.gstin})` : '(Unregistered)'} - {p.state}
                    </option>
                  ))}
              </select>

              {selectedParty && (
                <div className="mt-3 p-3.5 bg-[#FFFBF3] rounded-lg border border-[#E8DFCF] grid grid-cols-2 gap-3 text-[13px] text-[#3E5368]">
                  <div>
                    <span className="font-semibold text-[#12263A]">Billing address: </span>
                    {selectedParty.billingAddress}
                  </div>
                  <div>
                    <span className="font-semibold text-[#12263A]">GSTIN: </span>
                    <span className="font-mono">{selectedParty.gstin || 'Unregistered'}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-[#12263A]">Place of supply: </span>
                    {selectedParty.state} (
                    {selectedParty.state.toLowerCase() === businessProfile.state.toLowerCase()
                      ? 'Intrastate CGST + SGST'
                      : 'Interstate IGST'}
                    )
                  </div>
                  <div>
                    <span className="font-semibold text-[#12263A]">Outstanding: </span>
                    <span className="font-semibold tabular-nums text-[#12263A]">
                      ₹{selectedParty.outstandingBalance || 0}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Line Items Card */}
          <div className="rounded-xl border border-[#E8DFCF] bg-white p-5 shadow-xs space-y-4">
            <div className="flex justify-between items-center border-b border-[#E8DFCF] pb-2">
              <h3 className="font-semibold text-base text-[#12263A]">Invoice Items</h3>
              <button
                type="button"
                onClick={onOpenItemModal}
                className="text-[13px] font-semibold text-[#14689F] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus size={15} /> Add product to catalogue
              </button>
            </div>

            {/* Quick Add Dropdown */}
            <div>
              <label className="block text-[13px] font-medium text-[#12263A] mb-1">
                Select item from catalogue
              </label>
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) handleAddLineItem(e.target.value);
                }}
                className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-[13px] font-medium text-[#12263A] focus:border-[#1F86CC] focus:ring-2 focus:ring-[#3BA0E6]/20 focus:outline-hidden bg-white cursor-pointer"
              >
                <option value="">-- Choose item to add line --</option>
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name} (HSN: {it.hsnCode} | ₹{it.unitPrice} | Stock: {it.stockQty})
                  </option>
                ))}
              </select>
            </div>

            {/* Line Items Container with Sticky Columns */}
            <div className="overflow-x-auto">
              <div className="min-w-[650px] space-y-3">
                {billItems.length === 0 ? (
                  <div className="p-8 text-center text-[13px] text-[#3E5368] bg-[#FFFBF3] rounded-lg border border-dashed border-[#E8DFCF]">
                    No line items added yet. Choose an item from the dropdown above.
                  </div>
                ) : (
                  billItems.map((item, idx) => (
                    <div key={item.id} className="p-3.5 bg-[#FFFBF3] rounded-lg border border-[#E8DFCF] space-y-2 text-[13px]">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-[#12263A]">
                          #{idx + 1}. {item.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveLineItem(item.id)}
                          className="p-1.5 text-[#C23B3B] hover:bg-[#FDECEC] rounded-md transition cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        <div>
                          <label className="block text-[12px] font-medium text-[#3E5368] mb-1">Quantity</label>
                          <input
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={(e) => handleUpdateLineItem(item.id, 'qty', parseFloat(e.target.value) || 0)}
                            className="w-full h-9 rounded-md border border-[#E8DFCF] bg-white px-2 text-[13px] tabular-nums"
                          />
                        </div>
                        <div>
                          <label className="block text-[12px] font-medium text-[#3E5368] mb-1">Rate (₹)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) =>
                              handleUpdateLineItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)
                            }
                            className="w-full h-9 rounded-md border border-[#E8DFCF] bg-white px-2 text-[13px] tabular-nums"
                          />
                        </div>
                        <div>
                          <label className="block text-[12px] font-medium text-[#3E5368] mb-1">Discount (%)</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={item.discount}
                            onChange={(e) =>
                              handleUpdateLineItem(item.id, 'discount', parseFloat(e.target.value) || 0)
                            }
                            className="w-full h-9 rounded-md border border-[#E8DFCF] bg-white px-2 text-[13px] tabular-nums"
                          />
                        </div>
                        <div>
                          <label className="block text-[12px] font-medium text-[#3E5368] mb-1">GST slab</label>
                          <select
                            value={item.gstRate}
                            onChange={(e) =>
                              handleUpdateLineItem(item.id, 'gstRate', parseFloat(e.target.value) || 0)
                            }
                            className="w-full h-9 rounded-md border border-[#E8DFCF] bg-white px-2 text-[13px] cursor-pointer"
                          >
                            <option value="0">0%</option>
                            <option value="5">5%</option>
                            <option value="12">12%</option>
                            <option value="18">18%</option>
                            <option value="28">28%</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[12px] font-medium text-[#3E5368] mb-1 text-right">Line total</label>
                          <div className="pt-1.5 text-right font-semibold tabular-nums text-[#12263A]">
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
        </div>

        {/* Right 1 Col: Summary & Payment Allocation */}
        <div className="space-y-6">
          {/* Real-time Tax & Totals Card */}
          <div className="rounded-xl border border-[#E8DFCF] bg-white p-5 shadow-xs space-y-3.5">
            <h3 className="font-semibold text-base text-[#12263A] border-b border-[#E8DFCF] pb-2">Calculation Summary</h3>

            <div className="space-y-2 text-[13px] text-[#3E5368]">
              <div className="flex justify-between">
                <span>Subtotal (gross)</span>
                <span className="font-semibold tabular-nums text-[#12263A]">₹{calculationResults.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Total discount</span>
                <span className="font-semibold tabular-nums text-[#1E8E5A]">-₹{calculationResults.discount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-[#E8DFCF]/60">
                <span className="font-semibold text-[#12263A]">Taxable value</span>
                <span className="font-semibold tabular-nums text-[#12263A]">₹{calculationResults.taxableAmount.toFixed(2)}</span>
              </div>

              {calculationResults.cgst > 0 && (
                <div className="flex justify-between text-[#14689F]">
                  <span>CGST</span>
                  <span className="font-semibold tabular-nums">+₹{calculationResults.cgst.toFixed(2)}</span>
                </div>
              )}
              {calculationResults.sgst > 0 && (
                <div className="flex justify-between text-[#14689F]">
                  <span>SGST</span>
                  <span className="font-semibold tabular-nums">+₹{calculationResults.sgst.toFixed(2)}</span>
                </div>
              )}
              {calculationResults.igst > 0 && (
                <div className="flex justify-between text-[#14689F]">
                  <span>IGST</span>
                  <span className="font-semibold tabular-nums">+₹{calculationResults.igst.toFixed(2)}</span>
                </div>
              )}

              {calculationResults.roundOff !== 0 && (
                <div className="flex justify-between text-[#3E5368]">
                  <span>Round off</span>
                  <span className="font-semibold tabular-nums">{calculationResults.roundOff > 0 ? `+₹${calculationResults.roundOff.toFixed(2)}` : `-₹${Math.abs(calculationResults.roundOff).toFixed(2)}`}</span>
                </div>
              )}

              <div className="flex justify-between pt-2 border-t border-[#E8DFCF] text-base font-bold text-[#12263A]">
                <span>Grand Total</span>
                <span className="tabular-nums text-[#E0771A]">₹{calculationResults.grandTotal.toFixed(2)}</span>
              </div>
              <p className="text-[12px] text-[#3E5368] italic pt-1">{calculationResults.amountInWords}</p>
            </div>

            {/* Payment Collection */}
            <div className="pt-3 border-t border-[#E8DFCF] space-y-3">
              <div>
                <label className="block text-[13px] font-medium text-[#12263A] mb-1">
                  Amount received (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amountReceived}
                  onChange={(e) => setAmountReceived(parseFloat(e.target.value) || 0)}
                  className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-[14px] font-semibold text-[#12263A] tabular-nums focus:border-[#1F86CC] focus:ring-2 focus:ring-[#3BA0E6]/20 focus:outline-hidden"
                />
              </div>

              <div className="flex justify-between text-[13px] font-semibold pt-1">
                <span className="text-[#3E5368]">Balance due</span>
                <span className={`tabular-nums ${balanceDue > 0 ? 'text-[#C23B3B]' : 'text-[#1E8E5A]'}`}>
                  ₹{balanceDue.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Notes & Terms Card */}
          <div className="rounded-xl border border-[#E8DFCF] bg-white p-5 shadow-xs space-y-3">
            <h3 className="font-semibold text-base text-[#12263A] border-b border-[#E8DFCF] pb-2">Notes & Terms</h3>
            <div>
              <label className="block text-[12px] font-medium text-[#3E5368] mb-1">Invoice notes</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Remarks visible to customer..."
                className="w-full rounded-lg border border-[#E8DFCF] p-2.5 text-[13px] text-[#12263A] focus:border-[#1F86CC] focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#3E5368] mb-1">Terms & Conditions</label>
              <textarea
                rows={2}
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                placeholder="Payment terms..."
                className="w-full rounded-lg border border-[#E8DFCF] p-2.5 text-[13px] text-[#12263A] focus:border-[#1F86CC] focus:outline-hidden"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
