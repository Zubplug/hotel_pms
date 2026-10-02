import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const pricingProducts = [
  ['PLAN_STARTER', 'Starter subscription'],
  ['PLAN_PROFESSIONAL', 'Professional subscription'],
  ['PLAN_BUSINESS', 'Business subscription'],
  ['PLAN_ENTERPRISE', 'Enterprise subscription'],
  ['PLAN_ENTERPRISE_PLUS', 'Enterprise Plus subscription'],
  ['MODULE_PMS', 'Property Management System'],
  ['MODULE_OPERATIONS', 'Professional Operations'],
  ['MODULE_ENTERPRISE', 'Enterprise Platform'],
] as const

const legacyProductCodes = ['CORE_PMS', 'PROFESSIONAL_OPERATIONS', 'ENTERPRISE_PLATFORM'] as const
const legacyToCanonical = {
  CORE_PMS: 'MODULE_PMS',
  PROFESSIONAL_OPERATIONS: 'MODULE_OPERATIONS',
  ENTERPRISE_PLATFORM: 'MODULE_ENTERPRISE',
} as const

const prices = [
  ['PLAN_STARTER', 3500000, 35000000],
  ['PLAN_PROFESSIONAL', 6500000, 65000000],
  ['PLAN_BUSINESS', 12000000, 120000000],
  ['PLAN_ENTERPRISE', 20000000, 200000000],
] as const

