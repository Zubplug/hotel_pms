'use server';

import { prisma, EventLeadStatus } from '@hotel-pms/db';
import { revalidatePath } from 'next/cache';

export async function updateEventLeadStatus(leadId: string, newStatus: string) {
  const validStatuses = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT', 'CONVERTED', 'LOST'];
  if (!validStatuses.includes(newStatus)) {
    throw new Error('Invalid status');
  }

  await prisma.eventLead.update({
    where: { id: leadId },
    data: { status: newStatus as EventLeadStatus }
  });

  revalidatePath('/fnb/events/crm');
}
