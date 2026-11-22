import React, { useState } from 'react';
import { 
  BookOpen, DollarSign, ArrowUpRight, ArrowDownRight, Layers, FileSpreadsheet,
  Plus, Search, Filter, ShieldCheck, Lock, Unlock, Eye, Calendar, RefreshCw, AlertCircle, CheckCircle2
} from 'lucide-react';
import { Account, JournalEntry, PaymentVoucher, AccountingPeriod, Party, Invoice, Expense } from '../../types';
import { getAccountingOverviewMetrics, getComputedAccountBalances } from '../../services/accounting/accountingService';
import { lockPeriod, reopenPeriod, getFinancialYearName } from '../../services/accounting/periodService';
import { canDeleteAccount } from '../../services/accounting/chartOfAccounts';
import { migrateExistingBusinessData, MigrationSummary } from '../../services/accounting/migration';
import { formatCurrency } from '../../utils/decimal';

// Modals
import AccountModal from '../../components/modals/AccountModal';
import JournalVoucherModal from '../../components/modals/JournalVoucherModal';
import AccountLedgerModal from '../../components/modals/AccountLedgerModal';

interface AccountingViewProps {
  accounts: Account[];
  journalEntries: JournalEntry[];
  paymentVouchers: PaymentVoucher[];
  accountingPeriods: AccountingPeriod[];
  parties: Party[];
  invoices: Invoice[];
  expenses: Expense[];
  onOpenPaymentModal: (type: 'payment_in' | 'payment_out') => void;
  onSaveAccount: (account: Account) => void;
  onDeactivateAccount: (accountId: string) => void;
  onSaveJournalEntry: (entry: JournalEntry) => void;
  onUpdatePeriods: (periods: AccountingPeriod[]) => void;
  onApplyMigratedJournals: (journals: JournalEntry[]) => void;
}

