import React, { useState, useRef, useEffect } from 'react';
import { X, Printer, Download, Share2 } from 'lucide-react';
import { Invoice, BusinessProfile, Party } from '../../types';
import { generateInvoicePDF } from '../../utils/pdfGenerator';
import { exportInvoiceJSON } from '../../utils/exportHelpers';

interface DocumentViewerModalProps {
  invoice: Invoice | null;
  businessProfile: BusinessProfile;
  parties: Party[];
  onClose: () => void;
}

export default function DocumentViewerModal({
  invoice,
  businessProfile,
  parties,
  onClose,
}: DocumentViewerModalProps) {
  const [theme, setTheme] = useState<'classic' | 'modern' | 'compact' | 'elegant' | 'bold' | 'monochrome'>('classic');
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (invoice) {
      const updateScale = () => {
        const vpW = window.innerWidth;
        const vpH = window.innerHeight;
        const availW = Math.min(vpW - 48, 896) - 48;
        const availH = vpH * 0.95 - 56 - 72 - 48;

        const targetW = theme === 'compact' ? 302 : 794;
        const targetH = theme === 'compact' ? 600 : 1123;

        const scaleW = availW / targetW;
        const scaleH = availH / targetH;
        const s = theme === 'compact' ? Math.min(scaleW, 1) : Math.min(scaleW, scaleH, 1);
        setScale(Math.max(s, 0.2));
      };

      updateScale();
      window.addEventListener('resize', updateScale);
      return () => window.removeEventListener('resize', updateScale);
    }
  }, [invoice, theme]);

  if (!invoice) return null;

  const partyObj = parties.find((p) => p.id === invoice.partyId) || {
    name: 'Party',
    phone: '',
    billingAddress: '',
    state: '',
    gstin: undefined as string | undefined,
  };

  const handleWhatsApp = () => {
    const text = `*Tax Invoice Details from ${businessProfile.name}*\n\n` +
      `*Invoice No:* ${invoice.invoiceNumber}\n` +
      `*Date:* ${invoice.date}\n` +
      `*Recipient:* ${partyObj.name}\n` +
      `*Grand Total:* ₹${invoice.grandTotal.toLocaleString('en-IN')}\n` +
      `*Payment Status:* *${invoice.paymentStatus}*\n\n` +
      `_GST-compliant digital invoice generated via Bazaar-Guru._`;

    const encoded = encodeURIComponent(text);
    const phone = partyObj.phone?.replace(/[+\s-]/g, '') || '';
    window.open(`https://wa.me/${phone}?text=${encoded}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 md:p-6 bg-black/60 backdrop-blur-xs overflow-y-auto print-modal-backdrop">
      <div className="w-full max-w-4xl rounded-xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-2rem)] h-[95vh] my-auto border border-slate-100 print-modal-card">
        {/* Header Toolbar */}
        <div className="flex h-14 items-center justify-between border-b border-slate-100 bg-slate-950 px-6 text-white no-print">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Theme:</span>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as any)}
              className="rounded border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-white focus:outline-hidden"
            >
              <option value="classic">Classic Corporate</option>
              <option value="modern">Modern Blue</option>
              <option value="compact">80mm Thermal Slip</option>
              <option value="elegant">Elegant Serif</option>
              <option value="bold">Bold Impact</option>
              <option value="monochrome">Monochrome Clean</option>
            </select>
          </div>

          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Preview Canvas */}
        <div ref={containerRef} className="flex-1 overflow-y-auto bg-slate-100 p-6 flex items-start justify-center print-preview-container">
          <div
            style={{
              width: `${(theme === 'compact' ? 302 : 794) * scale}px`,
              height: theme === 'compact' ? 'auto' : `${1123 * scale}px`,
              overflow: 'hidden',
            }}
          >
            <div
              id="invoice-preview-content"
              className={`print-area bg-white mx-auto shadow-sm p-8 rounded-lg ${
                theme === 'compact'
                  ? 'w-[80mm] max-w-none font-mono text-[10px] space-y-4'
                  : 'w-[210mm] max-w-none min-h-[297mm] text-xs'
              }`}
              style={{
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                width: theme === 'compact' ? '302px' : '794px',
                minHeight: theme === 'compact' ? '600px' : '1123px',
              }}
            >
              {/* Business Header */}
              <div className="flex justify-between items-start border-b border-slate-200 pb-4 mb-4">
                <div>
                  <h1 className="text-xl font-bold text-slate-900">{businessProfile.name}</h1>
                  <p className="text-xs text-slate-500">{businessProfile.address}</p>
                  <p className="text-xs text-slate-600 font-mono">GSTIN: {businessProfile.gstin}</p>
                  <p className="text-xs text-slate-500">Phone: {businessProfile.phone} | Email: {businessProfile.email}</p>
                </div>
                <div className="text-right">
                  <h2 className="text-lg font-bold uppercase tracking-wider text-blue-700">{invoice.type}</h2>
                  <p className="font-mono font-bold text-sm text-slate-800 mt-1">{invoice.invoiceNumber}</p>
                  <p className="text-xs text-slate-500">Date: {invoice.date}</p>
                  <p className="text-xs text-slate-500">Due: {invoice.dueDate}</p>
                </div>
              </div>

              {/* Bill To */}
              <div className="mb-6 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Bill To:</span>
                <p className="font-bold text-sm text-slate-900">{partyObj.name}</p>
                <p className="text-xs text-slate-600 font-mono">{partyObj.gstin ? `GSTIN: ${partyObj.gstin}` : 'Unregistered'}</p>
                <p className="text-xs text-slate-500">{partyObj.billingAddress}</p>
              </div>

              {/* Items Table */}
              <table className="w-full text-left border-collapse text-xs mb-6">
                <thead>
                  <tr className="border-b-2 border-slate-300 text-slate-600 uppercase text-[10px] font-bold">
                    <th className="py-2">Item Description</th>
                    <th className="py-2">HSN</th>
                    <th className="py-2 text-right">Qty</th>
                    <th className="py-2 text-right">Rate (₹)</th>
                    <th className="py-2 text-right">GST %</th>
                    <th className="py-2 text-right">Total (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoice.items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="py-2 font-semibold text-slate-800">{it.name}</td>
                      <td className="py-2 font-mono text-slate-500">{it.hsnCode}</td>
                      <td className="py-2 text-right font-mono">{it.qty} {it.unit}</td>
                      <td className="py-2 text-right font-mono">₹{it.unitPrice.toFixed(2)}</td>
                      <td className="py-2 text-right font-mono">{it.gstRate}%</td>
                      <td className="py-2 text-right font-mono font-bold">₹{it.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div className="flex justify-end mb-6">
                <div className="w-64 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Taxable Amount:</span>
                    <span className="font-mono">₹{invoice.taxableAmount.toFixed(2)}</span>
                  </div>
                  {invoice.cgst > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>CGST:</span>
                      <span className="font-mono">₹{invoice.cgst.toFixed(2)}</span>
                    </div>
                  )}
                  {invoice.sgst > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>SGST:</span>
                      <span className="font-mono">₹{invoice.sgst.toFixed(2)}</span>
                    </div>
                  )}
                  {invoice.igst > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>IGST:</span>
                      <span className="font-mono">₹{invoice.igst.toFixed(2)}</span>
                    </div>
                  )}
                  {invoice.roundOff !== 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Round Off:</span>
                      <span className="font-mono">₹{invoice.roundOff.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-sm border-t-2 border-slate-800 pt-2 text-slate-950">
                    <span>Grand Total:</span>
                    <span className="font-mono text-blue-700">₹{invoice.grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Amount in words & Bank Details */}
              <div className="border-t border-slate-200 pt-3 text-xs text-slate-600">
                <p className="font-serif italic text-slate-500 mb-2">Amount in Words: {invoice.amountInWords}</p>
                {businessProfile.bankAccount && (
                  <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-[10px]">
                    <span className="font-bold text-slate-700 uppercase">Bank Payment Details: </span>
                    {businessProfile.bankName} | A/C: {businessProfile.bankAccount} | IFSC: {businessProfile.bankIFSC}
                    {businessProfile.upiId && ` | UPI: ${businessProfile.upiId}`}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex h-16 items-center justify-between border-t border-slate-100 bg-white px-6 no-print">
          <div className="flex gap-2">
            <button
              onClick={() => generateInvoicePDF(invoice, businessProfile, partyObj as any, theme)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              <Download size={14} />
              <span>Download PDF</span>
            </button>
            <button
              onClick={() => exportInvoiceJSON(invoice, partyObj as any)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              <Download size={14} />
              <span>Export JSON</span>
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleWhatsApp}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition"
            >
              <Share2 size={14} />
              <span>Share WhatsApp</span>
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition"
            >
              <Printer size={14} />
              <span>Print</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
