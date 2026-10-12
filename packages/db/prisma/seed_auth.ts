import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const permissionsList = [
  // Core Modules
  { name: 'ACCESS_FRONT_DESK', resource: 'SYSTEM', action: 'ACCESS', description: 'Access Front Desk module' },
  { name: 'ACCESS_POS', resource: 'SYSTEM', action: 'ACCESS', description: 'Access POS module' },
  { name: 'ACCESS_HOUSEKEEPING', resource: 'SYSTEM', action: 'ACCESS', description: 'Access Housekeeping module' },
  { name: 'ACCESS_CASH_MANAGEMENT', resource: 'SYSTEM', action: 'ACCESS', description: 'Access Cash Management module' },
  { name: 'ACCESS_INVENTORY', resource: 'SYSTEM', action: 'ACCESS', description: 'Access Inventory module' },
  { name: 'ACCESS_MANAGEMENT', resource: 'SYSTEM', action: 'ACCESS', description: 'Access Management module' },
  { name: 'ACCESS_NIGHT_AUDIT', resource: 'SYSTEM', action: 'ACCESS', description: 'Access Night Audit module' },
  { name: 'ACCESS_SYNC_CENTER', resource: 'SYSTEM', action: 'ACCESS', description: 'Access Sync Center module' },
  { name: 'ACCESS_MAINTENANCE', resource: 'SYSTEM', action: 'ACCESS', description: 'Access Maintenance module' },
  { name: 'ACCESS_REPORTS', resource: 'SYSTEM', action: 'ACCESS', description: 'Access Reports module' },

  // POS
  { name: 'PROCESS_CASH_PAYMENT', resource: 'POS', action: 'CREATE', description: 'Process cash payments' },
  { name: 'PROCESS_CARD_PAYMENT', resource: 'POS', action: 'CREATE', description: 'Process card payments' },
  { name: 'PROCESS_ROOM_CHARGE', resource: 'POS', action: 'CREATE', description: 'Process room charges' },
  { name: 'ACCESS_POS_SETTINGS', resource: 'POS', action: 'ACCESS', description: 'Access POS settings' },

  // Cash Management
  { name: 'VIEW_CASH_HANDOVERS', resource: 'CASH', action: 'READ', description: 'View cash handovers' },
  { name: 'CONFIRM_CASH_HANDOVER', resource: 'CASH', action: 'UPDATE', description: 'Confirm cash handover' },
  { name: 'OPEN_SAFE', resource: 'CASH', action: 'UPDATE', description: 'Open safe' },
  { name: 'DEPOSIT_SAFE', resource: 'CASH', action: 'CREATE', description: 'Deposit to safe' },
  { name: 'VIEW_CASH_LEDGER', resource: 'CASH', action: 'READ', description: 'View cash ledger' },

  // Refunds & Voids
  { name: 'ACCESS_REFUNDS', resource: 'REFUND', action: 'ACCESS', description: 'Access refunds' },
  { name: 'PROCESS_REFUND', resource: 'REFUND', action: 'CREATE', description: 'Process refund' },
  { name: 'APPROVE_REFUND', resource: 'REFUND', action: 'UPDATE', description: 'Approve refund' },
  { name: 'LIMIT_REFUND_50K', resource: 'REFUND', action: 'LIMIT', description: 'Refund limit 50K' },
  { name: 'LIMIT_REFUND_250K', resource: 'REFUND', action: 'LIMIT', description: 'Refund limit 250K' },
  { name: 'LIMIT_REFUND_UNLIMITED', resource: 'REFUND', action: 'LIMIT', description: 'Unlimited refunds' },
  { name: 'ACCESS_VOID', resource: 'VOID', action: 'ACCESS', description: 'Access voids' },
  { name: 'AUTHORIZE_VOID', resource: 'VOID', action: 'UPDATE', description: 'Authorize voids' },
  { name: 'AUTHORIZE_POST_KITCHEN_VOID', resource: 'VOID', action: 'UPDATE', description: 'Authorize voids after kitchen printing' },

  // Emergency
  { name: 'USE_EMERGENCY_CASHIER', resource: 'EMERGENCY', action: 'CREATE', description: 'Use emergency cashier' },
  { name: 'AUTHORIZE_EMERGENCY_BANK', resource: 'EMERGENCY', action: 'UPDATE', description: 'Authorize emergency bank' },

  // Misc
  { name: 'ACCESS_DISCOUNTS', resource: 'DISCOUNT', action: 'ACCESS', description: 'Access discounts' },
  { name: 'AUTHORIZE_DISCOUNT', resource: 'DISCOUNT', action: 'UPDATE', description: 'Authorize discounts' },
  { name: 'APPROVE_DRAWER_VARIANCE', resource: 'CASH', action: 'UPDATE', description: 'Approve drawer variance' },
  { name: 'OVERRIDE_NIGHT_AUDIT', resource: 'AUDIT', action: 'UPDATE', description: 'Override night audit' },
  { name: 'POST_CITY_LEDGER', resource: 'LEDGER', action: 'CREATE', description: 'Post to city ledger' },

  // Enterprise HR & Payroll
  { name: 'ACCESS_HR', resource: 'SYSTEM', action: 'ACCESS', description: 'Access HR & Payroll module' },
  { name: 'hr.employee.view', resource: 'HR_EMPLOYEE', action: 'READ', description: 'View employee records' },
  { name: 'hr.employee.manage', resource: 'HR_EMPLOYEE', action: 'MANAGE', description: 'Create and update employee records' },
  { name: 'hr.org.manage', resource: 'HR_ORG', action: 'MANAGE', description: 'Manage departments, positions, sections' },
  { name: 'hr.recruitment.manage', resource: 'HR_RECRUITMENT', action: 'MANAGE', description: 'Manage job vacancies and candidates' },
  { name: 'hr.onboarding.manage', resource: 'HR_ONBOARDING', action: 'MANAGE', description: 'Manage onboarding & offboarding' },
  { name: 'hr.attendance.view', resource: 'HR_ATTENDANCE', action: 'READ', description: 'View attendance timesheets' },
  { name: 'hr.attendance.manage', resource: 'HR_ATTENDANCE', action: 'MANAGE', description: 'Manage attendance and exceptions' },
  { name: 'hr.shifts.manage', resource: 'HR_SHIFTS', action: 'MANAGE', description: 'Manage work shifts and rosters' },
  { name: 'hr.leave.view', resource: 'HR_LEAVE', action: 'READ', description: 'View leave requests and balances' },
  { name: 'hr.leave.apply', resource: 'HR_LEAVE', action: 'CREATE', description: 'Submit leave applications' },
  { name: 'hr.leave.approve', resource: 'HR_LEAVE', action: 'UPDATE', description: 'Approve or reject leave applications' },
  { name: 'hr.payroll.view', resource: 'HR_PAYROLL', action: 'READ', description: 'View payroll batches and summaries' },
  { name: 'hr.payroll.prepare', resource: 'HR_PAYROLL', action: 'CREATE', description: 'Prepare and calculate payroll batches' },
  { name: 'hr.payroll.approve', resource: 'HR_PAYROLL', action: 'UPDATE', description: 'Approve payroll batches' },
  { name: 'hr.payroll.release', resource: 'HR_PAYROLL', action: 'PAY', description: 'Release payroll disbursements and post to GL' },
  { name: 'hr.benefits.manage', resource: 'HR_BENEFITS', action: 'MANAGE', description: 'Manage loans, advances, expense claims' },
  { name: 'hr.performance.manage', resource: 'HR_PERFORMANCE', action: 'MANAGE', description: 'Manage appraisals and KPIs' },
  { name: 'hr.training.manage', resource: 'HR_TRAINING', action: 'MANAGE', description: 'Manage training courses and records' },
  { name: 'hr.disciplinary.manage', resource: 'HR_DISCIPLINARY', action: 'MANAGE', description: 'Manage disciplinary records' },
  { name: 'hr.documents.manage', resource: 'HR_DOCUMENTS', action: 'MANAGE', description: 'Manage employee contracts and policies' },
  { name: 'hr.reports.view', resource: 'HR_REPORTS', action: 'READ', description: 'View HR and payroll reports' },
  { name: 'hr.settings.manage', resource: 'HR_SETTINGS', action: 'MANAGE', description: 'Manage HR statutory and policy settings' },
  { name: 'hr.self_service.access', resource: 'HR_SELF_SERVICE', action: 'ACCESS', description: 'Access employee self-service portal' },
];

