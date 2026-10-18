import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import prisma from '@hotel-pms/db';
import { HrAuthorizationService } from '@/lib/services/hr-authorization-service';
import { notifyEmployee } from '@/lib/employee-notification-service';

function errorResponse(error: any) {
  const message = String(error?.message || 'Request failed');
  return NextResponse.json({ error: message }, { status: message.includes('Unauthorized') ? 401 : message.includes('Forbidden') ? 403 : 500 });
}

export async function GET(req: NextRequest) {
  try {
    const context = await HrAuthorizationService.resolveAuthContext(req);
    const canManage = HrAuthorizationService.can(context, 'hr.service-desk.manage');
    if (new URL(req.url).searchParams.get('scope') === 'hr' && !canManage) {
      return NextResponse.json({ error: 'HR service desk access is restricted to HR staff' }, { status: 403 });
    }
    const where: any = {
      propertyId: context.propertyId,
      ...(canManage ? {} : { staff: { userId: context.userId, organizationId: context.organizationId } }),
      ...(context.role === 'DEPARTMENT_HEAD' && context.department && canManage
        ? { staff: { department: context.department, organizationId: context.organizationId } }
        : {}),
    };
    const tickets = await prisma.hrServiceDeskTicket.findMany({
      where,
      include: { staff: { select: { id: true, firstName: true, lastName: true, employeeId: true, department: true } }, messages: { where: canManage ? {} : { isInternal: false }, orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
      take: 250,
    });
    return NextResponse.json({ tickets, canManage });
  } catch (error) { return errorResponse(error); }
}

export async function POST(req: NextRequest) {
  try {
    const context = await HrAuthorizationService.resolveAuthContext(req);
    const body = await req.json();
    const canManage = HrAuthorizationService.can(context, 'hr.service-desk.manage');
    const staffId = body.staffId || (await prisma.staff.findFirst({ where: { userId: context.userId, organizationId: context.organizationId, isActive: true }, select: { id: true } }))?.id;
    if (body.action === 'REPLY') {
      if (!body.ticketId || !body.body?.trim()) return NextResponse.json({ error: 'Ticket ID and reply text are required' }, { status: 400 });
      const ticket = await prisma.hrServiceDeskTicket.findFirst({ where: { id: body.ticketId, propertyId: context.propertyId, ...(canManage ? {} : { staff: { userId: context.userId, organizationId: context.organizationId } }) } });
      if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
      const isInternal = canManage && Boolean(body.isInternal);
      const message = await prisma.hrServiceDeskMessage.create({ data: { ticketId: ticket.id, authorId: context.userId, body: String(body.body).trim(), isInternal } });
      if (!canManage && ticket.status === 'AWAITING_EMPLOYEE') await prisma.hrServiceDeskTicket.update({ where: { id: ticket.id }, data: { status: 'IN_PROGRESS' } });
      if (canManage && !isInternal) {
        await notifyEmployee({ organizationId: context.organizationId, propertyId: context.propertyId, staffId: ticket.staffId, subject: 'HR replied to your request', body: `HR replied to your request “${ticket.subject}”. Open your employee portal to review the response.`, category: 'APPROVALS', action: '/hr/self-service', idempotencyKey: `service-desk:${ticket.id}:reply:${message.id}` });
      }
      return NextResponse.json({ success: true, message }, { status: 201 });
    }
    if (!staffId || !body.category || !body.subject?.trim() || !body.description?.trim()) {
      return NextResponse.json({ error: 'Staff, category, subject, and description are required' }, { status: 400 });
    }
    const staff = await prisma.staff.findFirst({ where: { ...HrAuthorizationService.staffScope(context, { id: staffId }), isActive: true }, select: { id: true, userId: true } });
    if (!staff) return NextResponse.json({ error: 'Staff member not found or inaccessible' }, { status: 404 });
    if (!canManage && staff.userId !== context.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const ticket = await prisma.hrServiceDeskTicket.create({
      data: {
        propertyId: context.propertyId,
        staffId,
        ticketNumber: `HR-${randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase()}`,
        category: String(body.category), priority: String(body.priority || 'MEDIUM'),
        subject: String(body.subject).trim(), description: String(body.description).trim(),
      },
    });
    return NextResponse.json({ success: true, ticket }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(req: NextRequest) {
  try {
    const context = await HrAuthorizationService.resolveAuthContext(req);
    HrAuthorizationService.assertPermission(context, 'hr.service-desk.manage');
    const body = await req.json();
    if (!body.id || !['OPEN', 'IN_PROGRESS', 'AWAITING_EMPLOYEE', 'RESOLVED', 'CLOSED'].includes(body.status)) return NextResponse.json({ error: 'Ticket ID and valid status are required' }, { status: 400 });
    const existing = await prisma.hrServiceDeskTicket.findFirst({ where: { id: body.id, propertyId: context.propertyId, staff: { organizationId: context.organizationId, ...(context.role === 'DEPARTMENT_HEAD' && context.department ? { department: context.department } : {}) } } });
    if (!existing) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    const ticket = await prisma.hrServiceDeskTicket.update({ where: { id: existing.id }, data: { status: body.status, assignedToUser: body.assignedToUser || context.userId, resolutionNotes: body.resolutionNotes?.trim() || undefined, resolvedAt: ['RESOLVED', 'CLOSED'].includes(body.status) ? new Date() : null } });
    await notifyEmployee({ organizationId: context.organizationId, propertyId: context.propertyId, staffId: existing.staffId, subject: `HR request ${body.status.toLowerCase().replace('_', ' ')}`, body: `Your HR request “${existing.subject}” is now ${body.status.toLowerCase().replace('_', ' ')}.`, category: 'APPROVALS', action: '/hr/self-service', idempotencyKey: `service-desk:${existing.id}:${body.status}` });
    return NextResponse.json({ success: true, ticket });
  } catch (error) { return errorResponse(error); }
}
