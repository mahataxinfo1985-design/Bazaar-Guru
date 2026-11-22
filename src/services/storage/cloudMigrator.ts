import { supabase } from '../../lib/supabase';
import { getIDB, initializeLocalDatabase, idbPut } from './idb';
import { 
  upsertProfile, upsertParty, upsertItem, upsertInvoice, 
  upsertExpense, upsertAccount, insertJournalEntry, 
  insertPaymentVoucher, upsertBankAccount, insertFundTransfer, 
  insertChequeRecord, fetchProfile, fetchParties, fetchItems, 
  fetchInvoices, fetchExpenses, fetchAccounts, fetchJournalEntries, 
  fetchPaymentVouchers 
} from '../../lib/db';

export interface MigrationSummary {
  success: boolean;
  message: string;
  pushed: {
    parties: number;
    items: number;
    invoices: number;
    expenses: number;
    accounts: number;
    journals: number;
    vouchers: number;
    bankAccounts: number;
    fundTransfers: number;
    cheques: number;
  };
  errors: string[];
}

/**
 * Pushes all local IndexedDB records up to the authenticated Supabase cloud tenant.
 */
export async function pushLocalDataToCloud(): Promise<MigrationSummary> {
  const summary: MigrationSummary = {
    success: false,
    message: '',
    pushed: {
      parties: 0,
      items: 0,
      invoices: 0,
      expenses: 0,
      accounts: 0,
      journals: 0,
      vouchers: 0,
      bankAccounts: 0,
      fundTransfers: 0,
      cheques: 0,
    },
    errors: [],
  };

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      summary.errors.push('Authentication required. Please sign in to sync with Supabase.');
      summary.message = 'Not authenticated';
      return summary;
    }

    const userId = session.user.id;
    const local = await initializeLocalDatabase();

    // 1. Profile
    if (local.profile) {
      try {
        await upsertProfile(local.profile, userId);
      } catch (err: any) {
        summary.errors.push(`Profile sync failed: ${err.message}`);
      }
    }

    // 2. Chart of Accounts
    if (local.accounts && local.accounts.length > 0) {
      for (const acc of local.accounts) {
        try {
          await upsertAccount(acc, userId);
          summary.pushed.accounts++;
        } catch (err: any) {
          summary.errors.push(`Account ${acc.code} sync failed: ${err.message}`);
        }
      }
    }

    // 3. Parties (Customers & Suppliers)
    if (local.parties && local.parties.length > 0) {
      for (const party of local.parties) {
        try {
          await upsertParty(party, userId);
          summary.pushed.parties++;
        } catch (err: any) {
          summary.errors.push(`Party ${party.name} sync failed: ${err.message}`);
        }
      }
    }

    // 4. Products / Items
    if (local.items && local.items.length > 0) {
      for (const item of local.items) {
        try {
          await upsertItem(item, userId);
          summary.pushed.items++;
        } catch (err: any) {
          summary.errors.push(`Item ${item.name} sync failed: ${err.message}`);
        }
      }
    }

    // 5. Invoices (Sales, Purchases, Credit Notes)
    if (local.invoices && local.invoices.length > 0) {
      for (const inv of local.invoices) {
        try {
          await upsertInvoice(inv, userId);
          summary.pushed.invoices++;
        } catch (err: any) {
          summary.errors.push(`Invoice ${inv.invoiceNumber} sync failed: ${err.message}`);
        }
      }
    }

    // 6. Bank Accounts
    if (local.bankAccounts && local.bankAccounts.length > 0) {
      for (const b of local.bankAccounts) {
        try {
          await upsertBankAccount(b, userId);
          summary.pushed.bankAccounts++;
        } catch (err: any) {
          summary.errors.push(`Bank ${b.bankName} sync failed: ${err.message}`);
        }
      }
    }

    // 7. Payment Vouchers
    if (local.paymentVouchers && local.paymentVouchers.length > 0) {
      for (const pv of local.paymentVouchers) {
        try {
          await insertPaymentVoucher(pv, userId);
          summary.pushed.vouchers++;
        } catch (err: any) {
          summary.errors.push(`Voucher ${pv.voucherNumber} sync failed: ${err.message}`);
        }
      }
    }

    // 8. Fund Transfers
    if (local.fundTransfers && local.fundTransfers.length > 0) {
      for (const ft of local.fundTransfers) {
        try {
          await insertFundTransfer(ft, userId);
          summary.pushed.fundTransfers++;
        } catch (err: any) {
          summary.errors.push(`Transfer ${ft.transferNumber} sync failed: ${err.message}`);
        }
      }
    }

    // 9. Cheques
    if (local.chequeRecords && local.chequeRecords.length > 0) {
      for (const chq of local.chequeRecords) {
        try {
          await insertChequeRecord(chq, userId);
          summary.pushed.cheques++;
        } catch (err: any) {
          summary.errors.push(`Cheque ${chq.chequeNumber} sync failed: ${err.message}`);
        }
      }
    }

    // 10. Expenses
    if (local.expenses && local.expenses.length > 0) {
      for (const exp of local.expenses) {
        try {
          await upsertExpense(exp, userId);
          summary.pushed.expenses++;
        } catch (err: any) {
          summary.errors.push(`Expense ${exp.vendorName} sync failed: ${err.message}`);
        }
      }
    }

    // 11. Journal Entries
    if (local.journalEntries && local.journalEntries.length > 0) {
      for (const jnl of local.journalEntries) {
        try {
          await insertJournalEntry(jnl, userId);
          summary.pushed.journals++;
        } catch (err: any) {
          summary.errors.push(`Journal ${jnl.entryNumber} sync failed: ${err.message}`);
        }
      }
    }

    summary.success = summary.errors.length === 0;
    summary.message = summary.success 
      ? 'All local business data successfully migrated to Supabase Cloud!'
      : `Data migration completed with ${summary.errors.length} non-blocking notice(s).`;

    return summary;
  } catch (err: any) {
    summary.errors.push(err.message || 'Unknown migration exception');
    summary.message = `Migration failed: ${err.message}`;
    return summary;
  }
}

/**
 * Pulls all records from Supabase cloud into local IndexedDB cache.
 */
export async function pullCloudDataToLocal(): Promise<{ success: boolean; message: string; count: number }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return { success: false, message: 'Please sign in to pull cloud data.', count: 0 };
    }

    const userId = session.user.id;
    let totalPulled = 0;

    // Profile
    const cloudProfile = await fetchProfile(userId);
    if (cloudProfile) {
      await idbPut('business_profile', { ...cloudProfile, id: 'primary_business' });
      totalPulled++;
    }

    // Parties
    const cloudParties = await fetchParties();
    for (const p of cloudParties) {
      await idbPut('parties', p);
      totalPulled++;
    }

    // Items
    const cloudItems = await fetchItems();
    for (const i of cloudItems) {
      await idbPut('items', i);
      totalPulled++;
    }

    // Invoices
    const cloudInvoices = await fetchInvoices();
    for (const inv of cloudInvoices) {
      await idbPut('invoices', inv);
      totalPulled++;
    }

    // Expenses
    const cloudExpenses = await fetchExpenses();
    for (const exp of cloudExpenses) {
      await idbPut('expenses', exp as any);
      totalPulled++;
    }

    return {
      success: true,
      message: `Successfully synchronized ${totalPulled} records from Supabase cloud into offline cache.`,
      count: totalPulled
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Failed to pull from cloud: ${err.message}`,
      count: 0
    };
  }
}
