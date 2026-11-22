/**
 * GST Engine Unit Tests
 * This file verifies compliance across 5 essential GST calculation scenarios.
 */

import { calculateInvoiceTotals, numberToIndianWords } from './gstEngine';
import { InvoiceItem } from '../types';

// Define Mock Items for the test suite
type RawItemInput = Omit<InvoiceItem, 'taxableValue' | 'cgst' | 'sgst' | 'igst' | 'total'>;

interface TestCase {
  name: string;
  items: RawItemInput[];
  businessState: string;
  partyState: string;
  roundOffEnabled: boolean;
  expectedSubtotal: number;
  expectedDiscount: number;
  expectedTaxable: number;
  expectedCgst: number;
  expectedSgst: number;
  expectedIgst: number;
  expectedGrand: number;
  expectedRoundOff: number;
}

const TEST_CASES: TestCase[] = [
  {
    name: "Case 1: Intra-state invoice with single 18% GST rate and standard qty",
    businessState: "Maharashtra",
    partyState: "Maharashtra",
    roundOffEnabled: true,
    items: [
      {
        id: "item_1",
        name: "Office Chair",
        hsnCode: "9403",
        qty: 2,
        unit: "PCS",
        unitPrice: 5000,
        mrp: 6000,
        discount: 10, // 10% discount
        discountType: "percentage",
        gstRate: 18,
      }
    ],
    expectedSubtotal: 10000,
    expectedDiscount: 1000, // 10% of 10000
    expectedTaxable: 9000,
    expectedCgst: 810, // 9% of 9000
    expectedSgst: 810, // 9% of 9000
    expectedIgst: 0,
    expectedGrand: 10620, // 9000 + 810 + 810 = 10620
    expectedRoundOff: 0
  },
  {
    name: "Case 2: Inter-state invoice with 28% luxury rate",
    businessState: "Maharashtra",
    partyState: "Delhi",
    roundOffEnabled: true,
    items: [
      {
        id: "item_2",
        name: "Premium LED Display",
        hsnCode: "8528",
        qty: 1,
        unit: "NOS",
        unitPrice: 45000,
        mrp: 50000,
        discount: 2000, // 2000 INR fixed discount
        discountType: "fixed",
        gstRate: 28,
      }
    ],
    expectedSubtotal: 45000,
    expectedDiscount: 2000,
    expectedTaxable: 43000,
    expectedCgst: 0,
    expectedSgst: 0,
    expectedIgst: 12040, // 28% of 43000 = 12040
    expectedGrand: 55040, // 43000 + 12040 = 55040
    expectedRoundOff: 0
  },
  {
    name: "Case 3: Mixed Multi-rate invoice (0%, 5%, 12%, 18%)",
    businessState: "Karnataka",
    partyState: "Karnataka",
    roundOffEnabled: true,
    items: [
      {
        id: "item_3_1",
        name: "Fresh Milk",
        hsnCode: "0401",
        qty: 10,
        unit: "LTR",
        unitPrice: 60,
        mrp: 60,
        discount: 0,
        discountType: "percentage",
        gstRate: 0, // Exempt
      },
      {
        id: "item_3_2",
        name: "Packaged Ghee",
        hsnCode: "0405",
        qty: 2,
        unit: "KGS",
        unitPrice: 600,
        mrp: 650,
        discount: 5, // 5% discount
        discountType: "percentage",
        gstRate: 12,
      },
      {
        id: "item_3_3",
        name: "Premium Soap Pack",
        hsnCode: "3401",
        qty: 5,
        unit: "PCS",
        unitPrice: 200,
        mrp: 220,
        discount: 50, // 50 INR flat discount
        discountType: "fixed",
        gstRate: 18,
      }
    ],
    // Calculations:
    // Milk: qty 10 * 60 = 600 base. 0 disc. 600 taxable. GST 0.
    // Ghee: qty 2 * 600 = 1200 base. 5% disc = 60 INR. 1140 taxable. GST 12% -> 1140 * 0.12 = 136.80. CGST 68.40, SGST 68.40.
    // Soap: qty 5 * 200 = 1000 base. 50 flat disc. 950 taxable. GST 18% -> 950 * 0.18 = 171. CGST 85.50, SGST 85.50.
    // Subtotal: 600 + 1200 + 1000 = 2800
    // Discount: 0 + 60 + 50 = 110
    // Taxable: 600 + 1140 + 950 = 2690
    // CGST: 0 + 68.40 + 85.50 = 153.90
    // SGST: 0 + 68.40 + 85.50 = 153.90
    // IGST: 0
    // Grand Total (Raw): 2690 + 153.90 + 153.90 = 2997.80 -> Rounds to 2998. Round off delta = +0.20
    expectedSubtotal: 2800,
    expectedDiscount: 110,
    expectedTaxable: 2690,
    expectedCgst: 153.90,
    expectedSgst: 153.90,
    expectedIgst: 0,
    expectedGrand: 2998,
    expectedRoundOff: 0.2
  },
  {
    name: "Case 4: Inter-state invoice with round-off and percentage discount",
    businessState: "Tamil Nadu",
    partyState: "Kerala",
    roundOffEnabled: true,
    items: [
      {
        id: "item_4",
        name: "Acoustic Insulation Panel",
        hsnCode: "6808",
        qty: 15,
        unit: "SQFT",
        unitPrice: 125.50, // 1882.50 subtotal
        mrp: 140,
        discount: 2.5, // 2.5% discount
        discountType: "percentage",
        gstRate: 18,
      }
    ],
    // Calculations:
    // Base: 15 * 125.5 = 1882.5
    // Discount: 2.5% of 1882.5 = 47.06 (rounded)
    // Taxable: 1882.5 - 47.0625 = 1835.44 (rounded)
    // IGST: 18% of 1835.44 = 330.38 (rounded)
    // Net total: 1835.44 + 330.38 = 2165.82 -> Rounds to 2166. Round off delta = +0.18
    expectedSubtotal: 1882.50,
    expectedDiscount: 47.06,
    expectedTaxable: 1835.44,
    expectedCgst: 0,
    expectedSgst: 0,
    expectedIgst: 330.38,
    expectedGrand: 2166,
    expectedRoundOff: 0.18
  },
  {
    name: "Case 5: Flat Rate Tax Invoice requiring downward rounding off",
    businessState: "Uttar Pradesh",
    partyState: "Uttar Pradesh",
    roundOffEnabled: true,
    items: [
      {
        id: "item_5_1",
        name: "General Services Consulting Hour",
        hsnCode: "9983",
        qty: 1,
        unit: "HRS",
        unitPrice: 849.25,
        discount: 0,
        discountType: "percentage",
        gstRate: 18,
      }
    ],
    // Calculations:
    // Base: 849.25
    // Discount: 0
    // Taxable: 849.25
    // Intrastate GST (18%): CGST 9% (76.43), SGST 9% (76.43)
    // Net total: 849.25 + 76.43 + 76.43 = 1002.11 -> Rounds to 1002. Round off = -0.11
    expectedSubtotal: 849.25,
    expectedDiscount: 0,
    expectedTaxable: 849.25,
    expectedCgst: 76.43,
    expectedSgst: 76.43,
    expectedIgst: 0,
    expectedGrand: 1002,
    expectedRoundOff: -0.11
  }
];

