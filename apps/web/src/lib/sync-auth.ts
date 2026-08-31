import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { compare } from 'bcryptjs';
import { createHash } from 'crypto';

export type SyncAuthResult = 
  | { success: false; error: string; status: number }
  | { success: true; propertyId: string; organizationId: string | null; isDevice: boolean; deviceId?: string };

/**
 * Authenticates a sync request by checking either:
 * 1. A NextAuth session (for web clients)
 * 2. A Bearer Device Token (for headless Desktop/POS clients)
 * 
 * It also validates that the authenticated entity has access to the requested propertyId.
 */
export async function authenticateSyncRequest(req: NextRequest, targetPropertyId: string): Promise<SyncAuthResult> {
  if (!targetPropertyId) {
    return { success: false, error: 'propertyId is required', status: 400 };
  }

  // 1. Try Device Token Auth
  const authHeader = req.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const deviceToken = authHeader.substring(7);
    
    // Verify the device token against the registered POS terminals
    const terminals = await prisma.posTerminal.findMany({
      where: {
        propertyId: targetPropertyId,
        registrationState: 'REGISTERED'
      }
    });

    let authorizedDevice = null;
    const sha256Hash = createHash('sha256').update(deviceToken).digest('hex');

    for (const t of terminals) {
      if (t.deviceCredentialHash) {
        if (t.deviceCredentialHash === sha256Hash) {
           authorizedDevice = t;
           break;
        }
        if (t.deviceCredentialHash.length === 60) {
           if (await compare(deviceToken, t.deviceCredentialHash)) {
             authorizedDevice = t;
             break;
           }
        }
      }
    }

    if (authorizedDevice) {
      return { 
        success: true, 
        propertyId: targetPropertyId, 
        organizationId: authorizedDevice.organisationId,
        isDevice: true,
        deviceId: authorizedDevice.id
      };
    }
  }

  // 2. Try NextAuth Session
  const session = await auth();
  if (session?.user?.id) {
    try {
      const { requireOrganizationContext } = await import('@/lib/organization-access');
      const ctx = await requireOrganizationContext(session.user.id);
      
      if (ctx.propertyIds.includes(targetPropertyId)) {
        return { 
          success: true, 
          propertyId: targetPropertyId, 
          organizationId: ctx.organizationId,
          isDevice: false 
        };
      } else {
        return { success: false, error: 'User does not have access to this property', status: 403 };
      }
    } catch (e: any) {
      return { success: false, error: e.message || 'Authorization failed', status: 403 };
    }
  }

  return { success: false, error: 'Authentication required. Missing or invalid device token or session.', status: 401 };
}
