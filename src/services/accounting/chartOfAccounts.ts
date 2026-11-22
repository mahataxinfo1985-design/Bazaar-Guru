import { Account, JournalEntry } from '../../types/accounting';

export interface AccountTemplate extends Omit<Account, 'id' | 'businessId' | 'createdAt'> {
  parentCode?: string;
}

export const STANDARD_CHART_OF_ACCOUNTS: AccountTemplate[] = [
  // ==========================================
  // 1. ASSETS (1000 - 1999)
  // ==========================================
  {
    code: '1000',
    name: 'Current Assets',
    type: 'asset',
    subtype: 'other_current_assets',
    level: 1,
    openingBalance: 0,
    openingBalanceType: 'debit',
    currentBalance: 0,
    isSystem: true,
    isActive: true,
    description: 'Header group for all current liquid assets'
  },
  {
    code: '1010',
    name: 'Cash in Hand',
    type: 'asset',
    subtype: 'cash',
    parentCode: '1000',
    level: 2,
    openingBalance: 0,
    openingBalanceType: 'debit',
    currentBalance: 0,
    isSystem: true,
    isActive: true,
    description: 'Physical cash on premises'
  },
  {
    code: '1020',
    name: 'Bank Accounts',
    type: 'asset',
    subtype: 'bank',
    parentCode: '1000',
    level: 2,
    openingBalance: 0,
    openingBalanceType: 'debit',
    currentBalance: 0,
    isSystem: true,
    isActive: true,
    description: 'Primary and operating business bank accounts'
  },
  {
    code: '1200',
    name: 'Accounts Receivable (Sundry Debtors)',
    type: 'asset',
    subtype: 'accounts_receivable',
    parentCode: '1000',
    level: 2,
    openingBalance: 0,
    openingBalanceType: 'debit',
    currentBalance: 0,
    isSystem: true,
    isActive: true,
    description: 'Outstanding invoices receivable from customers'
  },
  {
    code: '1400',
    name: 'Inventory / Stock-in-Hand',
    type: 'asset',
    subtype: 'inventory',
    parentCode: '1000',
    level: 2,
    openingBalance: 0,
    openingBalanceType: 'debit',
    currentBalance: 0,
    isSystem: true,
    isActive: true,
    description: 'Valuation of finished goods and trading inventory'
  },
  {
    code: '1500',
    name: 'Input Tax Credits (GST Paid)',
    type: 'asset',
    subtype: 'tax_credit',
    parentCode: '1000',
    level: 2,
    openingBalance: 0,
    openingBalanceType: 'debit',
    currentBalance: 0,
    isSystem: true,
    isActive: true,
    description: 'Parent ledger for eligible Input Tax Credits'
  },
  {
    code: '1510',
    name: 'Input CGST',
    type: 'asset',
    subtype: 'tax_credit',
    parentCode: '1500',
    level: 3,
    openingBalance: 0,
    openingBalanceType: 'debit',
    currentBalance: 0,
    isSystem: true,
    isActive: true,
    description: 'Central GST Input Credit from intra-state purchases'
  },
  {
    code: '1520',
    name: 'Input SGST',
    type: 'asset',
    subtype: 'tax_credit',
    parentCode: '1500',
    level: 3,
    openingBalance: 0,
    openingBalanceType: 'debit',
    currentBalance: 0,
    isSystem: true,
    isActive: true,
    description: 'State GST Input Credit from intra-state purchases'
  },
  {
    code: '1530',
    name: 'Input IGST',
    type: 'asset',
    subtype: 'tax_credit',
    parentCode: '1500',
    level: 3,
    openingBalance: 0,
    openingBalanceType: 'debit',
    currentBalance: 0,
    isSystem: true,
    isActive: true,
    description: 'Integrated GST Input Credit from inter-state purchases and imports'
  },
  {
    code: '1600',
    name: 'Fixed Assets',
    type: 'asset',
    subtype: 'fixed_assets',
    level: 1,
    openingBalance: 0,
    openingBalanceType: 'debit',
    currentBalance: 0,
    isSystem: true,
    isActive: true,
    description: 'Long-term tangible assets (equipment, computers, furniture)'
  },
  {
    code: '1700',
    name: 'Other Current Assets',
    type: 'asset',
    subtype: 'other_current_assets',
    parentCode: '1000',
    level: 2,
    openingBalance: 0,
    openingBalanceType: 'debit',
    currentBalance: 0,
    isSystem: true,
    isActive: true,
    description: 'Prepaid expenses, security deposits, and advances'
  },

  // ==========================================
  // 2. LIABILITIES (2000 - 2999)
  // ==========================================
  {
    code: '2000',
    name: 'Current Liabilities',
    type: 'liability',
    subtype: 'other_current_liabilities',
    level: 1,
    openingBalance: 0,
    openingBalanceType: 'credit',
    currentBalance: 0,
    isSystem: true,
    isActive: true,
    description: 'Short-term obligations due within financial year'
  },
  {
    code: '2010',
    name: 'Accounts Payable (Sundry Creditors)',
    type: 'liability',
    subtype: 'accounts_payable',
    parentCode: '2000',
    level: 2,
    openingBalance: 0,
    openingBalanceType: 'credit',
    currentBalance: 0,
    isSystem: true,
    isActive: true,
    description: 'Unpaid bills due to vendors and suppliers'
  },
  {
    code: '2100',
    name: 'Loans & Borrowings',
    type: 'liability',
    subtype: 'loans',
    level: 1,
    openingBalance: 0,
    openingBalanceType: 'credit',
    currentBalance: 0,
    isSystem: true,
    isActive: true,
    description: 'Bank credit facilities, loans, and overdrafts'
  },
  {
    code: '2200',
    name: 'GST Output Tax Liabilities',
    type: 'liability',
    subtype: 'tax_payable',
    parentCode: '2000',
    level: 2,
    openingBalance: 0,
    openingBalanceType: 'credit',
    currentBalance: 0,
    isSystem: true,
    isActive: true,
    description: 'Parent ledger for GST collected on sales'
  },
  {
    code: '2210',
    name: 'Output CGST',
    type: 'liability',
    subtype: 'tax_payable',
    parentCode: '2200',
    level: 3,
    openingBalance: 0,
    openingBalanceType: 'credit',
    currentBalance: 0,
    isSystem: true,
    isActive: true,
    description: 'Central GST collected on intra-state outward supplies'
  },
  {
    code: '2220',
    name: 'Output SGST',
    type: 'liability',
    subtype: 'tax_payable',
    parentCode: '2200',
    level: 3,
    openingBalance: 0,
    openingBalanceType: 'credit',
    currentBalance: 0,
    isSystem: true,
    isActive: true,
    description: 'State GST collected on intra-state outward supplies'
  },
  {
    code: '2230',
    name: 'Output IGST',
    type: 'liability',
    subtype: 'tax_payable',
    parentCode: '2200',
    level: 3,
    openingBalance: 0,
    openingBalanceType: 'credit',
    currentBalance: 0,
    isSystem: true,
    isActive: true,
    description: 'Integrated GST collected on inter-state outward supplies'
  },
  {
    code: '2240',
    name: 'Output Cess',
    type: 'liability',
    subtype: 'tax_payable',
    parentCode: '2200',
    level: 3,
    openingBalance: 0,
    openingBalanceType: 'credit',
    currentBalance: 0,
    isSystem: true,
    isActive: true,
    description: 'Compensation Cess payable on notified goods'
  },
  {
    code: '2300',
    name: 'Other Current Liabilities',
    type: 'liability',
    subtype: 'other_current_liabilities',
    parentCode: '2000',
    level: 2,
    openingBalance: 0,
    openingBalanceType: 'credit',
    currentBalance: 0,
    isSystem: true,
    isActive: true,
    description: 'Accrued expenses, advances received from customers, and TDS payable'
  },

  // ==========================================
  // 3. EQUITY (3000 - 3999)
  // ==========================================
  {
    code: '3000',
    name: 'Capital & Reserves',
    type: 'equity',
    subtype: 'equity',
    level: 1,
    openingBalance: 0,
    openingBalanceType: 'credit',
    currentBalance: 0,
    isSystem: true,
    isActive: true,
    description: 'Owner equity and accumulated earnings'
  },
  {
    code: '3010',
    name: "Owner's Capital",
    type: 'equity',
    subtype: 'equity',
    parentCode: '3000',
    level: 2,
    openingBalance: 0,
    openingBalanceType: 'credit',
    currentBalance: 0,
    isSystem: true,
    isActive: true,
    description: 'Initial and contributed capital by business proprietors'
  },
  {
    code: '3020',
    name: 'Drawings',
    type: 'equity',
    subtype: 'drawings',
    parentCode: '3000',
    level: 2,
    openingBalance: 0,
    openingBalanceType: 'debit',
    currentBalance: 0,
    isSystem: true,
    isActive: true,
    description: 'Owner withdrawals for personal use'
  },
  {
    code: '3030',
    name: 'Retained Earnings',
    type: 'equity',
    subtype: 'retained_earnings',
    parentCode: '3000',
    level: 2,
    openingBalance: 0,
    openingBalanceType: 'credit',
    currentBalance: 0,
    isSystem: true,
    isActive: true,
    description: 'Cumulative profits retained in business from prior years'
  },

  // ==========================================
  // 4. INCOME (4000 - 4999)
  // ==========================================
  {
    code: '4000',
    name: 'Revenue & Operating Income',
    type: 'income',
    subtype: 'other_income',
    level: 1,
    openingBalance: 0,
    openingBalanceType: 'credit',
    currentBalance: 0,
    isSystem: true,
    isActive: true,
    description: 'Header for all gross revenue streams'
  },
  {
    code: '4010',
    name: 'Sales Revenue',
    type: 'income',
    subtype: 'sales',
    parentCode: '4000',
    level: 2,
    openingBalance: 0,
    openingBalanceType: 'credit',
    currentBalance: 0,
    isSystem: true,
    isActive: true,
    description: 'Taxable revenue generated from sales invoices'
  },
  {
    code: '4020',
    name: 'Other Operating Income',
    type: 'income',
    subtype: 'other_income',
    parentCode: '4000',
    level: 2,
    openingBalance: 0,
    openingBalanceType: 'credit',
    currentBalance: 0,
    isSystem: true,
    isActive: true,
    description: 'Incidental income, service charges, delivery fees'
  },
  {
    code: '4030',
    name: 'Sales Returns (Credit Notes)',
    type: 'income',
    subtype: 'sales_returns',
    parentCode: '4000',
    level: 2,
    openingBalance: 0,
    openingBalanceType: 'debit',
    currentBalance: 0,
    isSystem: true,
    isActive: true,
    description: 'Contra-revenue account tracking customer goods returns'
  },
  {
    code: '4040',
    name: 'Discounts Received',
    type: 'income',
    subtype: 'discounts_received',
    parentCode: '4000',
    level: 2,
    openingBalance: 0,
    openingBalanceType: 'credit',
    currentBalance: 0,
    isSystem: true,
    isActive: true,
    description: 'Trade and cash discounts received from vendors'
  },

  // ==========================================
  // 5. EXPENSES (5000 - 6999)
  // ==========================================
  {
    code: '5000',
    name: 'Direct Expenses & Cost of Sales',
    type: 'expense',
    subtype: 'cogs',
    level: 1,
    openingBalance: 0,
    openingBalanceType: 'debit',
    currentBalance: 0,
    isSystem: true,
    isActive: true,
    description: 'Cost directly attributable to goods traded'
  },
  {
    code: '5010',
    name: 'Cost of Goods Sold (COGS)',
    type: 'expense',
    subtype: 'cogs',
    parentCode: '5000',
    level: 2,
    openingBalance: 0,
    openingBalanceType: 'debit',
    currentBalance: 0,
    isSystem: true,
    isActive: true,
    description: 'Direct cost of stock sold during the period'
  },
  {
    code: '5020',
    name: 'Purchase Expense',
    type: 'expense',
    subtype: 'purchases',
    parentCode: '5000',
    level: 2,
    openingBalance: 0,
    openingBalanceType: 'debit',
    currentBalance: 0,
    isSystem: true,
    isActive: true,
    description: 'Taxable value of raw materials and merchandise purchased'
  },
  {
    code: '5030',
    name: 'Purchase Returns (Debit Notes)',
    type: 'expense',
    subtype: 'purchase_returns',
    parentCode: '5000',
    level: 2,
    openingBalance: 0,
    openingBalanceType: 'credit',
    currentBalance: 0,
    isSystem: true,
    isActive: true,
    description: 'Contra-expense account tracking goods returned to suppliers'
  },
  {
    code: '6000',
    name: 'Operating & Administrative Expenses',
    type: 'expense',
    subtype: 'operating_expense',
    level: 1,
    openingBalance: 0,
    openingBalanceType: 'debit',
    currentBalance: 0,
    isSystem: true,
    isActive: true,
    description: 'General overhead and administrative costs'
  },
  {
    code: '6010',
    name: 'Rent Expense',
    type: 'expense',
    subtype: 'rent',
    parentCode: '6000',
    level: 2,
    openingBalance: 0,
    openingBalanceType: 'debit',
    currentBalance: 0,
    isSystem: true,
    isActive: true,
    description: 'Facility, office, and godown lease charges'
  },
  {
    code: '6020',
    name: 'Salary & Wages',
    type: 'expense',
    subtype: 'salary',
    parentCode: '6000',
    level: 2,
    openingBalance: 0,
    openingBalanceType: 'debit',
    currentBalance: 0,
    isSystem: true,
    isActive: true,
    description: 'Staff payroll, allowances, and bonuses'
  },
  {
    code: '6030',
    name: 'Electricity & Utilities',
    type: 'expense',
    subtype: 'electricity',
    parentCode: '6000',
    level: 2,
    openingBalance: 0,
    openingBalanceType: 'debit',
    currentBalance: 0,
    isSystem: true,
    isActive: true,
    description: 'Electricity bills, water, and power charges'
  },
  {
    code: '6040',
    name: 'Transportation & Freight',
    type: 'expense',
    subtype: 'transportation',
    parentCode: '6000',
    level: 2,
    openingBalance: 0,
    openingBalanceType: 'debit',
    currentBalance: 0,
    isSystem: true,
    isActive: true,
    description: 'Logistics, delivery, courier, and shipping charges'
  },
  {
    code: '6050',
    name: 'Advertising & Marketing',
    type: 'expense',
    subtype: 'advertising',
    parentCode: '6000',
    level: 2,
    openingBalance: 0,
    openingBalanceType: 'debit',
    currentBalance: 0,
    isSystem: true,
    isActive: true,
    description: 'Promotion, digital campaigns, and print advertisements'
  },
  {
    code: '6060',
    name: 'Office & Admin Expenses',
    type: 'expense',
    subtype: 'office_expense',
    parentCode: '6000',
    level: 2,
    openingBalance: 0,
    openingBalanceType: 'debit',
    currentBalance: 0,
    isSystem: true,
    isActive: true,
    description: 'Stationery, software subscriptions, maintenance'
  },
  {
    code: '6070',
    name: 'Discounts Allowed',
    type: 'expense',
    subtype: 'discounts_allowed',
    parentCode: '6000',
    level: 2,
    openingBalance: 0,
    openingBalanceType: 'debit',
    currentBalance: 0,
    isSystem: true,
    isActive: true,
    description: 'Discounts given to customers upon invoice or prompt payment'
  },
  {
    code: '6080',
    name: 'Round Off Differences',
    type: 'expense',
    subtype: 'round_off',
    parentCode: '6000',
    level: 2,
    openingBalance: 0,
    openingBalanceType: 'debit',
    currentBalance: 0,
    isSystem: true,
    isActive: true,
    description: 'Fractional rupee rounding differences on transactions'
  },
  {
    code: '6090',
    name: 'Other Operating Expenses',
    type: 'expense',
    subtype: 'other_expense',
    parentCode: '6000',
    level: 2,
    openingBalance: 0,
    openingBalanceType: 'debit',
    currentBalance: 0,
    isSystem: true,
    isActive: true,
    description: 'Miscellaneous expense entries'
  }
];

