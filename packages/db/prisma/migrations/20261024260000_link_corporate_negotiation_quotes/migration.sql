-- Link negotiation requests to the immutable quote that initiated or resulted
-- from the review workflow. The relationships are nullable because staff
-- negotiations may still be submitted without an online quote.
ALTER TABLE "CorporateRateNegotiationRequest"
  ADD CONSTRAINT "CorporateRateNegotiationRequest_quoteId_fkey"
  FOREIGN KEY ("quoteId") REFERENCES "BookingQuote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CorporateRateNegotiationRequest"
  ADD CONSTRAINT "CorporateRateNegotiationRequest_approvedQuoteId_fkey"
  FOREIGN KEY ("approvedQuoteId") REFERENCES "BookingQuote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
