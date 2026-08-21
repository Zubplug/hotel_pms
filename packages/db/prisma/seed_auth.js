const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const permissionsList = [
  // Core Modules
  { name: 'ACCESS_FRONT_DESK', resource: 'SYSTEM', action: 'ACCESS', description: 'Access Front Desk module' },
  { name: 'ACCESS_POS', resource: 'SYSTEM', action: 'ACCESS', description: 'Access POS module' },
  { name: 'ACCESS_HOUSEKEEPING', resource: 'SYSTEM', action: 'ACCESS', description: 'Access Housekeeping module' },
  { name: 'ACCESS_CASH_MANAGEMENT', resource: 'SYSTEM', action: 'ACCESS', description: 'Access Cash Management module' },
  { name: 'ACCESS_INVENTORY', resource: 'SYSTEM', action: 'ACCESS', description: 'Access Inventory module' },
  { name: 'ACCESS_MANAGEMENT', resource: 'SYSTEM', action: 'ACCESS', description: 'Access Management module' },
  { name: 'ACCESS_NIGHT_AUDIT', resource: 'SYSTEM', action: 'ACCESS', description: 'Access Night Audit module' },
  { name: 'ACCESS_SYNC_CENTER', resource: 'SYSTEM', action: 'ACCESS', description: 'Access Sync Center module' },
  { name: 'ACCESS_MAINTENANCE', resource: 'SYSTEM', action: 'ACCESS', description: 'Access Maintenance module' },
  { name: 'ACCESS_REPORTS', resource: 'SYSTEM', action: 'ACCESS', description: 'Access Reports module' },

  // POS
  { name: 'PROCESS_CASH_PAYMENT', resource: 'POS', action: 'CREATE', description: 'Process cash payments' },
  { name: 'PROCESS_CARD_PAYMENT', resource: 'POS', action: 'CREATE', description: 'Process card payments' },
  { name: 'PROCESS_ROOM_CHARGE', resource: 'POS', action: 'CREATE', description: 'Process room charges' },
  { name: 'ACCESS_POS_SETTINGS', resource: 'POS', action: 'ACCESS', description: 'Access POS settings' },

  // Cash Management
  { name: 'VIEW_CASH_HANDOVERS', resource: 'CASH', action: 'READ', description: 'View cash handovers' },
  { name: 'CONFIRM_CASH_HANDOVER', resource: 'CASH', action: 'UPDATE', description: 'Confirm cash handover' },
  { name: 'OPEN_SAFE', resource: 'CASH', action: 'UPDATE', description: 'Open safe' },
  { name: 'DEPOSIT_SAFE', resource: 'CASH', action: 'CREATE', description: 'Deposit to safe' },
  { name: 'VIEW_CASH_LEDGER', resource: 'CASH', action: 'READ', description: 'View cash ledger' },

  // Refunds & Voids
  { name: 'ACCESS_REFUNDS', resource: 'REFUND', action: 'ACCESS', description: 'Access refunds' },
  { name: 'PROCESS_REFUND', resource: 'REFUND', action: 'CREATE', description: 'Process refund' },
  { name: 'APPROVE_REFUND', resource: 'REFUND', action: 'UPDATE', description: 'Approve refund' },
  { name: 'LIMIT_REFUND_50K', resource: 'REFUND', action: 'LIMIT', description: 'Refund limit 50K' },
  { name: 'LIMIT_REFUND_250K', resource: 'REFUND', action: 'LIMIT', description: 'Refund limit 250K' },
  { name: 'LIMIT_REFUND_UNLIMITED', resource: 'REFUND', action: 'LIMIT', description: 'Unlimited refunds' },
  { name: 'ACCESS_VOID', resource: 'VOID', action: 'ACCESS', description: 'Access voids' },
  { name: 'AUTHORIZE_VOID', resource: 'VOID', action: 'UPDATE', description: 'Authorize voids' },
  { name: 'AUTHORIZE_POST_KITCHEN_VOID', resource: 'VOID', action: 'UPDATE', description: 'Authorize voids after kitchen printing' },

  // Emergency
  { name: 'USE_EMERGENCY_CASHIER', resource: 'EMERGENCY', action: 'CREATE', description: 'Use emergency cashier' },
  { name: 'AUTHORIZE_EMERGENCY_BANK', resource: 'EMERGENCY', action: 'UPDATE', description: 'Authorize emergency bank' },

  // Misc
  { name: 'ACCESS_DISCOUNTS', resource: 'DISCOUNT', action: 'ACCESS', description: 'Access discounts' },
  { name: 'AUTHORIZE_DISCOUNT', resource: 'DISCOUNT', action: 'UPDATE', description: 'Authorize discounts' },
  { name: 'APPROVE_DRAWER_VARIANCE', resource: 'CASH', action: 'UPDATE', description: 'Approve drawer variance' },
  { name: 'OVERRIDE_NIGHT_AUDIT', resource: 'AUDIT', action: 'UPDATE', description: 'Override night audit' },
  { name: 'POST_CITY_LEDGER', resource: 'LEDGER', action: 'CREATE', description: 'Post to city ledger' },
];

