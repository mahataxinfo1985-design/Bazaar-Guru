import React, { useState } from 'react';
import { Plus, Trash2, ArrowLeft, Save } from 'lucide-react';
import { Invoice, InvoiceItem, Party, Item, BusinessProfile, PaymentMode, InvoiceStatus } from '../../types';
import { calculateInvoiceTotals } from '../../utils/gstEngine';
import { safeSub } from '../../utils/decimal';

interface CreatePurchaseBillViewProps {
  businessProfile: BusinessProfile;
  parties: Party[];
  items: Item[];
  onSave: (invoice: Invoice, status: InvoiceStatus) => void;
  onCancel: () => void;
  onOpenPartyModal: () => void;
  onOpenItemModal: () => void;
}

export default function CreatePurchaseBillView({
  businessProfile,
  parties,
  items,
  onSave,
  onCancel,
  onOpenPartyModal,
  onOpenItemModal,
}: CreatePurchaseBillViewProps) {
  const [billNumber, setBillNumber] = useState(`PUR-${Date.now().toString().slice(-6)}`);
  const [supplierBillRef, setSupplierBillRef] = useState('');
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]);
  const [partyId, setPartyId] = useState('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('Cash');
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [autoStockAddition, setAutoStockAddition] = useState(true);
  const [notes, setNotes] = useState('');

  const [billItems, setBillItems] = useState<
    Omit<InvoiceItem, 'taxableValue' | 'cgst' | 'sgst' | 'igst' | 'total'>[]
  >([]);

  const selectedParty = parties.find((p) => p.id === partyId);
  const partyState = selectedParty?.state || businessProfile.state;

  const calculationResults = calculateInvoiceTotals(
    billItems,
    businessProfile.state,
    partyState,
    0,
    true
  );

  const balanceDue = Math.max(0, safeSub(calculationResults.grandTotal, amountPaid));

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
      alert('Please select a Supplier first!');
      return;
    }
    if (billItems.length === 0) {
      alert('Please add at least one line item.');
      return;
    }

    let paymentStatus: 'Paid' | 'Partial' | 'Unpaid' = 'Unpaid';
    if (amountPaid >= calculationResults.grandTotal) {
      paymentStatus = 'Paid';
    } else if (amountPaid > 0) {
      paymentStatus = 'Partial';
    }

    const payload: Invoice = {
      id: `pur_${Date.now()}`,
      invoiceNumber: billNumber,
      referenceNumber: supplierBillRef.trim() || undefined,
      type: 'Purchase Invoice',
      date: billDate,
      dueDate,
      partyId,
      partyType: 'supplier',
      items: calculationResults.items,
      subtotal: calculationResults.subtotal,
      discount: calculationResults.discount,
      taxableAmount: calculationResults.taxableAmount,
      cgst: calculationResults.cgst,
      sgst: calculationResults.sgst,
      igst: calculationResults.igst,
      cess: 0,
      roundOff: calculationResults.roundOff,
      grandTotal: calculationResults.grandTotal,
      amountInWords: calculationResults.amountInWords,
      paymentMode,
      amountReceived: status === 'Draft' ? 0 : amountPaid,
      balanceDue: status === 'Draft' ? calculationResults.grandTotal : balanceDue,
      paymentStatus: status === 'Draft' ? 'Unpaid' : paymentStatus,
      autoStockAddition,
      notes: notes.trim() || undefined,
      status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      auditTrail: [
        {
          timestamp: new Date().toISOString(),
          action: `Purchase Bill Logged (${status})`,
          user: businessProfile.email,
        },
      ],
    };

    onSave(payload, status);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-[#E8DFCF] pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="p-2 hover:bg-[#EAF5FD] text-[#3E5368] rounded-lg transition cursor-pointer"
            title="Back to Purchases"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-semibold text-[#12263A] tracking-tight">Log Supplier Purchase Bill</h2>
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
            <span>Post Purchase Bill</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Bill Particulars Card */}
          <div className="rounded-xl border border-[#E8DFCF] bg-white p-5 shadow-xs space-y-4">
            <h3 className="font-semibold text-base text-[#12263A] border-b border-[#E8DFCF] pb-2">Bill Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-[13px]">
              <div>
                <label className="block text-[13px] font-medium text-[#12263A] mb-1">
                  Internal bill ref
                </label>
                <input
                  type="text"
                  required
                  value={billNumber}
                  onChange={(e) => setBillNumber(e.target.value)}
                  className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-[13px] font-medium text-[#12263A] focus:border-[#1F86CC] focus:ring-2 focus:ring-[#3BA0E6]/20 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#12263A] mb-1">
                  Supplier invoice no
                </label>
                <input
                  type="text"
                  value={supplierBillRef}
                  onChange={(e) => setSupplierBillRef(e.target.value)}
                  placeholder="e.g. SUP-1049"
                  className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-[13px] text-[#12263A] focus:border-[#1F86CC] focus:ring-2 focus:ring-[#3BA0E6]/20 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#12263A] mb-1">
                  Bill date
                </label>
                <input
                  type="date"
                  required
                  value={billDate}
                  onChange={(e) => setBillDate(e.target.value)}
                  className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-[13px] text-[#12263A] focus:border-[#1F86CC] focus:ring-2 focus:ring-[#3BA0E6]/20 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#12263A] mb-1">
                  Payment due date
                </label>
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-[13px] text-[#12263A] focus:border-[#1F86CC] focus:ring-2 focus:ring-[#3BA0E6]/20 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#12263A] mb-1">
                  Payment mode
                </label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value as any)}
                  className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-[13px] text-[#12263A] focus:border-[#1F86CC] focus:outline-hidden bg-white cursor-pointer"
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank">Bank Transfer</option>
                  <option value="UPI">UPI</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Credit">Credit (Pay Later)</option>
                </select>
              </div>

              <div className="flex items-center pt-6">
                <label className="flex items-center gap-2 cursor-pointer text-[13px] font-medium text-[#12263A]">
                  <input
                    type="checkbox"
                    checked={autoStockAddition}
                    onChange={(e) => setAutoStockAddition(e.target.checked)}
                    className="w-4 h-4 rounded text-[#E0771A] focus:ring-[#F28C28]"
                  />
                  <span>Auto-add items to stock</span>
                </label>
              </div>
            </div>
          </div>

          {/* Supplier Selection Card */}
          <div className="rounded-xl border border-[#E8DFCF] bg-white p-5 shadow-xs space-y-4">
            <div className="flex justify-between items-center border-b border-[#E8DFCF] pb-2">
              <h3 className="font-semibold text-base text-[#12263A]">Supplier Details</h3>
              <button
                type="button"
                onClick={onOpenPartyModal}
                className="text-[13px] font-semibold text-[#14689F] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus size={15} /> Add supplier
              </button>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[#12263A] mb-1">
                Select supplier <span className="text-[#C23B3B]">*</span>
              </label>
              <select
                value={partyId}
                onChange={(e) => setPartyId(e.target.value)}
                className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-[13px] font-medium text-[#12263A] focus:border-[#1F86CC] focus:outline-hidden bg-white cursor-pointer"
              >
                <option value="">-- Choose registered supplier --</option>
                {parties
                  .filter((p) => p.type === 'supplier')
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.gstin ? `(${p.gstin})` : '(Unregistered)'} - {p.state}
                    </option>
                  ))}
              </select>

              {selectedParty && (
                <div className="mt-3 p-3.5 bg-[#FFFBF3] rounded-lg border border-[#E8DFCF] grid grid-cols-2 gap-3 text-[13px] text-[#3E5368]">
                  <div>
                    <span className="font-semibold text-[#12263A]">Address: </span>
                    {selectedParty.billingAddress}
                  </div>
                  <div>
                    <span className="font-semibold text-[#12263A]">GSTIN: </span>
                    <span className="font-mono">{selectedParty.gstin || 'Unregistered'}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Line Items Card */}
          <div className="rounded-xl border border-[#E8DFCF] bg-white p-5 shadow-xs space-y-4">
            <div className="flex justify-between items-center border-b border-[#E8DFCF] pb-2">
              <h3 className="font-semibold text-base text-[#12263A]">Bill Line Items</h3>
              <button
                type="button"
                onClick={onOpenItemModal}
                className="text-[13px] font-semibold text-[#14689F] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus size={15} /> Add item to catalogue
              </button>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[#12263A] mb-1">
                Select item to add
              </label>
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) handleAddLineItem(e.target.value);
                }}
                className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-[13px] font-medium text-[#12263A] focus:border-[#1F86CC] focus:outline-hidden bg-white cursor-pointer"
              >
                <option value="">-- Choose item --</option>
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name} (HSN: {it.hsnCode} | Price: ₹{it.unitPrice})
                  </option>
                ))}
              </select>
            </div>

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
                          <label className="block text-[12px] font-medium text-[#3E5368] mb-1">Cost Rate (₹)</label>
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
                          <label className="block text-[12px] font-medium text-[#3E5368] mb-1">GST rate</label>
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

        {/* Right 1 Col: Summary & Amount Paid */}
        <div className="space-y-6">
          <div className="rounded-xl border border-[#E8DFCF] bg-white p-5 shadow-xs space-y-3.5">
            <h3 className="font-semibold text-base text-[#12263A] border-b border-[#E8DFCF] pb-2">Purchase Summary</h3>

            <div className="space-y-2 text-[13px] text-[#3E5368]">
              <div className="flex justify-between">
                <span>Taxable purchases</span>
                <span className="font-semibold tabular-nums text-[#12263A]">₹{calculationResults.taxableAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[#14689F]">
                <span>Input Tax Credit (ITC)</span>
                <span className="font-semibold tabular-nums">+₹{(calculationResults.cgst + calculationResults.sgst + calculationResults.igst).toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-[#E8DFCF] text-base font-bold text-[#12263A]">
                <span>Total Bill Amount</span>
                <span className="tabular-nums text-[#E0771A]">₹{calculationResults.grandTotal.toFixed(2)}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-[#E8DFCF] space-y-3">
              <div>
                <label className="block text-[13px] font-medium text-[#12263A] mb-1">
                  Amount paid to supplier (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
                  className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-[14px] font-semibold text-[#12263A] tabular-nums focus:border-[#1F86CC] focus:ring-2 focus:ring-[#3BA0E6]/20 focus:outline-hidden"
                />
              </div>

              <div className="flex justify-between text-[13px] font-semibold pt-1">
                <span className="text-[#3E5368]">Balance payable</span>
                <span className={`tabular-nums ${balanceDue > 0 ? 'text-[#C23B3B]' : 'text-[#1E8E5A]'}`}>
                  ₹{balanceDue.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#E8DFCF] bg-white p-5 shadow-xs space-y-3">
            <h3 className="font-semibold text-base text-[#12263A] border-b border-[#E8DFCF] pb-2">Internal Notes</h3>
            <div>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Remarks about goods received or supplier credit..."
                className="w-full rounded-lg border border-[#E8DFCF] p-2.5 text-[13px] text-[#12263A] focus:border-[#1F86CC] focus:outline-hidden"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
