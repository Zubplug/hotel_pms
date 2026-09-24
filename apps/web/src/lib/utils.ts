import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency: string = 'NGN') {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
  }).format(amount);
}

/** Formats editable monetary values for display without changing the value sent to the API. */
export function formatAmountInput(value: string | number | null | undefined, decimals = 2) {
  const raw = String(value ?? '').replace(/,/g, '').replace(/[^0-9.]/g, '');
  if (!raw) return '';
  const [whole = '', fraction] = raw.split('.');
  const grouped = (whole || '0').replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (fraction !== undefined && decimals > 0) return `${grouped}.${fraction.slice(0, decimals)}`;
  return grouped;
}

export function parseAmountInput(value: string | number | null | undefined) {
  const parsed = String(value ?? '').replace(/,/g, '');
  return parsed;
}

export function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
