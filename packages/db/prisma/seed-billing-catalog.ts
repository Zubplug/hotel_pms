import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const catalog = [
  { code: 'PLAN_STARTER', name: 'Starter subscription', type: 'BASE' },
  { code: 'PLAN_PROFESSIONAL', name: 'Professional subscription', type: 'BASE' },
  { code: 'PLAN_BUSINESS', name: 'Business subscription', type: 'BASE' },
  { code: 'PLAN_ENTERPRISE', name: 'Enterprise subscription', type: 'BASE' },
  { code: 'PLAN_ENTERPRISE_PLUS', name: 'Enterprise Plus subscription', type: 'BASE' },
  { code: 'MODULE_PMS', name: 'Property Management System', type: 'BASE' },
  { code: 'MODULE_OPERATIONS', name: 'Professional Operations', type: 'BASE' },
  { code: 'MODULE_ENTERPRISE', name: 'Enterprise Platform', type: 'BASE' },
  { code: 'ADDON_BEDS24', name: 'Beds24 Channel Integration', type: 'ADDON' },
] as const

const planPrices = [
  { code: 'PLAN_STARTER', month: 3500000, year: 35000000 },
  { code: 'PLAN_PROFESSIONAL', month: 6500000, year: 65000000 },
  { code: 'PLAN_BUSINESS', month: 12000000, year: 120000000 },
  { code: 'PLAN_ENTERPRISE', month: 20000000, year: 200000000 },
] as const

const planDefinitions = [
  {
    code: 'ESSENTIAL',
    name: 'Starter',
    description: 'Essential hotel operations for independent properties with 1–20 rooms.',
    displayOrder: 1,
    metadata: { maxProperties: 1, maxRooms: 20, maxUsers: 10, maxOutlets: 1, maxIntegrations: 0 },
    products: [{ code: 'PLAN_STARTER', quantity: 20, required: true }, { code: 'MODULE_PMS', quantity: 20, required: true }],
  },
  {
    code: 'PROFESSIONAL',
    name: 'Professional',
    description: 'PMS, operations, commerce and finance for growing properties.',
    displayOrder: 2,
    metadata: { maxProperties: 1, maxRooms: 50, maxUsers: 30, maxOutlets: 5, maxIntegrations: 3 },
    products: [
      { code: 'PLAN_PROFESSIONAL', quantity: 50, required: true },
      { code: 'MODULE_PMS', quantity: 50, required: true },
      { code: 'MODULE_OPERATIONS', quantity: 5, required: true },
    ],
  },
  {
    code: 'BUSINESS',
    name: 'Business',
    description: 'Advanced operations, finance and connectivity for 51–100 room properties.',
    displayOrder: 3,
    metadata: { maxProperties: 3, maxRooms: 100, maxUsers: 60, maxOutlets: null, maxIntegrations: 10 },
    products: [
      { code: 'PLAN_BUSINESS', quantity: 100, required: true },
      { code: 'MODULE_PMS', quantity: 100, required: true },
      { code: 'MODULE_OPERATIONS', quantity: null, required: true },
      { code: 'MODULE_ENTERPRISE', quantity: 10, required: true },
    ],
  },
  {
    code: 'ENTERPRISE',
    name: 'Enterprise',
    description: 'Central control, reporting and governance for property groups.',
    displayOrder: 4,
    metadata: { maxProperties: null, maxRooms: null, maxUsers: null, maxOutlets: null, maxIntegrations: null },
    products: [
      { code: 'PLAN_ENTERPRISE', quantity: null, required: true },
      { code: 'MODULE_PMS', quantity: null, required: true },
      { code: 'MODULE_OPERATIONS', quantity: null, required: true },
      { code: 'MODULE_ENTERPRISE', quantity: null, required: true },
    ],
  },
  {
    code: 'ENTERPRISE_PLUS',
    name: 'Enterprise Plus',
    description: 'Custom operating model for 250+ room groups and complex portfolios.',
    displayOrder: 5,
    metadata: { maxProperties: null, maxRooms: null, maxUsers: null, maxOutlets: null, maxIntegrations: null, customPricing: true },
    products: [
      { code: 'PLAN_ENTERPRISE_PLUS', quantity: null, required: true },
      { code: 'MODULE_PMS', quantity: null, required: true },
      { code: 'MODULE_OPERATIONS', quantity: null, required: true },
      { code: 'MODULE_ENTERPRISE', quantity: null, required: true },
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
          update: { required: planProduct.required, includedQty: planProduct.quantity },
          create: { planId: plan.id, productId: product.id, required: planProduct.required, includedQty: planProduct.quantity },
        })
      }
    }

    for (const priceDefinition of planPrices) {
      const product = products.get(priceDefinition.code)
      if (!product) throw new Error(`Missing pricing product ${priceDefinition.code}`)
      for (const [interval, amount] of [['month', priceDefinition.month], ['year', priceDefinition.year]] as const) {
        const existing = await tx.billingPrice.findFirst({ where: { productId: product.id, interval } })
        if (existing) await tx.billingPrice.update({ where: { id: existing.id }, data: { amount, currency: 'ngn' } })
        else await tx.billingPrice.create({ data: { productId: product.id, amount, currency: 'ngn', interval } })
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
