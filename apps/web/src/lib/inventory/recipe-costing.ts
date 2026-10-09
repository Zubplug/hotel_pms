type StockUnit = { unit: string; unitsInBase: unknown };
type CostStockItem = { name: string; baseUnit: string; costPrice: unknown; stockUnits?: StockUnit[] };
type RecipeIngredient = { stockItem: CostStockItem; quantity: unknown; unitOfMeasure: string };
type RecipeVersion = { isActive?: boolean; ingredients?: RecipeIngredient[] };
type RecipeForCosting = { versions?: RecipeVersion[] };
type ModifierForCosting = { isActive?: boolean; name: string; quantity?: unknown; unitOfMeasure?: string | null; stockItem?: CostStockItem | null };

export function stockUnitMultiplier(item: CostStockItem, unit: string) {
  if (unit === item.baseUnit) return 1;
  const discrete = new Set(['UNIT', 'EACH', 'PIECE']);
  if (discrete.has(unit) && discrete.has(item.baseUnit)) return 1;
  const conversion = item.stockUnits?.find(candidate => candidate.unit === unit);
  const multiplier = Number(conversion?.unitsInBase || 0);
  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    throw new Error(`Missing conversion from ${unit} to ${item.baseUnit} for ${item.name}`);
  }
  return multiplier;
}

export function requirePositiveCost(item: CostStockItem) {
  const cost = Number(item.costPrice || 0);
  if (!Number.isFinite(cost) || cost <= 0) throw new Error(`Cost pending for ${item.name}`);
  return cost;
}

export function calculateRecipeCost(recipe: RecipeForCosting | null | undefined, modifiers: ModifierForCosting[] = []) {
  const ingredients = recipe?.versions?.find(version => version.isActive)?.ingredients || recipe?.versions?.[0]?.ingredients || [];
  const ingredientDetails = ingredients.map(ingredient => {
    const multiplier = stockUnitMultiplier(ingredient.stockItem, ingredient.unitOfMeasure);
    const quantity = Number(ingredient.quantity) * multiplier;
    return { kind: 'ingredient', name: ingredient.stockItem.name, quantity, unit: ingredient.stockItem.baseUnit, cost: quantity * requirePositiveCost(ingredient.stockItem) };
  });
  const modifierDetails = modifiers.filter(modifier => modifier.isActive !== false && modifier.stockItem).map(modifier => {
    const stockItem = modifier.stockItem!;
    const unit = modifier.unitOfMeasure || stockItem.baseUnit;
    const quantity = Number(modifier.quantity || 0) * stockUnitMultiplier(stockItem, unit);
    return { kind: 'modifier', name: modifier.name, quantity, unit: stockItem.baseUnit, cost: quantity * requirePositiveCost(stockItem) };
  });
  const details = [...ingredientDetails, ...modifierDetails];
  return { cost: details.reduce((sum, item) => sum + item.cost, 0), details };
}
