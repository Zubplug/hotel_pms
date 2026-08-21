import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Fetching staff without posPinHash...')
  
  const staffToUpdate = await prisma.staff.findMany({
    where: {
      posPinHash: null
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      department: true,
      position: true
    }
  })

  console.log(`\nFound ${staffToUpdate.length} staff without a PIN:`)
  console.table(staffToUpdate)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
