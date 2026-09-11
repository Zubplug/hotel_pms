const fs = require('fs');
const file = 'apps/web/src/app/api/v1/reservations/route.ts';
let code = fs.readFileSync(file, 'utf8');

const importStatement = "import { SharedReservationService } from '@/lib/services/reservation-service';\n";
if (!code.includes('SharedReservationService')) {
    code = code.replace("import { isNightAuditTransactionLocked } from '@/lib/night-audit-guard';", "import { isNightAuditTransactionLocked } from '@/lib/night-audit-guard';\n" + importStatement);
}

const txStart = code.indexOf('const reservation = await prisma.$transaction(async (tx: any) => {');
const txEnd = code.indexOf('});', code.indexOf('return { newReservation, organizationId: property?.organizationId || \'\' };')) + 3;

if (txStart > -1 && txEnd > -1) {
    const replacement = `
    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) return errorResponse('NOT_FOUND', 'Property not found', 404);

    const newReservation = await SharedReservationService.createReservation({
        propertyId,
        organizationId: property.organizationId,
        guestId,
        guestDetails,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        roomTypeId,
        roomId: room.id,
        adults: parseInt(adults) || 1,
        children: parseInt(children) || 0,
        corporateAccountId,
        ratePlanId,
        currency,
        adjustmentType,
        adjustmentValue: Number(adjustmentValue),
        adjustmentReason,
        createdBy: (session.user as any).staffId || session.user.id,
        userEmail: session.user.email,
        userRole: (session.user as any).role,
        ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
        userAgent: req.headers.get('user-agent') || 'Unknown',
        requestId: req.headers.get('x-request-id') || crypto.randomUUID()
    });

    const reservation = { newReservation, organizationId: property.organizationId };
    `;
    code = code.substring(0, txStart) + replacement + code.substring(txEnd);
    fs.writeFileSync(file, code);
    console.log("Updated API route successfully.");
} else {
    console.log("Failed to find tx block.");
}
