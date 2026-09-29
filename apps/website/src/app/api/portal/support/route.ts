import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import prisma from "@hotel-pms/db";

const schema = z.object({ subject: z.string().trim().min(3).max(160), description: z.string().trim().min(3).max(10000), priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL") });
export async function GET() { const session = await auth(); const organizationId = (session?.user as { organizationId?: string } | undefined)?.organizationId; if (!organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); return NextResponse.json({ tickets: await prisma.supportTicket.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" } }) }); }
export async function POST(request: NextRequest) { const session = await auth(); const user = session?.user as { organizationId?: string; email?: string } | undefined; if (!user?.organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); const parsed = schema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 }); const number = `LC-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`; const ticket = await prisma.supportTicket.create({ data: { organizationId: user.organizationId, number, requesterEmail: user.email || "", ...parsed.data } }); return NextResponse.json({ ticket }, { status: 201 }); }
