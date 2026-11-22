import { jsPDF } from 'jspdf';
import { Invoice, BusinessProfile, Party } from '../types';
import { NotoSansRegular, NotoSansBold } from './fonts';

// Node-only patch to intercept jsPDF save and write to public/ directory for testing
if (typeof window === 'undefined') {
  eval('import("fs")').then((fs: any) => {
    eval('import("path")').then((path: any) => {
      (jsPDF.API as any).save = function (filename: string) {
        const buffer = this.output('arraybuffer');
        const destPath = path.join(process.cwd(), 'public', filename);
        fs.writeFileSync(destPath, Buffer.from(buffer));
        console.log(`Node-saved PDF: ${destPath}`);
        return this;
      };
    });
  }).catch((err: any) => {
    console.error('Failed to apply Node PDF save patch:', err);
  });
}

const getFormatFromBase64 = (base64: string): string => {
  const match = base64.match(/^data:image\/(\w+);base64,/);
  if (match) {
    const fmt = match[1].toUpperCase();
    if (fmt === 'JPG') return 'JPEG';
    return fmt;
  }
  return 'PNG'; // default fallback
};

/**
 * Generate a standard GST-compliant tax invoice PDF using jsPDF
 */
export function generateInvoicePDF(
  invoice: Invoice,
  business: BusinessProfile,
  party: Party,
  theme: 'classic' | 'modern' | 'compact' | 'elegant' | 'bold' | 'monochrome' = 'classic'
): void {
  // Config dimensions based on theme
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: theme === 'compact' ? [80, 250] : 'a4' // 80mm thermal width for compact
  });

  // Register Noto Sans custom font to support ₹ symbol and fix character spacing
  doc.addFileToVFS('NotoSans-Regular.ttf', NotoSansRegular);
  doc.addFileToVFS('NotoSans-Bold.ttf', NotoSansBold);
  doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
  doc.addFont('NotoSans-Bold.ttf', 'NotoSans', 'bold');

  if (theme === 'compact') {
    generateThermalPDF(doc, invoice, business, party);
    return;
  }

  const isClassic = theme === 'classic';
  
  // Coords and metrics (A4 width = 210mm, height = 297mm)
  let y = 14;
  const leftMargin = 14;
  const rightMargin = 196;
  const tableWidth = rightMargin - leftMargin; // 182mm

  // Colors based on theme
  let primaryColor = [15, 23, 42]; // default dark
  let secondaryColor = [100, 116, 139];
  let lightBgColor = [248, 250, 252];
  
  if (theme === 'modern') {
    primaryColor = [30, 64, 175]; // Blue
  } else if (theme === 'elegant') {
    primaryColor = [88, 28, 135]; // Purple
    lightBgColor = [250, 245, 255]; // Purple light
  } else if (theme === 'bold') {
    primaryColor = [185, 28, 28]; // Red
    lightBgColor = [254, 242, 242]; // Red light
  } else if (theme === 'monochrome') {
    primaryColor = [0, 0, 0];
    secondaryColor = [82, 82, 82];
    lightBgColor = [245, 245, 245];
  }

  // Helper properties
  const drawLine = (yPos: number) => {
    doc.setDrawColor(226, 232, 240); // tailwind border slate-200
    doc.setLineWidth(0.3);
    doc.line(leftMargin, yPos, rightMargin, yPos);
  };

  // Header banner or divider for specific themes
  if (theme === 'modern' || theme === 'bold') {
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(leftMargin, y, tableWidth, 4, 'F');
    y += 8;
  } else if (theme === 'elegant') {
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(1);
    doc.line(leftMargin, y, rightMargin, y);
    y += 5;
  }

  // Helper to draw default business text header
  const renderDefaultBusinessHeader = () => {
    doc.setFont('NotoSans', 'bold');
    doc.setFontSize(isClassic ? 14 : 16);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(business.name, leftMargin, y);
    y += 5;

    doc.setFont('NotoSans', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`GSTIN: ${business.gstin}`, leftMargin, y);
    doc.text(`Phone: ${business.phone}  |  Email: ${business.email}`, rightMargin, y, { align: 'right' });
    y += 4;

    doc.setFontSize(8);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    const splitAddress = doc.splitTextToSize(business.address, tableWidth - 60);
    doc.text(splitAddress, leftMargin, y);
    y += (splitAddress.length * 3.5) + 3;
  };

  // BUSINESS HEADER WITH LOGO OR DEFAULT
  if (business.logoUrl) {
    try {
      const format = getFormatFromBase64(business.logoUrl);
      doc.addImage(business.logoUrl, format, leftMargin, y, 22, 14);
      
      doc.setFont('NotoSans', 'bold');
      doc.setFontSize(isClassic ? 14 : 16);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(business.name, leftMargin + 25, y + 3.5);
      
      doc.setFont('NotoSans', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`GSTIN: ${business.gstin}`, leftMargin + 25, y + 8);
      doc.text(`Phone: ${business.phone}  |  Email: ${business.email}`, rightMargin, y + 8, { align: 'right' });
      
      doc.setFontSize(8);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      const splitAddress = doc.splitTextToSize(business.address, tableWidth - 30);
      doc.text(splitAddress, leftMargin + 25, y + 12);
      y += Math.max(15, 12 + (splitAddress.length * 3.5)) + 3;
    } catch (e) {
      renderDefaultBusinessHeader();
    }
  } else {
    renderDefaultBusinessHeader();
  }

  drawLine(y);
  y += 6;

  // INVOICE TYPE TITLE
  doc.setFont('NotoSans', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(invoice.type.toUpperCase(), leftMargin, y);
  
  if (invoice.status === 'Cancelled') {
    doc.setFontSize(14);
    doc.setTextColor(239, 68, 68); // Red
    doc.text("CANCELLED", rightMargin - 40, y);
    doc.setFontSize(8);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text(`Reason: ${invoice.cancelReason || 'Not Specified'}`, rightMargin - 40, y + 4);
  }
  y += 6;

  // METADATA GRID
  doc.setFont('NotoSans', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  
  // Left col metadata
  doc.text(`Invoice No: `, leftMargin, y);
  doc.setFont('NotoSans', 'bold');
  doc.text(invoice.invoiceNumber, leftMargin + 22, y);
  
  // Right col metadata
  doc.setFont('NotoSans', 'normal');
  doc.text(`Date of Issue: ${invoice.date}`, rightMargin - 70, y);
  y += 4;

  doc.text(`Ref / PO No: ${invoice.poNumber || invoice.referenceNumber || 'N/A'}`, leftMargin, y);
  doc.text(`Due Date: ${invoice.dueDate}`, rightMargin - 70, y);
  y += 7;

  drawLine(y);
  y += 6;

  // PARTY BLOCKS (Bill To & Ship To)
  const blockWidth = tableWidth / 2 - 2;
  
  doc.setFont('NotoSans', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("BILL TO (RECIPIENT)", leftMargin, y);
  
  if (party.shippingAddress) {
    doc.text("SHIP TO (DELIVERY)", leftMargin + blockWidth + 4, y);
  }
  y += 4.5;

  doc.setFont('NotoSans', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(party.name, leftMargin, y);

  if (party.shippingAddress) {
    doc.text(party.name, leftMargin + blockWidth + 4, y);
  }
  y += 4;

  doc.setFont('NotoSans', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(`GSTIN: ${party.gstin || 'Unregistered / Consumer'}`, leftMargin, y);
  doc.text(`Phone: ${party.phone}`, leftMargin, y + 3.5);
  doc.text(`State Code: ${party.state}`, leftMargin, y + 7);

  const billingAddressSplit = doc.splitTextToSize(party.billingAddress, blockWidth - 4);
  doc.text(billingAddressSplit, leftMargin, y + 11.5);

  if (party.shippingAddress) {
    const shippingAddressSplit = doc.splitTextToSize(party.shippingAddress, blockWidth - 4);
    doc.text(shippingAddressSplit, leftMargin + blockWidth + 4, y + 4);
  }

  // Set height based on party address contents
  const maxAddressHeight = Math.max(billingAddressSplit.length * 3.5 + 11.5, party.shippingAddress ? (doc.splitTextToSize(party.shippingAddress, blockWidth - 4).length * 3.5 + 4) : 12);
  y += maxAddressHeight + 5;

  // TABLE COL HEADERS
  doc.setFillColor(lightBgColor[0], lightBgColor[1], lightBgColor[2]);
  doc.rect(leftMargin, y, tableWidth, 7, 'F');
  
  doc.setFont('NotoSans', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  
  doc.text("Sr.", leftMargin + 2, y + 4.5);
  doc.text("Item / Description", leftMargin + 10, y + 4.5);
  doc.text("HSN", leftMargin + 64, y + 4.5);
  doc.text("Qty", leftMargin + 84, y + 4.5, { align: 'right' });
  doc.text("Rate", leftMargin + 104, y + 4.5, { align: 'right' });
  doc.text("Disc", leftMargin + 124, y + 4.5, { align: 'right' });
  doc.text("GST %", leftMargin + 142, y + 4.5, { align: 'right' });
  doc.text("Taxable", leftMargin + 164, y + 4.5, { align: 'right' });
  doc.text("Total", rightMargin - 2, y + 4.5, { align: 'right' });
  
  y += 7;

  // ROWS
  doc.setFont('NotoSans', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);

  invoice.items.forEach((item, index) => {
    // Check if vertical overflow imminent
    if (y > 230) {
      doc.addPage();
      y = 15;
      drawLine(y);
      y += 5;
    }

    const itemDescSplit = doc.splitTextToSize(item.name, 52);
    const rowHeight = Math.max(itemDescSplit.length * 3.2 + 2, 6);
    
    // Draw table row boundary lines for Classic theme
    if (isClassic) {
      doc.setDrawColor(241, 245, 249);
      doc.line(leftMargin, y + rowHeight, rightMargin, y + rowHeight);
    }

    doc.text((index + 1).toString(), leftMargin + 2, y + 4);
    doc.text(itemDescSplit, leftMargin + 10, y + 4);
    doc.text(item.hsnCode || '-', leftMargin + 64, y + 4);
    doc.text(`${item.qty} ${item.unit || 'PCS'}`, leftMargin + 84, y + 4, { align: 'right' });
    doc.text(`₹${item.unitPrice.toFixed(2)}`, leftMargin + 104, y + 4, { align: 'right' });
    
    // Calculated discount amount for listing
    const rawBase = item.unitPrice * item.qty;
    const discValue = item.discountType === 'percentage' ? (rawBase * item.discount) / 100 : item.discount;
    doc.text(`₹${discValue.toFixed(2)}`, leftMargin + 124, y + 4, { align: 'right' });
    doc.text(`${item.gstRate}%`, leftMargin + 142, y + 4, { align: 'right' });
    doc.text(`₹${item.taxableValue.toFixed(2)}`, leftMargin + 164, y + 4, { align: 'right' });
    doc.text(`₹${item.total.toFixed(2)}`, rightMargin - 2, y + 4, { align: 'right' });
    
    y += rowHeight;
  });

  drawLine(y);
  y += 6;

  // CHECK PAGE OVERFLOW FOR TOTALS SECTION
  if (y > 210) {
    doc.addPage();
    y = 15;
  }

  // BANK DETAILS & QR CODE (LEFT) & TOTALS GRID (RIGHT)
  const halfWidth = tableWidth / 2;
  
  // Left block: Bank Records
  const bankYStart = y;
  doc.setFont('NotoSans', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("BANK TRANSFER DETAILS", leftMargin, y);
  y += 4;

  doc.setFont('NotoSans', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(`Bank Name: ${business.bankName}`, leftMargin, y);
  doc.text(`A/C Number: ${business.bankAccount}`, leftMargin, y + 3.5);
  doc.text(`IFSC: ${business.bankIFSC}`, leftMargin, y + 7);
  doc.text(`Branch: ${business.bankBranch}`, leftMargin, y + 10.5);

  // Draw UPI QR Code if ID exists
  if (business.upiId) {
    const upiLink = `upi://pay?pa=${business.upiId}&pn=${encodeURIComponent(business.name)}&am=${invoice.grandTotal}&cu=INR`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(upiLink)}`;
    
    try {
      doc.addImage(qrCodeUrl, 'JPEG', leftMargin + 50, bankYStart, 24, 24);
      doc.setFontSize(6.5);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text("Pay via UPI", leftMargin + 62, bankYStart + 27, { align: 'center' });
    } catch (e) {
      // safe fallback in case fetching external images is blocked
    }
  }

  // Right block: Tax calculations grid
  let rightY = bankYStart;
  doc.setFont('NotoSans', 'normal');
  doc.setFontSize(8);
  
  const drawTotalLine = (label: string, value: string, bold = false) => {
    doc.setFont('NotoSans', bold ? 'bold' : 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(label, leftMargin + halfWidth + 10, rightY);
    doc.text(value, rightMargin - 2, rightY, { align: 'right' });
    rightY += 4.5;
  };

  drawTotalLine("Subtotal (Pre-Tax):", `₹${invoice.subtotal.toFixed(2)}`);
  
  if (invoice.discount > 0) {
    drawTotalLine("Discount (Offer):", `- ₹${invoice.discount.toFixed(2)}`);
  }
  
  drawTotalLine("Taxable Amount:", `₹${invoice.taxableAmount.toFixed(2)}`);
  
  if (invoice.cgst > 0) {
    drawTotalLine(`CGST (Centre Tax):`, `₹${invoice.cgst.toFixed(2)}`);
    drawTotalLine(`SGST (State Tax):`, `₹${invoice.sgst.toFixed(2)}`);
  } else if (invoice.igst > 0) {
    drawTotalLine(`IGST (Integrated):`, `₹${invoice.igst.toFixed(2)}`);
  }

  if (invoice.cess > 0) {
    drawTotalLine("Cess Charges:", `₹${invoice.cess.toFixed(2)}`);
  }

  if (Math.abs(invoice.roundOff) > 0.01) {
    drawTotalLine("Round-off Delta:", `₹${invoice.roundOff.toFixed(2)}`);
  }

  doc.setFillColor(lightBgColor[0], lightBgColor[1], lightBgColor[2]);
  doc.rect(leftMargin + halfWidth + 8, rightY - 3, halfWidth - 8, 7, 'F');
  
  rightY += 2;
  doc.setFont('NotoSans', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("GRAND TOTAL:", leftMargin + halfWidth + 10, rightY);
  doc.text(`₹${invoice.grandTotal.toFixed(2)}`, rightMargin - 2, rightY, { align: 'right' });
  rightY += 7;

  // Synchronize height columns
  y = Math.max(rightY, bankYStart + 29);

  // GRAND TOTAL WORDS
  drawLine(y);
  y += 4.5;
  doc.setFont('NotoSans', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("AMOUNT IN WORDS:", leftMargin, y);
  
  doc.setFont('NotoSans', 'normal');
  doc.text(invoice.amountInWords, leftMargin + 32, y);
  y += 7;

  drawLine(y);
  y += 6;

  // TERMS & SIGNATURE BLOCK
  if (y > 240) {
    doc.addPage();
    y = 15;
  }

  const termsSplit = doc.splitTextToSize(invoice.terms || business.termsTemplate || 'N/A', halfWidth + 10);
  doc.setFont('NotoSans', 'bold');
  doc.setFontSize(7.5);
  doc.text("TERMS & CONDITIONS", leftMargin, y);
  
  doc.setFont('NotoSans', 'normal');
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text(termsSplit, leftMargin, y + 4.5);

  // Authorized Signatory
  doc.setFont('NotoSans', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(`for ${business.name}`, rightMargin - 5, y, { align: 'right' });
  
  if (business.signatureUrl) {
    try {
      const format = getFormatFromBase64(business.signatureUrl);
      doc.addImage(business.signatureUrl, format, rightMargin - 50, y + 1, 45, 13);
    } catch (e) {
      // safe fallback if signature fails to render
    }
  }

  doc.setDrawColor(203, 213, 225); // thin slate border for signature
  doc.line(rightMargin - 60, y + 16, rightMargin - 5, y + 16);
  
  doc.setFont('NotoSans', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text("Authorized Representative Sign/Seal", rightMargin - 5, y + 19.5, { align: 'right' });

  // Save the PDF
  doc.save(`${invoice.type.replace(/\s+/g, '')}_${invoice.invoiceNumber}.pdf`);
}

/**
 * Generate 80mm thermal receipt width PDF for thermal or raw counter layouts
 */
function generateThermalPDF(doc: jsPDF, invoice: Invoice, business: BusinessProfile, party: Party): void {
  let y = 10;
  const margin = 5;
  const width = 70; // Printable bounds out of 80mm size

  const printLine = () => {
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, margin + width, y);
    y += 4;
  };

  doc.setFont('NotoSans', 'bold');
  doc.setFontSize(10);
  doc.text(business.name, margin + width / 2, y, { align: 'center' });
  y += 4;

  doc.setFont('NotoSans', 'normal');
  doc.setFontSize(7.5);
  doc.text(`GSTIN: ${business.gstin}`, margin + width / 2, y, { align: 'center' });
  y += 3.5;
  doc.text(`Phone: ${business.phone}`, margin + width / 2, y, { align: 'center' });
  y += 5;

  printLine();
  
  doc.setFont('NotoSans', 'bold');
  doc.setFontSize(8.5);
  doc.text(invoice.type.toUpperCase(), margin, y);
  y += 4;

  doc.setFont('NotoSans', 'normal');
  doc.setFontSize(7);
  doc.text(`Inv No: ${invoice.invoiceNumber}`, margin, y);
  doc.text(`Date: ${invoice.date}`, margin + width, y, { align: 'right' });
  y += 3.5;
  doc.text(`To: ${party.name}`, margin, y);
  if (party.gstin) {
    y += 3.5;
    doc.text(`GSTIN: ${party.gstin}`, margin, y);
  }
  y += 5;

  printLine();

  // Draw miniature items list
  doc.setFont('NotoSans', 'bold');
  doc.text("ITEM", margin, y);
  doc.text("QTY x RATE", margin + 35, y);
  doc.text("TOTAL", margin + width, y, { align: 'right' });
  y += 4;

  doc.setFont('NotoSans', 'normal');
  invoice.items.forEach((item) => {
    if (y > 220) {
      // Auto extend size limit safely
    }
    const itemDescSplit = doc.splitTextToSize(item.name, 32);
    doc.text(itemDescSplit, margin, y);
    doc.text(`${item.qty} x ₹${item.unitPrice.toFixed(2)}`, margin + 35, y + 3);
    doc.text(`₹${item.total.toFixed(2)}`, margin + width, y + 3, { align: 'right' });
    y += Math.max(itemDescSplit.length * 3.5, 6) + 1;
  });

  printLine();

  const drawThermalRow = (l: string, v: string, bold = false) => {
    doc.setFont('NotoSans', bold ? 'bold' : 'normal');
    doc.text(l, margin, y);
    doc.text(v, margin + width, y, { align: 'right' });
    y += 3.5;
  };

  drawThermalRow("Subtotal:", `₹${invoice.subtotal.toFixed(2)}`);
  if (invoice.discount > 0) drawThermalRow("Discount:", `-₹${invoice.discount.toFixed(2)}`);
  if (invoice.cgst > 0) {
    drawThermalRow("CGST:", `₹${invoice.cgst.toFixed(2)}`);
    drawThermalRow("SGST:", `₹${invoice.sgst.toFixed(2)}`);
  } else if (invoice.igst > 0) {
    drawThermalRow("IGST:", `₹${invoice.igst.toFixed(2)}`);
  }
  if (Math.abs(invoice.roundOff) > 0.01) drawThermalRow("Round-off:", `₹${invoice.roundOff.toFixed(2)}`);
  
  y += 1.5;
  doc.setFont('NotoSans', 'bold');
  doc.setFontSize(8.5);
  drawThermalRow("GRAND TOTAL:", `₹${invoice.grandTotal.toFixed(2)}`, true);
  y += 4;

  printLine();
  
  doc.setFont('NotoSans', 'normal');
  doc.setFontSize(7);
  doc.text("Thank you for your business!", margin + width / 2, y, { align: 'center' });
  y += 3.5;
  doc.text("Powered by InvoicePro GST", margin + width / 2, y, { align: 'center' });

  doc.save(`Receipt_${invoice.invoiceNumber}.pdf`);
}
