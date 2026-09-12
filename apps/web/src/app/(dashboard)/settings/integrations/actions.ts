'use server';

import { auth } from '@/lib/auth';
import { requireOrganizationContext } from '@/lib/organization-access';
import prisma, { encrypt } from '@hotel-pms/db';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const channexSetupSchema = z.object({
  provider: z.literal('CHANNEX'),
  externalPropertyId: z.string().min(1, 'Property ID is required'),
  webhookSecret: z.string().min(1, 'Webhook Secret is required'),
});

export async function saveChannelConnection(data: z.infer<typeof channexSetupSchema>) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'Unauthorized' };
    }

    const parsed = channexSetupSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: 'Invalid data submitted' };
    }

    const { provider, externalPropertyId, webhookSecret } = parsed.data;

    const ctx = await requireOrganizationContext(session.user.id);
    const propertyId = ctx.propertyIds[0]; // Assuming single property context for settings

    // We store the credentials as an encrypted JSON string
    const credentialsPayload = JSON.stringify({
      webhookSecret,
    });

    const encryptedCredentials = encrypt(credentialsPayload);

    await prisma.channelConnection.upsert({
      where: {
        propertyId_provider: {
          propertyId,
          provider,
        },
      },
      update: {
        externalPropertyId,
        credentialsRef: JSON.stringify(encryptedCredentials),
        status: 'CONNECTED',
      },
      create: {
        organizationId: ctx.organizationId,
        propertyId,
        provider,
        externalPropertyId,
        credentialsRef: JSON.stringify(encryptedCredentials),
        status: 'CONNECTED',
      },
    });

    revalidatePath('/settings/integrations/channels');
    revalidatePath(`/settings/integrations/channels/${provider.toLowerCase()}`);

    return { success: true };
  } catch (error: any) {
    console.error('Error saving channel connection:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}
