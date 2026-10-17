import prisma from "@hotel-pms/db";
import { put } from "@vercel/blob";
import { Client } from "@upstash/qstash";
import { reachShareUrl } from "./reach-links";
import { CREATIVE_TEMPLATES, renderReachCreative, type CreativeTemplate } from "./reach-creative-renderer";

export async function enqueueReachCreative(generationId: string, origin: string) {
  const endpoint = `${origin.replace(/\/$/, "")}/api/partner/marketing/jobs/${generationId}/process`;
  if (!process.env.QSTASH_TOKEN) return processReachCreativeGeneration(generationId);
  await new Client({ token: process.env.QSTASH_TOKEN }).publishJSON({ url: endpoint, body: { generationId }, retries: 3 });
  return null;
}

export async function processReachCreativeGeneration(generationId: string) {
  const claimed = await prisma.reachCreativeGeneration.updateMany({ where: { id: generationId, status: "QUEUED" }, data: { status: "PROCESSING", startedAt: new Date(), attemptCount: { increment: 1 }, errorMessage: null } });
  if (!claimed.count) {
    const existing = await prisma.reachCreativeGeneration.findUnique({ where: { id: generationId } });
    if (existing?.status === "COMPLETED") return existing;
    if (!existing || existing.status === "PROCESSING") return existing;
    return existing;
  }
  try {
    const job = await prisma.reachCreativeGeneration.findUniqueOrThrow({ where: { id: generationId }, include: { property: { select: { name: true } }, campaign: { select: { name: true, code: true, commissionBps: true } } } });
    if (!job.campaign) throw new Error("Campaign is no longer available");
    const template = job.template as CreativeTemplate;
    if (!CREATIVE_TEMPLATES[template]) throw new Error("Unsupported creative template");
    const rendered = await renderReachCreative({ template, propertyName: job.property.name, campaignName: job.campaign.name, commissionBps: job.campaign.commissionBps, referralUrl: reachShareUrl(job.campaign.code), sourceUrl: job.sourceUrl });
    const blob = await put(`reach/creatives/${job.propertyId}/${job.id}.png`, rendered.buffer, { access: "public", addRandomSuffix: false, contentType: rendered.mimeType });
    const asset = await prisma.reachCreativeAsset.create({ data: { propertyId: job.propertyId, campaignId: job.campaignId, title: `${job.property.name} · ${template.toLowerCase()} referral banner`, assetType: rendered.assetType, url: blob.url, mimeType: rendered.mimeType, width: rendered.width, height: rendered.height, usageNotes: "Deterministically rendered from approved LodgeCore data.", status: "APPROVED" } });
    return prisma.reachCreativeGeneration.update({ where: { id: job.id }, data: { status: "COMPLETED", outputUrl: asset.url, completedAt: new Date(), errorMessage: null } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Creative generation failed";
    await prisma.reachCreativeGeneration.update({ where: { id: generationId }, data: { status: "FAILED", errorMessage: message.slice(0, 1000) } });
    throw error;
  }
}
