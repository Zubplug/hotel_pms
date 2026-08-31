const fs = require('fs');

function fix(file, replacements) {
    let text = fs.readFileSync(file, 'utf8');
    for (const [r, target] of replacements) {
        text = text.replace(r, target);
    }
    fs.writeFileSync(file, text);
}

// 1
fix(__dirname + '/../apps/web/src/app/api/v1/amenities/route.ts', [
    [/const where = { propertyId:/g, 'const where: any = { propertyId:']
]);

// 2
fix(__dirname + '/../apps/web/src/app/api/v1/financial-control/bank-accounts/route.ts', [
    [/return { actor, role, propertyIds: \(\s*await\s+requireOrganizationContext\(actor\.user\.id\)\s*\)\.propertyIds\s*};/g, 'return { actor, role, ctx: await requireOrganizationContext(actor.user.id) };']
]);

// 3
fix(__dirname + '/../apps/web/src/app/api/v1/financial-control/deposits/[depositId]/submit/route.ts', [
    [/staffId: staff\.id,/g, '']
]);

// 4
fix(__dirname + '/../apps/web/src/app/api/v1/financial-control/deposits/[depositId]/verify/route.ts', [
    [/DepositService\.verifyDeposit\(await requireOrganizationContext\(actor\.user\.id\),\s*{/g, 'DepositService.verifyDeposit(await requireOrganizationContext(actor.user.id), depositId, staff.id, {'],
    [/DepositService\.rejectDeposit\(await requireOrganizationContext\(actor\.user\.id\),\s*{/g, 'DepositService.rejectDeposit(await requireOrganizationContext(actor.user.id), depositId, staff.id, {']
]);

// 5
fix(__dirname + '/../apps/web/src/app/api/v1/financial-control/deposits/route.ts', [
    [/staffId: staff\.id,/g, '']
]);

// 6
fix(__dirname + '/../apps/web/src/app/api/v1/financial-control/expense-configuration/[id]/route.ts', [
    [/propertyId: {\s*in:\s*\(\s*await\s+requireOrganizationContext\(session\.user\.id\)\s*\)\.propertyIds\s*}/g, 'propertyId: { in: (await requireOrganizationContext(session.user.id)).propertyIds as string[] }']
]);

// 7
fix(__dirname + '/../apps/web/src/app/api/v1/financial-control/expenses/[expenseId]/action/route.ts', [
    [/ExpenseService\.approveExpense\(await requireOrganizationContext\(session\.user\.id\),\s*expenseId,\s*staff\.id/g, 'ExpenseService.approveExpense(await requireOrganizationContext(session.user.id), expenseId'],
    [/ExpenseService\.rejectExpense\(await requireOrganizationContext\(session\.user\.id\),\s*expenseId,\s*staff\.id/g, 'ExpenseService.rejectExpense(await requireOrganizationContext(session.user.id), expenseId'],
    [/ExpenseService\.payExpense\(await requireOrganizationContext\(session\.user\.id\),\s*expenseId,\s*staff\.id/g, 'ExpenseService.payExpense(await requireOrganizationContext(session.user.id), expenseId']
]);

// 8
fix(__dirname + '/../apps/web/src/app/api/v1/financial-control/expenses/route.ts', [
    [/propertyIds: \(\s*await\s+requireOrganizationContext\(session\.user\.id\)\s*\)\.propertyIds/g, 'ctx: await requireOrganizationContext(session.user.id)'],
    [/ExpenseService\.createExpense\(await requireOrganizationContext\(session\.user\.id\),\s*{/g, 'ExpenseService.createExpense(await requireOrganizationContext(session.user.id), {']
]);

// 9
fix(__dirname + '/../apps/web/src/app/api/v1/financial-control/handovers/[handoverId]/receive/route.ts', [
    [/receiverId: staff\.id,/g, '']
]);

// 10
fix(__dirname + '/../apps/web/src/app/api/v1/financial-control/handovers/route.ts', [
    [/creatorId: staff\.id,/g, '']
]);

// 11
fix(__dirname + '/../apps/web/src/app/api/v1/financial-control/shifts/[id]/start-review/route.ts', [
    [/ShiftControlService\.startReview\(await requireOrganizationContext\(actor\.user\.id\),\s*tx,\s*type,\s*shiftId,\s*actorStaff\.id\)/g, 'ShiftControlService.startReview(await requireOrganizationContext(actor.user.id), tx, type, shiftId)']
]);

// 12
fix(__dirname + '/../apps/web/src/app/api/v1/room-types/route.ts', [
    [/const where = { propertyId:/g, 'const where: any = { propertyId:']
]);

// 13
fix(__dirname + '/../apps/web/src/app/api/v1/reports/shift/[shiftId]/approve/route.ts', [
    [/await ShiftControlService\.approveShift\(\s*tx,\s*shift\.type,\s*shift\.shiftId,\s*propertyId,\s*actorStaff\.id,\s*body\.notes\s*\)/g, 'await ShiftControlService.approveShift(await requireOrganizationContext(actorUserId), tx, shift.type, shift.shiftId, { notes: body.notes })']
]);

// 14
fix(__dirname + '/../apps/web/src/app/api/v1/night-audit/status/route.ts', [
    [/getPreviousAudit\(propertyId\)/g, 'getPreviousAudit(await requireOrganizationContext(session.user.id), propertyId)']
]);
