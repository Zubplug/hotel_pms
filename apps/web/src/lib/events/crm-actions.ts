'use server';

import { prisma } from '@hotel-pms/db';
import { revalidatePath } from 'next/cache';

export async function updateEventLeadStatus(leadId: string, newStatus: string) {
  const validStatuses = ['NEW', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'];
  if (!validStatuses.includes(newStatus)) {
    throw new Error('Invalid status');
  }

  await prisma.eventLead.update({
    where: { id: leadId },
    data: { status: newStatus }
  });

  revalidatePath('/fnb/events/crm');
}
