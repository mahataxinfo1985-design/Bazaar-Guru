// Phase 6: Complete Business Workspace Type Definitions

export type ProductType = 'goods' | 'service' | 'non_stock' | 'composite';
export type ProductStatus = 'active' | 'inactive' | 'discontinued';

export type UOMType = 
  | 'PCS' 
  | 'KGS' 
  | 'MTR' 
  | 'BOX' 
  | 'NOS' 
  | 'PACK' 
  | 'LTR' 
  | 'BAG' 
  | 'PAIR' 
  | 'SET' 
  | 'ROLL' 
  | 'SQFT' 
  | 'HRS';

export type GSTTaxRate = 0 | 0.1 | 0.25 | 3 | 5 | 12 | 18 | 28;

export type TaxClassification = 
  | 'taxable' 
  | 'exempt' 
  | 'nil_rated' 
  | 'non_gst';

export interface HSNSACCatalogEntry {
  code: string;
  type: 'hsn' | 'sac';
  description: string;
  defaultGstRate: GSTTaxRate;
  cessRate?: number;
}

export interface CompositeItemComponent {
  itemId: string;
  itemName: string;
  quantity: number;
  unit: string;
  costEstimate?: number;
}

export interface ProductCatalogItem {
  id: string;
  businessId?: string;
  sku: string;
  barcode?: string;
  name: string;
  description?: string;
  productType: ProductType;
  brand?: string;
  category?: string;
  subcategory?: string;
  uom: UOMType;
  unit: string; // for backward compatibility with Item
  
  // Pricing Structure
  purchasePrice: number;
  unitPrice: number; // base selling price
  wholesalePrice?: number;
  retailPrice?: number;
  minSellingPrice?: number;
  mrp?: number;
  discountPercentage?: number;
  
  // Tax & Classification
  taxClassification: TaxClassification;
  hsnCode: string; // HSN or SAC code
  gstRate: GSTTaxRate;
  cessPercentage?: number;
  cessSpecificAmount?: number;
  
  // Inventory tracking
  stockQty: number;
  openingStock?: number;
  openingStockValue?: number;
  reorderLevel?: number;
  preferredSupplierId?: string;
  
  // Composite items
  components?: CompositeItemComponent[];
  
  status: ProductStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface BulkImportProductRow {
  sku: string;
  name: string;
  type?: string;
  category?: string;
  uom?: string;
  hsnCode?: string;
  gstRate?: number;
  purchasePrice?: number;
  sellingPrice?: number;
  mrp?: number;
  openingStock?: number;
  reorderLevel?: number;
  barcode?: string;
}

export interface BulkImportResult {
  totalRows: number;
  importedCount: number;
  skippedCount: number;
  errors: { row: number; sku?: string; error: string }[];
  importedItems: ProductCatalogItem[];
}

// ----------------------------------------------------
// Party Management Types
// ----------------------------------------------------

export type PartyRole = 
  | 'customer' 
  | 'supplier' 
  | 'both' 
  | 'distributor' 
  | 'retailer' 
  | 'manufacturer' 
  | 'other';

export type GSTRegistrationType = 
  | 'regular' 
  | 'composition' 
  | 'unregistered' 
  | 'consumer' 
  | 'sez';

export interface PartyAddress {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  stateCode?: string;
  pinCode: string;
  country?: string;
}

export interface PartyDocument {
  id: string;
  name: string;
  docType: 'gst_certificate' | 'pan' | 'agreement' | 'other';
  fileUrl?: string;
  uploadedAt: string;
}

export interface EnhancedParty {
  id: string;
  businessId?: string;
  legalName: string;
  displayName: string;
  name: string; // compatibility
  contactPerson?: string;
  phone: string;
  email?: string;
  partyRole: PartyRole;
  type: 'customer' | 'supplier'; // compatibility with existing Party
  
  // Tax details
  registrationType: GSTRegistrationType;
  gstin?: string;
  pan?: string;
  
  // Addresses
  billingAddress: string;
  billingAddressDetails?: PartyAddress;
  shippingAddress?: string;
  shippingAddressDetails?: PartyAddress;
  state: string;
  pinCode?: string;
  
  // Financial Terms
  creditLimit?: number;
  creditPeriodDays?: number;
  openingBalance: number;
  openingBalanceType: 'debit' | 'credit';
  currentBalance: number;
  outstandingBalance: number;
  
