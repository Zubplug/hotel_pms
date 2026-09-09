import { createHash } from 'crypto';

export function generateStockSku(seed: string) {
  return `STK-${seed.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12).toUpperCase()}`;
}

export function generateStockBarcode(propertyId: string, seed: string, attempt = 0) {
  const digest = createHash('sha256')
    .update(`${propertyId}:${seed}:${attempt}`)
    .digest('hex');
  const numeric = BigInt(`0x${digest.slice(0, 12)}`) % 100_000_000_000n;
  return `2${numeric.toString().padStart(11, '0')}`;
}
