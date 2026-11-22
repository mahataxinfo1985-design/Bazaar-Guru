/**
 * Centralized Financial Reporting Engine
 * Derives audit-grade financial statements strictly from posted double-entry journal entries.
 */

import { Account, JournalEntry, TrialBalanceRow, ProfitAndLossReport } from '../../types/accounting';
import { 
  BalanceSheetReport, 
  BalanceSheetSection, 
  CashFlowStatementReport, 
  CashFlowActivity,
  DaybookRow, 
  GeneralLedgerReport,
  ItemProfitabilityRow
} from '../../types/inventory';
import { Invoice } from '../../types';
import { round2, safeAdd, safeSub, safeMul, safeDiv } from '../../utils/decimal';

/**
 * Computes current account balances from all posted journal lines.
 */
export function computeAccountBalances(
  accounts: Account[],
  entries: JournalEntry[],
  asOfDate?: string
): Account[] {
  const accountMap = new Map<string, Account>();
  for (const acc of accounts) {
    accountMap.set(acc.id, {
      ...acc,
      currentBalance: acc.openingBalance || 0
    });
  }

  const postedEntries = entries.filter((e) => {
    if (e.status !== 'posted') return false;
    if (asOfDate && e.date > asOfDate) return false;
    return true;
  });

  for (const entry of postedEntries) {
    for (const line of entry.lines) {
      const acc = accountMap.get(line.accountId) || Array.from(accountMap.values()).find(a => a.code === line.accountCode);
      if (!acc) continue;

      if (acc.type === 'asset' || acc.type === 'expense') {
        // Normal Debit balance: Debit increases, Credit decreases
        acc.currentBalance = safeAdd(acc.currentBalance, line.debit);
        acc.currentBalance = safeSub(acc.currentBalance, line.credit);
      } else {
        // Normal Credit balance: Credit increases, Debit decreases (Liability, Equity, Income)
        acc.currentBalance = safeAdd(acc.currentBalance, line.credit);
        acc.currentBalance = safeSub(acc.currentBalance, line.debit);
      }
    }
  }

  return Array.from(accountMap.values()).map(a => ({
    ...a,
    currentBalance: round2(a.currentBalance)
  }));
}

/**
 * Generates an audit-grade Trial Balance.
 * Fundamental accounting check: Total Debits strictly equal Total Credits!
 */
export function generateTrialBalance(
  accounts: Account[],
  entries: JournalEntry[],
  dateFrom?: string,
  dateTo?: string
): {
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  difference: number;
} {
  const relevantEntries = entries.filter((e) => {
    if (e.status !== 'posted') return false;
    if (dateFrom && e.date < dateFrom) return false;
    if (dateTo && e.date > dateTo) return false;
    return true;
  });

  const updatedAccounts = computeAccountBalances(accounts, relevantEntries);
  const rows: TrialBalanceRow[] = [];
  let totalDebit = 0;
  let totalCredit = 0;

  for (const acc of updatedAccounts) {
    if (acc.currentBalance === 0) continue;

    if (acc.type === 'asset' || acc.type === 'expense') {
      if (acc.currentBalance > 0) {
        rows.push({
          accountCode: acc.code,
          accountName: acc.name,
          type: acc.type,
          debit: acc.currentBalance,
          credit: 0
        });
        totalDebit = safeAdd(totalDebit, acc.currentBalance);
      } else {
        rows.push({
          accountCode: acc.code,
          accountName: acc.name,
          type: acc.type,
          debit: 0,
          credit: Math.abs(acc.currentBalance)
        });
        totalCredit = safeAdd(totalCredit, Math.abs(acc.currentBalance));
      }
    } else {
      if (acc.currentBalance > 0) {
        rows.push({
          accountCode: acc.code,
          accountName: acc.name,
          type: acc.type,
          debit: 0,
          credit: acc.currentBalance
        });
        totalCredit = safeAdd(totalCredit, acc.currentBalance);
      } else {
        rows.push({
          accountCode: acc.code,
          accountName: acc.name,
          type: acc.type,
          debit: Math.abs(acc.currentBalance),
          credit: 0
        });
        totalDebit = safeAdd(totalDebit, Math.abs(acc.currentBalance));
      }
    }
  }

  rows.sort((a, b) => a.accountCode.localeCompare(b.accountCode));

  const difference = round2(Math.abs(safeSub(totalDebit, totalCredit)));
  const isBalanced = difference <= 0.01;

  return {
    rows,
    totalDebit: round2(totalDebit),
    totalCredit: round2(totalCredit),
    isBalanced,
    difference
  };
}

