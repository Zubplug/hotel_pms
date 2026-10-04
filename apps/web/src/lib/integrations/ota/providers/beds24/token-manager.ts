import { encryptCredentials, decryptCredentials } from '../../crypto';
import { decrypt } from '@hotel-pms/db';
import crypto from 'crypto';

const BEDS24_API_URL = 'https://api.beds24.com/v2';

interface AccessTokenResponse {
  token: string;
  expiresIn: number; // Seconds
}

interface SetupResponse {
  token: string;
  refreshToken: string;
  expiresIn: number;
}

interface StoredCredentials {
  mode?: 'RESELLER';
  propertyId?: string;
  refreshToken?: string;
  webhookSecret?: string;
}

// In-memory cache for access tokens: refreshToken -> { token, expiresAt }
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

export class Beds24TokenManager {
  private static getCredentials(encryptedCredentials: string): StoredCredentials {
    try {
      const payload = JSON.parse(encryptedCredentials);
      if (payload?.iv && payload?.content && payload?.authTag) {
        return JSON.parse(decrypt(payload)) as StoredCredentials;
      }
    } catch {
      // Fall through to the legacy OTA_ENCRYPTION_KEY format.
    }
    const decrypted = decryptCredentials(encryptedCredentials);
    try { return JSON.parse(decrypted) as StoredCredentials; } catch { return { refreshToken: decrypted }; }
  }

  static isResellerConnection(encryptedCredentials: string): boolean {
    return this.getCredentials(encryptedCredentials).mode === 'RESELLER';
  }

  static getOrganizationToken(encryptedCredentials: string): string | undefined {
    if (!this.isResellerConnection(encryptedCredentials)) return undefined;
    return process.env.BEDS24_ORGANIZATION_TOKEN;
  }

  private static getRefreshToken(encryptedRefreshToken: string): string {
    const credentials = this.getCredentials(encryptedRefreshToken);
    if (credentials.mode === 'RESELLER') throw new Error('Reseller connections do not use refresh tokens.');
    return credentials.refreshToken || decryptCredentials(encryptedRefreshToken);
  }

  static getAccountKey(encryptedRefreshToken: string): string {
    const credentials = this.getCredentials(encryptedRefreshToken);
    if (credentials.mode === 'RESELLER' && credentials.propertyId) {
      return crypto.createHash('sha256').update(`BEDS24_RESELLER:${credentials.propertyId}`).digest('hex').slice(0, 32);
    }
    const refreshToken = this.getRefreshToken(encryptedRefreshToken);
    return crypto.createHash('sha256').update(refreshToken).digest('hex').slice(0, 32);
  }
  /**
   * Exchanges an invite code for a long-lived refresh token.
   * This is typically called once during the channel connection setup in the UI.
   */
  static async exchangeInviteCode(inviteCode: string): Promise<string> {
    const response = await fetch(`${BEDS24_API_URL}/authentication/setup`, {
      method: 'GET',
      headers: {
        'inviteCode': inviteCode,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to exchange invite code: ${response.statusText}`);
    }

    const data = (await response.json()) as SetupResponse;
    
    // Beds24 returns both a 24-hr token and a 30-day refresh token.
    // We only need to persist the refresh token as the source of truth.
    // We can opportunistically cache the returned access token immediately.
    this.cacheToken(data.refreshToken, data.token, data.expiresIn);

    return encryptCredentials(data.refreshToken);
  }

  /**
   * Returns a valid access token.
   * If a cached token exists and is valid, it returns it to save API credits.
   * Otherwise, it exchanges the refresh token for a new access token.
   */
  static async getAccessToken(encryptedRefreshToken: string): Promise<string> {
    const credentials = this.getCredentials(encryptedRefreshToken);
    if (credentials.mode === 'RESELLER') {
      const accessToken = process.env.BEDS24_ACCESS_TOKEN;
      if (!accessToken || !credentials.propertyId) throw new Error('Beds24 reseller access is not configured for this property.');
      return `${accessToken}:p${credentials.propertyId}`;
    }
    const refreshToken = this.getRefreshToken(encryptedRefreshToken);
    
    const cached = tokenCache.get(refreshToken);
    // Buffer of 5 minutes (300000ms) to ensure we don't return a token that's about to expire
    if (cached && cached.expiresAt > Date.now() + 300000) {
      return cached.token;
    }

    // Fetch new access token
    const response = await fetch(`${BEDS24_API_URL}/authentication/token`, {
      method: 'GET',
      headers: {
        'refreshToken': refreshToken,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh Beds24 access token: ${response.statusText}`);
    }

    const data = (await response.json()) as AccessTokenResponse;
    
    this.cacheToken(refreshToken, data.token, data.expiresIn);

    return data.token;
  }

  /**
   * Caches an access token in memory.
   */
  private static cacheToken(refreshToken: string, token: string, expiresInSeconds: number) {
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    tokenCache.set(refreshToken, { token, expiresAt });
  }

  /**
   * Optional: Deletes a refresh token from Beds24 when a property disconnects.
   */
  static async revokeRefreshToken(encryptedRefreshToken: string): Promise<void> {
    try {
      const refreshToken = this.getRefreshToken(encryptedRefreshToken);
      await fetch(`${BEDS24_API_URL}/authentication/token`, {
        method: 'DELETE',
        headers: {
          'refreshToken': refreshToken,
        },
      });
      tokenCache.delete(refreshToken);
    } catch (e) {
      console.warn('Failed to revoke Beds24 refresh token', e);
    }
  }
}
