import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Creating General Cashier User...')

  const org = await prisma.organization.findFirst()
  if (!org) {
    console.log('No organization found.')
    return
  }

  const propLagos = await prisma.property.findFirst({ where: { code: 'LAG-01' } })
  if (!propLagos) {
    console.log('No property found.')
    return
  }

  const email = 'cashier@lodgecore.com'
  const plainPassword = 'password123'
  
  // 1. Create Staff record
  const staff = await prisma.staff.upsert({
    where: { email },
    update: {},
    create: {
      organizationId: org.id,
      firstName: 'General',
      lastName: 'Cashier',
      email: email,
      department: 'Finance',
      position: 'Main Cashier',
      propertyAccess: [propLagos.id],
    }
  })

  // 2. Create Role if it doesn't exist
  const role = await prisma.role.findFirst({
    where: { name: 'GENERAL_CASHIER' }
  }) || await prisma.role.create({
    data: {
      organizationId: org.id,
      name: 'GENERAL_CASHIER',
      description: 'General Hotel Cashier',
      isSystem: true
    }
  })

  // 3. Create User record
  const passwordHash = await bcrypt.hash(plainPassword, 10)
  
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash }, // Reset password just in case
    create: {
      staffId: staff.id,
      email: email,
      passwordHash,
      isSuperAdmin: false,
    }
  })

  // 4. Assign Role
  const existingRole = await prisma.userRole.findFirst({
    where: { userId: user.id, roleId: role.id }
  })
  
  if (!existingRole) {
    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: role.id,
        propertyId: propLagos.id,
        grantedBy: user.id // Self granted for test script
      }
    })
  }

  console.log('\n--- General Cashier Details ---')
  console.log(`Email: ${email}`)
  console.log(`Password: ${plainPassword}`)
  console.log('-------------------------------\n')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
