import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import prisma from '@hotel-pms/db';
import { PortalShell } from '@/components/portal-shell';
import { TeamManager } from './TeamManager';

export default async function TeamPage() {
  const session = await auth();
  const user = session?.user as { organizationId?: string; name?: string | null; email?: string | null } | undefined;
  if (!user?.organizationId) redirect('/portal/login');
  const properties = await prisma.property.findMany({ where: { organizationId: user.organizationId, isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } });
  return <PortalShell userName={user.name ?? user.email ?? undefined}><div className="portal-page-header"><div><div className="portal-page-kicker">Customer workspace</div><h1 className="portal-page-title">Team access</h1><p className="portal-page-sub" style={{ marginBottom: 0 }}>Manage PMS management access for your organization.</p></div></div>{properties.length ? <TeamManager properties={properties} /> : <div className="portal-empty"><div className="portal-empty-title">Add a property first</div><div className="portal-empty-body">A General Manager must be assigned to at least one active property.</div></div>}</PortalShell>;
}
