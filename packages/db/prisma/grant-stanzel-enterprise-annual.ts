import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const START = new Date('2026-10-01T00:00:00.000Z')
const END = new Date('2027-10-01T00:00:00.000Z')
const MANUAL_SUBSCRIPTION_ID = 'manual-stanzel-enterprise-annual-20261001'

async function main() {
  const organization = await prisma.organization.findFirst({
    where: { slug: 'stanzel-resort' },
    select: { id: true, name: true },
  })
  if (!organization) throw new Error('Stanzel Resort organisation was not found')

  const plan = await prisma.billingPlan.findUnique({
    where: { code: 'ENTERPRISE' },
    include: { items: { include: { product: { select: { code: true } } } } },
  })
  if (!plan || !plan.active) throw new Error('Active ENTERPRISE plan was not found')

  const activeSubscription = await prisma.subscription.findFirst({
    where: { organizationId: organization.id, status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] } },
    select: { id: true, status: true, plan: { select: { code: true } } },
  })
  if (activeSubscription && activeSubscription.id !== undefined) {
    throw new Error(`Refusing to overwrite existing active subscription ${activeSubscription.id}`)
  }

  await prisma.$transaction(async (tx) => {
    const subscription = await tx.subscription.upsert({
      where: { flutterwaveSubscriptionId: MANUAL_SUBSCRIPTION_ID },
      update: {
        planId: plan.id,
        status: 'ACTIVE',
        currentPeriodStart: START,
        currentPeriodEnd: END,
        scopePropertyIds: [],
        cancelAtPeriodEnd: false,
        canceledAt: null,
        pastDueSince: null,
      },
      create: {
        organizationId: organization.id,
        planId: plan.id,
        status: 'ACTIVE',
        currentPeriodStart: START,
        currentPeriodEnd: END,
        scopePropertyIds: [],
        cancelAtPeriodEnd: false,
        flutterwaveSubscriptionId: MANUAL_SUBSCRIPTION_ID,
      },
    })

    for (const item of plan.items) {
      const scopeKey = `${organization.id}:*:${item.product.code}`
      await tx.entitlement.upsert({
        where: { scopeKey },
        update: {
          status: 'ACTIVE',
          quantity: item.includedQty,
          startsAt: START,
          activatedAt: START,
          expiresAt: END,
          suspendedAt: null,
          suspensionReason: null,
          metadata: { source: 'manual-annual-grant', subscriptionId: subscription.id },
        },
        create: {
          organizationId: organization.id,
          propertyId: null,
          productCode: item.product.code,
          scopeKey,
          status: 'ACTIVE',
          quantity: item.includedQty,
          startsAt: START,
          activatedAt: START,
          expiresAt: END,
          metadata: { source: 'manual-annual-grant', subscriptionId: subscription.id },
        },
      })
    }

    await tx.auditLog.create({
      data: {
        organizationId: organization.id,
        action: 'MANUAL_SUBSCRIPTION_GRANTED',
        resource: 'Subscription',
        resourceId: subscription.id,
        userEmail: 'system@lodgecore.com',
        userRole: 'SYSTEM',
        previousValue: { status: activeSubscription?.status ?? null },
        newValue: { plan: 'ENTERPRISE', interval: 'year', startsAt: START, expiresAt: END, source: 'manual-annual-grant' },
        requestId: randomUUID(),
      },
    })
  })

  console.log(`Granted Enterprise annual plan to ${organization.name}: ${START.toISOString()} - ${END.toISOString()}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())
