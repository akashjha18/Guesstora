import { Router } from 'express';
import { Op } from 'sequelize';
import { InventoryItem, RecipeItem, StockLedger, MenuItem, User } from '../models.js';
import { requireRole } from '../auth.js';
import { createAuditLog, getClientIp, getClientUserAgent } from '../audit.js';
import {
  calculateStockStatus,
  calculateRecipeCost,
  restockInventoryItem,
  logInventoryWastage,
  syncMenuItemAvailability,
} from '../inventoryEngine.js';
import {
  serializeInventoryItem,
  serializeRecipeItem,
  serializeStockLedger,
} from './serializers.js';

const router = Router();

// GET /owner/inventory/summary - KPI overview and low-stock alerts
router.get('/owner/inventory/summary', requireRole('owner', 'manager', 'cashier'), async (req, res) => {
  try {
    const items = await InventoryItem.findAll({
      where: { cafeId: req.auth.cafe, isActive: true },
      order: [['currentStock', 'ASC']],
    });

    const totalItems = items.length;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalValuation = 0;
    const lowStockAlerts = [];

    for (const item of items) {
      const stock = Number(item.currentStock) || 0;
      const cost = Number(item.costPerUnit) || 0;
      totalValuation += stock * cost;

      if (stock <= 0) {
        outOfStockCount++;
        lowStockAlerts.push(serializeInventoryItem(item));
      } else if (stock <= (Number(item.lowStockThreshold) || 0)) {
        lowStockCount++;
        lowStockAlerts.push(serializeInventoryItem(item));
      }
    }

    return res.json({
      totalItems,
      lowStockCount,
      outOfStockCount,
      totalValuation: Number(totalValuation.toFixed(2)),
      lowStockAlerts,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to fetch inventory summary.' });
  }
});

// GET /owner/inventory - List all inventory items with optional filtering
router.get('/owner/inventory', requireRole('owner', 'manager', 'cashier'), async (req, res) => {
  try {
    const { category, status, search } = req.query;
    const where = { cafeId: req.auth.cafe, isActive: true };

    if (category && category !== 'all') {
      where.category = category;
    }
    if (status && status !== 'all') {
      where.status = status;
    }
    if (search && search.trim()) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search.trim()}%` } },
        { sku: { [Op.like]: `%${search.trim()}%` } },
        { supplier: { [Op.like]: `%${search.trim()}%` } },
      ];
    }

    const items = await InventoryItem.findAll({
      where,
      order: [
        ['category', 'ASC'],
        ['name', 'ASC'],
      ],
    });

    return res.json(items.map(serializeInventoryItem));
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to fetch inventory items.' });
  }
});

// POST /owner/inventory - Create a new raw material / ingredient item
router.post('/owner/inventory', requireRole('owner', 'manager'), async (req, res) => {
  try {
    const { name, sku, category, currentStock, unit, lowStockThreshold, costPerUnit, supplier } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Ingredient name is required.' });
    }

    const initialStock = Math.max(0, Number(currentStock) || 0);
    const threshold = Math.max(0, Number(lowStockThreshold) || 1);
    const status = calculateStockStatus(initialStock, threshold);

    const item = await InventoryItem.create({
      cafeId: req.auth.cafe,
      name: name.trim(),
      sku: sku ? sku.trim().toUpperCase() : null,
      category: category || 'coffee',
      currentStock: initialStock,
      unit: unit || 'kg',
      lowStockThreshold: threshold,
      costPerUnit: Math.max(0, Number(costPerUnit) || 0),
      supplier: supplier ? supplier.trim() : null,
      status,
      isActive: true,
    });

    // Record initial stock ledger if opening stock > 0
    if (initialStock > 0) {
      const user = await User.findByPk(req.auth.sub);
      await StockLedger.create({
        cafeId: req.auth.cafe,
        inventoryItemId: item.id,
        changeType: 'purchase_restock',
        quantityDelta: initialStock,
        stockBefore: 0,
        stockAfter: initialStock,
        notes: 'Initial opening stock intake',
        recordedBy: user?.name || 'Manager',
      });
    }

    await createAuditLog({
      cafeId: req.auth.cafe,
      userId: req.auth.sub,
      userName: req.auth.name || 'Owner',
      userRole: req.auth.role,
      action: 'inventory_item_created',
      category: 'settings',
      details: { itemId: item.id, name: item.name, initialStock },
      ipAddress: getClientIp(req),
      userAgent: getClientUserAgent(req),
    });

    return res.status(201).json(serializeInventoryItem(item));
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to create inventory item.' });
  }
});

// PATCH /owner/inventory/:id - Update ingredient configuration
router.patch('/owner/inventory/:id', requireRole('owner', 'manager'), async (req, res) => {
  try {
    const item = await InventoryItem.findOne({
      where: { id: req.params.id, cafeId: req.auth.cafe },
    });
    if (!item) return res.status(404).json({ message: 'Inventory item not found.' });

    const allowed = ['name', 'sku', 'category', 'unit', 'lowStockThreshold', 'costPerUnit', 'supplier', 'isActive'];
    allowed.forEach(f => {
      if (req.body[f] !== undefined) item[f] = req.body[f];
    });

    item.status = calculateStockStatus(item.currentStock, item.lowStockThreshold);
    await item.save();

    await syncMenuItemAvailability(req.auth.cafe, item.id);

    return res.json(serializeInventoryItem(item));
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to update inventory item.' });
  }
});

// POST /owner/inventory/:id/restock - Restock an ingredient
router.post('/owner/inventory/:id/restock', requireRole('owner', 'manager', 'cashier'), async (req, res) => {
  try {
    const { quantity, costPerUnit, notes } = req.body;
    if (!quantity || Number(quantity) <= 0) {
      return res.status(400).json({ message: 'Restock quantity must be positive.' });
    }

    const user = await User.findByPk(req.auth.sub);
    const result = await restockInventoryItem({
      cafeId: req.auth.cafe,
      inventoryItemId: req.params.id,
      quantityAdded: Number(quantity),
      costPerUnit: costPerUnit !== undefined ? Number(costPerUnit) : undefined,
      notes: notes || 'Direct restock intake',
      staffName: user?.name || req.auth.name || 'Staff',
    });

    await createAuditLog({
      cafeId: req.auth.cafe,
      userId: req.auth.sub,
      userName: req.auth.name || 'Staff',
      userRole: req.auth.role,
      action: 'inventory_restocked',
      category: 'settings',
      details: { itemId: result.item.id, name: result.item.name, quantityAdded: quantity },
      ipAddress: getClientIp(req),
      userAgent: getClientUserAgent(req),
    });

    return res.json({
      success: true,
      item: serializeInventoryItem(result.item),
      ledger: serializeStockLedger(result.ledger),
      restoredMenuItems: result.restoredMenuItems,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to restock item.' });
  }
});

// POST /owner/inventory/:id/waste - Record wastage/spoilage
router.post('/owner/inventory/:id/waste', requireRole('owner', 'manager', 'cashier'), async (req, res) => {
  try {
    const { quantity, reason } = req.body;
    if (!quantity || Number(quantity) <= 0) {
      return res.status(400).json({ message: 'Wasted quantity must be positive.' });
    }

    const user = await User.findByPk(req.auth.sub);
    const result = await logInventoryWastage({
      cafeId: req.auth.cafe,
      inventoryItemId: req.params.id,
      quantityWasted: Number(quantity),
      reason: reason || 'Spoilage / spill / batch expired',
      staffName: user?.name || req.auth.name || 'Staff',
    });

    await createAuditLog({
      cafeId: req.auth.cafe,
      userId: req.auth.sub,
      userName: req.auth.name || 'Staff',
      userRole: req.auth.role,
      action: 'inventory_waste_logged',
      category: 'settings',
      details: { itemId: result.item.id, name: result.item.name, quantityWasted: quantity, reason },
      ipAddress: getClientIp(req),
      userAgent: getClientUserAgent(req),
    });

    return res.json({
      success: true,
      item: serializeInventoryItem(result.item),
      ledger: serializeStockLedger(result.ledger),
      affectedMenuItems: result.affectedMenuItems,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to record wastage.' });
  }
});

// GET /owner/inventory/:id/ledger - Get movement log for single item
router.get('/owner/inventory/:id/ledger', requireRole('owner', 'manager', 'cashier'), async (req, res) => {
  try {
    const ledgers = await StockLedger.findAll({
      where: { cafeId: req.auth.cafe, inventoryItemId: req.params.id },
      include: [{ model: InventoryItem, as: 'item', attributes: ['id', 'name', 'unit'] }],
      order: [['createdAt', 'DESC']],
      limit: 100,
    });

    return res.json(ledgers.map(serializeStockLedger));
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to fetch stock movements.' });
  }
});

// GET /owner/inventory/ledgers - All recent stock movements across the cafe
router.get('/owner/inventory/movements/all', requireRole('owner', 'manager', 'cashier'), async (req, res) => {
  try {
    const ledgers = await StockLedger.findAll({
      where: { cafeId: req.auth.cafe },
      include: [{ model: InventoryItem, as: 'item', attributes: ['id', 'name', 'unit'] }],
      order: [['createdAt', 'DESC']],
      limit: 100,
    });

    return res.json(ledgers.map(serializeStockLedger));
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to fetch all stock movements.' });
  }
});

// GET /owner/inventory/recipes - Get all recipe BOMs across menu items
router.get('/owner/inventory/recipes', requireRole('owner', 'manager', 'cashier'), async (req, res) => {
  try {
    const menuItems = await MenuItem.findAll({
      where: { cafeId: req.auth.cafe },
      include: [
        {
          model: RecipeItem,
          as: 'recipes',
          include: [{ model: InventoryItem, as: 'ingredient' }],
        },
      ],
      order: [['category', 'ASC'], ['name', 'ASC']],
    });

    const inventoryItems = await InventoryItem.findAll({
      where: { cafeId: req.auth.cafe, isActive: true },
    });

    const result = menuItems.map(m => {
      const recipes = m.recipes || [];
      const costAnalysis = calculateRecipeCost(recipes, inventoryItems);
      const sellingPrice = Number(m.price) || 0;
      const profitMargin = sellingPrice > 0
        ? Number((((sellingPrice - costAnalysis.totalCost) / sellingPrice) * 100).toFixed(1))
        : 0;

      return {
        menuItemId: m.id,
        name: m.name,
        category: m.category,
        price: sellingPrice,
        available: m.available,
        totalCost: costAnalysis.totalCost,
        profitMarginPercent: profitMargin,
        recipes: recipes.map(serializeRecipeItem),
      };
    });

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to fetch recipes.' });
  }
});

// GET /owner/inventory/recipes/:menuItemId - Get recipe BOM for a single menu item
router.get('/owner/inventory/recipes/:menuItemId', requireRole('owner', 'manager', 'cashier'), async (req, res) => {
  try {
    const menuItem = await MenuItem.findOne({
      where: { id: req.params.menuItemId, cafeId: req.auth.cafe },
      include: [
        {
          model: RecipeItem,
          as: 'recipes',
          include: [{ model: InventoryItem, as: 'ingredient' }],
        },
      ],
    });
    if (!menuItem) return res.status(404).json({ message: 'Menu item not found.' });

    const inventoryItems = await InventoryItem.findAll({
      where: { cafeId: req.auth.cafe, isActive: true },
    });

    const recipes = menuItem.recipes || [];
    const costAnalysis = calculateRecipeCost(recipes, inventoryItems);
    const sellingPrice = Number(menuItem.price) || 0;
    const profitMargin = sellingPrice > 0
      ? Number((((sellingPrice - costAnalysis.totalCost) / sellingPrice) * 100).toFixed(1))
      : 0;

    return res.json({
      menuItemId: menuItem.id,
      name: menuItem.name,
      category: menuItem.category,
      price: sellingPrice,
      available: menuItem.available,
      totalCost: costAnalysis.totalCost,
      profitMarginPercent: profitMargin,
      ingredientBreakdown: costAnalysis.ingredientBreakdown,
      recipes: recipes.map(serializeRecipeItem),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to fetch recipe for item.' });
  }
});

// POST /owner/inventory/recipes/:menuItemId - Save/Replace recipe BOM for a menu item
router.post('/owner/inventory/recipes/:menuItemId', requireRole('owner', 'manager'), async (req, res) => {
  try {
    const menuItem = await MenuItem.findOne({
      where: { id: req.params.menuItemId, cafeId: req.auth.cafe },
    });
    if (!menuItem) return res.status(404).json({ message: 'Menu item not found.' });

    const { ingredients } = req.body;
    if (!Array.isArray(ingredients)) {
      return res.status(400).json({ message: 'Ingredients array is required.' });
    }

    // Delete existing recipe items for this menu item
    await RecipeItem.destroy({
      where: { menuItemId: menuItem.id, cafeId: req.auth.cafe },
    });

    // Create new recipe items
    const created = [];
    for (const ing of ingredients) {
      if (!ing.inventoryItemId || !ing.quantityRequired) continue;

      const r = await RecipeItem.create({
        cafeId: req.auth.cafe,
        menuItemId: menuItem.id,
        inventoryItemId: ing.inventoryItemId,
        quantityRequired: Number(ing.quantityRequired),
        unit: ing.unit || 'g',
        variantName: ing.variantName || null,
      });
      created.push(r);
    }

    // Fetch created with ingredient details
    const reloaded = await RecipeItem.findAll({
      where: { menuItemId: menuItem.id, cafeId: req.auth.cafe },
      include: [{ model: InventoryItem, as: 'ingredient' }],
    });

    // Synchronize menu item availability based on newly configured recipe
    for (const r of reloaded) {
      await syncMenuItemAvailability(req.auth.cafe, r.inventoryItemId);
    }

    return res.json({
      success: true,
      message: `Recipe for ${menuItem.name} updated with ${reloaded.length} ingredients.`,
      recipes: reloaded.map(serializeRecipeItem),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to update recipe.' });
  }
});

// DELETE /owner/inventory/recipes/:recipeItemId - Remove a single ingredient from recipe
router.delete('/owner/inventory/recipes/:recipeItemId', requireRole('owner', 'manager'), async (req, res) => {
  try {
    const recipe = await RecipeItem.findOne({
      where: { id: req.params.recipeItemId, cafeId: req.auth.cafe },
    });
    if (!recipe) return res.status(404).json({ message: 'Recipe item not found.' });

    const inventoryItemId = recipe.inventoryItemId;
    await recipe.destroy();

    await syncMenuItemAvailability(req.auth.cafe, inventoryItemId);

    return res.json({ success: true, message: 'Ingredient removed from recipe.' });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to delete recipe ingredient.' });
  }
});

export default router;