/**
 * Computes Profit & Loss statement from income and expense accounts.
 */
export function generateProfitAndLoss(
  accounts: Account[],
  entries: JournalEntry[],
  dateFrom?: string,
  dateTo?: string
): ProfitAndLossReport {
  const relevantEntries = entries.filter((e) => {
    if (e.status !== 'posted') return false;
    if (dateFrom && e.date < dateFrom) return false;
    if (dateTo && e.date > dateTo) return false;
    return true;
  });

  const updatedAccounts = computeAccountBalances(accounts, relevantEntries);

  const revenueLines: { accountName: string; amount: number }[] = [];
  const expenseLines: { accountName: string; amount: number }[] = [];

  let totalRevenue = 0;
  let cogs = 0;
  let operatingExpenses = 0;

  for (const acc of updatedAccounts) {
    if (acc.type === 'income') {
      const amt = Math.max(0, acc.currentBalance);
      if (amt > 0) {
        revenueLines.push({ accountName: acc.name, amount: amt });
        totalRevenue = safeAdd(totalRevenue, amt);
      }
    } else if (acc.type === 'expense') {
      const amt = Math.max(0, acc.currentBalance);
      if (amt > 0) {
        expenseLines.push({ accountName: acc.name, amount: amt });
        if (acc.subtype === 'cogs' || acc.subtype === 'purchases' || acc.code === '5010' || acc.code === '5020') {
          cogs = safeAdd(cogs, amt);
        } else {
          operatingExpenses = safeAdd(operatingExpenses, amt);
        }
      }
    }
  }

  const grossProfit = safeSub(totalRevenue, cogs);
  const netProfit = safeSub(grossProfit, operatingExpenses);

  return {
    totalRevenue: round2(totalRevenue),
    costOfGoodsSold: round2(cogs),
    grossProfit: round2(grossProfit),
    totalOperatingExpenses: round2(operatingExpenses),
    netProfit: round2(netProfit),
    revenueLines,
    expenseLines
  };
}

/**
 * Generates audit-grade Balance Sheet.
 * Invariant: Total Assets = Total Liabilities + Total Equity
 */
