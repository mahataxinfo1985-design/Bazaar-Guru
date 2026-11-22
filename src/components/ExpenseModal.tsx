import React, { useState, useEffect, useRef } from 'react';
import { X, Calendar, DollarSign, User, FileText, Camera, ShieldAlert } from 'lucide-react';
import { Expense, ExpenseCategory } from '../types';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (expense: Expense, file?: File) => void;
  expenseToEdit?: Expense | null;
}

const CATEGORIES: ExpenseCategory[] = [
  'Rent', 'Salary', 'Electricity', 'Internet', 'Travel', 
  'Food', 'Office Supplies', 'Marketing', 'Maintenance', 'Others'
];

const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'NEFT', 'RTGS', 'IMPS', 'Cheque', 'Credit'];

export default function ExpenseModal({ isOpen, onClose, onSave, expenseToEdit }: ExpenseModalProps) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<ExpenseCategory>('Others');
  const [amount, setAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [vendorName, setVendorName] = useState('');
  const [description, setDescription] = useState('');
  const [gstAmount, setGstAmount] = useState<number>(0);
  const [vendorGstin, setVendorGstin] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (expenseToEdit) {
      setDate(expenseToEdit.date);
      setCategory(expenseToEdit.category);
      setAmount(expenseToEdit.amount);
      setPaymentMode(expenseToEdit.paymentMode);
      setVendorName(expenseToEdit.vendorName);
      setDescription(expenseToEdit.description || '');
      setGstAmount(expenseToEdit.gstAmount || 0);
      setVendorGstin(expenseToEdit.vendorGstin || '');
      setReceiptUrl(expenseToEdit.receiptUrl || '');
      setSelectedFile(undefined);
    } else {
      setDate(new Date().toISOString().split('T')[0]);
      setCategory('Others');
      setAmount(0);
      setPaymentMode('Cash');
      setVendorName('');
      setDescription('');
      setGstAmount(0);
      setVendorGstin('');
      setReceiptUrl('');
      setSelectedFile(undefined);
    }
  }, [expenseToEdit, isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      
      // Create local preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      alert('Please enter a valid expense amount.');
      return;
    }
    if (!vendorName.trim()) {
      alert('Please enter a vendor name.');
      return;
    }

    const payload: Expense = {
      id: expenseToEdit?.id || `exp_${Date.now()}`,
      date,
      category,
      amount,
      paymentMode,
      vendorName: vendorName.trim(),
      description: description.trim() || undefined,
      receiptUrl: selectedFile ? undefined : receiptUrl || undefined, // will be uploaded inside App.tsx or use local base64
      gstAmount: gstAmount > 0 ? gstAmount : undefined,
      vendorGstin: vendorGstin.trim() || undefined,
      createdAt: expenseToEdit?.createdAt || new Date().toISOString(),
    };

    onSave(payload, selectedFile);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex h-14 items-center justify-between border-b border-slate-200 bg-slate-900 px-6 text-white shrink-0">
          <span className="text-sm font-bold tracking-wide uppercase">
            {expenseToEdit ? 'Edit Expense Record' : 'Record New Expense'}
          </span>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Row 1: Date & Category */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Expense Date
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Calendar size={14} />
                </div>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 pl-10 pr-3 py-2 text-xs text-slate-700 focus:border-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700 focus:border-blue-500 focus:outline-hidden"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Amount & Payment Mode */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Expense Amount (₹)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <DollarSign size={14} />
                </div>
                <input
                  type="number"
                  required
                  min="0"
                  step="any"
                  value={amount || ''}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  placeholder="0.00"
                  className="block w-full rounded-lg border border-slate-300 pl-10 pr-3 py-2 text-xs text-slate-700 focus:border-blue-500 focus:outline-hidden font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Payment Mode
              </label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700 focus:border-blue-500 focus:outline-hidden"
              >
                {PAYMENT_MODES.map(mode => (
                  <option key={mode} value={mode}>{mode}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 3: Vendor Name & GSTIN */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Vendor / Payee Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User size={14} />
                </div>
                <input
                  type="text"
                  required
                  placeholder="e.g. Reliance Retail"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 pl-10 pr-3 py-2 text-xs text-slate-700 focus:border-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Vendor GSTIN (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. 07AAAAA0000A1Z0"
                value={vendorGstin}
                onChange={(e) => setVendorGstin(e.target.value.toUpperCase())}
                className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700 focus:border-blue-500 focus:outline-hidden font-mono"
              />
            </div>
          </div>

          {/* Row 4: GST Amount & Description */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                GST Component (Included, Optional)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="0.00"
                value={gstAmount || ''}
                onChange={(e) => setGstAmount(Number(e.target.value))}
                className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700 focus:border-blue-500 focus:outline-hidden font-mono"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Description / Reference
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <FileText size={14} />
                </div>
                <input
                  type="text"
                  placeholder="e.g. Office laptop charger purchase"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 pl-10 pr-3 py-2 text-xs text-slate-700 focus:border-blue-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Receipt Image Attachment */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Receipt Attachment (Optional)
            </label>
            <div className="mt-1 flex items-center gap-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                <Camera size={14} />
                <span>Upload Receipt File</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />
              {selectedFile && (
                <span className="text-xs text-slate-500 font-semibold truncate max-w-[200px]">
                  {selectedFile.name}
                </span>
              )}
            </div>

            {receiptUrl && (
              <div className="mt-3 relative rounded-lg border border-slate-200 overflow-hidden bg-slate-50 max-h-40 flex items-center justify-center p-2">
                {receiptUrl.startsWith('data:application/pdf') || receiptUrl.endsWith('.pdf') ? (
                  <div className="flex flex-col items-center justify-center text-slate-500 p-4">
                    <FileText className="w-8 h-8 text-slate-400 mb-1" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">PDF Receipt Attached</span>
                  </div>
                ) : (
                  <img src={receiptUrl} alt="Receipt Preview" className="max-h-36 object-contain" />
                )}
                <button
                  type="button"
                  onClick={() => {
                    setReceiptUrl('');
                    setSelectedFile(undefined);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="absolute top-1 right-1 p-1 bg-red-600 hover:bg-red-700 text-white rounded-full transition cursor-pointer"
                  title="Remove attachment"
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>
        </form>

        {/* Footer Actions */}
        <div className="flex h-16 items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition cursor-pointer"
          >
            Save Record
          </button>
        </div>
      </div>
    </div>
  );
}
