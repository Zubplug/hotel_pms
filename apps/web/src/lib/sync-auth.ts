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
  if (session?.user) {
    // We need to resolve property access. In our auth model, user roles define property access.
    // If the user has access to this property, allow it.
    const userRoles = await prisma.userRole.findMany({
      where: {
        userId: session.user.id,
        OR: [
          { propertyId: targetPropertyId },
          { propertyId: null } // Org-wide role
        ]
      },
      include: {
        role: {
          include: { organization: true }
        }
      }
    });

    if (userRoles.length > 0) {
      // Find the organization ID. If they have a property-specific role, we still need the org ID for the property.
      // If it's an org-wide role, we use that org ID.
      let orgId = userRoles[0].role?.organizationId || null;
      
      if (!orgId) {
        const prop = await prisma.property.findUnique({ where: { id: targetPropertyId } });
        if (prop) orgId = prop.organizationId;
      }

      return { 
        success: true, 
        propertyId: targetPropertyId, 
        organizationId: orgId,
        isDevice: false 
      };
    } else {
      return { success: false, error: 'User does not have access to this property', status: 403 };
    }
  }

  return { success: false, error: 'Authentication required. Missing or invalid device token or session.', status: 401 };
}
