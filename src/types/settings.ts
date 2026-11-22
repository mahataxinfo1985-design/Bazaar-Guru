// Complete Business Settings Type Definitions for Bazaar-Guru
import { BusinessProfile, InventoryConfig } from '../types';
import { BusinessNumberingConfig, BusinessRole, ActionPermission, ResourceScope, BusinessUser } from './workspace';

// SECTION A: Business Profile Types
export interface BusinessIdentity {
  tradeName: string;
  legalName: string;
  pan: string;
  gstin: string;
  constitution: 'proprietorship' | 'partnership' | 'llp' | 'pvt_ltd' | 'public_ltd' | 'individual_huf';
  gstType: 'regular' | 'composition';
  cin?: string;
  msmeRegNo?: string;
}

export interface BusinessContact {
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  mobile?: string;
  email: string;
  supportEmail?: string;
  website?: string;
}

export interface BusinessBranding {
  logoUrl?: string;
  signatureUrl?: string;
  tagline?: string;
  showQrOnInvoice: boolean;
}

export interface BankAccountDetails {
  bankName: string;
  accountHolderName: string;
  bankAccount: string;
  bankIFSC: string;
  bankBranch: string;
  upiId?: string;
  upiQrEnabled: boolean;
}

// SECTION B: Financial Settings Types
export interface FinancialYearSettings {
  currentFY: string; // e.g. "2024-25"
  booksBeginningDate: string; // "YYYY-MM-DD"
  isPeriodLocked: boolean;
  lockDate?: string;
}

export interface RegionalPreferences {
  currency: string; // "INR"
  currencySymbol: string; // "₹"
  symbolPosition: 'before' | 'after';
  numberSystem: 'indian' | 'international'; // Indian (Lakhs/Crores) vs International (Millions)
  dateFormat: 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'DD-MMM-YYYY';
  timezone: string; // "Asia/Kolkata"
}

// SECTION C: Invoice & Document Settings Types
export interface InvoiceDefaultsSettings {
  paymentTerms: 'immediate' | 'net15' | 'net30' | 'net45' | 'net60';
  dueDays: number;
  defaultNotes: string;
  termsConditions: string;
  placeOfSupplyMode: 'auto_customer' | 'business_state';
}

export interface InvoiceAppearanceSettings {
  showBankDetails: boolean;
  showUpiQr: boolean;
  showSignature: boolean;
  showTerms: boolean;
  showHsnSummary: boolean;
  showTotalInWords: boolean;
  defaultTemplate: 'classic' | 'modern' | 'compact' | 'elegant' | 'bold' | 'monochrome';
}

export interface DocumentDefaultsSettings {
  quotationValidityDays: number;
  poExpiryDays: number;
  deliveryTerms: string;
}

export interface PrintExportSettings {
  paperSize: 'A4' | 'Letter';
  orientation: 'portrait' | 'landscape';
  autoPrintAfterSave: boolean;
  copyMarkType: 'original' | 'duplicate' | 'triplicate' | 'none';
}

// SECTION D: Tax & GST Settings Types
export interface TaxGstSettings {
  registrationType: 'regular' | 'composition' | 'sez_unit' | 'sez_developer' | 'deemed_export';
  defaultGstRate: number;
  rcmApplicable: boolean;
  ewayBillThreshold: number; // ₹50,000 standard
  roundOffTaxMode: 'total' | 'item';
  priceTaxMode: 'exclusive' | 'inclusive';
  autoIgstCalculation: boolean;
  minHsnDigits: 4 | 6 | 8;
  defaultSacCode?: string;
  tdsTcsApplicable: boolean;
  defaultTdsRate: number;
  sandboxMode: boolean;
  irpApiKey?: string;
  ewayBillUsername?: string;
}

// SECTION E: Inventory Settings Types
export interface ExtendedInventorySettings extends InventoryConfig {
  autoDeductOnInvoice: boolean;
  enableExpiryTracking: boolean;
  defaultWarehouseId: string;
  multiWarehouseEnabled: boolean;
  defaultUOM: string;
  enableBarcodeScanning: boolean;
  autoGenerateSKU: boolean;
  skuPrefix: string;
  nearExpiryDays: number;
}

