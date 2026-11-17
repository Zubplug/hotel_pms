import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const region = process.env.AWS_REGION || "eu-north-1";
const bucket = process.env.S3_BUCKET || process.env.AWS_S3_BUCKET;
const publicBaseUrl = (process.env.S3_PUBLIC_BASE_URL || "").replace(/\/$/, "");

const client = new S3Client({
  region,
  ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true } : {}),
});

function requireBucket() {
  if (!bucket) throw new Error("S3_BUCKET is not configured");
  return bucket;
}

function encodeKey(key: string) {
  return key.split("/").map(encodeURIComponent).join("/");
}

export function publicObjectUrl(key: string) {
  if (publicBaseUrl) return `${publicBaseUrl}/${encodeKey(key)}`;
  return directObjectUrl(key);
}

function directObjectUrl(key: string) {
  return `https://${requireBucket()}.s3.${region}.amazonaws.com/${encodeKey(key)}`;
}

export function keyFromStoredUrl(value: string) {
  try {
    const url = new URL(value);
    if (publicBaseUrl && value.startsWith(`${publicBaseUrl}/`)) return decodeURIComponent(value.slice(publicBaseUrl.length + 1));
    const host = url.hostname;
    const bucketName = requireBucket();
    const virtualHost = `${bucketName}.s3.${region}.amazonaws.com`;
    if (host === virtualHost || host === `${bucketName}.s3.amazonaws.com`) return decodeURIComponent(url.pathname.slice(1));
  } catch {
    // Stored URLs from Vercel or user-provided policy URLs are not managed by S3.
  }
  return null;
}

export async function uploadObject(input: {
  key: string;
  body: Uint8Array | Buffer;
  contentType: string;
  visibility?: "public" | "private";
}) {
  await client.send(new PutObjectCommand({
    Bucket: requireBucket(),
    Key: input.key,
    Body: input.body,
    ContentType: input.contentType || "application/octet-stream",
    CacheControl: input.visibility === "public" ? "public, max-age=31536000, immutable" : "private, no-store",
    ...(input.visibility === "private" ? { ServerSideEncryption: "AES256" } : {}),
  }));
  return { key: input.key, url: input.visibility === "private" ? directObjectUrl(input.key) : publicObjectUrl(input.key) };
}

export async function signedDownloadUrl(storedUrl: string, expiresIn = 300) {
  const key = keyFromStoredUrl(storedUrl);
  if (!key) return storedUrl;
  return getSignedUrl(client, new GetObjectCommand({ Bucket: requireBucket(), Key: key }), { expiresIn });
}

export async function deleteStoredObject(storedUrl: string) {
  const key = keyFromStoredUrl(storedUrl);
  if (!key) return false;
  await client.send(new DeleteObjectCommand({ Bucket: requireBucket(), Key: key }));
  return true;
}
