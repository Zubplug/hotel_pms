import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { HrAuthorizationService } from '@/lib/services/hr-authorization-service';
import { notifyEmployee } from '@/lib/employee-notification-service';
import { applyCompensationChange } from '@/lib/services/compensation-change-service';

const STATUSES = ['DRAFT', 'SUBMITTED', 'DEPARTMENT_REVIEW', 'HR_REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'SCHEDULED', 'APPLIED', 'REJECTED', 'CANCELLED'];
const EXECUTIVE_ROLES = new Set(['GENERAL_MANAGER', 'SUPER_ADMIN', 'OWNER', 'ADMIN', 'CEO', 'FINANCIAL_CONTROLLER', 'PAYROLL_APPROVER']);

function errorResponse(error: any) {
  const message = String(error?.message || 'Compensation request failed');
  return NextResponse.json({ error: message }, { status: message.includes('Unauthorized') ? 401 : message.includes('Forbidden') ? 403 : 500 });
}

function dateOnly(value: unknown) {
  const text = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error('A valid effective date is required');
  const date = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error('A valid effective date is required');
  return date;
}

function money(value: unknown, field: string, allowZero = true) {
  const number = Number(value);
  if (!Number.isFinite(number) || (!allowZero && number <= 0) || number < 0) throw new Error(`${field} must be a valid non-negative amount`);
  return number;
}

async function buildCompensationChecks(context: any, staff: any, effectiveDate: Date, proposed: { basic: number; housing: number; transport: number; other: number }) {
  const position = await prisma.jobPosition.findFirst({ where: { propertyId: context.propertyId, title: staff.position, isActive: true }, select: { title: true, grade: true, minSalary: true, maxSalary: true } });
  if (position?.minSalary && proposed.basic < Number(position.minSalary)) throw new Error(`Proposed basic salary is below the approved ${position.title} salary range`);
  if (position?.maxSalary && proposed.basic > Number(position.maxSalary)) throw new Error(`Proposed basic salary is above the approved ${position.title} salary range`);
  const statutory = await prisma.statutoryConfiguration.findFirst({ where: { organizationId: context.organizationId, effectiveFrom: { lte: effectiveDate }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveDate } }] }, orderBy: { effectiveFrom: 'desc' }, select: { pensionEmployeeRate: true, pensionEmployerRate: true, nhfRate: true, nsitfRate: true, itfRate: true } });
  const currentGross = Number(staff.salaryStructure.basicSalary) + Number(staff.salaryStructure.housingAllowance || 0) + Number(staff.salaryStructure.transportAllowance || 0) + Number(staff.salaryStructure.otherAllowances || 0);
  const proposedGross = proposed.basic + proposed.housing + proposed.transport + proposed.other;
  const employeePensionRate = Number(statutory?.pensionEmployeeRate ?? 0.08);
  const employerPensionRate = Number(statutory?.pensionEmployerRate ?? 0.10);
  const nhfRate = Number(statutory?.nhfRate ?? 0.025);
  const nsitfRate = Number(statutory?.nsitfRate ?? 0.01);
  const itfRate = Number(statutory?.itfRate ?? 0.01);
  const month = effectiveDate.getUTCMonth();
  const monthKey = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'][month];
  const payrollBudget = await prisma.budget.findFirst({ where: { propertyId: context.propertyId, status: 'APPROVED', periodStart: { lte: effectiveDate }, periodEnd: { gte: effectiveDate }, lines: { some: { category: 'PAYROLL', OR: [{ department: staff.department }, { department: null }] } } }, include: { lines: { where: { category: 'PAYROLL', OR: [{ department: staff.department }, { department: null }] } } } });
  let budgetWarning: string | null = null;
  if (!payrollBudget) budgetWarning = 'No approved payroll budget covers the effective date; executive approval should confirm funding.';
  else {
    const departmentalStaff = await prisma.staff.findMany({ where: { organizationId: context.organizationId, propertyAccess: { has: context.propertyId }, department: staff.department, isActive: true, deletedAt: null }, include: { salaryStructure: { select: { basicSalary: true, housingAllowance: true, transportAllowance: true, otherAllowances: true } } } });
    const currentDepartmentMonthly = departmentalStaff.reduce((sum, item) => sum + Number(item.salaryStructure?.basicSalary || 0) + Number(item.salaryStructure?.housingAllowance || 0) + Number(item.salaryStructure?.transportAllowance || 0) + Number(item.salaryStructure?.otherAllowances || 0), 0);
    const budgetAmount = payrollBudget.lines.reduce((sum, line: any) => sum + Number(line[monthKey] || 0), 0);
    if (budgetAmount > 0 && currentDepartmentMonthly - currentGross + proposedGross > budgetAmount) throw new Error(`The proposed compensation exceeds the approved ${staff.department} payroll budget for the effective month`);
  }
  return { salaryRange: position ? { grade: position.grade, min: position.minSalary, max: position.maxSalary } : null, budgetWarning, currentMonthlyGross: currentGross, proposedMonthlyGross: proposedGross, monthlyGrossIncrease: proposedGross - currentGross, employeePensionIncrease: (proposed.basic + proposed.housing + proposed.transport - (Number(staff.salaryStructure.basicSalary) + Number(staff.salaryStructure.housingAllowance || 0) + Number(staff.salaryStructure.transportAllowance || 0))) * employeePensionRate, employerPensionIncrease: (proposed.basic + proposed.housing + proposed.transport - (Number(staff.salaryStructure.basicSalary) + Number(staff.salaryStructure.housingAllowance || 0) + Number(staff.salaryStructure.transportAllowance || 0))) * employerPensionRate, nhfIncrease: (proposed.basic - Number(staff.salaryStructure.basicSalary)) * nhfRate, employerStatutoryIncrease: (proposedGross - currentGross) * (nsitfRate + itfRate), statutoryRates: { employeePensionRate, employerPensionRate, nhfRate, nsitfRate, itfRate } };
}

