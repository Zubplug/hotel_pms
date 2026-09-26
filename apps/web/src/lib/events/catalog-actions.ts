'use server';

import { prisma } from '@hotel-pms/db';
import { revalidatePath } from 'next/cache';
import { requireEventContext } from './access';

function positiveInt(value: number, label: string) {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${label} must be a positive whole number.`);
  return value;
}

export async function saveHall(data: { id?: string; name: string; code: string; capacity: number; rate?: number }) {
  const { propertyId } = await requireEventContext();
  const name = data.name.trim();
  const code = data.code.trim().toUpperCase();
  if (!name || !code) throw new Error('Hall name and code are required.');
  const capacity = positiveInt(Number(data.capacity), 'Capacity');
  const rate = data.rate === undefined || data.rate === 0 ? null : Number(data.rate);
  if (rate !== null && (!Number.isFinite(rate) || rate < 0)) throw new Error('Rate must be a valid non-negative amount.');

  const duplicate = await prisma.hall.findFirst({ where: { propertyId, code, ...(data.id ? { id: { not: data.id } } : {}) }, select: { id: true } });
  if (duplicate) throw new Error('That hall code already exists for this property.');
  if (data.id) {
    const existing = await prisma.hall.findFirst({ where: { id: data.id, propertyId }, select: { id: true } });
    if (!existing) throw new Error('Hall not found.');
    await prisma.hall.update({ where: { id: existing.id }, data: { name, code, capacity, rate } });
  } else {
    await prisma.hall.create({ data: { propertyId, name, code, capacity, rate, amenities: [] } });
  }
  revalidatePath('/fnb/events/halls');
  revalidatePath('/fnb/events/bookings/create/hall-only');
  revalidatePath('/fnb/events/bookings/create/full-package');
}

export async function saveBanquetPackage(data: { id?: string; name: string; description?: string; basePrice: number; isHallOnly?: boolean; items?: Array<{ posProductId?: string; nameOverride?: string; quantity: number; priceOverride?: number }> }) {
  const { propertyId } = await requireEventContext();
  const name = data.name.trim();
  const basePrice = Number(data.basePrice);
  if (!name) throw new Error('Package name is required.');
  if (!Number.isFinite(basePrice) || basePrice < 0) throw new Error('Base price must be a valid non-negative amount.');

  const items = data.items || [];
  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity < 1) throw new Error('Package item quantities must be positive whole numbers.');
    if (item.priceOverride !== undefined && (!Number.isFinite(Number(item.priceOverride)) || Number(item.priceOverride) < 0)) throw new Error('Package item prices must be valid non-negative amounts.');
    if (item.posProductId) {
      const product = await prisma.posProduct.findFirst({ where: { id: item.posProductId, propertyId, isActive: true }, select: { id: true } });
      if (!product) throw new Error('One of the selected POS products is unavailable.');
    }
  }

  if (data.id) {
    const existing = await prisma.banquetPackage.findFirst({ where: { id: data.id, propertyId }, select: { id: true } });
    if (!existing) throw new Error('Package not found.');
    await prisma.$transaction(async (tx) => {
      await tx.banquetPackage.update({ where: { id: existing.id }, data: { name, description: data.description?.trim() || null, basePrice, isHallOnly: Boolean(data.isHallOnly) } });
      if (data.items !== undefined) {
        await tx.banquetPackageItem.deleteMany({ where: { banquetPackageId: existing.id } });
        if (items.length) await tx.banquetPackageItem.createMany({ data: items.map((item) => ({ banquetPackageId: existing.id, posProductId: item.posProductId || null, nameOverride: item.nameOverride?.trim() || null, quantity: item.quantity, priceOverride: item.priceOverride === undefined ? null : Number(item.priceOverride) })) });
      }
    });
  } else {
    await prisma.banquetPackage.create({ data: { propertyId, name, description: data.description?.trim() || undefined, basePrice, isHallOnly: Boolean(data.isHallOnly), isActive: true, items: items.length ? { create: items.map((item) => ({ posProductId: item.posProductId || null, nameOverride: item.nameOverride?.trim() || null, quantity: item.quantity, priceOverride: item.priceOverride === undefined ? null : Number(item.priceOverride) })) } : undefined } });
  }
  revalidatePath('/fnb/events/packages');
  revalidatePath('/fnb/events/bookings/create/full-package');
}

export async function saveEventEquipment(data: { id?: string; name: string; description?: string; totalStock: number; rentalPrice: number }) {
  const { propertyId } = await requireEventContext();
  const name = data.name.trim();
  const totalStock = Number(data.totalStock);
  const rentalPrice = Number(data.rentalPrice);
  if (!name) throw new Error('Equipment name is required.');
  if (!Number.isInteger(totalStock) || totalStock < 1) throw new Error('Total stock must be a positive whole number.');
  if (!Number.isFinite(rentalPrice) || rentalPrice < 0) throw new Error('Rental price must be a valid non-negative amount.');
  if (data.id) {
    const existing = await prisma.eventEquipment.findFirst({ where: { id: data.id, propertyId }, select: { id: true } });
    if (!existing) throw new Error('Equipment not found.');
    await prisma.eventEquipment.update({ where: { id: existing.id }, data: { name, description: data.description?.trim() || null, totalStock, rentalPrice } });
  } else {
    await prisma.eventEquipment.create({ data: { propertyId, name, description: data.description?.trim() || null, totalStock, rentalPrice, isActive: true } });
  }
  revalidatePath('/fnb/events/packages');
  revalidatePath('/fnb/events/bookings/create/hall-only');
  revalidatePath('/fnb/events/bookings/create/full-package');
}

export async function getHallSchedule(hallId: string, startDate: string, endDate: string) {
  const { propertyId } = await requireEventContext();
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) throw new Error('Invalid schedule range.');

  const hall = await prisma.hall.findFirst({ where: { id: hallId, propertyId }, select: { id: true, name: true, code: true, capacity: true } });
  if (!hall) throw new Error('Hall not found.');

  const bookings = await prisma.eventBooking.findMany({
    where: { hallId, startTime: { lt: end }, endTime: { gt: start } },
    orderBy: { startTime: 'asc' },
    select: { id: true, eventId: true, startTime: true, endTime: true, setupBufferMinutes: true, teardownBufferMinutes: true, status: true, event: { select: { name: true, contactName: true, expectedGuests: true, status: true } } },
  });

  return { hall, bookings: bookings.map((booking) => ({ ...booking, startTime: booking.startTime.toISOString(), endTime: booking.endTime.toISOString() })) };
}

export async function getEventSchedule(startDate: string, endDate: string) {
  const { propertyId } = await requireEventContext();
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) throw new Error('Invalid schedule range.');

  const [halls, bookings] = await Promise.all([
    prisma.hall.findMany({ where: { propertyId, isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, code: true, capacity: true } }),
    prisma.eventBooking.findMany({ where: { hall: { propertyId }, startTime: { lt: end }, endTime: { gt: start } }, orderBy: { startTime: 'asc' }, select: { id: true, eventId: true, hallId: true, startTime: true, endTime: true, setupBufferMinutes: true, status: true, hall: { select: { name: true, code: true } }, event: { select: { name: true, contactName: true, expectedGuests: true, status: true } } } }),
  ]);

  return { halls, bookings: bookings.map((booking) => ({ ...booking, startTime: booking.startTime.toISOString(), endTime: booking.endTime.toISOString() })) };
}
