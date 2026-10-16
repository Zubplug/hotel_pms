import crypto from "node:crypto";
import { cookies } from "next/headers";
import prisma from "@hotel-pms/db";

export const PARTNER_SESSION_COOKIE = "lodgecore_partner_session";
const SESSION_DAYS = 30;

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createPartnerSession(partnerId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.referralPartnerSession.create({ data: { partnerId, tokenHash: hashToken(token), expiresAt } });
  const store = await cookies();
  store.set(PARTNER_SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", expires: expiresAt, path: "/" });
}

export async function getPartnerSession() {
  const store = await cookies();
  const token = store.get(PARTNER_SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.referralPartnerSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { partner: true },
  });
  if (!session || session.expiresAt <= new Date() || session.partner.status !== "ACTIVE" || !session.partner.passwordHash) return null;
  await prisma.referralPartnerSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
  return session.partner;
}

export async function destroyPartnerSession() {
  const store = await cookies();
  const token = store.get(PARTNER_SESSION_COOKIE)?.value;
  if (token) await prisma.referralPartnerSession.deleteMany({ where: { tokenHash: hashToken(token) } });
  store.set(PARTNER_SESSION_COOKIE, "", { httpOnly: true, expires: new Date(0), path: "/" });
}
