import { BusinessProfile, Party, Item, Invoice } from '../types';

export const DEFAULT_BUSINESS_PROFILE: BusinessProfile = {
  name: "Aditya Retail & Distribution Private Limited",
  gstin: "27AAACA1234F1Z5", // Maharashtra (27)
  address: "Plot B-12, Wagle Industrial Estate, Thane West, Mumbai, Maharashtra",
  state: "Maharashtra",
  phone: "+91 98765 43210",
  email: "billing@adityaretail.in",
  bankName: "State Bank of India",
  bankAccount: "30512345678",
  bankIFSC: "SBIN0004561",
  bankBranch: "Thane East, Mumbai",
  termsTemplate: "1. Goods once sold will not be returned or exchanged.\n2. Please mention Invoice Number on payment transfers.\n3. Payment is due within standard terms.\n4. Disputes, if any, shall be subject to Mumbai jurisdiction.",
  upiId: "adityaretail@upi"
};

export const MOCK_PARTIES: Party[] = [
  {
    id: "party_1",
    name: "Ramesh Kirana Store (Intrastate Customer)",
    phone: "+91 99887 76655",
    email: "ramesh.kirana@gmail.com",
    gstin: "27BBBRK5678M1ZS", // Maharashtra (Intrastate)
    billingAddress: "Shop No. 4, Shanti Nagar, Andheri East, Mumbai, Maharashtra",
    shippingAddress: "Shop No. 4, Shanti Nagar, Andheri East, Mumbai, Maharashtra",
    state: "Maharashtra",
    outstandingBalance: 12450.00,
    type: "customer"
  },
  {
    id: "party_2",
    name: "Apex Electronics & Appliances (Interstate Customer)",
    phone: "+91 91234 56789",
    email: "accounts@apexelectronics.co.in",
    gstin: "29AAAAP8901D1Z1", // Karnataka (Interstate)
    billingAddress: "56, Brigade Road, Ashok Nagar, Bengaluru, Karnataka",
    shippingAddress: "Warehouse 2A, Hosur Road, Bengaluru, Karnataka",
    state: "Karnataka",
    outstandingBalance: 45000.00,
    type: "customer"
  },
  {
    id: "party_3",
    name: "Sharma ji Dry Fruits (Unregistered Customer)",
    phone: "+91 98989 89898",
    billingAddress: "Gali 5, Sadar Bazar, Delhi",
    state: "Delhi",
    outstandingBalance: 0.00,
    type: "customer"
  },
  {
    id: "party_4",
    name: "Bharat Wholesalers & Distributors",
    phone: "+91 98761 23456",
    email: "info@bharatwholesale.com",
    gstin: "27CCCBW4321N1ZH", // Maharashtra
    billingAddress: "APMC Market-II, Vashi, Navi Mumbai, Maharashtra",
    state: "Maharashtra",
    outstandingBalance: -65000.00, // Negative balance indicates we owe supplier
    type: "supplier"
  },
  {
    id: "party_5",
    name: "Standard Graphics & Prints",
    phone: "+91 93456 78901",
    email: "billing@stdgraphics.com",
    gstin: "07AAASG9999M1Z9", // Delhi (Interstate)
    billingAddress: "Okhla Industrial Area Phase-III, New Delhi",
    state: "Delhi",
    outstandingBalance: -1500.00,
    type: "supplier"
  }
];

export const MOCK_ITEMS: Item[] = [
  {
    id: "item_1",
    name: "Tata Salt 1kg",
    hsnCode: "2501",
    unit: "PCS",
    unitPrice: 24.50,
    mrp: 28.00,
    gstRate: 0, // Exempt
    stockQty: 450
  },
  {
    id: "item_2",
    name: "Fortune Refined Mustard Oil 1L",
    hsnCode: "1514",
    unit: "PCS",
    unitPrice: 155.00,
    mrp: 175.00,
    gstRate: 5,
    stockQty: 180
  },
  {
    id: "item_3",
    name: "Cadbury Dairy Milk Silk 150g",
    hsnCode: "1806",
    unit: "PCS",
    unitPrice: 105.00,
    mrp: 120.00,
    gstRate: 18,
    stockQty: 95
  },
  {
    id: "item_4",
    name: "Milton Thermo Steel Bottle 1L",
    hsnCode: "9617",
    unit: "PCS",
    unitPrice: 720.00,
    mrp: 850.00,
    gstRate: 18,
    stockQty: 42
  },
  {
    id: "item_5",
    name: "Gold Flake Kings (Pack of 10)",
    hsnCode: "2402",
    unit: "BOX",
    unitPrice: 160.00,
    mrp: 180.00,
    gstRate: 28,
    stockQty: 300
  },
  {
    id: "item_6",
    name: "Professional GST Filing Service",
    hsnCode: "9983",
    unit: "HRS",
    unitPrice: 1500.00,
    mrp: 1500.00,
    gstRate: 18,
    stockQty: 9999
  },
  {
    id: "item_7",
    name: "Aashirvaad Shudh Chakki Atta 10kg",
    hsnCode: "1101",
    unit: "PCS",
    unitPrice: 410.00,
    mrp: 460.00,
    gstRate: 5,
    stockQty: 120
  }
];

