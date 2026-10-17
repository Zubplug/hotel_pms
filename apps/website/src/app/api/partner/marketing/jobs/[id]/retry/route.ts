import { NextRequest, NextResponse } from "next/server";
import prisma from "@hotel-pms/db";
import { getPartnerSession } from "@/lib/partner-auth";
import { enqueueReachCreative } from "@/lib/reach-creative-jobs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const partner = await getPartnerSession();
  if (!partner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const job = await prisma.reachCreativeGeneration.findFirst({ where: { id, partnerId: partner.id } });
  if (!job) return NextResponse.json({ error: "Generation not found" }, { status: 404 });
  await prisma.reachCreativeGeneration.update({ where: { id: job.id }, data: { status: "QUEUED", errorMessage: null } });
  try { await enqueueReachCreative(job.id, new URL(request.url).origin); return NextResponse.json({ ok: true }); }
  catch (error) { await prisma.reachCreativeGeneration.update({ where: { id: job.id }, data: { status: "FAILED", errorMessage: error instanceof Error ? error.message.slice(0, 1000) : "Unable to retry" } }); return NextResponse.json({ error: "Unable to retry generation" }, { status: 502 }); }
}