export function generateBalanceSheet(
  accounts: Account[],
  entries: JournalEntry[],
  asOfDate?: string
): BalanceSheetReport {
  const targetDate = asOfDate || new Date().toISOString().split('T')[0];
  const updatedAccounts = computeAccountBalances(accounts, entries, targetDate);

  // Compute Current Period Net Profit up to asOfDate
  const pnl = generateProfitAndLoss(accounts, entries, undefined, targetDate);
  const currentPeriodProfit = pnl.netProfit;

  const helper = (type: string, subtypes: string[], codes: string[] = []): BalanceSheetSection => {
    const lines: { accountCode: string; accountName: string; amount: number }[] = [];
    let total = 0;

    for (const acc of updatedAccounts) {
      if (acc.type !== type) continue;
      const matchSubtype = subtypes.includes(acc.subtype);
      const matchCode = codes.some(c => acc.code.startsWith(c));

      if (matchSubtype || matchCode) {
        const val = acc.currentBalance;
        if (val !== 0) {
          lines.push({ accountCode: acc.code, accountName: acc.name, amount: val });
          total = safeAdd(total, val);
        }
      }
    }

    return {
      title: '',
      lines,
      total: round2(total)
    };
  };

  // 1. Assets
  const cashAndBank = helper('asset', ['cash', 'bank'], ['1010', '1020']);
  cashAndBank.title = 'Cash & Bank Balances';

  const accountsReceivable = helper('asset', ['accounts_receivable'], ['1200']);
  accountsReceivable.title = 'Accounts Receivable (Debtors)';

  const inventory = helper('asset', ['inventory'], ['1400']);
  inventory.title = 'Inventory / Stock-in-Hand';

  const otherCurrentAssets = helper('asset', ['other_current_asset', 'gst_input'], ['1500', '1510', '1520', '1530', '1540', '1300']);
  otherCurrentAssets.title = 'Other Current Assets & GST Input Credits';

  const fixedAssets = helper('asset', ['fixed_asset'], ['1800']);
  fixedAssets.title = 'Fixed Assets';

  const totalAssets = round2(
    safeAdd(
      cashAndBank.total,
      safeAdd(
        accountsReceivable.total,
        safeAdd(inventory.total, safeAdd(otherCurrentAssets.total, fixedAssets.total))
      )
    )
  );

  // 2. Liabilities
  const accountsPayable = helper('liability', ['accounts_payable'], ['2010']);
  accountsPayable.title = 'Accounts Payable (Creditors)';

  const gstLiabilities = helper('liability', ['gst_output'], ['2210', '2220', '2230', '2240']);
  gstLiabilities.title = 'GST Output Liabilities';

  const loans = helper('liability', ['loans'], ['2100']);
  loans.title = 'Loans & Borrowings';

  const otherCurrentLiabilities = helper('liability', ['other_current_liability'], ['2300', '2400']);
  otherCurrentLiabilities.title = 'Other Current Liabilities';

  const totalLiabilities = round2(
    safeAdd(
      accountsPayable.total,
      safeAdd(gstLiabilities.total, safeAdd(loans.total, otherCurrentLiabilities.total))
    )
  );

  // 3. Equity
  const ownerCapital = helper('equity', ['capital'], ['3010']);
  ownerCapital.title = 'Owner Capital';

  const drawings = helper('equity', ['drawings'], ['3020']);
  drawings.title = 'Drawings';

  const retainedEarnings = helper('equity', ['retained_earnings'], ['3030']);
  retainedEarnings.title = 'Retained Earnings';

  const totalEquity = round2(
    safeAdd(
      safeSub(ownerCapital.total, drawings.total),
      safeAdd(retainedEarnings.total, currentPeriodProfit)
    )
  );

  const totalLiabilitiesAndEquity = round2(safeAdd(totalLiabilities, totalEquity));
  const difference = round2(Math.abs(safeSub(totalAssets, totalLiabilitiesAndEquity)));
  const isBalanced = difference <= 0.05;

  const diagnosticNotes: string[] = [];
  if (!isBalanced) {
    diagnosticNotes.push(
      `Discrepancy of ₹${difference.toFixed(2)} between Total Assets (₹${totalAssets.toFixed(2)}) and Total Liabilities & Equity (₹${totalLiabilitiesAndEquity.toFixed(2)}).`
    );
    diagnosticNotes.push(
      'Ensure all historical migrations or manual journals have corresponding balanced debit and credit entries.'
    );
  }

  return {
    asOfDate: targetDate,
    assets: {
      cashAndBank,
      accountsReceivable,
      inventory,
      otherCurrentAssets,
      fixedAssets,
      totalAssets
    },
    liabilities: {
      accountsPayable,
      gstLiabilities,
      loans,
      otherCurrentLiabilities,
      totalLiabilities
    },
    equity: {
      ownerCapital,
      drawings,
      retainedEarnings,
      currentPeriodProfit,
      totalEquity
    },
    totalLiabilitiesAndEquity,
    isBalanced,
    difference,
    diagnosticNotes
  };
}

/**
 * Generates Cash Flow Statement using the Indirect Method.
 * Operating Activities + Investing Activities + Financing Activities
 * Strictly excludes internal contra transfers (Cash-to-Bank / Bank-to-Cash).
 */
