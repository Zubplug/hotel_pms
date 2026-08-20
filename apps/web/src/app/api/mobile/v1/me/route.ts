import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }

    const userId = session.user.id;

    // Fetch user and staff details, ensuring we only select needed fields
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        roles: true,
        mfaEnabled: true,
        notificationPreferences: true,
      },
    });

    if (!user) {
      return errorResponse('NOT_FOUND', 'User profile not found', 404);
    }

    // Try to find the associated staff record for this user
    const staff = await prisma.staff.findUnique({
      where: { userId: userId },
      include: {
        organization: {
          include: {
            properties: {
              where: { isActive: true },
              select: { id: true, name: true, code: true }
            }
          }
        }
      }
    });

    // Map system role (first role or default)
    const systemRole = user.roles && user.roles.length > 0 ? user.roles[0].toString() : 'STAFF';

    // Build human-readable capabilities based on role (mock logic for now as requested by user to show human readable permissions)
    const capabilities = [];
    if (systemRole === 'ADMIN' || systemRole === 'DIRECTOR' || systemRole === 'MANAGER') {
      capabilities.push('View Financial Performance');
      capabilities.push('View Room Operations');
      capabilities.push('View Executive Reports');
      capabilities.push('Approve Expenses');
    } else {
      capabilities.push('View Room Operations');
      capabilities.push('Manage Tasks');
    }

    // Gather property access. 
    // For admins/directors, they typically have access to all active properties in the org.
    // Otherwise, restrict to staff.propertyAccess
    let authorizedProperties = [];
    if (staff && staff.organization) {
       if (systemRole === 'ADMIN' || systemRole === 'DIRECTOR') {
          authorizedProperties = staff.organization.properties.map(p => ({ id: p.id, name: p.name, code: p.code }));
       } else if (staff.propertyAccess && staff.propertyAccess.length > 0) {
          authorizedProperties = staff.organization.properties
             .filter(p => staff.propertyAccess.includes(p.id))
             .map(p => ({ id: p.id, name: p.name, code: p.code }));
       }
    }

    // Explicit DTO mapping
    const dto = {
      user: {
        id: user.id,
        firstName: staff?.firstName || 'User',
        lastName: staff?.lastName || '',
        email: user.email,
        phone: staff?.phone || null,
      },
      staff: staff ? {
        employeeId: staff.employeeId || null,
        position: staff.position,
        department: staff.department,
      } : null,
      authorization: {
        role: systemRole,
        properties: authorizedProperties,
        capabilities: capabilities,
      },
      preferences: {
        // Map from DB if available, else defaults
        notifications: {
          criticalAlerts: true,
          approvals: true,
          operations: true,
          guestExperience: true,
        },
        dailyBrief: true,
        mfaEnabled: user.mfaEnabled,
      }
    };

    return successResponse(dto);
  } catch (err: any) {
    console.error('[GET /api/mobile/v1/me] Error:', err);
    return errorResponse('INTERNAL_ERROR', 'Failed to retrieve profile', 500);
  }
}
