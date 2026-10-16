import test from 'node:test';
import assert from 'node:assert/strict';
import { runMigrations } from '../src/migrations.js';

test('runMigrations records applied migrations once and skips already-run entries', async () => {
  let createTableCalls = 0;
  const runLog = [];
  const sequelize = {
    getQueryInterface() {
      return {
        createTable: async () => {
          createTableCalls += 1;
        },
      };
    },
    query: async (sql, options = {}) => {
      const values = options.replacements || [];
      runLog.push({ sql, values });
      if (sql.includes('SELECT 1 FROM schema_migrations')) {
        const id = values[0];
        return id === '001_demo_seed' ? [[{ id }]] : [[]];
      }
      return [];
    },
  };

  const migrations = [
    { id: '001_demo_seed', up: async () => runLog.push({ sql: 'apply-001', values: [] }) },
    { id: '002_second_step', up: async () => runLog.push({ sql: 'apply-002', values: [] }) },
  ];

  await runMigrations({ sequelize, migrations });

  assert.equal(createTableCalls, 1);
  assert.equal(runLog.some(entry => entry.sql === 'apply-001'), false);
  assert.equal(runLog.some(entry => entry.sql === 'apply-002'), true);
});
