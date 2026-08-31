const fs = require('fs');

function fix(file, replacements) {
    let text = fs.readFileSync(file, 'utf8');
    for (const [r, target] of replacements) {
        text = text.replace(r, target);
    }
    fs.writeFileSync(file, text);
}

fix(__dirname + '/../apps/web/src/app/api/v1/night-audit/execute/route.ts', [
    [/getOperationalReview\(propertyId\)/g, 'getOperationalReview(await requireOrganizationContext(session.user.id), propertyId)'],
    [/getFinancialAudit\(propertyId\)/g, 'getFinancialAudit(await requireOrganizationContext(session.user.id), propertyId)'],
    [/getSystemIntegrity\(propertyId\)/g, 'getSystemIntegrity(await requireOrganizationContext(session.user.id), propertyId)']
]);

fix(__dirname + '/../apps/web/src/app/api/v1/night-audit/status/route.ts', [
    [/getOperationalReview\(propertyId\)/g, 'getOperationalReview(await requireOrganizationContext(session.user.id), propertyId)'],
    [/getFinancialAudit\(propertyId\)/g, 'getFinancialAudit(await requireOrganizationContext(session.user.id), propertyId)'],
    [/getSystemIntegrity\(propertyId\)/g, 'getSystemIntegrity(await requireOrganizationContext(session.user.id), propertyId)'],
    [/getPreviousAudit\(propertyId\)/g, 'getPreviousAudit(await requireOrganizationContext(session.user.id), propertyId)']
]);

