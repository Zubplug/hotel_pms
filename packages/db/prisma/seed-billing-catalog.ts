import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const catalog = [
  { code: 'CORE_PMS', name: 'LodgeCore Essential', type: 'BASE' },
  { code: 'PROFESSIONAL_OPERATIONS', name: 'LodgeCore Professional Operations', type: 'BASE' },
  { code: 'ENTERPRISE_PLATFORM', name: 'LodgeCore Enterprise Platform', type: 'BASE' },
  { code: 'ADDON_GROWTH', name: 'Growth Pack', type: 'ADDON' },
  { code: 'ADDON_GUEST_EXPERIENCE', name: 'Guest Experience Pack', type: 'ADDON' },
  { code: 'ADDON_INTELLIGENCE', name: 'Intelligence Pack', type: 'ADDON' },
  { code: 'ADDON_ENTERPRISE_OPERATIONS', name: 'Enterprise Operations Pack', type: 'ADDON' },
  { code: 'ADDON_BEDS24', name: 'Beds24 Channel Integration', type: 'ADDON' },
  { code: 'ADDON_SMART_ACCESS', name: 'Smart Access', type: 'ADDON' },
] as const

const planDefinitions = [
  {
    code: 'ESSENTIAL',
    name: 'Essential',
    description: 'Core PMS operations for independent properties.',
    displayOrder: 1,
    metadata: { maxProperties: 1, maxRooms: 30, maxUsers: 10, maxOutlets: 0, maxIntegrations: 0 },
    products: [{ code: 'CORE_PMS', quantity: 30 }],
  },
  {
    code: 'PROFESSIONAL',
    name: 'Professional',
    description: 'PMS, operations, commerce and finance for growing properties.',
    displayOrder: 2,
    metadata: { maxProperties: 1, maxRooms: 100, maxUsers: 30, maxOutlets: 5, maxIntegrations: 3 },
    products: [
      { code: 'CORE_PMS', quantity: 100 },
      { code: 'PROFESSIONAL_OPERATIONS', quantity: 5 },
    ],
  },
  {
    code: 'ENTERPRISE',
    name: 'Enterprise',
    description: 'Central control, reporting and governance for property groups.',
    displayOrder: 3,
    metadata: { maxProperties: null, maxRooms: null, maxUsers: null, maxOutlets: null, maxIntegrations: null },
    products: [
      { code: 'CORE_PMS', quantity: null },
      { code: 'PROFESSIONAL_OPERATIONS', quantity: null },
      { code: 'ENTERPRISE_PLATFORM', quantity: null },
    ],
  },
] as const

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL is required')

  const databaseHost = new URL(databaseUrl).hostname
  console.log(`Seeding billing catalogue only on ${databaseHost}`)

  await prisma.$transaction(async (tx) => {
    const products = new Map<string, { id: string }>()

    for (const item of catalog) {
      const product = await tx.billingProduct.upsert({
        where: { code: item.code },
        update: { name: item.name, type: item.type, active: true },
        create: { code: item.code, name: item.name, type: item.type, active: true },
        select: { id: true },
      })
      products.set(item.code, product)
    }

    for (const definition of planDefinitions) {
      const plan = await tx.billingPlan.upsert({
        where: { code: definition.code },
        update: {
          name: definition.name,
          description: definition.description,
          displayOrder: definition.displayOrder,
          metadata: definition.metadata,
          active: true,
        },
        create: {
          code: definition.code,
          name: definition.name,
          description: definition.description,
          displayOrder: definition.displayOrder,
          metadata: definition.metadata,
          active: true,
        },
      })

      for (const planProduct of definition.products) {
        const product = products.get(planProduct.code)
        if (!product) throw new Error(`Missing catalogue product ${planProduct.code}`)

        await tx.billingPlanItem.upsert({
          where: { planId_productId: { planId: plan.id, productId: product.id } },
          update: { required: true, includedQty: planProduct.quantity },
          create: { planId: plan.id, productId: product.id, required: true, includedQty: planProduct.quantity },
        })
      }
    }
  })

  console.log(`Seeded ${catalog.length} products, ${planDefinitions.length} plans, and their plan items.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())