const systemRoles = {
  SUPER_ADMIN: permissionsList.map(p => p.name),
  ADMIN: permissionsList.map(p => p.name),
  DIRECTOR: permissionsList.map(p => p.name),
  EXECUTIVE: permissionsList.map(p => p.name),
  MANAGER: [
    'ACCESS_FRONT_DESK', 'ACCESS_POS', 'ACCESS_HOUSEKEEPING', 'ACCESS_CASH_MANAGEMENT', 
    'ACCESS_INVENTORY', 'ACCESS_MANAGEMENT', 'ACCESS_NIGHT_AUDIT', 'ACCESS_SYNC_CENTER', 'ACCESS_MAINTENANCE',
    'ACCESS_REFUNDS', 'LIMIT_REFUND_250K', 'PROCESS_REFUND', 'APPROVE_REFUND',
    'ACCESS_VOID', 'ACCESS_DISCOUNTS', 'AUTHORIZE_VOID', 'AUTHORIZE_DISCOUNT', 
    'APPROVE_DRAWER_VARIANCE', 'OVERRIDE_NIGHT_AUDIT', 'POST_CITY_LEDGER', 'ACCESS_REPORTS',
    'VIEW_CASH_HANDOVERS', 'CONFIRM_CASH_HANDOVER', 'OPEN_SAFE', 'DEPOSIT_SAFE', 'VIEW_CASH_LEDGER',
    'USE_EMERGENCY_CASHIER', 'AUTHORIZE_EMERGENCY_BANK', 'PROCESS_CASH_PAYMENT', 'PROCESS_CARD_PAYMENT', 'PROCESS_ROOM_CHARGE'
  ],
  FRONT_DESK: [
    'ACCESS_FRONT_DESK', 'ACCESS_HOUSEKEEPING', 'ACCESS_REFUNDS', 'LIMIT_REFUND_50K', 'PROCESS_REFUND', 'ACCESS_REPORTS'
  ],
  RECEPTIONIST: [
    'ACCESS_FRONT_DESK', 'ACCESS_HOUSEKEEPING', 'ACCESS_REFUNDS', 'LIMIT_REFUND_50K', 'PROCESS_REFUND', 'ACCESS_REPORTS'
  ],
  CASHIER: [
    'ACCESS_POS', 'ACCESS_CASH_MANAGEMENT', 'PROCESS_CASH_PAYMENT', 'PROCESS_CARD_PAYMENT', 'PROCESS_ROOM_CHARGE'
  ],
  BARTENDER: [
    'ACCESS_POS', 'ACCESS_CASH_MANAGEMENT', 'PROCESS_CASH_PAYMENT', 'PROCESS_CARD_PAYMENT', 'PROCESS_ROOM_CHARGE'
  ],
  WAITER: [
    'ACCESS_POS'
  ],
  HOUSEKEEPER: [
    'ACCESS_HOUSEKEEPING'
  ],
  NIGHT_AUDITOR: [
    'ACCESS_FRONT_DESK', 'ACCESS_NIGHT_AUDIT', 'ACCESS_REPORTS'
  ],
  MAINTENANCE: [
    'ACCESS_MAINTENANCE'
  ],
  INVENTORY_MANAGER: [
    'ACCESS_INVENTORY'
  ]
};

async function main() {
  console.log('Seeding Permissions and System Roles...');

  const org = await prisma.organization.findFirst({ where: { slug: 'lodgecore' } });
  if (!org) {
    console.error('Organization not found!');
    return;
  }
  
  console.log('Org found. Upserting permissions in batch...');

  await Promise.all(permissionsList.map(async (perm) => {
    const existing = await prisma.permission.findUnique({ where: { name: perm.name } });
    if (existing) {
      return prisma.permission.update({
        where: { id: existing.id },
        data: { resource: perm.resource, action: perm.action, description: perm.description }
      });
    } else {
      return prisma.permission.create({ data: perm });
    }
  }));

  console.log('Permissions upserted. Reconciling roles...');

  for (const [roleName, capabilities] of Object.entries(systemRoles)) {
    console.log(`Processing role: ${roleName}`);
    let role = await prisma.role.findFirst({ where: { organizationId: org.id, name: roleName, isSystem: true } });
    if (!role) {
      role = await prisma.role.create({
        data: {
          organizationId: org.id,
          name: roleName,
          isSystem: true,
          description: `System Role: ${roleName}`
        }
      });
    }

    if (role.isSystem) {
      const dbPerms = await prisma.permission.findMany({
        where: { name: { in: capabilities } }
      });
      
      const currentAssignments = await prisma.rolePermission.findMany({
        where: { roleId: role.id }
      });
      const currentPermIds = currentAssignments.map(a => a.permissionId);

      const toAdd = dbPerms.filter(p => !currentPermIds.includes(p.id));
      if (toAdd.length > 0) {
        await Promise.all(toAdd.map(p => prisma.rolePermission.create({
          data: { roleId: role.id, permissionId: p.id }
        })));
        console.log(`  Added ${toAdd.length} permissions to ${roleName}`);
      }
      
      const toRemove = currentAssignments.filter(curr => !dbPerms.find(dp => dp.id === curr.permissionId));
      if (toRemove.length > 0) {
        await Promise.all(toRemove.map(curr => prisma.rolePermission.delete({
          where: {
            roleId_permissionId: { roleId: role.id, permissionId: curr.permissionId }
          }
        })));
        console.log(`  Removed ${toRemove.length} permissions from ${roleName}`);
      }
    }
  }

  console.log('Finished seeding Auth Permissions!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
