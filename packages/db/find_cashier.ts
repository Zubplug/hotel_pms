import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    where: {
      roles: {
        some: {
          role: {
            name: {
              contains: 'Cashier',
              mode: 'insensitive'
            }
          }
        }
      }
    },
    select: {
      id: true,
      email: true,
      roles: {
        select: {
          role: {
            select: { name: true }
          }
        }
      }
    }
  })
  
  if (users.length === 0) {
    console.log("No Cashier found by Role name. Let's try finding the super admin.")
    const superAdmins = await prisma.user.findMany({ where: { isSuperAdmin: true } })
    console.log("Super Admins:", superAdmins.map(u => u.email))
  } else {
    console.log(JSON.stringify(users, null, 2))
  }
}

main().finally(() => prisma.$disconnect())