export const MOCK_INVOICES: Invoice[] = [
  {
    id: "inv_1",
    invoiceNumber: "SAL-2026-0001",
    poNumber: "PO-7788",
    type: "Tax Invoice",
    date: "2026-06-15",
    dueDate: "2026-06-30",
    partyId: "party_1",
    partyType: "customer",
    items: [
      {
        id: "li_1",
        name: "Fortune Refined Mustard Oil 1L",
        hsnCode: "1514",
        qty: 10,
        unit: "PCS",
        unitPrice: 155.00,
        mrp: 175.00,
        discount: 0,
        discountType: "percentage",
        taxableValue: 1550.00,
        gstRate: 5,
        cgst: 38.75,
        sgst: 38.75,
        igst: 0,
        total: 1627.50
      },
      {
        id: "li_2",
        name: "Cadbury Dairy Milk Silk 150g",
        hsnCode: "1806",
        qty: 5,
        unit: "PCS",
        unitPrice: 105.00,
        mrp: 120.00,
        discount: 5, // 5% discount
        discountType: "percentage",
        taxableValue: 498.75,
        gstRate: 18,
        cgst: 44.89,
        sgst: 44.89,
        igst: 0,
        total: 588.53
      }
    ],
    subtotal: 2075.00,
    discount: 26.25,
    taxableAmount: 2048.75,
    cgst: 83.64,
    sgst: 83.64,
    igst: 0,
    cess: 0,
    roundOff: -0.03,
    grandTotal: 2216,
    amountInWords: "Rupees Two Thousand Two Hundred and Sixteen Only",
    paymentMode: "UPI",
    amountReceived: 2216,
    balanceDue: 0,
    paymentStatus: "Paid",
    notes: "Thank you for shopping with us!",
    terms: "1. Goods once sold will not be returned.\n2. Standard terms apply.",
    status: "Active",
    createdAt: "2026-06-15T10:00:00Z",
    updatedAt: "2026-06-15T10:00:00Z",
    auditTrail: [
      {
        timestamp: "2026-06-15T10:00:00Z",
        action: "Invoice Created",
        user: "billing@adityaretail.in"
      }
    ]
  },
  {
    id: "inv_2",
    invoiceNumber: "SAL-2026-0002",
    type: "Tax Invoice",
    date: "2026-06-18",
    dueDate: "2026-07-03",
    partyId: "party_2",
    partyType: "customer",
    items: [
      {
        id: "li_3",
        name: "Milton Thermo Steel Bottle 1L",
        hsnCode: "9617",
        qty: 12,
        unit: "PCS",
        unitPrice: 720.00,
        mrp: 850.00,
        discount: 100, // 100 Rs off
        discountType: "fixed",
        taxableValue: 8540.00,
        gstRate: 18,
        cgst: 0,
        sgst: 0,
        igst: 1537.20,
        total: 10077.20
      }
    ],
    subtotal: 8640.00,
    discount: 100.00,
    taxableAmount: 8540.00,
    cgst: 0,
    sgst: 0,
    igst: 1537.20,
    cess: 0,
    roundOff: -0.20,
    grandTotal: 10077,
    amountInWords: "Rupees Ten Thousand and Seventy Seven Only",
    paymentMode: "NEFT",
    amountReceived: 5000,
    balanceDue: 5077,
    paymentStatus: "Partial",
    notes: "Balance pending via bank transfer.",
    status: "Active",
    createdAt: "2026-06-18T14:30:00Z",
    updatedAt: "2026-06-18T14:30:00Z",
    auditTrail: [
      {
        timestamp: "2026-06-18T14:30:00Z",
        action: "Invoice Created",
        user: "billing@adityaretail.in"
      }
    ]
  },
  {
    id: "inv_3",
    invoiceNumber: "PUR-2026-0129",
    type: "Purchase Invoice",
    date: "2026-06-10",
    dueDate: "2026-06-25",
    partyId: "party_4",
    partyType: "supplier",
    items: [
      {
        id: "li_4",
        name: "Fortune Refined Mustard Oil 1L",
        hsnCode: "1514",
        qty: 100,
        unit: "PCS",
        unitPrice: 140.00, // wholesale purchase price is lower
        discount: 0,
        discountType: "percentage",
        taxableValue: 14000.00,
        gstRate: 5,
        cgst: 350.00,
        sgst: 350.00,
        igst: 0,
        total: 14700.00,
        batchNumber: "B39201",
        expiryDate: "2027-06-10"
      }
    ],
    subtotal: 14000.00,
    discount: 0,
    taxableAmount: 14000.00,
    cgst: 350.00,
    sgst: 350.00,
    igst: 0,
    cess: 0,
    roundOff: 0,
    grandTotal: 14700,
    amountInWords: "Rupees Fourteen Thousand Seven Hundred Only",
    paymentMode: "Credit",
    amountReceived: 0,
    balanceDue: 14700,
    paymentStatus: "Unpaid",
    notes: "Stock added directly to primary floor.",
    status: "Active",
    createdAt: "2026-06-10T11:00:00Z",
    updatedAt: "2026-06-10T11:00:00Z",
    autoStockAddition: true,
    auditTrail: [
      {
        timestamp: "2026-06-10T11:00:00Z",
        action: "Purchase Logged & Stock Added",
        user: "billing@adityaretail.in"
      }
    ]
  }
];
