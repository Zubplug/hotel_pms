import { createHash } from 'crypto';

export function generateStockSku(seed: string) {
  return `STK-${seed.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12).toUpperCase()}`;
}

export function generateStockBarcode(propertyId: string, seed: string, attempt = 0) {
  const digest = createHash('sha256')
    .update(`${propertyId}:${seed}:${attempt}`)
    .digest('hex');
  // Keep this compatible with the web target (ES2017); BigInt literal syntax
  // requires ES2020 even though the BigInt constructor is available at runtime.
  const numeric = BigInt(`0x${digest.slice(0, 12)}`) % BigInt(100_000_000_000);
  return `2${numeric.toString().padStart(11, '0')}`;
}
