import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const permissions = [
    { name: 'corporate_account:view', resource: 'corporate_account', action: 'view', description: 'View corporate accounts' },
    { name: 'corporate_account:create', resource: 'corporate_account', action: 'create', description: 'Create corporate accounts' },
    { name: 'corporate_account:edit', resource: 'corporate_account', action: 'edit', description: 'Edit corporate accounts basic details' },
    { name: 'corporate_account:change_credit_limit', resource: 'corporate_account', action: 'change_credit_limit', description: 'Change corporate credit limit', riskLevel: 'HIGH' },
    { name: 'corporate_account:change_deposit_policy', resource: 'corporate_account', action: 'change_deposit_policy', description: 'Change corporate deposit policy', riskLevel: 'HIGH' },
    { name: 'corporate_account:deactivate', resource: 'corporate_account', action: 'deactivate', description: 'Deactivate corporate accounts' },
    { name: 'corporate_account:view_city_ledger', resource: 'corporate_account', action: 'view_city_ledger', description: 'View associated City Ledger' }
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { name: perm.name },
      update: perm,
      create: perm
    });
  }

  const roleGrants = {
    NIGHT_AUDITOR: ['corporate_account:view', 'corporate_account:view_city_ledger'],
    GENERAL_CASHIER: ['corporate_account:view', 'corporate_account:view_city_ledger'],
    ADMIN: ['corporate_account:view', 'corporate_account:create', 'corporate_account:edit', 'corporate_account:view_city_ledger'],
    ACCOUNTANT: ['corporate_account:view', 'corporate_account:create', 'corporate_account:edit', 'corporate_account:change_credit_limit', 'corporate_account:change_deposit_policy', 'corporate_account:deactivate', 'corporate_account:view_city_ledger'],
    GENERAL_MANAGER: ['corporate_account:view', 'corporate_account:create', 'corporate_account:edit', 'corporate_account:change_credit_limit', 'corporate_account:change_deposit_policy', 'corporate_account:deactivate', 'corporate_account:view_city_ledger']
  };

  for (const [roleName, permNames] of Object.entries(roleGrants)) {
    const roles = await prisma.role.findMany({ where: { name: roleName } });
    if (!roles.length) {
      console.log(`Role ${roleName} not found`);
      continue;
    }
    
    for (const role of roles) {
      for (const permName of permNames) {
        const perm = await prisma.permission.findUnique({ where: { name: permName } });
        if (perm) {
          const existing = await prisma.rolePermission.findFirst({
            where: { roleId: role.id, permissionId: perm.id }
          });
          if (!existing) {
            await prisma.rolePermission.create({
              data: { roleId: role.id, permissionId: perm.id }
            });
            console.log(`Granted ${permName} to ${roleName}`);
          }
        }
      }
    }
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
