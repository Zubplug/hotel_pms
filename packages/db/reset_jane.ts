import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const salt = await bcrypt.genSalt(10)
  const defaultPinHash = await bcrypt.hash('1234', salt)
  
  console.log(`Setting Jane's PIN to 1234...`)
  
  const result = await prisma.staff.updateMany({
    where: {
      firstName: 'Jane',
      lastName: 'Frontdesk'
    },
    data: {
      posPinHash: defaultPinHash
    }
  })

  console.log(`Successfully updated ${result.count} staff member(s).`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
