import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBootstrapConnectionConfig, buildCreateDatabaseSql, parseMysqlUrl } from '../src/database.js';

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

test('bootstrap config uses credentials from MYSQL_URL', () => {
  const cfg = buildBootstrapConnectionConfig({
    MYSQL_URL: 'mysql://db-user:p%40ss@db.example:3307/cafe_loyalty',
  });

  assert.equal(cfg.host, 'db.example');
  assert.equal(cfg.port, 3307);
  assert.equal(cfg.user, 'db-user');
  assert.equal(cfg.password, 'p@ss');
  assert.equal(cfg.database, 'mysql');
  assert.equal(cfg.databaseName, 'cafe_loyalty');
});

test('MYSQL_URL must be a MySQL URL with a database name', () => {
  assert.throws(() => parseMysqlUrl('postgres://localhost/cafe_loyalty'), /must use the mysql:\/\/ protocol/);
  assert.throws(() => parseMysqlUrl('mysql://localhost'), /must include a database name/);
});
