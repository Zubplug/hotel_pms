import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { hasPermission } from '@/lib/rbac';
import { getUserPropertyIds } from '@/lib/property-access';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { searchParams } = req.nextUrl;
    const propertyId = searchParams.get('propertyId');
    const status = searchParams.get('status');
    const assignedTo = searchParams.get('assignedTo');
    
    // Default to today if not provided
    const businessDateStr = searchParams.get('businessDate');
    let businessDate = new Date();
    businessDate.setUTCHours(0, 0, 0, 0);
    if (businessDateStr) {
      businessDate = new Date(businessDateStr);
    }

    const allowedProperties = await getUserPropertyIds(session.user.id);
    if (!allowedProperties.length) return successResponse([]);

    // Enforce role visibility
    let filterAssignedTo = assignedTo;
    const capabilities = (session.user as any).capabilities || [];
    
    // If they have ACCESS_HOUSEKEEPING but not ACCESS_MANAGEMENT or something higher, they only see their own tasks
    const userRole = String((session.user as any).role || '').toUpperCase();
    const isReceptionist = userRole === 'RECEPTIONIST' || userRole === 'FRONT_DESK';
    const isBasicHousekeeper = !isReceptionist && capabilities.includes('ACCESS_HOUSEKEEPING') && !capabilities.includes('ACCESS_MANAGEMENT');
    if (isBasicHousekeeper) {
      // Basic housekeepers can only see their own tasks
      filterAssignedTo = session.user.id;
    }

    const tasks = await prisma.housekeepingTask.findMany({
      where: {
        propertyId: {
          in: propertyId && allowedProperties.includes(propertyId) ? [propertyId] : allowedProperties
        },
        businessDate: businessDate,
        ...(status ? { status: status as any } : {}),
        ...(filterAssignedTo ? { assignedTo: filterAssignedTo } : {})
      },
      include: {
        room: {
          select: { number: true, roomType: { select: { name: true } }, status: true }
        }
      },
      orderBy: [
        { priority: 'asc' }, // Will need custom sort if priority is text, but for now simple fallback
        { createdAt: 'desc' }
      ]
    });

    return successResponse(tasks);
  } catch (err) {
    console.error('[HousekeepingTasks GET]', err);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch tasks', 500);
  }
}

// Supervisor manual task creation
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const body = await req.json();
    const { propertyId, roomId, type, priority, assignedTo, notes } = body;

    if (!propertyId || !roomId || !type || !priority) {
      return errorResponse('BAD_REQUEST', 'Missing required fields', 400);
    }

    const canManage = await hasPermission(session.user.id, 'housekeeping', 'create', propertyId);
    if (!canManage) return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);

    const businessDate = new Date();
    businessDate.setUTCHours(0, 0, 0, 0);

    const task = await prisma.housekeepingTask.create({
      data: {
        propertyId,
        roomId,
        type,
        priority,
        status: 'CLEANING',
        assignedTo,
        businessDate,
        notes,
        idempotencyKey: `MANUAL_${crypto.randomUUID()}`
      }
    });

    // Sync room housekeeping status
    await prisma.room.update({
      where: { id: roomId },
      data: { housekeepingStatus: 'CLEANING', status: 'CLEANING' }
    });

    return successResponse(task, 201);
  } catch (err) {
    console.error('[HousekeepingTasks POST]', err);
    return errorResponse('INTERNAL_ERROR', 'Failed to create task', 500);
  }
}
