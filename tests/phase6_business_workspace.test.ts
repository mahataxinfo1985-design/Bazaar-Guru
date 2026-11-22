import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { clearMemoryStores, initializeLocalDatabase, idbPut, idbGetAll } from '../src/services/storage/idb';

// Phase 6 Types
import { 
  ProductCatalogItem, HSNSACCatalogEntry, EnhancedParty, 
  Quotation, SalesOrder, DeliveryChallan, PurchaseOrder, GoodsReceiptNote,
  ReturnItemRequest, StoredBusinessDocument
} from '../src/types/workspace';
import { Invoice, Item, Party } from '../src/types';
import { Account } from '../src/types/accounting';

// Phase 6 Services
import { 
  HSN_SAC_REGISTRY, getHsnSacEntry, searchHsnSacRegistry, 
  validateProduct, calculateCompositeCost, bulkImportProductsFromCSV, exportProductsToCSV 
} from '../src/services/catalog/productCatalogService';
import { 
  validateGSTIN, extractPANFromGSTIN, validatePAN, validatePinCode, 
  validateParty, checkPartyDuplicates, verifyCreditLimit 
} from '../src/services/parties/partyService';
import { 
  calculateWorkflowDocumentTotals, createQuotation, convertQuotationToSalesOrder, 
  convertSalesOrderToChallan, convertSalesOrderToInvoice, createPurchaseOrder, convertPOToGRN 
} from '../src/services/workflows/documentWorkflowService';
import { 
  validateReturnEligibility, processSalesReturn, processPurchaseReturn 
} from '../src/services/workflows/returnService';
import { 
  getCurrentFinancialYear, formatDocumentNumber, generateNextDocumentNumber, getNumberingConfig 
} from '../src/services/settings/numberingService';
import { hasPermission, assertPermission } from '../src/services/auth/rbacService';
import { 
  generateSystemNotifications, getAllNotifications, markNotificationAsRead, markAllNotificationsAsRead 
} from '../src/services/notifications/notificationService';
import { saveBusinessDocument, getBusinessDocuments } from '../src/services/documents/documentStorageService';
import { performGlobalSearch } from '../src/services/search/globalSearchService';
import { logAuditEvent, getAuditTrail } from '../src/services/audit/auditTrailService';

