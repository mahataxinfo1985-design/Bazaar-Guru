import React from 'react';
import { Plus, Receipt, FileText, Trash2, Edit3 } from 'lucide-react';
import { Expense } from '../../types';
import ExportDropdown from '../../components/shared/ExportDropdown';
import { convertToCSV, downloadCSV } from '../../utils/exportHelpers';

interface ExpensesViewProps {
  expenses: Expense[];
  onAddExpense: () => void;
  onEditExpense: (exp: Expense) => void;
  onDeleteExpense: (id: string) => void;
}

export default function ExpensesView({
  expenses,
  onAddExpense,
  onEditExpense,
  onDeleteExpense,
}: ExpensesViewProps) {
  const handleExportCSV = () => {
    const csv = convertToCSV(expenses);
    downloadCSV(csv, `expenses_export_${Date.now()}.csv`);
  };

  const currentMonthExpenses = expenses
    .filter((e) => new Date(e.date).getMonth() === new Date().getMonth())
    .reduce((sum, e) => sum + e.amount, 0);

  const topCategory = (() => {
    if (expenses.length === 0) return 'N/A';
    const counts = expenses.reduce((acc, curr) => {
      acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
      return acc;
    }, {} as Record<string, number>);
    return Object.keys(counts).reduce((a, b) => (counts[a] > counts[b] ? a : b));
  })();

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#12263A]">Expense Management</h2>
          <p className="text-xs text-[#3E5368] mt-0.5">Track operating expenses, vendor payments, and attach receipts.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <ExportDropdown
            label="Export Expenses"
            options={[{ label: 'Export as CSV', onClick: handleExportCSV }]}
          />
          <button
            onClick={onAddExpense}
            className="flex items-center gap-1.5 rounded-lg bg-[#E0771A] hover:bg-[#B85D0F] px-4 py-2 text-xs font-semibold text-white shadow-2xs transition-all cursor-pointer"
          >
            <Plus size={15} /> Add Expense
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <div className="rounded-xl border border-[#E8DFCF] bg-white p-4 shadow-2xs">
          <p className="text-[11px] font-semibold text-[#3E5368]">Total Expenses</p>
          <p className="text-xl font-bold text-[#12263A] mt-1 tabular-nums">
            ₹{expenses.reduce((sum, e) => sum + e.amount, 0).toLocaleString('en-IN')}
          </p>
        </div>
        <div className="rounded-xl border border-[#E8DFCF] bg-white p-4 shadow-2xs">
          <p className="text-[11px] font-semibold text-[#3E5368]">This Month</p>
          <p className="text-xl font-bold text-[#12263A] mt-1 tabular-nums">
            ₹{currentMonthExpenses.toLocaleString('en-IN')}
          </p>
        </div>
        <div className="rounded-xl border border-[#E8DFCF] bg-white p-4 shadow-2xs">
          <p className="text-[11px] font-semibold text-[#3E5368]">Top Category</p>
          <p className="text-lg font-bold text-[#12263A] mt-1.5 truncate">{topCategory}</p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[#E8DFCF] bg-white shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#FFFBF3] border-b border-[#E8DFCF] text-[#3E5368] text-[10px] font-semibold tracking-wider">
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Category</th>
                <th className="p-3.5">Vendor</th>
                <th className="p-3.5">Payment Mode</th>
                <th className="p-3.5 text-right">Amount (₹)</th>
                <th className="p-3.5 text-center">Receipt</th>
                <th className="p-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8DFCF]">
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[#3E5368]">
                    No expenses recorded yet. Click "Add Expense" to start tracking.
                  </td>
                </tr>
              ) : (
                expenses
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((exp) => (
                    <tr key={exp.id} className="hover:bg-[#FFFBF3] transition-colors">
                      <td className="p-3.5 text-[#3E5368]">{exp.date}</td>
                      <td className="p-3.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-semibold bg-[#EEF2F6] text-[#3E5368]">
                          {exp.category}
                        </span>
                      </td>
                      <td className="p-3.5 font-medium text-[#12263A]">
                        {exp.vendorName}
                        {exp.description && (
                          <span className="block text-[11px] text-[#3E5368] font-normal truncate max-w-[150px]">
                            {exp.description}
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-[#3E5368]">{exp.paymentMode}</td>
                      <td className="p-3.5 text-right font-bold tabular-nums text-[#12263A]">
                        ₹{exp.amount.toLocaleString('en-IN')}
                        {exp.gstAmount && exp.gstAmount > 0 && (
                          <span className="block text-[10px] text-[#3E5368] font-normal">incl. ₹{exp.gstAmount} GST</span>
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        {exp.receiptUrl ? (
                          <a
                            href={exp.receiptUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center p-1.5 bg-[#EAF5FD] text-[#1F86CC] rounded-md hover:bg-[#D4EBFA] transition"
                            title="View Receipt"
                          >
                            <FileText size={14} />
                          </a>
                        ) : (
                          <span className="text-[#3E5368]/40">-</span>
                        )}
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => onEditExpense(exp)}
                            className="p-1.5 hover:bg-[#EAF5FD] rounded-md text-[#3E5368] hover:text-[#1F86CC] transition cursor-pointer"
                            title="Edit Expense"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this expense?')) {
                                onDeleteExpense(exp.id);
                              }
                            }}
                            className="p-1.5 hover:bg-[#FDECEC] rounded-md text-[#3E5368] hover:text-[#C23B3B] transition cursor-pointer"
                            title="Delete Expense"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
