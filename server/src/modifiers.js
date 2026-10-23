/**
 * GUESTORA Modifiers & Variants Engine
 * Handles normalization, option verification, and dynamic price calculations.
 */

/**
 * Normalizes order line items against cafe menu items with variant selection and modifiers
 * @param {Array} items - raw line items from request
 * @param {Array|Map} menu - menu items from database
 * @param {number} maxQtyPerLine - upper limit per line (default: 20)
 * @returns {Array} normalized items with computed prices
 */
export function normalizeOrderLineItems(items = [], menu = [], maxQtyPerLine = 20) {
  const menuMap = menu instanceof Map ? menu : new Map(menu.map(i => [String(i.id), i]));

  return items.map(line => {
    const rawId = String(line.menuItemId || line.id || line._id || '');
    const item = menuMap.get(rawId);
    if (!item) return null;
    if (item.available === false) return null;

    const qty = Math.max(1, Math.min(maxQtyPerLine, Number(line.quantity || line.qty) || 1));
    const variants = Array.isArray(item.variants)
      ? item.variants
      : (typeof item.variants === 'string' ? JSON.parse(item.variants || '[]') : []);

    let basePrice = Number(item.price) || 0;
    let selectedVariant = null;

    if (line.selectedVariant && variants.length > 0) {
      const vId = line.selectedVariant.id || line.selectedVariant._id;
      const vName = line.selectedVariant.name;
      const foundVar = variants.find(
        v => (vId && (v.id === vId || v._id === vId)) ||
             (vName && String(v.name).toLowerCase() === String(vName).toLowerCase())
      );
      if (foundVar) {
        basePrice = Number(foundVar.price) || basePrice;
        selectedVariant = {
          id: String(foundVar.id || foundVar._id || foundVar.name),
          name: foundVar.name,
          price: Number(foundVar.price) || 0,
        };
      }
    }

    const modifierGroups = Array.isArray(item.modifierGroups)
      ? item.modifierGroups
      : (typeof item.modifierGroups === 'string' ? JSON.parse(item.modifierGroups || '[]') : []);

    const selectedModifiers = [];
    let modifiersSum = 0;

    if (Array.isArray(line.selectedModifiers) && line.selectedModifiers.length > 0 && modifierGroups.length > 0) {
      const allowedOptions = new Map();
      for (const mg of modifierGroups) {
        for (const opt of (mg.options || [])) {
          const optKey = String(opt.id || opt._id || opt.name);
          allowedOptions.set(optKey, { ...opt, groupName: mg.name });
          if (opt.name) {
            allowedOptions.set(String(opt.name).toLowerCase(), { ...opt, groupName: mg.name });
          }
        }
      }

      for (const mod of line.selectedModifiers) {
        const modKey = String(mod.id || mod._id || mod.name || '');
        const validOpt = allowedOptions.get(modKey) || allowedOptions.get(modKey.toLowerCase());
        if (validOpt) {
          const modPrice = Number(validOpt.price) || 0;
          modifiersSum += modPrice;
          selectedModifiers.push({
            id: String(validOpt.id || validOpt._id || validOpt.name),
            groupName: validOpt.groupName,
            name: validOpt.name,
            price: modPrice,
          });
        }
      }
    }

    const finalUnitPrice = basePrice + modifiersSum;
    const notes = line.notes ? String(line.notes).trim().slice(0, 255) : '';

    return {
      menuItemId: item.id,
      name: item.name,
      price: finalUnitPrice,
      basePrice,
      quantity: qty,
      selectedVariant,
      selectedModifiers,
      notes,
    };
  }).filter(Boolean);
}

/**
 * Validates whether an item's modifier selections satisfy group constraints (required, minSelect, maxSelect)
 */
export function validateModifierConstraints(selectedModifiers = [], modifierGroups = []) {
  if (!modifierGroups || !modifierGroups.length) return { valid: true };

  for (const group of modifierGroups) {
    const selectedInGroup = selectedModifiers.filter(
      sm => sm.groupName === group.name || (group.id && sm.groupId === group.id)
    );

    if (group.required && selectedInGroup.length === 0) {
      return {
        valid: false,
        error: `Please select an option for "${group.name}".`,
      };
    }

    if (group.minSelect && selectedInGroup.length < group.minSelect) {
      return {
        valid: false,
        error: `Please select at least ${group.minSelect} option(s) for "${group.name}".`,
      };
    }

    if (group.maxSelect && selectedInGroup.length > group.maxSelect) {
      return {
        valid: false,
        error: `You can select at most ${group.maxSelect} option(s) for "${group.name}".`,
      };
    }
  }

  return { valid: true };
}
