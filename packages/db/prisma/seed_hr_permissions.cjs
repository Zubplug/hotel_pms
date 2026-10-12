const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const definitions = [
  ['ACCESS_HR', 'SYSTEM', 'ACCESS', 'Access HR & Payroll module'],
  ['hr.employee.view', 'HR_EMPLOYEE', 'READ', 'View employee records'],
  ['hr.employee.manage', 'HR_EMPLOYEE', 'MANAGE', 'Create and update employee records'],
  ['hr.employee.sensitive.view', 'HR_EMPLOYEE', 'READ_SENSITIVE', 'View sensitive employee records'],
  ['hr.org.manage', 'HR_ORG', 'MANAGE', 'Manage departments, positions, and sections'],
  ['hr.recruitment.manage', 'HR_RECRUITMENT', 'MANAGE', 'Manage recruitment records'],
  ['hr.onboarding.manage', 'HR_ONBOARDING', 'MANAGE', 'Manage onboarding records'],
  ['hr.attendance.view', 'HR_ATTENDANCE', 'READ', 'View attendance records'],
  ['hr.attendance.manage', 'HR_ATTENDANCE', 'MANAGE', 'Manage attendance and exceptions'],
  ['hr.shifts.manage', 'HR_SHIFTS', 'MANAGE', 'Manage shifts and rosters'],
  ['hr.leave.view', 'HR_LEAVE', 'READ', 'View leave records'],
  ['hr.leave.apply', 'HR_LEAVE', 'CREATE', 'Submit leave applications'],
  ['hr.leave.approve', 'HR_LEAVE', 'UPDATE', 'Approve leave applications'],
  ['hr.leave.manage', 'HR_LEAVE', 'MANAGE', 'Manage leave records'],
  ['hr.payroll.view', 'HR_PAYROLL', 'READ', 'View payroll batches'],
  ['hr.payroll.prepare', 'HR_PAYROLL', 'CREATE', 'Prepare payroll batches'],
  ['hr.payroll.approve', 'HR_PAYROLL', 'UPDATE', 'Approve payroll batches'],
  ['hr.payroll.release', 'HR_PAYROLL', 'PAY', 'Release payroll and post to GL'],
  ['hr.payroll.reverse', 'HR_PAYROLL', 'REVERSE', 'Reverse payroll journals'],
  ['hr.benefits.manage', 'HR_BENEFITS', 'MANAGE', 'Manage loans and advances'],
  ['hr.performance.manage', 'HR_PERFORMANCE', 'MANAGE', 'Manage performance records'],
  ['hr.training.manage', 'HR_TRAINING', 'MANAGE', 'Manage training records'],
  ['hr.disciplinary.manage', 'HR_DISCIPLINARY', 'MANAGE', 'Manage disciplinary records'],
  ['hr.documents.manage', 'HR_DOCUMENTS', 'MANAGE', 'Manage employee documents'],
  ['hr.reports.view', 'HR_REPORTS', 'READ', 'View HR reports'],
  ['hr.settings.manage', 'HR_SETTINGS', 'MANAGE', 'Manage HR settings'],
  ['hr.self_service.access', 'HR_SELF_SERVICE', 'ACCESS', 'Access employee self-service'],
  ['hr.service-desk.manage', 'HR_SERVICE_DESK', 'MANAGE', 'Manage HR service desk'],
  ['hr.policy.manage', 'HR_POLICY', 'MANAGE', 'Manage HR policies'],
  ['hr.remittance.manage', 'HR_REMITTANCE', 'MANAGE', 'Manage statutory remittances'],
];

const all = definitions.map(([name]) => name);
const roles = {
  HR_MANAGER: all,
  ADMIN: all,
  SUPER_ADMIN: all,
  DIRECTOR: all,
  EXECUTIVE: all,
  PAYROLL_OFFICER: ['ACCESS_HR', 'hr.employee.view', 'hr.attendance.view', 'hr.leave.view', 'hr.payroll.view', 'hr.payroll.prepare', 'hr.benefits.manage', 'hr.reports.view', 'hr.self_service.access'],
  PAYROLL_APPROVER: ['ACCESS_HR', 'hr.employee.view', 'hr.payroll.view', 'hr.payroll.approve', 'hr.payroll.release', 'hr.payroll.reverse', 'hr.reports.view', 'hr.self_service.access'],
  HR_OFFICER: ['ACCESS_HR', 'hr.employee.view', 'hr.employee.manage', 'hr.org.manage', 'hr.recruitment.manage', 'hr.onboarding.manage', 'hr.attendance.view', 'hr.attendance.manage', 'hr.shifts.manage', 'hr.leave.view', 'hr.leave.apply', 'hr.leave.approve', 'hr.performance.manage', 'hr.training.manage', 'hr.disciplinary.manage', 'hr.documents.manage', 'hr.reports.view', 'hr.self_service.access'],
  DEPARTMENT_HEAD: ['ACCESS_HR', 'hr.employee.view', 'hr.attendance.view', 'hr.shifts.manage', 'hr.leave.view', 'hr.leave.approve', 'hr.performance.manage', 'hr.self_service.access'],
  GENERAL_MANAGER: ['ACCESS_HR', 'hr.employee.view', 'hr.payroll.view', 'hr.payroll.approve', 'hr.payroll.release', 'hr.reports.view'],
  FINANCIAL_CONTROLLER: ['ACCESS_HR', 'hr.employee.view', 'hr.payroll.view', 'hr.payroll.approve', 'hr.payroll.release', 'hr.payroll.reverse', 'hr.reports.view'],
};

async function main() {
  const permissions = new Map();
  for (const [name, resource, action, description] of definitions) {
    const permission = await prisma.permission.upsert({
      where: { name },
      update: { resource, action, description },
      create: { name, resource, action, description, isSystem: true },
    });
    permissions.set(name, permission.id);
  }

  const organizations = await prisma.organization.findMany({ select: { id: true, slug: true } });
  let roleCount = 0;
  let assignmentCount = 0;
  for (const organization of organizations) {
    for (const [roleName, capabilityNames] of Object.entries(roles)) {
      let role = await prisma.role.findFirst({ where: { organizationId: organization.id, name: roleName, isSystem: roleName !== 'GENERAL_MANAGER' && roleName !== 'FINANCIAL_CONTROLLER' } });
      if (!role) {
        role = await prisma.role.create({ data: { organizationId: organization.id, name: roleName, isSystem: !['GENERAL_MANAGER', 'FINANCIAL_CONTROLLER'].includes(roleName), description: `HR system role: ${roleName}` } });
        roleCount += 1;
      }
      const rows = capabilityNames.map(name => ({ roleId: role.id, permissionId: permissions.get(name) })).filter(row => row.permissionId);
      const result = await prisma.rolePermission.createMany({ data: rows, skipDuplicates: true });
      assignmentCount += result.count;
    }
  }
  console.log(JSON.stringify({ organizations: organizations.length, permissions: permissions.size, rolesCreated: roleCount, rolePermissionLinksCreated: assignmentCount }));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
