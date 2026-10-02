// Stub: accounting-period-service for apps/website
// Full implementation lives in apps/web. This stub satisfies type-checking.
import prisma from "@hotel-pms/db";

export class AccountingPeriodService {
  static async getActive(propertyId: string) {
    return prisma.accountingPeriod.findFirst({
      where: { propertyId, status: "OPEN" },
      orderBy: { periodStart: "desc" },
    });
  }

  static async validatePeriodOpen(propertyId: string, _date: Date) {
    const period = await prisma.accountingPeriod.findFirst({
      where: { propertyId, status: "OPEN" },
    });
    if (!period) throw new Error("No open accounting period");
    return period;
  }
}
