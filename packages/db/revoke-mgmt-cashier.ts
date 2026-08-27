import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Revoking ACCESS_MANAGEMENT from GENERAL_CASHIER...')

  const role = await prisma.role.findFirst({
    where: { name: 'GENERAL_CASHIER' }
  })
  
  if (!role) {
    console.log('Role not found')
    return
  }

  const perm2 = await prisma.permission.findFirst({ where: { name: 'ACCESS_MANAGEMENT' } })
  if (perm2) {
    await prisma.rolePermission.deleteMany({
      where: { roleId: role.id, permissionId: perm2.id }
    })
    console.log('Permission revoked.')
  } else {
    console.log('Permission not found.')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
