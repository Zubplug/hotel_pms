import { PrismaClient } from '@prisma/client'
import { v4 as uuidv4 } from 'uuid'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding LodgeCore PMS Database...')

  // 1. Organization
  const org = await prisma.organization.upsert({
    where: { slug: 'lodgecore' },
    update: {},
    create: {
      name: 'LodgeCore PMS',
      slug: 'lodgecore',
      primaryColor: '#1D4ED8',
      defaultCurrency: 'NGN',
    },
  })

  // Canonical SaaS catalogue. Flutterwave payment-plan IDs/prices are managed by
  // the HQ billing workspace; these stable codes are the entitlement contract.
  const catalog = [
    { code: 'PLAN_STARTER', name: 'Starter subscription', type: 'BASE' },
    { code: 'PLAN_PROFESSIONAL', name: 'Professional subscription', type: 'BASE' },
    { code: 'PLAN_BUSINESS', name: 'Business subscription', type: 'BASE' },
    { code: 'PLAN_ENTERPRISE', name: 'Enterprise subscription', type: 'BASE' },
    { code: 'PLAN_ENTERPRISE_PLUS', name: 'Enterprise Plus subscription', type: 'BASE' },
    { code: 'MODULE_PMS', name: 'Property Management System', type: 'BASE' },
    { code: 'MODULE_OPERATIONS', name: 'Professional Operations', type: 'BASE' },
    { code: 'MODULE_ENTERPRISE', name: 'Enterprise Platform', type: 'BASE' },
    { code: 'ADDON_GROWTH', name: 'Growth Pack', type: 'ADDON' },
    { code: 'ADDON_GUEST_EXPERIENCE', name: 'Guest Experience Pack', type: 'ADDON' },
    { code: 'ADDON_INTELLIGENCE', name: 'Intelligence Pack', type: 'ADDON' },
    { code: 'ADDON_ENTERPRISE_OPERATIONS', name: 'Enterprise Operations Pack', type: 'ADDON' },
    { code: 'ADDON_BEDS24', name: 'Beds24 Channel Integration', type: 'ADDON' },
    { code: 'ADDON_SMART_ACCESS', name: 'Smart Access', type: 'ADDON' },
  ] as const

  const products = new Map<string, { id: string }>()
  for (const item of catalog) {
    const product = await prisma.billingProduct.upsert({
      where: { code: item.code },
      update: { name: item.name, type: item.type, active: true },
      create: { code: item.code, name: item.name, type: item.type, active: true },
      select: { id: true },
    })
    products.set(item.code, product)
  }

  const planDefinitions = [
    { code: 'ESSENTIAL', name: 'Starter', description: 'Essential hotel operations for independent properties with 1–20 rooms.', displayOrder: 1, metadata: { maxProperties: 1, maxRooms: 20, maxUsers: 10, maxOutlets: 1, maxIntegrations: 0 }, products: [{ code: 'PLAN_STARTER', quantity: 20, required: true }, { code: 'MODULE_PMS', quantity: 20, required: true }] },
    { code: 'PROFESSIONAL', name: 'Professional', description: 'PMS, operations, commerce and finance for growing properties.', displayOrder: 2, metadata: { maxProperties: 1, maxRooms: 50, maxUsers: 30, maxOutlets: 5, maxIntegrations: 3 }, products: [{ code: 'PLAN_PROFESSIONAL', quantity: 50, required: true }, { code: 'MODULE_PMS', quantity: 50, required: true }, { code: 'MODULE_OPERATIONS', quantity: 5, required: true }] },
    { code: 'BUSINESS', name: 'Business', description: 'Advanced operations, finance and connectivity for 51–100 room properties.', displayOrder: 3, metadata: { maxProperties: 3, maxRooms: 100, maxUsers: 60, maxOutlets: null, maxIntegrations: 10 }, products: [{ code: 'PLAN_BUSINESS', quantity: 100, required: true }, { code: 'MODULE_PMS', quantity: 100, required: true }, { code: 'MODULE_OPERATIONS', quantity: null, required: true }, { code: 'MODULE_ENTERPRISE', quantity: 10, required: true }] },
    { code: 'ENTERPRISE', name: 'Enterprise', description: 'Central control, reporting and governance for property groups.', displayOrder: 4, metadata: { maxProperties: null, maxRooms: null, maxUsers: null, maxOutlets: null, maxIntegrations: null }, products: [{ code: 'PLAN_ENTERPRISE', quantity: null, required: true }, { code: 'MODULE_PMS', quantity: null, required: true }, { code: 'MODULE_OPERATIONS', quantity: null, required: true }, { code: 'MODULE_ENTERPRISE', quantity: null, required: true }] },
    { code: 'ENTERPRISE_PLUS', name: 'Enterprise Plus', description: 'Custom operating model for 250+ room groups and complex portfolios.', displayOrder: 5, metadata: { maxProperties: null, maxRooms: null, maxUsers: null, maxOutlets: null, maxIntegrations: null, customPricing: true }, products: [{ code: 'PLAN_ENTERPRISE_PLUS', quantity: null, required: true }, { code: 'MODULE_PMS', quantity: null, required: true }, { code: 'MODULE_OPERATIONS', quantity: null, required: true }, { code: 'MODULE_ENTERPRISE', quantity: null, required: true }] },
  ] as const

  for (const definition of planDefinitions) {
    const plan = await prisma.billingPlan.upsert({
      where: { code: definition.code },
      update: { name: definition.name, description: definition.description, displayOrder: definition.displayOrder, metadata: definition.metadata, active: true },
      create: { code: definition.code, name: definition.name, description: definition.description, displayOrder: definition.displayOrder, metadata: definition.metadata, active: true },
    })
    for (const planProduct of definition.products) {
      const product = products.get(planProduct.code)
      if (!product) continue
      await prisma.billingPlanItem.upsert({
        where: { planId_productId: { planId: plan.id, productId: product.id } },
        update: { required: planProduct.required, includedQty: planProduct.quantity },
        create: { planId: plan.id, productId: product.id, required: planProduct.required, includedQty: planProduct.quantity },
      })
    }
  }

  // 2. Property
  const propLagos = await prisma.property.upsert({
    where: { code: 'LAG-01' },
    update: {},
    create: {
      organizationId: org.id,
      name: 'LodgeCore Lagos',
      code: 'LAG-01',
      address: '10 Victoria Island',
      city: 'Lagos',
      state: 'Lagos',
      country: 'Nigeria',
      phone: '+2348000000001',
      email: 'lagos@lodgecore.com',
      starRating: 4,
      baseCurrency: 'NGN',
      supportedCurrencies: ['NGN', 'USD'],
      businessDate: new Date(),
    },
  })

  const organizationProperties = await prisma.property.findMany({
    where: { organizationId: org.id },
    select: { id: true },
  })

  for (const property of organizationProperties) {
    const cashAccounts = [
      { name: 'Frontdesk Till 1', type: 'FRONTDESK_TILL' },
      { name: 'Frontdesk Till 2', type: 'FRONTDESK_TILL' },
      { name: 'Reception Safe', type: 'SAFE' },
    ]

    for (const cashAccount of cashAccounts) {
      const existing = await prisma.cashAccount.findFirst({
        where: { propertyId: property.id, name: cashAccount.name },
      })

      if (!existing) {
        await prisma.cashAccount.create({
          data: {
            propertyId: property.id,
            name: cashAccount.name,
            type: cashAccount.type,
            balance: 0,
            isActive: true,
          },
        })
      }
    }
  }

  // 3. Buildings & Floors
  const buildingA = await prisma.building.create({
    data: {
      propertyId: propLagos.id,
      name: 'Main Wing',
      code: 'MW',
      floorsCount: 2,
      floors: {
        create: [
          { propertyId: propLagos.id, number: 1, name: 'Ground Floor' },
          { propertyId: propLagos.id, number: 2, name: 'First Floor' }
        ]
      }
    },
    include: { floors: true }
  })

  const floor1 = buildingA.floors.find(f => f.number === 1)!
  const floor2 = buildingA.floors.find(f => f.number === 2)!

  // 4. Room Types
  const standardType = await prisma.roomType.create({
    data: {
      propertyId: propLagos.id,
      name: 'Standard Room',
      code: 'STD',
      maxOccupancy: 2,
      defaultBedConfig: '1 Queen',
      baseRate: 50000,
      currency: 'NGN',
    }
  })

  const deluxeType = await prisma.roomType.create({
    data: {
      propertyId: propLagos.id,
      name: 'Deluxe Room',
      code: 'DLX',
      maxOccupancy: 3,
      defaultBedConfig: '1 King',
      baseRate: 75000,
      currency: 'NGN',
    }
  })

  // 5. Rooms
  await prisma.room.createMany({
    data: [
      {
        propertyId: propLagos.id,
        buildingId: buildingA.id,
        floorId: floor1.id,
        roomTypeId: standardType.id,
        number: '101',
        maxOccupancy: 2,
        bedConfiguration: '1 Queen',
        status: 'AVAILABLE',
        housekeepingStatus: 'CLEAN',
      },
      {
        propertyId: propLagos.id,
        buildingId: buildingA.id,
        floorId: floor1.id,
        roomTypeId: standardType.id,
        number: '102',
        maxOccupancy: 2,
        bedConfiguration: '1 Queen',
        status: 'OCCUPIED',
        housekeepingStatus: 'PENDING',
      },
      {
        propertyId: propLagos.id,
        buildingId: buildingA.id,
        floorId: floor2.id,
        roomTypeId: deluxeType.id,
        number: '201',
        maxOccupancy: 3,
        bedConfiguration: '1 King',
        status: 'AVAILABLE',
        housekeepingStatus: 'INSPECTED',
      }
    ]
  })

  // 6. Rate Plans
  const standardRatePlan = await prisma.ratePlan.create({
    data: {
      propertyId: propLagos.id,
      name: 'Standard Rate',
      code: 'BAR',
      type: 'STANDARD',
      rates: {
        create: [
          { roomTypeId: standardType.id, propertyId: propLagos.id, amount: 50000, currency: 'NGN', effectiveFrom: new Date('2026-01-01T00:00:00.000Z') },
          { roomTypeId: deluxeType.id, propertyId: propLagos.id, amount: 75000, currency: 'NGN', effectiveFrom: new Date('2026-01-01T00:00:00.000Z') },
        ]
      }
    }
  })

  // 7. Guests
  let guest = await prisma.guest.findFirst({
    where: { email: 'john.doe@example.com' }
  })
  
  if (!guest) {
    guest = await prisma.guest.create({
      data: {
        organizationId: org.id,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '+2348000000002',
      }
    })
  }

  // 8. Staff / Users
  const staff = await prisma.staff.upsert({
    where: { email: 'admin@lodgecore.com' },
    update: {},
    create: {
      organizationId: org.id,
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@lodgecore.com',
      department: 'Management',
      position: 'General Manager',
      propertyAccess: [propLagos.id],
    }
  })

  await prisma.user.upsert({
    where: { email: 'admin@lodgecore.com' },
    update: {},
    create: {
      staffId: staff.id,
      email: 'admin@lodgecore.com',
      // 'password' hash (bcrypt)
      passwordHash: '$2b$10$AmpFKjKSql.k2HpbeXE97.d0G27fSY9UfMJvdt9RoCQco1RIT9FlG',
      isSuperAdmin: true,
    }
  })

  // 9. Inventory & POS Mock Data
  const warehouse = await prisma.warehouse.create({
    data: {
      propertyId: propLagos.id,
      name: 'Main Store',
      location: 'Basement',
    }
  })

  const stockChicken = await prisma.stockItem.create({
    data: {
      propertyId: propLagos.id,
      warehouseId: warehouse.id,
      name: 'Chicken Breast',
      baseUnit: 'KG',
      costPrice: 2000,
      quantityOnHand: 50,
    }
  })

  const stockBun = await prisma.stockItem.create({
    data: {
      propertyId: propLagos.id,
      warehouseId: warehouse.id,
      name: 'Burger Bun',
      baseUnit: 'PIECE',
      costPrice: 200,
      quantityOnHand: 100,
    }
  })

  const restaurant = await prisma.posOutlet.create({
    data: {
      propertyId: propLagos.id,
      name: 'The Grand Restaurant',
      type: 'RESTAURANT',
    }
  })

  const pool = await prisma.posOutlet.create({
    data: {
      propertyId: propLagos.id,
      name: 'Swimming Pool',
      type: 'RECREATION',
    }
  })

  const poolBar = await prisma.posOutlet.create({
    data: {
      propertyId: propLagos.id,
      name: 'Pool Bar',
      type: 'BAR',
    }
  })

  const catMains = await prisma.productCategory.create({
    data: {
      outletId: restaurant.id,
      name: 'Mains',
      sortOrder: 1,
    }
  })

  const chickenBurger = await prisma.posProduct.create({
    data: {
      propertyId: propLagos.id,
      categoryId: catMains.id,
      name: 'Classic Chicken Burger',
      price: 5500,
      taxRate: 7.5,
    }
  })

  await prisma.recipeIngredient.createMany({
    data: [
      {
        productId: chickenBurger.id,
        stockItemId: stockChicken.id,
        quantity: 0.2,
        unitOfMeasure: 'KG'
      },
      {
        productId: chickenBurger.id,
        stockItemId: stockBun.id,
        quantity: 1,
        unitOfMeasure: 'PIECE'
      }
    ]
  })

  const catPoolPasses = await prisma.productCategory.create({
    data: {
      outletId: pool.id,
      name: 'Pool Passes',
      sortOrder: 1,
    }
  })

  await prisma.posProduct.createMany({
    data: [
      {
        propertyId: propLagos.id,
        categoryId: catPoolPasses.id,
        name: 'Adult Pool Pass — Day',
        itemCode: 'REC-POOL-SWIM-ADULT',
        price: 15000,
        taxRate: 7.5,
      },
      {
        propertyId: propLagos.id,
        categoryId: catPoolPasses.id,
        name: 'Child Pool Pass — Day',
        itemCode: 'REC-POOL-SWIM-CHILD',
        price: 7500,
        taxRate: 7.5,
      }
    ]
  })

  const catPoolBarPasses = await prisma.productCategory.create({
    data: {
      outletId: poolBar.id,
      name: 'Pool Passes',
      sortOrder: 2,
    }
  })

  await prisma.posProduct.createMany({
    data: [
      {
        propertyId: propLagos.id,
        categoryId: catPoolBarPasses.id,
        name: 'Adult Pool Pass — Day',
        itemCode: 'REC-POOL-BAR-ADULT',
        price: 15000,
        taxRate: 7.5,
      },
      {
        propertyId: propLagos.id,
        categoryId: catPoolBarPasses.id,
        name: 'Child Pool Pass — Day',
        itemCode: 'REC-POOL-BAR-CHILD',
        price: 7500,
        taxRate: 7.5,
      }
    ]
  })

  console.log('Seeding complete!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
