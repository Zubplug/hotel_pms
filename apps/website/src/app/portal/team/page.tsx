import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import prisma from '@hotel-pms/db';
import { PortalShell } from '@/components/portal-shell';
import { TeamManager } from './TeamManager';

export default async function TeamPage() {
  const session = await auth();
  const user = session?.user as { organizationId?: string; name?: string | null; email?: string | null } | undefined;
  if (!user?.organizationId) redirect('/portal/login');
  const properties = await prisma.property.findMany({ where: { organizationId: user.organizationId }, select: { id: true, name: true, isActive: true }, orderBy: { name: 'asc' } });
  const managers = await prisma.staff.findMany({
    where: { organizationId: user.organizationId, position: { in: ['Property Administrator', 'General Manager'] }, isActive: true, deletedAt: null },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      propertyAccess: true,
      userId: true,
      createdAt: true,
      employeeInvitations: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true, expiresAt: true, acceptedAt: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  const users = await prisma.user.findMany({ where: { id: { in: managers.flatMap(manager => manager.userId ? [manager.userId] : []) } }, select: { id: true, middleName: true } });
  const middleNames = new Map(users.map(managerUser => [managerUser.id, managerUser.middleName]));
  const managerDetails = managers.map(manager => ({
    ...manager,
    createdAt: manager.createdAt.toISOString(),
    user: { middleName: manager.userId ? middleNames.get(manager.userId) ?? null : null },
    employeeInvitations: manager.employeeInvitations.map(invitation => ({ ...invitation, createdAt: invitation.createdAt.toISOString(), expiresAt: invitation.expiresAt.toISOString(), acceptedAt: invitation.acceptedAt?.toISOString() ?? null })),
  }));
  const activeProperties = properties.filter(property => property.isActive);
  return <PortalShell userName={user.name ?? user.email ?? undefined}><div className="portal-page-header"><div><div className="portal-page-kicker">Customer workspace</div><h1 className="portal-page-title">Team access</h1><p className="portal-page-sub" style={{ marginBottom: 0 }}>Manage property-scoped PMS administration for your organization.</p></div></div>{activeProperties.length ? <TeamManager properties={activeProperties} allProperties={properties} managers={managerDetails} /> : <div className="portal-empty"><div className="portal-empty-title">Add a property first</div><div className="portal-empty-body">A property administrator must be assigned to at least one active property.</div></div>}</PortalShell>;
}
