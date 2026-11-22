import { Invoice, Expense, Party } from '../../types';
import { Account, JournalEntry } from '../../types/accounting';
import { 
  createSalesInvoiceJournalEntry, 
  createPurchaseInvoiceJournalEntry, 
  createExpenseJournalEntry, 
  createPartyOpeningBalanceJournalEntry,
  validateJournalEntry 
} from './journalEngine';

export interface MigrationSummary {
  inspectedInvoices: number;
  inspectedExpenses: number;
  inspectedParties: number;
  migratedJournals: number;
  skippedCount: number;
  discrepancies: string[];
  errors: string[];
  generatedEntries: JournalEntry[];
}

/**
 * Scans all existing business data (Invoices, Purchases, Expenses, Party Opening Balances)
 * and generates missing balanced double-entry journal entries.
 * Idempotent: Does not create duplicates if a journal entry already exists for a record.
 */
export function migrateExistingBusinessData(
  invoices: Invoice[],
  expenses: Expense[],
  parties: Party[],
  accounts: Account[],
  existingJournals: JournalEntry[],
  businessId?: string
): MigrationSummary {
  const summary: MigrationSummary = {
    inspectedInvoices: invoices.length,
    inspectedExpenses: expenses.length,
    inspectedParties: parties.length,
    migratedJournals: 0,
    skippedCount: 0,
    discrepancies: [],
    errors: [],
    generatedEntries: []
  };

  const existingSourceIds = new Set(existingJournals.map((j) => j.sourceId));

  // 1. Migrate Party Opening Balances
  for (const party of parties) {
    if ((party.openingBalance || 0) <= 0) {
      summary.skippedCount++;
      continue;
    }

    if (existingSourceIds.has(party.id)) {
      summary.skippedCount++;
      continue;
    }

    try {
      const journal = createPartyOpeningBalanceJournalEntry(party, accounts);
      if (journal) {
        journal.businessId = businessId;
        const validation = validateJournalEntry(journal, accounts);
        if (validation.valid) {
          summary.generatedEntries.push(journal);
          existingSourceIds.add(party.id);
          summary.migratedJournals++;
        } else {
          summary.discrepancies.push(`Party ${party.name} opening balance journal invalid: ${validation.error}`);
        }
      }
    } catch (err: any) {
      summary.errors.push(`Failed to migrate opening balance for party ${party.name}: ${err.message}`);
    }
  }

  // 2. Migrate Invoices (Sales & Purchases)
  for (const inv of invoices) {
    if (inv.deleted || inv.status === 'Cancelled') {
      summary.skippedCount++;
      continue;
    }

    if (existingSourceIds.has(inv.id)) {
      summary.skippedCount++;
      continue;
    }

    try {
      const party = parties.find((p) => p.id === inv.partyId);
      const partyName = party?.name || 'Customer/Supplier';
      const isPurchase = inv.type === 'Purchase Invoice' || inv.type.includes('Purchase');

      const journal = isPurchase
        ? createPurchaseInvoiceJournalEntry(inv, accounts, partyName)
        : createSalesInvoiceJournalEntry(inv, accounts, partyName);

      journal.businessId = businessId;
      const validation = validateJournalEntry(journal, accounts);
      if (validation.valid) {
        summary.generatedEntries.push(journal);
        existingSourceIds.add(inv.id);
        summary.migratedJournals++;
      } else {
        summary.discrepancies.push(`Invoice ${inv.invoiceNumber} journal unbalanced: ${validation.error}`);
      }
    } catch (err: any) {
      summary.errors.push(`Error generating journal for invoice ${inv.invoiceNumber}: ${err.message}`);
    }
  }

  // 3. Migrate Expenses
  for (const exp of expenses) {
    if (existingSourceIds.has(exp.id)) {
      summary.skippedCount++;
      continue;
    }

    try {
      const journal = createExpenseJournalEntry(exp, accounts);
      journal.businessId = businessId;
      const validation = validateJournalEntry(journal, accounts);
      if (validation.valid) {
        summary.generatedEntries.push(journal);
        existingSourceIds.add(exp.id);
        summary.migratedJournals++;
      } else {
        summary.discrepancies.push(`Expense ${exp.id} (${exp.category}) journal invalid: ${validation.error}`);
      }
    } catch (err: any) {
      summary.errors.push(`Error migrating expense ${exp.id}: ${err.message}`);
    }
  }

  return summary;
}
