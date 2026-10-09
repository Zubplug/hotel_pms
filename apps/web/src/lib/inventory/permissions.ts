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
  'inventory.read': ['CEO', 'SUPER_ADMIN', 'MANAGER', 'DIRECTOR', 'GENERAL_CASHIER', 'INVENTORY_MANAGER', 'STOCK_MANAGER', 'PROCUREMENT_MANAGER', 'FNB_MANAGER', 'OUTLET_HEAD'],

  // Managing stock items, warehouses, and general inventory master data
  'inventory.manage': ['CEO', 'SUPER_ADMIN', 'MANAGER', 'DIRECTOR', 'STOCK_MANAGER'],
  // F&B managers own recipe composition and target-margin maintenance without
  // receiving permission to administer warehouse stock masters.
  'inventory.recipe.manage': ['CEO', 'SUPER_ADMIN', 'MANAGER', 'DIRECTOR', 'FNB_MANAGER', 'RESTAURANT_MANAGER'],
  // F&B managers may correct live balances in their assigned outlet warehouse only.
  'inventory.outlet.manage': ['CEO', 'SUPER_ADMIN', 'MANAGER', 'DIRECTOR', 'FNB_MANAGER', 'OUTLET_HEAD'],

  'inventory.alert.resolve': ['CEO', 'SUPER_ADMIN', 'MANAGER', 'DIRECTOR', 'INVENTORY_MANAGER', 'STOCK_KEEPER', 'STOCK_MANAGER'],

  // Creating a stock adjustment (creates an ApprovalRequest)
  'inventory.adjust': ['CEO', 'SUPER_ADMIN', 'MANAGER', 'DIRECTOR', 'STOCK_MANAGER'],

  // One-time opening balances for legacy stock migration into the main store.
  'inventory.opening.balance': ['CEO', 'SUPER_ADMIN', 'MANAGER', 'DIRECTOR', 'GENERAL_CASHIER', 'INVENTORY_MANAGER', 'STOCK_MANAGER'],

  // Approving a stock adjustment
  'inventory.adjust.approve': ['CEO', 'SUPER_ADMIN', 'MANAGER', 'DIRECTOR'],

  // Creating a cost adjustment request (exceptional valuation changes)
  'inventory.cost.adjust': ['CEO', 'SUPER_ADMIN', 'MANAGER', 'DIRECTOR'],

  // Approving a cost adjustment request
  'inventory.cost.approve': ['CEO', 'SUPER_ADMIN', 'DIRECTOR'],

  // Creating a GRN and submitting it
  'inventory.receive': ['CEO', 'SUPER_ADMIN', 'MANAGER', 'DIRECTOR', 'INVENTORY_MANAGER', 'STOCK_KEEPER', 'STOCK_MANAGER', 'PROCUREMENT_MANAGER'],

  // Approving a submitted GRN
  'inventory.approve': ['CEO', 'SUPER_ADMIN', 'MANAGER', 'DIRECTOR'],

  // Posting an approved GRN to stock
  'inventory.post': ['CEO', 'SUPER_ADMIN', 'MANAGER', 'DIRECTOR'],

  // Cancelling a draft or submitted GRN
  'inventory.cancel': ['CEO', 'SUPER_ADMIN', 'MANAGER', 'DIRECTOR', 'STOCK_MANAGER', 'PROCUREMENT_MANAGER'],

  // Reversing a posted GRN (exceptional operation)
  'inventory.reverse': ['CEO', 'SUPER_ADMIN', 'DIRECTOR'],

  // Creating a stock transfer.
  // FNB_MANAGER can raise a stock request (main → their outlet); Stock Manager can create direct pushes.
  'inventory.transfer': ['CEO', 'SUPER_ADMIN', 'MANAGER', 'DIRECTOR', 'INVENTORY_MANAGER', 'OUTLET_HEAD', 'STOCK_KEEPER', 'STOCK_MANAGER', 'FNB_MANAGER'],

  // Approving a stock transfer.
  // STOCK_MANAGER / STOCK_KEEPER approve F&B-requested transfers and fulfil them.
  // Senior management approve other inter-warehouse transfers.
  'inventory.transfer.approve': ['CEO', 'SUPER_ADMIN', 'MANAGER', 'DIRECTOR', 'ACCOUNTANT', 'FINANCE_MANAGER', 'GENERAL_CASHIER', 'GENERAL_MANAGER', 'HOTEL_MANAGER', 'STOCK_MANAGER', 'STOCK_KEEPER'],

  // Issuing approved stock to an outlet is performed by stock control staff.
  'inventory.transfer.issue': ['CEO', 'SUPER_ADMIN', 'MANAGER', 'DIRECTOR', 'STOCK_KEEPER', 'STOCK_MANAGER'],

  // Receiving / confirming receipt of an issued transfer.
  // Flow A: FNB_MANAGER is the receiver for their own outlet requests.
  // Flow B: Top management receive/confirm Stock-Manager-initiated pushes.
  'inventory.transfer.receive': ['CEO', 'SUPER_ADMIN', 'MANAGER', 'DIRECTOR', 'FNB_MANAGER', 'ACCOUNTANT', 'GENERAL_MANAGER', 'GENERAL_CASHIER'],

  // Completing / closing a transfer (used as a management sign-off on Flow B).
  'inventory.transfer.complete': ['CEO', 'SUPER_ADMIN', 'MANAGER', 'DIRECTOR', 'ACCOUNTANT', 'GENERAL_MANAGER', 'GENERAL_CASHIER'],

  // Creating/managing a stocktake worksheet
  'inventory.stocktake': ['CEO', 'SUPER_ADMIN', 'MANAGER', 'DIRECTOR', 'INVENTORY_MANAGER', 'STOCK_MANAGER', 'STOCK_KEEPER', 'FNB_MANAGER', 'OUTLET_HEAD'],

  // Approving a completed stocktake
  'inventory.stocktake.approve': ['CEO', 'SUPER_ADMIN', 'MANAGER', 'DIRECTOR'],

  // Viewing reports
  'inventory.report': ['CEO', 'SUPER_ADMIN', 'MANAGER', 'DIRECTOR', 'STOCK_MANAGER', 'PROCUREMENT_MANAGER', 'FNB_MANAGER', 'OUTLET_HEAD'],

  // Managing suppliers
  'procurement.supplier.manage': ['CEO', 'SUPER_ADMIN', 'MANAGER', 'DIRECTOR', 'STOCK_MANAGER', 'STOCK_KEEPER', 'PROCUREMENT_MANAGER'],

  // Creating and submitting POs
  // Stock staff may prepare/save draft POs; approval remains restricted below.
  'procurement.po.create': ['CEO', 'SUPER_ADMIN', 'MANAGER', 'DIRECTOR', 'INVENTORY_MANAGER', 'STOCK_MANAGER', 'STOCK_KEEPER', 'PROCUREMENT_MANAGER'],

  // Approving a PO - explicitly excludes PROCUREMENT_MANAGER for separation of duties
  'procurement.po.approve': ['ACCOUNTANT', 'GENERAL_MANAGER', 'SUPER_ADMIN'],

  // Stage-1 reviewers may correct submitted PO lines before approval.
  'procurement.po.adjust': ['ACCOUNTANT', 'GENERAL_MANAGER', 'SUPER_ADMIN'],

  // Cancelling an approved PO
  'procurement.po.cancel': ['CEO', 'SUPER_ADMIN', 'MANAGER', 'DIRECTOR'],
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
