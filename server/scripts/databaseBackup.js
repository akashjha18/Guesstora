import crypto from 'node:crypto';
import { createReadStream } from 'node:fs';
import { open, stat } from 'node:fs/promises';
import { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const BACKUP_MAGIC = Buffer.from('GUSSQL01');
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const HEADER_LENGTH = BACKUP_MAGIC.length + IV_LENGTH;

export function parseBackupKey(value = process.env.BACKUP_ENCRYPTION_KEY) {
  const key = Buffer.from(String(value || '').trim(), 'base64');
  if (key.length !== 32) {
    throw new Error('BACKUP_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
  }
  return key;
}

export function createEncryptedBackupCipher(key) {
  const iv = crypto.randomBytes(IV_LENGTH);
  return {
    cipher: crypto.createCipheriv('aes-256-gcm', key, iv),
    header: Buffer.concat([BACKUP_MAGIC, iv]),
  };
}

export async function createEncryptedBackupDecipher(path, key) {
  const { size } = await stat(path);
  if (size < HEADER_LENGTH + TAG_LENGTH) {
    throw new Error('Backup file is truncated or invalid.');
  }

  const header = Buffer.alloc(HEADER_LENGTH);
  const handle = await open(path, 'r');
  try {
    let bytesRead = 0;
    while (bytesRead < HEADER_LENGTH) {
      const result = await handle.read(header, bytesRead, HEADER_LENGTH - bytesRead, bytesRead);
      if (!result.bytesRead) throw new Error('Backup file is truncated or invalid.');
      bytesRead += result.bytesRead;
    }
  } finally {
    await handle.close();
  }

  if (!header.subarray(0, BACKUP_MAGIC.length).equals(BACKUP_MAGIC)) {
    throw new Error('Backup file format is not recognized.');
  }

  const tag = Buffer.alloc(TAG_LENGTH);
  const tagFile = await open(path, 'r');
  try {
    let bytesRead = 0;
    while (bytesRead < TAG_LENGTH) {
      const result = await tagFile.read(tag, bytesRead, TAG_LENGTH - bytesRead, size - TAG_LENGTH + bytesRead);
      if (!result.bytesRead) throw new Error('Backup file is truncated or invalid.');
      bytesRead += result.bytesRead;
    }
  } finally {
    await tagFile.close();
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    header.subarray(BACKUP_MAGIC.length)
  );
  decipher.setAuthTag(tag);
  return {
    decipher,
    encryptedStart: HEADER_LENGTH,
    encryptedEnd: size - TAG_LENGTH - 1,
  };
}

export async function verifyEncryptedBackup(path, key) {
  const { decipher, encryptedStart, encryptedEnd } = await createEncryptedBackupDecipher(path, key);
  const discard = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
  await pipeline(createReadStream(path, { start: encryptedStart, end: encryptedEnd }), decipher, discard);
}

export function validateRestoreTarget({ sourceDatabase, targetDatabase, confirmation }) {
  const source = String(sourceDatabase || '').trim();
  const target = String(targetDatabase || '').trim();
  if (!target || !/^[a-zA-Z0-9_]+$/.test(target)) {
    throw new Error('RESTORE_TARGET_DATABASE must be a valid MySQL database name.');
  }
  if (target === source) {
    throw new Error('Refusing to restore over the configured source database.');
  }
  if (confirmation !== target) {
    throw new Error('Set RESTORE_CONFIRM_DATABASE to exactly match RESTORE_TARGET_DATABASE.');
  }
  return target;
}

export function mysqlOptionFile({ host, port, user, password }) {
  const escape = value => String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]/g, '');
  return [
    '[client]',
    `host="${escape(host)}"`,
    `port=${Number(port)}`,
    'protocol=tcp',
    `user="${escape(user)}"`,
    `password="${escape(password)}"`,
    '',
  ].join('\n');
}
