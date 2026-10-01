import { NextResponse } from "next/server";
import { auth } from "@/auth";
export async function POST() {
  const session = await auth();
  const organizationId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ error: "Flutterwave does not provide a self-service customer portal in this integration. Contact LodgeCore support to change payment details or cancel a subscription." }, { status: 501 });
}
