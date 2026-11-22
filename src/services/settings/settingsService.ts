// Business Settings Service for Bazaar-Guru
import { BusinessProfile } from '../../types';
import { CompleteBusinessSettings, DEFAULT_COMPLETE_SETTINGS } from '../../types/settings';
import { idbGetAll, idbPut } from '../storage/idb';
import { getNumberingConfig, saveNumberingConfig } from './numberingService';
import { supabase } from '../../lib/supabase';

const SETTINGS_STORAGE_KEY = 'bazaar_guru_complete_settings_v1';

/**
 * Loads the complete settings object, reconciling with the active BusinessProfile.
 */
export async function loadCompleteSettings(baseProfile: BusinessProfile): Promise<CompleteBusinessSettings> {
  let settings: CompleteBusinessSettings = { ...DEFAULT_COMPLETE_SETTINGS };

  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Purge legacy mock data if detected in local storage
      if (parsed.identity?.tradeName?.includes('Aditya Retail')) {
        localStorage.removeItem(SETTINGS_STORAGE_KEY);
      } else {
        settings = {
          ...DEFAULT_COMPLETE_SETTINGS,
          ...parsed,
          identity: { ...DEFAULT_COMPLETE_SETTINGS.identity, ...(parsed.identity || {}) },
          contact: { ...DEFAULT_COMPLETE_SETTINGS.contact, ...(parsed.contact || {}) },
          branding: { ...DEFAULT_COMPLETE_SETTINGS.branding, ...(parsed.branding || {}) },
          primaryBank: { ...DEFAULT_COMPLETE_SETTINGS.primaryBank, ...(parsed.primaryBank || {}) },
          financialYear: { ...DEFAULT_COMPLETE_SETTINGS.financialYear, ...(parsed.financialYear || {}) },
          regional: { ...DEFAULT_COMPLETE_SETTINGS.regional, ...(parsed.regional || {}) },
          invoiceDefaults: { ...DEFAULT_COMPLETE_SETTINGS.invoiceDefaults, ...(parsed.invoiceDefaults || {}) },
          invoiceAppearance: { ...DEFAULT_COMPLETE_SETTINGS.invoiceAppearance, ...(parsed.invoiceAppearance || {}) },
          documentDefaults: { ...DEFAULT_COMPLETE_SETTINGS.documentDefaults, ...(parsed.documentDefaults || {}) },
          printExport: { ...DEFAULT_COMPLETE_SETTINGS.printExport, ...(parsed.printExport || {}) },
          taxGst: { ...DEFAULT_COMPLETE_SETTINGS.taxGst, ...(parsed.taxGst || {}) },
          inventory: { ...DEFAULT_COMPLETE_SETTINGS.inventory, ...(parsed.inventory || {}) },
          paymentsBanking: { ...DEFAULT_COMPLETE_SETTINGS.paymentsBanking, ...(parsed.paymentsBanking || {}) },
          notifications: { ...DEFAULT_COMPLETE_SETTINGS.notifications, ...(parsed.notifications || {}) },
          security: { ...DEFAULT_COMPLETE_SETTINGS.security, ...(parsed.security || {}) }
        };
      }
    }
  } catch (e) {
    console.warn('Failed to parse stored complete settings, using defaults', e);
  }

  // Load latest numbering sequences from IDB store
  try {
    const numberingConfig = await getNumberingConfig();
    if (numberingConfig && numberingConfig.sequences) {
      settings.numbering = numberingConfig;
    }
  } catch (e) {
    console.warn('Error reading numbering config', e);
  }

  // Reconcile with current BusinessProfile
  if (baseProfile) {
    if (baseProfile.name) {
      settings.identity.tradeName = baseProfile.name;
      settings.identity.legalName = baseProfile.name;
    }
    if (baseProfile.gstin) {
      settings.identity.gstin = baseProfile.gstin;
      if (baseProfile.gstin.length >= 12) {
        settings.identity.pan = baseProfile.gstin.substring(2, 12);
      }
    }
    if (baseProfile.address) settings.contact.address = baseProfile.address;
    if (baseProfile.state) settings.contact.state = baseProfile.state;
    if (baseProfile.phone) settings.contact.phone = baseProfile.phone;
    if (baseProfile.email) settings.contact.email = baseProfile.email;
    if (baseProfile.logoUrl !== undefined) settings.branding.logoUrl = baseProfile.logoUrl;
    if (baseProfile.signatureUrl !== undefined) settings.branding.signatureUrl = baseProfile.signatureUrl;
    if (baseProfile.bankName) settings.primaryBank.bankName = baseProfile.bankName;
    if (baseProfile.bankAccount) settings.primaryBank.bankAccount = baseProfile.bankAccount;
    if (baseProfile.bankIFSC) settings.primaryBank.bankIFSC = baseProfile.bankIFSC;
    if (baseProfile.bankBranch) settings.primaryBank.bankBranch = baseProfile.bankBranch;
    if (baseProfile.upiId) settings.primaryBank.upiId = baseProfile.upiId;
    if (baseProfile.termsTemplate) settings.invoiceDefaults.termsConditions = baseProfile.termsTemplate;
    if (baseProfile.inventoryConfig) {
      settings.inventory = {
        ...settings.inventory,
        ...baseProfile.inventoryConfig
      };
    }
  }

  return settings;
}

