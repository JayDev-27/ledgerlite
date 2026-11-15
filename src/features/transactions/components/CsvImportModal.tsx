import React, { useState } from 'react';
import {
  Upload,
  X,
  FileText,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  RotateCcw,
  Check,
} from 'lucide-react';
import type { Transaction } from '@/types';
import {
  parseCsv,
  detectColumnMapping,
  detectDuplicates,
  normalizePaymentMethod,
  parseDateString,
  parseAmount,
  ColumnMapping,
  PreparedImportTransaction,
} from '@/lib/csv';
import { repository } from '@/data/repository';
import { batchClassifyTransactions } from '@/lib/categorizer';
import { formatCurrency, formatRelativeDate } from '@/lib/formatters';
import { useFocusTrap } from '@/lib/a11y/useFocusTrap';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingTransactions?: Transaction[];
  onImportComplete: () => void;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  onClose,
  existingTransactions,
  onImportComplete,
}) => {
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview'>('upload');
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    date: null,
    amount: null,
    merchant: null,
    category: null,
    paymentMethod: null,
    notes: null,
  });
  const [preparedItems, setPreparedItems] = useState<PreparedImportTransaction[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [skipDuplicates, setSkipDuplicates] = useState(true);

  if (!isOpen) return null;

  const resetState = () => {
    setStep('upload');
    setFileName('');
    setHeaders([]);
    setRawRows([]);
    setPreparedItems([]);
    setIsProcessing(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const modalRef = useFocusTrap<HTMLDivElement>({ isOpen, onClose: handleClose });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const { headers: parsedHeaders, rows } = parseCsv(text);
      if (parsedHeaders.length === 0 || rows.length === 0) {
        alert('Could not parse any rows from this CSV file.');
        return;
      }
      setHeaders(parsedHeaders);
      setRawRows(rows);
      const autoMapping = detectColumnMapping(parsedHeaders);
      setMapping(autoMapping);
      setStep('mapping');
    };
    reader.readAsText(file);
  };

  const handleProcessMapping = async () => {
    if (mapping.date === null || mapping.amount === null || mapping.merchant === null) {
      alert('Please map Date, Amount, and Merchant columns before proceeding.');
      return;
    }

    setIsProcessing(true);
    try {
      // Build raw items
      const initialItems: PreparedImportTransaction[] = rawRows.map((row) => {
        const rawDate = mapping.date !== null ? row[mapping.date] || '' : '';
        const rawAmount = mapping.amount !== null ? row[mapping.amount] || '' : '';
        const rawMerchant = mapping.merchant !== null ? row[mapping.merchant] || '' : '';
        const rawPayment = mapping.paymentMethod !== null ? row[mapping.paymentMethod] || '' : '';
        const rawNotes = mapping.notes !== null ? row[mapping.notes] || '' : '';
        const rawCat = mapping.category !== null ? row[mapping.category] || '' : '';

        const dateIso = parseDateString(rawDate);
        const amountNum = parseAmount(rawAmount);
        const payment = normalizePaymentMethod(rawPayment);

        return {
          date: dateIso,
          amount: amountNum,
          merchant: rawMerchant.trim() || 'Unknown Payee',
          categoryName: rawCat.trim() || undefined,
          paymentMethod: payment,
          notes: rawNotes.trim() || undefined,
          isDuplicate: false,
          selectedForImport: true,
        };
      });

      // Filter out zero amount or invalid items
      const validItems = initialItems.filter((item) => item.amount > 0);

      // Auto-categorize via 3-tier pipeline
      const classificationInputs = validItems.map((i) => ({
        merchant: i.merchant,
        amount: i.amount,
        notes: i.notes,
      }));

      const classifications = await batchClassifyTransactions(
        repository,
        classificationInputs,
        { useAi: false }
      );

      for (let i = 0; i < validItems.length; i++) {
        const item = validItems[i];
        const cls = classifications[i];
        if (item && cls) {
          item.categoryId = cls.categoryId;
          item.subcategoryId = cls.subcategoryId;
        }
      }

      // Check duplicates against all existing database transactions
      const existing = existingTransactions && existingTransactions.length > 50
        ? existingTransactions
        : await repository.getAllTransactions();
      const withDuplicates = detectDuplicates(validItems, existing);
      setPreparedItems(withDuplicates);
      setStep('preview');
    } catch (err) {
      console.error('Failed to process CSV mapping:', err);
      alert('Error parsing CSV records. Please check the file formatting.');
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleSkipDuplicates = (skip: boolean) => {
    setSkipDuplicates(skip);
    setPreparedItems((items) =>
      items.map((item) => (item.isDuplicate && skip ? { ...item, selectedForImport: false } : item))
    );
  };

  const toggleItemSelection = (index: number) => {
    setPreparedItems((items) =>
      items.map((item, idx) =>
        idx === index ? { ...item, selectedForImport: !item.selectedForImport } : item
      )
    );
  };

  const handleSelectAll = (select: boolean) => {
    setPreparedItems((items) =>
      items.map((item) => ({
        ...item,
        selectedForImport: select ? (skipDuplicates ? !item.isDuplicate : true) : false,
      }))
    );
  };

  const handleExecuteImport = async () => {
    const toImport = preparedItems.filter((i) => i.selectedForImport);
    if (toImport.length === 0) {
      alert('No transactions selected for import.');
      return;
    }

    setIsProcessing(true);
    try {
      await repository.bulkCreateTransactions(
        toImport.map((i) => ({
          amount: i.amount,
          currency: 'INR',
          date: `${i.date}T12:00:00.000Z`,
          merchant: i.merchant,
          categoryId: i.categoryId || 'cat_misc',
          subcategoryId: i.subcategoryId,
          paymentMethod: i.paymentMethod,
          notes: i.notes,
          tags: ['csv-import'],
          source: 'csv',
          confidence: 0.9,
        }))
      );

      onImportComplete();
      handleClose();
    } catch (err) {
      console.error('Import failed:', err);
      alert('Failed to import transactions.');
    } finally {
      setIsProcessing(false);
    }
  };

  const duplicateCount = preparedItems.filter((i) => i.isDuplicate).length;
  const selectedCount = preparedItems.filter((i) => i.selectedForImport).length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="csv-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/75 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        ref={modalRef}
        className="w-full max-w-3xl bg-white dark:bg-dark-surface rounded-modal border border-cream-200 dark:border-dark-border shadow-modal overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cream-200 dark:border-dark-border">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-deep-blue-600 dark:text-cream-300" />
            <div>
              <h3 id="csv-modal-title" className="font-semibold text-base text-deep-blue-950 dark:text-cream-100">
                Import Transactions from CSV
              </h3>
              <p className="text-xs text-deep-blue-700/70 dark:text-cream-400">
                Auto-column mapping, smart duplicate detection & categorization
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            aria-label="Close dialog"
            title="Close dialog"
            className="p-1 rounded-lg text-deep-blue-700 dark:text-cream-300 hover:bg-cream-100 dark:hover:bg-dark-elevated transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-deep-blue-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* STEP 1: Upload */}
          {step === 'upload' && (
            <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-cream-300 dark:border-dark-border rounded-2xl hover:bg-cream-50/50 dark:hover:bg-dark-elevated/50 transition-colors text-center">
              <Upload className="w-10 h-10 text-deep-blue-500 dark:text-cream-300 mb-3" />
              <h4 className="font-semibold text-sm text-deep-blue-950 dark:text-cream-100 mb-1">
                Choose CSV File
              </h4>
              <p className="text-xs text-deep-blue-700/70 dark:text-cream-400 mb-4 max-w-sm">
                Upload your bank statement or expense export in CSV format.
              </p>
              <label className="px-4 py-2.5 rounded-xl bg-deep-blue-500 hover:bg-deep-blue-600 text-cream-100 text-xs font-semibold cursor-pointer transition-colors shadow-sm dark:bg-white dark:text-black dark:hover:bg-cream-200">
                Browse Files
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {/* STEP 2: Column Mapping */}
          {step === 'mapping' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-cream-100 dark:border-dark-border">
                <span className="text-xs font-semibold text-deep-blue-900 dark:text-cream-100">
                  File: <span className="font-mono text-deep-blue-700 dark:text-cream-200">{fileName}</span> ({rawRows.length} rows)
                </span>
                <button
                  onClick={() => setStep('upload')}
                  className="text-xs text-deep-blue-600 dark:text-cream-300 hover:underline flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Choose different file</span>
                </button>
              </div>

              <p className="text-xs text-deep-blue-700/80 dark:text-cream-300">
                Verify the column mapping detected from your file header:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {(
                  [
                    { field: 'date', label: 'Date Column *', required: true },
                    { field: 'amount', label: 'Amount Column *', required: true },
                    { field: 'merchant', label: 'Merchant / Description *', required: true },
                    { field: 'category', label: 'Category Column (Optional)', required: false },
                    { field: 'paymentMethod', label: 'Payment Method (Optional)', required: false },
                    { field: 'notes', label: 'Notes / Remarks (Optional)', required: false },
                  ] as const
                ).map(({ field, label }) => (
                  <div key={field}>
                    <label className="block text-xs font-semibold text-deep-blue-800 dark:text-cream-200 mb-1">
                      {label}
                    </label>
                    <select
                      value={mapping[field] !== null ? String(mapping[field]) : ''}
                      onChange={(e) =>
                        setMapping({
                          ...mapping,
                          [field]: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 text-xs rounded-xl bg-cream-50 dark:bg-dark-elevated border border-cream-300 dark:border-dark-border text-deep-blue-900 dark:text-cream-100"
                    >
                      <option value="">-- Do Not Import / Not In File --</option>
                      {headers.map((h, idx) => (
                        <option key={idx} value={idx}>
                          Column {idx + 1}: &ldquo;{h}&rdquo; (e.g. &ldquo;{rawRows[0]?.[idx] || ''}&rdquo;)
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-4">
                <button
                  onClick={handleProcessMapping}
                  disabled={isProcessing}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-deep-blue-500 hover:bg-deep-blue-600 text-cream-100 text-xs font-semibold transition-all shadow-sm dark:bg-white dark:text-black dark:hover:bg-cream-200"
                >
                  <span>Preview & Check Duplicates</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Preview & Duplicate Detection */}
          {step === 'preview' && (
            <div className="space-y-4">
              {/* Duplicate Summary Banner */}
              <div className="p-3.5 rounded-xl bg-cream-50 dark:bg-dark-elevated border border-cream-200 dark:border-dark-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  {duplicateCount > 0 ? (
                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  ) : (
                    <CheckCircle className="w-4 h-4 text-status-success flex-shrink-0" />
                  )}
                  <span>
                    Found <strong className="font-semibold">{preparedItems.length}</strong> transactions.{' '}
                    {duplicateCount > 0 ? (
                      <span className="text-amber-600 dark:text-amber-400 font-semibold">
                        {duplicateCount} potential duplicates flagged within +/- 1 day.
                      </span>
                    ) : (
                      <span className="text-status-success font-semibold">Zero duplicates detected!</span>
                    )}
                  </span>
                </div>

                {duplicateCount > 0 && (
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-deep-blue-900 dark:text-cream-100 flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={skipDuplicates}
                      onChange={(e) => toggleSkipDuplicates(e.target.checked)}
                      className="rounded text-deep-blue-500 focus:ring-sky-400"
                    />
                    <span>Skip duplicates</span>
                  </label>
                )}
              </div>

              {/* Selection Controls */}
              <div className="flex items-center justify-between text-xs text-deep-blue-700/80 dark:text-cream-400 px-1">
                <div>
                  <button
                    onClick={() => handleSelectAll(true)}
                    className="hover:underline text-deep-blue-600 dark:text-cream-200 font-medium"
                  >
                    Select All
                  </button>
                  <span className="mx-2">•</span>
                  <button
                    onClick={() => handleSelectAll(false)}
                    className="hover:underline text-deep-blue-600 dark:text-cream-200 font-medium"
                  >
                    Deselect All
                  </button>
                </div>
                <div>
                  <strong className="text-deep-blue-900 dark:text-cream-100 font-semibold tabular-nums">
                    {selectedCount}
                  </strong>{' '}
                  of {preparedItems.length} ready to import
                </div>
              </div>

              {/* Preview Table */}
              <div className="border border-cream-200 dark:border-dark-border rounded-xl overflow-hidden overflow-x-auto max-h-72">
                <table className="w-full text-left text-xs">
                  <thead className="bg-cream-100 dark:bg-dark-elevated sticky top-0 text-deep-blue-800 dark:text-cream-200 font-semibold border-b border-cream-200 dark:border-dark-border">
                    <tr>
                      <th className="p-2.5 w-10"></th>
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5">Merchant</th>
                      <th className="p-2.5">Amount</th>
                      <th className="p-2.5">Payment</th>
                      <th className="p-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cream-100 dark:divide-dark-border">
                    {preparedItems.map((item, idx) => (
                      <tr
                        key={idx}
                        className={`hover:bg-cream-50/70 dark:hover:bg-dark-elevated/40 transition-colors ${
                          item.isDuplicate ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''
                        }`}
                      >
                        <td className="p-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={item.selectedForImport}
                            onChange={() => toggleItemSelection(idx)}
                            className="rounded text-deep-blue-500 focus:ring-sky-400"
                          />
                        </td>
                        <td className="p-2.5 font-mono whitespace-nowrap text-deep-blue-800 dark:text-cream-200">
                          {item.date}
                        </td>
                        <td className="p-2.5 font-medium text-deep-blue-900 dark:text-cream-100 max-w-xs truncate">
                          {item.merchant}
                        </td>
                        <td className="p-2.5 font-mono font-semibold tabular-nums text-deep-blue-950 dark:text-cream-100 whitespace-nowrap">
                          {formatCurrency(item.amount)}
                        </td>
                        <td className="p-2.5 uppercase font-mono text-[10px] text-deep-blue-700 dark:text-cream-300">
                          {item.paymentMethod}
                        </td>
                        <td className="p-2.5 whitespace-nowrap">
                          {item.isDuplicate ? (
                            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 font-semibold">
                              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                              <span>Duplicate ({formatRelativeDate(item.duplicateOf!.date)})</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 font-semibold">
                              <Check className="w-3 h-3 flex-shrink-0" />
                              <span>New</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-cream-200 dark:border-dark-border">
                <button
                  onClick={() => setStep('mapping')}
                  className="px-3.5 py-2 text-xs font-semibold rounded-xl text-deep-blue-700 dark:text-cream-300 hover:bg-cream-100 dark:hover:bg-dark-elevated transition-colors"
                >
                  Back to Mapping
                </button>

                <button
                  onClick={handleExecuteImport}
                  disabled={isProcessing || selectedCount === 0}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-deep-blue-500 hover:bg-deep-blue-600 text-cream-100 text-xs font-semibold transition-all shadow-sm disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-cream-200"
                >
                  <Check className="w-4 h-4" />
                  <span>Import {selectedCount} Transactions</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
