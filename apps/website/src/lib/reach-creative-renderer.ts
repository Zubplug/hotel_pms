import sharp from "sharp";
import fs from "node:fs";
import { Resvg } from "@resvg/resvg-js";
import { toBuffer as qrToBuffer } from "qrcode";
import { REACH_FONT_TTF_BASE64 } from "./reach-creative-font";

export const CREATIVE_TEMPLATES = {
  SQUARE: { width: 1080, height: 1080, assetType: "SOCIAL_SQUARE" },
  STORY: { width: 1080, height: 1920, assetType: "SOCIAL_PORTRAIT" },
  LANDSCAPE: { width: 1200, height: 675, assetType: "BANNER" },
} as const;

export type CreativeTemplate = keyof typeof CREATIVE_TEMPLATES;

const XML_ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };
const escapeXml = (value: string) => value.replace(/[&<>"']/g, (character) => XML_ENTITIES[character] || character);
const wrap = (value: string, max = 28) => value.length <= max ? [value] : [value.slice(0, max - 1) + "…"];
const EMBEDDED_FONT_PATH = "/tmp/lodgecore-reach-geist.ttf";

function ensureEmbeddedFont() {
  if (!fs.existsSync(EMBEDDED_FONT_PATH)) fs.writeFileSync(EMBEDDED_FONT_PATH, Buffer.from(REACH_FONT_TTF_BASE64, "base64"));
  return EMBEDDED_FONT_PATH;
}

async function sourceBuffer(sourceUrl?: string | null) {
  if (!sourceUrl) return null;
  try {
    const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}

export async function renderReachCreative(input: {
  template: CreativeTemplate;
  propertyName: string;
  campaignName: string;
  referralUrl: string;
  sourceUrl?: string | null;
  startingPrice?: string | null;
}) {
  const dimensions = CREATIVE_TEMPLATES[input.template];
  const source = await sourceBuffer(input.sourceUrl);
  const propertyLines = wrap(input.propertyName, input.template === "STORY" ? 22 : 28);
  const titleSize = input.template === "STORY" ? 72 : input.template === "LANDSCAPE" ? 56 : 64;
  const background = source
    ? await sharp(source).resize(dimensions.width, dimensions.height, { fit: "cover", position: "attention" }).png().toBuffer()
    : await sharp({ create: { width: dimensions.width, height: dimensions.height, channels: 4, background: { r: 16, g: 24, b: 40, alpha: 1 } } }).png().toBuffer();
  const cardHeight = input.template === "STORY" ? 390 : input.template === "SQUARE" ? 320 : 220;
  const cardY = dimensions.height - cardHeight - (input.template === "STORY" ? 84 : 56);
  const qrSize = input.template === "STORY" ? 220 : input.template === "SQUARE" ? 170 : 132;
  const qrLeft = dimensions.width - 64 - qrSize;
  const y = cardY + (input.template === "STORY" ? 96 : 76);
  const titleEnd = y + propertyLines.length * titleSize;
  const priceY = Math.max(cardY + (input.template === "STORY" ? 170 : input.template === "SQUARE" ? 132 : 116), titleEnd + 26);
  const campaignY = priceY + (input.template === "STORY" ? 44 : input.template === "SQUARE" ? 36 : 30);
  const ctaY = cardY + cardHeight - 42;
  const campaignName = input.campaignName.replace(/\s*[—-]\s*Direct Booking Campaign\s*$/i, "");
  const campaignLines = wrap(campaignName.trim().toLowerCase() === input.propertyName.trim().toLowerCase() ? "Direct booking" : campaignName, input.template === "STORY" ? 24 : 30);
  const svg = `<svg width="${dimensions.width}" height="${dimensions.height}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#07111f" stop-opacity=".15"/><stop offset=".72" stop-color="#07111f" stop-opacity=".86"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#shade)"/>
    <text x="64" y="82" fill="#b9f5d0" font-family="Geist" font-size="28" font-weight="700" letter-spacing="4">LODGECORE REACH</text>
    <rect x="64" y="${cardY}" width="${dimensions.width - 128}" height="${cardHeight}" rx="32" fill="#06101de8" stroke="#b9f5d0" stroke-opacity=".55"/>
    <text x="96" y="${y}" fill="white" font-family="Geist" font-size="${titleSize}" font-weight="800">${escapeXml(propertyLines[0])}</text>
    ${propertyLines[1] ? `<text x="96" y="${y + titleSize + 10}" fill="white" font-family="Geist" font-size="${titleSize}" font-weight="800">${escapeXml(propertyLines[1])}</text>` : ""}
    <text x="96" y="${priceY}" fill="#b9f5d0" font-family="Geist" font-size="${input.template === "STORY" ? 36 : input.template === "LANDSCAPE" ? 24 : 30}" font-weight="800">${escapeXml(input.startingPrice ? `Rooms from ${input.startingPrice} / night` : "Book direct for available rates")}</text>
    <text x="96" y="${campaignY}" fill="#b9f5d0" font-family="Geist" font-size="${input.template === "STORY" ? 32 : 26}" font-weight="600">${escapeXml(campaignLines[0])}</text>
    ${campaignLines[1] ? `<text x="96" y="${campaignY + 36}" fill="#b9f5d0" font-family="Geist" font-size="${input.template === "STORY" ? 32 : 26}" font-weight="600">${escapeXml(campaignLines[1])}</text>` : ""}
    <text x="96" y="${ctaY}" fill="white" font-family="Geist" font-size="24" font-weight="700">Book direct today · Scan to book</text>
    <rect x="${qrLeft - 12}" y="${cardY + (cardHeight - qrSize) / 2 - 12}" width="${qrSize + 24}" height="${qrSize + 24}" rx="18" fill="white"/>
  </svg>`;
  const textOverlay = new Resvg(svg, { font: { loadSystemFonts: false, fontFiles: [ensureEmbeddedFont()], defaultFontFamily: "Geist" } }).render().asPng();
  const qr = await qrToBuffer(input.referralUrl, { type: "png", width: qrSize, margin: 1, errorCorrectionLevel: "M", color: { dark: "#07111f", light: "#ffffff" } });
  const buffer = await sharp(background).composite([{ input: textOverlay, blend: "over" }, { input: qr, left: qrLeft, top: Math.round(cardY + (cardHeight - qrSize) / 2), blend: "over" }]).png().toBuffer();
  return { buffer, ...dimensions, mimeType: "image/png" };
}
