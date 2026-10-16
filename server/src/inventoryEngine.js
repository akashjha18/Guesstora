import { Op } from 'sequelize';
import { InventoryItem, RecipeItem, StockLedger, MenuItem } from './models.js';
import { broadcastEvent } from './eventBus.js';

/**
 * Standard unit converter for culinary and café inventory
 */
export function normalizeQuantity(quantity, fromUnit, toUnit) {
  const from = String(fromUnit || '').toLowerCase().trim();
  const to = String(toUnit || '').toLowerCase().trim();
  const q = Number(quantity) || 0;

  if (from === to) return q;

  // Weight (grams <-> kilograms)
  if (from === 'g' && to === 'kg') return q / 1000;
  if (from === 'kg' && to === 'g') return q * 1000;

  // Volume (millilitres <-> litres)
  if (from === 'ml' && to === 'l') return q / 1000;
  if (from === 'l' && to === 'ml') return q * 1000;

  // Count / default
  return q;
}

/**
 * Determine stock status
 */
export function calculateStockStatus(currentStock, lowStockThreshold) {
  const stock = Number(currentStock) || 0;
  const threshold = Number(lowStockThreshold) || 0;

  if (stock <= 0) return 'out_of_stock';
  if (stock <= threshold) return 'low_stock';
  return 'in_stock';
}

/**
 * Calculate recipe cost (COGS) based on ingredient unit costs
 */
export function calculateRecipeCost(recipeItems = [], inventoryItems = []) {
  const invMap = new Map();
  inventoryItems.forEach(i => invMap.set(i.id, i));

  let totalCost = 0;
  const ingredientBreakdown = [];

  for (const r of recipeItems) {
    const inv = invMap.get(r.inventoryItemId) || r.ingredient;
    if (!inv) continue;

    const convertedQty = normalizeQuantity(r.quantityRequired, r.unit, inv.unit);
    const cost = Number((convertedQty * (Number(inv.costPerUnit) || 0)).toFixed(2));
    totalCost += cost;

    ingredientBreakdown.push({
      recipeItemId: r.id,
      ingredientId: inv.id,
      ingredientName: inv.name,
      quantityRequired: r.quantityRequired,
      unit: r.unit,
      convertedQuantity: convertedQty,
      inventoryUnit: inv.unit,
      costPerUnit: Number(inv.costPerUnit) || 0,
      cost,
    });
  }

  return {
    totalCost: Number(totalCost.toFixed(2)),
    ingredientBreakdown,
  };
}

/**
 * Check if a menu item has any out-of-stock ingredients
 */
export async function checkMenuItemStockAvailability(menuItemId, cafeId) {
  const recipes = await RecipeItem.findAll({
    where: { menuItemId, cafeId },
    include: [{ model: InventoryItem, as: 'ingredient' }],
  });

  if (!recipes.length) return true;

  for (const r of recipes) {
    const ing = r.ingredient;
    if (!ing) continue;
    const neededInIngUnit = normalizeQuantity(r.quantityRequired, r.unit, ing.unit);
    if ((Number(ing.currentStock) || 0) < neededInIngUnit) {
      return false; // Out of stock for this item
    }
  }
  return true;
}

/**
 * Auto-86: Mark menu items unavailable if any required ingredient is out of stock.
 * Auto-Restore: Mark menu items available if all required ingredients have stock.
 */
export async function syncMenuItemAvailability(cafeId, inventoryItemId) {
  const recipes = await RecipeItem.findAll({
    where: { cafeId, inventoryItemId },
    attributes: ['menuItemId'],
  });

  const menuItemIds = [...new Set(recipes.map(r => r.menuItemId))];
  const affected = [];

  for (const mId of menuItemIds) {
    const menuItem = await MenuItem.findOne({ where: { id: mId, cafeId } });
    if (!menuItem) continue;

    const isAvailable = await checkMenuItemStockAvailability(mId, cafeId);
    if (menuItem.available !== isAvailable) {
      menuItem.available = isAvailable;
      await menuItem.save();
      affected.push({ id: menuItem.id, name: menuItem.name, available: isAvailable });
    }
  }

  if (affected.length > 0) {
    broadcastEvent(cafeId, 'menu_updated', { affectedItems: affected });
  }

  return affected;
}

