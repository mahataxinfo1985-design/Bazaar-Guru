import React, { useState, useMemo } from 'react';
import { 
  Landmark, FileSpreadsheet, Package, Users, BarChart3, ArrowUpRight, 
  ArrowDownRight, Scale, Activity, BookOpen, Layers, CheckCircle2, 
  AlertCircle, DollarSign, Calendar, TrendingUp 
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
  const [selectedLedgerAccountId, setSelectedLedgerAccountId] = useState(accounts[0]?.id || '');

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
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Financial Reporting & Accounts Engine</h2>
          <p className="text-sm text-slate-500">
            Audit-grade double-entry financial statements derived strictly from posted accounting entries.
          </p>
        </div>

        {/* Global Date Filters */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 font-mono text-slate-700 outline-none"
            placeholder="From Date"
          />
          <span className="text-xs text-slate-400">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 font-mono text-slate-700 outline-none"
            placeholder="To Date"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="text-xs text-blue-700 font-bold hover:underline px-2"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto bg-white rounded-t-xl px-2">
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
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveReportTab(tab.id as any)}
            className={`px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 whitespace-nowrap transition cursor-pointer ${
              activeReportTab === tab.id
                ? 'border-blue-700 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: PROFIT & LOSS */}
      {activeReportTab === 'pnl' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <p className="text-xs uppercase font-bold text-slate-400 tracking-wider">Total Sales Revenue</p>
              <h3 className="text-2xl font-bold font-mono text-slate-900 mt-1">{formatCurrency(pnl.totalRevenue)}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Recognized sales income</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <p className="text-xs uppercase font-bold text-slate-400 tracking-wider">Gross Profit</p>
              <h3 className="text-2xl font-bold font-mono text-emerald-600 mt-1">{formatCurrency(pnl.grossProfit)}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Revenue − Cost of Goods Sold ({formatCurrency(pnl.costOfGoodsSold)})</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <p className="text-xs uppercase font-bold text-slate-400 tracking-wider">Net Profit / (Loss)</p>
              <h3 className={`text-2xl font-bold font-mono mt-1 ${pnl.netProfit >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
                {formatCurrency(pnl.netProfit)}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Gross Profit − Operating Expenses ({formatCurrency(pnl.totalOperatingExpenses)})</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Income Section */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
              <h4 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 mb-3 flex items-center justify-between">
                <span>Revenue & Operating Income</span>
                <span className="font-mono text-emerald-600">{formatCurrency(pnl.totalRevenue)}</span>
              </h4>
              <div className="divide-y divide-slate-100 text-xs">
                {pnl.revenueLines.map((line, idx) => (
                  <div key={idx} className="py-2 flex justify-between">
                    <span className="text-slate-600">{line.accountName}</span>
                    <span className="font-mono font-bold text-slate-900">{formatCurrency(line.amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Expenses Section */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
              <h4 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 mb-3 flex items-center justify-between">
                <span>Cost of Goods Sold & Expenses</span>
                <span className="font-mono text-red-600">{formatCurrency(pnl.costOfGoodsSold + pnl.totalOperatingExpenses)}</span>
              </h4>
              <div className="divide-y divide-slate-100 text-xs">
                <div className="py-2 flex justify-between bg-slate-50 px-2 rounded font-semibold">
                  <span className="text-slate-700">Cost of Goods Sold (COGS)</span>
                  <span className="font-mono text-slate-900">{formatCurrency(pnl.costOfGoodsSold)}</span>
                </div>
                {pnl.expenseLines.map((line, idx) => (
                  <div key={idx} className="py-2 flex justify-between">
                    <span className="text-slate-600">{line.accountName}</span>
                    <span className="font-mono font-bold text-slate-900">{formatCurrency(line.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BALANCE SHEET */}
      {activeReportTab === 'balance_sheet' && (
        <div className="space-y-6">
          {/* Balance Status Banner */}
          <div className={`p-4 rounded-2xl border flex items-center justify-between ${
            balanceSheet.isBalanced ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}>
            <div className="flex items-center gap-2.5">
              {balanceSheet.isBalanced ? <CheckCircle2 size={20} className="text-emerald-600" /> : <AlertCircle size={20} className="text-amber-600" />}
              <div>
                <h4 className="font-bold text-sm">
                  {balanceSheet.isBalanced ? 'Balance Sheet is Perfectly Balanced' : 'Balance Sheet Has an Open Variance'}
                </h4>
                <p className="text-xs opacity-90">
                  Total Assets: <strong>{formatCurrency(balanceSheet.assets.totalAssets)}</strong> = Total Liabilities & Equity: <strong>{formatCurrency(balanceSheet.totalLiabilitiesAndEquity)}</strong>
                </p>
              </div>
            </div>
            {!balanceSheet.isBalanced && (
              <span className="font-mono font-bold text-xs bg-amber-200/60 px-2.5 py-1 rounded-lg">
                Difference: {formatCurrency(balanceSheet.difference)}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* ASSETS */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                <h3 className="font-bold text-slate-900 text-base">Assets</h3>
                <span className="font-mono font-bold text-base text-blue-700">{formatCurrency(balanceSheet.assets.totalAssets)}</span>
              </div>

              {[
                balanceSheet.assets.cashAndBank,
                balanceSheet.assets.accountsReceivable,
                balanceSheet.assets.inventory,
                balanceSheet.assets.otherCurrentAssets,
                balanceSheet.assets.fixedAssets,
              ].map((sec, i) => (
                <div key={i} className="text-xs space-y-1">
                  <div className="flex justify-between font-bold text-slate-700 bg-slate-50 p-2 rounded-lg">
                    <span>{sec.title}</span>
                    <span className="font-mono">{formatCurrency(sec.total)}</span>
                  </div>
                  {sec.lines.map((l, j) => (
                    <div key={j} className="flex justify-between pl-3 pr-2 py-1 text-slate-600">
                      <span>{l.accountName} ({l.accountCode})</span>
                      <span className="font-mono">{formatCurrency(l.amount)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* LIABILITIES & EQUITY */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                <h3 className="font-bold text-slate-900 text-base">Liabilities & Equity</h3>
                <span className="font-mono font-bold text-base text-purple-700">{formatCurrency(balanceSheet.totalLiabilitiesAndEquity)}</span>
              </div>

              {/* Liabilities */}
              <div className="space-y-3">
                <h4 className="text-xs uppercase font-bold text-slate-400 tracking-wider">Liabilities ({formatCurrency(balanceSheet.liabilities.totalLiabilities)})</h4>
                {[
                  balanceSheet.liabilities.accountsPayable,
                  balanceSheet.liabilities.gstLiabilities,
                  balanceSheet.liabilities.loans,
                  balanceSheet.liabilities.otherCurrentLiabilities,
                ].map((sec, i) => (
                  <div key={i} className="text-xs space-y-1">
                    <div className="flex justify-between font-bold text-slate-700 bg-slate-50 p-2 rounded-lg">
                      <span>{sec.title}</span>
                      <span className="font-mono">{formatCurrency(sec.total)}</span>
                    </div>
                    {sec.lines.map((l, j) => (
                      <div key={j} className="flex justify-between pl-3 pr-2 py-1 text-slate-600">
                        <span>{l.accountName} ({l.accountCode})</span>
                        <span className="font-mono">{formatCurrency(l.amount)}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Equity */}
              <div className="space-y-3 pt-3 border-t border-slate-200">
                <h4 className="text-xs uppercase font-bold text-slate-400 tracking-wider">Equity ({formatCurrency(balanceSheet.equity.totalEquity)})</h4>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between pl-3 pr-2 py-1 text-slate-600">
                    <span>Owner Capital</span>
                    <span className="font-mono">{formatCurrency(balanceSheet.equity.ownerCapital.total)}</span>
                  </div>
                  {balanceSheet.equity.drawings.total > 0 && (
                    <div className="flex justify-between pl-3 pr-2 py-1 text-red-600">
                      <span>Less: Owner Drawings</span>
                      <span className="font-mono">-{formatCurrency(balanceSheet.equity.drawings.total)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pl-3 pr-2 py-1 text-slate-600">
                    <span>Retained Earnings</span>
                    <span className="font-mono">{formatCurrency(balanceSheet.equity.retainedEarnings.total)}</span>
                  </div>
                  <div className="flex justify-between pl-3 pr-2 py-1 font-bold text-slate-900 bg-emerald-50 rounded p-1">
                    <span>Current Period Net Profit</span>
                    <span className="font-mono">{formatCurrency(balanceSheet.equity.currentPeriodProfit)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CASH FLOW STATEMENT */}
      {activeReportTab === 'cash_flow' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex justify-between items-center border-b border-slate-200 pb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Cash Flow Statement (Indirect Method)</h3>
              <p className="text-xs text-slate-500">Chronological operating, investing, and financing cash movements</p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 block">Net Change in Cash</span>
              <span className={`text-lg font-mono font-bold ${cashFlow.netCashChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {cashFlow.netCashChange >= 0 ? `+${formatCurrency(cashFlow.netCashChange)}` : formatCurrency(cashFlow.netCashChange)}
              </span>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            {/* Opening Cash */}
            <div className="flex justify-between bg-slate-50 p-3 rounded-xl font-bold text-slate-700">
              <span>Opening Cash & Bank Balances:</span>
              <span className="font-mono">{formatCurrency(cashFlow.openingCashAndBank)}</span>
            </div>

            {/* Operating */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-2">
              <div className="flex justify-between font-bold text-slate-900 border-b border-slate-100 pb-1.5">
                <span>{cashFlow.operatingActivities.title}</span>
                <span className="font-mono text-blue-700">{formatCurrency(cashFlow.operatingActivities.netCashFlow)}</span>
              </div>
              {cashFlow.operatingActivities.items.map((item, idx) => (
                <div key={idx} className="flex justify-between py-1 text-slate-600">
                  <span>{item.description}</span>
                  <span className="font-mono">{formatCurrency(item.amount)}</span>
                </div>
              ))}
            </div>

            {/* Investing */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-2">
              <div className="flex justify-between font-bold text-slate-900 border-b border-slate-100 pb-1.5">
                <span>{cashFlow.investingActivities.title}</span>
                <span className="font-mono text-purple-700">{formatCurrency(cashFlow.investingActivities.netCashFlow)}</span>
              </div>
              {cashFlow.investingActivities.items.map((item, idx) => (
                <div key={idx} className="flex justify-between py-1 text-slate-600">
                  <span>{item.description}</span>
                  <span className="font-mono">{formatCurrency(item.amount)}</span>
                </div>
              ))}
            </div>

            {/* Financing */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-2">
              <div className="flex justify-between font-bold text-slate-900 border-b border-slate-100 pb-1.5">
                <span>{cashFlow.financingActivities.title}</span>
                <span className="font-mono text-amber-700">{formatCurrency(cashFlow.financingActivities.netCashFlow)}</span>
              </div>
              {cashFlow.financingActivities.items.map((item, idx) => (
                <div key={idx} className="flex justify-between py-1 text-slate-600">
                  <span>{item.description}</span>
                  <span className="font-mono">{formatCurrency(item.amount)}</span>
                </div>
              ))}
            </div>

            {/* Closing Cash */}
            <div className="flex justify-between bg-blue-50 border border-blue-200 p-3 rounded-xl font-bold text-blue-900">
              <span>Closing Cash & Bank Balances (Reconciled):</span>
              <span className="font-mono">{formatCurrency(cashFlow.closingCashAndBank)}</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: TRIAL BALANCE */}
      {activeReportTab === 'trial' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">Double-Entry Trial Balance Register</h3>
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold font-mono ${
              trial.isBalanced ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {trial.isBalanced ? 'Balanced (Dr == Cr)' : `Discrepancy: ${formatCurrency(trial.difference)}`}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">Account Code</th>
                  <th className="p-3">Account Title</th>
                  <th className="p-3">Type</th>
                  <th className="p-3 text-right">Debit (₹)</th>
                  <th className="p-3 text-right">Credit (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trial.rows.map(r => (
                  <tr key={r.accountCode} className="hover:bg-slate-50/80 transition">
                    <td className="p-3 font-bold text-slate-900">{r.accountCode}</td>
                    <td className="p-3 font-sans text-slate-700">{r.accountName}</td>
                    <td className="p-3 uppercase text-[10px] text-slate-400 font-sans">{r.type}</td>
                    <td className="p-3 text-right text-slate-900">{r.debit > 0 ? formatCurrency(r.debit) : '—'}</td>
                    <td className="p-3 text-right text-slate-900">{r.credit > 0 ? formatCurrency(r.credit) : '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 font-bold border-t border-slate-200 text-slate-900">
                <tr>
                  <td colSpan={3} className="p-3 text-right uppercase">Total:</td>
                  <td className="p-3 text-right font-mono text-blue-700">{formatCurrency(trial.totalDebit)}</td>
                  <td className="p-3 text-right font-mono text-blue-700">{formatCurrency(trial.totalCredit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: DAYBOOK */}
      {activeReportTab === 'daybook' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">Chronological Daybook Register</h3>
            <span className="text-xs text-slate-500 font-mono font-semibold">{daybook.length} Transactions</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Voucher No</th>
                  <th className="p-3">Voucher Type</th>
                  <th className="p-3">Party / Particulars</th>
                  <th className="p-3 text-right">Debit (₹)</th>
                  <th className="p-3 text-right">Credit (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {daybook.map(d => (
                  <tr key={d.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3 text-slate-600">{formatDate(d.date)}</td>
                    <td className="p-3 font-bold text-blue-700">{d.voucherNumber}</td>
                    <td className="p-3 font-sans uppercase text-[10px] text-slate-500">{d.voucherType}</td>
                    <td className="p-3 font-sans text-slate-700">
                      <strong>{d.partyName || d.narration}</strong>
                      <span className="block text-[11px] text-slate-400 font-mono">{d.accountNames}</span>
                    </td>
                    <td className="p-3 text-right text-slate-900">{formatCurrency(d.debit)}</td>
                    <td className="p-3 text-right text-slate-900">{formatCurrency(d.credit)}</td>
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
          <div className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <label className="text-xs font-bold text-slate-700 uppercase">Select General Ledger Account:</label>
            <select
              value={selectedLedgerAccountId}
              onChange={(e) => setSelectedLedgerAccountId(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white font-bold text-slate-900 outline-none"
            >
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.code} — {a.name} ({a.type})</option>
              ))}
            </select>
          </div>

          {generalLedger && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{generalLedger.accountCode} — {generalLedger.accountName}</h3>
                  <span className="text-xs text-slate-500">Opening Balance: {formatCurrency(generalLedger.openingBalance)}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 block">Closing Balance</span>
                  <span className="font-mono font-bold text-base text-blue-700">{formatCurrency(generalLedger.closingBalance)}</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3">Voucher Ref</th>
                      <th className="p-3">Particulars</th>
                      <th className="p-3 text-right">Debit</th>
                      <th className="p-3 text-right">Credit</th>
                      <th className="p-3 text-right">Running Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {generalLedger.transactions.map(t => (
                      <tr key={t.id} className="hover:bg-slate-50/80 transition">
                        <td className="p-3 text-slate-600">{formatDate(t.date)}</td>
                        <td className="p-3 font-bold text-blue-700">{t.voucherNumber}</td>
                        <td className="p-3 font-sans text-slate-700">{t.particulars}</td>
                        <td className="p-3 text-right text-emerald-600">{t.debit > 0 ? formatCurrency(t.debit) : '—'}</td>
                        <td className="p-3 text-right text-red-600">{t.credit > 0 ? formatCurrency(t.credit) : '—'}</td>
                        <td className="p-3 text-right font-bold text-slate-900">{formatCurrency(t.runningBalance)}</td>
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
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">Product Profitability & Gross Margin Analysis</h3>
            <span className="text-xs text-slate-500">Revenue minus Cost of Goods Sold</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">Product Name</th>
                  <th className="p-3 text-right">Qty Sold</th>
                  <th className="p-3 text-right">Sales Revenue</th>
                  <th className="p-3 text-right">COGS Cost</th>
                  <th className="p-3 text-right">Gross Profit</th>
                  <th className="p-3 text-right">Gross Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {itemProfitability.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition">
                    <td className="p-3 font-bold font-sans text-slate-900">{item.productName}</td>
                    <td className="p-3 text-right text-slate-700">{item.quantitySold}</td>
                    <td className="p-3 text-right text-slate-900">{formatCurrency(item.salesRevenue)}</td>
                    <td className="p-3 text-right text-slate-600">{formatCurrency(item.costOfGoodsSold)}</td>
                    <td className="p-3 text-right font-bold text-emerald-600">{formatCurrency(item.grossProfit)}</td>
                    <td className="p-3 text-right font-bold text-blue-700">{item.grossMarginPercentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 8: GST REGISTERS */}
      {activeReportTab === 'tax' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <p className="text-xs uppercase font-bold text-slate-400 tracking-wider">Output Tax Collected (Sales)</p>
              <h3 className="text-2xl font-bold font-mono text-blue-700 mt-1">{formatCurrency(totalCgst + totalSgst + totalIgst)}</h3>
              <div className="mt-3 space-y-1 text-xs text-slate-500">
                <div className="flex justify-between"><span>CGST:</span><span className="font-mono">{formatCurrency(totalCgst)}</span></div>
                <div className="flex justify-between"><span>SGST:</span><span className="font-mono">{formatCurrency(totalSgst)}</span></div>
                <div className="flex justify-between"><span>IGST:</span><span className="font-mono">{formatCurrency(totalIgst)}</span></div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <p className="text-xs uppercase font-bold text-slate-400 tracking-wider">Input Tax Credit Paid (Purchases)</p>
              <h3 className="text-2xl font-bold font-mono text-emerald-600 mt-1">{formatCurrency(itcCgst + itcSgst + itcIgst)}</h3>
              <div className="mt-3 space-y-1 text-xs text-slate-500">
                <div className="flex justify-between"><span>CGST:</span><span className="font-mono">{formatCurrency(itcCgst)}</span></div>
                <div className="flex justify-between"><span>SGST:</span><span className="font-mono">{formatCurrency(itcSgst)}</span></div>
                <div className="flex justify-between"><span>IGST:</span><span className="font-mono">{formatCurrency(itcIgst)}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 9: EXPORT REGISTERS */}
      {activeReportTab === 'registers' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-900 text-sm">Download Financial & Transaction Spreadsheets</h3>
          <p className="text-xs text-slate-500">Export complete transactional datasets to Excel (.xlsx) or CSV for auditor verification.</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-4 border border-slate-200 rounded-xl flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-900 text-xs">Sales Invoices Register</h4>
                <p className="text-[11px] text-slate-400">All customer invoices with GST breakup</p>
              </div>
              <div className="flex gap-2">
                <button onClick={onExportSalesCSV} className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-200 transition cursor-pointer">CSV</button>
                <button onClick={onExportSalesExcel} className="px-3 py-1.5 bg-emerald-700 text-white rounded-lg text-xs font-bold hover:bg-emerald-800 transition cursor-pointer">Excel</button>
              </div>
            </div>

            <div className="p-4 border border-slate-200 rounded-xl flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-900 text-xs">Purchase Bills Register</h4>
                <p className="text-[11px] text-slate-400">All vendor bills and ITC claims</p>
              </div>
              <div className="flex gap-2">
                <button onClick={onExportPurchaseCSV} className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-200 transition cursor-pointer">CSV</button>
                <button onClick={onExportPurchaseExcel} className="px-3 py-1.5 bg-emerald-700 text-white rounded-lg text-xs font-bold hover:bg-emerald-800 transition cursor-pointer">Excel</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
