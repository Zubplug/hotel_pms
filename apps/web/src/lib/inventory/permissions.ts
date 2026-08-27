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
  'inventory.read': ['CEO', 'SUPER_ADMIN', 'MANAGER', 'STOCK_MANAGER', 'PROCUREMENT_MANAGER'],
  
  // Managing stock items, warehouses, and general inventory master data
  'inventory.manage': ['CEO', 'SUPER_ADMIN', 'MANAGER', 'STOCK_MANAGER'],
  
  // Creating a stock adjustment (creates an ApprovalRequest)
  'inventory.adjust': ['CEO', 'SUPER_ADMIN', 'MANAGER', 'STOCK_MANAGER'],
  
  // Approving a stock adjustment
  'inventory.adjust.approve': ['CEO', 'SUPER_ADMIN', 'MANAGER'],
  
  // Creating a cost adjustment request (exceptional valuation changes)
  'inventory.cost.adjust': ['CEO', 'SUPER_ADMIN', 'MANAGER'],
  
  // Approving a cost adjustment request
  'inventory.cost.approve': ['CEO', 'SUPER_ADMIN'],
  
  // Creating a GRN and submitting it
  'inventory.receive': ['CEO', 'SUPER_ADMIN', 'MANAGER', 'STOCK_MANAGER', 'PROCUREMENT_MANAGER'],
  
  // Approving a submitted GRN
  'inventory.approve': ['CEO', 'SUPER_ADMIN', 'MANAGER'],

  // Posting an approved GRN to stock
  'inventory.post': ['CEO', 'SUPER_ADMIN', 'MANAGER'],

  // Cancelling a draft or submitted GRN
  'inventory.cancel': ['CEO', 'SUPER_ADMIN', 'MANAGER', 'STOCK_MANAGER', 'PROCUREMENT_MANAGER'],

  // Reversing a posted GRN (exceptional operation)
  'inventory.reverse': ['CEO', 'SUPER_ADMIN'],
  
  // Creating a stock transfer
  'inventory.transfer': ['CEO', 'SUPER_ADMIN', 'MANAGER', 'STOCK_MANAGER'],
  
  // Approving a stock transfer
  'inventory.transfer.approve': ['CEO', 'SUPER_ADMIN', 'MANAGER'],
  
  // Viewing reports
  'inventory.report': ['CEO', 'SUPER_ADMIN', 'MANAGER', 'STOCK_MANAGER', 'PROCUREMENT_MANAGER'],
  
  // Managing suppliers
  'procurement.supplier.manage': ['CEO', 'SUPER_ADMIN', 'MANAGER', 'PROCUREMENT_MANAGER'],
  
  // Creating and submitting POs
  'procurement.po.create': ['CEO', 'SUPER_ADMIN', 'MANAGER', 'PROCUREMENT_MANAGER'],
  
  // Approving a PO - explicitly excludes PROCUREMENT_MANAGER for separation of duties
  'procurement.po.approve': ['CEO', 'SUPER_ADMIN', 'MANAGER'],
  
  // Cancelling an approved PO
  'procurement.po.cancel': ['CEO', 'SUPER_ADMIN', 'MANAGER'],
};

/**
 * Validates if a role has the required permission.
 * Super Admins bypass checks.
 */
export function hasInventoryPermission(role: string, permission: keyof typeof INVENTORY_PERMISSIONS, isSuperAdmin?: boolean): boolean {
  if (isSuperAdmin || role === 'SUPER_ADMIN') {
    return true;
  }
  
  const allowedRoles = INVENTORY_PERMISSIONS[permission];
  if (!allowedRoles) return false;
  
  return allowedRoles.includes(role);
}
