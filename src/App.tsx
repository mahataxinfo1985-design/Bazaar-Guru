import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Menu, Wifi, WifiOff, RefreshCw, Plus, CreditCard, Search, RotateCcw,
  ChevronDown, Receipt, ShoppingCart, Users, Package, LogOut, Settings
} from 'lucide-react';
import { 
  Invoice, Party, Item, Expense, BusinessProfile, InvoiceStatus, PaymentStatus, PartyType 
} from './types';
import { 
  Account, JournalEntry, PaymentVoucher, AccountingPeriod 
} from './types/accounting';

// Storage & Sync
import { 
  initializeLocalDatabase, idbPut, idbDelete, 
  DEFAULT_BUSINESS_PROFILE, getIDB 
} from './services/storage/idb';
import { 
  enqueueMutation, syncPendingMutations, getPendingMutations 
} from './services/storage/syncQueue';

// Supabase Direct Cloud API
import { 
  fetchProfile, fetchParties, fetchItems, fetchInvoices, 
  fetchExpenses, fetchAccounts, fetchJournalEntries, fetchPaymentVouchers,
  upsertInvoice, upsertParty, upsertItem, upsertExpense, 
  insertPaymentVoucher, softDeleteInvoice, deleteParty, deleteItem, deleteExpense,
  upsertProfile
} from './lib/db';

// Inventory & Stock Tracking
import { 
  Product, Warehouse, StockMovement, StockTransfer, StockAdjustment, 
  ProductBatch, InventoryValuationLayer 
} from './types/inventory';
import { DEFAULT_WAREHOUSE, executeStockTransfer } from './services/inventory/warehouseService';
import { 
  createStockMovement, validateStockAvailability, isPhysicalInventoryTracked 
} from './services/inventory/stockMovementService';
import { 
  computeWeightedAverageCost, calculateCOGSWeightedAverage, 
  consumeFIFOLayers, addValuationLayer, restoreFIFOLayers 
} from './services/inventory/valuationService';
import { processStockAdjustment } from './services/inventory/adjustmentService';
import { 
  createCOGSJournalEntry, 
  createStockAdjustmentJournalEntry 
} from './services/accounting/journalEngine';
import ProductModal from './components/modals/ProductModal';
import StockTransferModal from './components/modals/StockTransferModal';
import StockAdjustmentModal from './components/modals/StockAdjustmentModal';

// Banking & Treasury
import { 
  BankAccount, CashAccount, FundTransfer, ChequeRecord, 
  BankStatementImport, BankStatementLine, BankReconciliation 
} from './types/banking';
import { 
  DEFAULT_BANK_ACCOUNTS, DEFAULT_CASH_ACCOUNTS 
} from './services/banking/bankAccountService';
import { 
  createFundTransferJournalEntry, 
  createChequeBounceJournalEntry 
} from './services/accounting/journalEngine';

// Accounting Core
import { DEFAULT_CHART_OF_ACCOUNTS } from './services/accounting/chartOfAccounts';
import { DEFAULT_ACCOUNTING_PERIODS, canPostToDate } from './services/accounting/periodService';
import { 
  createSalesInvoiceJournalEntry, 
  createPurchaseInvoiceJournalEntry, 
  createPaymentInJournalEntry, 
  createPaymentOutJournalEntry, 
  createExpenseJournalEntry, 
  createReversalJournalEntry,
  createPartyOpeningBalanceJournalEntry
} from './services/accounting/journalEngine';
import { safeAdd, safeSub } from './utils/decimal';
import { exportInvoicesExcel, exportInvoicesCSV, exportBulkInvoicesJSON } from './utils/exportHelpers';

// Supabase
import { supabase } from './lib/supabase';

// UI Layout & Modals
import Sidebar from './components/Sidebar';
import PartyModal from './components/PartyModal';
import ItemModal from './components/ItemModal';
import ExpenseModal from './components/ExpenseModal';
import AuthScreen from './components/AuthScreen';
import PaymentVoucherModal from './components/modals/PaymentVoucherModal';
import PartyLedgerModal from './components/modals/PartyLedgerModal';
import CancelInvoiceModal from './components/modals/CancelInvoiceModal';
import DocumentViewerModal from './components/modals/DocumentViewerModal';
import { ReceiptVoucherModal } from './components/modals/ReceiptVoucherModal';
import { PaymentOutModal } from './components/modals/PaymentOutModal';
import { FundTransferModal } from './components/modals/FundTransferModal';
import { BankAccountModal } from './components/modals/BankAccountModal';
import { ChequeActionModal } from './components/modals/ChequeActionModal';
import { StatementImportModal } from './components/modals/StatementImportModal';
import { PaymentVoucherPrintModal } from './components/modals/PaymentVoucherPrintModal';

// Feature Views
import DashboardView from './features/dashboard/DashboardView';
import SalesRegisterView from './features/sales/SalesRegisterView';
import CreateSalesInvoiceView from './features/sales/CreateSalesInvoiceView';
import PurchaseRegisterView from './features/purchases/PurchaseRegisterView';
import CreatePurchaseBillView from './features/purchases/CreatePurchaseBillView';
import PartiesView from './features/parties/PartiesView';
import InventoryView from './features/inventory/InventoryView';
import AccountingView from './features/accounting/AccountingView';
import LandingPage from './components/LandingPage';
import { BankingView } from './features/banking/BankingView';
import ReportsView from './features/reports/ReportsView';
import ExpensesView from './features/expenses/ExpensesView';
import SettingsView from './features/settings/SettingsView';
import NotificationCenter from './components/NotificationCenter';
import GlobalSearchModal from './components/modals/GlobalSearchModal';
import ReturnModal from './components/modals/ReturnModal';
import { getPendingOutboxOperations, recoverDanglingOperations } from './services/sync/outboxEngine';
import { getUnresolvedConflicts } from './services/sync/conflictService';
import { registerCurrentDevice } from './services/sync/deviceService';

