const fs = require('fs');

function fix(file, replacements) {
    let text = fs.readFileSync(file, 'utf8');
    for (const [r, target] of replacements) {
        text = text.replace(r, target);
    }
    fs.writeFileSync(file, text);
}

fix(__dirname + '/../apps/web/src/app/api/v1/amenities/route.ts', [
    [/propertyId: propertyId \|\| { in: \(\s*await\s+requireOrganizationContext\(session\.user\.id\)\s*\)\.propertyIds\s+as\s+string\[\]\s*}/g, '...(propertyId ? { propertyId } : { propertyId: { in: (await requireOrganizationContext(session.user.id)).propertyIds as string[] } })']
]);

fix(__dirname + '/../apps/web/src/app/api/v1/financial-control/bank-accounts/route.ts', [
    [/return { actor, role, propertyIds: \(\s*await\s+requireOrganizationContext\(actor\.user\.id\)\s*\)\.propertyIds\s+as\s+string\[\]\s*};/g, 'return { actor, role, ctx: await requireOrganizationContext(actor.user.id) };']
]);

fix(__dirname + '/../apps/web/src/app/api/v1/financial-control/deposits/[depositId]/submit/route.ts', [
    [/staffId: staff\.id,/g, '']
]);

fix(__dirname + '/../apps/web/src/app/api/v1/financial-control/deposits/[depositId]/verify/route.ts', [
    [/DepositService\.verifyDeposit\(await requireOrganizationContext\(actor\.user\.id\),\s*{/g, 'DepositService.verifyDeposit(await requireOrganizationContext(actor.user.id), depositId, staff.id, {'],
    [/DepositService\.rejectDeposit\(await requireOrganizationContext\(actor\.user\.id\),\s*{/g, 'DepositService.rejectDeposit(await requireOrganizationContext(actor.user.id), depositId, staff.id, {']
]);

fix(__dirname + '/../apps/web/src/app/api/v1/financial-control/deposits/route.ts', [
    [/staffId: staff\.id,/g, '']
]);

fix(__dirname + '/../apps/web/src/app/api/v1/financial-control/expense-configuration/[id]/route.ts', [
    [/propertyId: {\s*in:\s*\(\s*await\s+requireOrganizationContext\(session\.user\.id\)\s*\)\.propertyIds\s*}/g, 'propertyId: { in: (await requireOrganizationContext(session.user.id)).propertyIds as string[] }']
]);

fix(__dirname + '/../apps/web/src/app/api/v1/financial-control/expenses/[expenseId]/action/route.ts', [
    [/ExpenseService\.approveExpense\(await requireOrganizationContext\(session\.user\.id\),\s*expenseId,\s*staff\.id/g, 'ExpenseService.approveExpense(await requireOrganizationContext(session.user.id), expenseId'],
    [/ExpenseService\.rejectExpense\(await requireOrganizationContext\(session\.user\.id\),\s*expenseId,\s*staff\.id/g, 'ExpenseService.rejectExpense(await requireOrganizationContext(session.user.id), expenseId'],
    [/ExpenseService\.payExpense\(await requireOrganizationContext\(session\.user\.id\),\s*expenseId,\s*staff\.id/g, 'ExpenseService.payExpense(await requireOrganizationContext(session.user.id), expenseId']
]);

fix(__dirname + '/../apps/web/src/app/api/v1/financial-control/expenses/route.ts', [
    [/propertyIds: \(\s*await\s+requireOrganizationContext\(session\.user\.id\)\s*\)\.propertyIds/g, 'ctx: await requireOrganizationContext(session.user.id)'],
    [/ExpenseService\.createExpense\(await requireOrganizationContext\(session\.user\.id\),\s*{/g, 'ExpenseService.createExpense(await requireOrganizationContext(session.user.id), {']
]);

fix(__dirname + '/../apps/web/src/app/api/v1/financial-control/handovers/[handoverId]/receive/route.ts', [
    [/receiverId: staff\.id,/g, '']
]);

fix(__dirname + '/../apps/web/src/app/api/v1/financial-control/handovers/route.ts', [
    [/creatorId: staff\.id,/g, '']
]);

fix(__dirname + '/../apps/web/src/app/api/v1/financial-control/shifts/[id]/start-review/route.ts', [
    [/ShiftControlService\.startReview\(await requireOrganizationContext\(actor\.user\.id\),\s*tx,\s*type,\s*shiftId,\s*actorStaff\.id\)/g, 'ShiftControlService.startReview(await requireOrganizationContext(actor.user.id), tx, type, shiftId)']
]);

fix(__dirname + '/../apps/web/src/app/api/v1/hardware/agents/route.ts', [
    [/propertyId:\s*{\s*in:\s*allowed\s*}/g, 'propertyId: { in: allowed as string[] }'],
    [/const allowed = \(\s*await\s+requireOrganizationContext\(session\.user\.id\)\s*\)\.propertyIds;/g, 'const allowed = (await requireOrganizationContext(session.user.id)).propertyIds as string[];']
]);

fix(__dirname + '/../apps/web/src/app/api/v1/housekeeping/tasks/route.ts', [
    [/propertyId:\s*{\s*in:\s*allowedProperties\s*}/g, 'propertyId: { in: allowedProperties as string[] }'],
    [/const allowedProperties = \(\s*await\s+requireOrganizationContext\(session\.user\.id\)\s*\)\.propertyIds;/g, 'const allowedProperties = (await requireOrganizationContext(session.user.id)).propertyIds as string[];']
]);

fix(__dirname + '/../apps/web/src/app/api/v1/laundry/items/route.ts', [
    [/propertyId:\s*{\s*in:\s*allowedProperties\s*}/g, 'propertyId: { in: allowedProperties as string[] }'],
    [/const allowedProperties = \(\s*await\s+requireOrganizationContext\(session\.user\.id\)\s*\)\.propertyIds;/g, 'const allowedProperties = (await requireOrganizationContext(session.user.id)).propertyIds as string[];']
]);

fix(__dirname + '/../apps/web/src/app/api/v1/laundry/orders/route.ts', [
    [/propertyId:\s*{\s*in:\s*allowedProperties\s*}/g, 'propertyId: { in: allowedProperties as string[] }'],
    [/const allowedProperties = \(\s*await\s+requireOrganizationContext\(session\.user\.id\)\s*\)\.propertyIds;/g, 'const allowedProperties = (await requireOrganizationContext(session.user.id)).propertyIds as string[];']
]);
