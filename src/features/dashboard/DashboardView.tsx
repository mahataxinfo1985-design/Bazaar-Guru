import React from 'react';
import {
  FileText,
  ShoppingCart,
  Landmark,
  AlertCircle,
  Receipt,
  HeartHandshake,
  Package,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  FileSpreadsheet,
  Users,
  Wallet,
  TrendingUp,
  Boxes,
  AlertTriangle
} from 'lucide-react';
import { Invoice, Party, Item, Expense } from '../../types';
import { Account, JournalEntry } from '../../types/accounting';
import { StockMovement } from '../../types/inventory';
import { formatCurrency } from '../../utils/decimal';
import { generateProfitAndLoss } from '../../services/accounting/financialReports';
import { detectLowStockAlerts } from '../../services/inventory/stockMovementService';

interface DashboardViewProps {
  invoices: Invoice[];
  parties: Party[];
  items: Item[];
  expenses: Expense[];
  accounts: Account[];
  journalEntries?: JournalEntry[];
  stockMovements?: StockMovement[];
  onNavigate: (tab: string) => void;
  onCreateSales: () => void;
  onCreatePurchase: () => void;
  onViewInvoice: (inv: Invoice) => void;
}

export default function DashboardView({
  invoices,
  parties,
  items,
  expenses,
  accounts,
  journalEntries = [],
  stockMovements = [],
  onNavigate,
  onCreateSales,
  onCreatePurchase,
  onViewInvoice,
}: DashboardViewProps) {
  // 1. Calculate P&L metrics from financial report engine if journal entries exist, else fallback to invoice totals
  let totalSales = 0;
  let totalPurchases = 0;
  let netGstCollected = 0;
  let totalReceivable = 0;
  let totalPayable = 0;

  invoices.forEach((inv) => {
    if (inv.status === 'Cancelled' || inv.deleted) return;
    const isPurchase = inv.type.includes('Purchase') || inv.type === 'Purchase Return';
    if (isPurchase) {
      totalPurchases += inv.grandTotal;
    } else {
      totalSales += inv.grandTotal;
      netGstCollected += inv.cgst + inv.sgst + inv.igst;
      if (inv.paymentStatus !== 'Paid') {
        totalReceivable += inv.balanceDue;
      }
    }
  });

  invoices
    .filter((inv) => !inv.deleted && inv.status !== 'Cancelled' && (inv.type.includes('Purchase') || inv.type === 'Purchase Return'))
    .forEach((inv) => {
      totalPayable += inv.balanceDue;
    });

  // Calculate Gross & Net Profit using financial reporting engine
  let grossProfit = 0;
  let netProfit = 0;
  let totalCOGS = 0;

  if (journalEntries.length > 0) {
    const pnl = generateProfitAndLoss(accounts, journalEntries);
    grossProfit = pnl.grossProfit;
    netProfit = pnl.netProfit;
    totalCOGS = pnl.costOfGoodsSold;
  } else {
    // Basic approximation if journals not yet migrated
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    grossProfit = totalSales - totalPurchases;
    netProfit = grossProfit - totalExpenses;
  }

  // Cash & Bank Balances from Chart of Accounts
  const cashAccount = accounts.find((a) => a.code === '1010' || a.subtype === 'cash');
  const bankAccount = accounts.find((a) => a.code === '1020' || a.subtype === 'bank');
  const cashBalance = cashAccount ? cashAccount.currentBalance : 0;
  const bankBalance = bankAccount ? bankAccount.currentBalance : 0;

  // Total Inventory Valuation (sum of current stock * unit cost across physical items)
  const totalInventoryValuation = items.reduce((acc, it: any) => {
    if (it.itemType === 'service') return acc;
    const cost = it.purchasePrice ?? it.costPrice ?? it.unitPrice ?? 0;
    const qty = it.stockQty ?? 0;
    return acc + (qty * cost);
  }, 0);

  // Low Stock Items Alerts
  const lowStockAlerts = detectLowStockAlerts(items as any[], stockMovements);
  const lowStockCount = lowStockAlerts.length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Business Dashboard</h2>
          <p className="text-sm text-slate-500">Real-time ledger overview, inventory valuation, cash/bank balances, and P&L.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onCreateSales}
            className="flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-800 transition cursor-pointer"
          >
            <Plus size={16} />
            <span>Create Sales Invoice</span>
          </button>
          <button
            onClick={onCreatePurchase}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          >
            <Plus size={16} />
            <span>Log Purchase Bill</span>
          </button>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        <button
          onClick={() => onNavigate('items')}
          className="flex-shrink-0 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs hover:border-amber-300 hover:bg-amber-50 transition cursor-pointer"
        >
          <Package size={14} className="text-amber-600" />
          Stock Inventory & Godowns
        </button>
        <button
          onClick={() => onNavigate('reports')}
          className="flex-shrink-0 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs hover:border-emerald-300 hover:bg-emerald-50 transition cursor-pointer"
        >
          <FileSpreadsheet size={14} className="text-emerald-600" />
          Financial Reports (P&L, Balance Sheet)
        </button>
        <button
          onClick={() => onNavigate('accounting')}
          className="flex-shrink-0 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs hover:border-indigo-300 hover:bg-indigo-50 transition cursor-pointer"
        >
          <Wallet size={14} className="text-indigo-600" />
          Chart of Accounts & Journals
        </button>
        <button
          onClick={() => onNavigate('banking')}
          className="flex-shrink-0 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs hover:border-blue-300 hover:bg-blue-50 transition cursor-pointer"
        >
          <Landmark size={14} className="text-blue-600" />
          Banking & Passbook
        </button>
        <button
          onClick={() => onNavigate('parties')}
          className="flex-shrink-0 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs hover:border-violet-300 hover:bg-violet-50 transition cursor-pointer"
        >
          <Users size={14} className="text-violet-600" />
          Customer & Vendor Statements
        </button>
      </div>

      {/* ROW 1: PROFITABILITY & INVENTORY METRICS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gross Profit */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gross Profit</p>
            <h3 className={`text-xl font-bold mt-1 ${grossProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {formatCurrency(grossProfit)}
            </h3>
            <p className="text-[10px] text-slate-500 font-medium flex items-center gap-0.5 mt-0.5">
              Revenue - COGS ({formatCurrency(totalCOGS)})
            </p>
          </div>
          <div className="h-11 w-11 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <TrendingUp size={20} />
          </div>
        </div>

        {/* Net Profit */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Net Profit</p>
            <h3 className={`text-xl font-bold mt-1 ${netProfit >= 0 ? 'text-indigo-700' : 'text-rose-700'}`}>
              {formatCurrency(netProfit)}
            </h3>
            <p className="text-[10px] text-slate-500 font-medium flex items-center gap-0.5 mt-0.5">
              After Operating Expenses
            </p>
          </div>
          <div className="h-11 w-11 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <FileSpreadsheet size={20} />
          </div>
        </div>

        {/* Total Inventory Valuation */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Inventory Valuation</p>
            <h3 className="text-xl font-bold text-slate-950 mt-1">{formatCurrency(totalInventoryValuation)}</h3>
            <p className="text-[10px] text-amber-600 font-medium flex items-center gap-0.5 mt-0.5">
              Stock Asset (A/C 1400)
            </p>
          </div>
          <div className="h-11 w-11 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <Boxes size={20} />
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div 
          onClick={() => onNavigate('items')}
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs flex items-center justify-between cursor-pointer hover:border-amber-300 transition"
        >
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Low Stock Items</p>
            <h3 className={`text-xl font-bold mt-1 ${lowStockCount > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
              {lowStockCount} Items
            </h3>
            <p className="text-[10px] text-slate-500 font-medium flex items-center gap-0.5 mt-0.5">
              {lowStockCount > 0 ? 'Needs reorder attention' : 'Inventory levels optimal'}
            </p>
          </div>
          <div className={`h-11 w-11 rounded-lg flex items-center justify-center ${lowStockCount > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
            <AlertTriangle size={20} />
          </div>
        </div>
      </div>

      {/* ROW 2: SALES, PURCHASES, GST & RECEIVABLES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Sales */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Sales Invoiced</p>
            <h3 className="text-xl font-bold text-slate-950 mt-1">{formatCurrency(totalSales)}</h3>
            <p className="text-[10px] text-green-600 font-medium flex items-center gap-0.5 mt-0.5">
              <ArrowUpRight size={12} /> Revenue Account 4010
            </p>
          </div>
          <div className="h-11 w-11 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <FileText size={20} />
          </div>
        </div>

        {/* Total Purchases */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Purchases Logged</p>
            <h3 className="text-xl font-bold text-slate-950 mt-1">{formatCurrency(totalPurchases)}</h3>
            <p className="text-[10px] text-blue-600 font-medium flex items-center gap-0.5 mt-0.5">
              <ArrowUpRight size={12} /> Expense Account 5020
            </p>
          </div>
          <div className="h-11 w-11 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <ShoppingCart size={20} />
          </div>
        </div>

        {/* Net GST Collected */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Net GST Collected</p>
            <h3 className="text-xl font-bold text-slate-950 mt-1">{formatCurrency(netGstCollected)}</h3>
            <p className="text-[10px] text-amber-600 font-medium flex items-center gap-0.5 mt-0.5 font-mono">
              Output GST (2020-2040)
            </p>
          </div>
          <div className="h-11 w-11 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <Landmark size={20} />
          </div>
        </div>

        {/* Pending Receivables */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pending Receivables</p>
            <h3 className="text-xl font-bold text-slate-950 mt-1">{formatCurrency(totalReceivable)}</h3>
            <p className="text-[10px] text-red-500 font-medium flex items-center gap-0.5 mt-0.5">
              Debtors A/C 1200
            </p>
          </div>
          <div className="h-11 w-11 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
            <AlertCircle size={20} />
          </div>
        </div>
      </div>

      {/* ROW 3: CASH/BANK & PAYABLES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Cash in Hand */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cash on Hand</p>
            <h3 className="text-lg font-bold text-slate-900 mt-1 font-mono">{formatCurrency(cashBalance)}</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Account 1010</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <Wallet size={18} />
          </div>
        </div>

        {/* Bank Balance */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Primary Bank Balance</p>
            <h3 className="text-lg font-bold text-slate-900 mt-1 font-mono">{formatCurrency(bankBalance)}</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Account 1020</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
            <Landmark size={18} />
          </div>
        </div>

        {/* Outstanding Payables */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Outstanding Payables</p>
            <h3 className="text-lg font-bold text-slate-900 mt-1 font-mono">{formatCurrency(totalPayable)}</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Creditors A/C 2010</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
            <HeartHandshake size={18} />
          </div>
        </div>

        {/* Reconciled Liquid Funds */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Liquid Funds</p>
            <h3 className="text-lg font-bold text-slate-900 mt-1 font-mono">{formatCurrency(cashBalance + bankBalance)}</h3>
            <p className="text-[10px] text-emerald-600 mt-0.5">Cash + Bank Assets</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <Receipt size={18} />
          </div>
        </div>
      </div>

      {/* RECENT INVOICES & QUICK STOCK MONITOR */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Invoices block */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h3 className="font-bold text-slate-900 text-sm">Recent Invoices</h3>
            <button
              onClick={() => onNavigate('sales')}
              className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
            >
              View All
            </button>
          </div>
          <div className="divide-y divide-slate-100 overflow-x-auto">
            {invoices.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">No invoices generated yet.</div>
            ) : (
              invoices.slice(0, 5).map((inv) => {
                const partyObj = parties.find((p) => p.id === inv.partyId);
                const isPur = inv.type.includes('Purchase');
                return (
                  <div
                    key={inv.id}
                    onClick={() => onViewInvoice(inv)}
                    className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
                          isPur ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {isPur ? 'PR' : 'SL'}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">{inv.invoiceNumber}</p>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5 truncate max-w-[150px]">
                          {partyObj?.name || 'Party'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <p className="text-xs font-bold text-slate-900">{formatCurrency(inv.grandTotal)}</p>
                        <p className="text-[10px] text-slate-400 font-medium mt-0.5">{inv.date}</p>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold ${
                          inv.paymentStatus === 'Paid'
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : inv.paymentStatus === 'Partial'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                      >
                        {inv.paymentStatus}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Quick Stock Monitor card */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-2xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-900 text-sm">Quick Stock Monitor</h3>
              <button 
                onClick={() => onNavigate('items')}
                className="text-xs font-bold text-blue-600 hover:underline"
              >
                Manage
              </button>
            </div>
            <div className="space-y-3">
              {items.slice(0, 5).map((it: any) => {
                const isService = it.itemType === 'service';
                const isLow = !isService && (it.stockQty <= (it.reorderPoint || it.minStockLevel || 10));
                return (
                  <div
                    key={it.id}
                    className="flex items-center justify-between text-xs pb-2 border-b border-slate-100 last:border-0 last:pb-0"
                  >
                    <div>
                      <p className="font-bold text-slate-800">{it.name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {isService ? 'Service Item' : `Cost: ₹${it.purchasePrice ?? it.costPrice ?? 0} | Price: ₹${it.unitPrice ?? 0}`}
                      </p>
                    </div>
                    {isService ? (
                      <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-slate-100 text-slate-600">
                        Service
                      </span>
                    ) : (
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          isLow ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {it.stockQty} {it.unit || 'units'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
            <p className="text-slate-400 font-medium">Derived from inventory & double-entry ledger</p>
            <button
              onClick={() => onNavigate('items')}
              className="text-blue-600 font-bold hover:underline cursor-pointer"
            >
              Inventory Workspace
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
