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
  assert.equal(config.trustProxyHops, 0);
});

test('MYSQL_URL supplies the database and bootstrap connection settings', () => {
  const config = validateAppConfig({
    MYSQL_URL: 'mysql://db-user:p%40ss@db.example:3307/cafe%20loyalty',
    JWT_SECRET: 'my-secret-value',
  });

  assert.equal(config.databaseName, 'cafe loyalty');
  assert.equal(config.host, 'db.example');
  assert.equal(config.port, 5000);
  assert.equal(config.user, 'db-user');
  assert.equal(config.password, 'p@ss');
  assert.equal(config.mysqlUrl, 'mysql://db-user:p%40ss@db.example:3307/cafe%20loyalty');
});

test('MYSQL_DATABASE must match the database in MYSQL_URL', () => {
  assert.throws(() => validateAppConfig({
    MYSQL_URL: 'mysql://root:secret@localhost/cafe_loyalty',
    MYSQL_DATABASE: 'other_database',
    JWT_SECRET: 'my-secret-value',
  }), /MYSQL_DATABASE must match the database name in MYSQL_URL\./);
});

test('missing database or secret values are rejected', () => {
  assert.throws(() => validateAppConfig({ MYSQL_DATABASE: '', JWT_SECRET: 'x' }), /MYSQL_DATABASE is required\./);
  assert.throws(() => validateAppConfig({ MYSQL_DATABASE: 'cafe_loyalty', JWT_SECRET: '' }), /JWT_SECRET is required\./);
  assert.throws(() => validateAppConfig({ MYSQL_URL: 'mysql://localhost', JWT_SECRET: 'x' }), /MYSQL_URL must include a database name\./);
});

test('production requires a sufficiently strong JWT secret', () => {
  assert.throws(() => validateAppConfig({
    MYSQL_DATABASE: 'cafe_loyalty',
    JWT_SECRET: 'short-secret',
    NODE_ENV: 'production',
    CLIENT_URL: 'https://app.example.com',
  }), /JWT_SECRET must be at least 32 characters in production\./);
  assert.doesNotThrow(() => validateAppConfig({
    MYSQL_DATABASE: 'cafe_loyalty',
    JWT_SECRET: 'a'.repeat(32),
    NODE_ENV: 'production',
    CLIENT_URL: 'https://app.example.com',
  }));
});

test('production requires HTTPS frontend origins without paths', () => {
  const baseConfig = {
    MYSQL_DATABASE: 'cafe_loyalty',
    JWT_SECRET: 'a'.repeat(32),
    NODE_ENV: 'production',
  };
  assert.throws(() => validateAppConfig(baseConfig), /CLIENT_URL must contain the HTTPS frontend origin/);
  assert.throws(() => validateAppConfig({ ...baseConfig, CLIENT_URL: 'http://app.example.com' }), /only HTTPS origins/);
  assert.throws(() => validateAppConfig({ ...baseConfig, CLIENT_URL: 'https://app.example.com/path' }), /only HTTPS origins/);
  assert.doesNotThrow(() => validateAppConfig({
    ...baseConfig,
    CLIENT_URL: 'https://app.example.com,https://admin.example.com',
  }));
});

test('trust proxy hop count must be a non-negative integer', () => {
  assert.throws(() => validateAppConfig({
    MYSQL_DATABASE: 'cafe_loyalty',
    JWT_SECRET: 'my-secret-value',
    TRUST_PROXY_HOPS: '-1',
  }), /TRUST_PROXY_HOPS must be a non-negative integer\./);
  assert.doesNotThrow(() => validateAppConfig({
    MYSQL_DATABASE: 'cafe_loyalty',
    JWT_SECRET: 'my-secret-value',
    TRUST_PROXY_HOPS: '1',
  }));
});
