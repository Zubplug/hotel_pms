import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { requireOrganizationContext } from '@/lib/organization-access';

export const dynamic = 'force-dynamic';

const REQUEST_TYPE = 'FNB_INVENTORY_CONTROL';
const MODES = ['SALE_ONLY', 'DEDUCT'] as const;
type InventoryMode = (typeof MODES)[number];

const FNB_ROLES = new Set([
  'FNB_MANAGER',
  'RESTAURANT_MANAGER',
  'BANQUET_MANAGER',
  'EVENT_MANAGER',
]);

const GM_ROLES = new Set([
  'GENERAL_MANAGER',
  'HOTEL_MANAGER',
  'DIRECTOR',
  'CEO',
  'ADMIN',
  'OWNER',
  'SUPER_ADMIN',
]);

function roleOf(session: any) {
  return String(session?.user?.role || session?.user?.position || '').toUpperCase();
}

function modeFromSettings(settings: unknown): InventoryMode {
  const mode = String((settings as any)?.fnb?.inventoryControl?.mode || 'DEDUCT').toUpperCase();
  return MODES.includes(mode as InventoryMode) ? mode as InventoryMode : 'DEDUCT';
}

function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function propertyForUser(propertyId: string, userId: string) {
  const ctx = await requireOrganizationContext(userId);
  if (!ctx.propertyIds.includes(propertyId)) throw new Error('FORBIDDEN');
  const property = await prisma.property.findFirst({
    where: { id: propertyId, isActive: true, organizationId: ctx.organizationId },
    select: { id: true, name: true, organizationId: true, settings: true },
  });
  if (!property) throw new Error('NOT_FOUND');
  return { ctx, property };
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return error('Authentication required', 401);
    const propertyId = new URL(req.url).searchParams.get('propertyId');
    if (!propertyId) return error('propertyId is required');

    const { ctx, property } = await propertyForUser(propertyId, String(session.user.id));
    const requests = await prisma.organizationApprovalRequest.findMany({
      where: { organizationId: ctx.organizationId, type: REQUEST_TYPE, status: 'PENDING' },
      orderBy: { requestedAt: 'desc' },
      take: 50,
      include: { requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
    const pendingRequest = requests.find((request) => (request.payload as any)?.propertyId === propertyId) || null;
    const currentMode = modeFromSettings(property.settings);

    return NextResponse.json({
      data: {
        property: { id: property.id, name: property.name },
        currentMode,
        pendingRequest,
        canSubmit: FNB_ROLES.has(roleOf(session)),
        canApprove: GM_ROLES.has(roleOf(session)),
      },
    });
  } catch (cause: any) {
    if (cause?.message === 'FORBIDDEN') return error('You do not have access to this property', 403);
    if (cause?.message === 'NOT_FOUND') return error('Property not found', 404);
    console.error('[FNB inventory control GET]', cause);
    return error('Unable to load F&B inventory control', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return error('Authentication required', 401);
    const body = await req.json();
    const propertyId = String(body.propertyId || '');
    const mode = String(body.mode || '').toUpperCase() as InventoryMode;
    if (!propertyId || !MODES.includes(mode)) return error('Choose a valid inventory mode');

    const { ctx, property } = await propertyForUser(propertyId, String(session.user.id));
    if (!FNB_ROLES.has(roleOf(session))) return error('Only an F&B Manager can submit this control request', 403);

    const existing = await prisma.organizationApprovalRequest.findMany({
      where: { organizationId: ctx.organizationId, type: REQUEST_TYPE, status: 'PENDING' },
      take: 50,
    });
    if (existing.some((request) => (request.payload as any)?.propertyId === propertyId)) {
      return error('There is already a pending inventory control request for this property', 409);
    }

    const request = await prisma.organizationApprovalRequest.create({
      data: {
        organizationId: property.organizationId,
        requestedById: String(session.user.id),
        type: REQUEST_TYPE,
        status: 'PENDING',
        reason: `Set POS inventory control to ${mode === 'DEDUCT' ? 'check and deduct' : 'sale only'}`,
        payload: {
          propertyId,
          propertyName: property.name,
          mode,
          previousMode: modeFromSettings(property.settings),
        },
      },
    });
    return NextResponse.json({ data: request }, { status: 201 });
  } catch (cause: any) {
    if (cause?.message === 'FORBIDDEN') return error('You do not have access to this property', 403);
    if (cause?.message === 'NOT_FOUND') return error('Property not found', 404);
    console.error('[FNB inventory control POST]', cause);
    return error('Unable to submit F&B inventory control request', 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return error('Authentication required', 401);
    if (!GM_ROLES.has(roleOf(session))) return error('Only the General Manager can approve this request', 403);

    const body = await req.json();
    const requestId = String(body.requestId || '');
    const decision = String(body.decision || '').toUpperCase();
    if (!requestId || !['APPROVED', 'REJECTED'].includes(decision)) return error('A valid requestId and decision are required');

    const ctx = await requireOrganizationContext(String(session.user.id));
    const request = await prisma.organizationApprovalRequest.findFirst({
      where: { id: requestId, organizationId: ctx.organizationId, type: REQUEST_TYPE, status: 'PENDING' },
    });
    if (!request) return error('Pending inventory control request not found', 404);
    if (request.requestedById === String(session.user.id)) return error('The requester cannot approve their own control request', 403);

    const payload = (request.payload || {}) as any;
    const propertyId = String(payload.propertyId || '');
    const mode = String(payload.mode || '').toUpperCase() as InventoryMode;
    if (!propertyId || !MODES.includes(mode)) return error('The request contains an invalid inventory mode');

    await prisma.$transaction(async (tx) => {
      if (decision === 'APPROVED') {
        const property = await tx.property.findFirst({ where: { id: propertyId, organizationId: ctx.organizationId } });
        if (!property) throw new Error('NOT_FOUND');
        const settings = ((property.settings as Record<string, any>) || {});
        await tx.property.update({
          where: { id: propertyId },
          data: {
            settings: {
              ...settings,
              fnb: {
                ...(settings.fnb || {}),
                inventoryControl: {
                  mode,
                  approvedAt: new Date().toISOString(),
                  approvedById: String(session.user.id),
                  requestId: request.id,
                },
              },
            },
          },
        });
      }
      await tx.organizationApprovalRequest.update({
        where: { id: request.id },
        data: {
          status: decision,
          reviewedById: String(session.user.id),
          reviewedAt: new Date(),
          reviewNotes: String(body.reviewNotes || (decision === 'APPROVED' ? `Approved ${mode} inventory control` : 'Inventory control request rejected')),
        },
      });
    });

    return NextResponse.json({ data: { success: true, decision, mode } });
  } catch (cause: any) {
    if (cause?.message === 'FORBIDDEN') return error('You do not have access to this organization', 403);
    if (cause?.message === 'NOT_FOUND') return error('Property not found', 404);
    console.error('[FNB inventory control PATCH]', cause);
    return error('Unable to process F&B inventory control request', 500);
  }
}
