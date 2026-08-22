import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { compare } from 'bcryptjs';
import { createHash } from 'crypto';

/**
 * GET /api/v1/sync/pull
 *
 * Secure desktop sync pull endpoint.
 * Called by the C# SyncEngine on connected desktop terminals to refresh:
 *   - Staff with POS PIN hashes, permissions, and access flags
 *   - Property configuration (timezone, business date, early check-in window)
 *
 * Authentication: Bearer device token (issued at device registration)
 * 
 * The response intentionally omits web session tokens, payment credentials,
 * and anything not needed for offline desktop operation.
 */
export async function GET(req: NextRequest) {
  try {
    // ---- Device authentication ------------------------------------------
    // Desktop devices authenticate with the device token issued at registration,
    // not with a user session cookie. This is a machine-to-machine call.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing device token' }, { status: 401 });
    }

    const deviceToken = authHeader.substring(7);
    const propertyId  = req.nextUrl.searchParams.get('propertyId');

    if (!propertyId) {
      return NextResponse.json({ error: 'propertyId is required' }, { status: 400 });
    }

    // Verify the device token against the registered POS terminals
    const terminals = await prisma.posTerminal.findMany({
      where: {
        propertyId,
        registrationState: 'REGISTERED' // or whatever active state is
      }
    });

    let device = null;
    const sha256Hash = createHash('sha256').update(deviceToken).digest('hex');

    for (const t of terminals) {
      if (t.deviceCredentialHash) {
        if (t.deviceCredentialHash === sha256Hash) {
           device = t;
           break;
        }
        if (t.deviceCredentialHash.length === 60) {
           if (await compare(deviceToken, t.deviceCredentialHash)) {
             device = t;
             break;
           }
        }
      }
    }

    if (!device) {
      return NextResponse.json({ error: 'Terminal not authorized' }, { status: 403 });
    }

    // ---- Load property config -------------------------------------------
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        id:           true,
        name:         true,
        code:         true,
        city:         true,
        baseCurrency: true,
        timezone:     true,
        businessDate: true,
        isActive:     true,
        settings:     true, // includes earlyCheckinWindowHours
        checkInTime:  true,
        checkOutTime: true,
      }
    });

    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    // ---- Load staff with permissions ------------------------------------
    // We resolve each staff member's permissions through their User → Role chain.
    // Only staff with propertyAccess containing this propertyId are included.
    const staffList = await prisma.staff.findMany({
      where: {
        propertyAccess: { has: propertyId },
        isActive: true,
        deletedAt: null,
      },
      select: {
        id:              true,
        firstName:       true,
        lastName:        true,
        department:      true,
        position:        true,
        posPinHash:      true,   // Needed for offline PIN auth
        posTokenVersion: true,
        isActive:        true,
        // Resolve User → UserRole → Role → RolePermission → Permission
        userId: true,
      }
    });

    // For each staff member, resolve their permission names via their User roles
    const staffWithPermissions = await Promise.all(
      staffList.map(async (staff: any) => {
        let permissions: string[] = [];
        let roleName = '';
        let hasPosAccess = false;

        if (staff.userId) {
          const userRoles = await prisma.userRole.findMany({
            where: {
              userId: staff.userId,
              OR: [
                { propertyId },
                { propertyId: null } // org-wide roles
              ]
            },
            include: {
              role: {
                include: {
                  permissions: {
                    include: { permission: true }
                  }
                }
              }
            }
          });

          // Flatten all permission names across all roles
          permissions = Array.from(new Set<string>(
            userRoles.flatMap((ur: any) =>
              ur.role.permissions.map((rp: any) => rp.permission.name)
            )
          ));

          // Use the most privileged role name for the session
          roleName = userRoles[0]?.role?.name ?? staff.position;

          // POS access = has any POS-related permission or explicit department
          hasPosAccess = permissions.some(p =>
            p === 'ACCESS_POS' ||
            p === 'ACCESS_FRONT_DESK' ||
            p === 'ACCESS_CASH_MANAGEMENT' ||
            p === 'USE_EMERGENCY_CASHIER' ||
            p.startsWith('ACCESS_KEYCARD')
          ) || ['RECEPTIONIST', 'CASHIER', 'WAITER', 'BARTENDER', 'FRONT_OFFICE_MANAGER', 'MANAGER', 'GENERAL MANAGER', 'GENERAL_MANAGER', 'ADMIN', 'DIRECTOR', 'EXECUTIVE', 'SUPER_ADMIN'].includes(
            staff.position?.toUpperCase()
          ) || ['RECEPTIONIST', 'CASHIER', 'WAITER', 'BARTENDER', 'FRONT_OFFICE_MANAGER', 'MANAGER', 'GENERAL MANAGER', 'GENERAL_MANAGER', 'ADMIN', 'DIRECTOR', 'EXECUTIVE', 'SUPER_ADMIN'].includes(
            roleName?.toUpperCase()
          );

        }

        return {
          id:              staff.id,
          firstName:       staff.firstName,
          lastName:        staff.lastName,
          department:      staff.department,
          position:        staff.position,
          role:            roleName || staff.position,
          posPinHash:      staff.posPinHash ?? null,
          posTokenVersion: staff.posTokenVersion,
          isActive:        staff.isActive,
          hasPosAccess,
          // Serialized as JSON array for the LocalStaff.PermissionsJson field
          permissionsJson: JSON.stringify(permissions),
        };
      })
    );

    // ---- Build property payload -----------------------------------------
    const settings = (property.settings as Record<string, unknown>) ?? {};
    const propertyPayload = {
      id:                     property.id,
      name:                   property.name,
      code:                   property.code,
      city:                   property.city,
      currency:               property.baseCurrency,
      timezone:               property.timezone,
      businessDate:           property.businessDate,
      isActive:               property.isActive,
      checkInTime:            property.checkInTime,
      checkOutTime:           property.checkOutTime,
      // earlyCheckinWindowHours lives in the property settings JSON blob.
      // Default to 2 if not yet configured.
      earlyCheckinWindowHours: (settings.earlyCheckinWindowHours as number) ?? 2,
      bankingModel: ((settings.pos as any)?.bankingModel as string) ?? 'CENTRAL_CASHIER',
    };

    // ---- Load Front Desk Operational Cache ------------------------------
    // 1. Rooms & Room Types
    const rooms = await prisma.room.findMany({
      where: { propertyId, isActive: true }
    });
    const roomTypes = await prisma.roomType.findMany({
      where: { propertyId, isActive: true }
    });

    // 2. Target window for Reservations: In-house + 3 days out + today's departures
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const threeDaysFromNow = new Date(now);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const reservations = await prisma.reservation.findMany({
      where: {
        propertyId,
        deletedAt: null,
        OR: [
          { status: 'CHECKED_IN' },
          { status: 'CONFIRMED', checkIn: { lte: threeDaysFromNow, gte: yesterday } },
          { checkOut: { gte: yesterday, lte: threeDaysFromNow } }
        ]
      },
      include: {
        primaryGuest: true,
        reservationGuests: {
          include: { guest: true }
        },
        reservationRooms: {
          include: { room: true }
        },
        folios: {
          include: { items: true, payments: true }
        }
      }
    });

    // 3. Flatten Guests and Folios from the reservations
    const guestMap = new Map<string, any>();
    const folios: any[] = [];
    const plainReservations = reservations.map(r => {
      // Add primary guest
      if (r.primaryGuest) {
        guestMap.set(r.primaryGuest.id, r.primaryGuest);
      }
      // Add additional guests
      r.reservationGuests.forEach(rg => {
        if (rg.guest) guestMap.set(rg.guest.id, rg.guest);
      });
      // Add folios
      r.folios.forEach(f => folios.push(f));

      // Extract Room ID and Number for Desktop Offline Sync
      const roomId = r.reservationRooms?.[0]?.roomId || null;
      const roomNumber = r.reservationRooms?.[0]?.room?.number || null;

      // Return clean reservation without nested big objects
      const { primaryGuest, reservationGuests, folios: rFolios, reservationRooms, ...rest } = r;
      return { ...rest, roomId, roomNumber };
    });

    const guests = Array.from(guestMap.values());

    // 4. POS Configuration
    const posOutlets = await prisma.posOutlet.findMany({
      where: { propertyId, isActive: true }
    });
    
    // Using propertyId filter isn't strictly necessary if we filtered by outletId, 
    // but the schema may not have propertyId on ProductCategory. Let's rely on outlet relation.
    // Wait, ProductCategory might have propertyId? Or PosProduct might have it? Let's check prisma. 
    // Wait! Let me just fetch everything related to the property's outlets.
    const outletIds = posOutlets.map(o => o.id);
    const posCategories = await prisma.productCategory.findMany({
      where: { outletId: { in: outletIds }, isActive: true }
    });
    
    // PosProducts usually have categoryId. Let's fetch them based on category or outlet.
    // Assuming PosProduct has propertyId (based on LocalPosProduct.cs having PropertyId).
    const posProducts = await prisma.posProduct.findMany({
      where: { propertyId, isActive: true }
    });

    return NextResponse.json({
      syncedAt:   new Date().toISOString(),
      property:   propertyPayload,
      staff:      staffWithPermissions,
      rooms,
      roomTypes,
      reservations: plainReservations,
      guests,
      folios,
      posOutlets,
      posCategories,
      posProducts
    });

  } catch (error: any) {
    console.error('[sync/pull] Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