/**
 * Deplete inventory according to recipes when an order is placed/confirmed
 */
export async function depleteInventoryForOrder({ order, cafeId, staffName = 'POS Automated System' }) {
  if (!order || !order.items || !order.items.length) {
    return { depleted: [], triggered86: [] };
  }

  const depleted = [];
  const triggered86 = [];

  for (const item of order.items) {
    const recipes = await RecipeItem.findAll({
      where: {
        cafeId,
        menuItemId: item.menuItemId,
      },
      include: [{ model: InventoryItem, as: 'ingredient' }],
    });

    if (!recipes.length) continue;

    const variantName = item.selectedVariant?.name || null;

    for (const recipe of recipes) {
      // If recipe is variant-specific, ensure match
      if (recipe.variantName && variantName && recipe.variantName !== variantName) {
        continue;
      }

      const ing = recipe.ingredient;
      if (!ing) continue;

      const singleDeductInIngUnit = normalizeQuantity(recipe.quantityRequired, recipe.unit, ing.unit);
      const totalDeduct = singleDeductInIngUnit * (Number(item.quantity) || 1);

      const stockBefore = Number(ing.currentStock) || 0;
      const stockAfter = Math.max(0, Number((stockBefore - totalDeduct).toFixed(4)));

      ing.currentStock = stockAfter;
      ing.status = calculateStockStatus(stockAfter, ing.lowStockThreshold);
      await ing.save();

      await StockLedger.create({
        cafeId,
        inventoryItemId: ing.id,
        changeType: 'order_consumption',
        quantityDelta: -totalDeduct,
        stockBefore,
        stockAfter,
        referenceId: String(order.orderNo || order.id),
        notes: `Order #${order.orderNo || ''} — ${item.name} x${item.quantity}`,
        recordedBy: staffName,
      });

      depleted.push({
        ingredientId: ing.id,
        ingredientName: ing.name,
        deducted: totalDeduct,
        unit: ing.unit,
        remaining: stockAfter,
        status: ing.status,
      });

      // If depleted to 0 or below threshold, sync availability
      const affected = await syncMenuItemAvailability(cafeId, ing.id);
      if (affected.some(a => !a.available)) {
        triggered86.push(...affected.filter(a => !a.available));
      }
    }
  }

  if (depleted.length > 0) {
    broadcastEvent(cafeId, 'inventory_updated', { depleted, triggered86 });
  }

  return { depleted, triggered86 };
}

/**
 * Restore inventory when an order is cancelled or voided
 */
export async function restoreInventoryForOrder({ order, cafeId, staffName = 'POS Automated System' }) {
  if (!order || !order.items || !order.items.length) {
    return { restored: [] };
  }

  const restored = [];

  for (const item of order.items) {
    const recipes = await RecipeItem.findAll({
      where: {
        cafeId,
        menuItemId: item.menuItemId,
      },
      include: [{ model: InventoryItem, as: 'ingredient' }],
    });

    if (!recipes.length) continue;

    const variantName = item.selectedVariant?.name || null;

    for (const recipe of recipes) {
      if (recipe.variantName && variantName && recipe.variantName !== variantName) {
        continue;
      }

      const ing = recipe.ingredient;
      if (!ing) continue;

      const singleDeductInIngUnit = normalizeQuantity(recipe.quantityRequired, recipe.unit, ing.unit);
      const totalRestore = singleDeductInIngUnit * (Number(item.quantity) || 1);

      const stockBefore = Number(ing.currentStock) || 0;
      const stockAfter = Number((stockBefore + totalRestore).toFixed(4));

      ing.currentStock = stockAfter;
      ing.status = calculateStockStatus(stockAfter, ing.lowStockThreshold);
      await ing.save();

      await StockLedger.create({
        cafeId,
        inventoryItemId: ing.id,
        changeType: 'order_cancellation_restore',
        quantityDelta: totalRestore,
        stockBefore,
        stockAfter,
        referenceId: String(order.orderNo || order.id),
        notes: `Cancellation of Order #${order.orderNo || ''} — ${item.name} x${item.quantity}`,
        recordedBy: staffName,
      });

      restored.push({
        ingredientId: ing.id,
        ingredientName: ing.name,
        restored: totalRestore,
        unit: ing.unit,
        remaining: stockAfter,
        status: ing.status,
      });

      await syncMenuItemAvailability(cafeId, ing.id);
    }
  }

  if (restored.length > 0) {
    broadcastEvent(cafeId, 'inventory_updated', { restored });
  }

  return { restored };
}

