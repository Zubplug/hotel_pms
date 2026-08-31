const fs = require('fs');

function fix(file, replacements) {
    let text = fs.readFileSync(file, 'utf8');
    for (const [r, target] of replacements) {
        text = text.replace(r, target);
    }
    fs.writeFileSync(file, text);
}

fix(__dirname + '/../apps/web/src/app/api/v1/financial-control/expenses/[expenseId]/action/route.ts', [
    [/CashExpenseService\.pay\(await requireOrganizationContext\(session\.user\.id\),\s*expenseId,\s*staff\.id\)/g, 'CashExpenseService.pay(await requireOrganizationContext(session.user.id), expenseId)'],
    [/CashExpenseService\.approve\(await requireOrganizationContext\(session\.user\.id\),\s*expenseId,\s*staff\.id,\s*body\.notes\)/g, 'CashExpenseService.approve(await requireOrganizationContext(session.user.id), expenseId, body.notes)'],
    [/CashExpenseService\.reject\(await requireOrganizationContext\(session\.user\.id\),\s*expenseId,\s*staff\.id,\s*String\(body\.reason \|\| ''\)\)/g, 'CashExpenseService.reject(await requireOrganizationContext(session.user.id), expenseId, String(body.reason || \'\'))']
]);

fix(__dirname + '/../apps/web/src/app/api/v1/financial-control/expenses/route.ts', [
    [/requestedBy: actor\.staffId,\s*/g, '']
]);

fix(__dirname + '/../apps/web/src/app/api/v1/financial-control/shifts/[id]/start-review/route.ts', [
    [/ShiftControlService\.startShiftReview\(await requireOrganizationContext\(session\.user\.id\),\s*type,\s*shiftId,\s*staff\.id\)/g, 'ShiftControlService.startShiftReview(await requireOrganizationContext(session.user.id), type, shiftId)']
]);

fix(__dirname + '/../apps/web/src/app/api/v1/night-audit/status/route.ts', [
    [/getCashReconciliation\(propertyId\)/g, 'getCashReconciliation(await requireOrganizationContext(session.user.id), propertyId)']
]);

fix(__dirname + '/../apps/web/src/app/api/v1/reports/shift/[shiftId]/approve/route.ts', [
    [/ShiftControlService\.approveShift\(await requireOrganizationContext\(actorUserId\),\s*type,\s*shiftId,\s*reviewerId\)/g, 'ShiftControlService.approveShift(await requireOrganizationContext(actorUserId), type, shiftId)'],
    [/ShiftControlService\.approveShiftWithVariance\(await requireOrganizationContext\(actorUserId\),\s*type,\s*shiftId,\s*reviewerId,\s*role,\s*reasonCode,\s*reviewNotes\)/g, 'ShiftControlService.approveShiftWithVariance(await requireOrganizationContext(actorUserId), type, shiftId, reasonCode, reviewNotes)'],
    [/ShiftControlService\.returnShift\(await requireOrganizationContext\(actorUserId\),\s*type,\s*shiftId,\s*reviewerId,\s*reviewNotes\)/g, 'ShiftControlService.returnShift(await requireOrganizationContext(actorUserId), type, shiftId, reviewNotes)']
]);
