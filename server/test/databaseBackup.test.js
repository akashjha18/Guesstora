import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable, Writable } from 'node:stream';
import {
  createEncryptedBackupCipher,
  createEncryptedBackupDecipher,
  parseBackupKey,
  validateRestoreTarget,
  verifyEncryptedBackup,
  mysqlOptionFile,
} from '../scripts/databaseBackup.js';

test('backup encryption key requires exactly 32 base64-decoded bytes', () => {
  assert.equal(parseBackupKey(Buffer.alloc(32, 7).toString('base64')).length, 32);
  assert.throws(() => parseBackupKey('short'), /32-byte key/);
});

test('restore target requires an explicit matching confirmation and cannot equal the source', () => {
  assert.equal(validateRestoreTarget({
    sourceDatabase: 'cafe_loyalty',
    targetDatabase: 'cafe_loyalty_restore_test',
    confirmation: 'cafe_loyalty_restore_test',
  }), 'cafe_loyalty_restore_test');
  assert.throws(() => validateRestoreTarget({
    sourceDatabase: 'cafe_loyalty',
    targetDatabase: 'cafe_loyalty',
    confirmation: 'cafe_loyalty',
  }), /Refusing to restore over/);
  assert.throws(() => validateRestoreTarget({
    sourceDatabase: 'cafe_loyalty',
    targetDatabase: 'cafe_loyalty_restore_test',
    confirmation: '',
  }), /RESTORE_CONFIRM_DATABASE/);
});

test('encrypted backup verifies before restore and rejects tampering', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'gusstora-backup-test-'));
  const backupPath = join(directory, 'test.sql.enc');
  const key = Buffer.alloc(32, 9);
  const contents = Buffer.from('CREATE TABLE acceptance_test (id INT);\n');
  try {
    const { cipher, header } = createEncryptedBackupCipher(key);
    const encrypted = [];
    await pipeline(
      Readable.from([contents]),
      cipher,
      new Writable({ write(chunk, _encoding, callback) { encrypted.push(Buffer.from(chunk)); callback(); } })
    );
    await writeFile(backupPath, Buffer.concat([header, ...encrypted, cipher.getAuthTag()]));

    await verifyEncryptedBackup(backupPath, key);
    const { decipher, encryptedStart, encryptedEnd } = await createEncryptedBackupDecipher(backupPath, key);
    const restored = [];
    await pipeline(
      createReadStream(backupPath, { start: encryptedStart, end: encryptedEnd }),
      decipher,
      new Writable({ write(chunk, _encoding, callback) { restored.push(Buffer.from(chunk)); callback(); } })
    );
    assert.deepEqual(Buffer.concat(restored), contents);

    const damaged = Buffer.from(await readFile(backupPath));
    damaged[damaged.length - 1] ^= 1;
    await writeFile(backupPath, damaged);
    await assert.rejects(verifyEncryptedBackup(backupPath, key));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('MySQL option file quotes credentials without putting them in command arguments', () => {
  const config = mysqlOptionFile({
    host: 'localhost',
    port: 3306,
    user: 'backup-user',
    password: 'quote"and\\slash',
  });
  assert.match(config, /password="quote\\"and\\\\slash"/);
  assert.doesNotMatch(config, /[\r]/);
});
