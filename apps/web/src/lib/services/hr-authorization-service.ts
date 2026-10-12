import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';

export type HrPermission =
  | 'hr.employee.view'
  | 'hr.employee.manage'
  | 'hr.employee.sensitive.view'
  | 'hr.payroll.prepare'
  | 'hr.payroll.approve'
  | 'hr.payroll.release'
  | 'hr.leave.manage'
  | 'hr.attendance.manage'
  | 'hr.settings.manage'
  | 'hr.service-desk.manage'
  | 'hr.policy.manage'
  | 'hr.recruitment.manage'
  | 'hr.payroll.reverse'
  | 'hr.remittance.manage';

export interface HrAuthContext {
  userId: string;
  email?: string | null;
  organizationId: string;
  propertyId: string;
  role: string;
  department?: string | null;
  isSuperAdmin: boolean;
  accessiblePropertyIds: string[];
  permissions: Set<string>;
  canViewSensitive: boolean;
}

export class HrAuthorizationService {
  /** Build a tenant/property/department-safe Staff where clause. */
  public static staffScope(context: HrAuthContext, extra: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      ...extra,
      organizationId: context.organizationId,
      ...(context.propertyId ? { propertyAccess: { has: context.propertyId } } : {}),
      ...(context.role === 'DEPARTMENT_HEAD' && context.department
        ? { department: context.department }
        : {}),
    };
  }
  /**
   * Resolves caller session and enforces multi-tenant identity and role capabilities.
   * Throws Error if unauthorized or tenant boundaries are violated.
   */
  public static async resolveAuthContext(req?: NextRequest): Promise<HrAuthContext> {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error('Unauthorized: Authentication session required');
    }

    const userId = session.user.id;
    const sessionEmail = session.user.email || null;
    const sessionRole = String((session.user as any).role || 'STAFF').toUpperCase();

    // 1. Resolve Organization Membership strictly requiring ACTIVE status
    const membership = await prisma.organizationMembership.findUnique({
      where: { userId },
    });

    if (!membership || membership.status !== 'ACTIVE') {
      throw new Error('Forbidden: User does not have an active organization membership');
    }

    const organizationId = membership.organizationId;
    if (!organizationId) {
      throw new Error('Forbidden: User is not linked to an active organization');
    }

    const activeRole = membership.role || sessionRole;
    // HOD is the legacy role name for a department head. Normalize it once so
    // every downstream department-boundary check applies consistently.
    const effectiveRole = activeRole === 'HOD' ? 'DEPARTMENT_HEAD' : activeRole;
    const isSuperAdmin = ['SUPER_ADMIN', 'OWNER'].includes(activeRole);
    const isGlobalAdmin = ['ADMIN', 'SUPER_ADMIN', 'OWNER', 'GENERAL_MANAGER'].includes(activeRole);

    // 2. Resolve accessible properties & staff profile
    let accessiblePropertyIds: string[] = [];
    let staffDepartment: string | null = null;

    if (isGlobalAdmin) {
      const orgProps = await prisma.property.findMany({
        where: { organizationId, isActive: true },
        select: { id: true },
      });
      accessiblePropertyIds = orgProps.map((p) => p.id);
    }

    // Always fetch staff record to get department and staff-specific property assignments
    const staff = await prisma.staff.findFirst({
      where: { userId, organizationId, isActive: true, deletedAt: null },
      select: { propertyAccess: true, department: true },
    });

    if (staff) {
      staffDepartment = staff.department;
      if (!isGlobalAdmin) {
        accessiblePropertyIds = staff.propertyAccess || [];
      }
    }

    // 3. Resolve and strictly validate requested Property ID
    const requestedPropertyHeader = req?.headers.get('x-property-id');
    const urlPropertyParam = req ? new URL(req.url).searchParams.get('propertyId') : null;
    const sessionPropertyId = (session.user as any).propertyId;

    const requestedProperty = requestedPropertyHeader || urlPropertyParam;
    let targetPropertyId: string;

    if (requestedProperty) {
      // Security Check: Caller explicitly specified a property. It MUST be in accessiblePropertyIds.
      if (!accessiblePropertyIds.includes(requestedProperty)) {
        throw new Error(
          `Forbidden: Access denied. Property [${requestedProperty}] is not within user's authorized properties.`
        );
      }
      targetPropertyId = requestedProperty;
    } else {
      // Fallback to session property if valid, or first accessible property
      if (sessionPropertyId && accessiblePropertyIds.includes(sessionPropertyId)) {
        targetPropertyId = sessionPropertyId;
      } else if (accessiblePropertyIds.length > 0) {
        targetPropertyId = accessiblePropertyIds[0];
      } else {
        targetPropertyId = '';
      }
    }

    if (!targetPropertyId && !isSuperAdmin) {
      throw new Error('Forbidden: No accessible properties found for user in this organization');
    }

    // 4. Compile Effective Permissions Set
    const permissions = new Set<string>();
    if (membership.permissions) {
      for (const p of membership.permissions) permissions.add(p);
    }

    // Grant default role capabilities
    if (['SUPER_ADMIN', 'OWNER', 'ADMIN', 'HR_MANAGER'].includes(effectiveRole)) {
      permissions.add('hr.employee.view');
      permissions.add('hr.employee.manage');
      permissions.add('hr.employee.sensitive.view');
      permissions.add('hr.payroll.prepare');
      permissions.add('hr.leave.manage');
      permissions.add('hr.attendance.manage');
      permissions.add('hr.settings.manage');
      permissions.add('hr.service-desk.manage');
      permissions.add('hr.policy.manage');
      permissions.add('hr.recruitment.manage');
      permissions.add('hr.payroll.reverse');
      permissions.add('hr.remittance.manage');
    }

    if (['SUPER_ADMIN', 'OWNER', 'ADMIN', 'PAYROLL_APPROVER', 'GENERAL_MANAGER', 'FINANCIAL_CONTROLLER'].includes(effectiveRole)) {
      permissions.add('hr.payroll.approve');
      permissions.add('hr.payroll.release');
      permissions.add('hr.payroll.reverse');
      permissions.add('hr.remittance.manage');
    }

    if (['PAYROLL_OFFICER'].includes(effectiveRole)) {
      permissions.add('hr.employee.view');
      permissions.add('hr.payroll.prepare');
    }

    if (['HR_OFFICER'].includes(effectiveRole)) {
      permissions.add('hr.employee.view');
      permissions.add('hr.employee.manage');
      permissions.add('hr.leave.manage');
      permissions.add('hr.attendance.manage');
      permissions.add('hr.service-desk.manage');
      permissions.add('hr.policy.manage');
      permissions.add('hr.recruitment.manage');
    }

    if (['DEPARTMENT_HEAD'].includes(effectiveRole)) {
      permissions.add('hr.leave.manage');
      permissions.add('hr.attendance.manage');
    }

    const canViewSensitive =
      permissions.has('hr.employee.sensitive.view') ||
      ['SUPER_ADMIN', 'OWNER', 'ADMIN', 'HR_MANAGER'].includes(effectiveRole);

    return {
      userId,
      email: sessionEmail,
      organizationId,
      propertyId: targetPropertyId,
      role: effectiveRole,
      department: staffDepartment,
      isSuperAdmin,
      accessiblePropertyIds,
      permissions,
      canViewSensitive,
    };
  }

  /**
   * Checks whether the given auth context has the requested permission.
   */
  public static can(context: HrAuthContext | any, permission: HrPermission | string): boolean {
    if (!context) return false;
    if (context.isSuperAdmin) return true;

    if (context.permissions instanceof Set) {
      return context.permissions.has(permission) || context.permissions.has('*');
    }
    if (Array.isArray(context.permissions)) {
      return context.permissions.includes(permission) || context.permissions.includes('*');
    }

    return false;
  }

  /**
   * Asserts specific permission on the resolved context.
   * Throws Error with message starting with "Forbidden: Missing required permission" if not authorized.
   */
  public static assertPermission(context: HrAuthContext | any, permission: HrPermission | string): void {
    if (!this.can(context, permission)) {
      throw new Error(`Forbidden: Missing required permission [${permission}]`);
    }
  }
}
