import React, { useState, useEffect, useCallback } from 'react';
import { 
  Menu, Wifi, WifiOff, RefreshCw, Plus, CreditCard, Search, RotateCcw
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
  DEFAULT_BUSINESS_PROFILE 
} from './services/storage/idb';
import { 
  enqueueMutation, syncPendingMutations, getPendingMutations 
} from './services/storage/syncQueue';

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
import { BankingView } from './features/banking/BankingView';
import ReportsView from './features/reports/ReportsView';
import ExpensesView from './features/expenses/ExpensesView';
import SettingsView from './features/settings/SettingsView';
import SyncBackupHub from './features/settings/SyncBackupHub';
import SyncStatusPill from './components/SyncStatusPill';
import NotificationCenter from './components/NotificationCenter';
import GlobalSearchModal from './components/modals/GlobalSearchModal';
import ReturnModal from './components/modals/ReturnModal';
import { getPendingOutboxOperations, recoverDanglingOperations } from './services/sync/outboxEngine';
import { getUnresolvedConflicts } from './services/sync/conflictService';
import { registerCurrentDevice } from './services/sync/deviceService';

export default function App() {
  // Navigation & UI State
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [conflictCount, setConflictCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [user, setUser] = useState<any>(null);

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
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(DEFAULT_BANK_ACCOUNTS);
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>(DEFAULT_CASH_ACCOUNTS);
  const [fundTransfers, setFundTransfers] = useState<FundTransfer[]>([]);
  const [chequeRecords, setChequeRecords] = useState<ChequeRecord[]>([]);
  const [bankStatements, setBankStatements] = useState<BankStatementImport[]>([]);
  const [bankStatementLines, setBankStatementLines] = useState<BankStatementLine[]>([]);
  const [bankReconciliations, setBankReconciliations] = useState<BankReconciliation[]>([]);

  // Modals State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
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
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setGlobalSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  // Initialize Local IndexedDB on startup
  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      try {
        const localData = await initializeLocalDatabase();
        if (!isMounted) return;

        setInvoices(localData.invoices);
        setParties(localData.parties);
        setItems(localData.items);
        setExpenses(localData.expenses);
        setProfile(localData.profile || DEFAULT_BUSINESS_PROFILE);
        setAccounts(localData.accounts && localData.accounts.length > 0 ? localData.accounts : DEFAULT_CHART_OF_ACCOUNTS);
        setJournalEntries(localData.journalEntries);
        setPaymentVouchers(localData.paymentVouchers);
        setAccountingPeriods(localData.accountingPeriods && localData.accountingPeriods.length > 0 ? localData.accountingPeriods : DEFAULT_ACCOUNTING_PERIODS);

        // Banking & Treasury
        if (localData.bankAccounts && localData.bankAccounts.length > 0) setBankAccounts(localData.bankAccounts);
        if (localData.cashAccounts && localData.cashAccounts.length > 0) setCashAccounts(localData.cashAccounts);
        if (localData.fundTransfers) setFundTransfers(localData.fundTransfers);
        if (localData.chequeRecords) setChequeRecords(localData.chequeRecords);
        if (localData.bankStatements) setBankStatements(localData.bankStatements);
        if (localData.bankStatementLines) setBankStatementLines(localData.bankStatementLines);
        if (localData.bankReconciliations) setBankReconciliations(localData.bankReconciliations);

        // Inventory & Stock Tracking
        if (localData.warehouses && localData.warehouses.length > 0) setWarehouses(localData.warehouses);
        if (localData.stockMovements) setStockMovements(localData.stockMovements);
        if (localData.inventoryLayers) setInventoryLayers(localData.inventoryLayers);
        if (localData.productBatches) setProductBatches(localData.productBatches);
        if (localData.stockTransfers) setStockTransfers(localData.stockTransfers);
        if (localData.stockAdjustments) setStockAdjustments(localData.stockAdjustments);


        // Phase 5: Startup recovery & Device Registration
        await recoverDanglingOperations();
        await registerCurrentDevice(localData.profile?.id || 'primary_business');

        await refreshPendingCount();
      } catch (err) {
        console.error('Failed to bootstrap local database:', err);
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
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (isMounted) setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setUser(session?.user ?? null);
        if (session?.user) triggerSync();
      }
    });

    return () => {
      isMounted = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      subscription.unsubscribe();
    };
  }, [refreshPendingCount]);

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

      // G. Enqueue Sync
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

      // F. Enqueue Sync
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

      // E. Enqueue Sync
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

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 antialiased overflow-hidden font-sans">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        businessName={profile.name}
        onLogout={async () => {
          await supabase.auth.signOut();
          setUser(null);
        }}
        onLoginClick={() => setIsAuthModalOpen(true)}
        isAuthenticated={!!user}
      />

      {/* Main App Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-6 flex items-center justify-between shrink-0 shadow-xs z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg md:hidden"
            >
              <Menu size={20} />
            </button>
            <div>
              <h2 className="text-base font-bold text-slate-800 leading-tight">
                {profile.name || 'Bazaar-Guru GST Workspace'}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  FY 2024-25 | GSTIN: {profile.gstin || 'Unregistered'}
                </span>
                <span className="inline-flex items-center px-1.5 py-0.2 text-[9px] font-bold rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Double-Entry Active
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions & Status Indicators */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* Global Search Omnibar Trigger */}
            <button
              onClick={() => setGlobalSearchOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-medium transition cursor-pointer border border-slate-200"
              title="Search records (Ctrl+K)"
            >
              <Search size={14} className="text-slate-400" />
              <span className="hidden lg:inline text-slate-500">Search anything...</span>
              <kbd className="hidden lg:inline-block px-1 py-0.2 text-[9px] font-mono text-slate-500 bg-white rounded border border-slate-300">
                Ctrl+K
              </kbd>
            </button>

            {/* Notification Center */}
            <NotificationCenter onNavigate={(tab) => setCurrentTab(tab)} />

            {/* Sync & Connectivity Status */}
            <SyncStatusPill
              isOnline={isOnline}
              isSyncing={isSyncing}
              pendingCount={pendingSyncCount}
              conflictCount={conflictCount}
              onSyncClick={triggerSync}
              onOpenHub={() => setCurrentTab('sync-backup')}
            />

            {/* Quick Action: New Sale */}
            <button
              onClick={() => setCurrentTab('sales-create')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm transition cursor-pointer"
            >
              <Plus size={14} />
              <span className="hidden sm:inline">New Sale</span>
            </button>

            {/* Quick Action: Payment Voucher */}
            <button
              onClick={() => setPaymentVoucherModal({ isOpen: true, defaultType: 'payment_in' })}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition cursor-pointer"
            >
              <CreditCard size={14} />
              <span className="hidden sm:inline">Record Payment</span>
            </button>
          </div>
        </header>

        {/* View Switcher Container */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50">
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

          {currentTab === 'purchase-create' && (
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

          {currentTab === 'sync-backup' && (
            <SyncBackupHub
              isOnline={isOnline}
              onTriggerSync={triggerSync}
              onRestoreCompleted={() => {
                alert('Dataset restored successfully! Reloading...');
                window.location.reload();
              }}
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
