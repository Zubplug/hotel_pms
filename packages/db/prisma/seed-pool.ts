import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding Pool and Pool Bar to production safely...')

  // Get the main property (LAG-01)
  const property = await prisma.property.findFirst({
    where: { code: 'LAG-01' }
  })

  if (!property) {
    throw new Error('Property LAG-01 not found!')
  }

  // Upsert Swimming Pool
  let pool = await prisma.posOutlet.findFirst({
    where: { propertyId: property.id, name: 'Swimming Pool' }
  })
  if (!pool) {
    pool = await prisma.posOutlet.create({
      data: {
        propertyId: property.id,
        name: 'Swimming Pool',
        type: 'RECREATION',
      }
    })
  }

  // Upsert Pool Bar
  let poolBar = await prisma.posOutlet.findFirst({
    where: { propertyId: property.id, name: 'Pool Bar' }
  })
  if (!poolBar) {
    poolBar = await prisma.posOutlet.create({
      data: {
        propertyId: property.id,
        name: 'Pool Bar',
        type: 'BAR',
      }
    })
  }

  // Upsert Pool Passes Category for Swimming Pool
  let catPoolPasses = await prisma.productCategory.findFirst({
    where: { outletId: pool.id, name: 'Pool Passes' }
  })
  if (!catPoolPasses) {
    catPoolPasses = await prisma.productCategory.create({
      data: {
        outletId: pool.id,
        name: 'Pool Passes',
        sortOrder: 1,
      }
    })
  }

  // Upsert Pool Passes Category for Pool Bar
  let catPoolBarPasses = await prisma.productCategory.findFirst({
    where: { outletId: poolBar.id, name: 'Pool Passes' }
  })
  if (!catPoolBarPasses) {
    catPoolBarPasses = await prisma.productCategory.create({
      data: {
        outletId: poolBar.id,
        name: 'Pool Passes',
        sortOrder: 2,
      }
    })
  }

  // Safely Upsert Products
  const productsToSeed = [
    {
      categoryId: catPoolPasses.id,
      name: 'Adult Pool Pass — Day',
      itemCode: 'REC-POOL-SWIM-ADULT',
      price: 15000,
      taxRate: 7.5,
    },
    {
      categoryId: catPoolPasses.id,
      name: 'Child Pool Pass — Day',
      itemCode: 'REC-POOL-SWIM-CHILD',
      price: 7500,
      taxRate: 7.5,
    },
    {
      categoryId: catPoolBarPasses.id,
      name: 'Adult Pool Pass — Day',
      itemCode: 'REC-POOL-BAR-ADULT',
      price: 15000,
      taxRate: 7.5,
    },
    {
      categoryId: catPoolBarPasses.id,
      name: 'Child Pool Pass — Day',
      itemCode: 'REC-POOL-BAR-CHILD',
      price: 7500,
      taxRate: 7.5,
    }
  ]

  for (const prod of productsToSeed) {
    const existing = await prisma.posProduct.findFirst({
      where: { propertyId: property.id, itemCode: prod.itemCode }
    })
    
    if (!existing) {
      await prisma.posProduct.create({
        data: {
          propertyId: property.id,
          categoryId: prod.categoryId,
          name: prod.name,
          itemCode: prod.itemCode,
          price: prod.price,
          taxRate: prod.taxRate,
        }
      })
    } else {
      await prisma.posProduct.update({
        where: { id: existing.id },
        data: {
          categoryId: prod.categoryId,
          name: prod.name,
          price: prod.price,
          taxRate: prod.taxRate,
        }
      })
    }
  }

  console.log('✅ Safely seeded Pool Outlets and Products to production!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
