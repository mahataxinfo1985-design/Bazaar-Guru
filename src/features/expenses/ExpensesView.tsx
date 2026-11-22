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
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-950">Expense Management</h2>
          <p className="text-sm text-slate-500">Track operating expenses, vendor payments, and attach receipts.</p>
        </div>
        <div className="flex items-center gap-3">
          <ExportDropdown
            label="Export Expenses"
            options={[{ label: 'Export as CSV', onClick: handleExportCSV }]}
          />
          <button
            onClick={onAddExpense}
            className="flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white shadow-2xs hover:bg-blue-800 transition cursor-pointer"
          >
            <Plus size={16} /> Add Expense
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Expenses</p>
          <p className="text-2xl font-bold text-slate-900 mt-1 font-mono">
            ₹{expenses.reduce((sum, e) => sum + e.amount, 0).toLocaleString('en-IN')}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">This Month</p>
          <p className="text-2xl font-bold text-slate-900 mt-1 font-mono">
            ₹{currentMonthExpenses.toLocaleString('en-IN')}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Top Category</p>
          <p className="text-lg font-bold text-slate-900 mt-2 truncate">{topCategory}</p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                <th className="p-4">Date</th>
                <th className="p-4">Category</th>
                <th className="p-4">Vendor</th>
                <th className="p-4">Payment Mode</th>
                <th className="p-4 text-right">Amount (₹)</th>
                <th className="p-4 text-center">Receipt</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No expenses recorded yet. Click "Add Expense" to start tracking.
                  </td>
                </tr>
              ) : (
                expenses
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-medium text-slate-900">{exp.date}</td>
                      <td className="p-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                          {exp.category}
                        </span>
                      </td>
                      <td className="p-4 font-semibold text-slate-800">
                        {exp.vendorName}
                        {exp.description && (
                          <span className="block text-[10px] text-slate-400 font-normal truncate max-w-[150px]">
                            {exp.description}
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-slate-600">{exp.paymentMode}</td>
                      <td className="p-4 text-right font-bold font-mono text-slate-950">
                        ₹{exp.amount.toLocaleString('en-IN')}
                        {exp.gstAmount && exp.gstAmount > 0 && (
                          <span className="block text-[9px] text-slate-400 font-normal">incl. ₹{exp.gstAmount} GST</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        {exp.receiptUrl ? (
                          <a
                            href={exp.receiptUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                            title="View Receipt"
                          >
                            <FileText size={14} />
                          </a>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => onEditExpense(exp)}
                            className="p-1 hover:bg-blue-50 rounded text-slate-400 hover:text-blue-600 transition"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            onClick={() => onDeleteExpense(exp.id)}
                            className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-600 transition"
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