export function generateCashFlowStatement(
  accounts: Account[],
  entries: JournalEntry[],
  startDate: string,
  endDate: string
): CashFlowStatementReport {
  const pnl = generateProfitAndLoss(accounts, entries, startDate, endDate);
  const netIncome = pnl.netProfit;

  // Opening Cash & Bank (prior to startDate)
  const openingAccounts = computeAccountBalances(accounts, entries, startDate ? new Date(new Date(startDate).getTime() - 86400000).toISOString().split('T')[0] : undefined);
  const openingCash = openingAccounts
    .filter(a => a.code === '1010' || a.code === '1020' || a.subtype === 'cash' || a.subtype === 'bank')
    .reduce((sum, a) => safeAdd(sum, a.currentBalance), 0);

  // Closing Cash & Bank (as of endDate)
  const closingAccounts = computeAccountBalances(accounts, entries, endDate);
  const closingCash = closingAccounts
    .filter(a => a.code === '1010' || a.code === '1020' || a.subtype === 'cash' || a.subtype === 'bank')
    .reduce((sum, a) => safeAdd(sum, a.currentBalance), 0);

  // Filter entries in period, excluding internal contra transfers ('fund_transfer')
  const periodEntries = entries.filter(e => {
    if (e.status !== 'posted') return false;
    if (e.date < startDate || e.date > endDate) return false;
    return true;
  });

  // Calculate Working Capital Changes
  let changeAR = 0;
  let changeAP = 0;
  let changeInventory = 0;
  let changeGST = 0;
  let capitalInflow = 0;
  let loanChange = 0;
  let fixedAssetPurchases = 0;

  for (const entry of periodEntries) {
    if (entry.sourceType === 'fund_transfer') {
      // Internal transfer: no effect on total cash flow
      continue;
    }

    for (const line of entry.lines) {
      if (line.accountCode === '1200') {
        // AR: Debit increases asset (uses cash), Credit decreases asset (provides cash)
        changeAR = safeAdd(changeAR, safeSub(line.credit, line.debit));
      } else if (line.accountCode === '2010') {
        // AP: Credit increases liability (provides cash), Debit decreases liability (uses cash)
        changeAP = safeAdd(changeAP, safeSub(line.credit, line.debit));
      } else if (line.accountCode === '1400') {
        // Inventory: Credit decreases inventory (cash released), Debit increases inventory (cash used)
        changeInventory = safeAdd(changeInventory, safeSub(line.credit, line.debit));
      } else if (line.accountCode?.startsWith('15') || line.accountCode?.startsWith('22')) {
        changeGST = safeAdd(changeGST, safeSub(line.credit, line.debit));
      } else if (line.accountCode === '3010') {
        capitalInflow = safeAdd(capitalInflow, safeSub(line.credit, line.debit));
      } else if (line.accountCode === '2100') {
        loanChange = safeAdd(loanChange, safeSub(line.credit, line.debit));
      } else if (line.accountCode?.startsWith('18')) {
        fixedAssetPurchases = safeAdd(fixedAssetPurchases, safeSub(line.debit, line.credit));
      }
    }
  }

  // Operating Activities
  const opItems = [
    { description: 'Net Profit before tax', amount: netIncome },
    { description: 'Change in Accounts Receivable (Debtors)', amount: changeAR },
    { description: 'Change in Inventory (Stock)', amount: changeInventory },
    { description: 'Change in Accounts Payable (Creditors)', amount: changeAP },
    { description: 'Change in Net GST Liabilities/Credits', amount: changeGST }
  ];
  const netOp = opItems.reduce((sum, item) => safeAdd(sum, item.amount), 0);

  // Investing Activities
  const invItems = [
    { description: 'Capital Expenditure on Fixed Assets', amount: -Math.abs(fixedAssetPurchases) }
  ];
  const netInv = invItems.reduce((sum, item) => safeAdd(sum, item.amount), 0);

  // Financing Activities
  const finItems = [
    { description: 'Capital Introduced / (Drawings)', amount: capitalInflow },
    { description: 'Proceeds from / (Repayment of) Loans', amount: loanChange }
  ];
  const netFin = finItems.reduce((sum, item) => safeAdd(sum, item.amount), 0);

  const netCashChange = round2(safeAdd(netOp, safeAdd(netInv, netFin)));
  const calculatedClosing = round2(safeAdd(openingCash, netCashChange));
  const isReconciled = Math.abs(safeSub(calculatedClosing, closingCash)) < 1.0;

  return {
    startDate,
    endDate,
    openingCashAndBank: round2(openingCash),
    operatingActivities: {
      title: 'Cash Flows from Operating Activities',
      items: opItems,
      netCashFlow: round2(netOp)
    },
    investingActivities: {
      title: 'Cash Flows from Investing Activities',
      items: invItems,
      netCashFlow: round2(netInv)
    },
    financingActivities: {
      title: 'Cash Flows from Financing Activities',
      items: finItems,
      netCashFlow: round2(netFin)
    },
    netCashChange,
    closingCashAndBank: round2(closingCash),
    isReconciled
  };
}

/**
 * Generates Daybook: Chronological audit register of all posted financial vouchers.
 */
