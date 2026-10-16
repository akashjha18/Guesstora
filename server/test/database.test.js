import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBootstrapConnectionConfig, buildCreateDatabaseSql } from '../src/database.js';

test('bootstrap config targets the default mysql database before app schema creation', () => {
  const cfg = buildBootstrapConnectionConfig({
    MYSQL_HOST: '127.0.0.1',
    MYSQL_PORT: '3306',
    MYSQL_USER: 'root',
    MYSQL_PASSWORD: '',
  });

  assert.equal(cfg.host, '127.0.0.1');
  assert.equal(cfg.user, 'root');
  assert.equal(cfg.database, 'mysql');
});

test('create database SQL is idempotent', () => {
  const sql = buildCreateDatabaseSql('cafe_loyalty');
  assert.match(sql, /CREATE DATABASE IF NOT EXISTS/i);
  assert.match(sql, /cafe_loyalty/);
});
