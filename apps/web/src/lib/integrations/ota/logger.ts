export const OTALogger = {
  /**
   * Logs a structured OTA event with PII/PCI redaction.
   */
  info(event: string, meta: Record<string, any>) {
    const safeMeta = this.redactSensitiveInfo(meta);
    console.log(JSON.stringify({
      level: 'info',
      timestamp: new Date().toISOString(),
      event,
      ...safeMeta
    }));
  },

  error(event: string, error: any, meta?: Record<string, any>) {
    const safeMeta = meta ? this.redactSensitiveInfo(meta) : {};
    console.error(JSON.stringify({
      level: 'error',
      timestamp: new Date().toISOString(),
      event,
      error: error?.message || error,
      stack: error?.stack,
      ...safeMeta
    }));
  },

  warn(event: string, meta: Record<string, any>) {
    const safeMeta = this.redactSensitiveInfo(meta);
    console.warn(JSON.stringify({
      level: 'warn',
      timestamp: new Date().toISOString(),
      event,
      ...safeMeta
    }));
  },

  /**
   * Redacts sensitive PCI/PII data before logging
   */
  redactSensitiveInfo(data: any): any {
    if (!data) return data;
    
    try {
      const stringified = JSON.stringify(data);
      // Redact credit cards (very basic Regex for 13-19 digit sequences)
      const withoutCards = stringified.replace(/\b(?:\d[ -]*?){13,19}\b/g, '"[REDACTED_CARD]"');
      // Redact CVV
      const withoutCvv = withoutCards.replace(/"cvv"\s*:\s*"\d{3,4}"/gi, '"cvv":"[REDACTED_CVV]"');
      // Redact Authorization headers or tokens
      const withoutTokens = withoutCvv.replace(/"(authorization|token|password)"\s*:\s*"[^"]+"/gi, '"$1":"[REDACTED]"');
      
      return JSON.parse(withoutTokens);
    } catch (e) {
      return { error: 'Failed to redact payload, dropping for safety.' };
    }
  }
};
