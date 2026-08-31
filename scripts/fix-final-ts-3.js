const fs = require('fs');

function fix(file, replacements) {
    let text = fs.readFileSync(file, 'utf8');
    for (const [r, target] of replacements) {
        text = text.replace(r, target);
    }
    fs.writeFileSync(file, text);
}

// 1. bank-accounts/route.ts
fix(__dirname + '/../apps/web/src/app/api/v1/financial-control/bank-accounts/route.ts', [
    [/context\.propertyIds/g, 'context.ctx.propertyIds'],
    [/ensureBankAccountForClient\(prisma,\s*propertyId\)/g, 'ensureBankAccountForClient(await requireOrganizationContext(actor.user.id), prisma, propertyId)']
]);

// 2. deposits/[depositId]/verify/route.ts
fix(__dirname + '/../apps/web/src/app/api/v1/financial-control/deposits/[depositId]/verify/route.ts', [
    [/DepositService\.verifyDeposit\(await requireOrganizationContext\(actor\.user\.id\),\s*{/g, 'DepositService.verifyDeposit(await requireOrganizationContext(actor.user.id), depositId, staff.id, {'],
    [/DepositService\.rejectDeposit\(await requireOrganizationContext\(actor\.user\.id\),\s*{/g, 'DepositService.rejectDeposit(await requireOrganizationContext(actor.user.id), depositId, staff.id, {']
]);

// 3. expense-configuration/[id]/route.ts
fix(__dirname + '/../apps/web/src/app/api/v1/financial-control/expense-configuration/[id]/route.ts', [
    [/propertyId: { in: \(\s*await\s+requireOrganizationContext\(session\.user\.id\)\s*\)\.propertyIds\s*as\s+string\[\]\s*}/g, 'propertyId: { in: (await requireOrganizationContext(session.user.id)).propertyIds as string[] }'],
    [/propertyId: {\s*in:\s*\(\s*await\s+requireOrganizationContext\(session\.user\.id\)\s*\)\.propertyIds\s*}/g, 'propertyId: { in: (await requireOrganizationContext(session.user.id)).propertyIds as string[] }']
]);

// 4. expenses/[expenseId]/action/route.ts
fix(__dirname + '/../apps/web/src/app/api/v1/financial-control/expenses/[expenseId]/action/route.ts', [
    [/ExpenseService\.approveExpense\(await requireOrganizationContext\(session\.user\.id\),\s*expenseId,\s*staff\.id/g, 'ExpenseService.approveExpense(await requireOrganizationContext(session.user.id), expenseId'],
    [/ExpenseService\.rejectExpense\(await requireOrganizationContext\(session\.user\.id\),\s*expenseId,\s*staff\.id/g, 'ExpenseService.rejectExpense(await requireOrganizationContext(session.user.id), expenseId'],
    [/ExpenseService\.payExpense\(await requireOrganizationContext\(session\.user\.id\),\s*expenseId,\s*staff\.id/g, 'ExpenseService.payExpense(await requireOrganizationContext(session.user.id), expenseId']
]);

// 5. expenses/route.ts
fix(__dirname + '/../apps/web/src/app/api/v1/financial-control/expenses/route.ts', [
    [/propertyIds: \(\s*await\s+requireOrganizationContext\(session\.user\.id\)\s*\)\.propertyIds\s*as\s+string\[\]/g, 'ctx: await requireOrganizationContext(session.user.id)'],
    [/ExpenseService\.createExpense\(await requireOrganizationContext\(session\.user\.id\),\s*{/g, 'ExpenseService.createExpense(await requireOrganizationContext(session.user.id), {']
]);

// 6. shifts/[id]/start-review/route.ts
fix(__dirname + '/../apps/web/src/app/api/v1/financial-control/shifts/[id]/start-review/route.ts', [
    [/ShiftControlService\.startReview\(await requireOrganizationContext\(actor\.user\.id\),\s*tx,\s*type,\s*shiftId,\s*actorStaff\.id\)/g, 'ShiftControlService.startReview(await requireOrganizationContext(actor.user.id), tx, type, shiftId)']
]);

// 7. night-audit/status/route.ts
fix(__dirname + '/../apps/web/src/app/api/v1/night-audit/status/route.ts', [
    [/getPreviousAudit\(propertyId\)/g, 'getPreviousAudit(await requireOrganizationContext(session.user.id), propertyId)']
]);

// 8. reports/shift/[shiftId]/approve/route.ts
fix(__dirname + '/../apps/web/src/app/api/v1/reports/shift/[shiftId]/approve/route.ts', [
    [/ShiftControlService\.approveShift\(\s*tx,\s*shift\.type,\s*shift\.shiftId,\s*propertyId,\s*actorStaff\.id,\s*body\.notes\s*\)/g, 'ShiftControlService.approveShift(await requireOrganizationContext(actorUserId), tx, shift.type, shift.shiftId, { notes: body.notes })']
]);