export async function GET(req: NextRequest) {
  try {
    const context = await HrAuthorizationService.resolveAuthContext(req);
    if (!HrAuthorizationService.can(context, 'hr.employee.view') && context.role !== 'DEPARTMENT_HEAD') throw new Error('Forbidden: Compensation access requires HR permission');
    const where: any = { organizationId: context.organizationId, propertyId: context.propertyId, staff: HrAuthorizationService.staffScope(context), ...(req.nextUrl.searchParams.get('id') ? { id: req.nextUrl.searchParams.get('id')! } : {}) };
    const requests = await prisma.compensationChangeRequest.findMany({ where, include: { staff: { select: { id: true, firstName: true, lastName: true, employeeId: true, department: true, position: true } }, requestedBy: { select: { email: true } }, approvedBy: { select: { email: true } } }, orderBy: { createdAt: 'desc' }, take: 250 });
    return NextResponse.json({ requests, canManage: HrAuthorizationService.can(context, 'hr.employee.manage'), canApprove: HrAuthorizationService.can(context, 'hr.payroll.approve') && EXECUTIVE_ROLES.has(context.role) });
  } catch (error) { return errorResponse(error); }
}

export async function POST(req: NextRequest) {
  try {
    const context = await HrAuthorizationService.resolveAuthContext(req);
    const canManage = HrAuthorizationService.can(context, 'hr.employee.manage');
    const canDepartmentRequest = context.role === 'DEPARTMENT_HEAD';
    if (!canManage && !canDepartmentRequest) return NextResponse.json({ error: 'Only HR or a department head can propose compensation changes' }, { status: 403 });
    const body = await req.json();
    const staff = await prisma.staff.findFirst({ where: { ...HrAuthorizationService.staffScope(context, { id: String(body.staffId || '') }), isActive: true, deletedAt: null }, include: { salaryStructure: true } });
    if (!staff?.salaryStructure) return NextResponse.json({ error: 'Active employee with a salary structure is required' }, { status: 400 });
    if (canDepartmentRequest && staff.department !== context.department) return NextResponse.json({ error: 'Department heads may only propose changes for their department' }, { status: 403 });
    const effectiveDate = dateOnly(body.effectiveDate);
    const proposedBasicSalary = money(body.proposedBasicSalary, 'Proposed basic salary', false);
    const probationReviewDate = body.probationReviewDate ? dateOnly(body.probationReviewDate) : null;
    if (probationReviewDate && probationReviewDate <= effectiveDate) return NextResponse.json({ error: 'Review date must be after the effective date' }, { status: 400 });
    const proposedHousingAllowance = money(body.proposedHousingAllowance ?? staff.salaryStructure.housingAllowance, 'Proposed housing allowance');
    const proposedTransportAllowance = money(body.proposedTransportAllowance ?? staff.salaryStructure.transportAllowance, 'Proposed transport allowance');
    const proposedOtherAllowances = money(body.proposedOtherAllowances ?? staff.salaryStructure.otherAllowances, 'Proposed other allowances');
    const payrollImpact = await buildCompensationChecks(context, staff, effectiveDate, { basic: proposedBasicSalary, housing: proposedHousingAllowance, transport: proposedTransportAllowance, other: proposedOtherAllowances });
    const currentTotal = Number(staff.salaryStructure.basicSalary) + Number(staff.salaryStructure.housingAllowance || 0) + Number(staff.salaryStructure.transportAllowance || 0) + Number(staff.salaryStructure.otherAllowances || 0);
    const increasePercentage = currentTotal > 0 ? ((payrollImpact.proposedMonthlyGross - currentTotal) / currentTotal) * 100 : null;
    const reason = String(body.reason || '').trim();
    if (reason.length < 5) return NextResponse.json({ error: 'A business reason of at least 5 characters is required' }, { status: 400 });
    const request = await prisma.compensationChangeRequest.create({ data: { organizationId: context.organizationId, propertyId: context.propertyId, staffId: staff.id, currentBasicSalary: staff.salaryStructure.basicSalary, currentHousingAllowance: staff.salaryStructure.housingAllowance, currentTransportAllowance: staff.salaryStructure.transportAllowance, currentOtherAllowances: staff.salaryStructure.otherAllowances, proposedBasicSalary, proposedHousingAllowance, proposedTransportAllowance, proposedOtherAllowances, currency: staff.salaryStructure.currency, effectiveDate, increasePercentage, probationReviewDate, reason, supportingDocumentUrl: body.supportingDocumentUrl ? String(body.supportingDocumentUrl).trim() : null, payrollImpact, status: canDepartmentRequest ? 'DEPARTMENT_REVIEW' : 'HR_REVIEW', requestedById: context.userId }, include: { staff: { select: { firstName: true, lastName: true } } } });
    return NextResponse.json({ success: true, request }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(req: NextRequest) {
  try {
    const context = await HrAuthorizationService.resolveAuthContext(req);
    const body = await req.json();
    const request = await prisma.compensationChangeRequest.findFirst({ where: { id: body.id, organizationId: context.organizationId, propertyId: context.propertyId, staff: HrAuthorizationService.staffScope(context) } });
    if (!request) return NextResponse.json({ error: 'Compensation request not found' }, { status: 404 });
    if (body.action === 'APPLY') { HrAuthorizationService.assertPermission(context, 'hr.payroll.prepare'); return NextResponse.json({ success: true, request: await applyCompensationChange(request.id, context) }); }
    if (body.action === 'DEPARTMENT_APPROVE') {
      if (context.role !== 'DEPARTMENT_HEAD' || request.status !== 'DEPARTMENT_REVIEW') return NextResponse.json({ error: 'Department review is not available for this request' }, { status: 403 });
      const staff = await prisma.staff.findUnique({ where: { id: request.staffId }, select: { department: true } });
      if (staff?.department !== context.department || request.requestedById === context.userId) return NextResponse.json({ error: 'You cannot approve this request' }, { status: 403 });
      const updated = await prisma.compensationChangeRequest.update({ where: { id: request.id }, data: { status: 'HR_REVIEW', departmentReviewedById: context.userId, departmentReviewedAt: new Date(), departmentReviewNotes: String(body.notes || '').trim() || null } });
      return NextResponse.json({ success: true, request: updated });
    }
    if (body.action === 'HR_APPROVE') {
      HrAuthorizationService.assertPermission(context, 'hr.employee.manage');
      if (!['SUBMITTED', 'HR_REVIEW'].includes(request.status) || request.requestedById === context.userId) return NextResponse.json({ error: 'This request is not ready for HR review or cannot be self-approved' }, { status: 403 });
      const updated = await prisma.compensationChangeRequest.update({ where: { id: request.id }, data: { status: 'PENDING_APPROVAL', hrReviewedById: context.userId, hrReviewedAt: new Date(), hrReviewNotes: String(body.notes || '').trim() || null } });
      return NextResponse.json({ success: true, request: updated });
    }
    if (body.action === 'EXECUTIVE_APPROVE') {
      HrAuthorizationService.assertPermission(context, 'hr.payroll.approve');
      if (!EXECUTIVE_ROLES.has(context.role) || request.status !== 'PENDING_APPROVAL' || request.requestedById === context.userId) return NextResponse.json({ error: 'Only an independent authorized executive can approve this request' }, { status: 403 });
      const today = new Date(); today.setUTCHours(0, 0, 0, 0);
      const updated = await prisma.compensationChangeRequest.update({ where: { id: request.id }, data: { status: request.effectiveDate > today ? 'SCHEDULED' : 'APPROVED', approvedById: context.userId, approvedAt: new Date(), approvalNotes: String(body.notes || '').trim() || null } });
      await notifyEmployee({ organizationId: context.organizationId, propertyId: context.propertyId, staffId: request.staffId, subject: 'Compensation change approved', body: `Your compensation change request was approved and is effective from ${request.effectiveDate.toISOString().slice(0, 10)}.`, category: 'PAYROLL', action: '/hr/self-service/compensation', idempotencyKey: `compensation:${request.id}:approved` });
      return NextResponse.json({ success: true, request: updated });
    }
    if (body.action === 'REJECT') {
      const canReview = HrAuthorizationService.can(context, 'hr.employee.manage') || context.role === 'DEPARTMENT_HEAD' || HrAuthorizationService.can(context, 'hr.payroll.approve');
      if (!canReview || request.requestedById === context.userId) return NextResponse.json({ error: 'You cannot reject this request' }, { status: 403 });
      const reason = String(body.reason || '').trim();
      if (reason.length < 5) return NextResponse.json({ error: 'A rejection reason of at least 5 characters is required' }, { status: 400 });
      const updated = await prisma.compensationChangeRequest.update({ where: { id: request.id }, data: { status: 'REJECTED', rejectionReason: reason } });
      await notifyEmployee({ organizationId: context.organizationId, propertyId: context.propertyId, staffId: request.staffId, subject: 'Compensation change declined', body: `Your compensation change request was not approved. Note: ${reason}`, category: 'PAYROLL', action: '/hr/self-service/compensation', idempotencyKey: `compensation:${request.id}:rejected` });
      return NextResponse.json({ success: true, request: updated });
    }
    return NextResponse.json({ error: 'Unsupported compensation action' }, { status: 400 });
  } catch (error) { return errorResponse(error); }
}
