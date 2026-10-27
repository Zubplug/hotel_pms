-- A selectable modifier is optional. Its stock item must not also be part of
-- the product's unconditional base recipe, otherwise unselected options are
-- produced and deducted automatically.
-- Normalize legacy combo swallow modifiers before removing their duplicated
-- recipe ingredients. This also repairs old records that were created without
-- a group or stock mapping.
UPDATE "PosProductModifier" pm
SET "name" = trim(regexp_replace(pm."name", '^Swallow:[[:space:]]*', '', 'i')),
    "groupName" = 'Choose Swallow',
    "groupRequired" = true,
    "groupMaxSelect" = 1,
    "stockItemId" = (
      SELECT si.id FROM "StockItem" si
      WHERE si."propertyId" = p."propertyId"
        AND (lower(si."name") = lower(trim(regexp_replace(pm."name", '^Swallow:[[:space:]]*', '', 'i')))
          OR lower(si."name") = lower(trim(regexp_replace(pm."name", '^Swallow:[[:space:]]*', '', 'i'))) || ' flour')
      LIMIT 1
    ),
    "quantity" = 0.2000,
    "unitOfMeasure" = 'KG'
FROM "PosProduct" p
WHERE pm."productId" = p.id
  AND p."name" ILIKE '%combo%'
  AND pm."name" ILIKE 'Swallow:%'
  AND EXISTS (
    SELECT 1 FROM "StockItem" si
    WHERE si."propertyId" = p."propertyId"
      AND (lower(si."name") = lower(trim(regexp_replace(pm."name", '^Swallow:[[:space:]]*', '', 'i')))
      OR lower(si."name") = lower(trim(regexp_replace(pm."name", '^Swallow:[[:space:]]*', '', 'i'))) || ' flour')
  );

-- Prefer the property's active kitchen/template stock item for the standard
-- combo swallow options. Outlet-specific stock records can have different
-- units (for example PACK) or be inactive, which makes modifier deduction
-- diverge from the recipe and from the offline POS projection.
UPDATE "PosProductModifier" pm
SET "stockItemId" = canonical.id,
    "quantity" = 0.2000,
    "unitOfMeasure" = 'KG',
    "groupName" = 'Choose Swallow',
    "groupRequired" = true,
    "groupMaxSelect" = 1
FROM "PosProduct" p
JOIN LATERAL (
  SELECT si.id
  FROM "StockItem" si
  JOIN "Warehouse" w ON w.id = si."warehouseId"
  WHERE si."propertyId" = p."propertyId"
    AND si."isActive" = true
    AND w."isActive" = true
    AND w."name" ILIKE '%kitchen%'
    AND lower(si."name") = lower(trim(pm."name"))
    AND si."baseUnit" = 'KG'
  ORDER BY si."updatedAt" DESC
  LIMIT 1
) canonical ON true
WHERE pm."productId" = p.id
  AND p."name" ILIKE '%combo%'
  AND lower(trim(pm."name")) IN ('garri', 'semo', 'plantain flour');

-- Pool Bar carries the same selectable swallow catalogue as the restaurant.
-- Enable the existing options before removing the old fixed-Garri recipe row.
UPDATE "PosProductModifier" pm
SET "isActive" = true
FROM "PosProduct" p
JOIN "ProductCategory" c ON c.id = p."categoryId"
JOIN "PosOutlet" o ON o.id = c."outletId"
WHERE pm."productId" = p.id
  AND o."name" ILIKE '%POOL BAR%'
  AND p."name" ILIKE '%combo%'
  AND pm."groupName" = 'Choose Swallow';

DELETE FROM "RecipeIngredient" ri
USING "RecipeVersion" rv, "Recipe" r, "PosProductModifier" pm
WHERE ri."recipeVersionId" = rv.id
  AND rv."recipeId" = r.id
  AND rv."isActive" = true
  AND r."posProductId" = pm."productId"
  AND pm."isActive" = true
  AND pm."stockItemId" IS NOT NULL
  AND ri."stockItemId" = pm."stockItemId";
