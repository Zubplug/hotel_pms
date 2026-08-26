/**
 * approval-config.ts
 *
 * Reads and writes per-property approval flow configuration stored in
 * Property.settings.approvalFlows (JSON). Falls back to sensible defaults
 * when no config exists for a property.
 *
 * This is the single source of truth for:
 *   - Which roles can approve a given flow type
 *   - How many approval steps are required
 *   - Minimum amount threshold before approval is required
 *   - Whether the requester may also approve their own request
 */
import prisma from '@hotel-pms/db';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ApprovalFlowType =
  | 'PURCHASE_ORDER'
  | 'INVENTORY_ADJUSTMENT'
  | 'STOCK_TRANSFER';

export interface ApprovalFlowConfig {
  /** Whether this flow requires approval at all */
  enabled: boolean;
  /** Roles that may approve requests in this flow */
  approverRoles: string[];
  /** Number of distinct approvals required before the request is considered approved */
  steps: 1 | 2;
  /**
   * Minimum monetary amount (in property base currency) above which
   * approval is required. 0 = always require approval when enabled.
   */
  minAmount: number;
  /** Prevent the person who created the request from also approving it */
  selfApproveBlocked: boolean;
}

export interface PropertyApprovalFlows {
  PURCHASE_ORDER: ApprovalFlowConfig;
  INVENTORY_ADJUSTMENT: ApprovalFlowConfig;
  STOCK_TRANSFER: ApprovalFlowConfig;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

/** 
 * Mirrors the current hardcoded behaviour in permissions.ts so that
 * properties without a saved config behave exactly as before. 
 */
export const DEFAULT_APPROVAL_FLOWS: PropertyApprovalFlows = {
  PURCHASE_ORDER: {
    enabled: true,
    approverRoles: ['CEO', 'SUPER_ADMIN', 'MANAGER'],
    steps: 1,
    minAmount: 0,
    selfApproveBlocked: true,
  },
  INVENTORY_ADJUSTMENT: {
    enabled: true,
    approverRoles: ['CEO', 'SUPER_ADMIN', 'MANAGER'],
    steps: 1,
    minAmount: 0,
    selfApproveBlocked: true,
  },
  STOCK_TRANSFER: {
    enabled: true,
    approverRoles: ['CEO', 'SUPER_ADMIN', 'MANAGER'],
    steps: 1,
    minAmount: 0,
    selfApproveBlocked: false,
  },
};

/** All roles that may appear in an approverRoles list */
export const APPROVABLE_ROLES: string[] = [
  'SUPER_ADMIN',
  'CEO',
  'DIRECTOR',
  'EXECUTIVE',
  'MANAGER',
  'FINANCE_MANAGER',
  'FRONT_DESK_MANAGER',
  'STOCK_MANAGER',
  'PROCUREMENT_MANAGER',
  'ACCOUNTANT',
];

// ─── Reader ───────────────────────────────────────────────────────────────────

/**
 * Returns the full approval flow config for a property,
 * merging any saved overrides with the defaults.
 */
export async function getApprovalFlows(
  propertyId: string
): Promise<PropertyApprovalFlows> {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { settings: true },
  });

  if (!property) return { ...DEFAULT_APPROVAL_FLOWS };

  const raw = property.settings as Record<string, any> | null;
  const saved: Partial<PropertyApprovalFlows> = raw?.approvalFlows ?? {};

  // Merge each flow key, defaulting missing sub-fields
  const merged: PropertyApprovalFlows = {} as PropertyApprovalFlows;
  for (const key of Object.keys(DEFAULT_APPROVAL_FLOWS) as ApprovalFlowType[]) {
    merged[key] = {
      ...DEFAULT_APPROVAL_FLOWS[key],
      ...(saved[key] ?? {}),
    };
  }
  return merged;
}

/**
 * Returns the config for a single flow type.
 */
export async function getFlowConfig(
  propertyId: string,
  flowType: ApprovalFlowType
): Promise<ApprovalFlowConfig> {
  const flows = await getApprovalFlows(propertyId);
  return flows[flowType];
}

// ─── Writer ───────────────────────────────────────────────────────────────────

/**
 * Saves updated approval flow config into Property.settings.approvalFlows.
 * Merges with the existing settings blob to avoid clobbering other keys.
 */
export async function saveApprovalFlows(
  propertyId: string,
  flows: Partial<PropertyApprovalFlows>
): Promise<void> {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { settings: true },
  });
  if (!property) throw new Error('Property not found');

  const existing = (property.settings as Record<string, any>) ?? {};

  // Deep-merge: don't overwrite unrelated settings keys
  const updatedApprovalFlows = {
    ...(existing.approvalFlows ?? {}),
    ...flows,
  };

  await prisma.property.update({
    where: { id: propertyId },
    data: {
      settings: {
        ...existing,
        approvalFlows: updatedApprovalFlows,
      },
    },
  });
}

// ─── Guard ────────────────────────────────────────────────────────────────────

export interface ApprovalGuardOptions {
  flowType: ApprovalFlowType;
  propertyId: string;
  /** Role of the current user requesting to approve */
  approverRole: string;
  approverIsSuperAdmin?: boolean;
  /** Staff ID of the person who originally created the request */
  requesterId?: string;
  /** Staff ID of the current user */
  approverId?: string;
  /** Monetary amount of the request (to compare against minAmount threshold) */
  amount?: number;
}

export interface ApprovalGuardResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Central approval guard. Call this before executing any approval action.
 *
 * Returns { allowed: true } or { allowed: false, reason: string }.
 */
export async function canApprove(
  opts: ApprovalGuardOptions
): Promise<ApprovalGuardResult> {
  // Super admins bypass all approval guards
  if (opts.approverIsSuperAdmin) return { allowed: true };

  const config = await getFlowConfig(opts.propertyId, opts.flowType);

  if (!config.enabled) return { allowed: true }; // Flow has no approval gate

  // Amount below threshold → no approval required
  if (opts.amount !== undefined && config.minAmount > 0 && opts.amount < config.minAmount) {
    return { allowed: true };
  }

  // Role check
  if (!config.approverRoles.includes(opts.approverRole)) {
    return {
      allowed: false,
      reason: `Your role (${opts.approverRole}) is not authorised to approve ${opts.flowType.replace('_', ' ')} requests. Allowed roles: ${config.approverRoles.join(', ')}.`,
    };
  }

  // Self-approval check
  if (
    config.selfApproveBlocked &&
    opts.requesterId &&
    opts.approverId &&
    opts.requesterId === opts.approverId
  ) {
    return {
      allowed: false,
      reason: 'Self-approval is not permitted. A different staff member must approve this request.',
    };
  }

  return { allowed: true };
}
