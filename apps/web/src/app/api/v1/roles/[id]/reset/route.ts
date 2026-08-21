import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session || !session.user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.user.capabilities?.includes('MANAGE_ROLES')) {
      return NextResponse.json({ error: 'Forbidden: Requires MANAGE_ROLES permission' }, { status: 403 });
    }

    const { organizationId } = session.user;
    const { id: roleId } = await params;

    const existingRole = await prisma.role.findUnique({
      where: { id: roleId },
      include: { permissions: { include: { permission: true } } }
    });

    if (!existingRole || existingRole.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    if (!existingRole.isSystem) {
      return NextResponse.json({ error: 'Cannot reset a custom role' }, { status: 400 });
    }

    // Call seed_auth logic (or just lookup default capabilities)
    // Since we don't want to duplicate the system roles array here, we can actually just 
    // re-fetch it from a shared constant. But for this endpoint, we'll hardcode the known baseline 
    // or fetch from an external module.
    // For now, we will reject the request if the baseline is unknown, or we can restore the baseline manually.
    // In LodgeCore, SUPER_ADMIN has ALL permissions.
    let baselinePermissions: any[] = [];
    
    if (existingRole.name === 'SUPER_ADMIN' || existingRole.name === 'ADMIN') {
      baselinePermissions = await prisma.permission.findMany();
    } else {
      // Very basic baseline recovery. Ideally we share the constant from seed_auth.js
      return NextResponse.json({ error: 'Resetting this specific system role is not fully supported yet without the auth-seed catalog.' }, { status: 400 });
    }

    const updatedRole = await prisma.$transaction(async (tx: any) => {
      await tx.rolePermission.deleteMany({
        where: { roleId }
      });

      if (baselinePermissions.length > 0) {
        await tx.rolePermission.createMany({
          data: baselinePermissions.map((p: any) => ({
            roleId,
            permissionId: p.id
          }))
        });
      }

      await tx.auditLog.create({
        data: {
          organizationId,
          userId: session.user.id,
          userEmail: session.user.email,
          userRole: session.user.role,
          action: 'RESET_ROLE_BASELINE',
          resource: 'ROLE',
          resourceId: roleId,
          previousValue: { permissions: existingRole.permissions.map((rp: any) => rp.permission.name) },
          newValue: { permissions: baselinePermissions.map((p: any) => p.name) },
          requestId: req.headers.get('x-request-id') || 'manual',
          ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
          userAgent: req.headers.get('user-agent') || 'unknown',
        }
      });

      return tx.role.findUnique({
        where: { id: roleId },
        include: { permissions: { include: { permission: true } } }
      });
    });

    return NextResponse.json({ data: updatedRole });
  } catch (error: any) {
    console.error('[roles] RESET Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