const plans = [
  { code: 'ESSENTIAL', name: 'Starter', description: 'Essential hotel operations for independent properties with 1–20 rooms.', order: 1, metadata: { maxProperties: 1, maxRooms: 20, maxUsers: 10, maxOutlets: 1, maxIntegrations: 0 }, planProduct: 'PLAN_STARTER', modules: [['MODULE_PMS', 20]] },
  { code: 'PROFESSIONAL', name: 'Professional', description: 'PMS, operations, commerce and finance for growing properties.', order: 2, metadata: { maxProperties: 1, maxRooms: 50, maxUsers: 30, maxOutlets: 5, maxIntegrations: 3 }, planProduct: 'PLAN_PROFESSIONAL', modules: [['MODULE_PMS', 50], ['MODULE_OPERATIONS', 5]] },
  { code: 'BUSINESS', name: 'Business', description: 'Advanced operations, finance and connectivity for 51–100 room properties.', order: 3, metadata: { maxProperties: 3, maxRooms: 100, maxUsers: 60, maxOutlets: null, maxIntegrations: 10 }, planProduct: 'PLAN_BUSINESS', modules: [['MODULE_PMS', 100], ['MODULE_OPERATIONS', null], ['MODULE_ENTERPRISE', 10]] },
  { code: 'ENTERPRISE', name: 'Enterprise', description: 'Central control, reporting and governance for property groups.', order: 4, metadata: { maxProperties: null, maxRooms: null, maxUsers: null, maxOutlets: null, maxIntegrations: null }, planProduct: 'PLAN_ENTERPRISE', modules: [['MODULE_PMS', null], ['MODULE_OPERATIONS', null], ['MODULE_ENTERPRISE', null]] },
  { code: 'ENTERPRISE_PLUS', name: 'Enterprise Plus', description: 'Custom operating model for 250+ room groups and complex portfolios.', order: 5, metadata: { maxProperties: null, maxRooms: null, maxUsers: null, maxOutlets: null, maxIntegrations: null, customPricing: true }, planProduct: 'PLAN_ENTERPRISE_PLUS', modules: [['MODULE_PMS', null], ['MODULE_OPERATIONS', null], ['MODULE_ENTERPRISE', null]] },
] as const

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
  if (process.env.APPLY_PRICING_CATALOG !== '1') throw new Error('Refusing to write catalogue. Set APPLY_PRICING_CATALOG=1 for the reviewed production sync.')
  console.log(`Syncing 2026 pricing catalogue on ${new URL(process.env.DATABASE_URL).hostname}`)
  await prisma.$transaction(async (tx) => {
    const products = new Map<string, { id: string }>()
    for (const [code, name] of pricingProducts) {
      products.set(code, await tx.billingProduct.upsert({ where: { code }, update: { name, type: 'BASE', active: true }, create: { code, name, type: 'BASE', active: true }, select: { id: true } }))
    }
    for (const [code, month, year] of prices) {
      const product = products.get(code)!
      for (const [interval, amount] of [['month', month], ['year', year]] as const) {
        const existing = await tx.billingPrice.findFirst({ where: { productId: product.id, interval } })
        if (existing) await tx.billingPrice.update({ where: { id: existing.id }, data: { amount, currency: 'ngn' } })
        else await tx.billingPrice.create({ data: { productId: product.id, amount, currency: 'ngn', interval } })
      }
    }
    for (const definition of plans) {
      const plan = await tx.billingPlan.upsert({ where: { code: definition.code }, update: { name: definition.name, description: definition.description, displayOrder: definition.order, metadata: definition.metadata, active: true }, create: { code: definition.code, name: definition.name, description: definition.description, displayOrder: definition.order, metadata: definition.metadata, active: true } })
      const primary = products.get(definition.planProduct)!
      await tx.billingPlanItem.upsert({ where: { planId_productId: { planId: plan.id, productId: primary.id } }, update: { required: true, includedQty: definition.metadata.maxRooms }, create: { planId: plan.id, productId: primary.id, required: true, includedQty: definition.metadata.maxRooms } })
      for (const [code, quantity] of definition.modules) {
        const product = await tx.billingProduct.findUnique({ where: { code }, select: { id: true } })
        if (!product) continue
        await tx.billingPlanItem.upsert({ where: { planId_productId: { planId: plan.id, productId: product.id } }, update: { required: false, includedQty: quantity }, create: { planId: plan.id, productId: product.id, required: false, includedQty: quantity } })
      }
    }

    for (const legacyCode of legacyProductCodes) {
      const legacyProduct = await tx.billingProduct.findUnique({ where: { code: legacyCode }, select: { id: true } })
      if (!legacyProduct) continue
      await tx.billingPlanItem.deleteMany({ where: { productId: legacyProduct.id } })
    }

    for (const legacyCode of legacyProductCodes) {
      const canonicalCode = legacyToCanonical[legacyCode]
      const legacyEntitlements = await tx.entitlement.findMany({ where: { productCode: legacyCode } })
      for (const entitlement of legacyEntitlements) {
        const scopeKey = `${entitlement.organizationId}:${entitlement.propertyId ?? '*'}:${canonicalCode}`
        await tx.entitlement.upsert({
          where: { scopeKey },
          update: { status: entitlement.status, quantity: entitlement.quantity, startsAt: entitlement.startsAt, activatedAt: entitlement.activatedAt, expiresAt: entitlement.expiresAt, suspendedAt: entitlement.suspendedAt, suspensionReason: entitlement.suspensionReason, metadata: { ...(typeof entitlement.metadata === 'object' && entitlement.metadata ? entitlement.metadata : {}), migratedFrom: legacyCode } },
          create: { organizationId: entitlement.organizationId, propertyId: entitlement.propertyId, productCode: canonicalCode, scopeKey, status: entitlement.status, quantity: entitlement.quantity, startsAt: entitlement.startsAt, activatedAt: entitlement.activatedAt, expiresAt: entitlement.expiresAt, suspendedAt: entitlement.suspendedAt, suspensionReason: entitlement.suspensionReason, metadata: { ...(typeof entitlement.metadata === 'object' && entitlement.metadata ? entitlement.metadata : {}), migratedFrom: legacyCode } },
        })
        await tx.entitlement.delete({ where: { id: entitlement.id } })
      }
      await tx.billingProduct.updateMany({ where: { code: legacyCode }, data: { active: false } })
    }
  }, { maxWait: 30000, timeout: 120000 })
  console.log('Pricing catalogue synchronized. Existing subscription IDs and invoices were preserved.')
}

main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => prisma.$disconnect())
