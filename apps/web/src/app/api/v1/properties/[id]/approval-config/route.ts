import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import {
  getApprovalFlows,
  saveApprovalFlows,
  APPROVABLE_ROLES,
  DEFAULT_APPROVAL_FLOWS,
  type PropertyApprovalFlows,
} from '@/lib/approval-config';

export const dynamic = 'force-dynamic';

// ─── GET /api/v1/properties/[id]/approval-config ──────────────────────────────
// Returns the current approval flow config for a property.
// Accessible by: SUPER_ADMIN, CEO, MANAGER (property scope).
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { role, propertyId: sessionPropertyId, isSuperAdmin } = session.user as any;

    // Must belong to this property or be a super admin
    if (!isSuperAdmin && sessionPropertyId !== params.id && role !== 'CEO') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const allowedRoles = ['SUPER_ADMIN', 'CEO', 'MANAGER', 'DIRECTOR', 'EXECUTIVE'];
    if (!isSuperAdmin && !allowedRoles.includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const property = await prisma.property.findUnique({
      where: { id: params.id },
      select: { id: true, name: true },
    });
    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    const flows = await getApprovalFlows(params.id);

    return NextResponse.json({
      data: {
        propertyId: params.id,
        propertyName: property.name,
        approvalFlows: flows,
        availableRoles: APPROVABLE_ROLES,
        defaults: DEFAULT_APPROVAL_FLOWS,
      },
      error: null,
    });
  } catch (err: any) {
    console.error('[GET /approval-config]', err);
    return NextResponse.json({ data: null, error: err.message }, { status: 500 });
  }
}

// ─── PATCH /api/v1/properties/[id]/approval-config ───────────────────────────
// Updates the approval flow config. Restricted to SUPER_ADMIN and CEO only.
// Body: { approvalFlows: Partial<PropertyApprovalFlows> }
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { role, propertyId: sessionPropertyId, isSuperAdmin } = session.user as any;

    // Only SUPER_ADMIN and CEO may change approval flow config
    const isAuthorized =
      isSuperAdmin ||
      role === 'SUPER_ADMIN' ||
      role === 'CEO' ||
      role === 'DIRECTOR' ||
      role === 'EXECUTIVE';
    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Only a Super Admin or CEO may modify approval flow configuration.' },
        { status: 403 }
      );
    }

    // Property scope check
    if (!isSuperAdmin && sessionPropertyId !== params.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const property = await prisma.property.findUnique({
      where: { id: params.id },
      select: { id: true },
    });
    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    const body = await req.json();
    const { approvalFlows } = body as { approvalFlows: Partial<PropertyApprovalFlows> };

    if (!approvalFlows || typeof approvalFlows !== 'object') {
      return NextResponse.json(
        { error: 'Body must contain an approvalFlows object.' },
        { status: 400 }
      );
    }

    // Validate each provided flow config
    for (const [flowType, config] of Object.entries(approvalFlows)) {
      if (!config) continue;

      if (!Array.isArray(config.approverRoles) || config.approverRoles.length === 0) {
        return NextResponse.json(
          { error: `${flowType}: approverRoles must be a non-empty array.` },
          { status: 400 }
        );
      }

      // Validate all roles are known
      const invalid = config.approverRoles.filter(
        (r: string) => !APPROVABLE_ROLES.includes(r) && r !== 'SUPER_ADMIN'
      );
      if (invalid.length > 0) {
        return NextResponse.json(
          { error: `${flowType}: Unknown roles: ${invalid.join(', ')}` },
          { status: 400 }
        );
      }

      if (config.steps !== 1 && config.steps !== 2) {
        return NextResponse.json(
          { error: `${flowType}: steps must be 1 or 2.` },
          { status: 400 }
        );
      }

      if (typeof config.minAmount !== 'number' || config.minAmount < 0) {
        return NextResponse.json(
          { error: `${flowType}: minAmount must be a non-negative number.` },
          { status: 400 }
        );
      }
    }

    await saveApprovalFlows(params.id, approvalFlows);

    const updated = await getApprovalFlows(params.id);

    return NextResponse.json({
      data: {
        propertyId: params.id,
        approvalFlows: updated,
        savedAt: new Date().toISOString(),
      },
      error: null,
    });
  } catch (err: any) {
    console.error('[PATCH /approval-config]', err);
    return NextResponse.json({ data: null, error: err.message }, { status: 500 });
  }
}
