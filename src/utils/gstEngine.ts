import { InvoiceItem, Party, BusinessProfile } from '../types';

export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", 
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", 
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", 
  "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", 
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", 
  "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
];

/**
 * Convert numbers to Indian Rupees verbal phrase format (Lakhs, Crores)
 */
export function numberToIndianWords(num: number): string {
  if (num === 0) return "Rupees Zero Only";
  
  // Format to 2 decimal places to isolate rupees and paise
  const rounded = Math.round(num * 100) / 100;
  const rupees = Math.floor(rounded);
  const paise = Math.round((rounded - rupees) * 100);

  const getWords = (n: number): string => {
    const singleDigits = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
    const doubleDigits = ["", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
    const tensDigits = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
    
    if (n < 10) return singleDigits[n];
    if (n < 20) return doubleDigits[n - 9];
    if (n < 100) {
      const tenIdx = Math.floor(n / 10);
      const rem = n % 10;
      return tensDigits[tenIdx] + (rem > 0 ? " " + singleDigits[rem] : "");
    }
    if (n < 1000) {
      const hundredIdx = Math.floor(n / 100);
      const rem = n % 100;
      return singleDigits[hundredIdx] + " Hundred" + (rem > 0 ? " and " + getWords(rem) : "");
    }
    if (n < 100000) {
      const thousandIdx = Math.floor(n / 1000);
      const rem = n % 1000;
      return getWords(thousandIdx) + " Thousand" + (rem > 0 ? " " + getWords(rem) : "");
    }
    if (n < 10000000) {
      const lakhIdx = Math.floor(n / 100000);
      const rem = n % 100000;
      return getWords(lakhIdx) + " Lakh" + (rem > 0 ? " " + getWords(rem) : "");
    }
    const croreIdx = Math.floor(n / 10000000);
    const rem = n % 10000000;
    return getWords(croreIdx) + " Crore" + (rem > 0 ? " " + getWords(rem) : "");
  };

  let words = "Rupees " + getWords(rupees);
  if (paise > 0) {
    words += " and " + getWords(paise) + " Paise";
  }
  words += " Only";
  return words;
}

export interface CalculationResult {
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  roundOff: number;
  grandTotal: number;
  amountInWords: string;
}

/**
 * Recalculate invoice totals and taxes based on business state and party state
 */
export function calculateInvoiceTotals(
  rawItems: Omit<InvoiceItem, 'taxableValue' | 'cgst' | 'sgst' | 'igst' | 'total'>[],
  businessState: string,
  partyState: string,
  cess: number = 0,
  roundOffEnabled: boolean = true
): CalculationResult {
  const isIntrastate = businessState.trim().toLowerCase() === partyState.trim().toLowerCase();
  
  let totalSubtotal = 0;
  let totalDiscount = 0;
  let totalTaxableAmount = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;

  const calculatedItems: InvoiceItem[] = rawItems.map((item) => {
    const baseAmount = item.unitPrice * item.qty;
    let itemDiscountAmount = 0;
    
    if (item.discountType === 'percentage') {
      itemDiscountAmount = (baseAmount * item.discount) / 100;
    } else {
      itemDiscountAmount = Math.min(item.discount, baseAmount);
    }
    
    const taxableValue = Math.max(0, baseAmount - itemDiscountAmount);
    
    let cgstRaw = 0;
    let sgstRaw = 0;
    let igstRaw = 0;
    
    if (isIntrastate) {
      const cgstRate = item.gstRate / 2;
      const sgstRate = item.gstRate / 2;
      cgstRaw = (taxableValue * cgstRate) / 100;
      sgstRaw = (taxableValue * sgstRate) / 100;
    } else {
      igstRaw = (taxableValue * item.gstRate) / 100;
    }

    // Round individual items to 2 decimal places for accounting precision
    const cgst = Math.round(cgstRaw * 100) / 100;
    const sgst = Math.round(sgstRaw * 100) / 100;
    const igst = Math.round(igstRaw * 100) / 100;
    const itemTotal = Math.round((taxableValue + cgst + sgst + igst) * 100) / 100;

    totalSubtotal += baseAmount;
    totalDiscount += itemDiscountAmount;
    totalTaxableAmount += taxableValue;
    totalCgst += cgst;
    totalSgst += sgst;
    totalIgst += igst;

    return {
      ...item,
      taxableValue: Math.round(taxableValue * 100) / 100,
      cgst,
      sgst,
      igst,
      total: itemTotal
    } as InvoiceItem;
  });

  totalSubtotal = Math.round(totalSubtotal * 100) / 100;
  totalDiscount = Math.round(totalDiscount * 100) / 100;
  totalTaxableAmount = Math.round(totalTaxableAmount * 100) / 100;
  totalCgst = Math.round(totalCgst * 100) / 100;
  totalSgst = Math.round(totalSgst * 100) / 100;
  totalIgst = Math.round(totalIgst * 100) / 100;

  const netTotal = totalTaxableAmount + totalCgst + totalSgst + totalIgst + cess;
  let finalGrandTotal = netTotal;
  let roundOffDelta = 0;

  if (roundOffEnabled) {
    finalGrandTotal = Math.round(netTotal);
    roundOffDelta = Math.round((finalGrandTotal - netTotal) * 100) / 100;
  }

  return {
    items: calculatedItems,
    subtotal: totalSubtotal,
    discount: totalDiscount,
    taxableAmount: totalTaxableAmount,
    cgst: totalCgst,
    sgst: totalSgst,
    igst: totalIgst,
    roundOff: roundOffDelta,
    grandTotal: finalGrandTotal,
    amountInWords: numberToIndianWords(finalGrandTotal)
  };
}