/**
 * Initializes standard chart of accounts, resolving parent IDs based on parentCode.
 */
export function generateDefaultAccounts(businessId?: string): Account[] {
  const now = new Date().toISOString();
  
  // First pass: generate ID for each account
  const accounts: Account[] = STANDARD_CHART_OF_ACCOUNTS.map((template) => ({
    ...template,
    id: `acc_${template.code}`,
    businessId,
    createdAt: now,
  }));

  // Second pass: link parentId based on parentCode
  for (const acc of accounts) {
    if (acc.parentCode) {
      const parent = accounts.find((p) => p.code === acc.parentCode);
      if (parent) {
        acc.parentId = parent.id;
      }
    }
  }

  return accounts;
}

export const DEFAULT_CHART_OF_ACCOUNTS = generateDefaultAccounts();

export function findAccountBySubtype(accounts: Account[], subtype: string): Account | undefined {
  const matches = accounts.filter((a) => a.subtype === subtype && a.isActive);
  // Prefer leaf account (level > 1) over top-level group header
  return matches.find((a) => (a.level ?? 1) > 1) || matches[0];
}

export function findAccountByCode(accounts: Account[], code: string): Account | undefined {
  return accounts.find((a) => a.code === code && a.isActive);
}

/**
 * Validates whether an account can be safely deleted or must be deactivated instead.
 * An account cannot be deleted if any posted journal entry references it.
 */
export function canDeleteAccount(
  accountId: string,
  journalEntries: JournalEntry[]
): { allowed: boolean; reason?: string } {
  const accountUsageCount = journalEntries.reduce((count, entry) => {
    const hasLine = entry.lines.some((line) => line.accountId === accountId);
    return count + (hasLine ? 1 : 0);
  }, 0);

  if (accountUsageCount > 0) {
    return {
      allowed: false,
      reason: `Account has ${accountUsageCount} posted transaction(s) recorded against it. Deactivation is permitted, but permanent deletion is blocked to protect historical audit integrity.`
    };
  }

  return { allowed: true };
}

/**
 * Builds a hierarchical tree of accounts for indented navigation in UI.
 */
export interface AccountTreeNode extends Account {
  children: AccountTreeNode[];
}

export function buildAccountHierarchy(accounts: Account[]): AccountTreeNode[] {
  const map = new Map<string, AccountTreeNode>();
  const roots: AccountTreeNode[] = [];

  for (const acc of accounts) {
    map.set(acc.id, { ...acc, children: [] });
  }

  for (const acc of accounts) {
    const node = map.get(acc.id)!;
    if (acc.parentId && map.has(acc.parentId)) {
      map.get(acc.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}
