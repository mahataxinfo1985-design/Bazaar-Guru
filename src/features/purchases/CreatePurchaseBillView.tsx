import React, { useState } from 'react';
import { Plus, Trash2, ArrowLeft, Save } from 'lucide-react';
import { Invoice, InvoiceItem, Party, Item, BusinessProfile, InvoiceType, PaymentMode, InvoiceStatus } from '../../types';
import { calculateInvoiceTotals } from '../../utils/gstEngine';
import { round2, safeSub } from '../../utils/decimal';

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
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Log Supplier Purchase Bill</h2>
            <p className="text-xs text-slate-500">
              Record incoming stock, input tax credit (ITC), and accounts payable.
            </p>
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
            <span>Post Purchase Bill</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Metadata Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">Bill Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-medium">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Internal Bill Ref
                </label>
                <input
                  type="text"
                  required
                  value={billNumber}
                  onChange={(e) => setBillNumber(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono font-bold focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Supplier Invoice No.
                </label>
                <input
                  type="text"
                  value={supplierBillRef}
                  onChange={(e) => setSupplierBillRef(e.target.value)}
                  placeholder="e.g. SUP/2026/044"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Bill Date</label>
                <input
                  type="date"
                  required
                  value={billDate}
                  onChange={(e) => setBillDate(e.target.value)}
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
                  <option value="Bank">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Credit">Credit (Pay Later)</option>
                </select>
              </div>

              <div className="flex items-center pt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoStockAddition}
                    onChange={(e) => setAutoStockAddition(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                  <span className="text-xs text-slate-700 font-bold">Auto-increment Inventory Stock</span>
                </label>
              </div>
            </div>
          </div>

          {/* Supplier Selection */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="font-bold text-sm text-slate-900">Supplier Details</h3>
              <button
                type="button"
                onClick={onOpenPartyModal}
                className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus size={14} /> Add Supplier
              </button>
            </div>

            <select
              value={partyId}
              onChange={(e) => setPartyId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium focus:border-blue-500 focus:outline-hidden bg-white"
            >
              <option value="">-- Choose Supplier --</option>
              {parties
                .filter((p) => p.type === 'supplier')
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.gstin ? `(${p.gstin})` : '(Unregistered)'} - {p.state}
                  </option>
                ))}
            </select>
          </div>

          {/* Line Items Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="font-bold text-sm text-slate-900">Purchased Items</h3>
              <button
                type="button"
                onClick={onOpenItemModal}
                className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus size={14} /> Add Product Master
              </button>
            </div>

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
                  {it.name} (HSN: {it.hsnCode} | Current Stock: {it.stockQty})
                </option>
              ))}
            </select>

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

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                        <label className="block text-[9px] uppercase font-bold text-slate-400">Purchase Rate (₹)</label>
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
                          ₹{((item.qty * item.unitPrice) * (1 + item.gstRate / 100)).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Summary */}
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">Purchase Financials</h3>
            <div className="space-y-2 text-xs font-medium text-slate-600">
              <div className="flex justify-between">
                <span>Taxable Value:</span>
                <span className="font-mono text-slate-900">₹{calculationResults.taxableAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Input Tax Credit (ITC):</span>
                <span className="font-mono text-emerald-600">
                  ₹{(calculationResults.cgst + calculationResults.sgst + calculationResults.igst).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t-2 border-slate-900 font-bold text-sm text-slate-950">
                <span>Total Bill Amount:</span>
                <span className="font-mono text-blue-700 text-base">₹{calculationResults.grandTotal.toFixed(2)}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Amount Paid to Supplier Now (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amountPaid || ''}
                  onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono font-bold focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="flex justify-between items-center text-xs font-bold pt-1">
                <span className="text-slate-500">Accounts Payable (Due):</span>
                <span className="font-mono text-red-600">₹{balanceDue.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
