'use server';

import { auth } from '@/lib/auth';
import { requireOrganizationContext } from '@/lib/organization-access';
import prisma, { encrypt } from '@hotel-pms/db';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { Beds24TokenManager } from '@/lib/integrations/ota/providers/beds24/token-manager';
import { ProviderFactory } from '@/lib/integrations/ota/ProviderFactory';
import { requireEntitlement } from '@/lib/auth/entitlement';

const connectionSchema = z.object({
  provider: z.enum(['CHANNEX', 'BEDS24']),
  externalPropertyId: z.string().min(1, 'Property ID is required'),
  // Depending on provider, they pass either explicit fields or an already encrypted ref
  webhookSecret: z.string().optional(),
  apiToken: z.string().optional(),
  credentialsRef: z.string().optional(),
});

/**
 * Step 1 for Beds24: Exchanges Invite Code for a Refresh Token,
 * and fetches the available properties so the user can select one.
 */
export async function verifyBeds24InviteCode(inviteCode: string) {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: 'Unauthorized' };
    const ctx = await requireOrganizationContext(session.user.id);
    await requireEntitlement(ctx.organizationId, 'ADDON_BEDS24');

    // Exchange the invite code
    const encryptedRefreshToken = await Beds24TokenManager.exchangeInviteCode(inviteCode);

    // Fetch the properties using the adapter
    const adapter = ProviderFactory.getAdapter('BEDS24');
    
    // Discovery is performed against the authenticated Beds24 account before a property is selected.
    if (!adapter.getProperties) return { success: false, error: 'Provider does not support property discovery' };
    const properties = await adapter.getProperties(encryptedRefreshToken, Beds24TokenManager.getAccountKey(encryptedRefreshToken));

    return { 
      success: true, 
      encryptedRefreshToken, 
      properties: properties.map((p: any) => ({ id: p.id, name: p.name })) 
    };
  } catch (error: any) {
    console.error('Beds24 Invite Code verification failed:', error);
    return { success: false, error: error.message || 'Verification failed.' };
  }
}

export async function saveChannelConnection(data: z.infer<typeof connectionSchema>) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'Unauthorized' };
    }

    const parsed = connectionSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: 'Invalid data submitted' };
    }

    const { provider, externalPropertyId, webhookSecret, apiToken, credentialsRef } = parsed.data;

    const ctx = await requireOrganizationContext(session.user.id);
    if (provider === 'BEDS24') await requireEntitlement(ctx.organizationId, 'ADDON_BEDS24');
    const propertyId = ctx.propertyIds[0];

    // Determine the credentials format
    let finalCredentialsRef = credentialsRef;
    if (provider === 'CHANNEX') {
      const payload = JSON.stringify({ webhookSecret, apiToken });
      finalCredentialsRef = JSON.stringify(encrypt(payload));
    }

    if (!finalCredentialsRef) {
      return { success: false, error: 'Missing credentials' };
    }

    await prisma.channelConnection.upsert({
      where: {
        propertyId_provider: {
          propertyId,
          provider,
        },
      },
      update: {
        externalPropertyId,
        credentialsRef: finalCredentialsRef,
        status: 'CONNECTED',
      },
      create: {
        organizationId: ctx.organizationId,
        propertyId,
        provider,
        externalPropertyId,
        credentialsRef: finalCredentialsRef,
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

export async function syncRemoteRooms(providerSlug: string) {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: 'Unauthorized' };
    const ctx = await requireOrganizationContext(session.user.id);
    if (providerSlug.toUpperCase() === 'BEDS24') await requireEntitlement(ctx.organizationId, 'ADDON_BEDS24');
    const propertyId = ctx.propertyIds[0];

    const connection = await prisma.channelConnection.findUnique({
      where: { propertyId_provider: { propertyId, provider: providerSlug as any } }
    });

    if (!connection) return { success: false, error: 'Connection not found' };

    const adapter = ProviderFactory.getAdapter(providerSlug);
    const remoteRooms = await adapter.fetchRemoteRooms(connection.credentialsRef);
    const localRoomTypes = await prisma.roomType.findMany({
      where: { propertyId, isActive: true },
      select: { id: true, name: true, code: true },
    });
    const normalize = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

    // Upsert mappings in DB
    for (const room of remoteRooms) {
      const localRoomType = localRoomTypes.find((candidate) =>
        [candidate.name, candidate.code].some((value) => normalize(value) === normalize(room.name)),
      );
      await prisma.channelRoomMapping.upsert({
        where: {
          channelConnectionId_externalRoomTypeId: {
            channelConnectionId: connection.id,
            externalRoomTypeId: room.externalId,
          }
        },
        update: {
          // If we ever sync names, update here. Currently schema just links external ID.
        },
        create: {
          channelConnectionId: connection.id,
          lodgecoreRoomTypeId: localRoomType?.id ?? null,
          externalRoomTypeId: room.externalId,
          status: localRoomType ? 'MAPPED' : 'UNMAPPED',
          isActive: Boolean(localRoomType),
        }
      });
    }

    revalidatePath(`/settings/integrations/channels/${providerSlug.toLowerCase()}`);
    return { success: true };
  } catch (error: any) {
    console.error('Error syncing remote rooms:', error);
    return { success: false, error: error.message };
  }
}

export async function syncRemoteRatePlans(providerSlug: string) {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: 'Unauthorized' };
    const ctx = await requireOrganizationContext(session.user.id);
    if (providerSlug.toUpperCase() === 'BEDS24') await requireEntitlement(ctx.organizationId, 'ADDON_BEDS24');
    const propertyId = ctx.propertyIds[0];

    const connection = await prisma.channelConnection.findUnique({
      where: { propertyId_provider: { propertyId, provider: providerSlug as any } }
    });

    if (!connection) return { success: false, error: 'Connection not found' };

    const adapter = ProviderFactory.getAdapter(providerSlug);
    const remoteRatePlans = await adapter.fetchRemoteRatePlans(connection.credentialsRef);
    const localRatePlans = await prisma.ratePlan.findMany({
      where: { propertyId, isActive: true },
      select: { id: true, name: true, code: true },
    });
    const normalize = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

    // Upsert mappings in DB
    for (const rate of remoteRatePlans) {
      const localRatePlan = localRatePlans.find((candidate) =>
        [candidate.name, candidate.code].some((value) => normalize(value) === normalize(rate.name)),
      );
      await prisma.channelRatePlanMapping.upsert({
        where: {
          channelConnectionId_externalRatePlanId: {
            channelConnectionId: connection.id,
            externalRatePlanId: rate.externalId,
          }
        },
        update: {},
        create: {
          channelConnectionId: connection.id,
          lodgecoreRatePlanId: localRatePlan?.id ?? null,
          externalRatePlanId: rate.externalId,
          status: localRatePlan ? 'MAPPED' : 'UNMAPPED',
          isActive: Boolean(localRatePlan),
        }
      });
    }

    revalidatePath(`/settings/integrations/channels/${providerSlug.toLowerCase()}`);
    return { success: true };
  } catch (error: any) {
    console.error('Error syncing remote rate plans:', error);
    return { success: false, error: error.message };
  }
}

