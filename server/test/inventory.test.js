import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeQuantity,
  calculateStockStatus,
  calculateRecipeCost,
} from '../src/inventoryEngine.js';

test('normalizeQuantity correctly converts between culinary units', () => {
  // Same units
  assert.equal(normalizeQuantity(500, 'g', 'g'), 500);
  assert.equal(normalizeQuantity(2.5, 'kg', 'kg'), 2.5);

  // Grams to Kilograms
  assert.equal(normalizeQuantity(18, 'g', 'kg'), 0.018);
  assert.equal(normalizeQuantity(250, 'g', 'kg'), 0.25);

  // Kilograms to Grams
  assert.equal(normalizeQuantity(1.5, 'kg', 'g'), 1500);

  // Millilitres to Litres
  assert.equal(normalizeQuantity(180, 'ml', 'l'), 0.18);
  assert.equal(normalizeQuantity(200, 'ml', 'L'), 0.2);

  // Litres to Millilitres
  assert.equal(normalizeQuantity(2, 'L', 'ml'), 2000);

  // Count / pcs
  assert.equal(normalizeQuantity(1, 'pcs', 'pcs'), 1);
});

test('calculateStockStatus computes accurate threshold warnings', () => {
  assert.equal(calculateStockStatus(0, 2), 'out_of_stock');
  assert.equal(calculateStockStatus(-0.5, 2), 'out_of_stock');
  assert.equal(calculateStockStatus(1.5, 2), 'low_stock');
  assert.equal(calculateStockStatus(2.0, 2), 'low_stock');
  assert.equal(calculateStockStatus(2.1, 2), 'in_stock');
  assert.equal(calculateStockStatus(10, 2), 'in_stock');
});

test('calculateRecipeCost calculates precise COGS and margin breakdown', () => {
  const inventoryItems = [
    { id: 'inv-beans', name: 'Arabica Beans', unit: 'kg', costPerUnit: 1200 }, // ₹1.20 / g
    { id: 'inv-milk', name: 'Whole Milk', unit: 'l', costPerUnit: 60 },        // ₹0.06 / ml
    { id: 'inv-cup', name: 'Paper Cup', unit: 'pcs', costPerUnit: 5 },          // ₹5.00 / pc
  ];

  const recipeItems = [
    { id: 'r1', inventoryItemId: 'inv-beans', quantityRequired: 18, unit: 'g' },
    { id: 'r2', inventoryItemId: 'inv-milk', quantityRequired: 180, unit: 'ml' },
    { id: 'r3', inventoryItemId: 'inv-cup', quantityRequired: 1, unit: 'pcs' },
  ];

  const { totalCost, ingredientBreakdown } = calculateRecipeCost(recipeItems, inventoryItems);

  // 18g beans @ 1200/kg = 0.018 * 1200 = 21.60
  // 180ml milk @ 60/l = 0.18 * 60 = 10.80
  // 1 cup @ 5 = 5.00
  // Total expected = 21.60 + 10.80 + 5.00 = 37.40
  assert.equal(totalCost, 37.40);
  assert.equal(ingredientBreakdown.length, 3);
  assert.equal(ingredientBreakdown[0].cost, 21.60);
  assert.equal(ingredientBreakdown[1].cost, 10.80);
  assert.equal(ingredientBreakdown[2].cost, 5.00);
});

test('recipe cost handles empty or missing ingredients gracefully', () => {
  const result = calculateRecipeCost([], []);
  assert.equal(result.totalCost, 0);
  assert.deepEqual(result.ingredientBreakdown, []);
});

test('stock calculation correctly identifies low stock alert lists', () => {
  const sampleStock = [
    { name: 'Oat Milk', currentStock: 1.0, lowStockThreshold: 2.0 },
    { name: 'Syrup', currentStock: 0, lowStockThreshold: 1.0 },
    { name: 'Coffee Beans', currentStock: 15.0, lowStockThreshold: 3.0 },
  ];

  const statuses = sampleStock.map(s => ({
    name: s.name,
    status: calculateStockStatus(s.currentStock, s.lowStockThreshold),
  }));

  assert.deepEqual(statuses, [
    { name: 'Oat Milk', status: 'low_stock' },
    { name: 'Syrup', status: 'out_of_stock' },
    { name: 'Coffee Beans', status: 'in_stock' },
  ]);
});
