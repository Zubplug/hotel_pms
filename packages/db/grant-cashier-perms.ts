import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Granting capabilities to GENERAL_CASHIER role...')

  const role = await prisma.role.findFirst({
    where: { name: 'GENERAL_CASHIER' }
  })
  
  if (!role) {
    console.log('Role not found')
    return
  }

  // Find or create the permission
  const permName = 'ACCESS_CASH_MANAGEMENT'
  let perm = await prisma.permission.findFirst({ where: { name: permName } })
  if (!perm) {
    perm = await prisma.permission.create({
      data: {
        name: permName,
        resource: 'CashOffice',
        action: 'access',
        description: 'Access the Cash Office module',
        isSystem: true
      }
    })
  }
  
  // Also add ACCESS_MANAGEMENT so they can see the main dashboard / reports if they need to
  let perm2 = await prisma.permission.findFirst({ where: { name: 'ACCESS_MANAGEMENT' } })
  if (!perm2) {
    perm2 = await prisma.permission.create({
      data: {
        name: 'ACCESS_MANAGEMENT',
        resource: 'Dashboard',
        action: 'access',
        description: 'Access the Management Dashboard',
        isSystem: true
      }
    })
  }

  // Grant permissions to role
  await prisma.rolePermission.upsert({
    where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
    update: {},
    create: { roleId: role.id, permissionId: perm.id }
  })
  
  await prisma.rolePermission.upsert({
    where: { roleId_permissionId: { roleId: role.id, permissionId: perm2.id } },
    update: {},
    create: { roleId: role.id, permissionId: perm2.id }
  })

  console.log('Capabilities granted successfully. User must re-login to see changes.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