const systemRoles = {
  SUPER_ADMIN: permissionsList.map(p => p.name),
  ADMIN: permissionsList.map(p => p.name),
  DIRECTOR: permissionsList.map(p => p.name),
  EXECUTIVE: permissionsList.map(p => p.name),
  MANAGER: [
    'ACCESS_FRONT_DESK', 'ACCESS_POS', 'ACCESS_HOUSEKEEPING', 'ACCESS_CASH_MANAGEMENT', 
    'ACCESS_INVENTORY', 'ACCESS_MANAGEMENT', 'ACCESS_NIGHT_AUDIT', 'ACCESS_SYNC_CENTER', 'ACCESS_MAINTENANCE',
    'ACCESS_REFUNDS', 'LIMIT_REFUND_250K', 'PROCESS_REFUND', 'APPROVE_REFUND',
    'ACCESS_VOID', 'ACCESS_DISCOUNTS', 'AUTHORIZE_VOID', 'AUTHORIZE_DISCOUNT', 
    'APPROVE_DRAWER_VARIANCE', 'OVERRIDE_NIGHT_AUDIT', 'POST_CITY_LEDGER', 'ACCESS_REPORTS',
    'VIEW_CASH_HANDOVERS', 'CONFIRM_CASH_HANDOVER', 'OPEN_SAFE', 'DEPOSIT_SAFE', 'VIEW_CASH_LEDGER',
    'USE_EMERGENCY_CASHIER', 'AUTHORIZE_EMERGENCY_BANK', 'PROCESS_CASH_PAYMENT', 'PROCESS_CARD_PAYMENT', 'PROCESS_ROOM_CHARGE'
  ],
  FRONT_DESK: [
    'ACCESS_FRONT_DESK', 'ACCESS_HOUSEKEEPING', 'ACCESS_REFUNDS', 'LIMIT_REFUND_50K', 'PROCESS_REFUND', 'ACCESS_REPORTS'
  ],
  RECEPTIONIST: [
    'ACCESS_FRONT_DESK', 'ACCESS_HOUSEKEEPING', 'ACCESS_REFUNDS', 'LIMIT_REFUND_50K', 'PROCESS_REFUND', 'ACCESS_REPORTS'
  ],
  CASHIER: [
    'ACCESS_POS', 'ACCESS_CASH_MANAGEMENT', 'PROCESS_CASH_PAYMENT', 'PROCESS_CARD_PAYMENT', 'PROCESS_ROOM_CHARGE'
  ],
  BARTENDER: [
    'ACCESS_POS', 'ACCESS_CASH_MANAGEMENT', 'PROCESS_CASH_PAYMENT', 'PROCESS_CARD_PAYMENT', 'PROCESS_ROOM_CHARGE'
  ],
  WAITER: [
    'ACCESS_POS'
  ],
  HOUSEKEEPER: [
    'ACCESS_HOUSEKEEPING'
  ],
  NIGHT_AUDITOR: [
    'ACCESS_FRONT_DESK', 'ACCESS_NIGHT_AUDIT', 'ACCESS_REPORTS', 'POST_CITY_LEDGER'
  ],
  MAINTENANCE: [
    'ACCESS_MAINTENANCE'
  ],
  INVENTORY_MANAGER: [
    'ACCESS_INVENTORY'
  ],
  AUDITOR: [
    'ACCESS_REPORTS', 'ACCESS_NIGHT_AUDIT', 'ACCESS_CASH_MANAGEMENT', 'ACCESS_FRONT_DESK', 'ACCESS_POS', 'ACCESS_INVENTORY'
  ],
  EXTERNAL_AUDITOR: [],
  HR_MANAGER: [
    'ACCESS_HR', 'hr.employee.view', 'hr.employee.manage', 'hr.org.manage',
    'hr.recruitment.manage', 'hr.onboarding.manage', 'hr.attendance.view', 'hr.attendance.manage',
    'hr.shifts.manage', 'hr.leave.view', 'hr.leave.apply', 'hr.leave.approve',
    'hr.payroll.view', 'hr.payroll.prepare', 'hr.payroll.approve', 'hr.payroll.release',
    'hr.benefits.manage', 'hr.performance.manage', 'hr.training.manage', 'hr.disciplinary.manage',
    'hr.documents.manage', 'hr.reports.view', 'hr.settings.manage', 'hr.self_service.access'
  ],
  PAYROLL_OFFICER: [
    'ACCESS_HR', 'hr.employee.view', 'hr.attendance.view', 'hr.leave.view',
    'hr.payroll.view', 'hr.payroll.prepare', 'hr.benefits.manage', 'hr.reports.view',
    'hr.self_service.access'
  ],
  PAYROLL_APPROVER: [
    'ACCESS_HR', 'hr.employee.view', 'hr.payroll.view', 'hr.payroll.approve',
    'hr.payroll.release', 'hr.reports.view', 'hr.self_service.access'
  ],
  HR_OFFICER: [
    'ACCESS_HR', 'hr.employee.view', 'hr.employee.manage', 'hr.org.manage',
    'hr.recruitment.manage', 'hr.onboarding.manage', 'hr.attendance.view', 'hr.attendance.manage',
    'hr.shifts.manage', 'hr.leave.view', 'hr.leave.apply', 'hr.leave.approve',
    'hr.performance.manage', 'hr.training.manage', 'hr.disciplinary.manage',
    'hr.documents.manage', 'hr.reports.view', 'hr.self_service.access'
  ],
  DEPARTMENT_HEAD: [
    'ACCESS_HR', 'hr.employee.view', 'hr.attendance.view', 'hr.shifts.manage',
    'hr.leave.view', 'hr.leave.approve', 'hr.performance.manage', 'hr.self_service.access'
  ],
};

