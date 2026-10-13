import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { HrAuthorizationService } from '@/lib/services/hr-authorization-service';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await HrAuthorizationService.resolveAuthContext(req);
    const { id } = await params;
    const document = await prisma.employeeDocument.findFirst({ where: { id, isConfidential: false, staff: { userId: context.userId, organizationId: context.organizationId, isActive: true } }, select: { fileUrl: true } });
    if (!document) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    return NextResponse.redirect(new URL(document.fileUrl, req.url));
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unable to access document' }, { status: error.message?.includes('Unauthorized') ? 401 : 500 });
  }
}
