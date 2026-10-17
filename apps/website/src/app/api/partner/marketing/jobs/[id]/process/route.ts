import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { processReachCreativeGeneration } from "@/lib/reach-creative-jobs";

async function verified(request: NextRequest, body: string) {
  if (process.env.NODE_ENV === "development" && process.env.IGNORE_QSTASH_SIGNATURE === "true") return true;
  const signature = request.headers.get("upstash-signature");
  if (!signature || !process.env.QSTASH_CURRENT_SIGNING_KEY || !process.env.QSTASH_NEXT_SIGNING_KEY) return false;
  return new Receiver({ currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY, nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY }).verify({ signature, body });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const body = await request.text();
  if (!(await verified(request, body))) return NextResponse.json({ error: "Invalid queue signature" }, { status: 401 });
  const { id } = await params;
  try { await processReachCreativeGeneration(id); return NextResponse.json({ ok: true }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Generation failed" }, { status: 500 }); }
}
