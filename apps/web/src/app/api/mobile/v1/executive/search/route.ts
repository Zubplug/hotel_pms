import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { resolveUser } from '@/lib/resolve-user';
import { requireOrganizationContext } from '@/lib/organization-access';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await resolveUser(req);
    
    if (!user) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }
    
    const ctx = await requireOrganizationContext(user.id);
    const allowedPropertyIds = ctx.propertyIds;

    if (allowedPropertyIds.length === 0) {
      return errorResponse('FORBIDDEN', 'No property access', 403);
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    const propertyId = searchParams.get('propertyId');

    if (query.length < 2) {
      return successResponse({ results: [] }, 200);
    }

    let targetProperties = [...allowedPropertyIds];
    if (propertyId && propertyId !== 'ALL_AUTHORIZED') {
      if (allowedPropertyIds.includes(propertyId)) {
        targetProperties = [propertyId];
      } else {
        return errorResponse('FORBIDDEN', 'Access denied to this property', 403);
      }
    }

    const searchResults: any[] = [];

    // 1. Search Rooms
    const rooms = await prisma.room.findMany({
      where: {
        propertyId: { in: targetProperties },
        OR: [
          { number: { contains: query, mode: 'insensitive' } },
          { name: { contains: query, mode: 'insensitive' } }
        ]
      },
      take: 5
    });

    rooms.forEach(r => {
      searchResults.push({
        id: r.id,
        type: 'ROOM',
        title: `Room ${r.number}`,
        subtitle: r.name || 'Standard Room',
        route: `/rooms/${r.id}`
      });
    });

    // 2. Search Guests
    const guests = await prisma.guest.findMany({
      where: {
        propertyId: { in: targetProperties },
        OR: [
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query, mode: 'insensitive' } }
        ]
      },
      take: 5
    });

    guests.forEach(g => {
      searchResults.push({
        id: g.id,
        type: 'GUEST',
        title: `${g.firstName} ${g.lastName}`,
        subtitle: g.email || g.phone || 'Guest Profile',
        route: `/guests/${g.id}`
      });
    });

    // 3. Search Staff
    const staffMembers = await prisma.staff.findMany({
      where: {
        organizationId: ctx.organizationId,
        OR: [
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } }
        ]
      },
      take: 5
    });

    staffMembers.forEach(s => {
      searchResults.push({
        id: s.id,
        type: 'STAFF',
        title: `${s.firstName} ${s.lastName}`,
        subtitle: s.department || 'Staff Member',
        route: `/staff/${s.id}`
      });
    });

    return successResponse({ results: searchResults }, 200);

  } catch (err: any) {
    console.error('[Mobile Global Search GET]', err);
    return errorResponse('INTERNAL_ERROR', err?.message || 'Unexpected error searching', 500);
  }
}