/**
 * Saves complete settings, updates IDB numbering_sequences, persists to Supabase (if online),
 * and produces the synchronized BusinessProfile for backward compatibility.
 */
export async function saveCompleteSettings(settings: CompleteBusinessSettings): Promise<BusinessProfile> {
  const updatedSettings: CompleteBusinessSettings = {
    ...settings,
    updatedAt: new Date().toISOString()
  };

  // 1. Save locally to localStorage
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updatedSettings));
  } catch (e) {
    console.warn('Error saving settings to localStorage', e);
  }

  // 2. Save numbering sequences into IDB
  try {
    await saveNumberingConfig(updatedSettings.numbering);
  } catch (e) {
    console.warn('Error persisting numbering sequences to IDB', e);
  }

  // 3. Construct synchronized BusinessProfile
  const updatedProfile: BusinessProfile = {
    name: updatedSettings.identity.tradeName || updatedSettings.identity.legalName,
    gstin: updatedSettings.identity.gstin,
    address: updatedSettings.contact.address,
    state: updatedSettings.contact.state,
    phone: updatedSettings.contact.phone,
    email: updatedSettings.contact.email,
    logoUrl: updatedSettings.branding.logoUrl,
    signatureUrl: updatedSettings.branding.signatureUrl,
    bankName: updatedSettings.primaryBank.bankName,
    bankAccount: updatedSettings.primaryBank.bankAccount,
    bankIFSC: updatedSettings.primaryBank.bankIFSC,
    bankBranch: updatedSettings.primaryBank.bankBranch,
    upiId: updatedSettings.primaryBank.upiId,
    termsTemplate: updatedSettings.invoiceDefaults.termsConditions,
    inventoryConfig: {
      defaultValuationMethod: updatedSettings.inventory.defaultValuationMethod,
      allowNegativeStock: updatedSettings.inventory.allowNegativeStock,
      lowStockAlertThreshold: updatedSettings.inventory.lowStockAlertThreshold,
      enableBatches: updatedSettings.inventory.enableBatches
    }
  };

  // 4. Update profile in IDB
  try {
    await idbPut('profile', { ...updatedProfile, id: 'business_profile' });
  } catch (e) {
    console.warn('Error updating profile in IDB', e);
  }

  // 5. Cloud sync to Supabase if session active
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await supabase.from('businesses').upsert({
        id: session.user.id,
        user_id: session.user.id,
        name: updatedProfile.name,
        gstin: updatedProfile.gstin,
        address: updatedProfile.address,
        state: updatedProfile.state,
        phone: updatedProfile.phone,
        email: updatedProfile.email,
        bank_name: updatedProfile.bankName,
        bank_account: updatedProfile.bankAccount,
        bank_ifsc: updatedProfile.bankIFSC,
        bank_branch: updatedProfile.bankBranch,
        upi_id: updatedProfile.upiId,
        settings_payload: updatedSettings,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
    }
  } catch (cloudErr) {
    console.info('Supabase cloud settings sync skipped or offline:', cloudErr);
  }

  return updatedProfile;
}

// ==========================================
// CSV Data Exporters (Section J3)
// ==========================================