export default function AccountingView({
  accounts,
  journalEntries,
  paymentVouchers,
  accountingPeriods,
  parties,
  invoices,
  expenses,
  onOpenPaymentModal,
  onSaveAccount,
  onDeactivateAccount,
  onSaveJournalEntry,
  onUpdatePeriods,
  onApplyMigratedJournals,
}: AccountingViewProps) {
  // Navigation & Sub-views
  const [activeTab, setActiveTab] = useState<'coa' | 'journals' | 'cashbank' | 'periods'>('coa');
  
  // Modals state
  const [accountModal, setAccountModal] = useState<{ isOpen: boolean; accountToEdit: Account | null }>({
    isOpen: false,
    accountToEdit: null,
  });
  const [isJournalModalOpen, setIsJournalModalOpen] = useState(false);
  const [selectedLedgerAccountId, setSelectedLedgerAccountId] = useState<string | null>(null);
  const [viewingJournalEntry, setViewingJournalEntry] = useState<JournalEntry | null>(null);

  // Filters
  const [coaCategoryFilter, setCoaCategoryFilter] = useState<string>('all');
  const [coaSearchQuery, setCoaSearchQuery] = useState('');
  const [journalSourceFilter, setJournalSourceFilter] = useState<string>('all');
  const [journalDateFilter, setJournalDateFilter] = useState('');

  // Migration summary modal
  const [migrationResult, setMigrationResult] = useState<MigrationSummary | null>(null);

  // Compute live accounting overview from single source of truth
  const overview = getAccountingOverviewMetrics(accounts, journalEntries);
  const liveAccounts = getComputedAccountBalances(accounts, journalEntries);

  // Filtered COA accounts
  const filteredAccounts = liveAccounts.filter((acc) => {
    if (coaCategoryFilter !== 'all' && acc.type !== coaCategoryFilter) return false;
    if (coaSearchQuery.trim()) {
      const q = coaSearchQuery.toLowerCase();
      return acc.name.toLowerCase().includes(q) || acc.code.toLowerCase().includes(q);
    }
    return true;
  });

  // Filtered Journal Entries
  const filteredJournals = journalEntries.filter((je) => {
    if (journalSourceFilter !== 'all' && je.sourceType !== journalSourceFilter) return false;
    if (journalDateFilter && je.date !== journalDateFilter) return false;
    return true;
  });

  // Handle Historical Migration trigger
  const handleRunMigration = () => {
    const summary = migrateExistingBusinessData(invoices, expenses, parties, accounts, journalEntries);
    setMigrationResult(summary);
    if (summary.generatedEntries.length > 0) {
      onApplyMigratedJournals(summary.generatedEntries);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header with Quick Actions */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Double-Entry Accounting & General Ledger
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
              Phase 2 Engine
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time multi-business Chart of Accounts, balanced journal vouchers, and audit-grade ledgers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setAccountModal({ isOpen: true, accountToEdit: null })}
            className="flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 px-3 py-2 text-xs font-bold text-white shadow-2xs transition cursor-pointer"
          >
            <Plus size={14} />
            <span>New Account</span>
          </button>

          <button
            onClick={() => setIsJournalModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 px-3 py-2 text-xs font-bold text-white shadow-2xs transition cursor-pointer"
          >
            <Plus size={14} />
            <span>Journal Voucher</span>
          </button>

          <button
            onClick={handleRunMigration}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 shadow-2xs transition cursor-pointer"
            title="Scan and create balanced journals for any unposted legacy transactions"
          >
            <RefreshCw size={13} />
            <span>Reconcile & Migrate</span>
          </button>
        </div>
      </div>

      {/* 1. High-Level Accounting Metrics Strip (Single Source of Truth) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Assets</span>
          <p className="text-base font-bold font-mono text-slate-900 mt-0.5">{formatCurrency(overview.totalAssets)}</p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Liabilities</span>
          <p className="text-base font-bold font-mono text-amber-700 mt-0.5">{formatCurrency(overview.totalLiabilities)}</p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Equity</span>
          <p className="text-base font-bold font-mono text-purple-700 mt-0.5">{formatCurrency(overview.totalEquity)}</p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Income</span>
          <p className="text-base font-bold font-mono text-emerald-700 mt-0.5">{formatCurrency(overview.totalIncome)}</p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Expenses</span>
          <p className="text-base font-bold font-mono text-rose-700 mt-0.5">{formatCurrency(overview.totalExpenses)}</p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Net Profit</span>
          <p className={`text-base font-bold font-mono mt-0.5 ${overview.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {formatCurrency(overview.netProfit)}
          </p>
        </div>
      </div>

      {/* Trial Balance Health Banner */}
      <div className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
        overview.isTrialBalanceBalanced 
          ? 'bg-emerald-50 text-emerald-900 border-emerald-200' 
          : 'bg-red-50 text-red-900 border-red-200'
      }`}>
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${overview.isTrialBalanceBalanced ? 'bg-emerald-600' : 'bg-red-600'}`}></span>
          <span className="font-bold">
            {overview.isTrialBalanceBalanced 
              ? 'Double-Entry Invariant Satisfied: All Journals Balanced (Debits == Credits)' 
              : `Accounting Discrepancy Detected: Out of balance by ₹${overview.trialBalanceDifference.toFixed(2)}`}
          </span>
        </div>
        <div className="flex items-center gap-4 font-mono font-bold text-xs">
          <span>Receivables (A/R): {formatCurrency(overview.currentReceivables)}</span>
          <span>Payables (A/P): {formatCurrency(overview.currentPayables)}</span>
          <span>Cash/Bank: {formatCurrency(overview.cashAndBankBalance)}</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('coa')}
          className={`px-4 py-2.5 text-xs font-bold uppercase border-b-2 transition cursor-pointer ${
            activeTab === 'coa' ? 'border-blue-700 text-blue-700' : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          Chart of Accounts ({accounts.length})
        </button>
        <button
          onClick={() => setActiveTab('journals')}
          className={`px-4 py-2.5 text-xs font-bold uppercase border-b-2 transition cursor-pointer ${
            activeTab === 'journals' ? 'border-blue-700 text-blue-700' : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          Journal Entries ({journalEntries.length})
        </button>
        <button
          onClick={() => setActiveTab('cashbank')}
          className={`px-4 py-2.5 text-xs font-bold uppercase border-b-2 transition cursor-pointer ${
            activeTab === 'cashbank' ? 'border-blue-700 text-blue-700' : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          Cash & Bank Registers ({paymentVouchers.length} Vouchers)
        </button>
        <button
          onClick={() => setActiveTab('periods')}
          className={`px-4 py-2.5 text-xs font-bold uppercase border-b-2 transition cursor-pointer ${
            activeTab === 'periods' ? 'border-blue-700 text-blue-700' : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          Financial Periods ({accountingPeriods.length})
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: CHART OF ACCOUNTS */}
      {/* ======================================================== */}
      {activeTab === 'coa' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search code or account name..."
                  value={coaSearchQuery}
                  onChange={(e) => setCoaSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <select
                value={coaCategoryFilter}
                onChange={(e) => setCoaCategoryFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-hidden"
              >
                <option value="all">All Categories</option>
                <option value="asset">1. Assets</option>
                <option value="liability">2. Liabilities</option>
                <option value="equity">3. Equity</option>
                <option value="income">4. Income</option>
                <option value="expense">5. Expenses</option>
              </select>
            </div>

            <span className="text-xs text-slate-500 font-semibold self-end sm:self-center">
              Showing {filteredAccounts.length} of {accounts.length} accounts
            </span>
          </div>

          {/* Accounts Table */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                  <th className="p-3.5">Code</th>
                  <th className="p-3.5">Account Name</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5">Subtype</th>
                  <th className="p-3.5 text-right">Opening (₹)</th>
                  <th className="p-3.5 text-right">Current Balance (₹)</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAccounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-slate-800">{acc.code}</td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-1.5">
                        {acc.level && acc.level > 1 && (
                          <span className="text-slate-300 font-mono">{'— '.repeat(acc.level - 1)}</span>
                        )}
                        <span className={`font-bold ${acc.level === 1 ? 'text-slate-950 font-extrabold' : 'text-slate-800'}`}>
                          {acc.name}
                        </span>
                        {acc.isSystem && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-slate-100 text-slate-500 font-bold uppercase">
                            Sys
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                        acc.type === 'asset'
                          ? 'bg-blue-50 text-blue-700'
                          : acc.type === 'liability'
                          ? 'bg-amber-50 text-amber-700'
                          : acc.type === 'income'
                          ? 'bg-emerald-50 text-emerald-700'
                          : acc.type === 'expense'
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-purple-50 text-purple-700'
                      }`}>
                        {acc.type}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-500 capitalize">{acc.subtype.replace(/_/g, ' ')}</td>
                    <td className="p-3.5 text-right font-mono text-slate-600">
                      {acc.openingBalance ? `₹${acc.openingBalance.toLocaleString('en-IN')}` : '-'}
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-slate-900">
                      {formatCurrency(acc.currentBalance)}
                    </td>
                    <td className="p-3.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                        acc.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'
                      }`}>
                        {acc.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="p-3.5 text-right space-x-2">
                      <button
                        onClick={() => setSelectedLedgerAccountId(acc.id)}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 transition cursor-pointer"
                        title="View Account Ledger"
                      >
                        Ledger
                      </button>
                      <button
                        onClick={() => setAccountModal({ isOpen: true, accountToEdit: acc })}
                        className="text-xs font-bold text-slate-600 hover:text-slate-900 transition cursor-pointer"
                        title="Edit Account"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: JOURNAL ENTRIES REGISTER */}
      {/* ======================================================== */}
      {activeTab === 'journals' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={journalSourceFilter}
                onChange={(e) => setJournalSourceFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-hidden"
              >
                <option value="all">All Journal Sources</option>
                <option value="sales_invoice">Sales Invoices</option>
                <option value="purchase_invoice">Purchase Bills</option>
                <option value="payment_in">Payment Receipts (In)</option>
                <option value="payment_out">Payment Disbursements (Out)</option>
                <option value="expense">Operating Expenses</option>
                <option value="sales_return">Sales Returns (Credit Notes)</option>
                <option value="purchase_return">Purchase Returns (Debit Notes)</option>
                <option value="journal_voucher">Manual Journal Vouchers</option>
                <option value="opening_balance">Opening Balances</option>
              </select>

              <input
                type="date"
                value={journalDateFilter}
                onChange={(e) => setJournalDateFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-hidden font-mono"
              />
              {journalDateFilter && (
                <button
                  onClick={() => setJournalDateFilter('')}
                  className="text-xs text-blue-600 font-bold hover:text-blue-800 cursor-pointer"
                >
                  Clear Date
                </button>
              )}
            </div>

            <span className="text-xs text-slate-500 font-semibold self-end sm:self-center">
              {filteredJournals.length} Journal Entries Recorded
            </span>
          </div>

          {/* Journal Entries Table */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Voucher #</th>
                  <th className="p-3.5">Source Type</th>
                  <th className="p-3.5">Narration / Description</th>
                  <th className="p-3.5 text-right">Debit (₹)</th>
                  <th className="p-3.5 text-right">Credit (₹)</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredJournals.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      No matching journal entries found.
                    </td>
                  </tr>
                ) : (
                  filteredJournals.map((je) => (
                    <tr key={je.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 font-mono text-slate-600">{je.date}</td>
                      <td className="p-3.5 font-mono font-bold text-blue-700">{je.entryNumber}</td>
                      <td className="p-3.5">
                        <span className="inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-100 text-slate-700">
                          {je.sourceType.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-800 max-w-xs truncate" title={je.narration}>
                        {je.narration}
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(je.totalDebit)}
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(je.totalCredit)}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-100">
                          {je.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => setViewingJournalEntry(je)}
                          className="text-xs font-bold text-blue-600 hover:text-blue-800 transition cursor-pointer"
                        >
                          View Lines ({je.lines?.length || 0})
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: CASH & BANK REGISTERS */}
      {/* ======================================================== */}
      {activeTab === 'cashbank' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
              <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">Cash in Hand (1010)</span>
              <h3 className="text-2xl font-bold font-mono text-slate-900 mt-1">
                {formatCurrency(liveAccounts.find((a) => a.code === '1010')?.currentBalance || 0)}
              </h3>
              <p className="text-xs text-slate-500 mt-1">Reflects all cash sales, receipts, and petty cash disbursements.</p>
              <div className="mt-4 pt-3 border-t border-slate-100">
                <button
                  onClick={() => {
                    const acc = accounts.find((a) => a.code === '1010');
                    if (acc) setSelectedLedgerAccountId(acc.id);
                  }}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                >
                  View Cash Book Ledger →
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
              <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">Bank Accounts (1020)</span>
              <h3 className="text-2xl font-bold font-mono text-blue-700 mt-1">
                {formatCurrency(liveAccounts.find((a) => a.code === '1020')?.currentBalance || 0)}
              </h3>
              <p className="text-xs text-slate-500 mt-1">Reflects NEFT, RTGS, IMPS, UPI, and bank transfers.</p>
              <div className="mt-4 pt-3 border-t border-slate-100">
                <button
                  onClick={() => {
                    const acc = accounts.find((a) => a.code === '1020');
                    if (acc) setSelectedLedgerAccountId(acc.id);
                  }}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                >
                  View Bank Book Ledger →
                </button>
              </div>
            </div>
          </div>

          {/* Vouchers Table */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">Payment Vouchers (In & Out)</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => onOpenPaymentModal('payment_in')}
                  className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 hover:bg-emerald-100 cursor-pointer"
                >
                  <DollarSign size={13} /> + Payment In
                </button>
                <button
                  onClick={() => onOpenPaymentModal('payment_out')}
                  className="flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded border border-blue-200 hover:bg-blue-100 cursor-pointer"
                >
                  <DollarSign size={13} /> + Payment Out
                </button>
              </div>
            </div>

            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                  <th className="p-3.5">Voucher #</th>
                  <th className="p-3.5">Type</th>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Party</th>
                  <th className="p-3.5">Payment Mode</th>
                  <th className="p-3.5 text-right">Amount (₹)</th>
                  <th className="p-3.5">Reference #</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paymentVouchers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      No payment vouchers recorded yet.
                    </td>
                  </tr>
                ) : (
                  paymentVouchers.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3.5 font-mono font-bold text-slate-900">{v.voucherNumber}</td>
                      <td className="p-3.5">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                          v.type === 'payment_in'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : 'bg-blue-50 text-blue-700 border border-blue-100'
                        }`}>
                          {v.type === 'payment_in' ? 'Payment In' : 'Payment Out'}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-slate-600">{v.date}</td>
                      <td className="p-3.5 font-bold text-slate-800">{v.partyName || 'Party'}</td>
                      <td className="p-3.5 text-slate-600">{v.paymentMode}</td>
                      <td className="p-3.5 text-right font-mono font-bold text-slate-950">
                        {formatCurrency(v.amount)}
                      </td>
                      <td className="p-3.5 font-mono text-slate-500">{v.referenceNumber || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: FINANCIAL PERIODS & AUDIT LOCK */}
      {/* ======================================================== */}
      {activeTab === 'periods' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Financial Years (Indian April–March Period)</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Locking an accounting period prevents any accidental backdated journal postings from altering audited balances.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                  <th className="p-3.5">Period Name</th>
                  <th className="p-3.5">Start Date</th>
                  <th className="p-3.5">End Date</th>
                  <th className="p-3.5 text-center">Audit Status</th>
                  <th className="p-3.5 text-right">Lock / Unlock Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {accountingPeriods.map((period) => (
                  <tr key={period.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3.5 font-bold text-slate-900">{period.name}</td>
                    <td className="p-3.5 font-mono text-slate-600">{period.startDate}</td>
                    <td className="p-3.5 font-mono text-slate-600">{period.endDate}</td>
                    <td className="p-3.5 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                        period.status === 'open'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : period.status === 'locked'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {period.status === 'open' ? <Unlock size={10} /> : <Lock size={10} />}
                        <span>{period.status}</span>
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      {period.status === 'open' ? (
                        <button
                          onClick={() => {
                            if (confirm(`Lock ${period.name}? No transactions dated between ${period.startDate} and ${period.endDate} can be posted until unlocked.`)) {
                              const updated = lockPeriod(period.id, accountingPeriods);
                              onUpdatePeriods(updated);
                            }
                          }}
                          className="px-3 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs transition cursor-pointer border border-amber-200"
                        >
                          Lock Period
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            const reason = prompt(`Enter authorized justification reason to reopen ${period.name}:`);
                            if (reason && reason.trim()) {
                              const updated = reopenPeriod(period.id, accountingPeriods, reason.trim());
                              onUpdatePeriods(updated);
                            }
                          }}
                          className="px-3 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs transition cursor-pointer border border-emerald-200"
                        >
                          Reopen Period
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: Account Add / Edit Modal */}
      {/* ======================================================== */}
      <AccountModal
        isOpen={accountModal.isOpen}
        onClose={() => setAccountModal({ isOpen: false, accountToEdit: null })}
        onSave={(acc) => {
          onSaveAccount(acc);
          setAccountModal({ isOpen: false, accountToEdit: null });
        }}
        onDeactivate={onDeactivateAccount}
        accountToEdit={accountModal.accountToEdit}
        existingAccounts={accounts}
        journalEntries={journalEntries}
      />

      {/* ======================================================== */}
      {/* MODAL 2: Manual Journal Voucher Creation Modal */}
      {/* ======================================================== */}
      <JournalVoucherModal
        isOpen={isJournalModalOpen}
        onClose={() => setIsJournalModalOpen(false)}
        onSave={onSaveJournalEntry}
        accounts={accounts}
        parties={parties}
      />

      {/* ======================================================== */}
      {/* MODAL 3: Account Ledger Statement Modal */}
      {/* ======================================================== */}
      {selectedLedgerAccountId && (
        <AccountLedgerModal
          isOpen={!!selectedLedgerAccountId}
          onClose={() => setSelectedLedgerAccountId(null)}
          accountId={selectedLedgerAccountId}
          accounts={accounts}
          journalEntries={journalEntries}
        />
      )}

      {/* ======================================================== */}
      {/* MODAL 4: Journal Entry Detail Viewer */}
      {/* ======================================================== */}
      {viewingJournalEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
            <div className="flex h-14 items-center justify-between border-b border-slate-200 bg-slate-900 px-6 text-white">
              <span className="font-bold text-sm uppercase tracking-wide">
                Journal Entry #{viewingJournalEntry.entryNumber}
              </span>
              <button
                onClick={() => setViewingJournalEntry(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Date</span>
                  <span className="font-mono font-bold text-slate-800">{viewingJournalEntry.date}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Source</span>
                  <span className="font-bold uppercase text-slate-800">{viewingJournalEntry.sourceType}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Narration</span>
                  <span className="text-slate-700">{viewingJournalEntry.narration}</span>
                </div>
              </div>

              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                    <th className="p-2.5">Account</th>
                    <th className="p-2.5">Party</th>
                    <th className="p-2.5">Particulars</th>
                    <th className="p-2.5 text-right">Debit (₹)</th>
                    <th className="p-2.5 text-right">Credit (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {viewingJournalEntry.lines.map((l) => (
                    <tr key={l.id}>
                      <td className="p-2.5 font-bold text-slate-800">
                        {l.accountCode} - {l.accountName}
                      </td>
                      <td className="p-2.5 text-slate-600">{l.partyName || '-'}</td>
                      <td className="p-2.5 text-slate-500">{l.description || '-'}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                        {l.debit > 0 ? formatCurrency(l.debit) : '-'}
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                        {l.credit > 0 ? formatCurrency(l.credit) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-mono font-bold text-xs border-t-2 border-slate-200">
                    <td colSpan={3} className="p-2.5 text-right uppercase text-[10px] text-slate-600">Total:</td>
                    <td className="p-2.5 text-right text-blue-700">{formatCurrency(viewingJournalEntry.totalDebit)}</td>
                    <td className="p-2.5 text-right text-blue-700">{formatCurrency(viewingJournalEntry.totalCredit)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 5: Migration Summary Dialog */}
      {/* ======================================================== */}
      {migrationResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
            <div className="flex h-14 items-center justify-between border-b border-slate-200 bg-slate-900 px-6 text-white">
              <span className="font-bold text-sm uppercase tracking-wide">
                Historical Data Migration Audit Summary
              </span>
              <button
                onClick={() => setMigrationResult(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Invoices Inspected</span>
                  <span className="text-base font-bold font-mono text-slate-800">{migrationResult.inspectedInvoices}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Expenses Inspected</span>
                  <span className="text-base font-bold font-mono text-slate-800">{migrationResult.inspectedExpenses}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Journals Generated</span>
                  <span className="text-base font-bold font-mono text-emerald-700">+{migrationResult.migratedJournals}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Already Accounted / Skipped</span>
                  <span className="text-base font-bold font-mono text-slate-600">{migrationResult.skippedCount}</span>
                </div>
              </div>

              {migrationResult.discrepancies.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 space-y-1">
                  <span className="font-bold block">Discrepancies Noted ({migrationResult.discrepancies.length}):</span>
                  {migrationResult.discrepancies.map((d, i) => (
                    <p key={i} className="text-[11px]">• {d}</p>
                  ))}
                </div>
              )}

              {migrationResult.errors.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 space-y-1">
                  <span className="font-bold block">Migration Errors ({migrationResult.errors.length}):</span>
                  {migrationResult.errors.map((e, i) => (
                    <p key={i} className="text-[11px]">• {e}</p>
                  ))}
                </div>
              )}

              {migrationResult.discrepancies.length === 0 && migrationResult.errors.length === 0 && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span>All historical records successfully verified and accounted into double-entry ledgers.</span>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setMigrationResult(null)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-sm"
                >
                  Close & Refresh Ledgers
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
