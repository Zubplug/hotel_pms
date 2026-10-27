type ModifierRecord = {
  id: string;
  name: string;
  price: unknown;
  isActive?: boolean;
  stockItemId?: string | null;
  quantity?: unknown;
  unitOfMeasure?: string | null;
  groupName?: string | null;
  groupRequired?: boolean;
  groupMaxSelect?: number | null;
};

type RequestedModifier = {
  id?: string;
  name?: string;
};

/**
 * Resolve client modifier selections against the live product projection.
 * Prices, stock mappings, and group rules must always come from the server.
 */
export function resolveSelectedModifiers(
  product: { name?: string; modifiers?: ModifierRecord[] },
  requested: RequestedModifier[] | null | undefined,
) {
  const available = (product.modifiers || []).filter((modifier) => modifier.isActive !== false);
  const selections = Array.isArray(requested) ? requested : [];
  const selected: ModifierRecord[] = [];
  const selectedIds = new Set<string>();

  for (const input of selections) {
    const inputId = typeof input?.id === 'string' ? input.id : '';
    const inputName = typeof input?.name === 'string' ? input.name.trim().toLowerCase() : '';
    const modifier = available.find((candidate) =>
      (inputId && candidate.id === inputId) ||
      (!inputId && inputName && candidate.name.trim().toLowerCase() === inputName),
    );
    if (!modifier) throw new Error(`INVALID_MODIFIER: ${input.name || input.id || 'unknown option'} is not active for ${product.name || 'this item'}`);
    if (selectedIds.has(modifier.id)) throw new Error(`DUPLICATE_MODIFIER: ${modifier.name}`);
    selectedIds.add(modifier.id);
    selected.push(modifier);
  }

  const groups = new Map<string, ModifierRecord[]>();
  for (const modifier of available) {
    if (!modifier.groupName) continue;
    const members = groups.get(modifier.groupName) || [];
    members.push(modifier);
    groups.set(modifier.groupName, members);
  }
  for (const [groupName, members] of groups) {
    const chosen = selected.filter((modifier) => modifier.groupName === groupName);
    const required = members.some((modifier) => modifier.groupRequired === true);
    if (required && chosen.length === 0) throw new Error(`REQUIRED_MODIFIER_GROUP: Select an option in ${groupName}`);
    const maxSelect = Math.max(...members.map((modifier) => Number(modifier.groupMaxSelect || 0)));
    if (maxSelect > 0 && chosen.length > maxSelect) throw new Error(`MODIFIER_GROUP_LIMIT: Choose at most ${maxSelect} option${maxSelect === 1 ? '' : 's'} in ${groupName}`);
  }

  return selected.map((modifier) => ({
    name: modifier.name,
    price: Number(modifier.price || 0),
    stockItemId: modifier.stockItemId || null,
    quantity: Number(modifier.quantity || 0),
    unitOfMeasure: modifier.unitOfMeasure || null,
  }));
}

export async function assertModifierStockIsNotBaseRecipeIngredient(
  db: any,
  productId: string,
  stockItemId: string | null | undefined,
) {
  if (!stockItemId) return;
  const overlap = await db.recipeIngredient.findFirst({
    where: {
      stockItemId,
      recipeVersion: {
        isActive: true,
        recipe: {
          posProductId: productId,
        },
      },
    },
    select: { id: true },
  });
  if (overlap) {
    throw new Error('MODIFIER_STOCK_OVERLAPS_RECIPE: Remove this stock item from the active base recipe before using it as a selectable modifier.');
  }
}
