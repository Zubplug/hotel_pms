const fs = require('fs');

function fixFiles(files) {
  for (const file of files) {
    let text = fs.readFileSync(file, 'utf8');
    
    // Fix readonly string[]
    text = text.replace(/allowedPropertyIds;/, 'allowedPropertyIds as string[];');
    text = text.replace(/propertyIds: await getUserPropertyIds/g, 'propertyIds: (await requireOrganizationContext(session.user.id)).propertyIds as string[]');
    text = text.replace(/propertyIds: \(\s*await\s+requireOrganizationContext\(([^)]+)\)\s*\).propertyIds/g, 'propertyIds: (await requireOrganizationContext($1)).propertyIds as string[]');
    text = text.replace(/propertyIds: \(\s*await\s+requireOrganizationContext\(([^)]+)\)\s*\).propertyIds\s+as\s+string\[\]\s+as\s+string\[\]/g, 'propertyIds: (await requireOrganizationContext($1)).propertyIds as string[]');
    text = text.replace(/allowedPropertyIds\.includes/g, '(allowedPropertyIds as string[]).includes');
    
    // Fix Services expecting ctx
    text = text.replace(/CashHandoverService\.receiveHandover\({/g, 'CashHandoverService.receiveHandover(await requireOrganizationContext(actor.user.id), {');
    text = text.replace(/CashHandoverService\.createHandover\({/g, 'CashHandoverService.createHandover(await requireOrganizationContext(actor.user.id), {');
    text = text.replace(/DepositService\.createDeposit\({/g, 'DepositService.createDeposit(await requireOrganizationContext(actor.user.id), {');
    text = text.replace(/DepositService\.submitDeposit\({/g, 'DepositService.submitDeposit(await requireOrganizationContext(actor.user.id), {');
    text = text.replace(/DepositService\.verifyDeposit\({/g, 'DepositService.verifyDeposit(await requireOrganizationContext(actor.user.id), {');
    text = text.replace(/DepositService\.verifyDeposit\(depositId,\s*staff\.id,\s*body\)/g, 'DepositService.verifyDeposit(await requireOrganizationContext(actor.user.id), depositId, staff.id, body)');
    text = text.replace(/DepositService\.rejectDeposit\(depositId,\s*staff\.id,\s*body\.reason\)/g, 'DepositService.rejectDeposit(await requireOrganizationContext(actor.user.id), depositId, staff.id, body.reason)');
    text = text.replace(/ShiftControlService\.startReview\(tx,\s*type,\s*shiftId,\s*actorStaff\.id\)/g, 'ShiftControlService.startReview(await requireOrganizationContext(actor.user.id), tx, type, shiftId, actorStaff.id)');

    // For expenses
    text = text.replace(/ExpenseService\.createExpense\(/g, 'ExpenseService.createExpense(await requireOrganizationContext(session.user.id), ');
    text = text.replace(/ExpenseService\.approveExpense\(/g, 'ExpenseService.approveExpense(await requireOrganizationContext(session.user.id), ');
    text = text.replace(/ExpenseService\.rejectExpense\(/g, 'ExpenseService.rejectExpense(await requireOrganizationContext(session.user.id), ');
    text = text.replace(/ExpenseService\.payExpense\(/g, 'ExpenseService.payExpense(await requireOrganizationContext(session.user.id), ');
    
    // Fix propertyId inside where
    text = text.replace(/propertyId:\s*{\s*in:\s*ctx.propertyIds\s*}/g, 'propertyId: { in: ctx.propertyIds as string[] }');

    fs.writeFileSync(file, text);
  }
}

const files = [
  'apps/web/src/app/api/v1/amenities/route.ts',
  'apps/web/src/app/api/v1/dashboard/analytics/route.ts',
  'apps/web/src/app/api/v1/financial-control/bank-accounts/route.ts',
  'apps/web/src/app/api/v1/financial-control/deposits/[depositId]/submit/route.ts',
  'apps/web/src/app/api/v1/financial-control/deposits/[depositId]/verify/route.ts',
  'apps/web/src/app/api/v1/financial-control/deposits/route.ts',
  'apps/web/src/app/api/v1/financial-control/expense-configuration/[id]/route.ts',
  'apps/web/src/app/api/v1/financial-control/expenses/[expenseId]/action/route.ts',
  'apps/web/src/app/api/v1/financial-control/expenses/route.ts',
  'apps/web/src/app/api/v1/financial-control/handovers/[handoverId]/receive/route.ts',
  'apps/web/src/app/api/v1/financial-control/handovers/route.ts',
  'apps/web/src/app/api/v1/financial-control/shifts/[id]/start-review/route.ts',
  'apps/web/src/app/api/v1/hardware/agents/route.ts',
  'apps/web/src/app/api/v1/housekeeping/tasks/route.ts',
  'apps/web/src/app/api/v1/laundry/items/route.ts'
];

fixFiles(files.map(f => __dirname + '/../' + f));
