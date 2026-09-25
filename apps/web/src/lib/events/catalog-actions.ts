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

export async function saveBanquetPackage(data: { id?: string; name: string; description?: string; basePrice: number; isHallOnly?: boolean }) {
  const { propertyId } = await requireEventContext();
  const name = data.name.trim();
  const basePrice = Number(data.basePrice);
  if (!name) throw new Error('Package name is required.');
  if (!Number.isFinite(basePrice) || basePrice < 0) throw new Error('Base price must be a valid non-negative amount.');

  if (data.id) {
    const existing = await prisma.banquetPackage.findFirst({ where: { id: data.id, propertyId }, select: { id: true } });
    if (!existing) throw new Error('Package not found.');
    await prisma.banquetPackage.update({ where: { id: existing.id }, data: { name, description: data.description?.trim() || null, basePrice, isHallOnly: Boolean(data.isHallOnly) } });
  } else {
    await prisma.banquetPackage.create({ data: { propertyId, name, description: data.description?.trim() || undefined, basePrice, isHallOnly: Boolean(data.isHallOnly), isActive: true } });
  }
  revalidatePath('/fnb/events/packages');
  revalidatePath('/fnb/events/bookings/create/full-package');
}
