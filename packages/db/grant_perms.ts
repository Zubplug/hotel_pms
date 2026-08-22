import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Find permissions or create them
  const permsToGrant = [
    { name: 'ACCESS_KEYCARD_READ', resource: 'hardware', action: 'read' },
    { name: 'ACCESS_KEYCARD_ENCODING', resource: 'hardware', action: 'encode' },
    { name: 'ACCESS_KEYCARD_CANCEL', resource: 'hardware', action: 'cancel' }
  ]

  let permissionIds: string[] = []
  for (const perm of permsToGrant) {
    let p = await prisma.permission.findFirst({ where: { name: perm.name } })
    if (!p) {
      p = await prisma.permission.create({
        data: {
          name: perm.name,
          resource: perm.resource,
          action: perm.action,
          description: `Permission for ${perm.name}`
        }
      })
    }
    permissionIds.push(p.id)
  }

  const roles = await prisma.role.findMany()
  console.log("Found roles:", roles.map((r: any) => r.name))

  for (const role of roles) {
    if (role.name.toLowerCase().includes('reception') || role.name.toLowerCase().includes('front')) {
      console.log(`Granting permissions to role ${role.name}...`)
      for (const pId of permissionIds) {
        const exists = await prisma.rolePermission.findFirst({
          where: { roleId: role.id, permissionId: pId }
        })
        if (!exists) {
          await prisma.rolePermission.create({
            data: { roleId: role.id, permissionId: pId }
          })
          console.log(`Granted ${pId} to ${role.name}`)
        }
      }
    }
  }
}
main().catch(console.error).finally(() => prisma.$disconnect())
