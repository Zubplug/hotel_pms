import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@hotel-pms/db";

export async function GET() {
  const session = await auth();
  const organizationId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const invoices = await prisma.billingInvoice.findMany({
    where: { organizationId },
    select: {
      id: true, status: true, currency: true, total: true, amountPaid: true,
      amountDue: true, periodStart: true, periodEnd: true, hostedInvoiceUrl: true,
      invoicePdf: true, createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 24,
  });
  return NextResponse.json({ invoices });
}
