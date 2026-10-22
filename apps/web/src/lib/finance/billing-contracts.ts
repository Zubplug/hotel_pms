/**
 * Pure Phase 1 contracts for the Billing read model and invariant tests.
 *
 * These helpers deliberately do not read or write the database and do not
 * replace the existing posting services. They provide exact, deterministic
 * rules that query adapters and later mutation services can share.
 */

export type AllocationState = 'UNALLOCATED' | 'PARTIAL' | 'FULL';
export type ReconciliationState = 'POSTED_UNRECONCILED' | 'MATCHED' | 'EXCEPTION';

const SCALE = BigInt(4);
const UNIT = BigInt(10) ** SCALE;

function decimalUnits(value: string): bigint {
  const normalized = String(value).trim();
  if (!/^\d+(?:\.\d{1,4})?$/.test(normalized)) {
    throw new Error(`Invalid non-negative decimal: ${value}`);
  }
  const [whole, fraction = ''] = normalized.split('.');
  return BigInt(whole) * UNIT + BigInt(fraction.padEnd(Number(SCALE), '0'));
}

export function sumDecimal(values: readonly string[]): string {
  // Aggregated ledger balances may legitimately be negative (for example,
  // an overpaid folio or a City Ledger credit balance). Keep this generic
  // exact summation helper sign-safe; callers enforcing a non-negative
  // accounting invariant should use sumNonNegativeDecimal instead.
  if (values.some((value) => String(value).trim().startsWith('-'))) {
    return sumSignedDecimal(values);
  }
  return sumNonNegativeDecimal(values);
}

export function sumNonNegativeDecimal(values: readonly string[]): string {
  const total = values.reduce((sum, value) => sum + decimalUnits(value), BigInt(0));
  const whole = total / UNIT;
  const fraction = (total % UNIT).toString().padStart(Number(SCALE), '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function sumSignedDecimal(values: readonly string[]): string {
  const total = values.reduce((sum, value) => {
    const negative = String(value).trim().startsWith('-');
    const absolute = negative ? String(value).trim().slice(1) : String(value).trim();
    const units = decimalUnits(absolute);
    return sum + (negative ? -units : units);
  }, BigInt(0));
  const negative = total < BigInt(0);
  const absolute = negative ? -total : total;
  const whole = absolute / UNIT;
  const fraction = (absolute % UNIT).toString().padStart(Number(SCALE), '0').replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
}

/** Exact, four-decimal accounting comparison helpers. No tolerance is applied. */
export function decimalDifference(left: string, right: string): string {
  const normalizedRight = String(right).trim();
  // Negating a signed decimal needs to remove an existing minus sign first;
  // prefixing '-' blindly turns a negative operand into an invalid `--value`.
  const subtractedRight = normalizedRight.startsWith('-')
    ? normalizedRight.slice(1)
    : `-${normalizedRight}`;
  return sumSignedDecimal([left, subtractedRight]);
}

export function decimalIsZero(value: string): boolean {
  return sumSignedDecimal([value]) === '0';
}

export function decimalFromNumber(value: number): string {
  if (!Number.isFinite(value)) throw new Error(`Invalid decimal number: ${value}`);
  return value.toFixed(Number(SCALE)).replace(/\.?(0+)$/, '');
}

export function assertAllocationWithinAvailable(input: {
  receiptAmount: string;
  existingAllocations: readonly string[];
  requestedAmount: string;
  invoiceOutstanding?: string;
}): void {
  const allocated = decimalUnits(sumNonNegativeDecimal(input.existingAllocations));
  const requested = decimalUnits(input.requestedAmount);
  const receipt = decimalUnits(input.receiptAmount);
  const invoiceOutstanding = input.invoiceOutstanding === undefined
    ? null
    : decimalUnits(input.invoiceOutstanding);

  if (allocated + requested > receipt) {
    throw new Error('ALLOCATION_EXCEEDS_RECEIPT');
  }
  if (invoiceOutstanding !== null && requested > invoiceOutstanding) {
    throw new Error('ALLOCATION_EXCEEDS_INVOICE');
  }
}

export function allocationState(receiptAmount: string, allocations: readonly string[]): AllocationState {
  const receipt = decimalUnits(receiptAmount);
  const allocated = decimalUnits(sumNonNegativeDecimal(allocations));
  if (allocated === BigInt(0)) return 'UNALLOCATED';
  if (allocated >= receipt) return 'FULL';
  return 'PARTIAL';
}

export function folioPaymentPolicy(amount: string, outstanding: string): 'ACCEPT' | 'REJECT_OVERPAYMENT' {
  return decimalUnits(amount) > decimalUnits(outstanding) ? 'REJECT_OVERPAYMENT' : 'ACCEPT';
}

export function cityLedgerPaymentPolicy(_amount: string, _outstanding: string): 'ACCEPT_APPLIED_OR_ADVANCE' {
  void _amount;
  void _outstanding;
  return 'ACCEPT_APPLIED_OR_ADVANCE';
}

export function reconciliationState(input: {
  postingStatus: 'POSTED' | 'PENDING' | 'FAILED' | 'REVERSED';
  externalMatch: 'MATCHED' | 'EXCEPTION' | 'NONE';
}): ReconciliationState {
  if (input.externalMatch === 'EXCEPTION') return 'EXCEPTION';
  if (input.externalMatch === 'MATCHED') return 'MATCHED';
  return 'POSTED_UNRECONCILED';
}
