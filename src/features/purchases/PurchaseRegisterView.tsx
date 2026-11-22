import React, { useState } from 'react';
import { Plus, Search, Eye, Edit3, X, Trash2, DollarSign } from 'lucide-react';
import { Invoice, Party, BusinessProfile } from '../../types';
import ExportDropdown from '../../components/shared/ExportDropdown';

interface PurchaseRegisterViewProps {
  invoices: Invoice[];
  parties: Party[];
  businessProfile: BusinessProfile;
  onCreatePurchase: () => void;
  onViewInvoice: (inv: Invoice) => void;
  onEditInvoice: (inv: Invoice) => void;
  onCancelInvoice: (inv: Invoice) => void;
  onSoftDeleteInvoice: (inv: Invoice) => void;
  onRecordPaymentOut: (party: Party, inv?: Invoice) => void;
  onExportExcel: () => void;
  onExportCSV: () => void;
  onExportJSON: () => void;
}

export default function PurchaseRegisterView({
  invoices,
  parties,
  businessProfile,
  onCreatePurchase,
  onViewInvoice,
  onEditInvoice,
  onCancelInvoice,
  onSoftDeleteInvoice,
  onRecordPaymentOut,
  onExportExcel,
  onExportCSV,
  onExportJSON,
}: PurchaseRegisterViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const filteredPurchases = invoices.filter((inv) => {
    if (inv.deleted) return false;
    const isPurchase = inv.type.includes('Purchase') || inv.type === 'Purchase Return';
    if (!isPurchase) return false;

    const party = parties.find((p) => p.id === inv.partyId);
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (party?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'All' || inv.paymentStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Purchase Register</h2>
          <p className="text-sm text-slate-500">Track supplier bills, input tax credit (ITC), and accounts payable.</p>
        </div>
        <div className="flex items-center gap-3">
          <ExportDropdown
            label="Export Register"
            options={[
              { label: 'Export as Excel (.xlsx)', onClick: onExportExcel },
              { label: 'Export as CSV', onClick: onExportCSV },
              { label: 'Export as JSON', onClick: onExportJSON },
            ]}
          />
          <button
            onClick={onCreatePurchase}
            className="flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white shadow-2xs hover:bg-blue-800 transition cursor-pointer"
          >
            <Plus size={16} />
            <span>Log Purchase Bill</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs flex flex-col md:flex-row items-center gap-4">
        <div className="relative w-full md:flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by bill number, supplier name..."
            className="w-full rounded-lg border border-slate-300 pl-10 pr-4 py-2 text-sm focus:border-blue-500 focus:outline-hidden"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full md:w-40 rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden bg-white"
        >
          <option value="All">All Payments</option>
          <option value="Paid">Paid</option>
          <option value="Partial">Partially Paid</option>
          <option value="Unpaid">Unpaid</option>
          <option value="Overdue">Overdue</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                <th className="p-4">Bill No</th>
                <th className="p-4">Supplier</th>
                <th className="p-4">Date</th>
                <th className="p-4 text-right">Taxable (₹)</th>
                <th className="p-4 text-right">Grand Total (₹)</th>
                <th className="p-4 text-right">Balance Due (₹)</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    No purchase bills recorded yet.
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((inv) => {
                  const party = parties.find((p) => p.id === inv.partyId);
                  const isCancelled = inv.status === 'Cancelled';
                  return (
                    <tr
                      key={inv.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        isCancelled ? 'opacity-70 bg-red-50/30' : ''
                      }`}
                    >
                      <td className="p-4 font-bold text-slate-900">
                        {inv.invoiceNumber}
                        <span className="block text-[9px] text-slate-400">{inv.type}</span>
                      </td>
                      <td className="p-4">
                        <p className="font-semibold text-slate-900">{party?.name || 'Supplier'}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{party?.gstin || 'Unregistered'}</p>
                      </td>
                      <td className="p-4 text-slate-600">{inv.date}</td>
                      <td className="p-4 text-right font-mono font-semibold">
                        ₹{inv.taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-slate-950">
                        ₹{inv.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-red-600">
                        ₹{inv.balanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold ${
                            isCancelled
                              ? 'bg-red-100 text-red-700 border border-red-200'
                              : inv.paymentStatus === 'Paid'
                              ? 'bg-green-50 text-green-700 border border-green-200'
                              : inv.paymentStatus === 'Partial'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {isCancelled ? 'Cancelled' : inv.paymentStatus}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => onViewInvoice(inv)}
                            className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-900 transition"
                            title="View Document"
                          >
                            <Eye size={14} />
                          </button>
                          {party && inv.balanceDue > 0 && !isCancelled && (
                            <button
                              onClick={() => onRecordPaymentOut(party, inv)}
                              className="p-1 hover:bg-emerald-50 rounded text-emerald-600 hover:text-emerald-700 transition"
                              title="Pay Supplier"
                            >
                              <DollarSign size={14} />
                            </button>
                          )}
                          {!isCancelled && (
                            <>
                              <button
                                onClick={() => onEditInvoice(inv)}
                                className="p-1 hover:bg-blue-50 rounded text-blue-500 hover:text-blue-700 transition"
                                title="Edit"
                              >
                                <Edit3 size={14} />
                              </button>
                              <button
                                onClick={() => onCancelInvoice(inv)}
                                className="p-1 hover:bg-amber-50 rounded text-amber-500 hover:text-amber-700 transition"
                                title="Cancel"
                              >
                                <X size={14} />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => onSoftDeleteInvoice(inv)}
                            className="p-1 hover:bg-red-50 rounded text-red-400 hover:text-red-600 transition"
                            title="Hide"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
