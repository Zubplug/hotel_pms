'use server';

import { prisma } from '@hotel-pms/db';
import { revalidatePath } from 'next/cache';
import { requireEventContext } from './access';

export async function createEventLead(data: { contactName: string; companyName: string; contactEmail?: string; contactPhone?: string; eventType: string; expectedGuests: number; preferredDate?: string; notes?: string }) {
  const { propertyId } = await requireEventContext();
  const contactName = data.contactName.trim();
  const expectedGuests = Number(data.expectedGuests);
  if (!contactName) throw new Error('Contact name is required.');
  if (!Number.isInteger(expectedGuests) || expectedGuests < 0) throw new Error('Expected guests must be a valid non-negative number.');
  const preferredDate = data.preferredDate ? new Date(`${data.preferredDate}T00:00:00`) : undefined;
  if (preferredDate && Number.isNaN(preferredDate.getTime())) throw new Error('Preferred event date must be valid.');

  await prisma.eventLead.create({
    data: {
      propertyId,
      contactName,
      companyName: data.companyName?.trim() || undefined,
      contactEmail: data.contactEmail?.trim() || undefined,
      contactPhone: data.contactPhone?.trim() || undefined,
      eventType: data.eventType?.trim() || undefined,
      expectedGuests,
      preferredDate,
      notes: data.notes?.trim() || undefined,
      status: 'NEW',
    }
  });

  revalidatePath('/fnb/events/crm');
}
