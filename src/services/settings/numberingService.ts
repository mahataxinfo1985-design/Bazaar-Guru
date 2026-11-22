import { BusinessNumberingConfig, DocumentSequenceRule } from '../../types/workspace';
import { idbGetAll, idbPut } from '../storage/idb';

export const DEFAULT_NUMBERING_CONFIG: BusinessNumberingConfig = {
  id: 'default_numbering_config',
  businessId: 'biz_default',
  sequences: {
    INV: { docType: 'INV', prefix: 'INV', separator: '-', currentNumber: 1, padding: 4, fyReset: true, financialYear: '2024-25' },
    QUO: { docType: 'QUO', prefix: 'QUO', separator: '-', currentNumber: 1, padding: 4, fyReset: true, financialYear: '2024-25' },
    SO: { docType: 'SO', prefix: 'SO', separator: '-', currentNumber: 1, padding: 4, fyReset: true, financialYear: '2024-25' },
    DC: { docType: 'DC', prefix: 'DC', separator: '-', currentNumber: 1, padding: 4, fyReset: true, financialYear: '2024-25' },
    PO: { docType: 'PO', prefix: 'PO', separator: '-', currentNumber: 1, padding: 4, fyReset: true, financialYear: '2024-25' },
    GRN: { docType: 'GRN', prefix: 'GRN', separator: '-', currentNumber: 1, padding: 4, fyReset: true, financialYear: '2024-25' },
    PB: { docType: 'PB', prefix: 'PB', separator: '-', currentNumber: 1, padding: 4, fyReset: true, financialYear: '2024-25' },
    CN: { docType: 'CN', prefix: 'CN', separator: '-', currentNumber: 1, padding: 4, fyReset: true, financialYear: '2024-25' },
    DN: { docType: 'DN', prefix: 'DN', separator: '-', currentNumber: 1, padding: 4, fyReset: true, financialYear: '2024-25' },
    REC: { docType: 'REC', prefix: 'REC', separator: '-', currentNumber: 1, padding: 4, fyReset: true, financialYear: '2024-25' },
    PAY: { docType: 'PAY', prefix: 'PAY', separator: '-', currentNumber: 1, padding: 4, fyReset: true, financialYear: '2024-25' }
  }
};

/**
 * Calculates current Indian Financial Year (e.g. 2024-25 from April 1 to March 31).
 */
export function getCurrentFinancialYear(date: Date = new Date()): string {
  const month = date.getMonth() + 1; // 1-12
  const year = date.getFullYear();
  if (month >= 4) {
    const nextYearShort = (year + 1).toString().slice(-2);
    return `${year}-${nextYearShort}`;
  } else {
    const yearShort = year.toString().slice(-2);
    return `${year - 1}-${yearShort}`;
  }
}

/**
 * Formats a document number based on its sequence rule.
 */
export function formatDocumentNumber(rule: DocumentSequenceRule, sequenceNum: number): string {
  const padded = sequenceNum.toString().padStart(rule.padding, '0');
  const fyPart = rule.fyReset ? `${rule.separator}${rule.financialYear}` : '';
  const suffixPart = rule.suffix ? `${rule.separator}${rule.suffix}` : '';
  return `${rule.prefix}${rule.separator}${padded}${fyPart}${suffixPart}`;
}

/**
 * Gets the current numbering configuration from storage or returns default.
 */
export async function getNumberingConfig(): Promise<BusinessNumberingConfig> {
  const configs = await idbGetAll('numbering_sequences');
  if (configs && configs.length > 0) {
    return configs[0];
  }
  return DEFAULT_NUMBERING_CONFIG;
}

/**
 * Saves or updates numbering configuration.
 */
export async function saveNumberingConfig(config: BusinessNumberingConfig): Promise<void> {
  await idbPut('numbering_sequences', config);
}

/**
 * Generates and increments the next document number atomically.
 */
export async function generateNextDocumentNumber(
  docType: DocumentSequenceRule['docType'],
  date: Date = new Date()
): Promise<string> {
  const config = await getNumberingConfig();
  let rule = config.sequences[docType];

  if (!rule) {
    rule = DEFAULT_NUMBERING_CONFIG.sequences[docType] || {
      docType,
      prefix: docType,
      separator: '-',
      currentNumber: 1,
      padding: 4,
      fyReset: true,
      financialYear: getCurrentFinancialYear(date)
    };
  }

  const currentFY = getCurrentFinancialYear(date);
  if (rule.fyReset && rule.financialYear !== currentFY) {
    rule.financialYear = currentFY;
    rule.currentNumber = 1; // Reset counter for new financial year
  }

  const generatedNumber = formatDocumentNumber(rule, rule.currentNumber);

  // Increment counter for next usage
  rule.currentNumber += 1;
  config.sequences[docType] = rule;
  await saveNumberingConfig(config);

  return generatedNumber;
}
