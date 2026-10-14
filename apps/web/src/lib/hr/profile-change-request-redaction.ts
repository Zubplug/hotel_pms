const SENSITIVE_FIELDS = new Set([
  'bankAccountNumber',
  'bankName',
  'bankSortCode',
  'bankAccountName',
  'pfaName',
  'rsaPin',
  'baseSalary',
  'housingAllowance',
  'transportAllowance',
  'otherAllowances',
  'nin',
  'bvn',
  'taxId',
  'tin',
]);

function redactStaffProfile(value: string | null, canViewSensitive: boolean): string | null {
  if (!value || canViewSensitive) return value;

  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object') {
      for (const field of SENSITIVE_FIELDS) delete parsed[field];
      if (parsed.employeeProfile && typeof parsed.employeeProfile === 'object') {
        delete parsed.employeeProfile.nin;
        delete parsed.employeeProfile.bvn;
        delete parsed.employeeProfile.tin;
      }
      if (parsed.salaryStructure) parsed.salaryStructure = '[REDACTED]';
      return JSON.stringify(parsed);
    }
  } catch {
    return '[REDACTED]';
  }

  return value;
}

export function redactProfileChangeRequest<T extends { fieldName: string; currentValue?: string | null; proposedValue: string }>(
  request: T,
  canViewSensitive: boolean,
): T {
  if (canViewSensitive) return request;

  if (request.fieldName === 'staffProfile') {
    return {
      ...request,
      currentValue: redactStaffProfile(request.currentValue ?? null, false),
      proposedValue: redactStaffProfile(request.proposedValue, false) || '[REDACTED]',
    };
  }

  if (SENSITIVE_FIELDS.has(request.fieldName)) {
    return { ...request, currentValue: null, proposedValue: '[REDACTED SENSITIVE VALUE]' };
  }

  return request;
}
