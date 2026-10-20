import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import prisma, { getEffectiveLimit } from '@hotel-pms/db';
import { PortalShell } from '@/components/portal-shell';
import { PropertyManager } from './PropertyManager';

export default async function PropertiesPage() {
  const session = await auth();
  const user = session?.user as { organizationId?: string; name?: string | null; email?: string | null } | undefined;
  if (!user?.organizationId) redirect('/portal/login');
  const [properties, limit] = await Promise.all([
    prisma.property.findMany({ where: { organizationId: user.organizationId }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true, code: true, address: true, city: true, state: true, country: true, phone: true, email: true, website: true, isActive: true, createdAt: true } }),
    getEffectiveLimit(prisma, { organizationId: user.organizationId, limit: 'maxProperties' }),
  ]);
  return <PortalShell orgName={undefined} userName={user.name ?? user.email ?? undefined}><PropertyManager initialProperties={properties.map(property => ({ ...property, createdAt: property.createdAt.toISOString() }))} limit={limit} /></PortalShell>;
}
