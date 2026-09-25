'use server';

import { prisma } from '@hotel-pms/db';
import { revalidatePath } from 'next/cache';
import { requireEventContext } from './access';

export async function createEventLead(data: { contactName: string; companyName: string; eventType: string; expectedGuests: number }) {
  const { propertyId } = await requireEventContext();
  const contactName = data.contactName.trim();
  const expectedGuests = Number(data.expectedGuests);
  if (!contactName) throw new Error('Contact name is required.');
  if (!Number.isInteger(expectedGuests) || expectedGuests < 0) throw new Error('Expected guests must be a valid non-negative number.');

  await prisma.eventLead.create({
    data: {
      propertyId,
      contactName,
      companyName: data.companyName?.trim() || undefined,
      eventType: data.eventType?.trim() || undefined,
      expectedGuests,
      status: 'NEW',
    }
  });

  revalidatePath('/fnb/events/crm');
}