export default function App() {
  // Navigation & UI State - Persist active view across tab switches
  const [currentTab, setCurrentTab] = useState<string>(() => {
    return sessionStorage.getItem('bg_active_tab') || 'landing';
  });
  const currentUserIdRef = useRef<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [quickActionMenuOpen, setQuickActionMenuOpen] = useState(false);
  const quickActionRef = useRef<HTMLDivElement>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [conflictCount, setConflictCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);

  // Business Data State
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [profile, setProfile] = useState<BusinessProfile>(DEFAULT_BUSINESS_PROFILE);
  const [accounts, setAccounts] = useState<Account[]>(DEFAULT_CHART_OF_ACCOUNTS);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [paymentVouchers, setPaymentVouchers] = useState<PaymentVoucher[]>([]);
  const [accountingPeriods, setAccountingPeriods] = useState<AccountingPeriod[]>(DEFAULT_ACCOUNTING_PERIODS);

  // Inventory State
  const [warehouses, setWarehouses] = useState<Warehouse[]>([DEFAULT_WAREHOUSE]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [inventoryLayers, setInventoryLayers] = useState<InventoryValuationLayer[]>([]);
  const [productBatches, setProductBatches] = useState<ProductBatch[]>([]);
  const [stockTransfers, setStockTransfers] = useState<StockTransfer[]>([]);
  const [stockAdjustments, setStockAdjustments] = useState<StockAdjustment[]>([]);

  // Inventory Modals State
  const [productModal, setProductModal] = useState<{ isOpen: boolean; productToEdit: Product | null }>({
    isOpen: false,
    productToEdit: null
  });
  const [stockTransferModalOpen, setStockTransferModalOpen] = useState(false);
  const [stockAdjustmentModalOpen, setStockAdjustmentModalOpen] = useState(false);

  // Banking & Treasury State
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>(DEFAULT_CASH_ACCOUNTS);
  const [fundTransfers, setFundTransfers] = useState<FundTransfer[]>([]);
  const [chequeRecords, setChequeRecords] = useState<ChequeRecord[]>([]);
  const [bankStatements, setBankStatements] = useState<BankStatementImport[]>([]);
  const [bankStatementLines, setBankStatementLines] = useState<BankStatementLine[]>([]);
  const [bankReconciliations, setBankReconciliations] = useState<BankReconciliation[]>([]);

  // Modals State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signin');
  const [partyModal, setPartyModal] = useState<{ isOpen: boolean; type: PartyType }>({
    isOpen: false,
    type: 'customer'
  });
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [expenseModal, setExpenseModal] = useState<{ isOpen: boolean; expenseToEdit: Expense | null }>({
    isOpen: false,
    expenseToEdit: null
  });
  const [paymentVoucherModal, setPaymentVoucherModal] = useState<{
    isOpen: boolean;
    defaultType: 'payment_in' | 'payment_out';
    partyId?: string;
    invoiceId?: string;
  }>({
    isOpen: false,
    defaultType: 'payment_in'
  });
  const [partyLedgerModal, setPartyLedgerModal] = useState<{
    isOpen: boolean;
    partyId?: string;
  }>({
    isOpen: false
  });
  const [cancelInvoiceModal, setCancelInvoiceModal] = useState<{
    isOpen: boolean;
    invoice: Invoice | null;
  }>({
    isOpen: false,
    invoice: null
  });
  const [documentViewerModal, setDocumentViewerModal] = useState<{
    isOpen: boolean;
    invoice: Invoice | null;
  }>({
    isOpen: false,
    invoice: null
  });

  // Banking Modals State
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [paymentOutModalOpen, setPaymentOutModalOpen] = useState(false);
  const [fundTransferModalOpen, setFundTransferModalOpen] = useState(false);
  const [bankAccountModalState, setBankAccountModalState] = useState<{
    isOpen: boolean;
    kind: 'bank' | 'cash';
    editingAccount?: BankAccount | CashAccount | null;
  }>({
    isOpen: false,
    kind: 'bank'
  });
  const [chequeActionModalState, setChequeActionModalState] = useState<{
    isOpen: boolean;
    cheque: ChequeRecord | null;
  }>({
    isOpen: false,
    cheque: null
  });
  const [statementImportModalOpen, setStatementImportModalOpen] = useState(false);
  const [printVoucherModalState, setPrintVoucherModalState] = useState<{
    isOpen: boolean;
    voucher: PaymentVoucher | null;
  }>({
    isOpen: false,
    voucher: null
  });

  // Phase 6: Omnibar Search & Return Modals State
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [returnModalState, setReturnModalState] = useState<{
    isOpen: boolean;
    invoice: Invoice | null;
  }>({
    isOpen: false,
    invoice: null
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K' || e.code === 'KeyK')) {
        e.preventDefault();
        e.stopPropagation();
        setGlobalSearchOpen(prev => !prev);
      } else if (e.key === 'Escape' || e.key === 'Esc' || e.code === 'Escape') {
        setGlobalSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  // Close quick action & user menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (quickActionRef.current && !quickActionRef.current.contains(e.target as Node)) {
        setQuickActionMenuOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Real Sign Out action
  const handleSignOut = async () => {
    if (confirm('Are you sure you want to sign out from Bazaar-Guru?')) {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setInvoices([]);
      setParties([]);
      setItems([]);
      setExpenses([]);
      setPaymentVouchers([]);
      setJournalEntries([]);
      setCurrentTab('landing');
    }
  };

  // Refresh pending mutation count and conflicts
  const refreshPendingCount = useCallback(async () => {
    try {
      const [pendingMutations, pendingOutbox, confs] = await Promise.all([
        getPendingMutations(),
        getPendingOutboxOperations(),
        getUnresolvedConflicts()
      ]);
      const totalPending = Math.max(pendingMutations.length, pendingOutbox.length);
      setPendingSyncCount(totalPending);
      setConflictCount(confs.length);
    } catch {
      // ignore
    }
  }, []);

  // Cloud-First: Authoritative Data Loading from Supabase
  const loadCloudBusinessData = async (userId: string, authUser?: any) => {
    try {
      const [
        cloudProfile,
        cloudParties,
        cloudItems,
        cloudInvoices,
        cloudExpenses,
        cloudAccounts,
        cloudJournals,
        cloudVouchers
      ] = await Promise.all([
        fetchProfile(userId).catch(() => null),
        fetchParties().catch(() => []),
        fetchItems().catch(() => []),
        fetchInvoices().catch(() => []),
        fetchExpenses().catch(() => []),
        fetchAccounts().catch(() => []),
        fetchJournalEntries().catch(() => []),
        fetchPaymentVouchers().catch(() => []),
      ]);

      if (cloudProfile && cloudProfile.name) {
        setProfile(cloudProfile);
      } else {
        // Fresh cloud user profile - Clean state without mock company data
        const activeUser = authUser || user || session?.user;
        const userEmail = activeUser?.email || '';
        const userBizName = activeUser?.user_metadata?.business_name || activeUser?.user_metadata?.name || '';
        const cleanProfile: BusinessProfile = {
          name: userBizName || (userEmail ? userEmail.split('@')[0] : ''),
          gstin: '',
          address: '',
          state: 'Maharashtra',
          phone: '',
          email: userEmail,
          bankName: '',
          bankAccount: '',
          bankIFSC: '',
          bankBranch: '',
          termsTemplate: '1. Goods once sold will not be returned or exchanged.\n2. Please mention Invoice Number on payment transfers.\n3. Payment is due within standard terms.',
          upiId: ''
        };
        setProfile(cleanProfile);
      }
      setParties(cloudParties || []);
      setItems(cloudItems || []);
      setInvoices(cloudInvoices || []);
      setExpenses(cloudExpenses || []);
      setPaymentVouchers(cloudVouchers || []);
      setJournalEntries(cloudJournals || []);
      // Filter out any stale mock bank accounts
      setBankAccounts(prev => prev.filter(ba => ba.id !== 'bank_default_1' && ba.accountNumber !== '50200012345678'));
      if (cloudAccounts && cloudAccounts.length > 0) {
        setAccounts(cloudAccounts);
      }

      // Synchronize local IDB stores to strictly mirror authoritative cloud records
      const db = await getIDB().catch(() => null);
      if (db) {
        try {
          await db.clear('parties');
          for (const p of (cloudParties || [])) await db.put('parties', p);

          await db.clear('items');
          for (const it of (cloudItems || [])) await db.put('items', it);

          await db.clear('invoices');
          for (const inv of (cloudInvoices || [])) await db.put('invoices', inv);

          await db.clear('expenses');
          for (const exp of (cloudExpenses || [])) await db.put('expenses', exp);

          // If user has no active items or invoices, purge stale mock notifications
          if ((!cloudItems || cloudItems.length === 0) && (!cloudInvoices || cloudInvoices.length === 0)) {
            await db.clear('notifications').catch(() => {});
          }
        } catch (dbErr) {
          console.warn('Could not synchronize IDB cache', dbErr);
        }
      }
    } catch (err) {
      console.error('Error loading authoritative cloud data:', err);
      // Fallback to local cache if offline
      const localData = await initializeLocalDatabase().catch(() => null);
      if (localData) {
        if (localData.invoices) setInvoices(localData.invoices);
        if (localData.parties) setParties(localData.parties);
        if (localData.items) setItems(localData.items);
        if (localData.profile) setProfile(localData.profile);
      }
    }
  };

  // Initialize Session & Authenticated Workspace
  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (!isMounted) return;

        setSession(initialSession);
        setUser(initialSession?.user ?? null);

        if (!initialSession?.user) {
          // Unauthenticated visitors ALWAYS see the public landing page first!
          setCurrentTab('landing');
          return;
        }

        // Authenticated user -> Load their authoritative business records from Supabase
        currentUserIdRef.current = initialSession.user.id;
        await loadCloudBusinessData(initialSession.user.id, initialSession.user);
        const savedTab = sessionStorage.getItem('bg_active_tab');
        setCurrentTab(savedTab && savedTab !== 'landing' ? savedTab : 'dashboard');
      } catch (err) {
        console.error('Failed to bootstrap application:', err);
        if (isMounted) setCurrentTab('landing');
      }
    }

    bootstrap();

    // Setup network listeners
    const handleOnline = () => {
      setIsOnline(true);
      triggerSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Setup Auth listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!isMounted) return;
      const prevUserId = currentUserIdRef.current;
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && newSession?.user) {
        // Prevent unnecessary full reload when user returns to or focuses the browser tab
        if (newSession.user.id !== prevUserId) {
          currentUserIdRef.current = newSession.user.id;
          await loadCloudBusinessData(newSession.user.id, newSession.user);
        }
        // Retain user's current view if they were already inside the application
        setCurrentTab(prev => {
          if (prev === 'landing') {
            const savedTab = sessionStorage.getItem('bg_active_tab');
            return savedTab && savedTab !== 'landing' ? savedTab : 'dashboard';
          }
          return prev;
        });
        setIsAuthModalOpen(false);
      } else if (event === 'SIGNED_OUT') {
        currentUserIdRef.current = null;
        setUser(null);
        setSession(null);
        setInvoices([]);
        setParties([]);
        setItems([]);
        setExpenses([]);
        setPaymentVouchers([]);
        setJournalEntries([]);
        setBankAccounts([]);
        setProfile(DEFAULT_BUSINESS_PROFILE);
        const db = await getIDB().catch(() => null);
        if (db) {
          await Promise.all([
            db.clear('parties').catch(() => {}),
            db.clear('items').catch(() => {}),
            db.clear('invoices').catch(() => {}),
            db.clear('expenses').catch(() => {}),
            db.clear('bank_accounts').catch(() => {}),
            db.clear('notifications').catch(() => {}),
          ]);
        }
        localStorage.removeItem('invoice_pro_profile');
        localStorage.removeItem('invoice_pro_parties');
        localStorage.removeItem('invoice_pro_items');
        localStorage.removeItem('invoice_pro_invoices');
        localStorage.removeItem('bazaar_guru_complete_settings_v1');
        localStorage.removeItem('bazaar_guru_dismissed_notifications_v1');
        sessionStorage.removeItem('bg_active_tab');
        setCurrentTab('landing');
      }
    });

    return () => {
      isMounted = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      subscription.unsubscribe();
    };
  }, []);

  // Sync active view into session storage to preserve state across tab switches
  useEffect(() => {
    if (currentTab && currentTab !== 'landing') {
      sessionStorage.setItem('bg_active_tab', currentTab);
    } else if (currentTab === 'landing') {
      sessionStorage.removeItem('bg_active_tab');
    }
  }, [currentTab]);

  // Sync background runner
  const triggerSync = async () => {
    if (!navigator.onLine || isSyncing) return;
    setIsSyncing(true);
    try {
      await syncPendingMutations();
      await refreshPendingCount();
    } catch (err) {
      console.warn('Sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // ----------------------------------------------------
  // BUSINESS OPERATIONS & DOUBLE-ENTRY DISPATCHERS
  // ----------------------------------------------------

  const checkPeriodOpen = (date: string): boolean => {
    const check = canPostToDate(accountingPeriods, date);
    if (!check.allowed) {
      alert(`Cannot post transaction: ${check.reason}`);
      return false;
    }
    return true;
  };

  // 1. Create / Save Sales Invoice
  const handleSaveSalesInvoice = async (invoice: Invoice, status: InvoiceStatus) => {
    try {
      if (!checkPeriodOpen(invoice.date)) return;
      const finalInvoice: Invoice = { ...invoice, status };
      const customer = parties.find(p => p.id === invoice.partyId);
      const customerName = customer?.name || 'Customer';

      // Stock availability check if negative stock is disallowed
      const allowNegative = profile.inventoryConfig?.allowNegativeStock ?? false;
      for (const line of finalInvoice.items) {
        const prod = items.find(it => it.id === line.itemId || it.name.toLowerCase() === line.name.toLowerCase()) as Product | undefined;
        if (prod && isPhysicalInventoryTracked(prod.itemType, prod.trackStock)) {
          const check = validateStockAvailability(prod.stockQty || 0, line.qty, allowNegative);
          if (!check.allowed) {
            alert(check.error || `Insufficient stock for ${prod.name}`);
            return;
          }
        }
      }

      // A. Generate Double Entry Journal
      const journal = createSalesInvoiceJournalEntry(finalInvoice, accounts, customerName);

      // B. Compute COGS and create Stock Movements for line items
      const newMovements: StockMovement[] = [];
      let updatedLayers = [...inventoryLayers];
      let totalInvoiceCOGS = 0;
      const valuationMethod = profile.inventoryConfig?.defaultValuationMethod || 'weighted_average';

      const updatedItems = items.map(item => {
        const line = finalInvoice.items.find(i => i.name.toLowerCase() === item.name.toLowerCase() || i.itemId === item.id);
        if (line) {
          const prod = item as Product;
          let lineCOGS = 0;

          if (isPhysicalInventoryTracked(prod.itemType, prod.trackStock)) {
            if (valuationMethod === 'fifo') {
              const fifoRes = consumeFIFOLayers(updatedLayers, item.id, line.qty);
              lineCOGS = fifoRes.cogsAmount;
              updatedLayers = fifoRes.updatedLayers;
            } else {
              const unitCost = item.purchasePrice || item.costPrice || 0;
              const wacRes = calculateCOGSWeightedAverage(line.qty, item.stockQty, unitCost);
              lineCOGS = wacRes.cogsAmount;
            }
            totalInvoiceCOGS = safeAdd(totalInvoiceCOGS, lineCOGS);

            const movement = createStockMovement({
              productId: item.id,
              productName: item.name,
              sku: prod.sku,
              warehouseId: DEFAULT_WAREHOUSE.id,
              warehouseName: DEFAULT_WAREHOUSE.name,
              movementType: 'sales',
              quantityOut: line.qty,
              unitCost: line.qty > 0 ? (lineCOGS / line.qty) : (item.purchasePrice || 0),
              referenceType: 'invoice',
              referenceId: finalInvoice.id,
              referenceNumber: finalInvoice.invoiceNumber,
              notes: `Sales invoice ${finalInvoice.invoiceNumber}`
            });
            newMovements.push(movement);
          }

          const newQty = Math.max(0, safeSub(item.stockQty, line.qty));
          const updatedItem = { ...item, stockQty: newQty };
          idbPut('items', updatedItem);
          enqueueMutation('upsert_item', updatedItem.id, updatedItem);
          return updatedItem;
        }
        return item;
      });

      // C. Generate COGS Journal Entry if applicable
      let cogsJournal: JournalEntry | null = null;
      if (totalInvoiceCOGS > 0) {
        cogsJournal = createCOGSJournalEntry({
          invoiceId: finalInvoice.id,
          invoiceNumber: finalInvoice.invoiceNumber,
          date: finalInvoice.date,
          cogsAmount: totalInvoiceCOGS,
          accounts
        });
        if (cogsJournal) {
          await idbPut('journal_entries', cogsJournal);
        }
      }

      // D. Update Customer Outstanding Balance
      const updatedParties = parties.map(p => {
        if (p.id === finalInvoice.partyId) {
          const newBal = safeAdd(p.outstandingBalance || 0, finalInvoice.balanceDue);
          const updatedParty = { ...p, outstandingBalance: newBal };
          idbPut('parties', updatedParty);
          enqueueMutation('upsert_party', updatedParty.id, updatedParty);
          return updatedParty;
        }
        return p;
      });

      // E. Persist Invoice & Journal to IDB
      await idbPut('invoices', finalInvoice);
      await idbPut('journal_entries', journal);

      // F. Persist Stock Movements & Layers
      for (const m of newMovements) {
        await idbPut('stock_movements', m);
        await enqueueMutation('upsert_stock_movement', m.id, m);
      }
      for (const l of updatedLayers) {
        await idbPut('inventory_layers', l);
      }

      // G. Direct Cloud Persistence & Enqueue Sync
      if (user?.id) {
        upsertInvoice(finalInvoice, user.id).catch(err => console.error('Cloud invoice persist error:', err));
        for (const it of updatedItems) {
          upsertItem(it, user.id).catch(() => {});
        }
        for (const p of updatedParties) {
          upsertParty(p, user.id).catch(() => {});
        }
      }
      await enqueueMutation('upsert_invoice', finalInvoice.id, finalInvoice);

      // H. Update in-memory state
      setInvoices(prev => [finalInvoice, ...prev.filter(inv => inv.id !== finalInvoice.id)]);
      setItems(updatedItems);
      setParties(updatedParties);
      setJournalEntries(prev => cogsJournal ? [cogsJournal, journal, ...prev] : [journal, ...prev]);
      setStockMovements(prev => [...newMovements, ...prev]);
      setInventoryLayers(updatedLayers);

      await refreshPendingCount();
      setCurrentTab('sales');
      if (isOnline) triggerSync();
    } catch (err: any) {
      alert(`Error saving sales invoice: ${err.message}`);
    }
  };

  // 2. Create / Save Purchase Bill
  const handleSavePurchaseBill = async (bill: Invoice, status: InvoiceStatus) => {
    try {
      if (!checkPeriodOpen(bill.date)) return;
      const finalBill: Invoice = { ...bill, status };
      const supplier = parties.find(p => p.id === bill.partyId);
      const supplierName = supplier?.name || 'Supplier';

      // A. Generate Double Entry Journal
      const journal = createPurchaseInvoiceJournalEntry(finalBill, accounts, supplierName);

      // B. Increase Inventory Stock and update valuation for line items
      const newMovements: StockMovement[] = [];
      let updatedLayers = [...inventoryLayers];
      const valuationMethod = profile.inventoryConfig?.defaultValuationMethod || 'weighted_average';

      const updatedItems = items.map(item => {
        const line = finalBill.items.find(i => i.name.toLowerCase() === item.name.toLowerCase() || i.itemId === item.id);
        if (line) {
          const prod = item as Product;
          const unitRate = line.unitPrice || 0;
          let newCost = item.purchasePrice || item.costPrice || unitRate;

          if (isPhysicalInventoryTracked(prod.itemType, prod.trackStock)) {
            if (valuationMethod === 'weighted_average') {
              newCost = computeWeightedAverageCost(item.stockQty, item.purchasePrice || item.costPrice || 0, line.qty, unitRate);
            } else {
              updatedLayers = addValuationLayer(updatedLayers, {
                productId: item.id,
                quantity: line.qty,
                unitCost: unitRate,
                purchaseDate: finalBill.date,
                referenceType: 'purchase',
                referenceId: finalBill.id
              });
            }

            const movement = createStockMovement({
              productId: item.id,
              productName: item.name,
              sku: prod.sku,
              warehouseId: DEFAULT_WAREHOUSE.id,
              warehouseName: DEFAULT_WAREHOUSE.name,
              movementType: 'purchase',
              quantityIn: line.qty,
              unitCost: unitRate,
              referenceType: 'purchase',
              referenceId: finalBill.id,
              referenceNumber: finalBill.invoiceNumber,
              notes: `Purchase bill ${finalBill.invoiceNumber}`
            });
            newMovements.push(movement);
          }

          const newQty = safeAdd(item.stockQty, line.qty);
          const updatedItem = { ...item, stockQty: newQty, purchasePrice: newCost, costPrice: newCost };
          idbPut('items', updatedItem);
          enqueueMutation('upsert_item', updatedItem.id, updatedItem);
          return updatedItem;
        }
        return item;
      });

      // C. Update Supplier Outstanding Balance (Payable increases)
      const updatedParties = parties.map(p => {
        if (p.id === finalBill.partyId) {
          const newBal = safeSub(p.outstandingBalance || 0, finalBill.balanceDue);
          const updatedParty = { ...p, outstandingBalance: newBal };
          idbPut('parties', updatedParty);
          enqueueMutation('upsert_party', updatedParty.id, updatedParty);
          return updatedParty;
        }
        return p;
      });

      // D. Persist Bill & Journal to IDB
      await idbPut('invoices', finalBill);
      await idbPut('journal_entries', journal);

      // E. Persist Movements & Layers
      for (const m of newMovements) {
        await idbPut('stock_movements', m);
        await enqueueMutation('upsert_stock_movement', m.id, m);
      }
      for (const l of updatedLayers) {
        await idbPut('inventory_layers', l);
      }

      // F. Direct Cloud Persistence & Enqueue Sync
      if (user?.id) {
        upsertInvoice(finalBill, user.id).catch(err => console.error('Cloud purchase bill persist error:', err));
        for (const it of updatedItems) {
          upsertItem(it, user.id).catch(() => {});
        }
        for (const p of updatedParties) {
          upsertParty(p, user.id).catch(() => {});
        }
      }
      await enqueueMutation('upsert_invoice', finalBill.id, finalBill);

      // G. Update in-memory state
      setInvoices(prev => [finalBill, ...prev.filter(inv => inv.id !== finalBill.id)]);
      setItems(updatedItems);
      setParties(updatedParties);
      setJournalEntries(prev => [journal, ...prev]);
      setStockMovements(prev => [...newMovements, ...prev]);
      setInventoryLayers(updatedLayers);

      await refreshPendingCount();
      setCurrentTab('purchase');
      if (isOnline) triggerSync();
    } catch (err: any) {
      alert(`Error saving purchase bill: ${err.message}`);
    }
  };

  // 3. Record Payment Voucher (Payment In / Payment Out)
  const handleRecordPaymentVoucher = async (voucher: PaymentVoucher) => {
    try {
      if (!checkPeriodOpen(voucher.date)) return;
      // A. Generate Journal Entry
      const isPaymentIn = voucher.type === 'payment_in';
      const journal = isPaymentIn
        ? createPaymentInJournalEntry(voucher, accounts)
        : createPaymentOutJournalEntry(voucher, accounts);

      // B. Update Invoices balanceDue from allocations
      const updatedInvoices = invoices.map(inv => {
        const alloc = voucher.allocations.find(a => a.invoiceId === inv.id);
        if (alloc) {
          const newBal = Math.max(0, safeSub(inv.balanceDue, alloc.amount));
          const newStatus: PaymentStatus = newBal <= 0.01 ? 'Paid' : 'Partial';
          const updatedInv: Invoice = { ...inv, balanceDue: newBal, paymentStatus: newStatus };
          idbPut('invoices', updatedInv);
          enqueueMutation('upsert_invoice', updatedInv.id, updatedInv);
          return updatedInv;
        }
        return inv;
      });

      // C. Update Party balance
      const updatedParties = parties.map(p => {
        if (p.id === voucher.partyId) {
          const newBal = isPaymentIn 
            ? safeSub(p.outstandingBalance || 0, voucher.amount)
            : safeAdd(p.outstandingBalance || 0, voucher.amount);
          const updatedParty = { ...p, outstandingBalance: newBal };
          idbPut('parties', updatedParty);
          enqueueMutation('upsert_party', updatedParty.id, updatedParty);
          return updatedParty;
        }
        return p;
      });

      // D. Persist Voucher & Journal
      await idbPut('payment_vouchers', voucher);
      await idbPut('journal_entries', journal);

      // E. Direct Cloud Persistence & Enqueue Sync
      if (user?.id) {
        insertPaymentVoucher(voucher, user.id).catch(err => console.error('Cloud voucher persist error:', err));
        for (const inv of updatedInvoices) {
          upsertInvoice(inv, user.id).catch(() => {});
        }
        for (const p of updatedParties) {
          upsertParty(p, user.id).catch(() => {});
        }
      }
      await enqueueMutation('record_payment', voucher.id, voucher);

      // F. Update State
      setPaymentVouchers(prev => [voucher, ...prev]);
      setJournalEntries(prev => [journal, ...prev]);
      setInvoices(updatedInvoices);
      setParties(updatedParties);

      setPaymentVoucherModal({ isOpen: false, defaultType: 'payment_in' });
      await refreshPendingCount();
      if (isOnline) triggerSync();
    } catch (err: any) {
      alert(`Error recording payment voucher: ${err.message}`);
    }
  };

  // 4. Cancel Invoice
  const handleConfirmCancelInvoice = async (invoice: Invoice, reason: string) => {
    try {
      if (!checkPeriodOpen(invoice.date)) return;
      // A. Reversal Journal Entry
      const origJournal = journalEntries.find(j => j.sourceId === invoice.id);
      const reversalJournal = origJournal ? createReversalJournalEntry(origJournal, reason) : null;

      // B. Reverse Inventory Stock
      const isSales = invoice.type !== 'Purchase Invoice';
      const updatedItems = items.map(item => {
        const line = invoice.items.find(i => i.name.toLowerCase() === item.name.toLowerCase() || i.itemId === item.id);
        if (line) {
          const newQty = isSales 
            ? safeAdd(item.stockQty, line.qty)
            : Math.max(0, safeSub(item.stockQty, line.qty));
          const updatedItem = { ...item, stockQty: newQty };
          idbPut('items', updatedItem);
          enqueueMutation('upsert_item', updatedItem.id, updatedItem);
          return updatedItem;
        }
        return item;
      });

      // C. Reverse Party Balance
      const updatedParties = parties.map(p => {
        if (p.id === invoice.partyId) {
          const newBal = isSales
            ? safeSub(p.outstandingBalance || 0, invoice.balanceDue)
            : safeAdd(p.outstandingBalance || 0, invoice.balanceDue);
          const updatedParty = { ...p, outstandingBalance: newBal };
          idbPut('parties', updatedParty);
          enqueueMutation('upsert_party', updatedParty.id, updatedParty);
          return updatedParty;
        }
        return p;
      });

      // D. Mark Invoice as Cancelled
      const cancelledInvoice: Invoice = {
        ...invoice,
        status: 'Cancelled',
        balanceDue: 0,
        cancelReason: reason,
        notes: invoice.notes ? `${invoice.notes} | CANCELLED: ${reason}` : `CANCELLED: ${reason}`
      };

      await idbPut('invoices', cancelledInvoice);
      if (reversalJournal) {
        await idbPut('journal_entries', reversalJournal);
      }

      if (user?.id) {
        upsertInvoice(cancelledInvoice, user.id).catch(() => {});
      }
      await enqueueMutation('cancel_invoice', cancelledInvoice.id, cancelledInvoice);

      setInvoices(prev => prev.map(i => i.id === invoice.id ? cancelledInvoice : i));
      if (reversalJournal) {
        setJournalEntries(prev => [reversalJournal, ...prev]);
      }
      setItems(updatedItems);
      setParties(updatedParties);

      setCancelInvoiceModal({ isOpen: false, invoice: null });
      await refreshPendingCount();
      if (isOnline) triggerSync();
    } catch (err: any) {
      alert(`Error cancelling invoice: ${err.message}`);
    }
  };

  // 5. Soft-Delete Invoice
  const handleSoftDeleteInvoice = async (invoice: Invoice) => {
    if (!confirm(`Are you sure you want to delete invoice ${invoice.invoiceNumber}?`)) return;
    try {
      const deletedInv: Invoice = { ...invoice, deleted: true };
      await idbPut('invoices', deletedInv);
      if (user?.id) {
        softDeleteInvoice(invoice.id).catch(() => {});
      }
      await enqueueMutation('cancel_invoice', invoice.id, deletedInv);
      setInvoices(prev => prev.filter(i => i.id !== invoice.id));
      await refreshPendingCount();
      if (isOnline) triggerSync();
    } catch (err: any) {
      alert(`Error deleting invoice: ${err.message}`);
    }
  };

  // 6. Party CRUD
  const handleSaveParty = async (party: Party) => {
    try {
      await idbPut('parties', party);
      if (user?.id) {
        upsertParty(party, user.id).catch(e => console.error('Cloud party sync error:', e));
      }
      await enqueueMutation('upsert_party', party.id, party);

      // Auto-generate opening balance journal if specified and not already existing
      if (party.openingBalance && party.openingBalance > 0 && !journalEntries.some(j => j.sourceId === party.id)) {
        const opJournal = createPartyOpeningBalanceJournalEntry(party, accounts);
        await idbPut('journal_entries', opJournal);
        await enqueueMutation('post_journal', opJournal.id, opJournal);
        setJournalEntries(prev => [opJournal, ...prev]);
      }

      setParties(prev => [party, ...prev.filter(p => p.id !== party.id)]);
      setPartyModal({ isOpen: false, type: 'customer' });
      await refreshPendingCount();
      if (isOnline) triggerSync();
    } catch (err: any) {
      alert(`Error saving party: ${err.message}`);
    }
  };

  const handleDeleteParty = async (id: string) => {
    if (!confirm('Are you sure you want to delete this party?')) return;
    try {
      await idbDelete('parties', id);
      if (user?.id) {
        deleteParty(id).catch(() => {});
      }
      await enqueueMutation('delete_party', id, {});
      setParties(prev => prev.filter(p => p.id !== id));
      await refreshPendingCount();
      if (isOnline) triggerSync();
    } catch (err: any) {
      alert(`Error deleting party: ${err.message}`);
    }
  };

  // 7. Product Master CRUD (Goods, Services, Inventory Tracking)
  const handleSaveProduct = async (productData: Partial<Product>) => {
    try {
      const product: Product = {
        id: productData.id || `prod_${Date.now()}`,
        name: productData.name || 'Unnamed Product',
        sku: productData.sku,
        barcode: productData.barcode,
        description: productData.description,
        category: productData.category || 'General',
        brand: productData.brand,
        itemType: productData.itemType || 'goods',
        unit: productData.unit || 'pcs',
        unitPrice: productData.unitPrice || 0,
        purchasePrice: productData.purchasePrice || 0,
        costPrice: productData.purchasePrice || 0,
        mrp: productData.mrp,
        wholesalePrice: productData.wholesalePrice,
        minSellingPrice: productData.minSellingPrice,
        taxInclusive: productData.taxInclusive ?? false,
        hsnCode: productData.hsnCode || '',
        gstRate: productData.gstRate || 0,
        cess: productData.cess || 0,
        openingStock: productData.openingStock || 0,
        openingStockValue: (productData.openingStock || 0) * (productData.openingStockRate || productData.purchasePrice || 0),
        openingStockRate: productData.openingStockRate || productData.purchasePrice || 0,
        openingStockDate: productData.openingStockDate || new Date().toISOString().split('T')[0],
        minStockLevel: productData.minStockLevel || 10,
        reorderLevel: productData.reorderLevel || 10,
        trackStock: productData.trackStock ?? (productData.itemType !== 'service'),
        trackBatch: productData.trackBatch ?? false,
        trackExpiry: productData.trackExpiry ?? false,
        stockQty: productData.openingStock || 0,
        warehouseId: productData.warehouseId || DEFAULT_WAREHOUSE.id,
        isActive: productData.isActive ?? true
      };

      const isNew = !items.some(i => i.id === product.id);
      await idbPut('items', product as any);
      await enqueueMutation('upsert_item', product.id, product);

      setItems(prev => [product as any, ...prev.filter(i => i.id !== product.id)]);

      if (isNew && product.openingStock > 0 && isPhysicalInventoryTracked(product.itemType, product.trackStock)) {
        const openingMovement = createStockMovement({
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          movementType: 'opening_stock',
          quantityIn: product.openingStock,
          unitCost: product.openingStockRate || product.purchasePrice || 0,
          referenceType: 'opening',
          referenceId: product.id,
          warehouseId: product.warehouseId || DEFAULT_WAREHOUSE.id,
          warehouseName: DEFAULT_WAREHOUSE.name,
          notes: 'Opening stock entry'
        });
        await idbPut('stock_movements', openingMovement);
        await enqueueMutation('upsert_stock_movement', openingMovement.id, openingMovement);
        setStockMovements(prev => [openingMovement, ...prev]);

        const updatedLayers = addValuationLayer(inventoryLayers, {
          productId: product.id,
          quantity: product.openingStock,
          unitCost: product.openingStockRate || product.purchasePrice || 0,
          purchaseDate: product.openingStockDate || new Date().toISOString().split('T')[0],
          referenceType: 'opening',
          referenceId: product.id
        });
        for (const l of updatedLayers) {
          await idbPut('inventory_layers', l);
        }
        setInventoryLayers(updatedLayers);
      }

      setProductModal({ isOpen: false, productToEdit: null });
      await refreshPendingCount();
      if (isOnline) triggerSync();
    } catch (err: any) {
      alert(`Error saving product: ${err.message}`);
    }
  };

  // Inter-Godown Stock Transfer Handler
  const handleSaveStockTransfer = async (transferData: any) => {
    try {
      const transferObj: StockTransfer = {
        id: `transfer_${Date.now()}`,
        transferNumber: `TRF-${Date.now().toString().slice(-5)}`,
        sourceWarehouseId: transferData.sourceWarehouseId,
        destinationWarehouseId: transferData.destinationWarehouseId,
        date: transferData.date,
        status: 'completed',
        notes: transferData.notes,
        lines: transferData.lines.map((l: any, idx: number) => ({
          id: `trf_line_${Date.now()}_${idx}`,
          transferId: `transfer_${Date.now()}`,
          productId: l.productId,
          productName: l.productName,
          sku: l.sku,
          quantity: l.quantity,
          unitCost: l.unitCost,
          totalValue: l.totalValue
        })),
        createdAt: new Date().toISOString()
      };

      const { newMovements, updatedTransfer } = executeStockTransfer(
        transferObj,
        stockMovements,
        items as Product[],
        warehouses
      );

      await idbPut('stock_transfers', updatedTransfer);
      await enqueueMutation('upsert_stock_transfer', updatedTransfer.id, updatedTransfer);

      for (const m of newMovements) {
        await idbPut('stock_movements', m);
        await enqueueMutation('upsert_stock_movement', m.id, m);
      }

      setStockTransfers(prev => [updatedTransfer, ...prev]);
      setStockMovements(prev => [...newMovements, ...prev]);
      setStockTransferModalOpen(false);

      await refreshPendingCount();
      if (isOnline) triggerSync();
    } catch (err: any) {
      alert(`Error transferring stock: ${err.message}`);
    }
  };

  // Physical Stock Adjustment Handler
  const handleSaveStockAdjustment = async (adjustmentData: any) => {
    try {
      const totalAdjValue = adjustmentData.lines.reduce((acc: number, l: any) => {
        const diff = safeSub(l.physicalQuantity, l.systemQuantity);
        return acc + Math.abs(diff * l.unitCost);
      }, 0);

      const adjObj: StockAdjustment = {
        id: `adj_${Date.now()}`,
        adjustmentNumber: `ADJ-${Date.now().toString().slice(-5)}`,
        warehouseId: adjustmentData.warehouseId,
        date: adjustmentData.date,
        status: 'posted',
        narration: adjustmentData.narration,
        totalAdjustmentValue: totalAdjValue,
        lines: adjustmentData.lines.map((l: any, idx: number) => {
          const diff = safeSub(l.physicalQuantity, l.systemQuantity);
          return {
            id: `adj_line_${Date.now()}_${idx}`,
            adjustmentId: `adj_${Date.now()}`,
            productId: l.productId,
            productName: l.productName,
            sku: l.sku,
            systemQuantity: l.systemQuantity,
            physicalQuantity: l.physicalQuantity,
            differenceQuantity: diff,
            unitCost: l.unitCost,
            totalValue: Math.abs(diff * l.unitCost),
            reason: l.reason
          };
        }),
        createdAt: new Date().toISOString()
      };

      const { newMovements, accountingImpact } = processStockAdjustment(
        adjObj,
        stockMovements
      );

      await idbPut('stock_adjustments', adjObj);
      await enqueueMutation('upsert_stock_adjustment', adjObj.id, adjObj);

      for (const m of newMovements) {
        await idbPut('stock_movements', m);
        await enqueueMutation('upsert_stock_movement', m.id, m);
      }

      let journal: JournalEntry | null = null;
      if (accountingImpact.lossAmount > 0 || accountingImpact.gainAmount > 0) {
        journal = createStockAdjustmentJournalEntry({
          adjustmentId: adjObj.id,
          adjustmentNumber: adjObj.adjustmentNumber,
          date: adjObj.date,
          lossAmount: accountingImpact.lossAmount,
          gainAmount: accountingImpact.gainAmount,
          accounts
        });
        if (journal) {
          await idbPut('journal_entries', journal);
        }
      }

      // Update item physical stock in state and IDB
      const updatedItems = items.map(it => {
        const line = adjObj.lines.find(l => l.productId === it.id);
        if (line) {
          const updated = { ...it, stockQty: line.physicalQuantity };
          idbPut('items', updated);
          enqueueMutation('upsert_item', updated.id, updated);
          return updated;
        }
        return it;
      });

      setStockAdjustments(prev => [adjObj, ...prev]);
      setStockMovements(prev => [...newMovements, ...prev]);
      if (journal) {
        setJournalEntries(prev => [journal, ...prev]);
      }
      setItems(updatedItems);
      setStockAdjustmentModalOpen(false);

      await refreshPendingCount();
      if (isOnline) triggerSync();
    } catch (err: any) {
      alert(`Error saving stock adjustment: ${err.message}`);
    }
  };

  // 7. Item CRUD (Legacy Support)
  const handleSaveItem = async (item: Item) => {
    try {
      await idbPut('items', item);
      if (user?.id) {
        upsertItem(item, user.id).catch(e => console.error('Cloud item sync error:', e));
      }
      await enqueueMutation('upsert_item', item.id, item);
      setItems(prev => [item, ...prev.filter(i => i.id !== item.id)]);
      setItemModalOpen(false);
      await refreshPendingCount();
      if (isOnline) triggerSync();
    } catch (err: any) {
      alert(`Error saving product: ${err.message}`);
    }
  };

  // 8. Expense CRUD
  const handleSaveExpense = async (expense: Expense, _file?: File) => {
    try {
      if (!checkPeriodOpen(expense.date)) return;
      // Double entry journal for expense
      const journal = createExpenseJournalEntry(expense, accounts);

      await idbPut('expenses', expense);
      await idbPut('journal_entries', journal);

      if (user?.id) {
        upsertExpense(expense, user.id).catch(e => console.error('Cloud expense sync error:', e));
      }
      await enqueueMutation('upsert_expense', expense.id, expense);

      setExpenses(prev => [expense, ...prev.filter(e => e.id !== expense.id)]);
      setJournalEntries(prev => [journal, ...prev]);

      setExpenseModal({ isOpen: false, expenseToEdit: null });
      await refreshPendingCount();
      if (isOnline) triggerSync();
    } catch (err: any) {
      alert(`Error saving expense: ${err.message}`);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    try {
      await idbDelete('expenses', id);
      if (user?.id) {
        deleteExpense(id).catch(() => {});
      }
      await enqueueMutation('delete_expense', id, {});
      setExpenses(prev => prev.filter(e => e.id !== id));
      await refreshPendingCount();
      if (isOnline) triggerSync();
    } catch (err: any) {
      alert(`Error deleting expense: ${err.message}`);
    }
  };

  // 9. Settings CRUD
  const handleSaveSettings = async (newProfile: BusinessProfile) => {
    try {
      await idbPut('profile', { ...newProfile, id: 'business_profile' });
      setProfile(newProfile);
      if (user?.id) {
        upsertProfile(newProfile, user.id).catch(() => {});
      }
      await refreshPendingCount();
      if (isOnline) triggerSync();
    } catch (err: any) {
      alert(`Error saving settings: ${err.message}`);
    }
  };

  // 10. Accounting Core Handlers
  const handleSaveAccount = async (account: Account) => {
    try {
      await idbPut('accounts', account);
      await enqueueMutation('upsert_account', account.id, account);
      setAccounts(prev => [account, ...prev.filter(a => a.id !== account.id)]);
      await refreshPendingCount();
      if (isOnline) triggerSync();
    } catch (err: any) {
      alert(`Error saving account: ${err.message}`);
    }
  };

  const handleDeactivateAccount = async (accountId: string) => {
    try {
      const acc = accounts.find(a => a.id === accountId);
      if (!acc) return;
      const updated = { ...acc, isActive: !acc.isActive };
      await idbPut('accounts', updated);
      await enqueueMutation('upsert_account', updated.id, updated);
      setAccounts(prev => prev.map(a => a.id === accountId ? updated : a));
      await refreshPendingCount();
      if (isOnline) triggerSync();
    } catch (err: any) {
      alert(`Error updating account status: ${err.message}`);
    }
  };

  const handleSaveJournalEntry = async (entry: JournalEntry) => {
    try {
      if (!checkPeriodOpen(entry.date)) return;
      await idbPut('journal_entries', entry);
      await enqueueMutation('post_journal', entry.id, entry);
      setJournalEntries(prev => [entry, ...prev.filter(j => j.id !== entry.id)]);
      await refreshPendingCount();
      if (isOnline) triggerSync();
    } catch (err: any) {
      alert(`Error saving journal voucher: ${err.message}`);
    }
  };

  const handleUpdatePeriods = async (updatedPeriods: AccountingPeriod[]) => {
    try {
      for (const p of updatedPeriods) {
        await idbPut('accounting_periods', p);
      }
      setAccountingPeriods(updatedPeriods);
    } catch (err: any) {
      alert(`Error updating financial periods: ${err.message}`);
    }
  };

  const handleApplyMigratedJournals = async (migrated: JournalEntry[]) => {
    try {
      for (const j of migrated) {
        await idbPut('journal_entries', j);
        await enqueueMutation('post_journal', j.id, j);
      }
      setJournalEntries(prev => [...migrated, ...prev]);
      await refreshPendingCount();
      if (isOnline) triggerSync();
      alert(`Successfully created and posted ${migrated.length} balanced journal entries.`);
    } catch (err: any) {
      alert(`Error applying migrated journals: ${err.message}`);
    }
  };

  // 11. Banking & Treasury Operations (Phase 3)
  const handleSaveReceiptVoucher = async (receiptData: any) => {
    try {
      if (!checkPeriodOpen(receiptData.date)) return;

      const voucherId = `rcpt_${Date.now()}`;
      const voucher: PaymentVoucher = {
        id: voucherId,
        voucherNumber: receiptData.voucherNumber,
        voucherType: 'receipt',
        type: 'payment_in',
        category: receiptData.category || 'customer_receipt',
        date: receiptData.date,
        partyId: receiptData.partyId,
        partyName: receiptData.partyName,
        payeeType: 'customer',
        amount: receiptData.amount,
        advanceAmount: receiptData.advanceAmount,
        paymentMode: receiptData.paymentMode,
        referenceNumber: receiptData.referenceNumber,
        destinationAccountId: receiptData.destinationAccountId,
        destinationAccountType: receiptData.destinationAccountType,
        chequeDetails: receiptData.chequeDetails,
        narration: receiptData.narration,
        status: 'completed',
        allocations: (receiptData.allocations || []).map((a: any) => ({
          invoiceId: a.invoiceId,
          amount: a.amountAllocated
        }))
      };

      const journal = createPaymentInJournalEntry(voucher, accounts);

      const updatedInvoices = invoices.map(inv => {
        const alloc = (receiptData.allocations || []).find((a: any) => a.invoiceId === inv.id);
        if (alloc) {
          const newBal = Math.max(0, safeSub(inv.balanceDue, alloc.amountAllocated));
          const newStatus: PaymentStatus = newBal <= 0.01 ? 'Paid' : 'Partial';
          const updatedInv: Invoice = { ...inv, balanceDue: newBal, paymentStatus: newStatus };
          idbPut('invoices', updatedInv);
          enqueueMutation('upsert_invoice', updatedInv.id, updatedInv);
          return updatedInv;
        }
        return inv;
      });

      const updatedParties = parties.map(p => {
        if (p.id === receiptData.partyId) {
          const newBal = safeSub(p.outstandingBalance || 0, receiptData.amount);
          const updatedParty = { ...p, outstandingBalance: newBal };
          idbPut('parties', updatedParty);
          enqueueMutation('upsert_party', updatedParty.id, updatedParty);
          return updatedParty;
        }
        return p;
      });

      if (receiptData.destinationAccountType === 'bank') {
        setBankAccounts(prev => prev.map(b => {
          if (b.id === receiptData.destinationAccountId) {
            const updatedBank = { ...b, currentBalance: safeAdd(b.currentBalance, receiptData.amount) };
            idbPut('bank_accounts', updatedBank);
            return updatedBank;
          }
          return b;
        }));
      } else {
        setCashAccounts(prev => prev.map(c => {
          if (c.id === receiptData.destinationAccountId) {
            const updatedCash = { ...c, currentBalance: safeAdd(c.currentBalance, receiptData.amount) };
            idbPut('cash_accounts', updatedCash);
            return updatedCash;
          }
          return c;
        }));
      }

      if (receiptData.paymentMode === 'cheque' && receiptData.chequeDetails) {
        const cheque: ChequeRecord = {
          id: `chq_${Date.now()}`,
          businessId: profile.id || 'default_business',
          chequeNumber: receiptData.chequeDetails.chequeNumber,
          chequeDate: receiptData.chequeDetails.chequeDate,
          partyId: receiptData.partyId,
          partyName: receiptData.partyName || 'Customer',
          amount: receiptData.amount,
          bankName: receiptData.chequeDetails.bankName,
          bankAccountId: receiptData.destinationAccountId,
          chequeType: 'received',
          status: 'received',
          voucherId: voucher.id,
          journalEntryId: journal.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await idbPut('cheque_records', cheque);
        setChequeRecords(prev => [cheque, ...prev]);
      }

      await idbPut('payment_vouchers', voucher);
      await idbPut('journal_entries', journal);
      await enqueueMutation('record_payment', voucher.id, voucher);

      setPaymentVouchers(prev => [voucher, ...prev]);
      setJournalEntries(prev => [journal, ...prev]);
      setInvoices(updatedInvoices);
      setParties(updatedParties);

      await refreshPendingCount();
      if (isOnline) triggerSync();
    } catch (err: any) {
      alert(`Error recording receipt: ${err.message}`);
    }
  };

  const handleSavePaymentOutVoucher = async (paymentData: any) => {
    try {
      if (!checkPeriodOpen(paymentData.date)) return;

      const voucherId = `pmt_${Date.now()}`;
      const voucher: PaymentVoucher = {
        id: voucherId,
        voucherNumber: paymentData.voucherNumber,
        voucherType: 'payment',
        type: 'payment_out',
        category: paymentData.category,
        date: paymentData.date,
        partyId: paymentData.partyId,
        partyName: paymentData.partyName,
        payeeType: paymentData.payeeType,
        amount: paymentData.amount,
        advanceAmount: paymentData.advanceAmount,
        paymentMode: paymentData.paymentMode,
        referenceNumber: paymentData.referenceNumber,
        sourceAccountId: paymentData.sourceAccountId,
        sourceAccountType: paymentData.sourceAccountType,
        chequeDetails: paymentData.chequeDetails,
        narration: paymentData.narration,
        status: 'completed',
        allocations: (paymentData.allocations || []).map((a: any) => ({
          invoiceId: a.invoiceId,
          amount: a.amountAllocated
        }))
      };

      const journal = createPaymentOutJournalEntry(voucher, accounts);

      const updatedInvoices = invoices.map(inv => {
        const alloc = (paymentData.allocations || []).find((a: any) => a.invoiceId === inv.id);
        if (alloc) {
          const newBal = Math.max(0, safeSub(inv.balanceDue, alloc.amountAllocated));
          const newStatus: PaymentStatus = newBal <= 0.01 ? 'Paid' : 'Partial';
          const updatedInv: Invoice = { ...inv, balanceDue: newBal, paymentStatus: newStatus };
          idbPut('invoices', updatedInv);
          enqueueMutation('upsert_invoice', updatedInv.id, updatedInv);
          return updatedInv;
        }
        return inv;
      });

      const updatedParties = parties.map(p => {
        if (p.id === paymentData.partyId) {
          const newBal = safeAdd(p.outstandingBalance || 0, paymentData.amount);
          const updatedParty = { ...p, outstandingBalance: newBal };
          idbPut('parties', updatedParty);
          enqueueMutation('upsert_party', updatedParty.id, updatedParty);
          return updatedParty;
        }
        return p;
      });

      if (paymentData.sourceAccountType === 'bank') {
        setBankAccounts(prev => prev.map(b => {
          if (b.id === paymentData.sourceAccountId) {
            const updatedBank = { ...b, currentBalance: safeSub(b.currentBalance, paymentData.amount) };
            idbPut('bank_accounts', updatedBank);
            return updatedBank;
          }
          return b;
        }));
      } else {
        setCashAccounts(prev => prev.map(c => {
          if (c.id === paymentData.sourceAccountId) {
            const updatedCash = { ...c, currentBalance: safeSub(c.currentBalance, paymentData.amount) };
            idbPut('cash_accounts', updatedCash);
            return updatedCash;
          }
          return c;
        }));
      }

      if (paymentData.paymentMode === 'cheque' && paymentData.chequeDetails) {
        const cheque: ChequeRecord = {
          id: `chq_${Date.now()}`,
          businessId: profile.id || 'default_business',
          chequeNumber: paymentData.chequeDetails.chequeNumber,
          chequeDate: paymentData.chequeDetails.chequeDate,
          partyId: paymentData.partyId,
          partyName: paymentData.partyName || 'Supplier / Beneficiary',
          amount: paymentData.amount,
          bankName: paymentData.chequeDetails.bankName,
          bankAccountId: paymentData.sourceAccountId,
          chequeType: 'issued',
          status: 'issued',
          voucherId: voucher.id,
          journalEntryId: journal.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await idbPut('cheque_records', cheque);
        setChequeRecords(prev => [cheque, ...prev]);
      }

      await idbPut('payment_vouchers', voucher);
      await idbPut('journal_entries', journal);
      await enqueueMutation('record_payment', voucher.id, voucher);

      setPaymentVouchers(prev => [voucher, ...prev]);
      setJournalEntries(prev => [journal, ...prev]);
      setInvoices(updatedInvoices);
      setParties(updatedParties);

      await refreshPendingCount();
      if (isOnline) triggerSync();
    } catch (err: any) {
      alert(`Error recording payment: ${err.message}`);
    }
  };

  const handleSaveFundTransfer = async (transferData: any) => {
    try {
      if (!checkPeriodOpen(transferData.date)) return;

      const srcB = bankAccounts.find(b => b.id === transferData.sourceAccountId);
      const srcC = cashAccounts.find(c => c.id === transferData.sourceAccountId);
      const dstB = bankAccounts.find(b => b.id === transferData.destinationAccountId);
      const dstC = cashAccounts.find(c => c.id === transferData.destinationAccountId);

      const sourceName = srcB ? srcB.bankName : (srcC?.name || 'Cash Account');
      const destName = dstB ? dstB.bankName : (dstC?.name || 'Cash Account');

      const transferId = `trf_${Date.now()}`;
      const transfer: FundTransfer = {
        id: transferId,
        businessId: profile.id || 'default_business',
        transferNumber: transferData.transferNumber,
        date: transferData.date,
        sourceAccountId: transferData.sourceAccountId,
        sourceAccountType: transferData.sourceAccountType,
        destinationAccountId: transferData.destinationAccountId,
        destinationAccountType: transferData.destinationAccountType,
        amount: transferData.amount,
        transferMode: transferData.transferMode,
        referenceNumber: transferData.referenceNumber,
        narration: transferData.narration,
        status: 'completed',
        createdAt: new Date().toISOString()
      };

      const journal = createFundTransferJournalEntry(transfer, accounts, sourceName, destName);
      transfer.journalEntryId = journal.id;

      if (transfer.sourceAccountType === 'bank') {
        setBankAccounts(prev => prev.map(b => b.id === transfer.sourceAccountId ? { ...b, currentBalance: safeSub(b.currentBalance, transfer.amount) } : b));
      } else {
        setCashAccounts(prev => prev.map(c => c.id === transfer.sourceAccountId ? { ...c, currentBalance: safeSub(c.currentBalance, transfer.amount) } : c));
      }

      if (transfer.destinationAccountType === 'bank') {
        setBankAccounts(prev => prev.map(b => b.id === transfer.destinationAccountId ? { ...b, currentBalance: safeAdd(b.currentBalance, transfer.amount) } : b));
      } else {
        setCashAccounts(prev => prev.map(c => c.id === transfer.destinationAccountId ? { ...c, currentBalance: safeAdd(c.currentBalance, transfer.amount) } : c));
      }

      await idbPut('fund_transfers', transfer);
      await idbPut('journal_entries', journal);
      await enqueueMutation('fund_transfer', transfer.id, transfer);

      setFundTransfers(prev => [transfer, ...prev]);
      setJournalEntries(prev => [journal, ...prev]);

      await refreshPendingCount();
      if (isOnline) triggerSync();
    } catch (err: any) {
      alert(`Error saving fund transfer: ${err.message}`);
    }
  };

  const handleCancelFundTransfer = async (transferId: string, reason: string) => {
    try {
      const trf = fundTransfers.find(t => t.id === transferId);
      if (!trf || trf.status === 'cancelled') return;
      if (!checkPeriodOpen(trf.date)) return;

      const origJournal = journalEntries.find(j => j.id === trf.journalEntryId || j.sourceId === trf.id);
      const reversalJournal = origJournal ? createReversalJournalEntry(origJournal, reason) : null;

      if (trf.sourceAccountType === 'bank') {
        setBankAccounts(prev => prev.map(b => b.id === trf.sourceAccountId ? { ...b, currentBalance: safeAdd(b.currentBalance, trf.amount) } : b));
      } else {
        setCashAccounts(prev => prev.map(c => c.id === trf.sourceAccountId ? { ...c, currentBalance: safeAdd(c.currentBalance, trf.amount) } : c));
      }

      if (trf.destinationAccountType === 'bank') {
        setBankAccounts(prev => prev.map(b => b.id === trf.destinationAccountId ? { ...b, currentBalance: safeSub(b.currentBalance, trf.amount) } : b));
      } else {
        setCashAccounts(prev => prev.map(c => c.id === trf.destinationAccountId ? { ...c, currentBalance: safeSub(c.currentBalance, trf.amount) } : c));
      }

      const updatedTrf = { ...trf, status: 'cancelled' as const };
      await idbPut('fund_transfers', updatedTrf);
      if (reversalJournal) await idbPut('journal_entries', reversalJournal);

      setFundTransfers(prev => prev.map(t => t.id === transferId ? updatedTrf : t));
      if (reversalJournal) setJournalEntries(prev => [reversalJournal, ...prev]);

      await refreshPendingCount();
      if (isOnline) triggerSync();
    } catch (err: any) {
      alert(`Error cancelling transfer: ${err.message}`);
    }
  };

  const handleCancelPaymentVoucher = async (voucherId: string, reason: string) => {
    try {
      const voucher = paymentVouchers.find(v => v.id === voucherId);
      if (!voucher || voucher.status === 'cancelled') return;
      if (!checkPeriodOpen(voucher.date)) return;

      const origJournal = journalEntries.find(j => j.id === voucher.journalEntryId || j.sourceId === voucher.id);
      const reversalJournal = origJournal ? createReversalJournalEntry(origJournal, reason) : null;

      const updatedInvoices = invoices.map(inv => {
        const alloc = (voucher.allocations || []).find(a => a.invoiceId === inv.id);
        if (alloc) {
          const newBal = safeAdd(inv.balanceDue, alloc.amount);
          const newStatus: PaymentStatus = newBal >= (inv.grandTotal || 0) ? 'Unpaid' : 'Partial';
          const updatedInv: Invoice = { ...inv, balanceDue: newBal, paymentStatus: newStatus };
          idbPut('invoices', updatedInv);
          return updatedInv;
        }
        return inv;
      });

      const isReceipt = voucher.voucherType === 'receipt' || voucher.type === 'payment_in';
      const updatedParties = parties.map(p => {
        if (p.id === voucher.partyId) {
          const newBal = isReceipt ? safeAdd(p.outstandingBalance || 0, voucher.amount) : safeSub(p.outstandingBalance || 0, voucher.amount);
          const updatedParty = { ...p, outstandingBalance: newBal };
          idbPut('parties', updatedParty);
          return updatedParty;
        }
        return p;
      });

      const updatedVoucher = { ...voucher, status: 'cancelled' as const, cancelledReason: reason };
      await idbPut('payment_vouchers', updatedVoucher);
      if (reversalJournal) await idbPut('journal_entries', reversalJournal);

      setPaymentVouchers(prev => prev.map(v => v.id === voucherId ? updatedVoucher : v));
      if (reversalJournal) setJournalEntries(prev => [reversalJournal, ...prev]);
      setInvoices(updatedInvoices);
      setParties(updatedParties);

      await refreshPendingCount();
      if (isOnline) triggerSync();
    } catch (err: any) {
      alert(`Error cancelling voucher: ${err.message}`);
    }
  };

  const handleChequeDeposit = async (chequeId: string, depositBankAccountId: string, depositDate: string) => {
    const updated = chequeRecords.map(c => c.id === chequeId ? {
      ...c,
      status: 'deposited' as const,
      bankAccountId: depositBankAccountId,
      depositDate,
      updatedAt: new Date().toISOString()
    } : c);
    setChequeRecords(updated);
    const item = updated.find(c => c.id === chequeId);
    if (item) await idbPut('cheque_records', item);
  };

  const handleChequeClear = async (chequeId: string, clearanceDate: string) => {
    const updated = chequeRecords.map(c => c.id === chequeId ? {
      ...c,
      status: 'cleared' as const,
      clearanceDate,
      updatedAt: new Date().toISOString()
    } : c);
    setChequeRecords(updated);
    const item = updated.find(c => c.id === chequeId);
    if (item) await idbPut('cheque_records', item);
  };

  const handleChequeBounce = async (chequeId: string, bounceDate: string, bounceReason: string, bankCharges: number) => {
    const chq = chequeRecords.find(c => c.id === chequeId);
    if (!chq) return;

    const bankAcc = bankAccounts.find(b => b.id === chq.bankAccountId);
    const bankName = bankAcc ? bankAcc.bankName : chq.bankName;

    const bounceJournal = createChequeBounceJournalEntry(
      chq,
      accounts,
      bankName,
      bankCharges
    );

    if (chq.bankAccountId && bankCharges > 0) {
      setBankAccounts(prev => prev.map(b => b.id === chq.bankAccountId ? { ...b, currentBalance: safeSub(b.currentBalance, bankCharges) } : b));
    }

    const updated = chequeRecords.map(c => c.id === chequeId ? {
      ...c,
      status: 'bounced' as const,
      bounceDate,
      bounceReason,
      bankCharges,
      updatedAt: new Date().toISOString()
    } : c);

    const updatedItem = updated.find(c => c.id === chequeId);
    if (updatedItem) await idbPut('cheque_records', updatedItem);
    await idbPut('journal_entries', bounceJournal);

    setChequeRecords(updated);
    setJournalEntries(prev => [bounceJournal, ...prev]);
  };

  const handleChequeCancel = async (chequeId: string, _cancelReason: string) => {
    const updated = chequeRecords.map(c => c.id === chequeId ? {
      ...c,
      status: 'cancelled' as const,
      updatedAt: new Date().toISOString()
    } : c);
    setChequeRecords(updated);
    const item = updated.find(c => c.id === chequeId);
    if (item) await idbPut('cheque_records', item);
  };

  const handleSaveBankStatement = async (importRecord: any, lines: BankStatementLine[]) => {
    await idbPut('bank_statements', importRecord);
    for (const l of lines) {
      await idbPut('bank_statement_lines', l);
    }
    setBankStatements(prev => [importRecord, ...prev]);
    setBankStatementLines(prev => [...lines, ...prev]);
  };

  const handleSaveReconciliation = async (recData: Partial<BankReconciliation>) => {
    const fullRec: BankReconciliation = {
      id: recData.id || `rec_${Date.now()}`,
      businessId: profile.id || 'default_business',
      bankAccountId: recData.bankAccountId || '',
      reconciliationDate: recData.reconciliationDate || new Date().toISOString().split('T')[0],
      statementClosingBalance: recData.statementClosingBalance || 0,
      bookClosingBalance: recData.bookClosingBalance || 0,
      unpresentedChequesAmount: recData.unpresentedChequesAmount || 0,
      uncreditedDepositsAmount: recData.uncreditedDepositsAmount || 0,
      bankChargesNotInBooks: recData.bankChargesNotInBooks || 0,
      interestNotInBooks: recData.interestNotInBooks || 0,
      reconciledBalance: recData.reconciledBalance || 0,
      difference: recData.difference || 0,
      isBalanced: recData.isBalanced || false,
      status: recData.status || 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await idbPut('bank_reconciliations', fullRec);
    setBankReconciliations(prev => [fullRec, ...prev.filter(r => r.id !== fullRec.id)]);
  };

  const handleSaveBankAccount = async (bankData: Partial<BankAccount>) => {
    const fullBank: BankAccount = {
      id: bankData.id || `bank_${Date.now()}`,
      businessId: profile.id || 'default_business',
      bankName: bankData.bankName || '',
      accountName: bankData.accountName || '',
      accountNumber: bankData.accountNumber || '',
      ifscCode: bankData.ifscCode,
      branchName: bankData.branchName,
      accountType: bankData.accountType || 'current',
      openingBalance: bankData.openingBalance || 0,
      openingBalanceDate: bankData.openingBalanceDate || new Date().toISOString().split('T')[0],
      currentBalance: bankData.currentBalance !== undefined ? bankData.currentBalance : (bankData.openingBalance || 0),
      overdraftLimit: bankData.overdraftLimit,
      upiId: bankData.upiId,
      isDefault: bankData.isDefault || false,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await idbPut('bank_accounts', fullBank);
    await enqueueMutation('upsert_bank_account', fullBank.id, fullBank);
    setBankAccounts(prev => [fullBank, ...prev.filter(b => b.id !== fullBank.id)]);
  };

  const handleSaveCashAccount = async (cashData: Partial<CashAccount>) => {
    const fullCash: CashAccount = {
      id: cashData.id || `cash_${Date.now()}`,
      businessId: profile.id || 'default_business',
      name: cashData.name || cashData.accountName || 'Cash',
      accountName: cashData.accountName || cashData.name || 'Cash',
      accountType: cashData.accountType || 'petty_cash',
      openingBalance: cashData.openingBalance || 0,
      openingBalanceDate: cashData.openingBalanceDate || new Date().toISOString().split('T')[0],
      currentBalance: cashData.currentBalance !== undefined ? cashData.currentBalance : (cashData.openingBalance || 0),
      isDefault: cashData.isDefault || false,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await idbPut('cash_accounts', fullCash);
    setCashAccounts(prev => [fullCash, ...prev.filter(c => c.id !== fullCash.id)]);
  };

  const getViewTitle = (tab: string) => {
    switch (tab) {
      case 'dashboard': return 'Dashboard';
      case 'sales': return 'Sales Invoices';
      case 'sales-create': return 'Create Sales Invoice';
      case 'purchase': return 'Purchase Invoices';
      case 'purchases-create': return 'Create Purchase Bill';
      case 'banking': return 'Payments & Banking';
      case 'parties': return 'Customers & Suppliers';
      case 'items': return 'Product Inventory';
      case 'accounting': return 'Accounting & Ledgers';
      case 'reports': return 'GST & Sales Reports';
      case 'expenses': return 'Expenses';
      case 'settings': return 'Settings Centre';
      default: return 'Workspace';
    }
  };

  // Fullscreen Landing Page (Unauthenticated Visitors Always See This First)
  if (currentTab === 'landing' || !session) {
    return (
      <div className="min-h-screen bg-[#FFF8EC]">
        <LandingPage 
          onEnterApp={() => {
            if (session) {
              setCurrentTab('dashboard');
            } else {
              setAuthModalMode('signup');
              setIsAuthModalOpen(true);
            }
          }} 
          onLoginClick={() => {
            setAuthModalMode('signin');
            setIsAuthModalOpen(true);
          }} 
        />
        {isAuthModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 border border-[#E8DFCF]">
              <button
                onClick={() => setIsAuthModalOpen(false)}
                className="absolute top-4 right-4 text-[#3E5368] hover:text-[#12263A] cursor-pointer"
              >
                ✕
              </button>
              <AuthScreen
                initialMode={authModalMode}
                onAuthSuccess={() => {
                  setIsAuthModalOpen(false);
                  setCurrentTab('dashboard');
                }}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#FFF8EC] text-[#12263A] antialiased overflow-hidden font-sans">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        businessName={profile.name}
        businessGstin={profile.gstin}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
      />

      {/* Main App Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Streamlined Unified Top Bar */}
        <header className="h-16 bg-white border-b border-[#E8DFCF] px-4 md:px-6 flex items-center justify-between shrink-0 z-20 shadow-2xs">
          {/* Left: View Title & Mobile Menu toggle */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 text-[#3E5368] hover:bg-[#EAF5FD] rounded-lg md:hidden cursor-pointer shrink-0"
              title="Open Navigation"
            >
              <Menu size={20} />
            </button>
            <h1 className="text-xl md:text-2xl font-bold text-[#12263A] tracking-tight truncate">
              {getViewTitle(currentTab)}
            </h1>
          </div>

          {/* Center: Wider Search Bar */}
          <div className="flex-1 max-w-md mx-4 hidden sm:block">
            <button
              onClick={() => setGlobalSearchOpen(true)}
              className="w-full flex items-center justify-between px-3.5 py-2 bg-[#FFFBF3] hover:bg-[#EAF5FD] text-[#3E5368] hover:text-[#12263A] rounded-xl text-[13px] font-medium transition cursor-pointer border border-[#E8DFCF] shadow-xs"
              title="Search records (Ctrl+K)"
            >
              <div className="flex items-center gap-2.5 truncate">
                <Search size={16} className="text-[#3E5368]" />
                <span className="truncate">Search invoices, parties, items, vouchers...</span>
              </div>
              <kbd className="px-1.5 py-0.5 text-[11px] font-mono text-[#3E5368] bg-white rounded border border-[#E8DFCF] shrink-0 ml-2">
                Ctrl+K
              </kbd>
            </button>
          </div>

          {/* Right: Quick Action ("New") & Notification Center */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Mobile search icon */}
            <button
              onClick={() => setGlobalSearchOpen(true)}
              className="sm:hidden p-2 text-[#3E5368] hover:bg-[#EAF5FD] rounded-lg cursor-pointer"
              title="Search records"
            >
              <Search size={18} />
            </button>

            {/* Quick Action "New" Button with Dropdown */}
            <div className="relative" ref={quickActionRef}>
              <button
                onClick={() => setQuickActionMenuOpen(prev => !prev)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#E0771A] hover:bg-[#B85D0F] text-white rounded-lg text-[13px] font-semibold transition cursor-pointer shadow-xs min-h-[38px]"
                title="Quick create"
              >
                <Plus size={16} />
                <span>New</span>
                <ChevronDown size={14} className={`transition-transform duration-150 ${quickActionMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {quickActionMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-[#E8DFCF] py-1.5 z-50 text-[13px]">
                  <button
                    onClick={() => { setQuickActionMenuOpen(false); setCurrentTab('sales-create'); }}
                    className="flex items-center gap-2.5 w-full px-3.5 py-2 text-left text-[#12263A] hover:bg-[#EAF5FD] transition cursor-pointer font-medium"
                  >
                    <Receipt size={16} className="text-[#1F86CC]" />
                    <span>New Sales Invoice</span>
                  </button>
                  <button
                    onClick={() => { setQuickActionMenuOpen(false); setPaymentVoucherModal({ isOpen: true, defaultType: 'payment_in' }); }}
                    className="flex items-center gap-2.5 w-full px-3.5 py-2 text-left text-[#12263A] hover:bg-[#EAF5FD] transition cursor-pointer font-medium"
                  >
                    <CreditCard size={16} className="text-[#1E8E5A]" />
                    <span>Record Payment</span>
                  </button>
                  <button
                    onClick={() => { setQuickActionMenuOpen(false); setCurrentTab('purchases-create'); }}
                    className="flex items-center gap-2.5 w-full px-3.5 py-2 text-left text-[#12263A] hover:bg-[#EAF5FD] transition cursor-pointer font-medium"
                  >
                    <ShoppingCart size={16} className="text-[#B85D0F]" />
                    <span>New Purchase Bill</span>
                  </button>
                  <div className="my-1 border-t border-[#E8DFCF]" />
                  <button
                    onClick={() => { setQuickActionMenuOpen(false); setPartyModal({ isOpen: true, type: 'customer' }); }}
                    className="flex items-center gap-2.5 w-full px-3.5 py-2 text-left text-[#12263A] hover:bg-[#EAF5FD] transition cursor-pointer font-medium"
                  >
                    <Users size={16} className="text-[#14689F]" />
                    <span>Add Customer / Supplier</span>
                  </button>
                  <button
                    onClick={() => { setQuickActionMenuOpen(false); setItemModalOpen(true); }}
                    className="flex items-center gap-2.5 w-full px-3.5 py-2 text-left text-[#12263A] hover:bg-[#EAF5FD] transition cursor-pointer font-medium"
                  >
                    <Package size={16} className="text-[#E0771A]" />
                    <span>Add Product / Item</span>
                  </button>
                </div>
              )}
            </div>

            {/* Notification Center */}
            <NotificationCenter onNavigate={(tab) => setCurrentTab(tab)} />

            {/* Authenticated User Menu with Real Sign Out */}
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen(prev => !prev)}
                className="flex items-center gap-2 h-[38px] px-2.5 rounded-lg border border-[#E8DFCF] hover:bg-[#FFFBF3] transition cursor-pointer text-xs shadow-xs"
                title="Account menu"
              >
                <div className="w-7 h-7 rounded-full bg-[#E0771A] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                  {(user?.email?.[0] || 'U').toUpperCase()}
                </div>
                <div className="text-left hidden md:block max-w-[120px] truncate">
                  <span className="font-semibold text-[#12263A] block truncate text-xs">
                    {user?.email?.split('@')[0] || 'Account'}
                  </span>
                </div>
                <ChevronDown size={14} className={`text-[#3E5368] transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-60 bg-white rounded-xl shadow-xl border border-[#E8DFCF] py-2 z-50 text-[13px] animate-in fade-in duration-100">
                  <div className="px-3.5 py-2 border-b border-[#E8DFCF]/70">
                    <p className="font-bold text-[#12263A] truncate">{profile.name || 'Bazaar-Guru Workspace'}</p>
                    <p className="text-[11px] text-[#3E5368] truncate font-mono mt-0.5">{user?.email || 'Logged in'}</p>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => { setUserMenuOpen(false); setCurrentTab('settings'); }}
                      className="flex items-center gap-2 w-full px-3.5 py-2 text-left text-[#12263A] hover:bg-[#EAF5FD] transition cursor-pointer"
                    >
                      <Settings size={15} className="text-[#1F86CC]" />
                      <span>Business Settings</span>
                    </button>
                  </div>

                  <div className="pt-1 border-t border-[#E8DFCF]/70">
                    <button
                      onClick={() => { setUserMenuOpen(false); handleSignOut(); }}
                      className="flex items-center gap-2 w-full px-3.5 py-2 text-left text-[#C23B3B] hover:bg-[#FDECEC] transition cursor-pointer font-medium"
                    >
                      <LogOut size={15} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* View Switcher Container */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#FFF8EC]">
          {currentTab === 'dashboard' && (
            <DashboardView
              invoices={invoices}
              parties={parties}
              items={items}
              expenses={expenses}
              accounts={accounts}
              journalEntries={journalEntries}
              stockMovements={stockMovements}
              onNavigate={(tab) => setCurrentTab(tab)}
              onCreateSales={() => setCurrentTab('sales-create')}
              onCreatePurchase={() => setCurrentTab('purchase-create')}
              onViewInvoice={(inv) => setDocumentViewerModal({ isOpen: true, invoice: inv })}
            />
          )}

          {currentTab === 'sales' && (
            <SalesRegisterView
              invoices={invoices}
              parties={parties}
              businessProfile={profile}
              onCreateInvoice={() => setCurrentTab('sales-create')}
              onViewInvoice={(inv) => setDocumentViewerModal({ isOpen: true, invoice: inv })}
              onEditInvoice={(_inv) => {
                alert('Invoice editing generates audit trail in GST mode.');
              }}
              onDuplicateInvoice={(inv) => {
                const duplicate: Invoice = {
                  ...inv,
                  id: `inv_${Date.now()}`,
                  invoiceNumber: `INV-${Date.now().toString().slice(-5)}`,
                  date: new Date().toISOString().split('T')[0],
                };
                handleSaveSalesInvoice(duplicate, 'Draft');
              }}
              onCancelInvoice={(inv) => setCancelInvoiceModal({ isOpen: true, invoice: inv })}
              onSoftDeleteInvoice={handleSoftDeleteInvoice}
              onRecordPayment={(party, inv) => setPaymentVoucherModal({
                isOpen: true,
                defaultType: 'payment_in',
                partyId: party.id,
                invoiceId: inv?.id
              })}
              onExportExcel={() => exportInvoicesExcel(invoices.filter(i => i.type !== 'Purchase Invoice'), 'Sales_Invoices')}
              onExportCSV={() => exportInvoicesCSV(invoices.filter(i => i.type !== 'Purchase Invoice'), 'Sales_Invoices')}
              onExportJSON={() => exportBulkInvoicesJSON(invoices.filter(i => i.type !== 'Purchase Invoice'), parties, 'Sales_Invoices')}
            />
          )}

          {currentTab === 'sales-create' && (
            <CreateSalesInvoiceView
              businessProfile={profile}
              parties={parties}
              items={items}
              onSave={handleSaveSalesInvoice}
              onCancel={() => setCurrentTab('sales')}
              onOpenPartyModal={() => setPartyModal({ isOpen: true, type: 'customer' })}
              onOpenItemModal={() => setItemModalOpen(true)}
            />
          )}

          {currentTab === 'purchase' && (
            <PurchaseRegisterView
              invoices={invoices}
              parties={parties}
              businessProfile={profile}
              onCreatePurchase={() => setCurrentTab('purchase-create')}
              onViewInvoice={(bill) => setDocumentViewerModal({ isOpen: true, invoice: bill })}
              onEditInvoice={(_bill) => {
                alert('Purchase bill editing generates audit trail in GST mode.');
              }}
              onCancelInvoice={(bill) => setCancelInvoiceModal({ isOpen: true, invoice: bill })}
              onSoftDeleteInvoice={handleSoftDeleteInvoice}
              onRecordPaymentOut={(party, bill) => setPaymentVoucherModal({
                isOpen: true,
                defaultType: 'payment_out',
                partyId: party.id,
                invoiceId: bill?.id
              })}
              onExportExcel={() => exportInvoicesExcel(invoices.filter(i => i.type === 'Purchase Invoice'), 'Purchase_Bills')}
              onExportCSV={() => exportInvoicesCSV(invoices.filter(i => i.type === 'Purchase Invoice'), 'Purchase_Bills')}
              onExportJSON={() => exportBulkInvoicesJSON(invoices.filter(i => i.type === 'Purchase Invoice'), parties, 'Purchase_Bills')}
            />
          )}

          {(currentTab === 'purchase-create' || currentTab === 'purchases-create') && (
            <CreatePurchaseBillView
              businessProfile={profile}
              parties={parties}
              items={items}
              onSave={handleSavePurchaseBill}
              onCancel={() => setCurrentTab('purchase')}
              onOpenPartyModal={() => setPartyModal({ isOpen: true, type: 'supplier' })}
              onOpenItemModal={() => setItemModalOpen(true)}
            />
          )}

          {currentTab === 'banking' && (
            <BankingView
              bankAccounts={bankAccounts}
              cashAccounts={cashAccounts}
              fundTransfers={fundTransfers}
              chequeRecords={chequeRecords}
              paymentVouchers={paymentVouchers}
              bankStatements={bankStatements}
              bankStatementLines={bankStatementLines}
              bankReconciliations={bankReconciliations}
              parties={parties}
              invoices={invoices}
              purchases={invoices.filter(i => i.type === 'Purchase Invoice')}
              journalEntries={journalEntries}
              onOpenReceiptModal={() => setReceiptModalOpen(true)}
              onOpenPaymentOutModal={() => setPaymentOutModalOpen(true)}
              onOpenTransferModal={() => setFundTransferModalOpen(true)}
              onOpenAccountModal={(kind, editingAccount) => setBankAccountModalState({ isOpen: true, kind, editingAccount })}
              onOpenChequeActionModal={(cheque) => setChequeActionModalState({ isOpen: true, cheque })}
              onOpenStatementImportModal={() => setStatementImportModalOpen(true)}
              onOpenPrintVoucherModal={(voucher) => setPrintVoucherModalState({ isOpen: true, voucher })}
              onCancelPaymentVoucher={handleCancelPaymentVoucher}
              onCancelTransfer={handleCancelFundTransfer}
              onSaveReconciliation={handleSaveReconciliation}
            />
          )}

          {currentTab === 'parties' && (
            <PartiesView
              parties={parties}
              onAddParty={(type) => setPartyModal({ isOpen: true, type })}
              onViewLedger={(party) => setPartyLedgerModal({ isOpen: true, partyId: party.id })}
              onRecordPayment={(party) => setPaymentVoucherModal({
                isOpen: true,
                defaultType: party.type === 'supplier' ? 'payment_out' : 'payment_in',
                partyId: party.id
              })}
            />
          )}

          {currentTab === 'items' && (
            <InventoryView
              products={items as Product[]}
              warehouses={warehouses}
              movements={stockMovements}
              transfers={stockTransfers}
              adjustments={stockAdjustments}
              batches={productBatches}
              onAddProduct={() => setProductModal({ isOpen: true, productToEdit: null })}
              onEditProduct={(p) => setProductModal({ isOpen: true, productToEdit: p })}
              onOpenTransferModal={() => setStockTransferModalOpen(true)}
              onOpenAdjustmentModal={() => setStockAdjustmentModalOpen(true)}
            />
          )}

          {currentTab === 'accounting' && (
            <AccountingView
              accounts={accounts}
              journalEntries={journalEntries}
              paymentVouchers={paymentVouchers}
              accountingPeriods={accountingPeriods}
              parties={parties}
              invoices={invoices}
              expenses={expenses}
              onOpenPaymentModal={(type) => setPaymentVoucherModal({ isOpen: true, defaultType: type })}
              onSaveAccount={handleSaveAccount}
              onDeactivateAccount={handleDeactivateAccount}
              onSaveJournalEntry={handleSaveJournalEntry}
              onUpdatePeriods={handleUpdatePeriods}
              onApplyMigratedJournals={handleApplyMigratedJournals}
            />
          )}

          {currentTab === 'reports' && (
            <ReportsView
              invoices={invoices}
              parties={parties}
              items={items}
              expenses={expenses}
              accounts={accounts}
              journalEntries={journalEntries}
              onExportSalesExcel={() => exportInvoicesExcel(invoices.filter(i => i.type !== 'Purchase Invoice'), 'Sales_Invoices')}
              onExportSalesCSV={() => exportInvoicesCSV(invoices.filter(i => i.type !== 'Purchase Invoice'), 'Sales_Invoices')}
              onExportPurchaseExcel={() => exportInvoicesExcel(invoices.filter(i => i.type === 'Purchase Invoice'), 'Purchase_Bills')}
              onExportPurchaseCSV={() => exportInvoicesCSV(invoices.filter(i => i.type === 'Purchase Invoice'), 'Purchase_Bills')}
            />
          )}

          {currentTab === 'expenses' && (
            <ExpensesView
              expenses={expenses}
              onAddExpense={() => setExpenseModal({ isOpen: true, expenseToEdit: null })}
              onEditExpense={(exp) => setExpenseModal({ isOpen: true, expenseToEdit: exp })}
              onDeleteExpense={handleDeleteExpense}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsView
              businessProfile={profile}
              onUpdateProfile={handleSaveSettings}
              onRestoreSuccess={() => {
                alert('Database restored successfully! Reloading...');
                window.location.reload();
              }}
            />
          )}
        </main>
      </div>

      {/* ----------------- MODALS ----------------- */}

      {/* 1. Payment Voucher Modal (Payment In / Payment Out with FIFO Allocation) */}
      <PaymentVoucherModal
        isOpen={paymentVoucherModal.isOpen}
        onClose={() => setPaymentVoucherModal({ isOpen: false, defaultType: 'payment_in' })}
        onSave={handleRecordPaymentVoucher}
        parties={parties}
        invoices={invoices}
        accounts={accounts}
        initialType={paymentVoucherModal.defaultType}
        preselectedPartyId={paymentVoucherModal.partyId}
        preselectedInvoiceId={paymentVoucherModal.invoiceId}
      />

      {/* 2. Party Ledger Statement Modal */}
      <PartyLedgerModal
        isOpen={partyLedgerModal.isOpen}
        onClose={() => setPartyLedgerModal({ isOpen: false })}
        party={parties.find(p => p.id === partyLedgerModal.partyId) || null}
        invoices={invoices}
        vouchers={paymentVouchers}
      />

      {/* 3. Invoice Cancellation Modal */}
      <CancelInvoiceModal
        invoice={cancelInvoiceModal.invoice}
        onClose={() => setCancelInvoiceModal({ isOpen: false, invoice: null })}
        onConfirm={handleConfirmCancelInvoice}
      />

      {/* 4. Multi-Theme PDF Document Viewer */}
      {documentViewerModal.invoice && (
        <DocumentViewerModal
          invoice={documentViewerModal.invoice}
          businessProfile={profile}
          parties={parties}
          onClose={() => setDocumentViewerModal({ isOpen: false, invoice: null })}
        />
      )}

      {/* 5. Party (Customer / Supplier) Modal */}
      <PartyModal
        isOpen={partyModal.isOpen}
        onClose={() => setPartyModal({ isOpen: false, type: 'customer' })}
        onSave={handleSaveParty}
        type={partyModal.type}
      />

            {/* Inventory Management Modals */}
      {productModal.isOpen && (
        <ProductModal
          isOpen={productModal.isOpen}
          editingProduct={productModal.productToEdit}
          warehouses={warehouses}
          existingSkus={items.map(i => (i as any).sku).filter(Boolean) as string[]}
          existingBarcodes={items.map(i => (i as any).barcode).filter(Boolean) as string[]}
          onClose={() => setProductModal({ isOpen: false, productToEdit: null })}
          onSave={handleSaveProduct}
        />
      )}

      {stockTransferModalOpen && (
        <StockTransferModal
          isOpen={stockTransferModalOpen}
          products={items as Product[]}
          warehouses={warehouses}
          movements={stockMovements}
          onClose={() => setStockTransferModalOpen(false)}
          onSave={handleSaveStockTransfer}
        />
      )}

      {stockAdjustmentModalOpen && (
        <StockAdjustmentModal
          isOpen={stockAdjustmentModalOpen}
          products={items as Product[]}
          warehouses={warehouses}
          movements={stockMovements}
          onClose={() => setStockAdjustmentModalOpen(false)}
          onSave={handleSaveStockAdjustment}
        />
      )}

      {/* 6. Inventory Item Modal */}
      <ItemModal
        isOpen={itemModalOpen}
        onClose={() => setItemModalOpen(false)}
        onSave={handleSaveItem}
      />

      {/* 7. Expense Modal */}
      <ExpenseModal
        isOpen={expenseModal.isOpen}
        onClose={() => setExpenseModal({ isOpen: false, expenseToEdit: null })}
        onSave={handleSaveExpense}
        expenseToEdit={expenseModal.expenseToEdit}
      />

      {/* 8. Supabase Auth Modal */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6">
            <button
              onClick={() => setIsAuthModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
            <AuthScreen
              initialMode={authModalMode}
              onAuthSuccess={() => {
                setIsAuthModalOpen(false);
                triggerSync();
              }}
            />
          </div>
        </div>
      )}

      {/* 9. Phase 3 Banking & Payments Modals */}
      <ReceiptVoucherModal
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        onSave={handleSaveReceiptVoucher}
        customers={parties.filter(p => p.type === 'customer')}
        invoices={invoices.filter(i => i.type !== 'Purchase Invoice')}
        bankAccounts={bankAccounts}
        cashAccounts={cashAccounts}
        isDateLocked={(d) => !canPostToDate(accountingPeriods, d).allowed}
      />

      <PaymentOutModal
        isOpen={paymentOutModalOpen}
        onClose={() => setPaymentOutModalOpen(false)}
        onSave={handleSavePaymentOutVoucher}
        suppliers={parties.filter(p => p.type === 'supplier')}
        purchases={invoices.filter(i => i.type === 'Purchase Invoice')}
        bankAccounts={bankAccounts}
        cashAccounts={cashAccounts}
        isDateLocked={(d) => !canPostToDate(accountingPeriods, d).allowed}
      />

      <FundTransferModal
        isOpen={fundTransferModalOpen}
        onClose={() => setFundTransferModalOpen(false)}
        onSave={handleSaveFundTransfer}
        bankAccounts={bankAccounts}
        cashAccounts={cashAccounts}
        isDateLocked={(d) => !canPostToDate(accountingPeriods, d).allowed}
      />

      <BankAccountModal
        isOpen={bankAccountModalState.isOpen}
        onClose={() => setBankAccountModalState({ isOpen: false, kind: 'bank' })}
        onSaveBank={handleSaveBankAccount}
        onSaveCash={handleSaveCashAccount}
        accountKind={bankAccountModalState.kind}
        editingAccount={bankAccountModalState.editingAccount}
      />

      <ChequeActionModal
        isOpen={chequeActionModalState.isOpen}
        onClose={() => setChequeActionModalState({ isOpen: false, cheque: null })}
        cheque={chequeActionModalState.cheque}
        bankAccounts={bankAccounts}
        onDeposit={handleChequeDeposit}
        onClear={handleChequeClear}
        onBounce={handleChequeBounce}
        onCancel={handleChequeCancel}
      />

      <StatementImportModal
        isOpen={statementImportModalOpen}
        onClose={() => setStatementImportModalOpen(false)}
        bankAccounts={bankAccounts}
        existingLines={bankStatementLines}
        onImportComplete={handleSaveBankStatement}
      />

      <PaymentVoucherPrintModal
        isOpen={printVoucherModalState.isOpen}
        onClose={() => setPrintVoucherModalState({ isOpen: false, voucher: null })}
        voucher={printVoucherModalState.voucher}
        businessName={profile.name}
        businessGstin={profile.gstin}
        businessAddress={profile.address}
      />

      {/* 10. Phase 6: Global Search & Return Modals */}
      <GlobalSearchModal
        isOpen={globalSearchOpen}
        onClose={() => setGlobalSearchOpen(false)}
        onSelectResult={(result) => {
          if (result.linkUrl) {
            const tab = result.linkUrl.replace('/', '');
            setCurrentTab(tab);
          }
        }}
      />

      <ReturnModal
        isOpen={returnModalState.isOpen}
        onClose={() => setReturnModalState({ isOpen: false, invoice: null })}
        originalInvoice={returnModalState.invoice}
        onSuccess={(returnNumber) => {
          alert(`Return processed successfully! Document generated: ${returnNumber}`);
        }}
      />
    </div>
  );
}
