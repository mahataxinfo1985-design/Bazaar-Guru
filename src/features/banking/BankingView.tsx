import React, { useState, useMemo } from 'react';
import { 
  Landmark, Wallet, ArrowDownRight, ArrowUpRight, ArrowRightLeft, 
  CheckCircle2, Clock, AlertTriangle, FileSpreadsheet, Plus, 
  Search, Filter, Download, Printer, RefreshCw, Eye, Trash2, 
  Calendar, ShieldAlert, Check, X, ShieldCheck, MessageCircle, FileText
} from 'lucide-react';
import { 
  BankAccount, CashAccount, FundTransfer, ChequeRecord, 
  BankStatementImport, BankStatementLine, BankReconciliation, 
  PaymentVoucher, ChequeStatus 
} from '../../types/banking';
import { Party, Invoice, Purchase } from '../../types';
import { JournalEntry } from '../../types/accounting';
import { maskAccountNumber } from '../../services/banking/bankAccountService';
import { generateCashBankBookReport, exportCashBankBookCSV } from '../../services/banking/cashBankBookService';
import { computeReceivablesPayablesAgeing, generatePaymentReminderText } from '../../services/banking/ageingService';
import { computeReconciliationSummary, autoMatchBankTransactions } from '../../services/banking/reconciliationService';
import { formatCurrency } from '../../utils/formatters';

interface BankingViewProps {
  bankAccounts: BankAccount[];
  cashAccounts: CashAccount[];
  fundTransfers: FundTransfer[];
  chequeRecords: ChequeRecord[];
  paymentVouchers: PaymentVoucher[];
  bankStatements: BankStatementImport[];
  bankStatementLines: BankStatementLine[];
  bankReconciliations: BankReconciliation[];
  parties: Party[];
  invoices: Invoice[];
  purchases: Purchase[];
  journalEntries: JournalEntry[];
  onOpenReceiptModal: () => void;
  onOpenPaymentOutModal: () => void;
  onOpenTransferModal: () => void;
  onOpenAccountModal: (kind: 'bank' | 'cash', editingAccount?: BankAccount | CashAccount) => void;
  onOpenChequeActionModal: (cheque: ChequeRecord) => void;
  onOpenStatementImportModal: () => void;
  onOpenPrintVoucherModal: (voucher: PaymentVoucher) => void;
  onCancelPaymentVoucher: (voucherId: string, reason: string) => Promise<void>;
  onCancelTransfer: (transferId: string, reason: string) => Promise<void>;
  onSaveReconciliation: (recData: Partial<BankReconciliation>) => Promise<void>;
}

