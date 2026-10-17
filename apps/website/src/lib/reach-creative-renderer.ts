import sharp from "sharp";
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
  commissionBps: number;
  referralUrl: string;
  sourceUrl?: string | null;
}) {
  const dimensions = CREATIVE_TEMPLATES[input.template];
  const source = await sourceBuffer(input.sourceUrl);
  const propertyLines = wrap(input.propertyName);
  const titleSize = input.template === "STORY" ? 72 : 64;
  const background = source
    ? await sharp(source).resize(dimensions.width, dimensions.height, { fit: "cover", position: "attention" }).png().toBuffer()
    : await sharp({ create: { width: dimensions.width, height: dimensions.height, channels: 4, background: { r: 16, g: 24, b: 40, alpha: 1 } } }).png().toBuffer();
  const y = input.template === "STORY" ? 820 : Math.round(dimensions.height * 0.55);
  const svg = `<svg width="${dimensions.width}" height="${dimensions.height}" xmlns="http://www.w3.org/2000/svg">
    <style>@font-face{font-family:LodgeCoreSans;src:url(data:font/ttf;base64,${REACH_FONT_TTF_BASE64})} text{font-family:LodgeCoreSans}</style>
    <defs><linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#07111f" stop-opacity=".15"/><stop offset=".72" stop-color="#07111f" stop-opacity=".86"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#shade)"/>
    <text x="64" y="82" fill="#b9f5d0" font-family="LodgeCoreSans" font-size="28" font-weight="700" letter-spacing="4">LODGECORE REACH</text>
    <text x="64" y="${y}" fill="white" font-family="LodgeCoreSans" font-size="${titleSize}" font-weight="800">${escapeXml(propertyLines[0])}</text>
    ${propertyLines[1] ? `<text x="64" y="${y + titleSize + 12}" fill="white" font-family="LodgeCoreSans" font-size="${titleSize}" font-weight="800">${escapeXml(propertyLines[1])}</text>` : ""}
    <text x="64" y="${y + titleSize * (propertyLines.length === 2 ? 2 : 1) + 56}" fill="#e8fff0" font-family="LodgeCoreSans" font-size="30">${escapeXml(input.campaignName)}</text>
    <rect x="64" y="${dimensions.height - 220}" width="${dimensions.width - 128}" height="132" rx="24" fill="#06101dcc" stroke="#b9f5d0" stroke-opacity=".45"/>
    <text x="96" y="${dimensions.height - 166}" fill="#b9f5d0" font-family="LodgeCoreSans" font-size="28" font-weight="700">${(input.commissionBps / 100).toFixed(2)}% referral commission</text>
    <text x="96" y="${dimensions.height - 120}" fill="white" font-family="LodgeCoreSans" font-size="24">Book direct · ${escapeXml(input.referralUrl)}</text>
  </svg>`;
  const buffer = await sharp(background).composite([{ input: Buffer.from(svg), blend: "over" }]).png().toBuffer();
  return { buffer, ...dimensions, mimeType: "image/png" };
}
