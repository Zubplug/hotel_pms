import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  const propertyId = '9b8a4229-4059-42f4-9565-51cfdbe79046';
  const limit = 1000;
  
  // Base where clauses
  const baseWhere = { propertyId };
  const resBaseWhere = { propertyId, deletedAt: null };

  const [
    staff, rooms, roomTypes, corporateAccounts, ratePlans, rates, 
    reservations, guests, posOutlets, posCategories, posProducts, 
    posFloorPlans, posTables, posSessions, posOrders, 
    housekeepingTasks, maintenanceTickets, 
    laundryItems, laundryOrders,
    stockItems, recipeIngredients, productionBatches
  ] = await Promise.all([
    prisma.staff.findMany({ where: baseWhere, take: limit }),
    prisma.room.findMany({ where: baseWhere, take: limit }),
    prisma.roomType.findMany({ where: baseWhere, take: limit }),
    prisma.corporateAccount.findMany({ where: baseWhere, take: limit }),
    prisma.ratePlan.findMany({ where: baseWhere, take: limit }),
    prisma.rate.findMany({ where: baseWhere, take: limit }),
    prisma.reservation.findMany({ where: resBaseWhere, include: { primaryGuest: true, reservationGuests: { include: { guest: true } }, folios: true, lockCredentials: true, lockOperations: true }, take: limit }),
    prisma.guest.findMany({ where: baseWhere, take: limit }),
    prisma.posOutlet.findMany({ where: baseWhere, take: limit }),
    prisma.productCategory.findMany({ where: baseWhere, take: limit }),
    prisma.posProduct.findMany({ where: baseWhere, include: { modifiers: true }, take: limit }),
    prisma.posFloorPlan.findMany({ where: baseWhere, take: limit }),
    prisma.posTable.findMany({ where: baseWhere, take: limit }),
    prisma.posSession.findMany({ where: baseWhere, include: { cashMovements: true }, take: limit }),
    prisma.posOrder.findMany({ where: resBaseWhere, include: { items: { include: { modifiers: true } }, payments: true, voids: true, checks: true, kots: true, discounts: true }, take: limit }),
    prisma.housekeepingTask.findMany({ where: baseWhere, take: limit }),
    prisma.maintenanceTicket.findMany({ where: baseWhere, take: limit }),
    prisma.laundryItem.findMany({ where: baseWhere, take: limit }),
    prisma.laundryOrder.findMany({ where: baseWhere, include: { items: true, statusHistory: true }, take: limit }),
    prisma.stockItem.findMany({ where: baseWhere, take: limit }),
    prisma.recipeIngredient.findMany({ where: baseWhere, take: limit }),
    prisma.posProductionBatch.findMany({ where: baseWhere, include: { items: true }, take: limit })
  ]);
  
  const payload = {
    staff, rooms, roomTypes, corporateAccounts, ratePlans, rates, 
    reservations, guests, posOutlets, posCategories, posProducts, 
    posFloorPlans, posTables, posSessions, posOrders, 
    housekeepingTasks, maintenanceTickets, 
    laundryItems, laundryOrders,
    stockItems, recipeIngredients, productionBatches
  };
  
  const fs = require('fs');
  fs.writeFileSync('sync-pull-dump.json', JSON.stringify(payload, null, 2));
  console.log('Dumped payload to sync-pull-dump.json');
}

run().catch(console.error).finally(() => prisma.$disconnect());