  // Status & Docs
  isActive: boolean;
  documents?: PartyDocument[];
  createdAt?: string;
  updatedAt?: string;
}

// ----------------------------------------------------
// Operational Workflows & Document Conversions
// ----------------------------------------------------

export type WorkflowDocType = 
  | 'quotation' 
  | 'sales_order' 
  | 'delivery_challan' 
  | 'tax_invoice' 
  | 'purchase_order' 
  | 'goods_receipt_note' 
  | 'purchase_bill' 
  | 'credit_note' 
  | 'debit_note';

export type WorkflowDocStatus = 
  | 'draft' 
  | 'open' 
  | 'partially_fulfilled' 
  | 'fulfilled' 
  | 'converted' 
  | 'posted' 
  | 'cancelled';

export interface WorkflowItemLine {
  id: string;
  itemId: string;
  name: string;
  hsnCode: string;
  orderedQty: number;
  fulfilledQty: number;
  pendingQty: number;
  unit: string;
  unitPrice: number;
  discount: number;
  discountType: 'percentage' | 'fixed';
  taxableValue: number;
  gstRate: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

export interface DocumentConversionRecord {
  conversionId: string;
  timestamp: string;
  sourceDocType: WorkflowDocType;
  sourceDocId: string;
  sourceDocNumber: string;
  targetDocType: WorkflowDocType;
  targetDocId: string;
  targetDocNumber: string;
  convertedQtyMap: Record<string, number>; // itemId -> qty converted
  userId?: string;
}

export interface Quotation {
  id: string;
  businessId?: string;
  quotationNumber: string;
  date: string;
  validUntil: string;
  partyId: string;
  partyName: string;
  items: WorkflowItemLine[];
  subtotal: number;
  discountTotal: number;
  taxableTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  grandTotal: number;
  terms?: string;
  notes?: string;
  status: WorkflowDocStatus;
  conversions?: DocumentConversionRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface SalesOrder {
  id: string;
  businessId?: string;
  orderNumber: string;
  date: string;
  expectedDeliveryDate?: string;
  partyId: string;
  partyName: string;
  quotationId?: string;
  quotationNumber?: string;
  items: WorkflowItemLine[];
  subtotal: number;
  discountTotal: number;
  taxableTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  grandTotal: number;
  terms?: string;
  notes?: string;
  status: WorkflowDocStatus;
  conversions?: DocumentConversionRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryChallan {
  id: string;
  businessId?: string;
  challanNumber: string;
  date: string;
  partyId: string;
  partyName: string;
  salesOrderId?: string;
  salesOrderNumber?: string;
  warehouseId?: string;
  items: WorkflowItemLine[];
  subtotal: number;
  taxableTotal: number;
  grandTotal: number;
  dispatchDetails?: {
    transporterName?: string;
    vehicleNumber?: string;
    lrNumber?: string;
    lrDate?: string;
  };
  status: WorkflowDocStatus;
  stockDeducted: boolean;
  conversions?: DocumentConversionRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrder {
  id: string;
  businessId?: string;
  orderNumber: string;
  date: string;
  expectedDeliveryDate?: string;
  supplierId: string;
  supplierName: string;
  items: WorkflowItemLine[];
  subtotal: number;
  discountTotal: number;
  taxableTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  grandTotal: number;
  terms?: string;
  notes?: string;
  status: WorkflowDocStatus;
  conversions?: DocumentConversionRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface GoodsReceiptNote {
  id: string;
  businessId?: string;
  grnNumber: string;
  date: string;
  supplierId: string;
  supplierName: string;
  purchaseOrderId?: string;
  purchaseOrderNumber?: string;
  warehouseId?: string;
  items: WorkflowItemLine[];
  challanOrBillNumber?: string;
  receivedBy?: string;
  status: WorkflowDocStatus;
  stockAdded: boolean;
  conversions?: DocumentConversionRecord[];
  createdAt: string;
  updatedAt: string;
}

// ----------------------------------------------------
// Returns Management
// ----------------------------------------------------

export type ReturnReason = 
  | 'defective_goods' 
  | 'damaged_in_transit' 
  | 'incorrect_item' 
  | 'customer_cancellation' 
  | 'price_difference' 
  | 'quality_issue' 
  | 'other';

export interface ReturnItemRequest {
  itemId: string;
  name: string;
  returnQty: number;
  unitPrice: number;
  gstRate: number;
  reason: ReturnReason;
  notes?: string;
  batchNumber?: string;
}

export interface ReturnProcessingResult {
  returnDocType: 'credit_note' | 'debit_note';
  returnDocId: string;
  returnDocNumber: string;
  originalInvoiceId: string;
  originalInvoiceNumber: string;
  subtotalReturned: number;
  taxReturned: number;
  totalReturned: number;
  journalEntryId: string;
  stockMovementIds: string[];
}

// ----------------------------------------------------
// Document Numbering Sequences
// ----------------------------------------------------

export interface DocumentSequenceRule {
  docType: 
    | 'INV' 
    | 'QUO' 
    | 'SO' 
    | 'DC' 
    | 'PO' 
    | 'GRN' 
    | 'PB' 
    | 'CN' 
    | 'DN' 
    | 'REC' 
    | 'PAY';
  prefix: string;
  separator: string;
  currentNumber: number;
  padding: number;
  suffix?: string;
  fyReset: boolean;
  financialYear: string; // e.g. "2024-25"
}

export interface BusinessNumberingConfig {
  id: string;
  businessId: string;
  sequences: Record<string, DocumentSequenceRule>;
}

// ----------------------------------------------------
// Role-Based Access Control (RBAC)
// ----------------------------------------------------

export type BusinessRole = 
  | 'owner' 
  | 'admin' 
  | 'accountant' 
  | 'sales_manager' 
  | 'sales_staff' 
  | 'purchase_manager' 
  | 'inventory_manager' 
  | 'cashier' 
  | 'viewer';

export type ActionPermission = 
  | 'view' 
  | 'create' 
  | 'edit' 
  | 'delete_draft' 
  | 'approve' 
  | 'post' 
  | 'cancel' 
  | 'export' 
  | 'manage_settings' 
  | 'manage_users';

export type ResourceScope = 
  | 'sales' 
  | 'purchases' 
  | 'inventory' 
  | 'banking' 
  | 'accounting' 
  | 'parties' 
  | 'reports' 
  | 'settings' 
  | 'documents';

export interface BusinessUser {
  id: string;
  businessId: string;
  email: string;
  name: string;
  role: BusinessRole;
  isActive: boolean;
  assignedWarehouseId?: string;
  createdAt: string;
}

// ----------------------------------------------------
// In-App Notification Center
// ----------------------------------------------------

export type NotificationCategory = 
  | 'low_stock' 
  | 'expiring_batch' 
  | 'overdue_receivable' 
  | 'upcoming_payable' 
  | 'credit_limit_exceeded' 
  | 'pending_quotation' 
  | 'pending_order' 
  | 'reconciliation_due' 
  | 'sync_alert' 
  | 'system';

export type NotificationSeverity = 'info' | 'warning' | 'error' | 'success';

export interface BusinessNotification {
  id: string;
  businessId?: string;
  title: string;
  message: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  isRead: boolean;
  linkUrl?: string; // route to navigate to
  entityType?: string;
  entityId?: string;
  timestamp: string;
}

// ----------------------------------------------------
// Business Document Storage Repository
// ----------------------------------------------------

export type BusinessDocCategory = 
  | 'gst_certificates' 
  | 'pan_cards' 
  | 'trade_licenses' 
  | 'contracts_agreements' 
  | 'supplier_agreements' 
  | 'tax_filings' 
  | 'bank_records' 
  | 'others';

export interface StoredBusinessDocument {
  id: string;
  businessId: string;
  title: string;
  category: BusinessDocCategory;
  tags: string[];
  filename: string;
  fileSize: number;
  mimeType: string;
  dataBase64?: string;
  notes?: string;
  expiryDate?: string;
  uploadedBy: string;
  uploadedAt: string;
}

// ----------------------------------------------------
// Global Search
// ----------------------------------------------------

export type SearchEntityType = 
  | 'invoice' 
  | 'quotation' 
  | 'sales_order' 
  | 'challan' 
  | 'purchase_order' 
  | 'purchase_bill' 
  | 'party' 
  | 'product' 
  | 'payment_voucher' 
  | 'document';

export interface GlobalSearchResult {
  id: string;
  type: SearchEntityType;
  title: string;
  subtitle: string;
  badge?: string;
  date?: string;
  amount?: number;
  linkUrl: string;
}

// ----------------------------------------------------
// Audit Trail
// ----------------------------------------------------

export interface BusinessAuditEvent {
  id: string;
  businessId: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  entityNumber?: string;
  beforeSnapshot?: Record<string, any>;
  afterSnapshot?: Record<string, any>;
  diff?: Record<string, { before: any; after: any }>;
  reason?: string;
  ipAddress?: string;
}
