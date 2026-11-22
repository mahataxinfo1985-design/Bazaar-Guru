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

  let grossProfit = 0;
  let netProfit = 0;
  let totalCOGS = 0;

  if (journalEntries.length > 0) {
    const pnl = generateProfitAndLoss(accounts, journalEntries);
    grossProfit = pnl.grossProfit;
    netProfit = pnl.netProfit;
    totalCOGS = pnl.costOfGoodsSold;
  } else {
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    grossProfit = totalSales - totalPurchases;
    netProfit = grossProfit - totalExpenses;
  }

  const cashAccount = accounts.find((a) => a.code === '1010' || a.subtype === 'cash');
  const bankAccount = accounts.find((a) => a.code === '1020' || a.subtype === 'bank');
  const cashBalance = cashAccount ? cashAccount.currentBalance : 0;
  const bankBalance = bankAccount ? bankAccount.currentBalance : 0;

  const totalInventoryValuation = items.reduce((acc, it: any) => {
    if (it.itemType === 'service') return acc;
    const cost = it.purchasePrice ?? it.costPrice ?? it.unitPrice ?? 0;
    const qty = it.stockQty ?? 0;
    return acc + (qty * cost);
  }, 0);

  const lowStockAlerts = detectLowStockAlerts(items as any[], stockMovements);
  const lowStockCount = lowStockAlerts.length;

  return (
    <div className="space-y-6">
      {/* 4-Up Quick Actions Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          onClick={() => onNavigate('items')}
          className="flex items-center gap-3 p-3.5 bg-white border border-[#E8DFCF] hover:border-[#1F86CC] rounded-xl text-left transition cursor-pointer shadow-xs"
        >
          <div className="w-10 h-10 rounded-lg bg-[#FFF8EC] text-[#E0771A] flex items-center justify-center shrink-0">
            <Boxes size={20} />
          </div>
          <div>
            <span className="block text-[13px] font-semibold text-[#12263A]">Stock Inventory</span>
            <span className="block text-[12px] text-[#3E5368]">Godowns & valuation</span>
          </div>
        </button>

        <button
          onClick={() => onNavigate('reports')}
          className="flex items-center gap-3 p-3.5 bg-white border border-[#E8DFCF] hover:border-[#1F86CC] rounded-xl text-left transition cursor-pointer shadow-xs"
        >
          <div className="w-10 h-10 rounded-lg bg-[#E6F6EE] text-[#1E8E5A] flex items-center justify-center shrink-0">
            <FileSpreadsheet size={20} />
          </div>
          <div>
            <span className="block text-[13px] font-semibold text-[#12263A]">Financial Reports</span>
            <span className="block text-[12px] text-[#3E5368]">P&L & Balance Sheet</span>
          </div>
        </button>

        <button
          onClick={() => onNavigate('accounting')}
          className="flex items-center gap-3 p-3.5 bg-white border border-[#E8DFCF] hover:border-[#1F86CC] rounded-xl text-left transition cursor-pointer shadow-xs"
        >
          <div className="w-10 h-10 rounded-lg bg-[#EAF5FD] text-[#14689F] flex items-center justify-center shrink-0">
            <Wallet size={20} />
          </div>
          <div>
            <span className="block text-[13px] font-semibold text-[#12263A]">Chart of Accounts</span>
            <span className="block text-[12px] text-[#3E5368]">General ledger & journals</span>
          </div>
        </button>

        <button
          onClick={() => onNavigate('banking')}
          className="flex items-center gap-3 p-3.5 bg-white border border-[#E8DFCF] hover:border-[#1F86CC] rounded-xl text-left transition cursor-pointer shadow-xs"
        >
          <div className="w-10 h-10 rounded-lg bg-[#EAF5FD] text-[#1F86CC] flex items-center justify-center shrink-0">
            <Landmark size={20} />
          </div>
          <div>
            <span className="block text-[13px] font-semibold text-[#12263A]">Payments & Banking</span>
            <span className="block text-[12px] text-[#3E5368]">Receipts & reconciliation</span>
          </div>
        </button>
      </div>

      {/* ROW 1: PROFITABILITY & INVENTORY METRICS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gross Profit */}
        <div className="rounded-xl border border-[#E8DFCF] bg-white p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium text-[#3E5368]">Gross profit</p>
            <h3 className={`text-xl font-bold mt-1 tabular-nums ${grossProfit >= 0 ? 'text-[#1E8E5A]' : 'text-[#C23B3B]'}`}>
              {formatCurrency(grossProfit)}
            </h3>
            <p className="text-[12px] text-[#3E5368] mt-0.5 tabular-nums">
              COGS: {formatCurrency(totalCOGS)}
            </p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-[#E6F6EE] text-[#1E8E5A] flex items-center justify-center">
            <TrendingUp size={20} />
          </div>
        </div>

        {/* Net Profit */}
        <div className="rounded-xl border border-[#E8DFCF] bg-white p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium text-[#3E5368]">Net profit</p>
            <h3 className={`text-xl font-bold mt-1 tabular-nums ${netProfit >= 0 ? 'text-[#14689F]' : 'text-[#C23B3B]'}`}>
              {formatCurrency(netProfit)}
            </h3>
            <p className="text-[12px] text-[#3E5368] mt-0.5">Operating surplus</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-[#EAF5FD] text-[#14689F] flex items-center justify-center">
            <FileSpreadsheet size={20} />
          </div>
        </div>

        {/* Total Inventory Valuation */}
        <div className="rounded-xl border border-[#E8DFCF] bg-white p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium text-[#3E5368]">Stock valuation</p>
            <h3 className="text-xl font-bold text-[#12263A] mt-1 tabular-nums">{formatCurrency(totalInventoryValuation)}</h3>
            <p className="text-[12px] text-[#3E5368] mt-0.5">Asset balance</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-[#FFF8EC] text-[#E0771A] flex items-center justify-center">
            <Boxes size={20} />
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div 
          onClick={() => onNavigate('items')}
          className="rounded-xl border border-[#E8DFCF] bg-white p-5 shadow-xs flex items-center justify-between cursor-pointer hover:border-[#F28C28] transition"
        >
          <div>
            <p className="text-[13px] font-medium text-[#3E5368]">Low stock items</p>
            <h3 className={`text-xl font-bold mt-1 ${lowStockCount > 0 ? 'text-[#C23B3B]' : 'text-[#1E8E5A]'}`}>
              {lowStockCount} {lowStockCount === 1 ? 'item' : 'items'}
            </h3>
            <p className="text-[12px] text-[#3E5368] mt-0.5">
              {lowStockCount > 0 ? 'Reorder needed' : 'Levels optimal'}
            </p>
          </div>
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${lowStockCount > 0 ? 'bg-[#FDECEC] text-[#C23B3B]' : 'bg-[#E6F6EE] text-[#1E8E5A]'}`}>
            <AlertTriangle size={20} />
          </div>
        </div>
      </div>

      {/* ROW 2: SALES, PURCHASES, GST & RECEIVABLES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Sales */}
        <div className="rounded-xl border border-[#E8DFCF] bg-white p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium text-[#3E5368]">Total sales</p>
            <h3 className="text-xl font-bold text-[#12263A] mt-1 tabular-nums">{formatCurrency(totalSales)}</h3>
            <p className="text-[12px] text-[#1E8E5A] mt-0.5">Revenue account</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-[#E6F6EE] text-[#1E8E5A] flex items-center justify-center">
            <FileText size={20} />
          </div>
        </div>

        {/* Total Purchases */}
        <div className="rounded-xl border border-[#E8DFCF] bg-white p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium text-[#3E5368]">Total purchases</p>
            <h3 className="text-xl font-bold text-[#12263A] mt-1 tabular-nums">{formatCurrency(totalPurchases)}</h3>
            <p className="text-[12px] text-[#14689F] mt-0.5">Expense account</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-[#EAF5FD] text-[#14689F] flex items-center justify-center">
            <ShoppingCart size={20} />
          </div>
        </div>

        {/* Net GST Collected */}
        <div className="rounded-xl border border-[#E8DFCF] bg-white p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium text-[#3E5368]">Net GST liability</p>
            <h3 className="text-xl font-bold text-[#12263A] mt-1 tabular-nums">{formatCurrency(netGstCollected)}</h3>
            <p className="text-[12px] text-[#3E5368] mt-0.5">Output GST</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-[#FFF8EC] text-[#B7791F] flex items-center justify-center">
            <Landmark size={20} />
          </div>
        </div>

        {/* Pending Receivables */}
        <div className="rounded-xl border border-[#E8DFCF] bg-white p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium text-[#3E5368]">Receivables (A/R)</p>
            <h3 className="text-xl font-bold text-[#12263A] mt-1 tabular-nums">{formatCurrency(totalReceivable)}</h3>
            <p className="text-[12px] text-[#C23B3B] mt-0.5">Debtors balance</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-[#FDECEC] text-[#C23B3B] flex items-center justify-center">
            <AlertCircle size={20} />
          </div>
        </div>
      </div>

      {/* ROW 3: CASH/BANK & PAYABLES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Cash in Hand */}
        <div className="rounded-xl border border-[#E8DFCF] bg-white p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium text-[#3E5368]">Cash on hand</p>
            <h3 className="text-lg font-bold text-[#12263A] mt-1 tabular-nums">{formatCurrency(cashBalance)}</h3>
            <p className="text-[12px] text-[#3E5368] mt-0.5">Register cash</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-[#E6F6EE] text-[#1E8E5A] flex items-center justify-center">
            <Wallet size={18} />
          </div>
        </div>

        {/* Bank Balance */}
        <div className="rounded-xl border border-[#E8DFCF] bg-white p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium text-[#3E5368]">Bank balance</p>
            <h3 className="text-lg font-bold text-[#12263A] mt-1 tabular-nums">{formatCurrency(bankBalance)}</h3>
            <p className="text-[12px] text-[#3E5368] mt-0.5">Operating account</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-[#EAF5FD] text-[#14689F] flex items-center justify-center">
            <Landmark size={18} />
          </div>
        </div>

        {/* Outstanding Payables */}
        <div className="rounded-xl border border-[#E8DFCF] bg-white p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium text-[#3E5368]">Payables (A/P)</p>
            <h3 className="text-lg font-bold text-[#12263A] mt-1 tabular-nums">{formatCurrency(totalPayable)}</h3>
            <p className="text-[12px] text-[#3E5368] mt-0.5">Creditors balance</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-[#FFF8EC] text-[#B7791F] flex items-center justify-center">
            <HeartHandshake size={18} />
          </div>
        </div>

        {/* Total Liquid Funds */}
        <div className="rounded-xl border border-[#E8DFCF] bg-white p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium text-[#3E5368]">Liquid treasury</p>
            <h3 className="text-lg font-bold text-[#12263A] mt-1 tabular-nums">{formatCurrency(cashBalance + bankBalance)}</h3>
            <p className="text-[12px] text-[#1E8E5A] mt-0.5">Cash + Bank total</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-[#E6F6EE] text-[#1E8E5A] flex items-center justify-center">
            <Receipt size={18} />
          </div>
        </div>
      </div>

      {/* RECENT INVOICES & QUICK STOCK MONITOR */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Invoices */}
        <div className="lg:col-span-2 rounded-xl border border-[#E8DFCF] bg-white shadow-xs overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#E8DFCF] px-5 py-4">
            <h3 className="font-semibold text-[#12263A] text-base">Recent Invoices</h3>
            <button
              onClick={() => onNavigate('sales')}
              className="text-[13px] font-semibold text-[#14689F] hover:underline cursor-pointer"
            >
              View all
            </button>
          </div>
          <div className="divide-y divide-[#E8DFCF]/50 overflow-x-auto">
            {invoices.length === 0 ? (
              <div className="p-8 text-center text-[13px] text-[#3E5368]">No invoices recorded yet.</div>
            ) : (
              invoices.slice(0, 5).map((inv) => {
                const partyObj = parties.find((p) => p.id === inv.partyId);
                const isPur = inv.type.includes('Purchase');
                return (
                  <div
                    key={inv.id}
                    onClick={() => onViewInvoice(inv)}
                    className="flex items-center justify-between p-4 hover:bg-[#FFFBF3] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-8 w-8 rounded-md flex items-center justify-center text-[12px] font-semibold ${
                          isPur ? 'bg-[#FFF3DC] text-[#B7791F]' : 'bg-[#E6F6EE] text-[#1E8E5A]'
                        }`}
                      >
                        {isPur ? 'PR' : 'SL'}
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold text-[#12263A]">{inv.invoiceNumber}</p>
                        <p className="text-[12px] text-[#3E5368] mt-0.5 truncate max-w-[150px]">
                          {partyObj?.name || 'Party'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <p className="text-[13px] font-semibold text-[#12263A] tabular-nums">{formatCurrency(inv.grandTotal)}</p>
                        <p className="text-[12px] text-[#3E5368] mt-0.5">{inv.date}</p>
                      </div>
                      <span
                        className={`badge-status ${
                          inv.paymentStatus === 'Paid'
                            ? 'badge-paid'
                            : inv.paymentStatus === 'Partial'
                            ? 'badge-partial'
                            : 'badge-overdue'
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
        <div className="rounded-xl border border-[#E8DFCF] bg-white shadow-xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#E8DFCF]">
              <h3 className="font-semibold text-[#12263A] text-base">Quick Stock Monitor</h3>
              <button 
                onClick={() => onNavigate('items')}
                className="text-[13px] font-semibold text-[#14689F] hover:underline cursor-pointer"
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
                    className="flex items-center justify-between text-[13px] pb-2 border-b border-[#E8DFCF]/50 last:border-0 last:pb-0"
                  >
                    <div>
                      <p className="font-medium text-[#12263A]">{it.name}</p>
                      <p className="text-[12px] text-[#3E5368] mt-0.5">
                        {isService ? 'Service' : `Rate: ${formatCurrency(it.unitPrice ?? 0)}`}
                      </p>
                    </div>
                    {isService ? (
                      <span className="badge-status badge-draft">
                        Service
                      </span>
                    ) : (
                      <span
                        className={`badge-status ${
                          isLow ? 'badge-overdue' : 'badge-draft'
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

          <div className="mt-4 pt-3 border-t border-[#E8DFCF] flex items-center justify-between text-[13px]">
            <p className="text-[#3E5368]">Live inventory valuation</p>
            <button
              onClick={() => onNavigate('items')}
              className="text-[#14689F] font-semibold hover:underline cursor-pointer"
            >
              Open inventory
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
