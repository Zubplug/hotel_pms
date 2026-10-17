-- Older generated creatives were rendered before the bundle-safe font fix and
-- may contain missing-glyph boxes. They remain recoverable but must not appear
-- in the partner's approved library.
UPDATE "ReachCreativeAsset"
SET "status" = 'ARCHIVED', "updatedAt" = CURRENT_TIMESTAMP
WHERE "status" = 'APPROVED'
  AND "usageNotes" IN (
    'Deterministically rendered from approved LodgeCore data.',
    'Deterministically rendered from approved LodgeCore data · renderer v2.'
  );