async function main() {
  console.log('Seeding Permissions and System Roles...');

  const org = await prisma.organization.findFirst({ where: { slug: 'lodgecore' } });
  if (!org) {
    console.error('Organization not found! Please run the main seed first.');
    return;
  }

  // 1. Upsert Permissions
  for (const perm of permissionsList) {
    await prisma.permission.upsert({
      where: { name: perm.name },
      update: {
        resource: perm.resource,
        action: perm.action,
        description: perm.description
      },
      create: perm
    });
  }

  // 2. Upsert System Roles and Reconcile Permissions
  for (const [roleName, capabilities] of Object.entries(systemRoles)) {
    // Upsert role
    const role = await prisma.role.upsert({
      where: {
        // Prisma might not have a unique constraint on (organizationId, name), but let's assume we can find it.
        // If there's no unique constraint, we use findFirst and update/create manually.
        id: 'dummy' // we will handle it below
      },
      update: {},
      create: {
        organizationId: org.id,
        name: roleName,
        isSystem: true,
        description: `System Role: ${roleName}`
      }
    }).catch(async () => {
       // Manual upsert if unique constraint on ID fails
       let existing = await prisma.role.findFirst({ where: { organizationId: org.id, name: roleName, isSystem: true } });
       if (!existing) {
         existing = await prisma.role.create({
           data: {
             organizationId: org.id,
             name: roleName,
             isSystem: true,
             description: `System Role: ${roleName}`
           }
         });
       }
       return existing;
    });

    // We only touch System roles as per requirements
    if (role.isSystem) {
      // Get all permissions we need to assign
      const dbPerms = await prisma.permission.findMany({
        where: { name: { in: capabilities } }
      });
      
      // Get current assignments
      const currentAssignments = await prisma.rolePermission.findMany({
        where: { roleId: role.id }
      });
      const currentPermIds = currentAssignments.map(a => a.permissionId);

      // Add missing
      for (const p of dbPerms) {
        if (!currentPermIds.includes(p.id)) {
          await prisma.rolePermission.create({
            data: {
              roleId: role.id,
              permissionId: p.id
            }
          });
        }
      }
      
      // Remove excess (only for system roles to maintain baseline!)
      for (const curr of currentAssignments) {
        if (!dbPerms.find(dp => dp.id === curr.permissionId)) {
          await prisma.rolePermission.delete({
            where: {
              roleId_permissionId: {
                roleId: role.id,
                permissionId: curr.permissionId
              }
            }
          });
        }
      }
    }
  }

  console.log('Finished seeding Auth Permissions!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
