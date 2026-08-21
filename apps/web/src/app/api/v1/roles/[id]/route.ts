import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.user.capabilities?.includes('MANAGE_ROLES')) {
      return NextResponse.json({ error: 'Forbidden: Requires MANAGE_ROLES permission' }, { status: 403 });
    }

    const { organizationId } = session.user;
    const roleId = params.id;
    const body = await req.json();
    const { permissions, reason } = body;

    if (!permissions || !Array.isArray(permissions)) {
      return NextResponse.json({ error: 'permissions array is required' }, { status: 400 });
    }
    if (!reason) {
      return NextResponse.json({ error: 'Reason is required for auditing' }, { status: 400 });
    }

    const existingRole = await prisma.role.findUnique({
      where: { id: roleId },
      include: { permissions: { include: { permission: true } } }
    });

    if (!existingRole || existingRole.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    const updatedRole = await prisma.$transaction(async (tx: any) => {
      // 1. Fetch requested permissions
      const requestedPerms = await tx.permission.findMany({
        where: { id: { in: permissions } }
      });
      
      const requestedPermNames = requestedPerms.map((p: any) => p.name);
      const oldPermNames = existingRole.permissions.map((rp: any) => rp.permission.name);

      // 2. Prevent self-lockout: If they are removing MANAGE_ROLES, verify someone else has it
      if (oldPermNames.includes('MANAGE_ROLES') && !requestedPermNames.includes('MANAGE_ROLES')) {
        // Look for other active users in this organization with a role that has MANAGE_ROLES
        const otherAdmins = await tx.staff.count({
          where: {
            isActive: true,
            deletedAt: null,
            user: {
              roles: {
                some: {
                  role: {
                    id: { not: roleId },
                    permissions: {
                      some: {
                        permission: { name: 'MANAGE_ROLES' }
                      }
                    }
                  }
                }
              }
            }
          }
        });

        if (otherAdmins === 0) {
          throw new Error('SELF_LOCKOUT: Cannot remove MANAGE_ROLES from this role as it would leave the organization without any administrators.');
        }
      }

      // 3. Atomically replace RolePermissions
      await tx.rolePermission.deleteMany({
        where: { roleId }
      });

      if (requestedPerms.length > 0) {
        await tx.rolePermission.createMany({
          data: requestedPerms.map((p: any) => ({
            roleId,
            permissionId: p.id
          }))
        });
      }

      // 4. Force immediate propagation by bumping sessionVersion for affected users
      await tx.staff.updateMany({
        where: {
          user: {
            roles: {
              some: { roleId }
            }
          }
        },
        data: {
          posTokenVersion: { increment: 1 }
        }
      });
      
      // Update sessionVersion on User model as well if applicable
      await tx.user.updateMany({
        where: {
          roles: {
            some: { roleId }
          }
        },
        data: {
          sessionVersion: { increment: 1 }
        }
      });

      // 5. Create Audit Log
      await tx.auditLog.create({
        data: {
          organizationId,
          userId: session.user.id,
          userEmail: session.user.email,
          userRole: session.user.role,
          action: 'UPDATE_ROLE_PERMISSIONS',
          resource: 'ROLE',
          resourceId: roleId,
          previousValue: { permissions: oldPermNames },
          newValue: { permissions: requestedPermNames, reason },
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
    console.error('[roles] PUT Error:', error);
    if (error.message?.includes('SELF_LOCKOUT')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.user.capabilities?.includes('MANAGE_ROLES')) {
      return NextResponse.json({ error: 'Forbidden: Requires MANAGE_ROLES permission' }, { status: 403 });
    }

    const { organizationId } = session.user;
    const roleId = params.id;

    const existingRole = await prisma.role.findUnique({
      where: { id: roleId }
    });

    if (!existingRole || existingRole.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    if (existingRole.isSystem) {
      return NextResponse.json({ error: 'Cannot delete a system role' }, { status: 400 });
    }

    await prisma.$transaction(async (tx: any) => {
      // Unassign users from this role
      await tx.userRole.deleteMany({
        where: { roleId }
      });

      // Delete role permissions
      await tx.rolePermission.deleteMany({
        where: { roleId }
      });

      // Delete role
      await tx.role.delete({
        where: { id: roleId }
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          organizationId,
          userId: session.user.id,
          userEmail: session.user.email,
          userRole: session.user.role,
          action: 'DELETE_ROLE',
          resource: 'ROLE',
          resourceId: roleId,
          previousValue: { name: existingRole.name },
          requestId: req.headers.get('x-request-id') || 'manual',
          ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
          userAgent: req.headers.get('user-agent') || 'unknown',
        }
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[roles] DELETE Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
