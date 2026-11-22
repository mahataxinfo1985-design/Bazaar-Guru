import React, { useState } from 'react';
import { Plus, Search, Eye, Share2, Edit3, Copy, X, Trash2, DollarSign } from 'lucide-react';
import { Invoice, Party, BusinessProfile } from '../../types';
import ExportDropdown from '../../components/shared/ExportDropdown';
import { generateInvoicePDF } from '../../utils/pdfGenerator';
import { exportInvoiceJSON } from '../../utils/exportHelpers';

interface SalesRegisterViewProps {
  invoices: Invoice[];
  parties: Party[];
  businessProfile: BusinessProfile;
  onCreateInvoice: () => void;
  onViewInvoice: (inv: Invoice) => void;
  onEditInvoice: (inv: Invoice) => void;
  onDuplicateInvoice: (inv: Invoice) => void;
  onCancelInvoice: (inv: Invoice) => void;
  onSoftDeleteInvoice: (inv: Invoice) => void;
  onRecordPayment: (party: Party, inv?: Invoice) => void;
  onExportExcel: () => void;
  onExportCSV: () => void;
  onExportJSON: () => void;
}

export default function SalesRegisterView({
  invoices,
  parties,
  businessProfile,
  onCreateInvoice,
  onViewInvoice,
  onEditInvoice,
  onDuplicateInvoice,
  onCancelInvoice,
  onSoftDeleteInvoice,
  onRecordPayment,
  onExportExcel,
  onExportCSV,
  onExportJSON,
}: SalesRegisterViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  const filteredInvoices = invoices.filter((inv) => {
    if (inv.deleted) return false;
    const isPurchase = inv.type.includes('Purchase') || inv.type === 'Purchase Return';
    if (isPurchase) return false;

    const party = parties.find((p) => p.id === inv.partyId);
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (party?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'All' || inv.type === typeFilter;
    const matchesStatus = statusFilter === 'All' || inv.paymentStatus === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Sales Register</h2>
          <p className="text-sm text-slate-500">
            Log tax invoices, bills of supply, and sales returns for your customer base.
          </p>
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
            onClick={onCreateInvoice}
            className="flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white shadow-2xs hover:bg-blue-800 transition cursor-pointer"
          >
            <Plus size={16} />
            <span>Create Invoice</span>
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
            placeholder="Search by invoice number, customer name, HSN..."
            className="w-full rounded-lg border border-slate-300 pl-10 pr-4 py-2 text-sm focus:border-blue-500 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full md:w-40 rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden bg-white"
          >
            <option value="All">All Types</option>
            <option value="Tax Invoice">Tax Invoice</option>
            <option value="Non-GST Invoice">Non-GST Invoice</option>
            <option value="Proforma Invoice">Proforma Invoice</option>
            <option value="Bill of Supply">Bill of Supply</option>
            <option value="Credit Note">Credit Note</option>
            <option value="Debit Note">Debit Note</option>
          </select>

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
      </div>

      {/* Invoices Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                <th className="p-4">Invoice No</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Date</th>
                <th className="p-4">Due Date</th>
                <th className="p-4 text-right">Taxable (₹)</th>
                <th className="p-4 text-right">Grand Total (₹)</th>
                <th className="p-4 text-right">Balance Due (₹)</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">
                    No sales invoices found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
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
                        <span className="block text-[9px] text-slate-400 font-medium">{inv.type}</span>
                        {isCancelled && (
                          <span className="block text-[9px] text-red-500 font-bold uppercase">Cancelled</span>
                        )}
                      </td>
                      <td className="p-4">
                        <p className="font-semibold text-slate-900">{party?.name || 'Party'}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{party?.gstin || 'Unregistered'}</p>
                      </td>
                      <td className="p-4 font-medium text-slate-600">{inv.date}</td>
                      <td className="p-4 font-medium text-slate-600">{inv.dueDate}</td>
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
                            className="p-1 hover:bg-slate-100 rounded-md text-slate-500 hover:text-slate-900 transition-colors"
                            title="View Document"
                          >
                            <Eye size={14} />
                          </button>
                          {party && inv.balanceDue > 0 && !isCancelled && (
                            <button
                              onClick={() => onRecordPayment(party, inv)}
                              className="p-1 hover:bg-emerald-50 rounded-md text-emerald-600 hover:text-emerald-700 transition-colors"
                              title="Record Payment"
                            >
                              <DollarSign size={14} />
                            </button>
                          )}
                          {!isCancelled && (
                            <>
                              <button
                                onClick={() => onEditInvoice(inv)}
                                className="p-1 hover:bg-blue-50 rounded-md text-blue-500 hover:text-blue-700 transition-colors"
                                title="Edit"
                              >
                                <Edit3 size={14} />
                              </button>
                              <button
                                onClick={() => onDuplicateInvoice(inv)}
                                className="p-1 hover:bg-emerald-50 rounded-md text-emerald-500 hover:text-emerald-700 transition-colors"
                                title="Duplicate"
                              >
                                <Copy size={14} />
                              </button>
                              <button
                                onClick={() => onCancelInvoice(inv)}
                                className="p-1 hover:bg-amber-50 rounded-md text-amber-500 hover:text-amber-700 transition-colors"
                                title="Cancel Invoice"
                              >
                                <X size={14} />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => onSoftDeleteInvoice(inv)}
                            className="p-1 hover:bg-red-50 rounded-md text-red-400 hover:text-red-600 transition-colors"
                            title="Hide / Delete"
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
