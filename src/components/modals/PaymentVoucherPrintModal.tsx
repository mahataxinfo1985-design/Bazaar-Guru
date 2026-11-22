import React from 'react';
import { X, Printer, Download, Landmark, FileCheck } from 'lucide-react';
import { PaymentVoucher } from '../../types/banking';
import { formatCurrency } from '../../utils/formatters';

interface PaymentVoucherPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  voucher: PaymentVoucher | null;
  businessName?: string;
  businessGstin?: string;
  businessAddress?: string;
}

export const PaymentVoucherPrintModal: React.FC<PaymentVoucherPrintModalProps> = ({
  isOpen,
  onClose,
  voucher,
  businessName = 'INVOICE PRO ENTERPRISE',
  businessGstin = '07AAAAA0000A1Z5',
  businessAddress = '101 Corporate Towers, Financial District, New Delhi, 110001'
}) => {
  if (!isOpen || !voucher) return null;

  const isReceipt = voucher.voucherType === 'receipt';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 my-8 overflow-hidden print:m-0 print:border-none print:shadow-none">
        
        {/* Screen Controls Header (Hidden in Print) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 print:hidden">
          <div className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-primary" />
            <span className="font-bold text-slate-800 text-sm">
              {isReceipt ? 'Customer Receipt Voucher' : 'Payment Out Voucher'} Preview
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary/90 flex items-center gap-1.5 shadow-sm"
            >
              <Printer className="w-4 h-4" />
              Print / Save as PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Paper Voucher Area */}
        <div className="p-8 text-slate-900 bg-white space-y-6 print:p-4 print:text-black">
          
          {/* Company Branding & Title */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">
                {businessName}
              </h1>
              <p className="text-xs text-slate-600 max-w-md mt-1">{businessAddress}</p>
              {businessGstin && (
                <p className="text-xs font-semibold text-slate-700 mt-1">
                  GSTIN: <span className="font-mono">{businessGstin}</span>
                </p>
              )}
            </div>
            <div className="text-right">
              <span className={`inline-block px-3 py-1 rounded text-xs font-black uppercase tracking-wider ${
                isReceipt ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}>
                {isReceipt ? 'RECEIPT VOUCHER' : 'PAYMENT VOUCHER'}
              </span>
              <p className="text-sm font-bold font-mono mt-2">{voucher.voucherNumber}</p>
              <p className="text-xs text-slate-500">Date: {voucher.date}</p>
            </div>
          </div>

          {/* Party and Account Metadata Box */}
          <div className="grid grid-cols-2 gap-6 p-4 rounded-xl border border-slate-200 bg-slate-50/50 text-xs">
            <div>
              <span className="font-bold text-slate-500 uppercase tracking-wider block mb-1">
                {isReceipt ? 'Received From:' : 'Paid To:'}
              </span>
              <p className="text-sm font-bold text-slate-900">{voucher.partyName || 'Self / Direct Expense'}</p>
              <p className="text-slate-500 mt-0.5">Category: {voucher.category?.replace('_', ' ').toUpperCase()}</p>
            </div>
            <div>
              <span className="font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Settlement Details:
              </span>
              <p className="text-slate-800">
                Payment Mode: <strong className="uppercase">{voucher.paymentMode.replace('_', ' ')}</strong>
              </p>
              {voucher.referenceNumber && (
                <p className="text-slate-800 font-mono">Ref / UTR: {voucher.referenceNumber}</p>
              )}
              {voucher.chequeDetails && (
                <p className="text-slate-800 font-mono">
                  Cheque #{voucher.chequeDetails.chequeNumber} ({voucher.chequeDetails.bankName}, Dt: {voucher.chequeDetails.chequeDate})
                </p>
              )}
            </div>
          </div>

          {/* Amount In Words & Numeric */}
          <div className="p-4 rounded-xl bg-slate-900 text-white flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">
                Total Amount Settled
              </span>
              <span className="text-2xl font-black">{formatCurrency(voucher.amount)}</span>
            </div>
            {voucher.advanceAmount && voucher.advanceAmount > 0 ? (
              <div className="text-right">
                <span className="text-[10px] text-amber-300 uppercase tracking-wider font-semibold block">
                  Advance / Unallocated
                </span>
                <span className="text-base font-bold text-amber-200">{formatCurrency(voucher.advanceAmount)}</span>
              </div>
            ) : null}
          </div>

          {/* Invoice / Bill Allocation Table */}
          {voucher.allocations && voucher.allocations.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Settlement Allocations ({voucher.allocations.length})
              </h3>
              <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-100 text-slate-700 font-bold">
                  <tr>
                    <th className="p-2 border-b border-slate-200">#</th>
                    <th className="p-2 border-b border-slate-200">Document No.</th>
                    <th className="p-2 text-right border-b border-slate-200">Allocated Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {voucher.allocations.map((alloc, idx) => (
                    <tr key={idx}>
                      <td className="p-2 font-mono text-slate-400">{idx + 1}</td>
                      <td className="p-2 font-semibold">{alloc.invoiceNumber}</td>
                      <td className="p-2 text-right font-bold text-slate-900">
                        {formatCurrency(alloc.amountAllocated)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Narration */}
          {voucher.narration && (
            <div className="text-xs text-slate-600 border-l-2 border-slate-400 pl-3 italic">
              <strong>Narration:</strong> {voucher.narration}
            </div>
          )}

          {/* Signatures */}
          <div className="pt-12 grid grid-cols-2 gap-8 text-center text-xs">
            <div className="border-t border-slate-300 pt-2">
              <p className="font-semibold text-slate-700">Receiver's Signature</p>
            </div>
            <div className="border-t border-slate-300 pt-2">
              <p className="font-semibold text-slate-700">For {businessName}</p>
              <p className="text-[10px] text-slate-400 mt-1">Authorized Signatory</p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
