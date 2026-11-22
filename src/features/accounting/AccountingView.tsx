import React, { useState } from 'react';
import { 
  BookOpen, IndianRupee, ArrowUpRight, ArrowDownRight, Layers, FileSpreadsheet,
  Plus, Search, Filter, ShieldCheck, Lock, Unlock, Eye, Calendar, RefreshCw, AlertCircle, CheckCircle2, X
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
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Header with Quick Actions */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-[#12263A]">
              Double-Entry Accounting & General Ledger
            </h2>
            <span className="px-2 py-0.5 rounded-sm text-[10px] font-semibold bg-[#EAF5FD] text-[#1F86CC] border border-[#3BA0E6]/30">
              Verified Engine
            </span>
          </div>
          <p className="text-xs text-[#3E5368] mt-0.5">
            Real-time multi-business Chart of Accounts, balanced journal vouchers, and audit-grade ledgers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setAccountModal({ isOpen: true, accountToEdit: null })}
            className="flex items-center gap-1.5 rounded-lg border border-[#E8DFCF] bg-white hover:bg-[#FFFBF3] px-3.5 py-2 text-xs font-semibold text-[#12263A] shadow-2xs transition cursor-pointer"
          >
            <Plus size={14} className="text-[#1F86CC]" />
            <span>New Account</span>
          </button>

          <button
            onClick={() => setIsJournalModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-[#E0771A] hover:bg-[#B85D0F] px-4 py-2 text-xs font-semibold text-white shadow-2xs transition cursor-pointer"
          >
            <Plus size={14} />
            <span>Journal Voucher</span>
          </button>

          <button
            onClick={handleRunMigration}
            className="flex items-center gap-1.5 rounded-lg border border-[#E8DFCF] bg-white hover:bg-[#FFFBF3] px-3.5 py-2 text-xs font-semibold text-[#12263A] shadow-2xs transition cursor-pointer"
            title="Scan and create balanced journals for any unposted legacy transactions"
          >
            <RefreshCw size={13} className="text-[#3E5368]" />
            <span>Reconcile & Migrate</span>
          </button>
        </div>
      </div>

      {/* 1. High-Level Accounting Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-[#E8DFCF] shadow-2xs">
          <span className="text-[10px] font-semibold text-[#3E5368] block">Total Assets</span>
          <p className="text-base font-bold tabular-nums text-[#12263A] mt-0.5">{formatCurrency(overview.totalAssets)}</p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-[#E8DFCF] shadow-2xs">
          <span className="text-[10px] font-semibold text-[#3E5368] block">Total Liabilities</span>
          <p className="text-base font-bold tabular-nums text-[#B7791F] mt-0.5">{formatCurrency(overview.totalLiabilities)}</p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-[#E8DFCF] shadow-2xs">
          <span className="text-[10px] font-semibold text-[#3E5368] block">Total Equity</span>
          <p className="text-base font-bold tabular-nums text-[#1F86CC] mt-0.5">{formatCurrency(overview.totalEquity)}</p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-[#E8DFCF] shadow-2xs">
          <span className="text-[10px] font-semibold text-[#3E5368] block">Total Income</span>
          <p className="text-base font-bold tabular-nums text-[#1E8E5A] mt-0.5">{formatCurrency(overview.totalIncome)}</p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-[#E8DFCF] shadow-2xs">
          <span className="text-[10px] font-semibold text-[#3E5368] block">Total Expenses</span>
          <p className="text-base font-bold tabular-nums text-[#C23B3B] mt-0.5">{formatCurrency(overview.totalExpenses)}</p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-[#E8DFCF] shadow-2xs">
          <span className="text-[10px] font-semibold text-[#3E5368] block">Net Profit</span>
          <p className={`text-base font-bold tabular-nums mt-0.5 ${overview.netProfit >= 0 ? 'text-[#1E8E5A]' : 'text-[#C23B3B]'}`}>
            {formatCurrency(overview.netProfit)}
          </p>
        </div>
      </div>

      {/* Trial Balance Health Banner */}
      <div className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
        overview.isTrialBalanceBalanced 
          ? 'bg-[#E6F6EE] text-[#1E8E5A] border-[#1E8E5A]/20' 
          : 'bg-[#FDECEC] text-[#C23B3B] border-[#C23B3B]/20'
      }`}>
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${overview.isTrialBalanceBalanced ? 'bg-[#1E8E5A]' : 'bg-[#C23B3B]'}`}></span>
          <span className="font-semibold">
            {overview.isTrialBalanceBalanced 
              ? 'Double-Entry Invariant Satisfied: All Journals Balanced (Debits == Credits)' 
              : `Accounting Discrepancy Detected: Out of balance by ₹${overview.trialBalanceDifference.toFixed(2)}`}
          </span>
        </div>
        <div className="flex items-center gap-4 tabular-nums font-semibold text-xs">
          <span>Receivables (A/R): {formatCurrency(overview.currentReceivables)}</span>
          <span>Payables (A/P): {formatCurrency(overview.currentPayables)}</span>
          <span>Cash/Bank: {formatCurrency(overview.cashAndBankBalance)}</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-[#E8DFCF] pb-2 text-xs font-semibold scrollbar-none">
        {[
          { id: 'coa', label: `Chart of Accounts (${accounts.length})` },
          { id: 'journals', label: `Journal Entries (${journalEntries.length})` },
          { id: 'cashbank', label: `Cash & Bank Registers (${paymentVouchers.length})` },
          { id: 'periods', label: `Financial Periods (${accountingPeriods.length})` },
        ].map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-2 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#EAF5FD] text-[#1F86CC] border border-[#3BA0E6]/30 shadow-2xs font-semibold'
                  : 'text-[#3E5368] hover:bg-[#FFFBF3] hover:text-[#12263A]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ======================================================== */}
      {/* TAB 1: CHART OF ACCOUNTS */}
      {/* ======================================================== */}
      {activeTab === 'coa' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 bg-white p-2.5 rounded-xl border border-[#E8DFCF] shadow-2xs">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#3E5368]" />
                <input
                  type="text"
                  placeholder="Search code or account name..."
                  value={coaSearchQuery}
                  onChange={(e) => setCoaSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 h-10 text-xs rounded-lg border border-[#E8DFCF] bg-[#FFFBF3] text-[#12263A] placeholder-[#3E5368]/60 focus:bg-white focus:outline-hidden focus:border-[#3BA0E6]"
                />
              </div>

              <select
                value={coaCategoryFilter}
                onChange={(e) => setCoaCategoryFilter(e.target.value)}
                className="h-10 px-3 text-xs rounded-lg border border-[#E8DFCF] bg-[#FFFBF3] text-[#12263A] focus:outline-hidden focus:border-[#3BA0E6]"
              >
                <option value="all">All Categories</option>
                <option value="asset">1. Assets</option>
                <option value="liability">2. Liabilities</option>
                <option value="equity">3. Equity</option>
                <option value="income">4. Income</option>
                <option value="expense">5. Expenses</option>
              </select>
            </div>

            <span className="text-xs text-[#3E5368] font-medium self-end sm:self-center">
              Showing {filteredAccounts.length} of {accounts.length} accounts
            </span>
          </div>

          {/* Accounts Table */}
          <div className="rounded-xl border border-[#E8DFCF] bg-white shadow-2xs overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#FFFBF3] border-b border-[#E8DFCF] text-[#3E5368] text-[10px] font-semibold tracking-wider">
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
              <tbody className="divide-y divide-[#E8DFCF]">
                {filteredAccounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-[#FFFBF3] transition-colors">
                    <td className="p-3.5 font-semibold text-[#12263A]">{acc.code}</td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-1.5">
                        {acc.level && acc.level > 1 && (
                          <span className="text-[#3E5368]/40">{'— '.repeat(acc.level - 1)}</span>
                        )}
                        <span className={`font-semibold ${acc.level === 1 ? 'text-[#12263A] font-bold' : 'text-[#12263A]'}`}>
                          {acc.name}
                        </span>
                        {acc.isSystem && (
                          <span className="text-[9px] px-1 py-0.5 rounded-sm bg-[#EEF2F6] text-[#3E5368] font-semibold uppercase">
                            Sys
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-sm text-[9px] font-semibold uppercase ${
                        acc.type === 'asset'
                          ? 'bg-[#EAF5FD] text-[#1F86CC] border border-[#3BA0E6]/30'
                          : acc.type === 'liability'
                          ? 'bg-[#FFF3DC] text-[#B7791F] border border-[#B7791F]/20'
                          : acc.type === 'income'
                          ? 'bg-[#E6F6EE] text-[#1E8E5A] border border-[#1E8E5A]/20'
                          : acc.type === 'expense'
                          ? 'bg-[#FDECEC] text-[#C23B3B] border border-[#C23B3B]/20'
                          : 'bg-[#FFF8EC] text-[#E0771A] border border-[#E0771A]/20'
                      }`}>
                        {acc.type}
                      </span>
                    </td>
                    <td className="p-3.5 text-[#3E5368] capitalize">{acc.subtype.replace(/_/g, ' ')}</td>
                    <td className="p-3.5 text-right tabular-nums text-[#3E5368]">
                      {acc.openingBalance ? `₹${acc.openingBalance.toLocaleString('en-IN')}` : '-'}
                    </td>
                    <td className="p-3.5 text-right tabular-nums font-bold text-[#12263A]">
                      {formatCurrency(acc.currentBalance)}
                    </td>
                    <td className="p-3.5 text-center">
                      <span className={`px-2 py-0.5 rounded-sm text-[9px] font-semibold uppercase ${
                        acc.isActive ? 'bg-[#E6F6EE] text-[#1E8E5A] border border-[#1E8E5A]/20' : 'bg-[#EEF2F6] text-[#3E5368]'
                      }`}>
                        {acc.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="p-3.5 text-right space-x-2">
                      <button
                        onClick={() => setSelectedLedgerAccountId(acc.id)}
                        className="text-xs font-semibold text-[#1F86CC] hover:underline cursor-pointer"
                        title="View Account Ledger"
                      >
                        Ledger
                      </button>
                      <button
                        onClick={() => setAccountModal({ isOpen: true, accountToEdit: acc })}
                        className="text-xs font-semibold text-[#3E5368] hover:text-[#12263A] cursor-pointer"
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
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 bg-white p-2.5 rounded-xl border border-[#E8DFCF] shadow-2xs">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={journalSourceFilter}
                onChange={(e) => setJournalSourceFilter(e.target.value)}
                className="h-10 px-3 text-xs rounded-lg border border-[#E8DFCF] bg-[#FFFBF3] text-[#12263A] focus:outline-hidden focus:border-[#3BA0E6]"
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
                className="h-10 px-3 text-xs rounded-lg border border-[#E8DFCF] bg-[#FFFBF3] text-[#12263A] focus:outline-hidden focus:border-[#3BA0E6]"
              />
              {journalDateFilter && (
                <button
                  onClick={() => setJournalDateFilter('')}
                  className="text-xs text-[#1F86CC] font-semibold hover:underline cursor-pointer"
                >
                  Clear Date
                </button>
              )}
            </div>

            <span className="text-xs text-[#3E5368] font-medium self-end sm:self-center">
              {filteredJournals.length} Journal Entries Recorded
            </span>
          </div>

          {/* Journal Entries Table */}
          <div className="rounded-xl border border-[#E8DFCF] bg-white shadow-2xs overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#FFFBF3] border-b border-[#E8DFCF] text-[#3E5368] text-[10px] font-semibold tracking-wider">
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
              <tbody className="divide-y divide-[#E8DFCF]">
                {filteredJournals.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-[#3E5368]">
                      No matching journal entries found.
                    </td>
                  </tr>
                ) : (
                  filteredJournals.map((je) => (
                    <tr key={je.id} className="hover:bg-[#FFFBF3] transition-colors">
                      <td className="p-3.5 text-[#3E5368]">{je.date}</td>
                      <td className="p-3.5 font-semibold text-[#1F86CC]">{je.entryNumber}</td>
                      <td className="p-3.5">
                        <span className="inline-flex px-2 py-0.5 rounded-sm text-[9px] font-semibold uppercase bg-[#EEF2F6] text-[#3E5368]">
                          {je.sourceType.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="p-3.5 text-[#12263A] max-w-xs truncate" title={je.narration}>
                        {je.narration}
                      </td>
                      <td className="p-3.5 text-right font-bold tabular-nums text-[#12263A]">
                        {formatCurrency(je.totalDebit)}
                      </td>
                      <td className="p-3.5 text-right font-bold tabular-nums text-[#12263A]">
                        {formatCurrency(je.totalCredit)}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className="inline-flex px-2 py-0.5 rounded-sm text-[9px] font-semibold uppercase bg-[#E6F6EE] text-[#1E8E5A] border border-[#1E8E5A]/20">
                          {je.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => setViewingJournalEntry(je)}
                          className="text-xs font-semibold text-[#1F86CC] hover:underline cursor-pointer"
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
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="rounded-xl border border-[#E8DFCF] bg-white p-4 shadow-2xs">
              <span className="text-[11px] font-semibold text-[#3E5368] block">Cash in Hand (1010)</span>
              <h3 className="text-xl font-bold tabular-nums text-[#12263A] mt-1">
                {formatCurrency(liveAccounts.find((a) => a.code === '1010')?.currentBalance || 0)}
              </h3>
              <p className="text-[11px] text-[#3E5368]/80 mt-1">Reflects all cash sales, receipts, and petty cash disbursements.</p>
              <div className="mt-3.5 pt-2.5 border-t border-[#E8DFCF]">
                <button
                  onClick={() => {
                    const acc = accounts.find((a) => a.code === '1010');
                    if (acc) setSelectedLedgerAccountId(acc.id);
                  }}
                  className="text-xs font-semibold text-[#1F86CC] hover:underline cursor-pointer"
                >
                  View Cash Book Ledger →
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-[#E8DFCF] bg-white p-4 shadow-2xs">
              <span className="text-[11px] font-semibold text-[#3E5368] block">Bank Accounts (1020)</span>
              <h3 className="text-xl font-bold tabular-nums text-[#1F86CC] mt-1">
                {formatCurrency(liveAccounts.find((a) => a.code === '1020')?.currentBalance || 0)}
              </h3>
              <p className="text-[11px] text-[#3E5368]/80 mt-1">Reflects NEFT, RTGS, IMPS, UPI, and bank transfers.</p>
              <div className="mt-3.5 pt-2.5 border-t border-[#E8DFCF]">
                <button
                  onClick={() => {
                    const acc = accounts.find((a) => a.code === '1020');
                    if (acc) setSelectedLedgerAccountId(acc.id);
                  }}
                  className="text-xs font-semibold text-[#1F86CC] hover:underline cursor-pointer"
                >
                  View Bank Book Ledger →
                </button>
              </div>
            </div>
          </div>

          {/* Vouchers Table */}
          <div className="rounded-xl border border-[#E8DFCF] bg-white shadow-2xs overflow-hidden">
            <div className="p-3.5 border-b border-[#E8DFCF] flex justify-between items-center bg-[#FFFBF3]">
              <h3 className="font-semibold text-xs text-[#12263A]">Payment Vouchers (In & Out)</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => onOpenPaymentModal('payment_in')}
                  className="flex items-center gap-1 text-xs font-semibold text-[#1E8E5A] bg-[#E6F6EE] px-2.5 py-1 rounded-md border border-[#1E8E5A]/20 hover:bg-[#1E8E5A]/15 cursor-pointer"
                >
                  <IndianRupee size={13} /> + Payment In
                </button>
                <button
                  onClick={() => onOpenPaymentModal('payment_out')}
                  className="flex items-center gap-1 text-xs font-semibold text-[#1F86CC] bg-[#EAF5FD] px-2.5 py-1 rounded-md border border-[#3BA0E6]/30 hover:bg-[#D4EBFA] cursor-pointer"
                >
                  <IndianRupee size={13} /> + Payment Out
                </button>
              </div>
            </div>

            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#FFFBF3] border-b border-[#E8DFCF] text-[#3E5368] text-[10px] font-semibold tracking-wider">
                  <th className="p-3.5">Voucher #</th>
                  <th className="p-3.5">Type</th>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Party</th>
                  <th className="p-3.5">Payment Mode</th>
                  <th className="p-3.5 text-right">Amount (₹)</th>
                  <th className="p-3.5">Reference #</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8DFCF]">
                {paymentVouchers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-[#3E5368]">
                      No payment vouchers recorded yet.
                    </td>
                  </tr>
                ) : (
                  paymentVouchers.map((v) => (
                    <tr key={v.id} className="hover:bg-[#FFFBF3] transition-colors">
                      <td className="p-3.5 font-semibold text-[#12263A]">{v.voucherNumber}</td>
                      <td className="p-3.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-sm text-[9px] font-semibold uppercase ${
                          v.type === 'payment_in'
                            ? 'bg-[#E6F6EE] text-[#1E8E5A] border border-[#1E8E5A]/20'
                            : 'bg-[#EAF5FD] text-[#1F86CC] border border-[#3BA0E6]/30'
                        }`}>
                          {v.type === 'payment_in' ? 'Payment In' : 'Payment Out'}
                        </span>
                      </td>
                      <td className="p-3.5 text-[#3E5368]">{v.date}</td>
                      <td className="p-3.5 font-medium text-[#12263A]">{v.partyName || 'Party'}</td>
                      <td className="p-3.5 text-[#3E5368]">{v.paymentMode}</td>
                      <td className="p-3.5 text-right tabular-nums font-bold text-[#12263A]">
                        {formatCurrency(v.amount)}
                      </td>
                      <td className="p-3.5 text-[#3E5368]">{v.referenceNumber || '-'}</td>
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
          <div className="bg-white p-4 rounded-xl border border-[#E8DFCF] flex items-center justify-between shadow-2xs">
            <div>
              <h3 className="font-bold text-sm text-[#12263A]">Financial Years (Indian April–March Period)</h3>
              <p className="text-xs text-[#3E5368] mt-0.5">
                Locking an accounting period prevents any accidental backdated journal postings from altering audited balances.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-[#E8DFCF] bg-white shadow-2xs overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#FFFBF3] border-b border-[#E8DFCF] text-[#3E5368] text-[10px] font-semibold tracking-wider">
                  <th className="p-3.5">Period Name</th>
                  <th className="p-3.5">Start Date</th>
                  <th className="p-3.5">End Date</th>
                  <th className="p-3.5 text-center">Audit Status</th>
                  <th className="p-3.5 text-right">Lock / Unlock Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8DFCF]">
                {accountingPeriods.map((period) => (
                  <tr key={period.id} className="hover:bg-[#FFFBF3] transition-colors">
                    <td className="p-3.5 font-semibold text-[#12263A]">{period.name}</td>
                    <td className="p-3.5 text-[#3E5368]">{period.startDate}</td>
                    <td className="p-3.5 text-[#3E5368]">{period.endDate}</td>
                    <td className="p-3.5 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-sm text-[9px] font-semibold uppercase ${
                        period.status === 'open'
                          ? 'bg-[#E6F6EE] text-[#1E8E5A] border border-[#1E8E5A]/20'
                          : period.status === 'locked'
                          ? 'bg-[#FFF3DC] text-[#B7791F] border border-[#B7791F]/20'
                          : 'bg-[#EEF2F6] text-[#3E5368] border border-[#E8DFCF]'
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
                          className="px-3 py-1 rounded-md bg-[#FFF3DC] hover:bg-[#FFF3DC]/80 text-[#B7791F] font-semibold text-xs transition cursor-pointer border border-[#B7791F]/30"
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
                          className="px-3 py-1 rounded-md bg-[#E6F6EE] hover:bg-[#E6F6EE]/80 text-[#1E8E5A] font-semibold text-xs transition cursor-pointer border border-[#1E8E5A]/30"
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

      {/* MODAL 1: Account Add / Edit Modal */}
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

      {/* MODAL 2: Manual Journal Voucher Creation Modal */}
      <JournalVoucherModal
        isOpen={isJournalModalOpen}
        onClose={() => setIsJournalModalOpen(false)}
        onSave={onSaveJournalEntry}
        accounts={accounts}
        parties={parties}
      />

      {/* MODAL 3: Account Ledger Statement Modal */}
      {selectedLedgerAccountId && (
        <AccountLedgerModal
          isOpen={!!selectedLedgerAccountId}
          onClose={() => setSelectedLedgerAccountId(null)}
          accountId={selectedLedgerAccountId}
          accounts={accounts}
          journalEntries={journalEntries}
        />
      )}

      {/* MODAL 4: Journal Entry Detail Viewer */}
      {viewingJournalEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl border border-[#E8DFCF] overflow-hidden flex flex-col">
            <div className="flex h-14 items-center justify-between border-b border-[#E8DFCF] bg-[#FFFBF3] px-6 text-[#12263A]">
              <span className="font-bold text-sm">
                Journal Entry #{viewingJournalEntry.entryNumber}
              </span>
              <button
                onClick={() => setViewingJournalEntry(null)}
                className="rounded-lg p-1 text-[#3E5368] hover:bg-[#EAF5FD] hover:text-[#12263A] transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 bg-[#FFFBF3] p-3 rounded-lg border border-[#E8DFCF] text-xs">
                <div>
                  <span className="text-[10px] text-[#3E5368] uppercase font-semibold block">Date</span>
                  <span className="font-semibold text-[#12263A]">{viewingJournalEntry.date}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#3E5368] uppercase font-semibold block">Source</span>
                  <span className="font-semibold uppercase text-[#12263A]">{viewingJournalEntry.sourceType}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] text-[#3E5368] uppercase font-semibold block">Narration</span>
                  <span className="text-[#3E5368]">{viewingJournalEntry.narration}</span>
                </div>
              </div>

              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#FFFBF3] border-b border-[#E8DFCF] text-[#3E5368] text-[10px] font-semibold tracking-wider">
                    <th className="p-2.5">Account</th>
                    <th className="p-2.5">Party</th>
                    <th className="p-2.5">Particulars</th>
                    <th className="p-2.5 text-right">Debit (₹)</th>
                    <th className="p-2.5 text-right">Credit (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8DFCF]">
                  {viewingJournalEntry.lines.map((l) => (
                    <tr key={l.id}>
                      <td className="p-2.5 font-semibold text-[#12263A]">
                        {l.accountCode} - {l.accountName}
                      </td>
                      <td className="p-2.5 text-[#3E5368]">{l.partyName || '-'}</td>
                      <td className="p-2.5 text-[#3E5368]">{l.description || '-'}</td>
                      <td className="p-2.5 text-right tabular-nums font-semibold text-[#12263A]">
                        {l.debit > 0 ? formatCurrency(l.debit) : '-'}
                      </td>
                      <td className="p-2.5 text-right tabular-nums font-semibold text-[#12263A]">
                        {l.credit > 0 ? formatCurrency(l.credit) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#FFFBF3] font-semibold text-xs border-t-2 border-[#E8DFCF]">
                    <td colSpan={3} className="p-2.5 text-right uppercase text-[10px] text-[#3E5368]">Total:</td>
                    <td className="p-2.5 text-right text-[#1F86CC] tabular-nums">{formatCurrency(viewingJournalEntry.totalDebit)}</td>
                    <td className="p-2.5 text-right text-[#1F86CC] tabular-nums">{formatCurrency(viewingJournalEntry.totalCredit)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Migration Summary Dialog */}
      {migrationResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl border border-[#E8DFCF] overflow-hidden flex flex-col">
            <div className="flex h-14 items-center justify-between border-b border-[#E8DFCF] bg-[#FFFBF3] px-6 text-[#12263A]">
              <span className="font-bold text-sm">
                Historical Data Migration Audit Summary
              </span>
              <button
                onClick={() => setMigrationResult(null)}
                className="rounded-lg p-1 text-[#3E5368] hover:bg-[#EAF5FD] hover:text-[#12263A] transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-[#FFFBF3] p-4 rounded-xl border border-[#E8DFCF]">
                <div>
                  <span className="text-[10px] text-[#3E5368] uppercase font-semibold block">Invoices Inspected</span>
                  <span className="text-base font-bold tabular-nums text-[#12263A]">{migrationResult.inspectedInvoices}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#3E5368] uppercase font-semibold block">Expenses Inspected</span>
                  <span className="text-base font-bold tabular-nums text-[#12263A]">{migrationResult.inspectedExpenses}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#3E5368] uppercase font-semibold block">Journals Generated</span>
                  <span className="text-base font-bold tabular-nums text-[#1E8E5A]">+{migrationResult.migratedJournals}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#3E5368] uppercase font-semibold block">Already Accounted / Skipped</span>
                  <span className="text-base font-bold tabular-nums text-[#3E5368]">{migrationResult.skippedCount}</span>
                </div>
              </div>

              {migrationResult.discrepancies.length > 0 && (
                <div className="p-3 bg-[#FFF3DC] border border-[#B7791F]/30 rounded-lg text-[#B7791F] space-y-1">
                  <span className="font-bold block">Discrepancies Noted ({migrationResult.discrepancies.length}):</span>
                  {migrationResult.discrepancies.map((d, i) => (
                    <p key={i} className="text-[11px]">• {d}</p>
                  ))}
                </div>
              )}

              {migrationResult.errors.length > 0 && (
                <div className="p-3 bg-[#FDECEC] border border-[#C23B3B]/30 rounded-lg text-[#C23B3B] space-y-1">
                  <span className="font-bold block">Migration Errors ({migrationResult.errors.length}):</span>
                  {migrationResult.errors.map((e, i) => (
                    <p key={i} className="text-[11px]">• {e}</p>
                  ))}
                </div>
              )}

              {migrationResult.discrepancies.length === 0 && migrationResult.errors.length === 0 && (
                <div className="p-3 bg-[#E6F6EE] border border-[#1E8E5A]/30 rounded-lg text-[#1E8E5A] flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-[#1E8E5A]" />
                  <span>All historical records successfully verified and accounted into double-entry ledgers.</span>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setMigrationResult(null)}
                  className="px-4 py-2 bg-[#E0771A] hover:bg-[#B85D0F] text-white rounded-lg font-semibold text-xs cursor-pointer shadow-2xs"
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
