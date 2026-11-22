import React from 'react';
import { X, Printer, Download, User, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Party, Invoice } from '../../types';
import { PaymentVoucher } from '../../types/accounting';
import { buildPartyLedger } from '../../services/accounting/partyLedger';
import { convertToCSV, downloadCSV } from '../../utils/exportHelpers';

interface PartyLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  party: Party | null;
  invoices: Invoice[];
  vouchers: PaymentVoucher[];
}

export default function PartyLedgerModal({
  isOpen,
  onClose,
  party,
  invoices,
  vouchers,
}: PartyLedgerModalProps) {
  if (!isOpen || !party) return null;

  const { entries, totalInvoiced, totalPaid, closingBalance, closingBalanceType } =
    buildPartyLedger(party, invoices, vouchers);

  const handleExportCSV = () => {
    const csvRows = entries.map((e) => ({
      Date: e.date,
      Type: e.type,
      Reference: e.referenceNumber,
      Narration: e.narration,
      'Debit (₹)': e.debit || 0,
      'Credit (₹)': e.credit || 0,
      'Balance (₹)': `${e.runningBalance} ${e.balanceType}`,
    }));
    const csv = convertToCSV(csvRows);
    downloadCSV(csv, `${party.name.replace(/\s+/g, '_')}_Statement_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handlePrint = () => {
    window.print();
  };

  const isCustomer = party.type === 'customer';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-4xl rounded-xl bg-white shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-100 bg-slate-900 px-6 text-white no-print">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white font-bold">
              <User size={18} />
            </div>
            <div>
              <h2 className="font-bold text-sm md:text-base leading-tight">{party.name}</h2>
              <p className="text-[10px] text-slate-400 font-mono">
                {party.type.toUpperCase()} LEDGER • GSTIN: {party.gstin || 'Unregistered'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition cursor-pointer"
            >
              <Download size={14} />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition cursor-pointer"
            >
              <Printer size={14} />
              <span className="hidden sm:inline">Print Statement</span>
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition ml-2"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Balance Summary Header Cards */}
        <div className="bg-slate-50 border-b border-slate-200 p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              {isCustomer ? 'Total Sales Invoiced' : 'Total Bills Received'}
            </p>
            <p className="text-lg font-bold text-slate-900 font-mono mt-1">₹{totalInvoiced.toLocaleString('en-IN')}</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              {isCustomer ? 'Total Payment Received' : 'Total Payment Disbursed'}
            </p>
            <p className="text-lg font-bold text-emerald-600 font-mono mt-1">₹{totalPaid.toLocaleString('en-IN')}</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Closing Outstanding Balance</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xl font-bold font-mono text-slate-950">
                ₹{closingBalance.toLocaleString('en-IN')}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  closingBalanceType === 'Dr'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {closingBalanceType === 'Dr' ? 'Dr (Receivable)' : 'Cr (Payable)'}
              </span>
            </div>
          </div>
        </div>

        {/* Ledger Transactions Table */}
        <div className="flex-1 overflow-y-auto p-6">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="pb-3">Date</th>
                <th className="pb-3">Doc Type</th>
                <th className="pb-3">Ref / Inv #</th>
                <th className="pb-3">Particulars / Narration</th>
                <th className="pb-3 text-right">Debit (₹)</th>
                <th className="pb-3 text-right">Credit (₹)</th>
                <th className="pb-3 text-right">Balance (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No transactions recorded for this party yet.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 font-medium text-slate-700">{entry.date}</td>
                    <td className="py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                          entry.type === 'Invoice'
                            ? 'bg-blue-50 text-blue-700'
                            : entry.type === 'Payment'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {entry.type}
                      </span>
                    </td>
                    <td className="py-3 font-mono font-bold text-slate-900">{entry.referenceNumber}</td>
                    <td className="py-3 text-slate-600 max-w-[200px] truncate" title={entry.narration}>
                      {entry.narration}
                    </td>
                    <td className="py-3 text-right font-mono font-semibold text-slate-800">
                      {entry.debit > 0 ? `₹${entry.debit.toLocaleString('en-IN')}` : '-'}
                    </td>
                    <td className="py-3 text-right font-mono font-semibold text-slate-800">
                      {entry.credit > 0 ? `₹${entry.credit.toLocaleString('en-IN')}` : '-'}
                    </td>
                    <td className="py-3 text-right font-mono font-bold text-slate-950">
                      ₹{entry.runningBalance.toLocaleString('en-IN')}{' '}
                      <span className="text-[10px] text-slate-400">{entry.balanceType}</span>
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
