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
              className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-900 focus:outline-hidden"
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
            className="preview-scale-wrapper"
            style={{
              width: `${(theme === 'compact' ? 302 : 794) * scale}px`,
              height: theme === 'compact' ? 'auto' : `${1123 * scale}px`,
              overflow: 'hidden',
            }}
          >
            {(() => {
              const isCompact = theme === 'compact';
              const isModern = theme === 'modern';
              const isElegant = theme === 'elegant';
              const isBold = theme === 'bold';
              const isMonochrome = theme === 'monochrome';

              const fontClass = isCompact || isMonochrome ? 'font-mono' : isElegant ? 'font-serif' : 'font-sans';

              return (
                <div
                  id="invoice-preview-content"
                  className={`print-area bg-white mx-auto shadow-sm p-8 rounded-lg ${fontClass} ${
                    isCompact
                      ? 'w-[80mm] max-w-none text-[10px] space-y-3'
                      : 'w-[210mm] max-w-none min-h-[297mm] text-xs'
                  }`}
                  style={{
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                    width: isCompact ? '302px' : '794px',
                    minHeight: isCompact ? '600px' : '1123px',
                  }}
                >
                  {/* Business Header */}
                  <div className={`pb-4 mb-4 ${
                    isModern 
                      ? 'bg-gradient-to-r from-[#14689F] to-[#1F86CC] text-white p-6 -mx-8 -mt-8 mb-6 rounded-t-lg'
                      : isBold
                      ? 'bg-[#12263A] text-white p-6 -mx-8 -mt-8 mb-6 rounded-t-lg'
                      : isElegant
                      ? 'border-b-4 border-double border-purple-900'
                      : isMonochrome
                      ? 'border-b-2 border-black'
                      : isCompact
                      ? 'border-b border-dashed border-slate-400 text-center pb-3'
                      : 'border-b border-slate-300'
                  }`}>
                    <div className={isCompact ? 'space-y-1' : 'flex justify-between items-start'}>
                      <div>
                        <h1 className={`font-bold ${isCompact ? 'text-sm' : 'text-xl'} ${
                          isModern || isBold ? 'text-white' : isElegant ? 'text-purple-950' : isMonochrome ? 'text-black' : 'text-[#12263A]'
                        }`}>
                          {businessProfile.name}
                        </h1>
                        <p className={`text-xs ${isModern || isBold ? 'text-blue-100' : isElegant ? 'text-purple-800' : isMonochrome ? 'text-gray-700' : 'text-[#3E5368]'}`}>
                          {businessProfile.address}
                        </p>
                        <p className={`text-xs font-mono font-semibold ${isModern || isBold ? 'text-white/90' : isElegant ? 'text-purple-900' : isMonochrome ? 'text-black' : 'text-[#12263A]'}`}>
                          GSTIN: {businessProfile.gstin}
                        </p>
                        <p className={`text-xs ${isModern || isBold ? 'text-blue-100' : isElegant ? 'text-purple-800' : isMonochrome ? 'text-gray-700' : 'text-[#3E5368]'}`}>
                          Phone: {businessProfile.phone} | Email: {businessProfile.email}
                        </p>
                      </div>

                      <div className={isCompact ? 'mt-2 pt-2 border-t border-dashed border-slate-300 text-center' : 'text-right'}>
                        <h2 className={`font-bold uppercase tracking-wider ${isCompact ? 'text-xs' : 'text-lg'} ${
                          isModern 
                            ? 'bg-white/20 px-3 py-1 rounded text-white inline-block' 
                            : isBold 
                            ? 'bg-[#E0771A] text-white px-3 py-1 rounded inline-block' 
                            : isElegant 
                            ? 'text-purple-900 border border-purple-900 px-2 py-0.5 inline-block' 
                            : isMonochrome 
                            ? 'text-black border border-black px-2 py-0.5 inline-block' 
                            : 'text-[#14689F]'
                        }`}>
                          {invoice.type}
                        </h2>
                        <p className={`font-mono font-bold mt-1 ${isCompact ? 'text-xs' : 'text-sm'} ${
                          isModern || isBold ? 'text-white' : isElegant ? 'text-purple-950' : isMonochrome ? 'text-black' : 'text-[#12263A]'
                        }`}>
                          {invoice.invoiceNumber}
                        </p>
                        <p className={`text-xs ${isModern || isBold ? 'text-blue-100' : isElegant ? 'text-purple-800' : isMonochrome ? 'text-gray-700' : 'text-[#3E5368]'}`}>
                          Date: {invoice.date}
                        </p>
                        <p className={`text-xs ${isModern || isBold ? 'text-blue-100' : isElegant ? 'text-purple-800' : isMonochrome ? 'text-gray-700' : 'text-[#3E5368]'}`}>
                          Due: {invoice.dueDate}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Bill To */}
                  <div className={`mb-6 p-3.5 rounded-lg ${
                    isModern 
                      ? 'bg-[#F0F8FD] border border-[#D4EBFA]' 
                      : isBold 
                      ? 'bg-[#FFFBF3] border-l-4 border-l-[#E0771A] border border-[#E8DFCF]' 
                      : isElegant 
                      ? 'bg-purple-50/60 border border-purple-200' 
                      : isMonochrome 
                      ? 'border border-black rounded-none' 
                      : isCompact
                      ? 'border-b border-dashed border-slate-300 pb-2 mb-3'
                      : 'bg-slate-50 border border-slate-200'
                  }`}>
                    <span className={`text-[10px] uppercase font-bold tracking-wider ${
                      isModern ? 'text-[#1F86CC]' : isBold ? 'text-[#E0771A]' : isElegant ? 'text-purple-900' : isMonochrome ? 'text-black' : 'text-slate-400'
                    }`}>
                      Bill To:
                    </span>
                    <p className={`font-bold text-sm ${isMonochrome ? 'text-black' : 'text-[#12263A]'}`}>{partyObj.name}</p>
                    <p className={`text-xs font-mono font-semibold ${isMonochrome ? 'text-black' : 'text-[#3E5368]'}`}>
                      {partyObj.gstin ? `GSTIN: ${partyObj.gstin}` : 'Unregistered Consumer'}
                    </p>
                    <p className={`text-xs ${isMonochrome ? 'text-gray-800' : 'text-[#3E5368]'}`}>{partyObj.billingAddress}</p>
                  </div>

                  {/* Items Table */}
                  <table className="w-full text-left border-collapse text-xs mb-6">
                    <thead>
                      <tr className={`uppercase text-[10px] font-bold ${
                        isModern 
                          ? 'bg-[#EAF5FD] text-[#14689F] border-b-2 border-[#1F86CC]' 
                          : isBold 
                          ? 'bg-[#12263A] text-white' 
                          : isElegant 
                          ? 'bg-purple-50 text-purple-950 border-y border-purple-300' 
                          : isMonochrome 
                          ? 'border-y-2 border-black text-black' 
                          : isCompact
                          ? 'border-y border-dashed border-slate-400 text-slate-800'
                          : 'border-b-2 border-slate-300 text-slate-600'
                      }`}>
                        <th className="py-2 px-1">Item Description</th>
                        <th className="py-2">HSN</th>
                        <th className="py-2 text-right">Qty</th>
                        <th className="py-2 text-right">Rate (₹)</th>
                        <th className="py-2 text-right">GST %</th>
                        <th className="py-2 text-right px-1">Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody className={isCompact ? 'divide-y divide-dashed divide-slate-200' : isMonochrome ? 'divide-y divide-gray-200' : isElegant ? 'divide-y divide-purple-100' : 'divide-y divide-slate-100'}>
                      {invoice.items.map((it, idx) => (
                        <tr key={idx} className={idx % 2 === 1 && !isCompact && !isMonochrome ? 'bg-slate-50/50' : ''}>
                          <td className="py-2 px-1 font-semibold text-slate-800">{it.name}</td>
                          <td className="py-2 font-mono text-slate-500">{it.hsnCode}</td>
                          <td className="py-2 text-right font-mono">{it.qty} {it.unit}</td>
                          <td className="py-2 text-right font-mono">₹{it.unitPrice.toFixed(2)}</td>
                          <td className="py-2 text-right font-mono">{it.gstRate}%</td>
                          <td className="py-2 text-right px-1 font-mono font-bold">₹{it.total.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Totals */}
                  <div className="flex justify-end mb-6">
                    <div className="w-64 space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Taxable Amount:</span>
                        <span className="font-mono font-semibold">₹{invoice.taxableAmount.toFixed(2)}</span>
                      </div>
                      {invoice.cgst > 0 && (
                        <div className="flex justify-between text-slate-600">
                          <span>CGST:</span>
                          <span className="font-mono font-semibold">₹{invoice.cgst.toFixed(2)}</span>
                        </div>
                      )}
                      {invoice.sgst > 0 && (
                        <div className="flex justify-between text-slate-600">
                          <span>SGST:</span>
                          <span className="font-mono font-semibold">₹{invoice.sgst.toFixed(2)}</span>
                        </div>
                      )}
                      {invoice.igst > 0 && (
                        <div className="flex justify-between text-slate-600">
                          <span>IGST:</span>
                          <span className="font-mono font-semibold">₹{invoice.igst.toFixed(2)}</span>
                        </div>
                      )}
                      {invoice.roundOff !== 0 && (
                        <div className="flex justify-between text-slate-600">
                          <span>Round Off:</span>
                          <span className="font-mono">₹{invoice.roundOff.toFixed(2)}</span>
                        </div>
                      )}
                      <div className={`flex justify-between font-bold text-sm pt-2 ${
                        isModern 
                          ? 'border-t-2 border-[#1F86CC] text-[#14689F]' 
                          : isBold 
                          ? 'bg-[#FFF3DC] border border-[#F28C28]/40 p-2 rounded text-[#B85D0F]' 
                          : isElegant 
                          ? 'border-t-2 border-purple-900 text-purple-950' 
                          : isMonochrome 
                          ? 'border-t-2 border-black text-black' 
                          : isCompact
                          ? 'border-y border-dashed border-slate-800 py-1'
                          : 'border-t-2 border-slate-800 text-[#12263A]'
                      }`}>
                        <span>Grand Total:</span>
                        <span className="font-mono">₹{invoice.grandTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Amount in words & Bank Details */}
                  <div className={`pt-3 text-xs ${
                    isMonochrome ? 'border-t border-black' : isElegant ? 'border-t border-purple-200' : 'border-t border-slate-200'
                  }`}>
                    <p className="font-serif italic text-slate-500 mb-2">Amount in Words: {invoice.amountInWords}</p>
                    {businessProfile.bankAccount && (
                      <div className={`p-2.5 rounded text-[10px] ${
                        isModern 
                          ? 'bg-[#EAF5FD] border border-[#D4EBFA]' 
                          : isBold 
                          ? 'bg-[#FFFBF3] border border-[#E8DFCF]' 
                          : isElegant 
                          ? 'bg-purple-50/60 border border-purple-200' 
                          : isMonochrome 
                          ? 'border border-black' 
                          : isCompact
                          ? 'border-t border-dashed border-slate-300'
                          : 'bg-slate-50 border border-slate-200'
                      }`}>
                        <span className="font-bold uppercase">Bank Payment Details: </span>
                        {businessProfile.bankName} | A/C: {businessProfile.bankAccount} | IFSC: {businessProfile.bankIFSC}
                        {businessProfile.upiId && ` | UPI: ${businessProfile.upiId}`}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
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
