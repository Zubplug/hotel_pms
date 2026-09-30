import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@hotel-pms/db";

const leadSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  company: z.string().trim().max(160).optional().or(z.literal("")),
  propertyName: z.string().trim().max(160).optional().or(z.literal("")),
  location: z.string().trim().max(160).optional().or(z.literal("")),
  roomCount: z.coerce.number().int().min(0).max(100000).optional(),
  message: z.string().trim().max(4000).optional().or(z.literal("")),
  source: z.string().trim().max(80).default("WEBSITE"),
  consent: z.union([z.literal("true"), z.literal(true)]),
  propertyType: z.string().trim().max(100).optional().or(z.literal("")),
  interests: z.array(z.string().trim().max(80)).max(20).optional(),
  metadata: z.record(z.unknown()).optional(),
  idempotencyKey: z.string().trim().max(120).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 32_768) return NextResponse.json({ error: "Request too large" }, { status: 413 });
    const body = await request.json();
    const parsed = leadSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
    const data = parsed.data;
    const idempotencyKey = data.idempotencyKey || request.headers.get("Idempotency-Key") || undefined;
    if (idempotencyKey) {
      const existing = await prisma.salesLead.findUnique({ where: { idempotencyKey }, select: { id: true } });
      if (existing) return NextResponse.json({ id: existing.id, duplicate: true }, { status: 200 });
    }
    const lead = await prisma.salesLead.create({ data: {
      name: data.name, email: data.email, phone: data.phone || null, company: data.company || null,
      propertyName: data.propertyName || null, location: data.location || null, roomCount: data.roomCount,
      message: data.message || null, source: data.source, consentAt: new Date(), idempotencyKey,
      metadata: { ...(data.metadata || {}), propertyType: data.propertyType || null, interests: data.interests || [], userAgent: request.headers.get("user-agent")?.slice(0, 500) || null },
    }, select: { id: true } });
    return NextResponse.json({ id: lead.id }, { status: 201 });
  } catch (error) {
    console.error("[website.leads] failed", error);
    return NextResponse.json({ error: "Unable to submit request" }, { status: 500 });
  }
}
