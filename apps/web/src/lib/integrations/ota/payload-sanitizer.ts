export const PayloadSanitizer = {
  /**
   * Deeply sanitizes an object before it is stored in the database.
   * Strips out raw credit card numbers, CVVs, tokens, and bounding size.
   */
  sanitizeForDatabase(data: any): string {
    if (!data) return '';
    
    try {
      const stringified = JSON.stringify(data);
      
      // Bound the payload size to prevent DB bloat (e.g. 100KB limit)
      if (stringified.length > 100000) {
        return JSON.stringify({ error: 'Payload exceeded 100KB size limit, truncated for safety.' });
      }

      // Redact credit cards (very basic Regex for 13-19 digit sequences)
      const withoutCards = stringified.replace(/\b(?:\d[ -]*?){13,19}\b/g, '"[REDACTED_CARD]"');
      // Redact CVV
      const withoutCvv = withoutCards.replace(/"cvv"\s*:\s*"\d{3,4}"/gi, '"cvv":"[REDACTED_CVV]"');
      // Redact Authorization headers or tokens
      const withoutTokens = withoutCvv.replace(/"(authorization|token|password)"\s*:\s*"[^"]+"/gi, '"$1":"[REDACTED]"');
      
      return withoutTokens;
    } catch (e) {
      return JSON.stringify({ error: 'Failed to sanitize payload' });
    }
  }
};
