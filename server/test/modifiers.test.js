import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOrderLineItems, validateModifierConstraints } from '../src/modifiers.js';

test('normalizeOrderLineItems calculates standard item with base price', () => {
  const menu = [
    { id: 'item-1', name: 'Cold Brew', price: 150, available: true }
  ];
  const items = [{ menuItemId: 'item-1', quantity: 2 }];

  const res = normalizeOrderLineItems(items, menu);
  assert.equal(res.length, 1);
  assert.equal(res[0].price, 150);
  assert.equal(res[0].quantity, 2);
  assert.equal(res[0].selectedVariant, null);
  assert.deepEqual(res[0].selectedModifiers, []);
});

test('normalizeOrderLineItems applies variant price override', () => {
  const menu = [
    {
      id: 'latte-1',
      name: 'Spanish Latte',
      price: 200,
      available: true,
      variants: [
        { id: 'v-reg', name: 'Regular', price: 200 },
        { id: 'v-large', name: 'Large', price: 250 }
      ]
    }
  ];
  const items = [{
    menuItemId: 'latte-1',
    quantity: 1,
    selectedVariant: { id: 'v-large' }
  }];

  const res = normalizeOrderLineItems(items, menu);
  assert.equal(res.length, 1);
  assert.equal(res[0].price, 250);
  assert.equal(res[0].selectedVariant.name, 'Large');
  assert.equal(res[0].selectedVariant.price, 250);
});

test('normalizeOrderLineItems computes multiple modifiers correctly', () => {
  const menu = [
    {
      id: 'latte-1',
      name: 'Vanilla Latte',
      price: 220,
      available: true,
      variants: [{ id: 'v-reg', name: 'Regular', price: 220 }],
      modifierGroups: [
        {
          id: 'mg-milk',
          name: 'Milk Choice',
          options: [
            { id: 'opt-oat', name: 'Oat Milk', price: 40 },
            { id: 'opt-almond', name: 'Almond Milk', price: 50 }
          ]
        },
        {
          id: 'mg-extra',
          name: 'Add-ons',
          options: [
            { id: 'opt-shot', name: 'Extra Espresso Shot', price: 50 },
            { id: 'opt-syrup', name: 'Vanilla Syrup', price: 30 }
          ]
        }
      ]
    }
  ];

  const items = [{
    menuItemId: 'latte-1',
    quantity: 2,
    selectedModifiers: [
      { id: 'opt-oat' },
      { id: 'opt-shot' }
    ],
    notes: 'Extra hot please'
  }];

  const res = normalizeOrderLineItems(items, menu);
  assert.equal(res.length, 1);
  // Base 220 + 40 (oat) + 50 (shot) = 310
  assert.equal(res[0].price, 310);
  assert.equal(res[0].quantity, 2);
  assert.equal(res[0].selectedModifiers.length, 2);
  assert.equal(res[0].notes, 'Extra hot please');
});

test('normalizeOrderLineItems ignores invalid or tampered modifiers', () => {
  const menu = [
    {
      id: 'item-1',
      name: 'Cappuccino',
      price: 180,
      available: true,
      modifierGroups: [
        {
          name: 'Milk',
          options: [{ id: 'oat', name: 'Oat Milk', price: 40 }]
        }
      ]
    }
  ];

  const items = [{
    menuItemId: 'item-1',
    quantity: 1,
    selectedModifiers: [
      { id: 'fake-hack-id', price: 0 } // Attacker attempts to inject fake modifier
    ]
  }];

  const res = normalizeOrderLineItems(items, menu);
  assert.equal(res.length, 1);
  assert.equal(res[0].price, 180);
  assert.equal(res[0].selectedModifiers.length, 0);
});

test('validateModifierConstraints enforces required and maxSelect rules', () => {
  const modifierGroups = [
    {
      name: 'Milk Choice',
      required: true,
      maxSelect: 1,
      options: [
        { id: 'oat', name: 'Oat Milk', price: 40 },
        { id: 'almond', name: 'Almond Milk', price: 50 }
      ]
    }
  ];

  // Missing required
  const checkEmpty = validateModifierConstraints([], modifierGroups);
  assert.equal(checkEmpty.valid, false);

  // Valid single selection
  const checkValid = validateModifierConstraints([{ groupName: 'Milk Choice', id: 'oat' }], modifierGroups);
  assert.equal(checkValid.valid, true);

  // Exceeds maxSelect
  const checkExcess = validateModifierConstraints([
    { groupName: 'Milk Choice', id: 'oat' },
    { groupName: 'Milk Choice', id: 'almond' }
  ], modifierGroups);
  assert.equal(checkExcess.valid, false);
});
