'use server';

import { prisma, EventLeadStatus } from '@hotel-pms/db';
import { revalidatePath } from 'next/cache';
import { requireEventContext } from './access';

export async function updateEventLeadStatus(leadId: string, newStatus: string) {
  const { propertyId } = await requireEventContext();
  const validStatuses = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT', 'CONVERTED', 'LOST'];
  if (!validStatuses.includes(newStatus)) {
    throw new Error('Invalid status');
  }

  const lead = await prisma.eventLead.findFirst({ where: { id: leadId, propertyId }, select: { id: true } });
  if (!lead) throw new Error('Lead not found.');

  await prisma.eventLead.update({
    where: { id: lead.id },
    data: { status: newStatus as EventLeadStatus }
  });

  revalidatePath('/fnb/events/crm');
}
