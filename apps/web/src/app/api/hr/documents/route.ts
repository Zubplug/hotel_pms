import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { HrAuthorizationService } from '@/lib/services/hr-authorization-service';

export async function GET(req: NextRequest) {
  try {
    const authContext = await HrAuthorizationService.resolveAuthContext(req);
    const canViewAllDocuments = HrAuthorizationService.can(authContext, 'hr.employee.view');

    const organizationId = authContext.organizationId;
    const propertyId = authContext.propertyId;

    const staffWhere: any = {};
    if (organizationId) staffWhere.organizationId = organizationId;
    if (propertyId) staffWhere.propertyAccess = { has: propertyId };
    if (authContext.role === 'DEPARTMENT_HEAD' && authContext.department) staffWhere.department = authContext.department;
    if (!canViewAllDocuments) staffWhere.userId = authContext.userId;

    const documents = await prisma.employeeDocument.findMany({
      where: {
        staff: staffWhere,
        ...(authContext.canViewSensitive ? {} : { isConfidential: false }),
      },
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            department: true,
            position: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const formatted = documents.map((doc) => ({
      id: doc.id,
      title: doc.title,
      type: doc.category,
      employee: `${doc.staff.firstName || ''} ${doc.staff.lastName || ''}`.trim(),
      department: doc.staff.department || 'General',
      date: doc.createdAt.toISOString().split('T')[0],
      fileUrl: doc.fileUrl,
      verified: !doc.isConfidential,
    }));

    return NextResponse.json({ documents: formatted });
  } catch (error: any) {
    if (error.message?.includes('Forbidden') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: error.message.includes('Forbidden') ? 403 : 401 });
    }
    console.error('Failed to list HR documents:', error);
    return NextResponse.json({ error: 'Failed to retrieve documents' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authContext = await HrAuthorizationService.resolveAuthContext(req);
    HrAuthorizationService.assertPermission(authContext, 'hr.employee.manage');

    const organizationId = authContext.organizationId;
    const propertyId = authContext.propertyId;
    const body = await req.json();
    const { staffId, title, type = 'CONTRACT', fileUrl } = body;

    if (!staffId || !title || !fileUrl || typeof fileUrl !== 'string' || fileUrl.includes('sample-')) {
      return NextResponse.json({ error: 'Staff ID, document title, and a real uploaded file URL are required' }, { status: 400 });
    }

    // Verify staff belongs to tenant
    const staff = await prisma.staff.findFirst({
      where: {
        id: staffId,
        ...(organizationId ? { organizationId } : {}),
        ...(propertyId ? { propertyAccess: { has: propertyId } } : {}),
        ...(authContext.role === 'DEPARTMENT_HEAD' && authContext.department ? { department: authContext.department } : {}),
      },
    });

    if (!staff) {
      return NextResponse.json({ error: 'Staff member not found or inaccessible' }, { status: 404 });
    }

    const document = await prisma.employeeDocument.create({
      data: {
        staffId,
        title: title.trim(),
        category: type,
        fileUrl,
        uploadedBy: authContext.userId,
      },
    });

    return NextResponse.json({ success: true, document }, { status: 201 });
  } catch (error: any) {
    if (error.message?.includes('Forbidden') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: error.message.includes('Forbidden') ? 403 : 401 });
    }
    console.error('Failed to upload HR document:', error);
    return NextResponse.json({ error: 'Failed to upload document' }, { status: 500 });
  }
}
