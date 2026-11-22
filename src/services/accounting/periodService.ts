import { AccountingPeriod } from '../../types/accounting';

/**
 * Derives the Indian Financial Year name (e.g. "FY 2024-25") for any ISO date string.
 * Indian financial year runs from April 1 to March 31.
 */
export function getFinancialYearName(dateStr?: string): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  const year = d.getFullYear();
  const month = d.getMonth() + 1; // 1-12

  if (month >= 4) {
    const nextYearShort = (year + 1).toString().slice(-2);
    return `FY ${year}-${nextYearShort}`;
  } else {
    const currYearShort = year.toString().slice(-2);
    return `FY ${year - 1}-${currYearShort}`;
  }
}

/**
 * Generates standard standard Indian financial year periods.
 */
export function generateStandardPeriods(businessId?: string): AccountingPeriod[] {
  return [
    {
      id: 'fy_2024_25',
      businessId,
      name: 'FY 2024-25',
      startDate: '2024-04-01',
      endDate: '2025-03-31',
      status: 'closed',
      closedAt: '2025-04-01T00:00:00Z',
    },
    {
      id: 'fy_2025_26',
      businessId,
      name: 'FY 2025-26',
      startDate: '2025-04-01',
      endDate: '2026-03-31',
      status: 'open',
    },
    {
      id: 'fy_2026_27',
      businessId,
      name: 'FY 2026-27',
      startDate: '2026-04-01',
      endDate: '2027-03-31',
      status: 'open',
    }
  ];
}

export const DEFAULT_ACCOUNTING_PERIODS = generateStandardPeriods();

/**
 * Resolves which financial period a given transaction date falls into.
 */
export function findPeriodForDate(periods: AccountingPeriod[], dateStr: string): AccountingPeriod | undefined {
  return periods.find((p) => dateStr >= p.startDate && dateStr <= p.endDate);
}

/**
 * Asserts whether a transaction date is allowed for posting.
 * If the period is locked or closed, posting is rejected.
 */
export function canPostToDate(
  periods: AccountingPeriod[],
  dateStr: string
): { allowed: boolean; reason?: string; period?: AccountingPeriod } {
  const period = findPeriodForDate(periods, dateStr);
  if (!period) {
    // If no explicit period configured, allow with warning
    return { allowed: true };
  }

  if (period.status === 'closed') {
    return {
      allowed: false,
      reason: `Cannot post transaction to date ${dateStr}. Accounting period '${period.name}' is closed.`,
      period
    };
  }

  if (period.status === 'locked') {
    return {
      allowed: false,
      reason: `Cannot post transaction to date ${dateStr}. Accounting period '${period.name}' is locked for audit review.`,
      period
    };
  }

  return { allowed: true, period };
}

/**
 * Locks a period to prevent new entries.
 */
export function lockPeriod(
  periodId: string,
  periods: AccountingPeriod[],
  userId?: string
): AccountingPeriod[] {
  return periods.map((p) => {
    if (p.id === periodId) {
      return {
        ...p,
        status: 'locked' as const,
        closedAt: new Date().toISOString(),
        closedBy: userId
      };
    }
    return p;
  });
}

/**
 * Controlled reopening of a period with audit justification.
 */
export function reopenPeriod(
  periodId: string,
  periods: AccountingPeriod[],
  reason: string,
  userId?: string
): AccountingPeriod[] {
  return periods.map((p) => {
    if (p.id === periodId) {
      return {
        ...p,
        status: 'open' as const,
        reopenedAt: new Date().toISOString(),
        reopenedBy: userId,
        reopenReason: reason
      };
    }
    return p;
  });
}
