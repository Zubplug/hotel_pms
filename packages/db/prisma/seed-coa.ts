import { PrismaClient, AccountType, BalanceSide } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Verifying ChartOfAccount 4100 for all properties...')

  const properties = await prisma.property.findMany({
    select: { id: true, name: true, code: true }
  })

  for (const property of properties) {
    const existing = await prisma.chartOfAccount.findUnique({
      where: {
        propertyId_code: {
          propertyId: property.id,
          code: '4100'
        }
      }
    })

    if (!existing) {
      console.log(`Adding 4100 to property ${property.code} (${property.name})...`)
      await prisma.chartOfAccount.create({
        data: {
          propertyId: property.id,
          code: '4100',
          name: 'Swimming Pool Revenue',
          type: AccountType.REVENUE,
          category: 'Operating Revenue',
          normalBalance: BalanceSide.CREDIT,
          description: 'Revenue generated from swimming pool passes and access'
        }
      })
    } else {
      console.log(`Property ${property.code} already has 4100.`)
    }
  }

  console.log('✅ ChartOfAccount verification complete!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
