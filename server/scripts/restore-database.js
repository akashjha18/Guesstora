import 'dotenv/config';
import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdtemp, rm, writeFile, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import mysql from 'mysql2/promise';
import {
  createEncryptedBackupDecipher,
  parseBackupKey,
  validateRestoreTarget,
  verifyEncryptedBackup,
  mysqlOptionFile,
} from './databaseBackup.js';
import { parseMysqlUrl } from '../src/database.js';

function getDatabaseSettings() {
  if (process.env.MYSQL_URL) return parseMysqlUrl(process.env.MYSQL_URL);
  return {
    host: String(process.env.MYSQL_HOST || '127.0.0.1').trim(),
    port: Number(process.env.MYSQL_PORT || 3306),
    user: String(process.env.MYSQL_USER || 'root').trim(),
    password: process.env.MYSQL_PASSWORD || '',
    databaseName: String(process.env.MYSQL_DATABASE || '').trim(),
  };
}

async function main() {
  const backupPath = resolve(process.env.BACKUP_FILE || '');
  if (!process.env.BACKUP_FILE) throw new Error('Set BACKUP_FILE to the encrypted backup file to restore.');
  const { databaseName: sourceDatabase, host, port, user, password } = getDatabaseSettings();
  const targetDatabase = validateRestoreTarget({
    sourceDatabase,
    targetDatabase: process.env.RESTORE_TARGET_DATABASE,
    confirmation: process.env.RESTORE_CONFIRM_DATABASE,
  });
  if (process.env.RESTORE_ALLOW_REMOTE_HOST !== 'true' &&
      !['127.0.0.1', 'localhost', '::1'].includes(host.toLowerCase())) {
    throw new Error('Restore is restricted to a local MySQL host unless RESTORE_ALLOW_REMOTE_HOST=true is explicitly set.');
  }

  const key = parseBackupKey();
  await verifyEncryptedBackup(backupPath, key);

  const targetConnection = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database: targetDatabase,
  });
  try {
    const [tables] = await targetConnection.query(
      'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? LIMIT 1',
      [targetDatabase]
    );
    if (tables.length) {
      throw new Error(`Restore target ${targetDatabase} must be empty. Refusing to overwrite existing tables.`);
    }
  } finally {
    await targetConnection.end();
  }

  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'gusstora-restore-'));
  const optionPath = join(temporaryDirectory, 'mysql.cnf');
  let child;
  try {
    await writeFile(optionPath, mysqlOptionFile({ host, port, user, password }), { mode: 0o600 });
    if (process.platform !== 'win32') await chmod(optionPath, 0o600);
    const { decipher, encryptedStart, encryptedEnd } = await createEncryptedBackupDecipher(backupPath, key);
    child = spawn('mysql', [
      `--defaults-extra-file=${optionPath}`,
      '--database',
      targetDatabase,
    ], { stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true });

    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', chunk => { stderr = `${stderr}${chunk}`.slice(-4000); });
    const exitPromise = new Promise((resolveExit, rejectExit) => {
      child.once('error', rejectExit);
      child.once('close', (exitCode, signal) => resolveExit([exitCode, signal]));
    });
    const streamResult = pipeline(
      createReadStream(backupPath, { start: encryptedStart, end: encryptedEnd }),
      decipher,
      child.stdin
    );
    const [[exitCode, signal]] = await Promise.all([exitPromise, streamResult]);
    if (exitCode !== 0) {
      throw new Error(`mysql restore failed for ${targetDatabase}: ${stderr.trim() || `exit ${exitCode ?? signal}`}`);
    }
    console.log(`Encrypted backup ${basename(backupPath)} restored into ${targetDatabase}.`);
  } catch (error) {
    if (child && child.exitCode === null && child.signalCode === null) child.kill();
    if (error.code === 'ENOENT') throw new Error('mysql client is not installed or is not available on PATH.');
    throw error;
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