export function generateDaybook(
  entries: JournalEntry[],
  dateFrom?: string,
  dateTo?: string
): DaybookRow[] {
  const filtered = entries
    .filter(e => {
      if (e.status !== 'posted') return false;
      if (dateFrom && e.date < dateFrom) return false;
      if (dateTo && e.date > dateTo) return false;
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.entryNumber.localeCompare(b.entryNumber));

  return filtered.map(e => {
    const accNames = Array.from(new Set(e.lines.map(l => l.accountName || l.accountCode || 'Account'))).join(', ');
    const totalDr = e.lines.reduce((s, l) => safeAdd(s, l.debit), 0);
    const totalCr = e.lines.reduce((s, l) => safeAdd(s, l.credit), 0);

    return {
      id: e.id,
      date: e.date,
      voucherNumber: e.entryNumber,
      voucherType: e.sourceType.toUpperCase().replace('_', ' '),
      partyName: e.lines.find(l => l.partyName)?.partyName,
      narration: e.narration,
      accountNames: accNames,
      debit: round2(totalDr),
      credit: round2(totalCr)
    };
  });
}

/**
 * Generates General Ledger for a specific account.
 */
export function generateGeneralLedger(
  account: Account,
  entries: JournalEntry[],
  dateFrom?: string,
  dateTo?: string
): GeneralLedgerReport {
  const relevantEntries = entries
    .filter(e => {
      if (e.status !== 'posted') return false;
      if (dateFrom && e.date < dateFrom) return false;
      if (dateTo && e.date > dateTo) return false;
      return e.lines.some(l => l.accountId === account.id || l.accountCode === account.code);
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

  let running = account.openingBalance || 0;
  let totalDebit = 0;
  let totalCredit = 0;

  const transactions = relevantEntries.map(e => {
    const linesForAccount = e.lines.filter(l => l.accountId === account.id || l.accountCode === account.code);
    const dr = linesForAccount.reduce((s, l) => safeAdd(s, l.debit), 0);
    const cr = linesForAccount.reduce((s, l) => safeAdd(s, l.credit), 0);

    totalDebit = safeAdd(totalDebit, dr);
    totalCredit = safeAdd(totalCredit, cr);

    if (account.type === 'asset' || account.type === 'expense') {
      running = safeAdd(running, dr);
      running = safeSub(running, cr);
    } else {
      running = safeAdd(running, cr);
      running = safeSub(running, dr);
    }

    return {
      id: e.id,
      date: e.date,
      voucherNumber: e.entryNumber,
      sourceType: e.sourceType,
      particulars: e.narration,
      debit: round2(dr),
      credit: round2(cr),
      runningBalance: round2(running)
    };
  });

  return {
    accountId: account.id,
    accountCode: account.code,
    accountName: account.name,
    accountType: account.type,
    openingBalance: round2(account.openingBalance || 0),
    totalDebit: round2(totalDebit),
    totalCredit: round2(totalCredit),
    closingBalance: round2(running),
    transactions
  };
}

/**
 * Calculates item-wise profitability from invoices and cost of goods sold.
 */
export function generateItemProfitability(
  invoices: Invoice[],
  cogsByInvoiceId?: { [invoiceId: string]: { [productId: string]: number } }
): ItemProfitabilityRow[] {
  const productMap = new Map<string, {
    productId: string;
    productName: string;
    sku: string;
    category: string;
    quantitySold: number;
    salesRevenue: number;
    costOfGoodsSold: number;
  }>();

  for (const inv of invoices) {
    if (inv.status === 'Cancelled' || inv.deleted) continue;
    if (inv.type.includes('Purchase')) continue;

    const isReturn = inv.type === 'Credit Note';

    for (const item of inv.items) {
      const pid = item.itemId || item.name;
      if (!productMap.has(pid)) {
        productMap.set(pid, {
          productId: pid,
          productName: item.name,
          sku: item.hsnCode || 'N/A',
          category: 'General',
          quantitySold: 0,
          salesRevenue: 0,
          costOfGoodsSold: 0
        });
      }

      const row = productMap.get(pid)!;
      const factor = isReturn ? -1 : 1;
      const qty = safeMul(item.qty, factor);
      const rev = safeMul(item.taxableValue, factor);

      row.quantitySold = round2(safeAdd(row.quantitySold, qty));
      row.salesRevenue = round2(safeAdd(row.salesRevenue, rev));

      // COGS if available from tracking or estimated from unitPrice * 0.7
      const itemCost = cogsByInvoiceId?.[inv.id]?.[pid] ?? safeMul(rev, 0.65);
      row.costOfGoodsSold = round2(safeAdd(row.costOfGoodsSold, itemCost));
    }
  }

  const result: ItemProfitabilityRow[] = [];
  for (const row of productMap.values()) {
    const grossProfit = round2(safeSub(row.salesRevenue, row.costOfGoodsSold));
    const grossMarginPercentage = row.salesRevenue > 0
      ? round2(safeMul(safeDiv(grossProfit, row.salesRevenue), 100))
      : 0;

    result.push({
      ...row,
      grossProfit,
      grossMarginPercentage
    });
  }

  return result.sort((a, b) => b.grossProfit - a.grossProfit);
}
