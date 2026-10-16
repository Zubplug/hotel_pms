import { NextResponse } from "next/server";
import { destroyPartnerSession } from "@/lib/partner-auth";

export async function POST() {
  await destroyPartnerSession();
  return NextResponse.json({ ok: true });
}