export function runTests(): { success: boolean; results: string[] } {
  const results: string[] = [];
  let allPassed = true;

  results.push(`Starting GST Calculation Engine assertion trials...`);
  
  for (const tc of TEST_CASES) {
    const result = calculateInvoiceTotals(tc.items, tc.businessState, tc.partyState, 0, tc.roundOffEnabled);
    
    const errors: string[] = [];
    if (Math.abs(result.subtotal - tc.expectedSubtotal) > 0.05) errors.push(`Subtotal mismatch (got ${result.subtotal}, expected ${tc.expectedSubtotal})`);
    if (Math.abs(result.discount - tc.expectedDiscount) > 0.05) errors.push(`Discount mismatch (got ${result.discount}, expected ${tc.expectedDiscount})`);
    if (Math.abs(result.taxableAmount - tc.expectedTaxable) > 0.05) errors.push(`Taxable value mismatch (got ${result.taxableAmount}, expected ${tc.expectedTaxable})`);
    if (Math.abs(result.cgst - tc.expectedCgst) > 0.05) errors.push(`CGST mismatch (got ${result.cgst}, expected ${tc.expectedCgst})`);
    if (Math.abs(result.sgst - tc.expectedSgst) > 0.05) errors.push(`SGST mismatch (got ${result.sgst}, expected ${tc.expectedSgst})`);
    if (Math.abs(result.igst - tc.expectedIgst) > 0.05) errors.push(`IGST mismatch (got ${result.igst}, expected ${tc.expectedIgst})`);
    if (result.grandTotal !== tc.expectedGrand) errors.push(`Grand total mismatch (got ${result.grandTotal}, expected ${tc.expectedGrand})`);
    if (Math.abs(result.roundOff - tc.expectedRoundOff) > 0.05) errors.push(`Round off delta mismatch (got ${result.roundOff}, expected ${tc.expectedRoundOff})`);

    if (errors.length === 0) {
      results.push(`✅ PASS: ${tc.name}`);
    } else {
      results.push(`❌ FAIL: ${tc.name}`);
      errors.forEach(e => results.push(`   -> ${e}`));
      allPassed = false;
    }
  }

  // Verify Amount in Words
  const wordTestValue = 123456.78;
  const wordTestResult = numberToIndianWords(wordTestValue);
  const expectedWord = "Rupees One Lakh Twenty Three Thousand Four Hundred and Fifty Six and Seventy Eight Paise Only";
  
  if (wordTestResult.toLowerCase().trim() === expectedWord.toLowerCase().trim()) {
    results.push(`✅ PASS: Rupee-to-Words translation verification`);
  } else {
    results.push(`❌ FAIL: Rupee-to-Words translation verification\n   Got: "${wordTestResult}"\n   Expected: "${expectedWord}"`);
    allPassed = false;
  }

  return {
    success: allPassed,
    results
  };
}
