import { PrismaClient } from './packages/db/node_modules/@prisma/client/index.js'
const prisma = new PrismaClient()

async function main() {
  const org = await prisma.organization.findFirst({ where: { slug: 'lodgecore' } })
  if (!org) {
    console.log("Org not found")
    return
  }

  // Find permissions or create them
  const permsToGrant = [
    'ACCESS_KEYCARD_READ',
    'ACCESS_KEYCARD_ENCODING',
    'ACCESS_KEYCARD_CANCEL',
    'ACCESS_PRINTER_MANAGEMENT', // might be a printer permission?
    'ACCESS_FRONTDESK'
  ]

  let permissionIds: string[] = []
  for (const perm of permsToGrant) {
    let p = await prisma.permission.findFirst({ where: { name: perm } })
    if (!p) {
      p = await prisma.permission.create({
        data: {
          name: perm,
          description: `Permission for ${perm}`,
          module: 'HARDWARE'
        }
      })
    }
    permissionIds.push(p.id)
  }

  // Find roles that might belong to receptionist (e.g. Front Desk, Receptionist)
  const roles = await prisma.role.findMany()
  console.log("Found roles:", roles.map(r => r.name))

  for (const role of roles) {
    if (role.name.toLowerCase().includes('reception') || role.name.toLowerCase().includes('front')) {
      console.log(`Granting permissions to role ${role.name}...`)
      for (const pId of permissionIds) {
        // check if RolePermission exists
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

  // Also what about the user explicitly?
  // Let's list users
  const users = await prisma.user.findMany({ include: { staff: true } })
  console.log("Users:", users.map(u => ({ email: u.email, roleId: u.roleId, staff: u.staff?.position })))
}
main().catch(console.error).finally(() => prisma.$disconnect())
