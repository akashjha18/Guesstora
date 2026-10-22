import 'dotenv/config';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { appendFile, chmod, mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createEncryptedBackupCipher, mysqlOptionFile, parseBackupKey } from './databaseBackup.js';
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

function commandFailure(error, stderr) {
  if (error) return new Error(`Unable to run mysqldump: ${error.message}`);
  if (stderr) return new Error(`mysqldump failed: ${stderr.trim()}`);
  return new Error('mysqldump exited unsuccessfully.');
}

async function main() {
  const { databaseName, host, port, user, password } = getDatabaseSettings();
  if (!databaseName) throw new Error('MYSQL_DATABASE or a database name in MYSQL_URL is required.');
  const key = parseBackupKey();
  const backupDirectory = resolve(process.env.BACKUP_DIR || 'backups');
  await mkdir(backupDirectory, { recursive: true });

  const now = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `${databaseName}-${now}.sql.enc`;
  const destination = join(backupDirectory, fileName);
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'gusstora-backup-'));
  const optionPath = join(temporaryDirectory, 'mysql.cnf');
  const partialPath = join(backupDirectory, `.${fileName}.partial`);
  let child;

  try {
    await writeFile(optionPath, mysqlOptionFile({ host, port, user, password }), { mode: 0o600 });
    if (process.platform !== 'win32') await chmod(optionPath, 0o600);

    const { cipher, header } = createEncryptedBackupCipher(key);
    child = spawn('mysqldump', [
      `--defaults-extra-file=${optionPath}`,
      '--single-transaction',
      '--routines',
      '--triggers',
      '--events',
      '--hex-blob',
      databaseName,
    ], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });

    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', chunk => { stderr = `${stderr}${chunk}`.slice(-4000); });
    const exitPromise = new Promise((resolveExit, rejectExit) => {
      child.once('error', rejectExit);
      child.once('close', (exitCode, signal) => resolveExit([exitCode, signal]));
    });
    const output = createWriteStream(partialPath, { flags: 'wx', mode: 0o600 });
    output.write(header);
    const streamResult = pipeline(child.stdout, cipher, output);
    const [[exitCode, signal]] = await Promise.all([exitPromise, streamResult]);
    if (exitCode !== 0) throw commandFailure(null, stderr || `exit ${exitCode ?? signal}`);
    await appendFile(partialPath, cipher.getAuthTag());
    await rename(partialPath, destination);
    console.log(`Encrypted database backup written: ${basename(destination)}`);
  } catch (error) {
    if (child && child.exitCode === null && child.signalCode === null) child.kill();
    await rm(partialPath, { force: true });
    if (error.code === 'ENOENT') {
      throw new Error('mysqldump is not installed or is not available on PATH.');
    }
    throw error;
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