// SECTION F: Payments & Banking Settings Types
export interface PaymentBankingSettings {
  defaultPaymentMode: 'upi' | 'neft' | 'cash' | 'cheque' | 'card';
  autoCreateJournalEntry: boolean;
  allowPartialPayments: boolean;
  ageingBrackets: [number, number, number]; // [30, 60, 90]
  autoFlagOverdue: boolean;
  overdueReminderDays: number;
  chequeGraceDays: number;
  autoRemindPdcDays: number;
}

// SECTION G: Users & RBAC Types
export interface TeamMemberSetting {
  id: string;
  name: string;
  email: string;
  role: BusinessRole;
  isActive: boolean;
  assignedWarehouseId?: string;
  createdAt: string;
}

// SECTION H: Notification Settings Types
export interface NotificationSettingsConfig {
  alertLowStock: boolean;
  alertExpiringBatch: boolean;
  alertOverdueReceivable: boolean;
  alertUpcomingPayable: boolean;
  alertSyncAlert: boolean;
  alertHighValueInvoice: boolean;
  highValueThreshold: number;
  soundEnabled: boolean;
  autoDismissDays: number;
  whatsappEnabled: boolean;
  emailAlertsEnabled: boolean;
}

// SECTION I: Security & Privacy Types
export interface SecurityPrivacySettings {
  auditTrailEnabled: boolean;
  sessionTimeoutMinutes: number;
  dataEncryptionEnabled: boolean;
  lastBackupDate?: string;
}

// Master Aggregated Business Settings
export interface CompleteBusinessSettings {
  id: string;
  businessId: string;
  updatedAt: string;
  
  // Section A
  identity: BusinessIdentity;
  contact: BusinessContact;
  branding: BusinessBranding;
  primaryBank: BankAccountDetails;
  secondaryBank?: Partial<BankAccountDetails>;
  
  // Section B
  financialYear: FinancialYearSettings;
  regional: RegionalPreferences;
  numbering: BusinessNumberingConfig;
  
  // Section C
  invoiceDefaults: InvoiceDefaultsSettings;
  invoiceAppearance: InvoiceAppearanceSettings;
  documentDefaults: DocumentDefaultsSettings;
  printExport: PrintExportSettings;
  
  // Section D
  taxGst: TaxGstSettings;
  
  // Section E
  inventory: ExtendedInventorySettings;
  
  // Section F
  paymentsBanking: PaymentBankingSettings;
  
  // Section G
  team: TeamMemberSetting[];
  
  // Section H
  notifications: NotificationSettingsConfig;
  
  // Section I
  security: SecurityPrivacySettings;
}

