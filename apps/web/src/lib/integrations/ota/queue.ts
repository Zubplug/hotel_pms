import { Client } from '@upstash/qstash';

// Initialize QStash client. In development/offline mode, we can gracefully fallback.
const qstashClient = process.env.QSTASH_TOKEN 
  ? new Client({ token: process.env.QSTASH_TOKEN }) 
  : null;

export const QueuePublisher = {
  /**
   * Publishes an Outbox event to the queue for processing.
   * If QStash is not configured, logs a warning and skips (safe offline behavior).
   */
  async publishOutboxEvent(outboxEventId: string, delaySeconds: number = 0): Promise<boolean> {
    if (!qstashClient) {
      console.warn('[QueuePublisher] QSTASH_TOKEN not set. Running in offline/desktop mode. Event skipped:', outboxEventId);
      return false;
    }

    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://lodgecore.com';
      const endpoint = `${appUrl}/api/v1/webhooks/internal/process-outbox`;

      await qstashClient.publishJSON({
        url: endpoint,
        body: { outboxEventId },
        delay: delaySeconds,
        retries: 3, // Built-in Upstash exponential backoff
      });

      return true;
    } catch (error) {
      console.error('[QueuePublisher] Failed to publish to QStash:', error);
      return false;
    }
  },

  /**
   * Directly schedule an OTA outbound sync event (e.g. Rate or Availability Push).
   */
  async scheduleOtaSync(syncEventId: string, delaySeconds: number = 0): Promise<boolean> {
    if (!qstashClient) {
      console.warn('[QueuePublisher] QSTASH_TOKEN not set. Sync skipped:', syncEventId);
      return false;
    }

    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://lodgecore.com';
      const endpoint = `${appUrl}/api/v1/webhooks/internal/process-ota-sync`;

      await qstashClient.publishJSON({
        url: endpoint,
        body: { syncEventId },
        delay: delaySeconds,
        retries: 5,
      });

      return true;
    } catch (error) {
      console.error('[QueuePublisher] Failed to schedule OTA sync:', error);
      return false;
    }
  }
};