describe('Phase 6: Complete Business Workspace, Product Catalogue, Settings & Workflows', () => {

  beforeEach(async () => {
    // Reset memory stores and initialize
    clearMemoryStores();
    await initializeLocalDatabase();
  });

  // =========================================================================
  // 1. PRODUCT & SERVICE CATALOGUE & TAX CLASSIFICATION
  // =========================================================================
  describe('1. Product & Service Catalogue & Tax Slabs', () => {
    it('should validate valid goods product with proper pricing hierarchy', () => {
      const validProduct: Partial<ProductCatalogItem> = {
        sku: 'LAP-001',
        name: 'Dell Precision Workstation',
        productType: 'goods',
        uom: 'PCS',
        purchasePrice: 60000,
        unitPrice: 75000,
        minSellingPrice: 70000,
        mrp: 85000,
        taxClassification: 'taxable',
        hsnCode: '8471',
        gstRate: 18,
        stockQty: 10
      };

      const result = validateProduct(validProduct);
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it('should reject product where selling price is below Minimum Selling Price (MSP)', () => {
      const invalidProduct: Partial<ProductCatalogItem> = {
        sku: 'LAP-002',
        name: 'Discount Laptop',
        purchasePrice: 50000,
        unitPrice: 48000, // below MSP
        minSellingPrice: 52000,
        mrp: 65000
      };

      const result = validateProduct(invalidProduct);
      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.some(e => e.includes('cannot be lower than Minimum Selling Price')));
    });

    it('should reject product where selling price exceeds Maximum Retail Price (MRP)', () => {
      const invalidProduct: Partial<ProductCatalogItem> = {
        sku: 'LAP-003',
        name: 'Overpriced Laptop',
        purchasePrice: 50000,
        unitPrice: 90000, // above MRP
        mrp: 80000
      };

      const result = validateProduct(invalidProduct);
      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.some(e => e.includes('cannot exceed Maximum Retail Price')));
    });

    it('should calculate estimated cost of composite product from its components', () => {
      const components = [
        { itemId: 'comp_1', itemName: 'Cabinet & SMPS', quantity: 1, unit: 'PCS', costEstimate: 2500 },
        { itemId: 'comp_2', itemName: 'Motherboard', quantity: 1, unit: 'PCS', costEstimate: 6000 },
        { itemId: 'comp_3', itemName: 'RAM 16GB', quantity: 2, unit: 'PCS', costEstimate: 3000 },
        { itemId: 'comp_4', itemName: 'SSD 1TB', quantity: 1, unit: 'PCS', costEstimate: 4500 }
      ];

      const totalCost = calculateCompositeCost(components);
      assert.strictEqual(totalCost, 2500 + 6000 + (3000 * 2) + 4500); // 19000
    });

    it('should accurately lookup HSN and SAC registry entries and tax rates', () => {
      const computerHsn = getHsnSacEntry('8471');
      assert.ok(computerHsn);
      assert.strictEqual(computerHsn.type, 'hsn');
      assert.strictEqual(computerHsn.defaultGstRate, 18);

      const consultingSac = getHsnSacEntry('9983');
      assert.ok(consultingSac);
      assert.strictEqual(consultingSac.type, 'sac');
      assert.strictEqual(consultingSac.defaultGstRate, 18);

      const goldHsn = getHsnSacEntry('7108');
      assert.ok(goldHsn);
      assert.strictEqual(goldHsn.defaultGstRate, 3); // 3% GST slab

      const searchResults = searchHsnSacRegistry('transport');
      assert.ok(searchResults.length > 0);
      assert.ok(searchResults.some(r => r.code === '9965'));
    });
  });

  // =========================================================================
  // 2. BULK PRODUCT CSV IMPORT & EXPORT
  // =========================================================================
  describe('2. Bulk Product CSV Import & Export', () => {
    it('should parse valid CSV, import products, and detect duplicate SKUs', async () => {
      const existing: ProductCatalogItem[] = [{
        id: 'p_exist',
        sku: 'EXIST-001',
        name: 'Existing Item',
        productType: 'goods',
        uom: 'PCS',
        unit: 'PCS',
        purchasePrice: 100,
        unitPrice: 150,
        taxClassification: 'taxable',
        hsnCode: '8471',
        gstRate: 18,
        stockQty: 50,
        status: 'active'
      }];

      const csvData = [
        'sku,name,type,category,uom,hsn,gstrate,purchaseprice,sellingprice,mrp,stock,barcode',
        'NEW-001,Wireless Mouse,goods,Accessories,PCS,8471,18,300,550,799,100,890123456789',
        'NEW-002,Mechanical Keyboard,goods,Accessories,PCS,8471,18,1500,2400,3200,40,890123456790',
        'EXIST-001,Duplicate Item,goods,Accessories,PCS,8471,18,100,150,200,10,890123456791' // duplicate SKU
      ].join('\n');

      const result = await bulkImportProductsFromCSV(csvData, existing);

      assert.strictEqual(result.totalRows, 3);
      assert.strictEqual(result.importedCount, 2);
      assert.strictEqual(result.skippedCount, 1);
      assert.strictEqual(result.errors.length, 1);
      assert.ok(result.errors[0].error.includes('Duplicate SKU'));
      assert.strictEqual(result.importedItems[0].sku, 'NEW-001');
      assert.strictEqual(result.importedItems[1].sku, 'NEW-002');
    });

    it('should export items to properly formatted CSV format', () => {
      const items: ProductCatalogItem[] = [{
        id: 'prod_test',
        sku: 'TEST-SKU',
        name: 'Test Product',
        productType: 'goods',
        category: 'Electronics',
        uom: 'PCS',
        unit: 'PCS',
        purchasePrice: 1000,
        unitPrice: 1500,
        mrp: 1800,
        taxClassification: 'taxable',
        hsnCode: '8471',
        gstRate: 18,
        stockQty: 25,
        status: 'active'
      }];

      const csv = exportProductsToCSV(items);
      assert.ok(csv.includes('SKU,Name,Type'));
      assert.ok(csv.includes('"TEST-SKU"'));
      assert.ok(csv.includes('"Test Product"'));
      assert.ok(csv.includes('1500'));
    });
  });

  // =========================================================================
  // 3. PARTY MANAGEMENT & INDIAN TAX COMPLIANCE
  // =========================================================================
  describe('3. Party Management & Tax Compliance', () => {
    it('should validate standard 15-character Indian GSTIN and extract PAN', () => {
      const validGstin = '27ABCDE1234F1Z5';
      assert.strictEqual(validateGSTIN(validGstin), true);

      const pan = extractPANFromGSTIN(validGstin);
      assert.strictEqual(pan, 'ABCDE1234F');
      assert.strictEqual(validatePAN(pan!), true);

      // Invalid GSTINs
      assert.strictEqual(validateGSTIN('12345'), false);
      assert.strictEqual(validateGSTIN('27ABCDE1234F1Z'), false); // 14 chars
      assert.strictEqual(validateGSTIN('99INVALIDGSTIN99'), false);
    });

    it('should validate Indian 6-digit PIN codes', () => {
      assert.strictEqual(validatePinCode('400001'), true); // Mumbai
      assert.strictEqual(validatePinCode('110001'), true); // Delhi
      assert.strictEqual(validatePinCode('012345'), false); // starts with 0
      assert.strictEqual(validatePinCode('40001'), false); // 5 digits
      assert.strictEqual(validatePinCode('4000001'), false); // 7 digits
    });

    it('should detect duplicate parties by GSTIN, PAN, or phone number', () => {
      const existingParties: EnhancedParty[] = [{
        id: 'party_1',
        name: 'Apex Traders',
        legalName: 'Apex Traders Pvt Ltd',
        displayName: 'Apex Traders',
        phone: '9876543210',
        partyRole: 'customer',
        type: 'customer',
        registrationType: 'regular',
        gstin: '27ABCDE1234F1Z5',
        pan: 'ABCDE1234F',
        billingAddress: 'Mumbai, Maharashtra',
        state: 'Maharashtra',
        openingBalance: 0,
        openingBalanceType: 'debit',
        currentBalance: 0,
        outstandingBalance: 0,
        isActive: true
      }];

      // 1. Duplicate GSTIN
      const dupGstin = checkPartyDuplicates({ id: 'party_2', gstin: '27ABCDE1234F1Z5' }, existingParties);
      assert.strictEqual(dupGstin.hasDuplicates, true);
      assert.ok(dupGstin.reasons[0].includes('GSTIN'));

      // 2. Duplicate PAN
      const dupPan = checkPartyDuplicates({ id: 'party_3', pan: 'ABCDE1234F' } as any, existingParties);
      assert.strictEqual(dupPan.hasDuplicates, true);
      assert.ok(dupPan.reasons[0].includes('PAN'));

      // 3. Duplicate Phone
      const dupPhone = checkPartyDuplicates({ id: 'party_4', phone: '9876543210' }, existingParties);
      assert.strictEqual(dupPhone.hasDuplicates, true);
      assert.ok(dupPhone.reasons[0].includes('phone number'));

      // 4. Unique party
      const unique = checkPartyDuplicates({ id: 'party_5', phone: '9123456789', gstin: '29XYZAB1234C1Z9' }, existingParties);
      assert.strictEqual(unique.hasDuplicates, false);
    });

    it('should enforce credit limit policies on customer transactions', async () => {
      const party: EnhancedParty = {
        id: 'party_credit_test',
        name: 'Credit Restricted Customer',
        legalName: 'Credit Restricted Customer',
        displayName: 'Credit Restricted Customer',
        phone: '9811122233',
        partyRole: 'customer',
        type: 'customer',
        registrationType: 'regular',
        billingAddress: 'Pune',
        state: 'Maharashtra',
        creditLimit: 50000,
        creditPeriodDays: 30,
        openingBalance: 0,
        openingBalanceType: 'debit',
        currentBalance: 0,
        outstandingBalance: 0,
        isActive: true
      };

      // When ledger balance is 0, proposed 30,000 is allowed
      const check1 = await verifyCreditLimit(party, 30000);
      assert.strictEqual(check1.allowed, true);
      assert.strictEqual(check1.availableCredit, 50000);

      // Proposed 60,000 exceeds limit of 50,000
      const check2 = await verifyCreditLimit(party, 60000);
      assert.strictEqual(check2.allowed, false);
      assert.ok(check2.reason?.includes('exceeds available credit limit'));
    });
  });

  // =========================================================================
  // 4. SALES WORKFLOWS & CONVERSIONS
  // =========================================================================
  describe('4. Sales Workflows & Controlled Conversions', () => {
    it('should create Quotation without posting accounting entries or stock movements', async () => {
      const quote = await createQuotation({
        businessId: 'biz_01',
        quotationNumber: 'QUO-001',
        date: '2025-01-15',
        validUntil: '2025-02-15',
        partyId: 'party_1',
        partyName: 'Test Customer',
        items: [{
          id: 'item_line_1',
          itemId: 'prod_1',
          name: 'Commercial Laptop',
          hsnCode: '8471',
          orderedQty: 5,
          fulfilledQty: 0,
          pendingQty: 5,
          unit: 'PCS',
          unitPrice: 50000,
          discount: 0,
          discountType: 'percentage',
          taxableValue: 250000,
          gstRate: 18,
          cgst: 22500,
          sgst: 22500,
          igst: 0,
          total: 295000
        }]
      });

      assert.strictEqual(quote.status, 'open');
      assert.strictEqual(quote.grandTotal, 295000);

      // Verify Non-Posting rule: zero stock movements and zero journal entries created
      const movements = await idbGetAll('stock_movements');
      const quoteMovements = movements.filter(m => m.referenceId === quote.id);
      assert.strictEqual(quoteMovements.length, 0);

      const journals = await idbGetAll('journal_entries');
      const quoteJournals = journals.filter(j => j.sourceId === quote.id);
      assert.strictEqual(quoteJournals.length, 0);
    });

    it('should convert Quotation to Sales Order with partial quantities and audit trail', async () => {
      const quote = await createQuotation({
        businessId: 'biz_01',
        quotationNumber: 'QUO-002',
        date: '2025-01-16',
        validUntil: '2025-02-16',
        partyId: 'party_1',
        partyName: 'Test Customer',
        items: [{
          id: 'item_line_2',
          itemId: 'prod_2',
          name: 'Laser Printer',
          hsnCode: '8471',
          orderedQty: 10,
          fulfilledQty: 0,
          pendingQty: 10,
          unit: 'PCS',
          unitPrice: 15000,
          discount: 0,
          discountType: 'percentage',
          taxableValue: 150000,
          gstRate: 18,
          cgst: 13500,
          sgst: 13500,
          igst: 0,
          total: 177000
        }]
      });

      // Partial conversion: Convert only 6 out of 10 units
      const { salesOrder, updatedQuotation } = await convertQuotationToSalesOrder(
        quote,
        'SO-001',
        { prod_2: 6 }
      );

      assert.strictEqual(salesOrder.orderNumber, 'SO-001');
      assert.strictEqual(salesOrder.items[0].orderedQty, 6);
      assert.strictEqual(salesOrder.items[0].pendingQty, 6);

      // Quotation should be partially fulfilled
      assert.strictEqual(updatedQuotation.status, 'partially_fulfilled');
      assert.strictEqual(updatedQuotation.items[0].fulfilledQty, 6);
      assert.strictEqual(updatedQuotation.items[0].pendingQty, 4);
      assert.strictEqual(updatedQuotation.conversions?.length, 1);
      assert.strictEqual(updatedQuotation.conversions![0].targetDocNumber, 'SO-001');
    });

    it('should reject conversion when requested quantity exceeds pending quantity', async () => {
      const quote = await createQuotation({
        businessId: 'biz_01',
        quotationNumber: 'QUO-003',
        date: '2025-01-17',
        validUntil: '2025-02-17',
        partyId: 'party_1',
        partyName: 'Test Customer',
        items: [{
          id: 'item_line_3',
          itemId: 'prod_3',
          name: 'Monitor',
          hsnCode: '8471',
          orderedQty: 4,
          fulfilledQty: 0,
          pendingQty: 4,
          unit: 'PCS',
          unitPrice: 10000,
          discount: 0,
          discountType: 'percentage',
          taxableValue: 40000,
          gstRate: 18,
          cgst: 3600,
          sgst: 3600,
          igst: 0,
          total: 47200
        }]
      });

      await assert.rejects(
        async () => {
          await convertQuotationToSalesOrder(quote, 'SO-OVER', { prod_3: 10 });
        },
        /Cannot convert 10.*only 4 pending/
      );
    });

    it('should convert Sales Order to Delivery Challan and deduct physical stock', async () => {
      // First save an item with initial stock in idb
      await idbPut('items', {
        id: 'prod_dc_test',
        name: 'Warehouse Stocked Item',
        hsnCode: '8471',
        unit: 'PCS',
        unitPrice: 2000,
        gstRate: 18,
        stockQty: 50
      });

      const so: SalesOrder = {
        id: 'so_test_dc',
        orderNumber: 'SO-002',
        date: '2025-01-18',
        partyId: 'party_1',
        partyName: 'Test Customer',
        items: [{
          id: 'so_item_1',
          itemId: 'prod_dc_test',
          name: 'Warehouse Stocked Item',
          hsnCode: '8471',
          orderedQty: 15,
          fulfilledQty: 0,
          pendingQty: 15,
          unit: 'PCS',
          unitPrice: 2000,
          discount: 0,
          discountType: 'percentage',
          taxableValue: 30000,
          gstRate: 18,
          cgst: 2700,
          sgst: 2700,
          igst: 0,
          total: 35400
        }],
        subtotal: 30000,
        discountTotal: 0,
        taxableTotal: 30000,
        cgstTotal: 2700,
        sgstTotal: 2700,
        igstTotal: 0,
        grandTotal: 35400,
        status: 'open',
        conversions: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const { deliveryChallan, updatedSalesOrder } = await convertSalesOrderToChallan(
        so,
        'DC-001',
        'wh_default_01',
        { prod_dc_test: 10 }
      );

      assert.strictEqual(deliveryChallan.challanNumber, 'DC-001');
      assert.strictEqual(deliveryChallan.stockDeducted, true);
      assert.strictEqual(updatedSalesOrder.items[0].fulfilledQty, 10);
      assert.strictEqual(updatedSalesOrder.items[0].pendingQty, 5);

      // Verify stock movement was recorded
      const movements = await idbGetAll('stock_movements');
      const dcMovements = movements.filter(m => m.referenceId === deliveryChallan.id);
      assert.strictEqual(dcMovements.length, 1);
      assert.strictEqual(dcMovements[0].movementType, 'outward');
      assert.strictEqual(dcMovements[0].quantityOut, 10);
    });
  });

  // =========================================================================
  // 5. PURCHASE WORKFLOWS
  // =========================================================================
  describe('5. Purchase Workflows & Goods Receipt Note (GRN)', () => {
    it('should create Purchase Order and convert to GRN adding physical stock', async () => {
      const po = await createPurchaseOrder({
        businessId: 'biz_01',
        orderNumber: 'PO-001',
        date: '2025-01-20',
        supplierId: 'supp_1',
        supplierName: 'Hardware Wholesaler',
        items: [{
          id: 'po_line_1',
          itemId: 'prod_po_test',
          name: 'Networking Switch',
          hsnCode: '8517',
          orderedQty: 20,
          fulfilledQty: 0,
          pendingQty: 20,
          unit: 'PCS',
          unitPrice: 4000,
          discount: 0,
          discountType: 'percentage',
          taxableValue: 80000,
          gstRate: 18,
          cgst: 7200,
          sgst: 7200,
          igst: 0,
          total: 94400
        }]
      });

      assert.strictEqual(po.status, 'open');

      // Convert to GRN for 12 units (partial receipt)
      const { goodsReceiptNote, updatedPurchaseOrder } = await convertPOToGRN(
        po,
        'GRN-001',
        'wh_default_01',
        { prod_po_test: 12 }
      );

      assert.strictEqual(goodsReceiptNote.grnNumber, 'GRN-001');
      assert.strictEqual(goodsReceiptNote.stockAdded, true);
      assert.strictEqual(updatedPurchaseOrder.items[0].fulfilledQty, 12);
      assert.strictEqual(updatedPurchaseOrder.items[0].pendingQty, 8);

      // Verify Inward Stock Movement
      const movements = await idbGetAll('stock_movements');
      const grnMovements = movements.filter(m => m.referenceId === goodsReceiptNote.id);
      assert.strictEqual(grnMovements.length, 1);
      assert.strictEqual(grnMovements[0].movementType, 'inward');
      assert.strictEqual(grnMovements[0].quantityIn, 12);
      assert.strictEqual(grnMovements[0].unitCost, 4000);
    });
  });

  // =========================================================================
  // 6. SALES & PURCHASE RETURNS (CREDIT & DEBIT NOTES)
  // =========================================================================
  describe('6. Sales & Purchase Returns Engine', () => {
    it('should process sales return generating Credit Note, restock, and balanced journal', async () => {
      // 1. Create original sales invoice
      const origInvoice: Invoice = {
        id: 'inv_return_test_1',
        invoiceNumber: 'INV-2025-01',
        type: 'Tax Invoice',
        date: '2025-01-10',
        dueDate: '2025-02-10',
        partyId: 'party_ret_1',
        partyType: 'customer',
        items: [{
          id: 'item_ret_1',
          itemId: 'prod_ret_1',
          name: 'Executive Office Chair',
          hsnCode: '9403',
          qty: 5,
          unit: 'PCS',
          unitPrice: 8000,
          discount: 0,
          discountType: 'percentage',
          taxableValue: 40000,
          gstRate: 18,
          cgst: 3600,
          sgst: 3600,
          igst: 0,
          total: 47200
        }],
        subtotal: 40000,
        discount: 0,
        taxableAmount: 40000,
        cgst: 3600,
        sgst: 3600,
        igst: 0,
        cess: 0,
        roundOff: 0,
        grandTotal: 47200,
        amountInWords: '',
        paymentMode: 'Credit',
        amountReceived: 0,
        balanceDue: 47200,
        paymentStatus: 'Unpaid',
        status: 'Active',
        createdAt: '2025-01-10T10:00:00Z',
        updatedAt: '2025-01-10T10:00:00Z',
        auditTrail: []
      };

      await idbPut('invoices', origInvoice);

      // 2. Validate return: Return 2 defective units
      const returnReq: ReturnItemRequest[] = [{
        itemId: 'prod_ret_1',
        name: 'Executive Office Chair',
        returnQty: 2,
        unitPrice: 8000,
        gstRate: 18,
        reason: 'defective_goods'
      }];

      const eligibility = await validateReturnEligibility(origInvoice, returnReq);
      assert.strictEqual(eligibility.isEligible, true);

      // 3. Process Sales Return
      const result = await processSalesReturn(
        origInvoice,
        'CN-001',
        returnReq,
        'wh_default_01',
        'Acme Corp'
      );

      assert.strictEqual(result.returnDocType, 'credit_note');
      assert.strictEqual(result.subtotalReturned, 16000); // 2 * 8000
      assert.strictEqual(result.taxReturned, 2880); // 18% of 16000 = 2880
      assert.strictEqual(result.totalReturned, 18880);

      // Verify restock movement
      assert.strictEqual(result.stockMovementIds.length, 1);
      const movements = await idbGetAll('stock_movements');
      const cnMovement = movements.find(m => m.id === result.stockMovementIds[0]);
      assert.ok(cnMovement);
      assert.strictEqual(cnMovement?.movementType, 'inward'); // returned into stock
      assert.strictEqual(cnMovement?.quantityIn, 2);

      // Verify balanced Credit Note Journal Entry
      const journals = await idbGetAll('journal_entries');
      const cnJournal = journals.find(j => j.id === result.journalEntryId);
      assert.ok(cnJournal);
      assert.strictEqual(cnJournal?.totalDebit, cnJournal?.totalCredit);
      assert.strictEqual(cnJournal?.totalDebit, 18880);

      // Verify original invoice audit trail was appended
      const updatedOrig = (await idbGetAll('invoices')).find(i => i.id === origInvoice.id);
      assert.ok(updatedOrig?.auditTrail.some(a => a.action.includes('Sales Return processed')));
    });

    it('should reject return quantity when it exceeds original eligible invoice quantity', async () => {
      const origInvoice: Invoice = {
        id: 'inv_excess_test',
        invoiceNumber: 'INV-2025-02',
        type: 'Tax Invoice',
        date: '2025-01-11',
        dueDate: '2025-02-11',
        partyId: 'party_ret_2',
        partyType: 'customer',
        items: [{
          id: 'item_ret_2',
          itemId: 'prod_ret_2',
          name: 'Desk Lamp',
          hsnCode: '9405',
          qty: 3,
          unit: 'PCS',
          unitPrice: 1200,
          discount: 0,
          discountType: 'percentage',
          taxableValue: 3600,
          gstRate: 18,
          cgst: 324,
          sgst: 324,
          igst: 0,
          total: 4248
        }],
        subtotal: 3600,
        discount: 0,
        taxableAmount: 3600,
        cgst: 324,
        sgst: 324,
        igst: 0,
        cess: 0,
        roundOff: 0,
        grandTotal: 4248,
        amountInWords: '',
        paymentMode: 'Credit',
        amountReceived: 0,
        balanceDue: 4248,
        paymentStatus: 'Unpaid',
        status: 'Active',
        createdAt: '2025-01-11T10:00:00Z',
        updatedAt: '2025-01-11T10:00:00Z',
        auditTrail: []
      };

      await idbPut('invoices', origInvoice);

      // Attempt returning 5 units when only 3 were purchased
      const excessReq: ReturnItemRequest[] = [{
        itemId: 'prod_ret_2',
        name: 'Desk Lamp',
        returnQty: 5,
        unitPrice: 1200,
        gstRate: 18,
        reason: 'customer_cancellation'
      }];

      const eligibility = await validateReturnEligibility(origInvoice, excessReq);
      assert.strictEqual(eligibility.isEligible, false);
      assert.ok(eligibility.errors[0].includes('Eligible quantity is 3'));
    });
  });

  // =========================================================================
  // 7. DOCUMENT NUMBERING SEQUENCES
  // =========================================================================
  describe('7. Document Numbering Engine', () => {
    it('should format document number with prefix, padding, and financial year', () => {
      const rule = {
        docType: 'INV' as const,
        prefix: 'INV',
        separator: '-',
        currentNumber: 42,
        padding: 4,
        fyReset: true,
        financialYear: '2024-25'
      };

      const formatted = formatDocumentNumber(rule, 42);
      assert.strictEqual(formatted, 'INV-0042-2024-25');
    });

    it('should compute correct Indian Financial Year (April 1 to March 31)', () => {
      // April 2024 -> 2024-25
      const aprilDate = new Date(2024, 3, 15);
      assert.strictEqual(getCurrentFinancialYear(aprilDate), '2024-25');

      // December 2024 -> 2024-25
      const decDate = new Date(2024, 11, 20);
      assert.strictEqual(getCurrentFinancialYear(decDate), '2024-25');

      // March 2025 -> 2024-25
      const marDate = new Date(2025, 2, 31);
      assert.strictEqual(getCurrentFinancialYear(marDate), '2024-25');

      // May 2025 -> 2025-26
      const mayDate = new Date(2025, 4, 1);
      assert.strictEqual(getCurrentFinancialYear(mayDate), '2025-26');
    });

    it('should generate and increment consecutive document numbers atomically', async () => {
      const num1 = await generateNextDocumentNumber('INV');
      const num2 = await generateNextDocumentNumber('INV');

      assert.ok(num1.startsWith('INV-'));
      assert.ok(num2.startsWith('INV-'));
      assert.notStrictEqual(num1, num2);
    });
  });

  // =========================================================================
  // 8. ROLE-BASED ACCESS CONTROL (RBAC)
  // =========================================================================
  describe('8. Role-Based Access Control (RBAC)', () => {
    it('should grant owner access to all actions and resources', () => {
      assert.strictEqual(hasPermission('owner', 'cancel', 'sales'), true);
      assert.strictEqual(hasPermission('owner', 'manage_users', 'settings'), true);
      assert.strictEqual(hasPermission('owner', 'post', 'accounting'), true);
    });

    it('should allow sales staff to view and create sales, but deny accounting or deletion', () => {
      assert.strictEqual(hasPermission('sales_staff', 'view', 'sales'), true);
      assert.strictEqual(hasPermission('sales_staff', 'create', 'sales'), true);
      assert.strictEqual(hasPermission('sales_staff', 'cancel', 'sales'), false);
      assert.strictEqual(hasPermission('sales_staff', 'view', 'accounting'), false);
    });

    it('should throw descriptive authorization error when permission is denied', () => {
      assert.throws(
        () => assertPermission('cashier', 'manage_settings', 'settings'),
        /Unauthorized: Role 'cashier' lacks permission to perform 'manage_settings'/
      );
    });
  });

  // =========================================================================
  // 9. NOTIFICATIONS & REMINDERS
  // =========================================================================
  describe('9. In-App Notification Center', () => {
    it('should scan database and trigger alerts for low stock and overdue receivables', async () => {
      // Seed low stock item
      await idbPut('items', {
        id: 'item_crit_low',
        name: 'Urgent Low Stock Widget',
        hsnCode: '8471',
        unit: 'PCS',
        unitPrice: 100,
        gstRate: 18,
        stockQty: 2, // below threshold 10
        reorderLevel: 10
      });

      // Seed overdue invoice
      await idbPut('invoices', {
        id: 'inv_overdue_test',
        invoiceNumber: 'INV-OVERDUE-01',
        type: 'Tax Invoice',
        date: '2024-11-01',
        dueDate: '2024-12-01', // in the past
        partyId: 'party_1',
        partyType: 'customer',
        items: [],
        subtotal: 10000,
        discount: 0,
        taxableAmount: 10000,
        cgst: 900,
        sgst: 900,
        igst: 0,
        cess: 0,
        roundOff: 0,
        grandTotal: 11800,
        amountInWords: '',
        paymentMode: 'Credit',
        amountReceived: 0,
        balanceDue: 11800,
        paymentStatus: 'Unpaid',
        status: 'Active',
        createdAt: '2024-11-01T10:00:00Z',
        updatedAt: '2024-11-01T10:00:00Z',
        auditTrail: []
      });

      const notifs = await generateSystemNotifications();
      assert.ok(notifs.some(n => n.category === 'low_stock' && n.entityId === 'item_crit_low'));
      assert.ok(notifs.some(n => n.category === 'overdue_receivable' && n.entityId === 'inv_overdue_test'));

      // Mark notification as read
      const all = await getAllNotifications();
      assert.ok(all.length >= 2);
      await markNotificationAsRead(all[0].id);

      const refreshed = await getAllNotifications();
      const readOne = refreshed.find(n => n.id === all[0].id);
      assert.strictEqual(readOne?.isRead, true);

      // Mark all read
      await markAllNotificationsAsRead();
      const afterAllRead = await getAllNotifications();
      assert.ok(afterAllRead.every(n => n.isRead));
    });
  });

  // =========================================================================
  // 10. BUSINESS DOCUMENT STORAGE
  // =========================================================================
  describe('10. Business Document Storage', () => {
    it('should save and retrieve company compliance documents', async () => {
      const doc = await saveBusinessDocument({
        businessId: 'biz_01',
        title: 'GST Registration Certificate - REG-06',
        category: 'gst_certificates',
        tags: ['gst', 'legal', 'tax'],
        filename: 'gst_reg_06.pdf',
        fileSize: 245000, // 245 KB
        mimeType: 'application/pdf',
        uploadedBy: 'Ashutosh Mishra'
      });

      assert.ok(doc.id.startsWith('doc_'));
      assert.strictEqual(doc.category, 'gst_certificates');

      const retrieved = await getBusinessDocuments('gst_certificates');
      assert.ok(retrieved.some(d => d.id === doc.id));
    });

    it('should reject documents exceeding 5MB size limit', async () => {
      await assert.rejects(
        async () => {
          await saveBusinessDocument({
            businessId: 'biz_01',
            title: 'Massive Audit Dump',
            category: 'others',
            tags: [],
            filename: 'huge.pdf',
            fileSize: 8 * 1024 * 1024, // 8 MB
            mimeType: 'application/pdf',
            uploadedBy: 'User'
          });
        },
        /exceeds 5MB limit/
      );
    });
  });

  // =========================================================================
  // 11. GLOBAL SEARCH OMNIBAR
  // =========================================================================
  describe('11. Global Search Engine', () => {
    it('should find entities across invoices, parties, items, and vouchers', async () => {
      // Seed an item with distinctive SKU
      await idbPut('items', {
        id: 'item_search_1',
        name: 'Ergonomic Standing Desk',
        hsnCode: '9403',
        unit: 'PCS',
        unitPrice: 22000,
        gstRate: 18,
        stockQty: 8,
        sku: 'DESK-ERG-99'
      } as any);

      // Search by SKU
      const skuResults = await performGlobalSearch('DESK-ERG');
      assert.ok(skuResults.length > 0);
      assert.strictEqual(skuResults[0].type, 'product');
      assert.ok(skuResults[0].title.includes('Standing Desk'));

      // Search by partial text
      const nameResults = await performGlobalSearch('Ergonomic');
      assert.ok(nameResults.length > 0);
      assert.strictEqual(nameResults[0].id, 'item_search_1');
    });
  });

  // =========================================================================
  // 12. AUDIT TRAIL
  // =========================================================================
  describe('12. Audit Trail Engine', () => {
    it('should append immutable audit events and support filtered queries', async () => {
      const event = await logAuditEvent({
        businessId: 'biz_01',
        userId: 'usr_admin',
        userName: 'Admin User',
        action: 'UPDATE_CREDIT_LIMIT',
        entityType: 'party',
        entityId: 'party_apex_01',
        entityNumber: 'APEX-01',
        beforeSnapshot: { creditLimit: 25000 },
        afterSnapshot: { creditLimit: 50000 },
        reason: 'Annual credit review approved'
      });

      assert.ok(event.id.startsWith('audit_'));
      assert.ok(event.timestamp);

      const trail = await getAuditTrail({ entityType: 'party', entityId: 'party_apex_01' });
      assert.ok(trail.length > 0);
      assert.strictEqual(trail[0].action, 'UPDATE_CREDIT_LIMIT');
      assert.strictEqual(trail[0].reason, 'Annual credit review approved');
    });
  });
});
