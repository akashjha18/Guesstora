import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAppConfig } from '../src/config.js';

test('valid app config is accepted', () => {
  const config = validateAppConfig({
    MYSQL_DATABASE: 'cafe_loyalty',
    JWT_SECRET: 'my-secret-value',
    PORT: '5000',
  });

  assert.equal(config.databaseName, 'cafe_loyalty');
  assert.equal(config.jwtSecret, 'my-secret-value');
  assert.equal(config.port, 5000);
});

test('missing database or secret values are rejected', () => {
  assert.throws(() => validateAppConfig({ MYSQL_DATABASE: '', JWT_SECRET: 'x' }), /MYSQL_DATABASE is required\./);
  assert.throws(() => validateAppConfig({ MYSQL_DATABASE: 'cafe_loyalty', JWT_SECRET: '' }), /JWT_SECRET is required\./);
});
