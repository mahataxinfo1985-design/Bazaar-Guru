import React, { useState, useMemo } from 'react';
import { 
  Landmark, FileSpreadsheet, Package, Users, BarChart3, ArrowUpRight, 
  ArrowDownRight, Scale, Activity, BookOpen, Layers, CheckCircle2, 
  AlertCircle, IndianRupee, Calendar, TrendingUp, Download 
} from 'lucide-react';
import { Invoice, Party, Item, Expense } from '../../types';
import { Account, JournalEntry } from '../../types/accounting';
import ExportDropdown from '../../components/shared/ExportDropdown';
import { 
  generateTrialBalance, 
  generateProfitAndLoss, 
  generateBalanceSheet,
  generateCashFlowStatement,
  generateDaybook,
  generateGeneralLedger,
  generateItemProfitability
} from '../../services/accounting/financialReports';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface ReportsViewProps {
  invoices: Invoice[];
  parties: Party[];
  items: Item[];
  expenses: Expense[];
  accounts: Account[];
  journalEntries: JournalEntry[];
  onExportSalesExcel: () => void;
  onExportSalesCSV: () => void;
  onExportPurchaseExcel: () => void;
  onExportPurchaseCSV: () => void;
}

export default function ReportsView({
  invoices,
  parties,
  items,
  expenses,
  accounts,
  journalEntries,
  onExportSalesExcel,
  onExportSalesCSV,
  onExportPurchaseExcel,
  onExportPurchaseCSV,
}: ReportsViewProps) {
  const [activeReportTab, setActiveReportTab] = useState<
    'pnl' | 'balance_sheet' | 'cash_flow' | 'daybook' | 'trial' | 'general_ledger' | 'profitability' | 'tax' | 'registers'
  >('pnl');

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activePreset, setActivePreset] = useState<string>('all');
  const [selectedLedgerAccountId, setSelectedLedgerAccountId] = useState(accounts[0]?.id || '');

  // Date Presets Handler
  const applyPreset = (preset: 'today' | 'this_month' | 'this_quarter' | 'this_fy' | 'last_fy' | 'all') => {
    setActivePreset(preset);
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (preset === 'today') {
      const today = toISO(now);
      setDateFrom(today);
      setDateTo(today);
    } else if (preset === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      setDateFrom(toISO(start));
      setDateTo(toISO(now));
    } else if (preset === 'this_quarter') {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      const start = new Date(now.getFullYear(), qMonth, 1);
      setDateFrom(toISO(start));
      setDateTo(toISO(now));
    } else if (preset === 'this_fy') {
      // Indian FY starts April 1 (month index 3)
      const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      const start = new Date(fyStartYear, 3, 1);
      setDateFrom(toISO(start));
      setDateTo(toISO(now));
    } else if (preset === 'last_fy') {
      const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() - 1 : now.getFullYear() - 2;
      const start = new Date(fyStartYear, 3, 1);
      const end = new Date(fyStartYear + 1, 2, 31);
      setDateFrom(toISO(start));
      setDateTo(toISO(end));
    } else {
      setDateFrom('');
      setDateTo('');
    }
  };

  // 1. Profit & Loss
  const pnl = useMemo(() => {
    return generateProfitAndLoss(accounts, journalEntries, dateFrom || undefined, dateTo || undefined);
  }, [accounts, journalEntries, dateFrom, dateTo]);

  // 2. Balance Sheet
  const balanceSheet = useMemo(() => {
    return generateBalanceSheet(accounts, journalEntries, dateTo || undefined);
  }, [accounts, journalEntries, dateTo]);

  // 3. Cash Flow
  const cashFlow = useMemo(() => {
    const sDate = dateFrom || '2026-01-01';
    const eDate = dateTo || new Date().toISOString().split('T')[0];
    return generateCashFlowStatement(accounts, journalEntries, sDate, eDate);
  }, [accounts, journalEntries, dateFrom, dateTo]);

  // 4. Daybook
  const daybook = useMemo(() => {
    return generateDaybook(journalEntries, dateFrom || undefined, dateTo || undefined);
  }, [journalEntries, dateFrom, dateTo]);

  // 5. Trial Balance
  const trial = useMemo(() => {
    return generateTrialBalance(accounts, journalEntries, dateFrom || undefined, dateTo || undefined);
  }, [accounts, journalEntries, dateFrom, dateTo]);

  // 6. General Ledger
  const selectedAccount = accounts.find(a => a.id === selectedLedgerAccountId) || accounts[0];
  const generalLedger = useMemo(() => {
    if (!selectedAccount) return null;
    return generateGeneralLedger(selectedAccount, journalEntries, dateFrom || undefined, dateTo || undefined);
  }, [selectedAccount, journalEntries, dateFrom, dateTo]);

  // 7. Item Profitability
  const itemProfitability = useMemo(() => {
    return generateItemProfitability(invoices);
  }, [invoices]);

  // Tax return metrics
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;
  let itcCgst = 0;
  let itcSgst = 0;
  let itcIgst = 0;

  invoices.forEach((inv) => {
    if (inv.status === 'Cancelled' || inv.deleted) return;
    const isPurchase = inv.type.includes('Purchase') || inv.type === 'Purchase Return';
    if (isPurchase) {
      itcCgst += inv.cgst;
      itcSgst += inv.sgst;
      itcIgst += inv.igst;
    } else {
      totalCgst += inv.cgst;
      totalSgst += inv.sgst;
      totalIgst += inv.igst;
    }
  });

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#12263A]">Financial Reporting & Accounts Engine</h2>
          <p className="text-xs text-[#3E5368] mt-0.5">
            Audit-grade double-entry financial statements derived strictly from posted accounting entries.
          </p>
        </div>

        {/* Global Date Filters & Presets */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Preset Chips */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-[#E8DFCF] shadow-2xs">
            {[
              { id: 'all', label: 'All Time' },
              { id: 'today', label: 'Today' },
              { id: 'this_month', label: 'This Month' },
              { id: 'this_quarter', label: 'This Quarter' },
              { id: 'this_fy', label: 'This FY' },
              { id: 'last_fy', label: 'Last FY' },
            ].map((preset) => (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset.id as any)}
                className={`px-2.5 py-1 text-xs rounded-md font-semibold transition-all cursor-pointer ${
                  activePreset === preset.id
                    ? 'bg-[#EAF5FD] text-[#1F86CC] border border-[#3BA0E6]/30'
                    : 'text-[#3E5368] hover:bg-[#FFFBF3]'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Date Picker inputs */}
          <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-[#E8DFCF]">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setActivePreset('custom'); }}
              className="text-xs text-[#12263A] bg-transparent outline-none"
              placeholder="From"
            />
            <span className="text-xs text-[#3E5368]">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setActivePreset('custom'); }}
              className="text-xs text-[#12263A] bg-transparent outline-none"
              placeholder="To"
            />
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-[#E8DFCF] pb-2 text-xs font-semibold scrollbar-none">
        {[
          { id: 'pnl', label: 'Profit & Loss' },
          { id: 'balance_sheet', label: 'Balance Sheet' },
          { id: 'cash_flow', label: 'Cash Flow' },
          { id: 'trial', label: 'Trial Balance' },
          { id: 'daybook', label: 'Daybook' },
          { id: 'general_ledger', label: 'General Ledger' },
          { id: 'profitability', label: 'Item Profitability' },
          { id: 'tax', label: 'GST Registers' },
          { id: 'registers', label: 'Export Registers' },
        ].map(tab => {
          const isActive = activeReportTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveReportTab(tab.id as any)}
              className={`px-3 py-2 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
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

      {/* TAB 1: PROFIT & LOSS */}
      {activeReportTab === 'pnl' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="rounded-xl border border-[#E8DFCF] bg-white p-4 shadow-2xs">
              <p className="text-[11px] font-semibold text-[#3E5368]">Total Sales Revenue</p>
              <h3 className="text-xl font-bold tabular-nums text-[#12263A] mt-1">{formatCurrency(pnl.totalRevenue)}</h3>
              <p className="text-[11px] text-[#3E5368]/80 mt-0.5">Recognized sales income</p>
            </div>
            <div className="rounded-xl border border-[#E8DFCF] bg-white p-4 shadow-2xs">
              <p className="text-[11px] font-semibold text-[#3E5368]">Gross Profit</p>
              <h3 className="text-xl font-bold tabular-nums text-[#1E8E5A] mt-1">{formatCurrency(pnl.grossProfit)}</h3>
              <p className="text-[11px] text-[#3E5368]/80 mt-0.5">Revenue − COGS ({formatCurrency(pnl.costOfGoodsSold)})</p>
            </div>
            <div className="rounded-xl border border-[#E8DFCF] bg-white p-4 shadow-2xs">
              <p className="text-[11px] font-semibold text-[#3E5368]">Net Profit / (Loss)</p>
              <h3 className={`text-xl font-bold tabular-nums mt-1 ${pnl.netProfit >= 0 ? 'text-[#1F86CC]' : 'text-[#C23B3B]'}`}>
                {formatCurrency(pnl.netProfit)}
              </h3>
              <p className="text-[11px] text-[#3E5368]/80 mt-0.5">Operating expenses ({formatCurrency(pnl.totalOperatingExpenses)})</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Income Section */}
            <div className="bg-white rounded-xl border border-[#E8DFCF] p-4 shadow-2xs">
              <h4 className="text-xs font-bold text-[#12263A] border-b border-[#E8DFCF] pb-2 mb-3 flex items-center justify-between">
                <span>Revenue & Operating Income</span>
                <span className="tabular-nums font-bold text-[#1E8E5A]">{formatCurrency(pnl.totalRevenue)}</span>
              </h4>
              <div className="divide-y divide-[#E8DFCF] text-xs">
                {pnl.revenueLines.map((line, idx) => (
                  <div key={idx} className="py-2 flex justify-between">
                    <span className="text-[#3E5368]">{line.accountName}</span>
                    <span className="tabular-nums font-semibold text-[#12263A]">{formatCurrency(line.amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Expenses Section */}
            <div className="bg-white rounded-xl border border-[#E8DFCF] p-4 shadow-2xs">
              <h4 className="text-xs font-bold text-[#12263A] border-b border-[#E8DFCF] pb-2 mb-3 flex items-center justify-between">
                <span>Cost of Goods Sold & Expenses</span>
                <span className="tabular-nums font-bold text-[#C23B3B]">{formatCurrency(pnl.costOfGoodsSold + pnl.totalOperatingExpenses)}</span>
              </h4>
              <div className="divide-y divide-[#E8DFCF] text-xs">
                <div className="py-2 flex justify-between bg-[#FFFBF3] px-2 rounded-md font-semibold">
                  <span className="text-[#12263A]">Cost of Goods Sold (COGS)</span>
                  <span className="tabular-nums text-[#12263A]">{formatCurrency(pnl.costOfGoodsSold)}</span>
                </div>
                {pnl.expenseLines.map((line, idx) => (
                  <div key={idx} className="py-2 flex justify-between">
                    <span className="text-[#3E5368]">{line.accountName}</span>
                    <span className="tabular-nums font-semibold text-[#12263A]">{formatCurrency(line.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BALANCE SHEET */}
      {activeReportTab === 'balance_sheet' && (
        <div className="space-y-5">
          {/* Balance Status Banner */}
          <div className={`p-3.5 rounded-xl border flex items-center justify-between ${
            balanceSheet.isBalanced ? 'bg-[#E6F6EE] border-[#1E8E5A]/20 text-[#1E8E5A]' : 'bg-[#FFF3DC] border-[#B7791F]/20 text-[#B7791F]'
          }`}>
            <div className="flex items-center gap-2.5">
              {balanceSheet.isBalanced ? <CheckCircle2 size={18} className="text-[#1E8E5A]" /> : <AlertCircle size={18} className="text-[#B7791F]" />}
              <div>
                <h4 className="font-semibold text-xs">
                  {balanceSheet.isBalanced ? 'Balance Sheet is Perfectly Balanced' : 'Balance Sheet Has an Open Variance'}
                </h4>
                <p className="text-[11px] opacity-90">
                  Total Assets: <strong className="tabular-nums">{formatCurrency(balanceSheet.assets.totalAssets)}</strong> = Total Liabilities & Equity: <strong className="tabular-nums">{formatCurrency(balanceSheet.totalLiabilitiesAndEquity)}</strong>
                </p>
              </div>
            </div>
            {!balanceSheet.isBalanced && (
              <span className="tabular-nums font-semibold text-xs bg-[#FFF3DC] px-2 py-0.5 rounded-md">
                Difference: {formatCurrency(balanceSheet.difference)}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* ASSETS */}
            <div className="bg-white rounded-xl border border-[#E8DFCF] p-4 shadow-2xs space-y-3">
              <div className="flex justify-between items-center border-b border-[#E8DFCF] pb-2.5">
                <h3 className="font-bold text-[#12263A] text-sm">Assets</h3>
                <span className="tabular-nums font-bold text-sm text-[#1F86CC]">{formatCurrency(balanceSheet.assets.totalAssets)}</span>
              </div>

              {[
                balanceSheet.assets.cashAndBank,
                balanceSheet.assets.accountsReceivable,
                balanceSheet.assets.inventory,
                balanceSheet.assets.otherCurrentAssets,
                balanceSheet.assets.fixedAssets,
              ].map((sec, i) => (
                <div key={i} className="text-xs space-y-1">
                  <div className="flex justify-between font-semibold text-[#12263A] bg-[#FFFBF3] p-2 rounded-md">
                    <span>{sec.title}</span>
                    <span className="tabular-nums">{formatCurrency(sec.total)}</span>
                  </div>
                  {sec.lines.map((l, j) => (
                    <div key={j} className="flex justify-between pl-3 pr-2 py-1 text-[#3E5368]">
                      <span>{l.accountName} ({l.accountCode})</span>
                      <span className="tabular-nums">{formatCurrency(l.amount)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* LIABILITIES & EQUITY */}
            <div className="bg-white rounded-xl border border-[#E8DFCF] p-4 shadow-2xs space-y-3">
              <div className="flex justify-between items-center border-b border-[#E8DFCF] pb-2.5">
                <h3 className="font-bold text-[#12263A] text-sm">Liabilities & Equity</h3>
                <span className="tabular-nums font-bold text-sm text-[#E0771A]">{formatCurrency(balanceSheet.totalLiabilitiesAndEquity)}</span>
              </div>

              {/* Liabilities */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-semibold text-[#3E5368]">Liabilities ({formatCurrency(balanceSheet.liabilities.totalLiabilities)})</h4>
                {[
                  balanceSheet.liabilities.accountsPayable,
                  balanceSheet.liabilities.gstLiabilities,
                  balanceSheet.liabilities.loans,
                  balanceSheet.liabilities.otherCurrentLiabilities,
                ].map((sec, i) => (
                  <div key={i} className="text-xs space-y-1">
                    <div className="flex justify-between font-semibold text-[#12263A] bg-[#FFFBF3] p-2 rounded-md">
                      <span>{sec.title}</span>
                      <span className="tabular-nums">{formatCurrency(sec.total)}</span>
                    </div>
                    {sec.lines.map((l, j) => (
                      <div key={j} className="flex justify-between pl-3 pr-2 py-1 text-[#3E5368]">
                        <span>{l.accountName} ({l.accountCode})</span>
                        <span className="tabular-nums">{formatCurrency(l.amount)}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Equity */}
              <div className="space-y-2 pt-2.5 border-t border-[#E8DFCF]">
                <h4 className="text-[11px] font-semibold text-[#3E5368]">Equity ({formatCurrency(balanceSheet.equity.totalEquity)})</h4>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between pl-3 pr-2 py-1 text-[#3E5368]">
                    <span>Owner Capital</span>
                    <span className="tabular-nums">{formatCurrency(balanceSheet.equity.ownerCapital.total)}</span>
                  </div>
                  {balanceSheet.equity.drawings.total > 0 && (
                    <div className="flex justify-between pl-3 pr-2 py-1 text-[#C23B3B]">
                      <span>Less: Owner Drawings</span>
                      <span className="tabular-nums">-{formatCurrency(balanceSheet.equity.drawings.total)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pl-3 pr-2 py-1 text-[#3E5368]">
                    <span>Retained Earnings</span>
                    <span className="tabular-nums">{formatCurrency(balanceSheet.equity.retainedEarnings.total)}</span>
                  </div>
                  <div className="flex justify-between pl-3 pr-2 py-1 font-semibold text-[#12263A] bg-[#E6F6EE] rounded-md p-1">
                    <span>Current Period Net Profit</span>
                    <span className="tabular-nums text-[#1E8E5A]">{formatCurrency(balanceSheet.equity.currentPeriodProfit)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CASH FLOW STATEMENT */}
      {activeReportTab === 'cash_flow' && (
        <div className="bg-white rounded-xl border border-[#E8DFCF] p-4 shadow-2xs space-y-4">
          <div className="flex justify-between items-center border-b border-[#E8DFCF] pb-3">
            <div>
              <h3 className="font-bold text-[#12263A] text-sm">Cash Flow Statement (Indirect Method)</h3>
              <p className="text-xs text-[#3E5368]">Chronological operating, investing, and financing cash movements</p>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-[#3E5368] block">Net Change in Cash</span>
              <span className={`text-base tabular-nums font-bold ${cashFlow.netCashChange >= 0 ? 'text-[#1E8E5A]' : 'text-[#C23B3B]'}`}>
                {cashFlow.netCashChange >= 0 ? `+${formatCurrency(cashFlow.netCashChange)}` : formatCurrency(cashFlow.netCashChange)}
              </span>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between bg-[#FFFBF3] p-2.5 rounded-lg font-semibold text-[#12263A]">
              <span>Opening Cash & Bank Balances:</span>
              <span className="tabular-nums">{formatCurrency(cashFlow.openingCashAndBank)}</span>
            </div>

            <div className="border border-[#E8DFCF] rounded-lg p-3 space-y-1.5">
              <div className="flex justify-between font-semibold text-[#12263A] border-b border-[#E8DFCF] pb-1">
                <span>{cashFlow.operatingActivities.title}</span>
                <span className="tabular-nums text-[#1F86CC] font-bold">{formatCurrency(cashFlow.operatingActivities.netCashFlow)}</span>
              </div>
              {cashFlow.operatingActivities.items.map((item, idx) => (
                <div key={idx} className="flex justify-between py-1 text-[#3E5368]">
                  <span>{item.description}</span>
                  <span className="tabular-nums">{formatCurrency(item.amount)}</span>
                </div>
              ))}
            </div>

            <div className="border border-[#E8DFCF] rounded-lg p-3 space-y-1.5">
              <div className="flex justify-between font-semibold text-[#12263A] border-b border-[#E8DFCF] pb-1">
                <span>{cashFlow.investingActivities.title}</span>
                <span className="tabular-nums text-[#E0771A] font-bold">{formatCurrency(cashFlow.investingActivities.netCashFlow)}</span>
              </div>
              {cashFlow.investingActivities.items.map((item, idx) => (
                <div key={idx} className="flex justify-between py-1 text-[#3E5368]">
                  <span>{item.description}</span>
                  <span className="tabular-nums">{formatCurrency(item.amount)}</span>
                </div>
              ))}
            </div>

            <div className="border border-[#E8DFCF] rounded-lg p-3 space-y-1.5">
              <div className="flex justify-between font-semibold text-[#12263A] border-b border-[#E8DFCF] pb-1">
                <span>{cashFlow.financingActivities.title}</span>
                <span className="tabular-nums text-[#1F86CC] font-bold">{formatCurrency(cashFlow.financingActivities.netCashFlow)}</span>
              </div>
              {cashFlow.financingActivities.items.map((item, idx) => (
                <div key={idx} className="flex justify-between py-1 text-[#3E5368]">
                  <span>{item.description}</span>
                  <span className="tabular-nums">{formatCurrency(item.amount)}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-between bg-[#EAF5FD] border border-[#3BA0E6]/30 p-2.5 rounded-lg font-semibold text-[#1F86CC]">
              <span>Closing Cash & Bank Balances (Reconciled):</span>
              <span className="tabular-nums font-bold">{formatCurrency(cashFlow.closingCashAndBank)}</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: TRIAL BALANCE */}
      {activeReportTab === 'trial' && (
        <div className="bg-white rounded-xl border border-[#E8DFCF] overflow-hidden shadow-2xs">
          <div className="p-3.5 border-b border-[#E8DFCF] flex items-center justify-between">
            <h3 className="font-bold text-[#12263A] text-sm">Double-Entry Trial Balance Register</h3>
            <span className={`px-2 py-0.5 rounded-sm text-xs font-semibold ${
              trial.isBalanced ? 'bg-[#E6F6EE] text-[#1E8E5A] border border-[#1E8E5A]/20' : 'bg-[#FDECEC] text-[#C23B3B] border border-[#C23B3B]/20'
            }`}>
              {trial.isBalanced ? 'Balanced (Dr == Cr)' : `Discrepancy: ${formatCurrency(trial.difference)}`}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FFFBF3] text-[#3E5368] font-semibold border-b border-[#E8DFCF]">
                <tr>
                  <th className="p-3">Account Code</th>
                  <th className="p-3">Account Title</th>
                  <th className="p-3">Type</th>
                  <th className="p-3 text-right">Debit (₹)</th>
                  <th className="p-3 text-right">Credit (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8DFCF]">
                {trial.rows.map(r => (
                  <tr key={r.accountCode} className="hover:bg-[#FFFBF3] transition">
                    <td className="p-3 font-semibold text-[#12263A]">{r.accountCode}</td>
                    <td className="p-3 text-[#12263A]">{r.accountName}</td>
                    <td className="p-3 uppercase text-[10px] text-[#3E5368]">{r.type}</td>
                    <td className="p-3 text-right tabular-nums text-[#12263A]">{r.debit > 0 ? formatCurrency(r.debit) : '—'}</td>
                    <td className="p-3 text-right tabular-nums text-[#12263A]">{r.credit > 0 ? formatCurrency(r.credit) : '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-[#FFFBF3] font-semibold border-t border-[#E8DFCF] text-[#12263A]">
                <tr>
                  <td colSpan={3} className="p-3 text-right uppercase text-[10px] text-[#3E5368]">Total:</td>
                  <td className="p-3 text-right tabular-nums text-[#1F86CC]">{formatCurrency(trial.totalDebit)}</td>
                  <td className="p-3 text-right tabular-nums text-[#1F86CC]">{formatCurrency(trial.totalCredit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: DAYBOOK */}
      {activeReportTab === 'daybook' && (
        <div className="bg-white rounded-xl border border-[#E8DFCF] overflow-hidden shadow-2xs">
          <div className="p-3.5 border-b border-[#E8DFCF] flex items-center justify-between">
            <h3 className="font-bold text-[#12263A] text-sm">Chronological Daybook Register</h3>
            <span className="text-xs text-[#3E5368] font-semibold">{daybook.length} Transactions</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FFFBF3] text-[#3E5368] font-semibold border-b border-[#E8DFCF]">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Voucher No</th>
                  <th className="p-3">Voucher Type</th>
                  <th className="p-3">Party / Particulars</th>
                  <th className="p-3 text-right">Debit (₹)</th>
                  <th className="p-3 text-right">Credit (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8DFCF]">
                {daybook.map(d => (
                  <tr key={d.id} className="hover:bg-[#FFFBF3] transition">
                    <td className="p-3 text-[#3E5368]">{formatDate(d.date)}</td>
                    <td className="p-3 font-semibold text-[#1F86CC]">{d.voucherNumber}</td>
                    <td className="p-3 uppercase text-[10px] text-[#3E5368]">{d.voucherType}</td>
                    <td className="p-3 text-[#12263A]">
                      <strong>{d.partyName || d.narration}</strong>
                      <span className="block text-[11px] text-[#3E5368]">{d.accountNames}</span>
                    </td>
                    <td className="p-3 text-right tabular-nums text-[#12263A]">{formatCurrency(d.debit)}</td>
                    <td className="p-3 text-right tabular-nums text-[#12263A]">{formatCurrency(d.credit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: GENERAL LEDGER */}
      {activeReportTab === 'general_ledger' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 bg-white p-3.5 rounded-xl border border-[#E8DFCF] shadow-2xs">
            <label className="text-xs font-semibold text-[#12263A]">Select Ledger Account:</label>
            <select
              value={selectedLedgerAccountId}
              onChange={(e) => setSelectedLedgerAccountId(e.target.value)}
              className="h-10 px-3 text-xs rounded-lg border border-[#E8DFCF] bg-[#FFFBF3] font-semibold text-[#12263A] focus:outline-hidden focus:border-[#3BA0E6]"
            >
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.code} — {a.name} ({a.type})</option>
              ))}
            </select>
          </div>

          {generalLedger && (
            <div className="bg-white rounded-xl border border-[#E8DFCF] overflow-hidden shadow-2xs">
              <div className="p-3.5 border-b border-[#E8DFCF] flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-[#12263A] text-sm">{generalLedger.accountCode} — {generalLedger.accountName}</h3>
                  <span className="text-xs text-[#3E5368]">Opening Balance: {formatCurrency(generalLedger.openingBalance)}</span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-[#3E5368] block">Closing Balance</span>
                  <span className="tabular-nums font-bold text-sm text-[#1F86CC]">{formatCurrency(generalLedger.closingBalance)}</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FFFBF3] text-[#3E5368] font-semibold border-b border-[#E8DFCF]">
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3">Voucher Ref</th>
                      <th className="p-3">Particulars</th>
                      <th className="p-3 text-right">Debit</th>
                      <th className="p-3 text-right">Credit</th>
                      <th className="p-3 text-right">Running Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8DFCF]">
                    {generalLedger.transactions.map(t => (
                      <tr key={t.id} className="hover:bg-[#FFFBF3] transition">
                        <td className="p-3 text-[#3E5368]">{formatDate(t.date)}</td>
                        <td className="p-3 font-semibold text-[#1F86CC]">{t.voucherNumber}</td>
                        <td className="p-3 text-[#12263A]">{t.particulars}</td>
                        <td className="p-3 text-right tabular-nums text-[#1E8E5A]">{t.debit > 0 ? formatCurrency(t.debit) : '—'}</td>
                        <td className="p-3 text-right tabular-nums text-[#C23B3B]">{t.credit > 0 ? formatCurrency(t.credit) : '—'}</td>
                        <td className="p-3 text-right tabular-nums font-bold text-[#12263A]">{formatCurrency(t.runningBalance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 7: ITEM PROFITABILITY */}
      {activeReportTab === 'profitability' && (
        <div className="bg-white rounded-xl border border-[#E8DFCF] overflow-hidden shadow-2xs">
          <div className="p-3.5 border-b border-[#E8DFCF] flex items-center justify-between">
            <h3 className="font-bold text-[#12263A] text-sm">Product Profitability & Gross Margin Analysis</h3>
            <span className="text-xs text-[#3E5368]">Revenue minus Cost of Goods Sold</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FFFBF3] text-[#3E5368] font-semibold border-b border-[#E8DFCF]">
                <tr>
                  <th className="p-3">Product Name</th>
                  <th className="p-3 text-right">Qty Sold</th>
                  <th className="p-3 text-right">Sales Revenue</th>
                  <th className="p-3 text-right">COGS Cost</th>
                  <th className="p-3 text-right">Gross Profit</th>
                  <th className="p-3 text-right">Gross Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8DFCF]">
                {itemProfitability.map((item, idx) => (
                  <tr key={idx} className="hover:bg-[#FFFBF3] transition">
                    <td className="p-3 font-semibold text-[#12263A]">{item.productName}</td>
                    <td className="p-3 text-right tabular-nums text-[#3E5368]">{item.quantitySold}</td>
                    <td className="p-3 text-right tabular-nums text-[#12263A]">{formatCurrency(item.salesRevenue)}</td>
                    <td className="p-3 text-right tabular-nums text-[#3E5368]">{formatCurrency(item.costOfGoodsSold)}</td>
                    <td className="p-3 text-right tabular-nums font-bold text-[#1E8E5A]">{formatCurrency(item.grossProfit)}</td>
                    <td className="p-3 text-right tabular-nums font-bold text-[#1F86CC]">{item.grossMarginPercentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 8: GST REGISTERS */}
      {activeReportTab === 'tax' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="rounded-xl border border-[#E8DFCF] bg-white p-4 shadow-2xs">
              <p className="text-[11px] font-semibold text-[#3E5368]">Output Tax Collected (Sales)</p>
              <h3 className="text-xl font-bold tabular-nums text-[#1F86CC] mt-1">{formatCurrency(totalCgst + totalSgst + totalIgst)}</h3>
              <div className="mt-3 space-y-1 text-xs text-[#3E5368]">
                <div className="flex justify-between"><span>CGST:</span><span className="tabular-nums font-semibold">{formatCurrency(totalCgst)}</span></div>
                <div className="flex justify-between"><span>SGST:</span><span className="tabular-nums font-semibold">{formatCurrency(totalSgst)}</span></div>
                <div className="flex justify-between"><span>IGST:</span><span className="tabular-nums font-semibold">{formatCurrency(totalIgst)}</span></div>
              </div>
            </div>

            <div className="rounded-xl border border-[#E8DFCF] bg-white p-4 shadow-2xs">
              <p className="text-[11px] font-semibold text-[#3E5368]">Input Tax Credit Paid (Purchases)</p>
              <h3 className="text-xl font-bold tabular-nums text-[#1E8E5A] mt-1">{formatCurrency(itcCgst + itcSgst + itcIgst)}</h3>
              <div className="mt-3 space-y-1 text-xs text-[#3E5368]">
                <div className="flex justify-between"><span>CGST:</span><span className="tabular-nums font-semibold">{formatCurrency(itcCgst)}</span></div>
                <div className="flex justify-between"><span>SGST:</span><span className="tabular-nums font-semibold">{formatCurrency(itcSgst)}</span></div>
                <div className="flex justify-between"><span>IGST:</span><span className="tabular-nums font-semibold">{formatCurrency(itcIgst)}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 9: EXPORT REGISTERS */}
      {activeReportTab === 'registers' && (
        <div className="bg-white rounded-xl border border-[#E8DFCF] p-4 shadow-2xs space-y-4">
          <div>
            <h3 className="font-bold text-[#12263A] text-sm">Download Financial & Transaction Spreadsheets</h3>
            <p className="text-xs text-[#3E5368] mt-0.5">Export complete transactional datasets to Excel (.xlsx) or CSV for auditor verification.</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            <div className="p-3.5 border border-[#E8DFCF] rounded-xl flex items-center justify-between bg-[#FFFBF3]">
              <div>
                <h4 className="font-semibold text-[#12263A] text-xs">Sales Invoices Register</h4>
                <p className="text-[11px] text-[#3E5368]">All customer invoices with GST breakup</p>
              </div>
              <div className="flex gap-2">
                <button onClick={onExportSalesCSV} className="px-3 py-1.5 bg-white border border-[#E8DFCF] text-[#12263A] rounded-lg text-xs font-semibold hover:bg-[#EEF2F6] transition cursor-pointer">CSV</button>
                <button onClick={onExportSalesExcel} className="px-3 py-1.5 bg-[#E0771A] text-white rounded-lg text-xs font-semibold hover:bg-[#B85D0F] transition cursor-pointer shadow-2xs">Excel</button>
              </div>
            </div>

            <div className="p-3.5 border border-[#E8DFCF] rounded-xl flex items-center justify-between bg-[#FFFBF3]">
              <div>
                <h4 className="font-semibold text-[#12263A] text-xs">Purchase Bills Register</h4>
                <p className="text-[11px] text-[#3E5368]">All vendor bills and ITC claims</p>
              </div>
              <div className="flex gap-2">
                <button onClick={onExportPurchaseCSV} className="px-3 py-1.5 bg-white border border-[#E8DFCF] text-[#12263A] rounded-lg text-xs font-semibold hover:bg-[#EEF2F6] transition cursor-pointer">CSV</button>
                <button onClick={onExportPurchaseExcel} className="px-3 py-1.5 bg-[#E0771A] text-white rounded-lg text-xs font-semibold hover:bg-[#B85D0F] transition cursor-pointer shadow-2xs">Excel</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
