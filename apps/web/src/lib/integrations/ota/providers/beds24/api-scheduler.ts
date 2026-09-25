import prisma from '@hotel-pms/db';
import { Beds24TokenManager } from './token-manager';
import crypto from 'crypto';

const BEDS24_API_URL = 'https://api.beds24.com/v2';
const MINIMUM_CREDITS_THRESHOLD = 5;

export class Beds24RateLimitError extends Error {
  constructor(public resetSeconds: number) {
    super(`Beds24 API rate limit reached. Reset in ${resetSeconds} seconds.`);
    this.name = 'Beds24RateLimitError';
  }
}

export class Beds24AccountApiScheduler {
  /**
   * Executes a Beds24 API call safely, ensuring:
   * 1. Only 1 request runs at a time per account (via PG advisory locks).
   * 2. It tracks available credits and throws a RateLimitError if too low, letting QStash handle the retry.
   */
  static async execute<T>(
    accountId: string,
    encryptedRefreshToken: string,
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Generate a consistent 32-bit integer for the advisory lock based on the accountId
    const hash = crypto.createHash('md5').update(accountId).digest();
    const lockId = hash.readInt32BE(0);

    // We use a Prisma transaction to hold an advisory lock for the duration of the API call.
    // By using `pg_advisory_xact_lock` (blocking), concurrent requests for the same account will queue up here.
    return prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId}::int4)`;

        const token = await Beds24TokenManager.getAccessToken(encryptedRefreshToken);

        const headers = {
          'token': token,
          'Content-Type': 'application/json',
          ...options.headers,
        };

        const response = await fetch(`${BEDS24_API_URL}${endpoint}`, {
          ...options,
          headers,
        });

        const creditsRemaining = parseInt(response.headers.get('x-api-credits') || '100', 10);
        const resetSeconds = parseInt(response.headers.get('x-api-reset') || '300', 10);

        if (response.status === 429 || creditsRemaining < MINIMUM_CREDITS_THRESHOLD) {
          throw new Beds24RateLimitError(resetSeconds);
        }

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Beds24 API Error (${response.status}): ${errorText}`);
        }

        // Return void if 204 No Content
        if (response.status === 204) {
          return {} as T;
        }

        return (await response.json()) as T;
      },
      {
        timeout: 10000, // 10 seconds max lock hold time
      }
    );
  }
}
