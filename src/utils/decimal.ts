/**
 * Decimal-Safe Arithmetic Utility
 * Ensures financial calculations are not subject to standard binary floating-point inaccuracy.
 */

export function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function safeAdd(...numbers: number[]): number {
  return round2(numbers.reduce((sum, n) => sum + (n || 0), 0));
}

export function safeSub(a: number, b: number): number {
  return round2((a || 0) - (b || 0));
}

export function safeMul(a: number, b: number): number {
  return round2((a || 0) * (b || 0));
}

export function safeDiv(a: number, b: number): number {
  if (!b) return 0;
  return round2((a || 0) / b);
}

export function isEqualZero(num: number, epsilon = 0.005): boolean {
  return Math.abs(num) < epsilon;
}

export function formatCurrency(amount: number): string {
  const rounded = round2(amount || 0);
  return '₹' + rounded.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