function downloadCSVFile(csvContent: string, fileName: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function exportInvoicesToCSV(): Promise<{ count: number; filename: string }> {
  const invoices = await idbGetAll('invoices');
  const parties = await idbGetAll('parties');
  const partyMap = new Map(parties.map(p => [p.id, p.name]));

  const headers = ['Invoice Number', 'Party Name', 'Party Type', 'Date', 'Due Date', 'Place of Supply', 'Taxable Amount (Rs)', 'CGST', 'SGST', 'IGST', 'Grand Total (Rs)', 'Balance Due (Rs)', 'Status'];
  
  const rows = invoices.map(inv => {
    const partyName = partyMap.get(inv.partyId) || (inv as any).partyName || inv.partyId;
    const placeOfSupply = (inv as any).placeOfSupply || '';
    return [
      `"${inv.invoiceNumber || ''}"`,
      `"${partyName.replace(/"/g, '""')}"`,
      `"${inv.partyType || 'customer'}"`,
      `"${inv.date || ''}"`,
      `"${inv.dueDate || ''}"`,
      `"${placeOfSupply}"`,
      inv.taxableAmount ?? 0,
      inv.cgst ?? 0,
      inv.sgst ?? 0,
      inv.igst ?? 0,
      inv.grandTotal ?? 0,
      inv.balanceDue ?? 0,
      `"${inv.status || 'Active'}"`
    ];
  });

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const filename = `BazaarGuru_Invoices_${new Date().toISOString().split('T')[0]}.csv`;
  downloadCSVFile(csv, filename);
  return { count: invoices.length, filename };
}

export async function exportPartiesToCSV(): Promise<{ count: number; filename: string }> {
  const parties = await idbGetAll('parties');
  const headers = ['Party Name', 'Type', 'GSTIN', 'Phone', 'Email', 'Billing Address', 'State', 'Outstanding Balance (Rs)'];
  
  const rows = parties.map(p => [
    `"${(p.name || '').replace(/"/g, '""')}"`,
    `"${p.type || 'customer'}"`,
    `"${p.gstin || ''}"`,
    `"${p.phone || ''}"`,
    `"${p.email || ''}"`,
    `"${(p.billingAddress || '').replace(/"/g, '""')}"`,
    `"${p.state || ''}"`,
    p.outstandingBalance ?? 0
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const filename = `BazaarGuru_Parties_${new Date().toISOString().split('T')[0]}.csv`;
  downloadCSVFile(csv, filename);
  return { count: parties.length, filename };
}

export async function exportInventoryToCSV(): Promise<{ count: number; filename: string }> {
  const items = await idbGetAll('items');
  const headers = ['Item Name', 'HSN Code', 'Unit', 'Tax Rate (%)', 'Selling Price (Rs)', 'Current Stock Qty', 'Total Asset Value (Rs)'];
  
  const rows = items.map(item => {
    const price = item.unitPrice ?? 0;
    const valuation = (item.stockQty || 0) * price;
    return [
      `"${(item.name || '').replace(/"/g, '""')}"`,
      `"${item.hsnCode || ''}"`,
      `"${item.unit || 'PCS'}"`,
      item.gstRate ?? 18,
      price,
      item.stockQty ?? 0,
      valuation.toFixed(2)
    ];
  });

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const filename = `BazaarGuru_Inventory_${new Date().toISOString().split('T')[0]}.csv`;
  downloadCSVFile(csv, filename);
  return { count: items.length, filename };
}

export async function exportAccountsToCSV(): Promise<{ count: number; filename: string }> {
  const accounts = await idbGetAll('accounts');
  const headers = ['Account Code', 'Account Name', 'Type', 'Subtype', 'Current Balance (Rs)', 'Status'];
  
  const rows = accounts.map(acc => [
    `"${acc.code || ''}"`,
    `"${(acc.name || '').replace(/"/g, '""')}"`,
    `"${acc.type || ''}"`,
    `"${acc.subtype || ''}"`,
    acc.currentBalance ?? 0,
    acc.isActive ? '"Active"' : '"Inactive"'
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const filename = `BazaarGuru_ChartOfAccounts_${new Date().toISOString().split('T')[0]}.csv`;
  downloadCSVFile(csv, filename);
  return { count: accounts.length, filename };
}
