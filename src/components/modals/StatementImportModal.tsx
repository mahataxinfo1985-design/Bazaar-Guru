import React, { useState } from 'react';
import { X, Upload, FileSpreadsheet, AlertCircle, Check, ArrowRight, Eye, RefreshCw } from 'lucide-react';
import { BankAccount, BankStatementLine, RawStatementRow } from '../../types/banking';
import { maskAccountNumber } from '../../services/banking/bankAccountService';
import { parseCSVStatement, parseXLSXStatement, buildStatementImport } from '../../services/banking/statementImportService';
import { formatCurrency } from '../../utils/formatters';

interface StatementImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  bankAccounts: BankAccount[];
  existingLines: BankStatementLine[];
  onImportComplete: (importRecord: any, lines: BankStatementLine[]) => Promise<void>;
}

export const StatementImportModal: React.FC<StatementImportModalProps> = ({
  isOpen,
  onClose,
  bankAccounts,
  existingLines,
  onImportComplete
}) => {
  const [selectedBankId, setSelectedBankId] = useState<string>(
    bankAccounts.length > 0 ? bankAccounts[0].id : ''
  );
  const [fileName, setFileName] = useState<string>('');
  const [fileContent, setFileContent] = useState<string | ArrayBuffer | null>(null);
  const [rawRows, setRawRows] = useState<RawStatementRow[]>([]);
  const [previewLines, setPreviewLines] = useState<BankStatementLine[]>([]);
  const [duplicateCount, setDuplicateCount] = useState<number>(0);
  
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setFileName(file.name);

    const isCsv = file.name.endsWith('.csv');
    const isXlsx = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    if (!isCsv && !isXlsx) {
      setError('Please upload a valid CSV or XLSX bank statement file');
      return;
    }

    const reader = new FileReader();

    if (isCsv) {
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          const parsed = parseCSVStatement(text);
          if (parsed.length === 0) {
            setError('No transaction rows detected in CSV');
            return;
          }
          setRawRows(parsed);
          processPreview(parsed);
        } catch (err: any) {
          setError('Failed to parse CSV: ' + err.message);
        }
      };
      reader.readAsText(file);
    } else {
      reader.onload = (event) => {
        try {
          const buffer = event.target?.result as ArrayBuffer;
          const parsed = parseXLSXStatement(buffer);
          if (parsed.length === 0) {
            setError('No transaction rows detected in spreadsheet');
            return;
          }
          setRawRows(parsed);
          processPreview(parsed);
        } catch (err: any) {
          setError('Failed to parse Excel file: ' + err.message);
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const processPreview = (rows: RawStatementRow[]) => {
    if (!selectedBankId) {
      setError('Please select a target bank account');
      return;
    }

    const { importRecord, statementLines } = buildStatementImport({
      bankAccountId: selectedBankId,
      fileName,
      fileType: fileName.endsWith('.csv') ? 'csv' : 'xlsx',
      rawRows: rows,
      existingLines
    });

    setPreviewLines(statementLines);
    setDuplicateCount(importRecord.duplicateRowsCount);
    setStep('preview');
  };

  const handleSaveImport = async () => {
    if (!selectedBankId || previewLines.length === 0) return;

    try {
      setIsProcessing(true);
      const { importRecord, statementLines } = buildStatementImport({
        bankAccountId: selectedBankId,
        fileName,
        fileType: fileName.endsWith('.csv') ? 'csv' : 'xlsx',
        rawRows,
        existingLines
      });

      await onImportComplete(importRecord, statementLines);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save statement import');
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedBank = bankAccounts.find(b => b.id === selectedBankId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 my-8 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-md">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Import Bank Statement</h2>
              <p className="text-xs text-slate-500">
                Upload CSV or Excel statements from HDFC, SBI, ICICI, Axis, or any bank
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600:text-slate-200 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-6 space-y-6">
          
          {step === 'upload' ? (
            <>
              {/* Account Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Select Target Bank Account *
                </label>
                <select
                  value={selectedBankId}
                  onChange={(e) => setSelectedBankId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 outline-none"
                >
                  {bankAccounts.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.bankName} ({maskAccountNumber(b.accountNumber)}) — Bal: {formatCurrency(b.currentBalance)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Upload Dropzone */}
              <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center hover:border-blue-500 transition-colors">
                <input
                  type="file"
                  id="statement-file-upload"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="statement-file-upload"
                  className="cursor-pointer flex flex-col items-center justify-center space-y-3"
                >
                  <div className="p-4 bg-blue-50 rounded-full text-blue-600">
                    <Upload className="w-8 h-8" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-800">
                      Click to choose CSV or Excel file
                    </span>
                    <p className="text-xs text-slate-500 mt-1">
                      Supports standard Indian banking statement formats (HDFC, ICICI, SBI, Axis, etc.)
                    </p>
                  </div>
                  <span className="inline-block px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium">
                    .CSV, .XLSX, .XLS
                  </span>
                </label>
              </div>

              {/* Security Banner */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 space-y-1">
                <div className="font-semibold text-slate-700">
                  Privacy & Bank Account Safety:
                </div>
                <div>
                  • Parsing is performed 100% locally in your browser. No files or banking data are uploaded to external third-party AI services.
                </div>
                <div>
                  • Duplicate transactions are automatically detected using date, amount, and reference checksums.
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Preview & Stats Bar */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                    {fileName}
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Target: {selectedBank?.bankName} ({maskAccountNumber(selectedBank?.accountNumber || '')})
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs font-semibold">
                  <div className="text-slate-700">
                    Valid Lines: <span className="text-emerald-600 font-bold">{previewLines.length}</span>
                  </div>
                  {duplicateCount > 0 && (
                    <div className="text-amber-600 font-bold">
                      Skipped Duplicates: {duplicateCount}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setStep('upload')}
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Re-upload
                  </button>
                </div>
              </div>

              {/* Table Preview */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 sticky top-0">
                    <tr>
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5">Description</th>
                      <th className="p-2.5">Reference</th>
                      <th className="p-2.5 text-right">Debit (Dr)</th>
                      <th className="p-2.5 text-right">Credit (Cr)</th>
                      <th className="p-2.5 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewLines.slice(0, 15).map((line, idx) => (
                      <tr key={idx} className="hover:bg-slate-50:bg-slate-800/40">
                        <td className="p-2.5 font-mono text-slate-600">{line.transactionDate}</td>
                        <td className="p-2.5 font-medium max-w-xs truncate">{line.description}</td>
                        <td className="p-2.5 font-mono text-slate-500">{line.referenceNumber || '—'}</td>
                        <td className="p-2.5 text-right text-rose-600 font-medium">
                          {line.withdrawalAmount ? formatCurrency(line.withdrawalAmount) : '—'}
                        </td>
                        <td className="p-2.5 text-right text-emerald-600 font-medium">
                          {line.depositAmount ? formatCurrency(line.depositAmount) : '—'}
                        </td>
                        <td className="p-2.5 text-right text-slate-500 font-mono">
                          {line.balanceAfter !== undefined ? formatCurrency(line.balanceAfter) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {previewLines.length > 15 && (
                <p className="text-[11px] text-slate-400 text-center">
                  Showing first 15 of {previewLines.length} lines. All lines will be imported for reconciliation.
                </p>
              )}
            </>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3.5 border-t border-[#E8DFCF]">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-[#3E5368] hover:bg-[#FFFBF3] border border-[#E8DFCF] cursor-pointer"
            >
              Cancel
            </button>
            {step === 'preview' && (
              <button
                type="button"
                onClick={handleSaveImport}
                disabled={isProcessing || previewLines.length === 0}
                className="px-5 py-2 rounded-lg text-xs font-semibold text-white bg-[#E0771A] hover:bg-[#B85D0F] disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-2xs"
              >
                {isProcessing ? 'Importing...' : `Import ${previewLines.length} Transactions`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
