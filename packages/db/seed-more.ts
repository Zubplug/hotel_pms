import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const property = await prisma.property.findFirst({ where: { code: 'LAG-01' } })
  const building = await prisma.building.findFirst({ where: { propertyId: property?.id } })
  const floor1 = await prisma.floor.findFirst({ where: { propertyId: property?.id, number: 1 } })
  const floor2 = await prisma.floor.findFirst({ where: { propertyId: property?.id, number: 2 } })
  const standardType = await prisma.roomType.findFirst({ where: { code: 'STD' } })
  const deluxeType = await prisma.roomType.findFirst({ where: { code: 'DLX' } })
  
  if (!property || !building || !floor1 || !floor2 || !standardType || !deluxeType) {
    console.error("Missing relations")
    return
  }

  await prisma.room.createMany({
    data: [
      { propertyId: property.id, buildingId: building.id, floorId: floor1.id, roomTypeId: standardType.id, number: '103', maxOccupancy: 2, bedConfiguration: '1 Queen', status: 'AVAILABLE', housekeepingStatus: 'CLEAN' },
      { propertyId: property.id, buildingId: building.id, floorId: floor1.id, roomTypeId: standardType.id, number: '104', maxOccupancy: 2, bedConfiguration: '1 Queen', status: 'AVAILABLE', housekeepingStatus: 'CLEAN' },
      { propertyId: property.id, buildingId: building.id, floorId: floor1.id, roomTypeId: standardType.id, number: '105', maxOccupancy: 2, bedConfiguration: '1 Queen', status: 'AVAILABLE', housekeepingStatus: 'CLEAN' },
      { propertyId: property.id, buildingId: building.id, floorId: floor2.id, roomTypeId: deluxeType.id, number: '202', maxOccupancy: 3, bedConfiguration: '1 King', status: 'AVAILABLE', housekeepingStatus: 'CLEAN' },
      { propertyId: property.id, buildingId: building.id, floorId: floor2.id, roomTypeId: deluxeType.id, number: '203', maxOccupancy: 3, bedConfiguration: '1 King', status: 'AVAILABLE', housekeepingStatus: 'CLEAN' }
    ], skipDuplicates: true
  })
  
  const rooms = await prisma.room.findMany()
  console.log(`Now we have ${rooms.length} rooms total.`)
}
main().finally(() => prisma.$disconnect())
