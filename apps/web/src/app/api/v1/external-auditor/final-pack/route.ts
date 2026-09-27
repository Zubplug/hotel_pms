import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { getExternalAuditorScope, isExternalAuditor } from '@/lib/auth/auditor-utils';

const admins = new Set(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'GENERAL_MANAGER', 'DIRECTOR', 'CEO']);

const crc32 = (input: Uint8Array) => { let crc = 0xffffffff; for (const byte of input) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ 0xffffffff) >>> 0; };
const u16 = (value: number) => Uint8Array.from([value & 255, (value >>> 8) & 255]);
const u32 = (value: number) => Uint8Array.from([value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255]);
const join = (parts: Uint8Array[]) => { const output = new Uint8Array(parts.reduce((total, part) => total + part.length, 0)); let offset = 0; for (const part of parts) { output.set(part, offset); offset += part.length; } return output; };
const zipStore = (files: { name: string; body: string }[]) => { const local: Uint8Array[] = []; const central: Uint8Array[] = []; let offset = 0; for (const file of files) { const name = new TextEncoder().encode(file.name); const body = new TextEncoder().encode(file.body); const header = join([u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc32(body)), u32(body.length), u32(body.length), u16(name.length), u16(0), name]); local.push(join([header, body])); central.push(join([u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc32(body)), u32(body.length), u32(body.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name])); offset += header.length + body.length; } const centralBody = join(central); return join([...local, centralBody, join([u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(centralBody.length), u32(offset), u16(0)])]); };
const pdf = (text: string) => { const escaped = text.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)'); const objects = [`1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj`, `2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj`, `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj`, `4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj`, `5 0 obj << /Length ${escaped.length + 42} >> stream\nBT /F1 11 Tf 48 744 Td 14 TL (${escaped}) Tj ET\nendstream endobj`]; let body = '%PDF-1.4\n'; const offsets = [0]; for (const object of objects) { offsets.push(body.length); body += `${object}\n`; } const xref = body.length; body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`; return new TextEncoder().encode(body); };

export async function GET(request: NextRequest) {
  const session = await auth(); if (!session?.user?.id) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const id = request.nextUrl.searchParams.get('id'); const format = request.nextUrl.searchParams.get('format') || 'zip';
  if (!id || !['zip', 'pdf'].includes(format)) return NextResponse.json({ error: 'id and a supported format (zip or pdf) are required' }, { status: 400 });
  const pack = await prisma.auditFinalPack.findUnique({ where: { id } });
  if (!pack) return NextResponse.json({ error: 'Final pack not found' }, { status: 404 });
  if (isExternalAuditor(session)) { try { await getExternalAuditorScope(session.user.id, pack.propertyId); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); } }
  else if (!session.user.isSuperAdmin && !session.user.isLodgeCoreAdmin && !admins.has(String(session.user.role || '').toUpperCase())) return NextResponse.json({ error: 'Management access required' }, { status: 403 });
  const manifest = JSON.stringify({ ...pack.manifest as object, packageHash: pack.packageHash, status: pack.status, auditorSignedAt: pack.auditorSignedAt, managementSignedAt: pack.managementSignedAt, issuedAt: pack.issuedAt }, null, 2);
  const index = `LodgeCore External Audit Pack\nPackage hash: ${pack.packageHash}\nStatus: ${pack.status}\nGenerated: ${pack.createdAt.toISOString()}\nAuditor signed: ${pack.auditorSignedAt?.toISOString() || 'PENDING'}\nManagement signed: ${pack.managementSignedAt?.toISOString() || 'PENDING'}\n`;
  if (format === 'pdf') return new NextResponse(pdf(index), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="audit-pack-${pack.packageHash.slice(0, 12)}.pdf"`, 'Cache-Control': 'no-store' } });
  return new NextResponse(zipStore([{ name: 'README.txt', body: index }, { name: 'manifest.json', body: manifest }]), { headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="audit-pack-${pack.packageHash.slice(0, 12)}.zip"`, 'Cache-Control': 'no-store' } });
}

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
