import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Fetching staff without posPinHash...')
  
  const staffToUpdate = await prisma.staff.findMany({
    where: {
      posPinHash: null
    }
  })

  console.log(`Found ${staffToUpdate.length} staff without a PIN.`)

  if (staffToUpdate.length === 0) {
    console.log('Nothing to do.')
    return
  }

  const salt = await bcrypt.genSalt(10)
  const defaultPinHash = await bcrypt.hash('1234', salt)
  
  console.log(`Setting default PIN (1234) for ${staffToUpdate.length} staff...`)
  
  const result = await prisma.staff.updateMany({
    where: {
      posPinHash: null
    },
    data: {
      posPinHash: defaultPinHash
    }
  })

  console.log(`Successfully updated ${result.count} staff members.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