export const BankingView: React.FC<BankingViewProps> = ({
  bankAccounts,
  cashAccounts,
  fundTransfers,
  chequeRecords,
  paymentVouchers,
  bankStatements,
  bankStatementLines,
  bankReconciliations,
  parties,
  invoices,
  purchases,
  journalEntries,
  onOpenReceiptModal,
  onOpenPaymentOutModal,
  onOpenTransferModal,
  onOpenAccountModal,
  onOpenChequeActionModal,
  onOpenStatementImportModal,
  onOpenPrintVoucherModal,
  onCancelPaymentVoucher,
  onCancelTransfer,
  onSaveReconciliation
}) => {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'receipts' | 'payments' | 'transfers' | 'cheques' | 'reconciliation' | 'books' | 'ageing'
  >('overview');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [chequeStatusFilter, setChequeStatusFilter] = useState<string>('all');
  
  // Register Book state
  const [bookAccountId, setBookAccountId] = useState<string>(
    bankAccounts[0]?.id || cashAccounts[0]?.id || ''
  );
  const [bookDateFrom, setBookDateFrom] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [bookDateTo, setBookDateTo] = useState(
    new Date().toISOString().split('T')[0]
  );

  // Reconciliation state
  const [recBankId, setRecBankId] = useState<string>(bankAccounts[0]?.id || '');
  const [statementClosingBal, setStatementClosingBal] = useState<number>(0);
  const [recNotes, setRecNotes] = useState('');

  // Totals for Treasury Overview
  const totalBankBalance = useMemo(() => {
    return bankAccounts.reduce((acc, b) => acc + (b.currentBalance || 0), 0);
  }, [bankAccounts]);

  const totalCashBalance = useMemo(() => {
    return cashAccounts.reduce((acc, c) => acc + (c.currentBalance || 0), 0);
  }, [cashAccounts]);

  // Receipts and Payments lists
  const receiptVouchers = useMemo(() => {
    return paymentVouchers
      .filter(v => v.voucherType === 'receipt')
      .filter(v => 
        !searchQuery || 
        v.voucherNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.partyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.referenceNumber?.toLowerCase().includes(searchQuery.toLowerCase())
      );
  }, [paymentVouchers, searchQuery]);

  const paymentOutVouchers = useMemo(() => {
    return paymentVouchers
      .filter(v => v.voucherType === 'payment')
      .filter(v => 
        !searchQuery || 
        v.voucherNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.partyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.referenceNumber?.toLowerCase().includes(searchQuery.toLowerCase())
      );
  }, [paymentVouchers, searchQuery]);

  // Filtered Cheques
  const filteredCheques = useMemo(() => {
    return chequeRecords
      .filter(c => chequeStatusFilter === 'all' || c.status === chequeStatusFilter)
      .filter(c => 
        !searchQuery ||
        c.chequeNumber.includes(searchQuery) ||
        c.partyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.bankName.toLowerCase().includes(searchQuery.toLowerCase())
      );
  }, [chequeRecords, chequeStatusFilter, searchQuery]);

  // Cash / Bank Book Report
  const currentBookReport = useMemo(() => {
    if (!bookAccountId) return null;
    const selectedBank = bankAccounts.find(b => b.id === bookAccountId);
    const selectedCash = cashAccounts.find(c => c.id === bookAccountId);
    const account = selectedBank || selectedCash;
    if (!account) return null;

    const accountType = selectedBank ? 'bank' : 'cash';
    return generateCashBankBookReport({
      accountId: bookAccountId,
      accountType,
      accountName: selectedBank ? selectedBank.bankName : (selectedCash?.name || 'Cash'),
      fromDate: bookDateFrom,
      toDate: bookDateTo,
      openingBalance: account.openingBalance || 0,
      journalEntries
    });
  }, [bookAccountId, bankAccounts, cashAccounts, bookDateFrom, bookDateTo, journalEntries]);

  // Receivables & Payables Ageing Summary
  const ageingSummary = useMemo(() => {
    return computeReceivablesPayablesAgeing(parties, invoices);
  }, [parties, invoices]);

  // Reconciliation computation for selected bank
  const recSummary = useMemo(() => {
    if (!recBankId) return null;
    return computeReconciliationSummary({
      bankAccountId: recBankId,
      statementClosingBalance: Number(statementClosingBal) || 0,
      bankStatementLines,
      chequeRecords,
      journalEntries
    });
  }, [recBankId, statementClosingBal, bankStatementLines, chequeRecords, journalEntries]);

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Payments, Receipts & Banking</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Enterprise Treasury, Double-Entry Payment Allocation, Multi-Account Registers & Bank Reconciliation
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={onOpenReceiptModal}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-2xs hover:bg-emerald-700 transition cursor-pointer"
          >
            <ArrowDownRight className="w-4 h-4" />
            <span>Payment In (Receipt)</span>
          </button>
          <button
            onClick={onOpenPaymentOutModal}
            className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white shadow-2xs hover:bg-rose-700 transition cursor-pointer"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Payment Out</span>
          </button>
          <button
            onClick={onOpenTransferModal}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer shadow-2xs"
          >
            <ArrowRightLeft className="w-4 h-4 text-blue-600" />
            <span>Fund Transfer</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200 pb-2 text-xs font-bold scrollbar-none">
        {[
          { id: 'overview', label: 'Treasury Overview', icon: Landmark },
          { id: 'receipts', label: 'Payment In (Receipts)', icon: ArrowDownRight },
          { id: 'payments', label: 'Payment Out (Payments)', icon: ArrowUpRight },
          { id: 'transfers', label: 'Fund Transfers', icon: ArrowRightLeft },
          { id: 'cheques', label: 'Cheque Management', icon: FileSpreadsheet },
          { id: 'reconciliation', label: 'Bank Reconciliation', icon: CheckCircle2 },
          { id: 'books', label: 'Cash & Bank Books', icon: FileText },
          { id: 'ageing', label: 'Receivables & Payables Ageing', icon: Clock },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-2 rounded-lg flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-blue-700 text-white shadow-2xs font-bold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-700">Total Bank Balance</span>
                <Landmark className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                {formatCurrency(totalBankBalance)}
              </p>
              <p className="text-xs text-slate-500 mt-1">Across {bankAccounts.length} active bank accounts</p>
            </div>

            <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-700">Cash in Hand</span>
                <Wallet className="w-5 h-5 text-emerald-600" />
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                {formatCurrency(totalCashBalance)}
              </p>
              <p className="text-xs text-slate-500 mt-1">Main cash register and petty cash</p>
            </div>

            <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-indigo-700">Total Liquid Treasury</span>
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                {formatCurrency(totalBankBalance + totalCashBalance)}
              </p>
              <p className="text-xs text-slate-500 mt-1">Combined bank & cash reserves</p>
            </div>
          </div>

          {/* Bank Accounts Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                Bank Accounts ({bankAccounts.length})
              </h3>
              <button
                onClick={() => onOpenAccountModal('bank')}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-700 bg-blue-700/10 hover:bg-blue-700/20 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Bank Account
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {bankAccounts.map(b => (
                <div key={b.id} className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs relative overflow-hidden group">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{b.bankName}</h4>
                      <p className="text-xs font-mono text-slate-500 mt-0.5">{maskAccountNumber(b.accountNumber)}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600">
                      {b.accountType}
                    </span>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-baseline justify-between">
                    <span className="text-xs text-slate-500">Book Balance:</span>
                    <span className="text-base font-bold text-slate-900">
                      {formatCurrency(b.currentBalance)}
                    </span>
                  </div>

                  {b.ifscCode && (
                    <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
                      <span>IFSC: {b.ifscCode}</span>
                      {b.branchName && <span>{b.branchName}</span>}
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onOpenAccountModal('bank', b)}
                      className="text-xs text-blue-700 hover:underline font-medium"
                    >
                      Edit Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cash Accounts Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                Cash Accounts ({cashAccounts.length})
              </h3>
              <button
                onClick={() => onOpenAccountModal('cash')}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-700 bg-blue-700/10 hover:bg-blue-700/20 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Cash Account
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cashAccounts.map(c => (
                <div key={c.id} className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs relative group">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{c.name}</h4>
                      <p className="text-xs text-slate-500 mt-0.5 capitalize">{c.accountType.replace('_', ' ')}</p>
                    </div>
                    {c.isDefault && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600">
                        Primary
                      </span>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-baseline justify-between">
                    <span className="text-xs text-slate-500">Cash Balance:</span>
                    <span className="text-base font-bold text-slate-900">
                      {formatCurrency(c.currentBalance)}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onOpenAccountModal('cash', c)}
                      className="text-xs text-blue-700 hover:underline font-medium"
                    >
                      Edit Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PAYMENT IN (RECEIPTS) */}
      {activeTab === 'receipts' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by receipt no, customer, or UTR..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 outline-none"
              />
            </div>
            <button
              onClick={onOpenReceiptModal}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> New Receipt Voucher
            </button>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">Receipt No.</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Mode</th>
                  <th className="p-3">Ref / UTR</th>
                  <th className="p-3 text-right">Amount (₹)</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {receiptVouchers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      No receipt vouchers recorded yet.
                    </td>
                  </tr>
                ) : (
                  receiptVouchers.map(v => (
                    <tr key={v.id} className="hover:bg-slate-50:bg-slate-800/40">
                      <td className="p-3 font-mono font-bold text-slate-900">{v.voucherNumber}</td>
                      <td className="p-3 text-slate-500">{v.date}</td>
                      <td className="p-3 font-medium text-slate-800">{v.partyName || 'Walk-in'}</td>
                      <td className="p-3 uppercase text-[11px] font-semibold text-slate-600">
                        {v.paymentMode.replace('_', ' ')}
                      </td>
                      <td className="p-3 font-mono text-slate-500">{v.referenceNumber || '—'}</td>
                      <td className="p-3 text-right font-bold text-emerald-600">
                        {formatCurrency(v.amount)}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          v.status === 'posted' ? 'bg-emerald-50 text-emerald-700' :
                          v.status === 'cancelled' ? 'bg-red-50 text-red-700' :
                          'bg-amber-50 text-amber-700'
                        }`}>
                          {v.status}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-2">
                        <button
                          onClick={() => onOpenPrintVoucherModal(v)}
                          title="Print / View Voucher"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100:bg-slate-800"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        {v.status === 'posted' && (
                          <button
                            onClick={() => {
                              const reason = prompt('Please enter reason for reversing this receipt:');
                              if (reason) onCancelPaymentVoucher(v.id, reason);
                            }}
                            title="Cancel / Reverse Receipt"
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50:bg-rose-950/40"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PAYMENT OUT */}
      {activeTab === 'payments' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search payments by voucher no, supplier, or payee..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 outline-none"
              />
            </div>
            <button
              onClick={onOpenPaymentOutModal}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> New Payment Voucher
            </button>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">Voucher No.</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Payee / Supplier</th>
                  <th className="p-3">Mode</th>
                  <th className="p-3 text-right">Amount (₹)</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paymentOutVouchers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      No payment out vouchers recorded yet.
                    </td>
                  </tr>
                ) : (
                  paymentOutVouchers.map(v => (
                    <tr key={v.id} className="hover:bg-slate-50:bg-slate-800/40">
                      <td className="p-3 font-mono font-bold text-slate-900">{v.voucherNumber}</td>
                      <td className="p-3 text-slate-500">{v.date}</td>
                      <td className="p-3 uppercase text-[10px] font-bold text-slate-500">
                        {v.category?.replace('_', ' ') || 'Payment'}
                      </td>
                      <td className="p-3 font-medium text-slate-800">{v.partyName || 'Other'}</td>
                      <td className="p-3 uppercase text-[11px] font-semibold text-slate-600">
                        {v.paymentMode.replace('_', ' ')}
                      </td>
                      <td className="p-3 text-right font-bold text-rose-600">
                        {formatCurrency(v.amount)}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          v.status === 'posted' ? 'bg-emerald-50 text-emerald-700' :
                          v.status === 'cancelled' ? 'bg-red-50 text-red-700' :
                          'bg-amber-50 text-amber-700'
                        }`}>
                          {v.status}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-2">
                        <button
                          onClick={() => onOpenPrintVoucherModal(v)}
                          title="Print / View Voucher"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100:bg-slate-800"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        {v.status === 'posted' && (
                          <button
                            onClick={() => {
                              const reason = prompt('Please enter reason for reversing this payment:');
                              if (reason) onCancelPaymentVoucher(v.id, reason);
                            }}
                            title="Cancel / Reverse Payment"
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50:bg-rose-950/40"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: FUND TRANSFERS */}
      {activeTab === 'transfers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Internal Transfers & Contra Vouchers ({fundTransfers.length})
            </h3>
            <button
              onClick={onOpenTransferModal}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> New Fund Transfer
            </button>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">Transfer No.</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">From (Source)</th>
                  <th className="p-3">To (Destination)</th>
                  <th className="p-3">Mode</th>
                  <th className="p-3 text-right">Amount (₹)</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {fundTransfers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      No fund transfers recorded yet.
                    </td>
                  </tr>
                ) : (
                  fundTransfers.map(trf => {
                    const srcB = bankAccounts.find(b => b.id === trf.sourceAccountId);
                    const srcC = cashAccounts.find(c => c.id === trf.sourceAccountId);
                    const dstB = bankAccounts.find(b => b.id === trf.destinationAccountId);
                    const dstC = cashAccounts.find(c => c.id === trf.destinationAccountId);

                    return (
                      <tr key={trf.id} className="hover:bg-slate-50:bg-slate-800/40">
                        <td className="p-3 font-mono font-bold text-slate-900">{trf.transferNumber}</td>
                        <td className="p-3 text-slate-500">{trf.date}</td>
                        <td className="p-3 font-medium text-slate-700">
                          {srcB ? srcB.bankName : (srcC?.name || 'Cash')}
                        </td>
                        <td className="p-3 font-medium text-slate-700">
                          {dstB ? dstB.bankName : (dstC?.name || 'Cash')}
                        </td>
                        <td className="p-3 capitalize text-slate-500">{trf.transferMode.replace('_', ' ')}</td>
                        <td className="p-3 text-right font-bold text-blue-600">
                          {formatCurrency(trf.amount)}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            trf.status === 'completed' ? 'bg-blue-50 text-blue-700' :
                            'bg-red-50 text-red-700'
                          }`}>
                            {trf.status}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          {trf.status === 'completed' && (
                            <button
                              onClick={() => {
                                const reason = prompt('Please enter reason for cancelling transfer:');
                                if (reason) onCancelTransfer(trf.id, reason);
                              }}
                              className="text-xs text-rose-500 hover:underline"
                            >
                              Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: CHEQUE MANAGEMENT */}
      {activeTab === 'cheques' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Status Filter Buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-semibold">
              {['all', 'received', 'deposited', 'issued', 'cleared', 'bounced', 'cancelled'].map(st => (
                <button
                  key={st}
                  onClick={() => setChequeStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg capitalize transition-colors ${
                    chequeStatusFilter === st
                      ? 'bg-blue-700 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search cheque no or party..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white outline-none"
              />
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">Cheque No.</th>
                  <th className="p-3">Cheque Date</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Party Name</th>
                  <th className="p-3">Bank Name</th>
                  <th className="p-3 text-right">Amount (₹)</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCheques.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      No cheque records matching this criteria.
                    </td>
                  </tr>
                ) : (
                  filteredCheques.map(chq => (
                    <tr key={chq.id} className="hover:bg-slate-50:bg-slate-800/40">
                      <td className="p-3 font-mono font-bold text-slate-900">{chq.chequeNumber}</td>
                      <td className="p-3 text-slate-500">{chq.chequeDate}</td>
                      <td className="p-3 uppercase text-[10px] font-bold text-slate-500">
                        {chq.chequeType === 'received' ? 'Customer' : 'Issued'}
                      </td>
                      <td className="p-3 font-medium text-slate-800">{chq.partyName}</td>
                      <td className="p-3 text-slate-600">{chq.bankName}</td>
                      <td className="p-3 text-right font-bold text-slate-900">
                        {formatCurrency(chq.amount)}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          chq.status === 'cleared' ? 'bg-emerald-50 text-emerald-700' :
                          chq.status === 'bounced' ? 'bg-rose-50 text-rose-700' :
                          chq.status === 'deposited' ? 'bg-blue-50 text-blue-700' :
                          'bg-amber-50 text-amber-700'
                        }`}>
                          {chq.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {(chq.status === 'received' || chq.status === 'deposited' || chq.status === 'issued') && (
                          <button
                            onClick={() => onOpenChequeActionModal(chq)}
                            className="px-2.5 py-1 bg-blue-700 text-white rounded-lg text-xs font-semibold hover:bg-blue-700/90"
                          >
                            Action
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: BANK RECONCILIATION */}
      {activeTab === 'reconciliation' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-slate-700">Bank Account:</label>
              <select
                value={recBankId}
                onChange={(e) => setRecBankId(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-semibold text-slate-900"
              >
                {bankAccounts.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.bankName} ({maskAccountNumber(b.accountNumber)}) — Book: {formatCurrency(b.currentBalance)}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={onOpenStatementImportModal}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 flex items-center gap-1.5 shadow-2xs"
            >
              <FileSpreadsheet className="w-4 h-4" /> Import Statement (CSV/XLSX)
            </button>
          </div>

          {/* Reconciliation Equation Card */}
          {recSummary && (
            <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                  Bank Reconciliation Statement (BRS) Equation
                </h3>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  recSummary.isBalanced ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {recSummary.isBalanced ? '✓ Reconciled & Balanced' : `Difference: ${formatCurrency(recSummary.difference)}`}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[11px] text-slate-500 block">Bank Statement Closing Balance</span>
                  <input
                    type="number"
                    step="0.01"
                    value={statementClosingBal || ''}
                    onChange={(e) => setStatementClosingBal(parseFloat(e.target.value) || 0)}
                    placeholder="Enter statement closing bal"
                    className="w-full mt-1 px-2.5 py-1.5 text-sm font-bold rounded-lg border border-slate-300 bg-white text-slate-900"
                  />
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[11px] text-slate-500 block">Book Ledger Balance</span>
                  <p className="text-base font-bold text-slate-900 mt-1">
                    {formatCurrency(recSummary.bookClosingBalance)}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[11px] text-slate-500 block">Unpresented Cheques (+)</span>
                  <p className="text-base font-bold text-blue-600 mt-1">
                    +{formatCurrency(recSummary.unpresentedChequesAmount)}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[11px] text-slate-500 block">Uncredited Deposits (-)</span>
                  <p className="text-base font-bold text-rose-600 mt-1">
                    -{formatCurrency(recSummary.uncreditedDepositsAmount)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Imported Statement Transactions Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Imported Statement Lines for Selected Account
            </h4>
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs max-h-80 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 sticky top-0">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Description</th>
                    <th className="p-3">Ref No.</th>
                    <th className="p-3 text-right">Debit (Withdrawal)</th>
                    <th className="p-3 text-right">Credit (Deposit)</th>
                    <th className="p-3 text-center">Reconciled</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bankStatementLines.filter(l => l.bankAccountId === recBankId).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-400">
                        No statement lines imported for this account yet. Click "Import Statement" above to upload your bank CSV/XLSX.
                      </td>
                    </tr>
                  ) : (
                    bankStatementLines
                      .filter(l => l.bankAccountId === recBankId)
                      .map(line => (
                        <tr key={line.id} className="hover:bg-slate-50:bg-slate-800/40">
                          <td className="p-3 font-mono text-slate-500">{line.transactionDate}</td>
                          <td className="p-3 font-medium text-slate-800">{line.description}</td>
                          <td className="p-3 font-mono text-slate-500">{line.referenceNumber || '—'}</td>
                          <td className="p-3 text-right text-rose-600 font-medium">
                            {line.withdrawalAmount ? formatCurrency(line.withdrawalAmount) : '—'}
                          </td>
                          <td className="p-3 text-right text-emerald-600 font-medium">
                            {line.depositAmount ? formatCurrency(line.depositAmount) : '—'}
                          </td>
                          <td className="p-3 text-center">
                            {line.isReconciled ? (
                              <span className="text-emerald-600 font-bold">✓ Matched</span>
                            ) : (
                              <span className="text-slate-400">Pending</span>
                            )}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: CASH & BANK BOOKS */}
      {activeTab === 'books' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Select Account</label>
                <select
                  value={bookAccountId}
                  onChange={(e) => setBookAccountId(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white font-semibold"
                >
                  <optgroup label="Bank Accounts">
                    {bankAccounts.map(b => (
                      <option key={b.id} value={b.id}>{b.bankName} ({maskAccountNumber(b.accountNumber)})</option>
                    ))}
                  </optgroup>
                  <optgroup label="Cash Accounts">
                    {cashAccounts.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">From Date</label>
                <input
                  type="date"
                  value={bookDateFrom}
                  onChange={(e) => setBookDateFrom(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">To Date</label>
                <input
                  type="date"
                  value={bookDateTo}
                  onChange={(e) => setBookDateTo(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white"
                />
              </div>
            </div>

            {currentBookReport && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const csv = exportCashBankBookCSV(currentBookReport);
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${currentBookReport.accountName}_register.csv`;
                    a.click();
                  }}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" /> Export CSV
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-blue-700 hover:bg-blue-700/90 flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" /> Print Register
                </button>
              </div>
            )}
          </div>

          {currentBookReport && (
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              
              {/* Header Summary Bar */}
              <div className="p-4 bg-slate-100/60 border-b border-slate-200 flex items-center justify-between text-xs font-semibold">
                <div>
                  Register: <strong className="text-slate-900">{currentBookReport.accountName}</strong>
                </div>
                <div className="flex items-center gap-6">
                  <span>Opening: <strong>{formatCurrency(currentBookReport.openingBalance)}</strong></span>
                  <span className="text-emerald-600">Total Dr: <strong>+{formatCurrency(currentBookReport.totalDebits)}</strong></span>
                  <span className="text-rose-600">Total Cr: <strong>-{formatCurrency(currentBookReport.totalCredits)}</strong></span>
                  <span>Closing: <strong className="text-slate-900">{formatCurrency(currentBookReport.closingBalance)}</strong></span>
                </div>
              </div>

              {/* Transactions Table */}
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Voucher Ref</th>
                    <th className="p-3">Particulars / Counter-Party</th>
                    <th className="p-3">Narration</th>
                    <th className="p-3 text-right">Debit (Receipt)</th>
                    <th className="p-3 text-right">Credit (Payment)</th>
                    <th className="p-3 text-right">Running Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentBookReport.transactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        No accounting transactions posted in this date range.
                      </td>
                    </tr>
                  ) : (
                    currentBookReport.transactions.map((t, idx) => (
                      <tr key={idx} className="hover:bg-slate-50:bg-slate-800/40">
                        <td className="p-3 font-mono text-slate-500">{t.date}</td>
                        <td className="p-3 font-mono font-bold text-slate-900">{t.voucherNumber}</td>
                        <td className="p-3 font-medium text-slate-800">{t.counterParty || '—'}</td>
                        <td className="p-3 text-slate-500 max-w-xs truncate">{t.narration || '—'}</td>
                        <td className="p-3 text-right font-medium text-emerald-600">
                          {t.debitAmount ? formatCurrency(t.debitAmount) : '—'}
                        </td>
                        <td className="p-3 text-right font-medium text-rose-600">
                          {t.creditAmount ? formatCurrency(t.creditAmount) : '—'}
                        </td>
                        <td className="p-3 text-right font-bold text-slate-900">
                          {formatCurrency(t.runningBalance)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 8: RECEIVABLES & PAYABLES AGEING */}
      {activeTab === 'ageing' && (
        <div className="space-y-6">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
                  Customer Receivables
                </span>
                <span className="text-xs text-slate-400">Overdue: {formatCurrency(ageingSummary.receivables.totalOverdue)}</span>
              </div>
              <p className="text-2xl font-black text-slate-900 mt-2">
                {formatCurrency(ageingSummary.receivables.totalReceivable)}
              </p>
              
              {/* Ageing Slices */}
              <div className="mt-4 grid grid-cols-5 gap-2 text-center text-[10px]">
                <div className="p-2 rounded-lg bg-slate-50">
                  <span className="text-slate-400 block">Not Due</span>
                  <span className="font-bold">{formatCurrency(ageingSummary.receivables.buckets.notDue)}</span>
                </div>
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
                  <span className="block">1-30d</span>
                  <span className="font-bold">{formatCurrency(ageingSummary.receivables.buckets.days1_30)}</span>
                </div>
                <div className="p-2 rounded-lg bg-amber-50 text-amber-700">
                  <span className="block">31-60d</span>
                  <span className="font-bold">{formatCurrency(ageingSummary.receivables.buckets.days31_60)}</span>
                </div>
                <div className="p-2 rounded-lg bg-orange-50 text-orange-700">
                  <span className="block">61-90d</span>
                  <span className="font-bold">{formatCurrency(ageingSummary.receivables.buckets.days61_90)}</span>
                </div>
                <div className="p-2 rounded-lg bg-rose-50 text-rose-700">
                  <span className="block">&gt;90d</span>
                  <span className="font-bold">{formatCurrency(ageingSummary.receivables.buckets.above90)}</span>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">
                  Supplier Payables
                </span>
                <span className="text-xs text-slate-400">Overdue: {formatCurrency(ageingSummary.payables.totalOverdue)}</span>
              </div>
              <p className="text-2xl font-black text-slate-900 mt-2">
                {formatCurrency(ageingSummary.payables.totalPayable)}
              </p>

              {/* Ageing Slices */}
              <div className="mt-4 grid grid-cols-5 gap-2 text-center text-[10px]">
                <div className="p-2 rounded-lg bg-slate-50">
                  <span className="text-slate-400 block">Not Due</span>
                  <span className="font-bold">{formatCurrency(ageingSummary.payables.buckets.notDue)}</span>
                </div>
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
                  <span className="block">1-30d</span>
                  <span className="font-bold">{formatCurrency(ageingSummary.payables.buckets.days1_30)}</span>
                </div>
                <div className="p-2 rounded-lg bg-amber-50 text-amber-700">
                  <span className="block">31-60d</span>
                  <span className="font-bold">{formatCurrency(ageingSummary.payables.buckets.days31_60)}</span>
                </div>
                <div className="p-2 rounded-lg bg-orange-50 text-orange-700">
                  <span className="block">61-90d</span>
                  <span className="font-bold">{formatCurrency(ageingSummary.payables.buckets.days61_90)}</span>
                </div>
                <div className="p-2 rounded-lg bg-rose-50 text-rose-700">
                  <span className="block">&gt;90d</span>
                  <span className="font-bold">{formatCurrency(ageingSummary.payables.buckets.above90)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Customer Overdue List with WhatsApp Reminder Action */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Customer Receivables Ageing Breakdown & Reminders
            </h4>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Customer Name</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3 text-right">Not Due</th>
                    <th className="p-3 text-right">1-30d</th>
                    <th className="p-3 text-right">31-60d</th>
                    <th className="p-3 text-right">61-90d</th>
                    <th className="p-3 text-right">&gt;90d</th>
                    <th className="p-3 text-right">Total Balance</th>
                    <th className="p-3 text-right">Reminder Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ageingSummary.receivables.partyBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400">
                        No outstanding customer balances found.
                      </td>
                    </tr>
                  ) : (
                    ageingSummary.receivables.partyBreakdown.map(party => (
                      <tr key={party.partyId} className="hover:bg-slate-50:bg-slate-800/40">
                        <td className="p-3 font-semibold text-slate-900">{party.partyName}</td>
                        <td className="p-3 font-mono text-slate-500">{party.phone || '—'}</td>
                        <td className="p-3 text-right text-slate-500">{formatCurrency(party.buckets.notDue)}</td>
                        <td className="p-3 text-right text-slate-700 font-medium">{formatCurrency(party.buckets.days1_30)}</td>
                        <td className="p-3 text-right text-amber-600 font-medium">{formatCurrency(party.buckets.days31_60)}</td>
                        <td className="p-3 text-right text-orange-600 font-medium">{formatCurrency(party.buckets.days61_90)}</td>
                        <td className="p-3 text-right text-rose-600 font-bold">{formatCurrency(party.buckets.above90)}</td>
                        <td className="p-3 text-right font-black text-slate-900">
                          {formatCurrency(party.totalOutstanding)}
                        </td>
                        <td className="p-3 text-right">
                          {party.phone && party.totalOutstanding > 0 ? (
                            <button
                              onClick={() => {
                                const text = generatePaymentReminderText({
                                  partyName: party.partyName,
                                  amountDue: party.totalOutstanding,
                                  oldestInvoiceDate: party.oldestInvoiceDate,
                                  businessName: 'Invoice Pro Enterprise'
                                });
                                const cleanPhone = party.phone?.replace(/[^0-9]/g, '');
                                window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`, '_blank');
                              }}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1 shadow-2xs"
                            >
                              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                            </button>
                          ) : (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
