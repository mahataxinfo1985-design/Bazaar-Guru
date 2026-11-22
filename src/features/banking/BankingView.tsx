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
      .filter(chq => {
        if (chequeStatusFilter !== 'all' && chq.status !== chequeStatusFilter) return false;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          return (
            chq.chequeNumber.toLowerCase().includes(q) ||
            chq.partyName?.toLowerCase().includes(q) ||
            chq.bankName?.toLowerCase().includes(q)
          );
        }
        return true;
      });
  }, [chequeRecords, chequeStatusFilter, searchQuery]);

  // Current Book Report for Cash & Bank Books
  const currentBookReport = useMemo(() => {
    if (!bookAccountId) return null;
    const selectedBank = bankAccounts.find(b => b.id === bookAccountId);
    const selectedCash = cashAccounts.find(c => c.id === bookAccountId);
    const account = selectedBank || selectedCash;
    if (!account) return null;

    return generateCashBankBookReport({
      accountId: bookAccountId,
      accountName: selectedBank ? selectedBank.bankName : (selectedCash?.name || 'Cash'),
      accountType: selectedBank ? 'bank' : 'cash',
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
    <div className="space-y-5 animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#12263A] tracking-tight">Payments, Receipts & Banking</h2>
          <p className="text-xs text-[#3E5368] mt-0.5">
            Enterprise treasury, double-entry payment allocation, multi-account registers & bank reconciliation.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onOpenReceiptModal}
            className="flex items-center gap-1.5 rounded-lg bg-[#E0771A] hover:bg-[#B85D0F] px-4 py-2 text-xs font-semibold text-white shadow-2xs transition cursor-pointer"
          >
            <ArrowDownRight className="w-4 h-4" />
            <span>Payment In (Receipt)</span>
          </button>
          <button
            onClick={onOpenPaymentOutModal}
            className="flex items-center gap-1.5 rounded-lg border border-[#E8DFCF] bg-white px-3.5 py-2 text-xs font-semibold text-[#12263A] hover:bg-[#FFFBF3] transition cursor-pointer shadow-2xs"
          >
            <ArrowUpRight className="w-4 h-4 text-[#C23B3B]" />
            <span>Payment Out</span>
          </button>
          <button
            onClick={onOpenTransferModal}
            className="flex items-center gap-1.5 rounded-lg border border-[#E8DFCF] bg-white px-3.5 py-2 text-xs font-semibold text-[#12263A] hover:bg-[#FFFBF3] transition cursor-pointer shadow-2xs"
          >
            <ArrowRightLeft className="w-4 h-4 text-[#1F86CC]" />
            <span>Fund Transfer</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-[#E8DFCF] pb-2 text-xs font-semibold scrollbar-none">
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
              className={`px-3 py-2 rounded-lg flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#EAF5FD] text-[#1F86CC] border border-[#3BA0E6]/30 shadow-2xs font-semibold'
                  : 'text-[#3E5368] hover:bg-[#FFFBF3] hover:text-[#12263A]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <div className="p-4 rounded-xl bg-white border border-[#E8DFCF] shadow-2xs">
              <div className="flex items-center justify-between text-[#3E5368]">
                <span className="text-[11px] font-semibold">Total Bank Balance</span>
                <Landmark className="w-4 h-4 text-[#1F86CC]" />
              </div>
              <p className="text-xl font-bold tabular-nums text-[#12263A] mt-1.5">
                {formatCurrency(totalBankBalance)}
              </p>
              <p className="text-[11px] text-[#3E5368]/80 mt-1">Across {bankAccounts.length} active bank accounts</p>
            </div>

            <div className="p-4 rounded-xl bg-white border border-[#E8DFCF] shadow-2xs">
              <div className="flex items-center justify-between text-[#3E5368]">
                <span className="text-[11px] font-semibold">Cash in Hand</span>
                <Wallet className="w-4 h-4 text-[#1E8E5A]" />
              </div>
              <p className="text-xl font-bold tabular-nums text-[#12263A] mt-1.5">
                {formatCurrency(totalCashBalance)}
              </p>
              <p className="text-[11px] text-[#3E5368]/80 mt-1">Main cash register & petty cash</p>
            </div>

            <div className="p-4 rounded-xl bg-white border border-[#E8DFCF] shadow-2xs">
              <div className="flex items-center justify-between text-[#3E5368]">
                <span className="text-[11px] font-semibold">Total Liquid Treasury</span>
                <ShieldCheck className="w-4 h-4 text-[#E0771A]" />
              </div>
              <p className="text-xl font-bold tabular-nums text-[#12263A] mt-1.5">
                {formatCurrency(totalBankBalance + totalCashBalance)}
              </p>
              <p className="text-[11px] text-[#3E5368]/80 mt-1">Combined bank & cash reserves</p>
            </div>
          </div>

          {/* Bank Accounts Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#12263A]">
                Bank Accounts ({bankAccounts.length})
              </h3>
              <button
                onClick={() => onOpenAccountModal('bank')}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#1F86CC] bg-[#EAF5FD] border border-[#3BA0E6]/30 hover:bg-[#D4EBFA] flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Bank Account
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {bankAccounts.map(b => (
                <div key={b.id} className="p-4 rounded-xl bg-white border border-[#E8DFCF] shadow-2xs relative group hover:border-[#3BA0E6]/40 transition">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-[#12263A] text-sm">{b.bankName}</h4>
                      <p className="text-xs text-[#3E5368] mt-0.5">{maskAccountNumber(b.accountNumber)}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-sm text-[10px] font-semibold uppercase bg-[#EEF2F6] text-[#3E5368] border border-[#E8DFCF]">
                      {b.accountType}
                    </span>
                  </div>

                  <div className="mt-3.5 pt-2.5 border-t border-[#E8DFCF] flex items-baseline justify-between">
                    <span className="text-xs text-[#3E5368]">Book Balance:</span>
                    <span className="text-sm font-bold tabular-nums text-[#12263A]">
                      {formatCurrency(b.currentBalance)}
                    </span>
                  </div>

                  {b.ifscCode && (
                    <div className="text-[11px] text-[#3E5368]/80 mt-1 flex items-center justify-between">
                      <span>IFSC: {b.ifscCode}</span>
                      {b.branchName && <span>{b.branchName}</span>}
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-end gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onOpenAccountModal('bank', b)}
                      className="text-xs text-[#1F86CC] hover:underline font-semibold cursor-pointer"
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
              <h3 className="text-xs font-bold text-[#12263A]">
                Cash Accounts ({cashAccounts.length})
              </h3>
              <button
                onClick={() => onOpenAccountModal('cash')}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#1F86CC] bg-[#EAF5FD] border border-[#3BA0E6]/30 hover:bg-[#D4EBFA] flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Cash Account
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {cashAccounts.map(c => (
                <div key={c.id} className="p-4 rounded-xl bg-white border border-[#E8DFCF] shadow-2xs relative group hover:border-[#3BA0E6]/40 transition">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-[#12263A] text-sm">{c.name}</h4>
                      <p className="text-xs text-[#3E5368] mt-0.5 capitalize">{c.accountType.replace('_', ' ')}</p>
                    </div>
                    {c.isDefault && (
                      <span className="px-2 py-0.5 rounded-sm text-[10px] font-semibold bg-[#E6F6EE] text-[#1E8E5A] border border-[#1E8E5A]/20">
                        Primary
                      </span>
                    )}
                  </div>

                  <div className="mt-3.5 pt-2.5 border-t border-[#E8DFCF] flex items-baseline justify-between">
                    <span className="text-xs text-[#3E5368]">Cash Balance:</span>
                    <span className="text-sm font-bold tabular-nums text-[#12263A]">
                      {formatCurrency(c.currentBalance)}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-end gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onOpenAccountModal('cash', c)}
                      className="text-xs text-[#1F86CC] hover:underline font-semibold cursor-pointer"
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#3E5368]" />
              <input
                type="text"
                placeholder="Search by receipt no, customer, or UTR..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 h-10 text-xs rounded-lg border border-[#E8DFCF] bg-[#FFFBF3] text-[#12263A] placeholder-[#3E5368]/60 focus:bg-white focus:outline-hidden focus:border-[#3BA0E6] focus:ring-1 focus:ring-[#3BA0E6]"
              />
            </div>
            <button
              onClick={onOpenReceiptModal}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#E0771A] hover:bg-[#B85D0F] flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" /> New Receipt Voucher
            </button>
          </div>

          <div className="border border-[#E8DFCF] rounded-xl overflow-hidden bg-white shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FFFBF3] text-[#3E5368] font-semibold border-b border-[#E8DFCF]">
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
              <tbody className="divide-y divide-[#E8DFCF]">
                {receiptVouchers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-[#3E5368]">
                      No receipt vouchers recorded yet.
                    </td>
                  </tr>
                ) : (
                  receiptVouchers.map(v => (
                    <tr key={v.id} className="hover:bg-[#FFFBF3] transition">
                      <td className="p-3 font-semibold text-[#12263A]">{v.voucherNumber}</td>
                      <td className="p-3 text-[#3E5368]">{v.date}</td>
                      <td className="p-3 font-medium text-[#12263A]">{v.partyName || 'Walk-in'}</td>
                      <td className="p-3 uppercase text-[11px] font-semibold text-[#3E5368]">
                        {v.paymentMode.replace('_', ' ')}
                      </td>
                      <td className="p-3 text-[#3E5368]">{v.referenceNumber || '—'}</td>
                      <td className="p-3 text-right font-bold tabular-nums text-[#1E8E5A]">
                        {formatCurrency(v.amount)}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-sm text-[10px] font-semibold uppercase ${
                          v.status === 'posted' ? 'bg-[#E6F6EE] text-[#1E8E5A] border border-[#1E8E5A]/20' :
                          v.status === 'cancelled' ? 'bg-[#FDECEC] text-[#C23B3B] border border-[#C23B3B]/20' :
                          'bg-[#FFF3DC] text-[#B7791F] border border-[#B7791F]/20'
                        }`}>
                          {v.status}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-1.5">
                        <button
                          onClick={() => onOpenPrintVoucherModal(v)}
                          title="Print / View Voucher"
                          className="p-1.5 rounded-md text-[#3E5368] hover:text-[#12263A] hover:bg-[#EAF5FD] cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        {v.status === 'posted' && (
                          <button
                            onClick={() => {
                              const reason = prompt('Please enter reason for reversing this receipt:');
                              if (reason) onCancelPaymentVoucher(v.id, reason);
                            }}
                            title="Cancel / Reverse Receipt"
                            className="p-1.5 rounded-md text-[#C23B3B] hover:bg-[#FDECEC] cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#3E5368]" />
              <input
                type="text"
                placeholder="Search payments by voucher no, supplier, or payee..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 h-10 text-xs rounded-lg border border-[#E8DFCF] bg-[#FFFBF3] text-[#12263A] placeholder-[#3E5368]/60 focus:bg-white focus:outline-hidden focus:border-[#3BA0E6] focus:ring-1 focus:ring-[#3BA0E6]"
              />
            </div>
            <button
              onClick={onOpenPaymentOutModal}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#E0771A] hover:bg-[#B85D0F] flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" /> New Payment Voucher
            </button>
          </div>

          <div className="border border-[#E8DFCF] rounded-xl overflow-hidden bg-white shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FFFBF3] text-[#3E5368] font-semibold border-b border-[#E8DFCF]">
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
              <tbody className="divide-y divide-[#E8DFCF]">
                {paymentOutVouchers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-[#3E5368]">
                      No payment out vouchers recorded yet.
                    </td>
                  </tr>
                ) : (
                  paymentOutVouchers.map(v => (
                    <tr key={v.id} className="hover:bg-[#FFFBF3] transition">
                      <td className="p-3 font-semibold text-[#12263A]">{v.voucherNumber}</td>
                      <td className="p-3 text-[#3E5368]">{v.date}</td>
                      <td className="p-3 uppercase text-[10px] font-semibold text-[#3E5368]">
                        {v.category?.replace('_', ' ') || 'Payment'}
                      </td>
                      <td className="p-3 font-medium text-[#12263A]">{v.partyName || 'Other'}</td>
                      <td className="p-3 uppercase text-[11px] font-semibold text-[#3E5368]">
                        {v.paymentMode.replace('_', ' ')}
                      </td>
                      <td className="p-3 text-right font-bold tabular-nums text-[#C23B3B]">
                        {formatCurrency(v.amount)}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-sm text-[10px] font-semibold uppercase ${
                          v.status === 'posted' ? 'bg-[#E6F6EE] text-[#1E8E5A] border border-[#1E8E5A]/20' :
                          v.status === 'cancelled' ? 'bg-[#FDECEC] text-[#C23B3B] border border-[#C23B3B]/20' :
                          'bg-[#FFF3DC] text-[#B7791F] border border-[#B7791F]/20'
                        }`}>
                          {v.status}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-1.5">
                        <button
                          onClick={() => onOpenPrintVoucherModal(v)}
                          title="Print / View Voucher"
                          className="p-1.5 rounded-md text-[#3E5368] hover:text-[#12263A] hover:bg-[#EAF5FD] cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        {v.status === 'posted' && (
                          <button
                            onClick={() => {
                              const reason = prompt('Please enter reason for reversing this payment:');
                              if (reason) onCancelPaymentVoucher(v.id, reason);
                            }}
                            title="Cancel / Reverse Payment"
                            className="p-1.5 rounded-md text-[#C23B3B] hover:bg-[#FDECEC] cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
            <h3 className="text-xs font-bold text-[#12263A]">
              Internal Transfers & Contra Vouchers ({fundTransfers.length})
            </h3>
            <button
              onClick={onOpenTransferModal}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#E0771A] hover:bg-[#B85D0F] flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" /> New Fund Transfer
            </button>
          </div>

          <div className="border border-[#E8DFCF] rounded-xl overflow-hidden bg-white shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FFFBF3] text-[#3E5368] font-semibold border-b border-[#E8DFCF]">
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
              <tbody className="divide-y divide-[#E8DFCF]">
                {fundTransfers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-[#3E5368]">
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
                      <tr key={trf.id} className="hover:bg-[#FFFBF3] transition">
                        <td className="p-3 font-semibold text-[#1F86CC]">{trf.transferNumber}</td>
                        <td className="p-3 text-[#3E5368]">{trf.date}</td>
                        <td className="p-3 font-medium text-[#12263A]">
                          {srcB ? srcB.bankName : (srcC?.name || 'Cash')}
                        </td>
                        <td className="p-3 font-medium text-[#12263A]">
                          {dstB ? dstB.bankName : (dstC?.name || 'Cash')}
                        </td>
                        <td className="p-3 capitalize text-[#3E5368]">{trf.transferMode.replace('_', ' ')}</td>
                        <td className="p-3 text-right font-bold tabular-nums text-[#1F86CC]">
                          {formatCurrency(trf.amount)}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded-sm text-[10px] font-semibold uppercase ${
                            trf.status === 'completed' ? 'bg-[#EAF5FD] text-[#1F86CC] border border-[#3BA0E6]/30' :
                            'bg-[#FDECEC] text-[#C23B3B] border border-[#C23B3B]/20'
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
                              className="text-xs text-[#C23B3B] hover:underline font-semibold cursor-pointer"
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
                  className={`px-3 py-1.5 rounded-lg capitalize transition-colors cursor-pointer ${
                    chequeStatusFilter === st
                      ? 'bg-[#EAF5FD] text-[#1F86CC] border border-[#3BA0E6]/30 shadow-2xs'
                      : 'bg-[#FFFBF3] border border-[#E8DFCF] text-[#3E5368] hover:bg-[#EEF2F6]'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#3E5368]" />
              <input
                type="text"
                placeholder="Search cheque no or party..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 h-9 text-xs rounded-lg border border-[#E8DFCF] bg-[#FFFBF3] text-[#12263A] placeholder-[#3E5368]/60 focus:bg-white focus:outline-hidden focus:border-[#3BA0E6]"
              />
            </div>
          </div>

          <div className="border border-[#E8DFCF] rounded-xl overflow-hidden bg-white shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FFFBF3] text-[#3E5368] font-semibold border-b border-[#E8DFCF]">
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
              <tbody className="divide-y divide-[#E8DFCF]">
                {filteredCheques.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-[#3E5368]">
                      No cheque records matching this criteria.
                    </td>
                  </tr>
                ) : (
                  filteredCheques.map(chq => (
                    <tr key={chq.id} className="hover:bg-[#FFFBF3] transition">
                      <td className="p-3 font-semibold text-[#12263A]">{chq.chequeNumber}</td>
                      <td className="p-3 text-[#3E5368]">{chq.chequeDate}</td>
                      <td className="p-3 uppercase text-[10px] font-semibold text-[#3E5368]">
                        {chq.chequeType === 'received' ? 'Customer' : 'Issued'}
                      </td>
                      <td className="p-3 font-medium text-[#12263A]">{chq.partyName}</td>
                      <td className="p-3 text-[#3E5368]">{chq.bankName}</td>
                      <td className="p-3 text-right font-bold tabular-nums text-[#12263A]">
                        {formatCurrency(chq.amount)}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-sm text-[10px] font-semibold uppercase ${
                          chq.status === 'cleared' ? 'bg-[#E6F6EE] text-[#1E8E5A] border border-[#1E8E5A]/20' :
                          chq.status === 'bounced' ? 'bg-[#FDECEC] text-[#C23B3B] border border-[#C23B3B]/20' :
                          chq.status === 'deposited' ? 'bg-[#EAF5FD] text-[#1F86CC] border border-[#3BA0E6]/30' :
                          'bg-[#FFF3DC] text-[#B7791F] border border-[#B7791F]/20'
                        }`}>
                          {chq.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {(chq.status === 'received' || chq.status === 'deposited' || chq.status === 'issued') && (
                          <button
                            onClick={() => onOpenChequeActionModal(chq)}
                            className="px-2.5 py-1 bg-[#1F86CC] text-white rounded-md text-xs font-semibold hover:bg-[#14689F] cursor-pointer"
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
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-white rounded-xl border border-[#E8DFCF] shadow-2xs">
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-[#12263A]">Bank Account:</label>
              <select
                value={recBankId}
                onChange={(e) => setRecBankId(e.target.value)}
                className="h-10 px-3 text-xs rounded-lg border border-[#E8DFCF] bg-[#FFFBF3] font-semibold text-[#12263A] focus:outline-hidden focus:border-[#3BA0E6]"
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
              className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#E0771A] hover:bg-[#B85D0F] flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" /> Import Statement (CSV/XLSX)
            </button>
          </div>

          {/* Reconciliation Equation Card */}
          {recSummary && (
            <div className="p-4 rounded-xl bg-white border border-[#E8DFCF] shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#E8DFCF] pb-2.5">
                <h3 className="text-xs font-bold text-[#12263A]">
                  Bank Reconciliation Statement (BRS) Equation
                </h3>
                <span className={`px-2.5 py-0.5 rounded-sm text-xs font-semibold ${
                  recSummary.isBalanced ? 'bg-[#E6F6EE] text-[#1E8E5A] border border-[#1E8E5A]/20' : 'bg-[#FFF3DC] text-[#B7791F] border border-[#B7791F]/20'
                }`}>
                  {recSummary.isBalanced ? '✓ Reconciled & Balanced' : `Difference: ${formatCurrency(recSummary.difference)}`}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="p-3 rounded-lg bg-[#FFFBF3] border border-[#E8DFCF]">
                  <span className="text-[11px] text-[#3E5368] block">Bank Statement Closing Balance</span>
                  <input
                    type="number"
                    step="0.01"
                    value={statementClosingBal || ''}
                    onChange={(e) => setStatementClosingBal(parseFloat(e.target.value) || 0)}
                    placeholder="Enter statement closing bal"
                    className="w-full mt-1 px-2.5 py-1 text-sm font-bold tabular-nums rounded-md border border-[#E8DFCF] bg-white text-[#12263A] focus:outline-hidden focus:border-[#3BA0E6]"
                  />
                </div>

                <div className="p-3 rounded-lg bg-[#FFFBF3] border border-[#E8DFCF]">
                  <span className="text-[11px] text-[#3E5368] block">Book Ledger Balance</span>
                  <p className="text-base font-bold tabular-nums text-[#12263A] mt-1">
                    {formatCurrency(recSummary.bookClosingBalance)}
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-[#FFFBF3] border border-[#E8DFCF]">
                  <span className="text-[11px] text-[#3E5368] block">Unpresented Cheques (+)</span>
                  <p className="text-base font-bold tabular-nums text-[#1F86CC] mt-1">
                    +{formatCurrency(recSummary.unpresentedChequesAmount)}
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-[#FFFBF3] border border-[#E8DFCF]">
                  <span className="text-[11px] text-[#3E5368] block">Uncredited Deposits (-)</span>
                  <p className="text-base font-bold tabular-nums text-[#C23B3B] mt-1">
                    -{formatCurrency(recSummary.uncreditedDepositsAmount)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Imported Statement Transactions Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-[#12263A]">
              Imported Statement Lines for Selected Account
            </h4>
            <div className="border border-[#E8DFCF] rounded-xl overflow-hidden bg-white shadow-2xs max-h-80 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FFFBF3] text-[#3E5368] font-semibold sticky top-0 border-b border-[#E8DFCF]">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Description</th>
                    <th className="p-3">Ref No.</th>
                    <th className="p-3 text-right">Debit (Withdrawal)</th>
                    <th className="p-3 text-right">Credit (Deposit)</th>
                    <th className="p-3 text-center">Reconciled</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8DFCF]">
                  {bankStatementLines.filter(l => l.bankAccountId === recBankId).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-[#3E5368]">
                        No statement lines imported for this account yet. Click "Import Statement" above to upload your bank CSV/XLSX.
                      </td>
                    </tr>
                  ) : (
                    bankStatementLines
                      .filter(l => l.bankAccountId === recBankId)
                      .map(line => (
                        <tr key={line.id} className="hover:bg-[#FFFBF3] transition">
                          <td className="p-3 text-[#3E5368]">{line.transactionDate}</td>
                          <td className="p-3 font-medium text-[#12263A]">{line.description}</td>
                          <td className="p-3 text-[#3E5368]">{line.referenceNumber || '—'}</td>
                          <td className="p-3 text-right text-[#C23B3B] font-medium tabular-nums">
                            {line.withdrawalAmount ? formatCurrency(line.withdrawalAmount) : '—'}
                          </td>
                          <td className="p-3 text-right text-[#1E8E5A] font-medium tabular-nums">
                            {line.depositAmount ? formatCurrency(line.depositAmount) : '—'}
                          </td>
                          <td className="p-3 text-center">
                            {line.isReconciled ? (
                              <span className="text-[#1E8E5A] font-semibold">✓ Matched</span>
                            ) : (
                              <span className="text-[#3E5368]">Pending</span>
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
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 bg-white rounded-xl border border-[#E8DFCF] shadow-2xs">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="text-[10px] font-semibold text-[#3E5368] uppercase block mb-1">Select Account</label>
                <select
                  value={bookAccountId}
                  onChange={(e) => setBookAccountId(e.target.value)}
                  className="h-9 px-3 text-xs rounded-lg border border-[#E8DFCF] bg-[#FFFBF3] text-[#12263A] font-semibold focus:outline-hidden focus:border-[#3BA0E6]"
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
                <label className="text-[10px] font-semibold text-[#3E5368] uppercase block mb-1">From Date</label>
                <input
                  type="date"
                  value={bookDateFrom}
                  onChange={(e) => setBookDateFrom(e.target.value)}
                  className="h-9 px-3 text-xs rounded-lg border border-[#E8DFCF] bg-[#FFFBF3] text-[#12263A] focus:outline-hidden focus:border-[#3BA0E6]"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-[#3E5368] uppercase block mb-1">To Date</label>
                <input
                  type="date"
                  value={bookDateTo}
                  onChange={(e) => setBookDateTo(e.target.value)}
                  className="h-9 px-3 text-xs rounded-lg border border-[#E8DFCF] bg-[#FFFBF3] text-[#12263A] focus:outline-hidden focus:border-[#3BA0E6]"
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
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold text-[#12263A] bg-white border border-[#E8DFCF] hover:bg-[#FFFBF3] flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-[#1F86CC]" /> Export CSV
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-[#E0771A] hover:bg-[#B85D0F] flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Printer className="w-4 h-4" /> Print Register
                </button>
              </div>
            )}
          </div>

          {currentBookReport && (
            <div className="border border-[#E8DFCF] rounded-xl overflow-hidden bg-white shadow-2xs">
              
              {/* Header Summary Bar */}
              <div className="p-3.5 bg-[#FFFBF3] border-b border-[#E8DFCF] flex items-center justify-between text-xs font-semibold">
                <div>
                  Register: <strong className="text-[#12263A]">{currentBookReport.accountName}</strong>
                </div>
                <div className="flex items-center gap-5">
                  <span>Opening: <strong className="tabular-nums">{formatCurrency(currentBookReport.openingBalance)}</strong></span>
                  <span className="text-[#1E8E5A]">Total Dr: <strong className="tabular-nums">+{formatCurrency(currentBookReport.totalDebits)}</strong></span>
                  <span className="text-[#C23B3B]">Total Cr: <strong className="tabular-nums">-{formatCurrency(currentBookReport.totalCredits)}</strong></span>
                  <span>Closing: <strong className="text-[#12263A] tabular-nums">{formatCurrency(currentBookReport.closingBalance)}</strong></span>
                </div>
              </div>

              {/* Transactions Table */}
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FFFBF3] text-[#3E5368] font-semibold border-b border-[#E8DFCF]">
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
                <tbody className="divide-y divide-[#E8DFCF]">
                  {currentBookReport.transactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-[#3E5368]">
                        No accounting transactions posted in this date range.
                      </td>
                    </tr>
                  ) : (
                    currentBookReport.transactions.map((t, idx) => (
                      <tr key={idx} className="hover:bg-[#FFFBF3] transition">
                        <td className="p-3 text-[#3E5368]">{t.date}</td>
                        <td className="p-3 font-semibold text-[#12263A]">{t.voucherNumber}</td>
                        <td className="p-3 font-medium text-[#12263A]">{t.counterParty || '—'}</td>
                        <td className="p-3 text-[#3E5368] max-w-xs truncate">{t.narration || '—'}</td>
                        <td className="p-3 text-right font-medium text-[#1E8E5A] tabular-nums">
                          {t.debitAmount ? formatCurrency(t.debitAmount) : '—'}
                        </td>
                        <td className="p-3 text-right font-medium text-[#C23B3B] tabular-nums">
                          {t.creditAmount ? formatCurrency(t.creditAmount) : '—'}
                        </td>
                        <td className="p-3 text-right font-bold text-[#12263A] tabular-nums">
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
        <div className="space-y-5">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div className="p-4 rounded-xl bg-white border border-[#E8DFCF] shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#1E8E5A]">
                  Customer Receivables
                </span>
                <span className="text-xs text-[#3E5368]">Overdue: {formatCurrency(ageingSummary.receivables.totalOverdue)}</span>
              </div>
              <p className="text-xl font-bold tabular-nums text-[#12263A] mt-1.5">
                {formatCurrency(ageingSummary.receivables.totalReceivable)}
              </p>
              
              {/* Ageing Slices */}
              <div className="mt-3.5 grid grid-cols-5 gap-1.5 text-center text-[10px]">
                <div className="p-2 rounded-lg bg-[#FFFBF3] border border-[#E8DFCF]">
                  <span className="text-[#3E5368] block">Not Due</span>
                  <span className="font-bold tabular-nums">{formatCurrency(ageingSummary.receivables.buckets.notDue)}</span>
                </div>
                <div className="p-2 rounded-lg bg-[#E6F6EE] text-[#1E8E5A] border border-[#1E8E5A]/20">
                  <span className="block">1-30d</span>
                  <span className="font-bold tabular-nums">{formatCurrency(ageingSummary.receivables.buckets.days1_30)}</span>
                </div>
                <div className="p-2 rounded-lg bg-[#FFF3DC] text-[#B7791F] border border-[#B7791F]/20">
                  <span className="block">31-60d</span>
                  <span className="font-bold tabular-nums">{formatCurrency(ageingSummary.receivables.buckets.days31_60)}</span>
                </div>
                <div className="p-2 rounded-lg bg-[#FFF8EC] text-[#E0771A] border border-[#E0771A]/20">
                  <span className="block">61-90d</span>
                  <span className="font-bold tabular-nums">{formatCurrency(ageingSummary.receivables.buckets.days61_90)}</span>
                </div>
                <div className="p-2 rounded-lg bg-[#FDECEC] text-[#C23B3B] border border-[#C23B3B]/20">
                  <span className="block">&gt;90d</span>
                  <span className="font-bold tabular-nums">{formatCurrency(ageingSummary.receivables.buckets.above90)}</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-[#E8DFCF] shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#C23B3B]">
                  Supplier Payables
                </span>
                <span className="text-xs text-[#3E5368]">Overdue: {formatCurrency(ageingSummary.payables.totalOverdue)}</span>
              </div>
              <p className="text-xl font-bold tabular-nums text-[#12263A] mt-1.5">
                {formatCurrency(ageingSummary.payables.totalPayable)}
              </p>

              {/* Ageing Slices */}
              <div className="mt-3.5 grid grid-cols-5 gap-1.5 text-center text-[10px]">
                <div className="p-2 rounded-lg bg-[#FFFBF3] border border-[#E8DFCF]">
                  <span className="text-[#3E5368] block">Not Due</span>
                  <span className="font-bold tabular-nums">{formatCurrency(ageingSummary.payables.buckets.notDue)}</span>
                </div>
                <div className="p-2 rounded-lg bg-[#E6F6EE] text-[#1E8E5A] border border-[#1E8E5A]/20">
                  <span className="block">1-30d</span>
                  <span className="font-bold tabular-nums">{formatCurrency(ageingSummary.payables.buckets.days1_30)}</span>
                </div>
                <div className="p-2 rounded-lg bg-[#FFF3DC] text-[#B7791F] border border-[#B7791F]/20">
                  <span className="block">31-60d</span>
                  <span className="font-bold tabular-nums">{formatCurrency(ageingSummary.payables.buckets.days31_60)}</span>
                </div>
                <div className="p-2 rounded-lg bg-[#FFF8EC] text-[#E0771A] border border-[#E0771A]/20">
                  <span className="block">61-90d</span>
                  <span className="font-bold tabular-nums">{formatCurrency(ageingSummary.payables.buckets.days61_90)}</span>
                </div>
                <div className="p-2 rounded-lg bg-[#FDECEC] text-[#C23B3B] border border-[#C23B3B]/20">
                  <span className="block">&gt;90d</span>
                  <span className="font-bold tabular-nums">{formatCurrency(ageingSummary.payables.buckets.above90)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Customer Overdue List with WhatsApp Reminder Action */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-[#12263A]">
              Customer Receivables Ageing Breakdown & Reminders
            </h4>

            <div className="border border-[#E8DFCF] rounded-xl overflow-hidden bg-white shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FFFBF3] text-[#3E5368] font-semibold border-b border-[#E8DFCF]">
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
                <tbody className="divide-y divide-[#E8DFCF]">
                  {ageingSummary.receivables.partyBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-[#3E5368]">
                        No outstanding customer balances found.
                      </td>
                    </tr>
                  ) : (
                    ageingSummary.receivables.partyBreakdown.map(party => (
                      <tr key={party.partyId} className="hover:bg-[#FFFBF3] transition">
                        <td className="p-3 font-semibold text-[#12263A]">{party.partyName}</td>
                        <td className="p-3 text-[#3E5368]">{party.phone || '—'}</td>
                        <td className="p-3 text-right text-[#3E5368] tabular-nums">{formatCurrency(party.buckets.notDue)}</td>
                        <td className="p-3 text-right text-[#12263A] font-medium tabular-nums">{formatCurrency(party.buckets.days1_30)}</td>
                        <td className="p-3 text-right text-[#B7791F] font-medium tabular-nums">{formatCurrency(party.buckets.days31_60)}</td>
                        <td className="p-3 text-right text-[#E0771A] font-medium tabular-nums">{formatCurrency(party.buckets.days61_90)}</td>
                        <td className="p-3 text-right text-[#C23B3B] font-bold tabular-nums">{formatCurrency(party.buckets.above90)}</td>
                        <td className="p-3 text-right font-bold text-[#12263A] tabular-nums">
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
                                  businessName: 'Bazaar-Guru'
                                });
                                const cleanPhone = party.phone?.replace(/[^0-9]/g, '');
                                window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`, '_blank');
                              }}
                              className="px-2.5 py-1 bg-[#1E8E5A] hover:bg-[#1E8E5A]/90 text-white rounded-md text-xs font-semibold inline-flex items-center gap-1 shadow-2xs cursor-pointer"
                            >
                              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                            </button>
                          ) : (
                            <span className="text-[#3E5368] text-[11px]">—</span>
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
