export const COMPLIMENTARY_REASONS = [
  { value: 'GUEST_SERVICE_RECOVERY', label: 'Guest service recovery' },
  { value: 'VIP_OR_CONTRACTUAL_BENEFIT', label: 'VIP or contractual benefit' },
  { value: 'PROMOTIONAL_ENTITLEMENT', label: 'Promotional entitlement' },
  { value: 'EVENT_OR_BANQUET_ENTITLEMENT', label: 'Event or banquet entitlement' },
  { value: 'STAFF_DUTY_MEAL', label: 'Staff duty meal' },
  { value: 'STAFF_RECOGNITION_BENEFIT', label: 'Staff recognition benefit' },
  { value: 'MANAGEMENT_AUTHORIZATION', label: 'Management authorization' },
] as const;

export type ComplimentaryReasonCode = (typeof COMPLIMENTARY_REASONS)[number]['value'];

export function complimentaryReasonLabel(value: string) {
  return COMPLIMENTARY_REASONS.find((reason) => reason.value === value)?.label || value;
}
