import React, { useState } from 'react';
import { Plus, Search, Eye, Edit3, Copy, X, Trash2, IndianRupee, MoreHorizontal } from 'lucide-react';
import { Invoice, Party, BusinessProfile } from '../../types';
import ExportDropdown from '../../components/shared/ExportDropdown';

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
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-[#12263A] tracking-tight">Sales Register</h2>
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
            className="flex items-center gap-1.5 rounded-lg bg-[#E0771A] hover:bg-[#B85D0F] px-4 py-2 text-[14px] font-semibold text-white shadow-xs transition cursor-pointer min-h-[40px]"
          >
            <Plus size={16} />
            <span>Create Invoice</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="rounded-xl border border-[#E8DFCF] bg-white p-4 shadow-xs flex flex-col md:flex-row items-center gap-3">
        <div className="relative w-full md:flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#3E5368]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by invoice number, customer name, HSN..."
            className="w-full h-10 rounded-lg border border-[#E8DFCF] pl-10 pr-4 text-[13px] text-[#12263A] focus:border-[#1F86CC] focus:ring-2 focus:ring-[#3BA0E6]/20 focus:outline-hidden bg-white"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full md:w-44 h-10 rounded-lg border border-[#E8DFCF] px-3 text-[13px] text-[#12263A] focus:border-[#1F86CC] focus:outline-hidden bg-white cursor-pointer"
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
            className="w-full md:w-44 h-10 rounded-lg border border-[#E8DFCF] px-3 text-[13px] text-[#12263A] focus:border-[#1F86CC] focus:outline-hidden bg-white cursor-pointer"
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
      <div className="rounded-xl border border-[#E8DFCF] bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#FFFBF3] border-b border-[#E8DFCF] text-[#3E5368] text-[12px] font-semibold">
                <th className="p-3.5">Invoice No</th>
                <th className="p-3.5">Customer</th>
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Due Date</th>
                <th className="p-3.5 text-right">Taxable (₹)</th>
                <th className="p-3.5 text-right">Grand Total (₹)</th>
                <th className="p-3.5 text-right">Balance Due (₹)</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8DFCF]/60">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-[#3E5368]">
                    No sales invoices found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const party = parties.find((p) => p.id === inv.partyId);
                  const isCancelled = inv.status === 'Cancelled';
                  const isMenuOpen = openMenuId === inv.id;

                  return (
                    <tr
                      key={inv.id}
                      className={`hover:bg-[#FFFBF3] transition-colors ${
                        isCancelled ? 'opacity-70 bg-[#FDECEC]/30' : ''
                      }`}
                    >
                      <td className="p-3.5 font-medium text-[#12263A]">
                        {inv.invoiceNumber}
                        <span className="block text-[12px] text-[#3E5368]">{inv.type}</span>
                      </td>
                      <td className="p-3.5">
                        <p className="font-medium text-[#12263A]">{party?.name || 'Party'}</p>
                        <p className="text-[12px] text-[#3E5368] font-mono">{party?.gstin || 'Unregistered'}</p>
                      </td>
                      <td className="p-3.5 text-[#3E5368]">{inv.date}</td>
                      <td className="p-3.5 text-[#3E5368]">{inv.dueDate}</td>
                      <td className="p-3.5 text-right font-medium tabular-nums text-[#12263A]">
                        ₹{inv.taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3.5 text-right font-semibold tabular-nums text-[#12263A]">
                        ₹{inv.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3.5 text-right font-semibold tabular-nums text-[#C23B3B]">
                        ₹{inv.balanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`badge-status ${
                            isCancelled
                              ? 'badge-draft'
                              : inv.paymentStatus === 'Paid'
                              ? 'badge-paid'
                              : inv.paymentStatus === 'Partial'
                              ? 'badge-partial'
                              : 'badge-overdue'
                          }`}
                        >
                          {isCancelled ? 'Cancelled' : inv.paymentStatus}
                        </span>
                      </td>
                      <td className="p-3.5 text-center relative">
                        <div className="flex items-center justify-center gap-1">
                          {/* Inline Action 1: View */}
                          <button
                            onClick={() => onViewInvoice(inv)}
                            className="p-1.5 hover:bg-[#EAF5FD] text-[#14689F] rounded-md transition cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center"
                            title="View document"
                          >
                            <Eye size={16} />
                          </button>

                          {/* Inline Action 2: Record Payment (if balance due) */}
                          {party && inv.balanceDue > 0 && !isCancelled && (
                            <button
                              onClick={() => onRecordPayment(party, inv)}
                              className="p-1.5 hover:bg-[#E6F6EE] text-[#1E8E5A] rounded-md transition cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center"
                              title="Record payment"
                            >
                              <IndianRupee size={16} />
                            </button>
                          )}

                          {/* Overflow Menu (⋯) for Edit, Duplicate, Cancel, Delete */}
                          <div className="relative">
                            <button
                              onClick={() => setOpenMenuId(isMenuOpen ? null : inv.id)}
                              className="p-1.5 hover:bg-[#EAF5FD] text-[#3E5368] hover:text-[#12263A] rounded-md transition cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center"
                              title="More options"
                            >
                              <MoreHorizontal size={16} />
                            </button>

                            {isMenuOpen && (
                              <div 
                                className="absolute right-0 top-8 w-44 bg-white rounded-lg shadow-lg border border-[#E8DFCF] z-30 py-1 text-left text-[13px]"
                                onMouseLeave={() => setOpenMenuId(null)}
                              >
                                {!isCancelled && (
                                  <>
                                    <button
                                      onClick={() => { setOpenMenuId(null); onEditInvoice(inv); }}
                                      className="w-full px-3.5 py-2 hover:bg-[#FFFBF3] text-[#12263A] flex items-center gap-2 cursor-pointer"
                                    >
                                      <Edit3 size={14} className="text-[#14689F]" />
                                      <span>Edit invoice</span>
                                    </button>
                                    <button
                                      onClick={() => { setOpenMenuId(null); onDuplicateInvoice(inv); }}
                                      className="w-full px-3.5 py-2 hover:bg-[#FFFBF3] text-[#12263A] flex items-center gap-2 cursor-pointer"
                                    >
                                      <Copy size={14} className="text-[#1E8E5A]" />
                                      <span>Duplicate</span>
                                    </button>
                                    <button
                                      onClick={() => { setOpenMenuId(null); onCancelInvoice(inv); }}
                                      className="w-full px-3.5 py-2 hover:bg-[#FFFBF3] text-[#B7791F] flex items-center gap-2 cursor-pointer"
                                    >
                                      <X size={14} />
                                      <span>Cancel invoice</span>
                                    </button>
                                  </>
                                )}
                                <button
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    if (confirm('Delete this invoice?')) {
                                      onSoftDeleteInvoice(inv);
                                    }
                                  }}
                                  className="w-full px-3.5 py-2 hover:bg-[#FDECEC] text-[#C23B3B] flex items-center gap-2 cursor-pointer"
                                >
                                  <Trash2 size={14} />
                                  <span>Delete</span>
                                </button>
                              </div>
                            )}
                          </div>
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