export async function mapChannelRoom(mappingId: string, lodgecoreRoomTypeId: string) {
  const session = await auth();
  if (!session?.user) return { success: false, error: 'Unauthorized' };
  const ctx = await requireOrganizationContext(session.user.id);
  const allowedConnectionIds = (await prisma.channelConnection.findMany({ where: { propertyId: { in: [...ctx.propertyIds] } }, select: { id: true } })).map((item) => item.id);
  const mapping = await prisma.channelRoomMapping.findFirst({
    where: { id: mappingId, channelConnectionId: { in: allowedConnectionIds } },
  });
  const connection = mapping ? await prisma.channelConnection.findUnique({ where: { id: mapping.channelConnectionId } }) : null;
  const room = await prisma.roomType.findFirst({ where: { id: lodgecoreRoomTypeId, propertyId: connection?.propertyId, isActive: true } });
  if (!mapping || !room) return { success: false, error: 'Mapping or room type not found' };
  await prisma.channelRoomMapping.update({ where: { id: mapping.id }, data: { lodgecoreRoomTypeId: room.id, status: 'MAPPED', isActive: true } });
  revalidatePath(`/settings/integrations/channels/${connection?.provider.toLowerCase()}`);
  return { success: true };
}

export async function mapChannelRatePlan(mappingId: string, lodgecoreRatePlanId: string) {
  const session = await auth();
  if (!session?.user) return { success: false, error: 'Unauthorized' };
  const ctx = await requireOrganizationContext(session.user.id);
  const allowedConnectionIds = (await prisma.channelConnection.findMany({ where: { propertyId: { in: [...ctx.propertyIds] } }, select: { id: true } })).map((item) => item.id);
  const mapping = await prisma.channelRatePlanMapping.findFirst({
    where: { id: mappingId, channelConnectionId: { in: allowedConnectionIds } },
  });
  const connection = mapping ? await prisma.channelConnection.findUnique({ where: { id: mapping.channelConnectionId } }) : null;
  const ratePlan = await prisma.ratePlan.findFirst({ where: { id: lodgecoreRatePlanId, propertyId: connection?.propertyId, isActive: true } });
  if (!mapping || !ratePlan) return { success: false, error: 'Mapping or rate plan not found' };
  await prisma.channelRatePlanMapping.update({ where: { id: mapping.id }, data: { lodgecoreRatePlanId: ratePlan.id, status: 'MAPPED', isActive: true } });
  revalidatePath(`/settings/integrations/channels/${connection?.provider.toLowerCase()}`);
  return { success: true };
}
