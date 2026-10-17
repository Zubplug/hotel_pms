import { NextResponse } from "next/server";
import { getPartnerSession } from "@/lib/partner-auth";
import { deleteReachCreativeGeneration } from "@/lib/reach-creative-jobs";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const partner = await getPartnerSession();
  if (!partner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const deleted = await deleteReachCreativeGeneration(id, partner.id);
  if (!deleted) return NextResponse.json({ error: "Generation not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
