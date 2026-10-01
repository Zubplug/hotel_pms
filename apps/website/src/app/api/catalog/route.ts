import { NextResponse } from "next/server";
import prisma from "@hotel-pms/db";

export async function GET() {
  const plans = await prisma.billingPlan.findMany({
    where: { active: true },
    orderBy: { displayOrder: "asc" },
    include: {
      items: {
        include: {
          product: {
            include: {
              prices: { orderBy: [{ interval: "asc" }, { amount: "asc" }] },
              modules: { where: { active: true } },
            },
          },
        },
      },
    },
  });
  return NextResponse.json({ plans });
}
