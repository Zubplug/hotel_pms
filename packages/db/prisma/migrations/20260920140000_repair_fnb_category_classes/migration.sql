-- Repair legacy POS category classifications that were left at OTHER.
-- FOOD and BEVERAGE are the only two F&B revenue classes; recreation/pool
-- categories remain OTHER and are handled by the recreation revenue mapping.
-- This changes classification metadata only. It does not rewrite posted GL.

UPDATE "ProductCategory"
SET "fnbClass" = 'BEVERAGE'::"FnbClass",
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "fnbClass" = 'OTHER'::"FnbClass"
  AND (
    "name" ILIKE '%beer%'
    OR "name" ILIKE '%cider%'
    OR "name" ILIKE '%liqueur%'
    OR "name" ILIKE '%spirit%'
    OR "name" ILIKE '%whiskey%'
    OR "name" ILIKE '%brandy%'
    OR "name" ILIKE '%gin%'
    OR "name" ILIKE '%vodka%'
    OR "name" ILIKE '%wine%'
    OR "name" ILIKE '%champagne%'
    OR "name" ILIKE '%soft drink%'
    OR "name" ILIKE '%water%'
    OR "name" ILIKE '%malt%'
    OR "name" ILIKE '%juice%'
    OR "name" ILIKE '%cocktail%'
    OR "name" ILIKE '%drink%'
  );

UPDATE "ProductCategory"
SET "fnbClass" = 'FOOD'::"FnbClass",
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "fnbClass" = 'OTHER'::"FnbClass"
  AND (
    "name" ILIKE '%breakfast%'
    OR "name" ILIKE '%rice%'
    OR "name" ILIKE '%pasta%'
    OR "name" ILIKE '%starter%'
    OR "name" ILIKE '%main course%'
    OR "name" ILIKE '%salad%'
    OR "name" ILIKE '%dessert%'
    OR "name" ILIKE '%snack%'
    OR "name" ILIKE '%extra%'
    OR "name" ILIKE '%side%'
    OR "name" ILIKE '%pepper soup%'
  );