/**
 * Restock an inventory ingredient
 */
export async function restockInventoryItem({ cafeId, inventoryItemId, quantityAdded, costPerUnit, notes, staffName }) {
  const ing = await InventoryItem.findOne({
    where: { id: inventoryItemId, cafeId },
  });
  if (!ing) throw new Error('Inventory ingredient not found.');

  const added = Number(quantityAdded) || 0;
  if (added <= 0) throw new Error('Quantity added must be greater than 0.');

  const stockBefore = Number(ing.currentStock) || 0;
  const stockAfter = Number((stockBefore + added).toFixed(4));

  ing.currentStock = stockAfter;
  if (costPerUnit !== undefined && Number(costPerUnit) > 0) {
    ing.costPerUnit = Number(costPerUnit);
  }
  ing.status = calculateStockStatus(stockAfter, ing.lowStockThreshold);
  await ing.save();

  const ledger = await StockLedger.create({
    cafeId,
    inventoryItemId: ing.id,
    changeType: 'purchase_restock',
    quantityDelta: added,
    stockBefore,
    stockAfter,
    notes: notes || 'Supplier delivery restock',
    recordedBy: staffName || 'Manager',
  });

  // Re-check menu availability now that ingredient has restocked
  const restoredMenuItems = await syncMenuItemAvailability(cafeId, ing.id);

  broadcastEvent(cafeId, 'inventory_updated', {
    action: 'restock',
    item: ing,
    ledger,
    restoredMenuItems,
  });

  return { item: ing, ledger, restoredMenuItems };
}

/**
 * Log wastage or spoilage
 */
export async function logInventoryWastage({ cafeId, inventoryItemId, quantityWasted, reason, staffName }) {
  const ing = await InventoryItem.findOne({
    where: { id: inventoryItemId, cafeId },
  });
  if (!ing) throw new Error('Inventory ingredient not found.');

  const wasted = Number(quantityWasted) || 0;
  if (wasted <= 0) throw new Error('Quantity wasted must be greater than 0.');

  const stockBefore = Number(ing.currentStock) || 0;
  const stockAfter = Math.max(0, Number((stockBefore - wasted).toFixed(4)));

  ing.currentStock = stockAfter;
  ing.status = calculateStockStatus(stockAfter, ing.lowStockThreshold);
  await ing.save();

  const ledger = await StockLedger.create({
    cafeId,
    inventoryItemId: ing.id,
    changeType: 'waste_spoilage',
    quantityDelta: -wasted,
    stockBefore,
    stockAfter,
    notes: reason || 'Spoilage / Spill / Expired batch',
    recordedBy: staffName || 'Staff',
  });

  const affectedMenuItems = await syncMenuItemAvailability(cafeId, ing.id);

  broadcastEvent(cafeId, 'inventory_updated', {
    action: 'waste',
    item: ing,
    ledger,
    affectedMenuItems,
  });

  return { item: ing, ledger, affectedMenuItems };
}
