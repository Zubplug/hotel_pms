import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@hotel-pms/db";
export async function GET() { const user = await auth(); const organizationId = (user?.user as { organizationId?: string } | undefined)?.organizationId; if (!organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); const projects = await prisma.implementationProject.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, include: { propertySetups: true, dataMigrations: true, trainings: true } }); return NextResponse.json({ projects }); }
