import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { getExternalAuditorScope, isExternalAuditor } from '@/lib/auth/auditor-utils';

const admins = new Set(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'GENERAL_MANAGER', 'DIRECTOR', 'CEO']);

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const body = await request.json(); const id = String(body.id || ''); const signer = String(body.signer || '');
  const pack = await prisma.auditFinalPack.findUnique({ where: { id } });
  if (!pack) return NextResponse.json({ error: 'Final pack not found' }, { status: 404 });
  if (isExternalAuditor(session)) { try { await getExternalAuditorScope(session.user.id, pack.propertyId); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); } if (signer !== 'auditor') return NextResponse.json({ error: 'External auditors can only provide the auditor sign-off' }, { status: 403 }); }
  else if (!session.user.isSuperAdmin && !session.user.isLodgeCoreAdmin && !admins.has(String(session.user.role || '').toUpperCase())) return NextResponse.json({ error: 'Management sign-off required' }, { status: 403 });
  const value = signer === 'auditor' ? await prisma.auditFinalPack.update({ where: { id }, data: { auditorSignedAt: new Date(), status: pack.managementSignedAt ? 'ISSUED' : 'PENDING_SIGNOFF', issuedAt: pack.managementSignedAt ? new Date() : null } }) : await prisma.auditFinalPack.update({ where: { id }, data: { managementSignedAt: new Date(), status: pack.auditorSignedAt ? 'ISSUED' : 'PENDING_SIGNOFF', issuedAt: pack.auditorSignedAt ? new Date() : null } });
  return NextResponse.json({ pack: value });
}
