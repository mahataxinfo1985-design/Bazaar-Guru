import React, { useState } from 'react';
import { X, Printer, Download, BookOpen, Calendar, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Account, JournalEntry } from '../../types/accounting';
import { getAccountLedger } from '../../services/accounting/accountingService';
import { convertToCSV, downloadCSV } from '../../utils/exportHelpers';

interface AccountLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
  accounts: Account[];
  journalEntries: JournalEntry[];
}

export default function AccountLedgerModal({
  isOpen,
  onClose,
  accountId,
  accounts,
  journalEntries,
}: AccountLedgerModalProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  if (!isOpen || !accountId) return null;

  const statement = getAccountLedger(accountId, accounts, journalEntries, startDate, endDate);
  if (!statement) return null;

  const { account, openingBalance, totalDebit, totalCredit, closingBalance, normalBalance, rows } = statement;

  const handleExportCSV = () => {
    const csvRows = rows.map((r) => ({
      Date: r.date,
      'Voucher #': r.entryNumber,
      'Source Type': r.sourceType,
      Narration: r.narration,
      Party: r.partyName || '-',
      'Debit (₹)': r.debit || '',
      'Credit (₹)': r.credit || '',
      'Running Balance (₹)': r.runningBalance,
    }));
    const csv = convertToCSV(csvRows);
    downloadCSV(csv, `Account_Ledger_${account.code}_${account.name.replace(/\s+/g, '_')}.csv`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-5xl rounded-xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[95vh] border border-slate-100">
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-200 bg-slate-900 px-6 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600/30 text-blue-400 font-bold border border-blue-500/30">
              <BookOpen size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-slate-800 text-blue-400 font-bold">
                  {account.code}
                </span>
                <h2 className="text-base font-bold text-white tracking-tight">{account.name}</h2>
              </div>
              <p className="text-[11px] text-slate-400">
                General Ledger Statement | Category: <span className="uppercase text-slate-300 font-semibold">{account.type}</span> ({account.subtype})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700 transition cursor-pointer"
            >
              <Download size={13} /> Export CSV
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700 transition cursor-pointer"
            >
              <Printer size={13} /> Print
            </button>
            <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Filters & Balance Strip */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 shrink-0">
          {/* Date range filters */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-bold uppercase text-[10px]">Filter Period:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-800 focus:outline-hidden font-mono"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-800 focus:outline-hidden font-mono"
            />
            {(startDate || endDate) && (
              <button
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-6 font-mono text-xs">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Opening</span>
              <span className="font-bold text-slate-700">₹{openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })} {normalBalance}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Debit</span>
              <span className="font-bold text-blue-700">₹{totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Credit</span>
              <span className="font-bold text-emerald-700">₹{totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="pl-4 border-l border-slate-200">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Closing Balance</span>
              <span className="font-bold text-sm text-slate-900">
                ₹{closingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })} {normalBalance}
              </span>
            </div>
          </div>
        </div>

        {/* Statement Table */}
        <div className="flex-1 overflow-y-auto p-6 bg-white">
          {rows.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              No journal transactions recorded for this account in the selected period.
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                  <th className="p-3">Date</th>
                  <th className="p-3">Voucher #</th>
                  <th className="p-3">Source</th>
                  <th className="p-3">Narration / Particulars</th>
                  <th className="p-3">Party Reference</th>
                  <th className="p-3 text-right">Debit (₹)</th>
                  <th className="p-3 text-right">Credit (₹)</th>
                  <th className="p-3 text-right">Running Balance (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-mono text-slate-600 text-[11px]">{row.date}</td>
                    <td className="p-3 font-mono font-bold text-blue-700 text-[11px]">{row.entryNumber}</td>
                    <td className="p-3">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                        {row.sourceType.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="p-3 text-slate-800 font-medium max-w-xs truncate" title={row.narration}>
                      {row.narration}
                    </td>
                    <td className="p-3 text-slate-600">{row.partyName || '-'}</td>
                    <td className="p-3 text-right font-mono text-slate-900">
                      {row.debit > 0 ? `₹${row.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td className="p-3 text-right font-mono text-slate-900">
                      {row.credit > 0 ? `₹${row.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900">
                      ₹{row.runningBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })} {normalBalance}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
