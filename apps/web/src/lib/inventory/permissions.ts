/**
 * Server-side RBAC matrix for Inventory and Procurement.
 *
 * Each array contains the roles that are explicitly allowed to perform the action.
 * A user must have at least one of these roles OR be a SUPER_ADMIN.
 *
 * Note: These are checked in the API routes using `session.user.role`.
 */
export const INVENTORY_PERMISSIONS = {
  // Read access across the inventory dashboard
  'inventory.read': ['CEO', 'SUPER_ADMIN', 'MANAGER', 'GENERAL_CASHIER', 'INVENTORY_MANAGER', 'STOCK_MANAGER', 'PROCUREMENT_MANAGER'],

  // Managing stock items, warehouses, and general inventory master data
  'inventory.manage': ['CEO', 'SUPER_ADMIN', 'MANAGER', 'STOCK_MANAGER'],

  'inventory.alert.resolve': ['CEO', 'SUPER_ADMIN', 'MANAGER', 'INVENTORY_MANAGER', 'STOCK_KEEPER', 'STOCK_MANAGER'],

  // Creating a stock adjustment (creates an ApprovalRequest)
  'inventory.adjust': ['CEO', 'SUPER_ADMIN', 'MANAGER', 'STOCK_MANAGER'],

  // Approving a stock adjustment
  'inventory.adjust.approve': ['CEO', 'SUPER_ADMIN', 'MANAGER'],

  // Creating a cost adjustment request (exceptional valuation changes)
  'inventory.cost.adjust': ['CEO', 'SUPER_ADMIN', 'MANAGER'],

  // Approving a cost adjustment request
  'inventory.cost.approve': ['CEO', 'SUPER_ADMIN'],

  // Creating a GRN and submitting it
  'inventory.receive': ['CEO', 'SUPER_ADMIN', 'MANAGER', 'INVENTORY_MANAGER', 'STOCK_KEEPER', 'STOCK_MANAGER', 'PROCUREMENT_MANAGER'],

  // Approving a submitted GRN
  'inventory.approve': ['CEO', 'SUPER_ADMIN', 'MANAGER'],

  // Posting an approved GRN to stock
  'inventory.post': ['CEO', 'SUPER_ADMIN', 'MANAGER'],

  // Cancelling a draft or submitted GRN
  'inventory.cancel': ['CEO', 'SUPER_ADMIN', 'MANAGER', 'STOCK_MANAGER', 'PROCUREMENT_MANAGER'],

  // Reversing a posted GRN (exceptional operation)
  'inventory.reverse': ['CEO', 'SUPER_ADMIN'],

  // Creating a stock transfer
  'inventory.transfer': ['CEO', 'SUPER_ADMIN', 'MANAGER', 'INVENTORY_MANAGER', 'OUTLET_HEAD', 'STOCK_KEEPER', 'STOCK_MANAGER'],

  // Approving a stock transfer
  'inventory.transfer.approve': ['CEO', 'SUPER_ADMIN', 'MANAGER'],

  // Issuing approved stock to an outlet is performed by stock control staff.
  'inventory.transfer.issue': ['CEO', 'SUPER_ADMIN', 'MANAGER', 'STOCK_KEEPER', 'STOCK_MANAGER'],

  // Creating/managing a stocktake worksheet
  'inventory.stocktake': ['CEO', 'SUPER_ADMIN', 'MANAGER', 'INVENTORY_MANAGER', 'STOCK_MANAGER', 'STOCK_KEEPER'],

  // Approving a completed stocktake
  'inventory.stocktake.approve': ['CEO', 'SUPER_ADMIN', 'MANAGER'],

  // Viewing reports
  'inventory.report': ['CEO', 'SUPER_ADMIN', 'MANAGER', 'STOCK_MANAGER', 'PROCUREMENT_MANAGER'],

  // Managing suppliers
  'procurement.supplier.manage': ['CEO', 'SUPER_ADMIN', 'MANAGER', 'STOCK_MANAGER', 'STOCK_KEEPER', 'PROCUREMENT_MANAGER'],

  // Creating and submitting POs
  // Stock staff may prepare/save draft POs; approval remains restricted below.
  'procurement.po.create': ['CEO', 'SUPER_ADMIN', 'MANAGER', 'INVENTORY_MANAGER', 'STOCK_MANAGER', 'STOCK_KEEPER', 'PROCUREMENT_MANAGER'],

  // Approving a PO - explicitly excludes PROCUREMENT_MANAGER for separation of duties
  'procurement.po.approve': ['CEO', 'SUPER_ADMIN', 'MANAGER', 'GENERAL_CASHIER'],

  // Stage-1 reviewers may correct submitted PO lines before approval.
  'procurement.po.adjust': ['CEO', 'SUPER_ADMIN', 'MANAGER', 'GENERAL_CASHIER'],

  // Cancelling an approved PO
  'procurement.po.cancel': ['CEO', 'SUPER_ADMIN', 'MANAGER'],
};

/**
 * Validates if a role has the required permission.
 * Super Admins bypass checks.
 */
export function hasInventoryPermission(role: string, permission: keyof typeof INVENTORY_PERMISSIONS, isSuperAdmin?: boolean): boolean {
  const normalizedRole = String(role || '').toUpperCase();
  const effectiveRole = normalizedRole === 'STOCK_KEEPER' ? 'STOCK_MANAGER' : normalizedRole;

  if (isSuperAdmin || effectiveRole === 'SUPER_ADMIN') {
    return true;
  }

  const allowedRoles = INVENTORY_PERMISSIONS[permission];
  if (!allowedRoles) return false;

  return allowedRoles.includes(effectiveRole);
}
