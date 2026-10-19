import prisma from '@hotel-pms/db';
import { notifyEmployee } from '@/lib/employee-notification-service';
import type { HrAuthContext } from './hr-authorization-service';

const ACTIVE_PAYROLL_STATUSES = ['PROCESSING', 'PENDING_APPROVAL', 'APPROVED', 'PAID'];

export async function applyCompensationChange(id: string, context: HrAuthContext) {
  const result = await prisma.$transaction(async (tx) => {
    const request = await tx.compensationChangeRequest.findFirst({ where: { id, organizationId: context.organizationId, propertyId: context.propertyId, status: { in: ['APPROVED', 'SCHEDULED'] } }, include: { staff: { include: { salaryStructure: true } } } });
    if (!request) throw new Error('Only approved or scheduled compensation changes can be applied');
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    if (request.effectiveDate > today) throw new Error('This compensation change is not effective yet');
    const lockedPeriod = await tx.payrollPeriod.findFirst({ where: { propertyId: request.propertyId, startDate: { lte: request.effectiveDate }, endDate: { gte: request.effectiveDate }, status: { in: ACTIVE_PAYROLL_STATUSES as any } }, orderBy: { endDate: 'desc' }, select: { name: true, status: true, endDate: true } });
    if (lockedPeriod) {
      const nextEffectiveDate = new Date(lockedPeriod.endDate); nextEffectiveDate.setUTCDate(nextEffectiveDate.getUTCDate() + 1);
      await tx.compensationChangeRequest.update({ where: { id: request.id }, data: { effectiveDate: nextEffectiveDate, status: 'SCHEDULED', rejectionReason: `Moved to ${nextEffectiveDate.toISOString().slice(0, 10)} because payroll period ${lockedPeriod.name} is already ${lockedPeriod.status}.` } });
      return null;
    }
    const current = request.staff.salaryStructure;
    if (!current) throw new Error('Employee has no current salary structure');
    if (Number(current.basicSalary) !== Number(request.currentBasicSalary) || Number(current.housingAllowance) !== Number(request.currentHousingAllowance) || Number(current.transportAllowance) !== Number(request.currentTransportAllowance) || Number(current.otherAllowances) !== Number(request.currentOtherAllowances)) throw new Error('The employee compensation changed after this request was submitted. Create a new request for the latest values.');
    const previousEffectiveTo = new Date(request.effectiveDate); previousEffectiveTo.setUTCDate(previousEffectiveTo.getUTCDate() - 1);
    await tx.salaryStructureVersion.updateMany({ where: { staffId: request.staffId, effectiveTo: null, effectiveFrom: { lt: request.effectiveDate } }, data: { effectiveTo: previousEffectiveTo } });
    await tx.salaryStructureVersion.create({ data: { organizationId: request.organizationId, propertyId: request.propertyId, staffId: request.staffId, basicSalary: request.proposedBasicSalary, housingAllowance: request.proposedHousingAllowance, transportAllowance: request.proposedTransportAllowance, otherAllowances: request.proposedOtherAllowances, currency: request.currency, bankName: current.bankName, bankAccountNumber: current.bankAccountNumber, bankSortCode: current.bankSortCode, pensionFundAdmin: current.pensionFundAdmin, pensionNumber: current.pensionNumber, effectiveFrom: request.effectiveDate, createdBy: context.userId } });
    await tx.salaryStructure.update({ where: { staffId: request.staffId }, data: { basicSalary: request.proposedBasicSalary, housingAllowance: request.proposedHousingAllowance, transportAllowance: request.proposedTransportAllowance, otherAllowances: request.proposedOtherAllowances, currency: request.currency, effectiveFrom: request.effectiveDate } });
    await tx.employeeMovement.create({ data: { staffId: request.staffId, effectiveDate: request.effectiveDate, type: 'SALARY_INCREMENT', reason: request.reason, fromDetails: { basicSalary: Number(request.currentBasicSalary), housingAllowance: Number(request.currentHousingAllowance), transportAllowance: Number(request.currentTransportAllowance), otherAllowances: Number(request.currentOtherAllowances) }, toDetails: { basicSalary: Number(request.proposedBasicSalary), housingAllowance: Number(request.proposedHousingAllowance), transportAllowance: Number(request.proposedTransportAllowance), otherAllowances: Number(request.proposedOtherAllowances) }, approvedBy: request.approvedById || context.userId } });
    return tx.compensationChangeRequest.update({ where: { id: request.id }, data: { status: 'APPLIED', appliedAt: new Date() } });
  });
  if (result) await notifyEmployee({ organizationId: context.organizationId, propertyId: context.propertyId, staffId: result.staffId, subject: 'Compensation change applied', body: `Your approved compensation change is now effective from ${new Date(result.effectiveDate).toLocaleDateString('en-NG')}. Please review it in your employee portal.`, category: 'PAYROLL', action: '/hr/self-service/compensation', idempotencyKey: `compensation:${result.id}:applied` });
  return result;
}

export async function applyDueCompensationChanges(context: HrAuthContext) {
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const due = await prisma.compensationChangeRequest.findMany({ where: { organizationId: context.organizationId, propertyId: context.propertyId, status: { in: ['APPROVED', 'SCHEDULED'] }, effectiveDate: { lte: today } }, select: { id: true } });
  const applied: string[] = [];
  for (const request of due) {
    try { const result = await applyCompensationChange(request.id, context); if (result) applied.push(request.id); } catch (error) { console.warn('Compensation change was not applied during payroll preparation', { requestId: request.id, error }); }
  }
  return applied;
}
