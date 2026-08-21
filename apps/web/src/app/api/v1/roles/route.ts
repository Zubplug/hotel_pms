import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { organizationId } = session.user;

    // Verify actor has MANAGE_ROLES or is just viewing
    // We allow viewing roles for people who have MANAGE_ROLES or MANAGER access
    if (!session.user.capabilities?.includes('MANAGE_ROLES') && !session.user.capabilities?.includes('ACCESS_MANAGEMENT')) {
       return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const roles = await prisma.role.findMany({
      where: { organizationId },
      include: {
        permissions: {
          include: {
            permission: true
          }
        }
      },
      orderBy: [
        { isSystem: 'desc' },
        { name: 'asc' }
      ]
    });

    return NextResponse.json({ data: roles });
  } catch (error: any) {
    console.error('[roles] GET Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Must have MANAGE_ROLES
    if (!session.user.capabilities?.includes('MANAGE_ROLES')) {
      return NextResponse.json({ error: 'Forbidden: Requires MANAGE_ROLES permission' }, { status: 403 });
    }

    const { organizationId } = session.user;
    const body = await req.json();
    const { name, description, permissions } = body;

    if (!name) {
      return NextResponse.json({ error: 'Role name is required' }, { status: 400 });
    }

    // Wrap in transaction
    const newRole = await prisma.$transaction(async (tx: any) => {
      const role = await tx.role.create({
        data: {
          organizationId,
          name,
          description,
          isSystem: false, // Custom roles are never system
        }
      });

      if (permissions && Array.isArray(permissions)) {
        // Validate all permissions exist
        const validPerms = await tx.permission.findMany({
          where: { id: { in: permissions } }
        });
        
        if (validPerms.length > 0) {
          await tx.rolePermission.createMany({
            data: validPerms.map((p: any) => ({
              roleId: role.id,
              permissionId: p.id
            }))
          });
        }
      }

      // Create Audit Log
      await tx.auditLog.create({
        data: {
          organizationId,
          userId: session.user.id,
          userEmail: session.user.email,
          userRole: session.user.role,
          action: 'CREATE_ROLE',
          resource: 'ROLE',
          resourceId: role.id,
          newValue: { name, description, permissions },
          requestId: req.headers.get('x-request-id') || 'manual',
          ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
          userAgent: req.headers.get('user-agent') || 'unknown',
        }
      });

      return role;
    });

    return NextResponse.json({ data: newRole });
  } catch (error: any) {
    console.error('[roles] POST Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
