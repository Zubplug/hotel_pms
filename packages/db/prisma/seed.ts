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
