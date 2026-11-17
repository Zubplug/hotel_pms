import { NextRequest, NextResponse } from 'next/server';
import { uploadObject } from '@hotel-pms/storage';
import { HrAuthorizationService } from '@/lib/services/hr-authorization-service';

export async function POST(req: NextRequest) {
  try {
    const context = await HrAuthorizationService.resolveAuthContext(req);
    HrAuthorizationService.assertPermission(context, 'hr.employee.manage');
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'A document file is required' }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'Documents must be 10 MB or smaller' }, { status: 400 });
    if (!['application/pdf', 'image/png', 'image/jpeg'].includes(file.type)) return NextResponse.json({ error: 'Only PDF, PNG, and JPG files are supported' }, { status: 400 });
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uploaded = await uploadObject({ key: `hr-documents/${context.organizationId}/${crypto.randomUUID()}-${safeName}`, body: Buffer.from(await file.arrayBuffer()), contentType: file.type, visibility: 'private' });
    return NextResponse.json({ url: uploaded.url });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to upload document' }, { status: error.message?.includes('Forbidden') ? 403 : 500 });
  }
}