// Default initial state for fresh setups
export const DEFAULT_COMPLETE_SETTINGS: CompleteBusinessSettings = {
  id: 'bazaar_guru_settings',
  businessId: 'biz_primary',
  updatedAt: new Date().toISOString(),
  
  identity: {
    tradeName: '',
    legalName: '',
    pan: '',
    gstin: '',
    constitution: 'pvt_ltd',
    gstType: 'regular',
    cin: '',
    msmeRegNo: ''
  },
  contact: {
    address: '',
    city: '',
    state: 'Maharashtra',
    pincode: '',
    phone: '',
    mobile: '',
    email: '',
    supportEmail: '',
    website: ''
  },
  branding: {
    logoUrl: '',
    signatureUrl: '',
    tagline: '',
    showQrOnInvoice: true
  },
  primaryBank: {
    bankName: '',
    accountHolderName: '',
    bankAccount: '',
    bankIFSC: '',
    bankBranch: '',
    upiId: '',
    upiQrEnabled: true
  },
  secondaryBank: {
    bankName: '',
    accountHolderName: '',
    bankAccount: '',
    bankIFSC: '',
    bankBranch: '',
    upiId: '',
    upiQrEnabled: false
  },
  financialYear: {
    currentFY: '2024-25',
    booksBeginningDate: '2024-04-01',
    isPeriodLocked: false,
    lockDate: ''
  },
  regional: {
    currency: 'INR',
    currencySymbol: '₹',
    symbolPosition: 'before',
    numberSystem: 'indian',
    dateFormat: 'DD/MM/YYYY',
    timezone: 'Asia/Kolkata'
  },
  numbering: {
    id: 'default_numbering_config',
    businessId: 'biz_primary',
    sequences: {
      INV: { docType: 'INV', prefix: 'INV', separator: '-', currentNumber: 1, padding: 4, fyReset: true, financialYear: '2024-25' },
      QUO: { docType: 'QUO', prefix: 'QUO', separator: '-', currentNumber: 1, padding: 4, fyReset: true, financialYear: '2024-25' },
      SO: { docType: 'SO', prefix: 'SO', separator: '-', currentNumber: 1, padding: 4, fyReset: true, financialYear: '2024-25' },
      DC: { docType: 'DC', prefix: 'DC', separator: '-', currentNumber: 1, padding: 4, fyReset: true, financialYear: '2024-25' },
      PO: { docType: 'PO', prefix: 'PO', separator: '-', currentNumber: 1, padding: 4, fyReset: true, financialYear: '2024-25' },
      GRN: { docType: 'GRN', prefix: 'GRN', separator: '-', currentNumber: 1, padding: 4, fyReset: true, financialYear: '2024-25' },
      PB: { docType: 'PB', prefix: 'PB', separator: '-', currentNumber: 1, padding: 4, fyReset: true, financialYear: '2024-25' },
      CN: { docType: 'CN', prefix: 'CN', separator: '-', currentNumber: 1, padding: 4, fyReset: true, financialYear: '2024-25' },
      DN: { docType: 'DN', prefix: 'DN', separator: '-', currentNumber: 1, padding: 4, fyReset: true, financialYear: '2024-25' },
      REC: { docType: 'REC', prefix: 'REC', separator: '-', currentNumber: 1, padding: 4, fyReset: true, financialYear: '2024-25' },
      PAY: { docType: 'PAY', prefix: 'PAY', separator: '-', currentNumber: 1, padding: 4, fyReset: true, financialYear: '2024-25' }
    }
  },
  invoiceDefaults: {
    paymentTerms: 'net30',
    dueDays: 30,
    defaultNotes: 'Thank you for choosing Bazaar-Guru verified commerce. Goods once sold are covered under standard merchant warranty.',
    termsConditions: '1. Payment is due within agreed credit period.\n2. Interest @ 18% p.a. will be charged on delayed payments.\n3. All disputes are subject to local jurisdiction only.',
    placeOfSupplyMode: 'auto_customer'
  },
  invoiceAppearance: {
    showBankDetails: true,
    showUpiQr: true,
    showSignature: true,
    showTerms: true,
    showHsnSummary: true,
    showTotalInWords: true,
    defaultTemplate: 'classic'
  },
  documentDefaults: {
    quotationValidityDays: 30,
    poExpiryDays: 45,
    deliveryTerms: 'Ex-Works / Door Delivery within 3 business days.'
  },
  printExport: {
    paperSize: 'A4',
    orientation: 'portrait',
    autoPrintAfterSave: false,
    copyMarkType: 'original'
  },
  taxGst: {
    registrationType: 'regular',
    defaultGstRate: 18,
    rcmApplicable: false,
    ewayBillThreshold: 50000,
    roundOffTaxMode: 'total',
    priceTaxMode: 'exclusive',
    autoIgstCalculation: true,
    minHsnDigits: 4,
    defaultSacCode: '998311',
    tdsTcsApplicable: false,
    defaultTdsRate: 1.0,
    sandboxMode: true
  },
  inventory: {
    defaultValuationMethod: 'weighted_average',
    allowNegativeStock: false,
    lowStockAlertThreshold: 10,
    enableBatches: true,
    autoDeductOnInvoice: true,
    enableExpiryTracking: true,
    defaultWarehouseId: 'wh_main',
    multiWarehouseEnabled: true,
    defaultUOM: 'PCS',
    enableBarcodeScanning: true,
    autoGenerateSKU: true,
    skuPrefix: 'SKU',
    nearExpiryDays: 30
  },
  paymentsBanking: {
    defaultPaymentMode: 'upi',
    autoCreateJournalEntry: true,
    allowPartialPayments: true,
    ageingBrackets: [30, 60, 90],
    autoFlagOverdue: true,
    overdueReminderDays: 7,
    chequeGraceDays: 3,
    autoRemindPdcDays: 3
  },
  team: [],
  notifications: {
    alertLowStock: true,
    alertExpiringBatch: true,
    alertOverdueReceivable: true,
    alertUpcomingPayable: true,
    alertSyncAlert: true,
    alertHighValueInvoice: true,
    highValueThreshold: 100000,
    soundEnabled: true,
    autoDismissDays: 14,
    whatsappEnabled: false,
    emailAlertsEnabled: true
  },
  security: {
    auditTrailEnabled: true,
    sessionTimeoutMinutes: 120,
    dataEncryptionEnabled: true,
    lastBackupDate: new Date().toISOString()
  }
};
