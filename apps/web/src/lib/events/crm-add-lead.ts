'use server';

import { prisma } from '@hotel-pms/db';
import { revalidatePath } from 'next/cache';

export async function createEventLead(data: { contactName: string; companyName: string; eventType: string; expectedGuests: number }) {
  const property = await prisma.property.findFirst();
  if (!property) throw new Error("No active property found in the system.");
  const targetPropertyId = property.id;

  await prisma.eventLead.create({
    data: {
      propertyId: targetPropertyId,
      contactName: data.contactName,
      companyName: data.companyName,
      eventType: data.eventType,
      expectedGuests: data.expectedGuests,
      status: 'NEW',
    }
  });

  revalidatePath('/fnb/events/crm');
}
