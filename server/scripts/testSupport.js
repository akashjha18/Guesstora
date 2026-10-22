import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

const serverDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const projectRoot = resolve(serverDir, '..');
dotenv.config({ path: resolve(serverDir, '.env') });

function getMysqlSettings() {
  const host = process.env.TEST_MYSQL_HOST || process.env.MYSQL_HOST || '127.0.0.1';
  if (!['127.0.0.1', 'localhost', '::1'].includes(host.toLowerCase())) {
    throw new Error('Isolated tests only support a local MySQL host. Set TEST_MYSQL_HOST to localhost.');
  }

  return {
    host,
    port: Number(process.env.TEST_MYSQL_PORT || process.env.MYSQL_PORT || 3306),
    user: process.env.TEST_MYSQL_USER || process.env.MYSQL_USER || 'root',
    password: process.env.TEST_MYSQL_PASSWORD ?? process.env.MYSQL_PASSWORD ?? '',
  };
}

async function getAvailablePort() {
  const server = createServer();
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const { port } = server.address();
  await new Promise((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose()));
  return port;
}

function quoteDatabaseName(databaseName) {
  if (!/^gusstora_(test|smoke)_[a-f0-9]+_[a-f0-9]+$/.test(databaseName)) {
    throw new Error(`Refusing to remove database with unexpected name: ${databaseName}`);
  }
  return `\`${databaseName}\``;
}

export async function createIsolatedApi(prefix = 'test', { production = false, clientUrl } = {}) {
  if (!['test', 'smoke'].includes(prefix)) {
    throw new Error('Isolated API prefix must be "test" or "smoke".');
  }

  const mysqlSettings = getMysqlSettings();
  const databaseName = `gusstora_${prefix}_${process.pid.toString(16)}_${randomBytes(5).toString('hex')}`;
  const databaseIdentifier = quoteDatabaseName(databaseName);
  const bootstrap = await mysql.createConnection({ ...mysqlSettings, database: 'mysql' });
  try {
    const [existing] = await bootstrap.query(
      'SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?',
      [databaseName]
    );
    if (existing.length) {
      throw new Error(`Refusing to reuse existing test database ${databaseName}.`);
    }
  } finally {
    await bootstrap.end();
  }

  const port = await getAvailablePort();
  const env = {
    ...process.env,
    MYSQL_URL: '',
    MYSQL_HOST: mysqlSettings.host,
    MYSQL_PORT: String(mysqlSettings.port),
    MYSQL_USER: mysqlSettings.user,
    MYSQL_PASSWORD: mysqlSettings.password,
    MYSQL_DATABASE: databaseName,
    JWT_SECRET: randomBytes(32).toString('hex'),
    RAZORPAY_WEBHOOK_SECRET: randomBytes(32).toString('hex'),
    PORT: String(port),
    NODE_ENV: production ? 'production' : 'test',
    CLIENT_URL: clientUrl || (production ? 'https://staging.example.test' : 'http://localhost:5173'),
    DOTENV_CONFIG_PATH: resolve(serverDir, '.env.test-not-loaded'),
  };
  const child = spawn(process.execPath, [resolve(serverDir, 'src', 'index.js')], {
    cwd: serverDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  const appendOutput = chunk => {
    output = `${output}${chunk}`.slice(-12000);
  };
  child.stdout.on('data', appendOutput);
  child.stderr.on('data', appendOutput);

  let stopped = false;
  let cleaned = false;
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    if (child.exitCode !== null || child.signalCode !== null) return;
    const exit = once(child, 'exit');
    child.kill();
    await exit;
  };

  const cleanup = async () => {
    if (cleaned) return;
    cleaned = true;
    await stop();
    const connection = await mysql.createConnection({ ...mysqlSettings, database: 'mysql' });
    try {
      const [schemas] = await connection.query(
        'SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?',
        [databaseName]
      );
      if (schemas.length) {
        await connection.query(`DROP DATABASE ${databaseIdentifier}`);
      }
    } finally {
      await connection.end();
    }
  };

  const baseUrl = `http://127.0.0.1:${port}/api`;
  const deadline = Date.now() + 90000;
  try {
    while (Date.now() < deadline) {
      if (child.exitCode !== null || child.signalCode !== null) {
        throw new Error(`Isolated API exited before becoming healthy.\n${output}`);
      }
      try {
        const response = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(1500) });
        if (response.ok) return { baseUrl, databaseName, env, stop, cleanup };
      } catch {}
      await new Promise(resolveDelay => setTimeout(resolveDelay, 500));
    }
    throw new Error(`Timed out waiting for isolated API health check.\n${output}`);
  } catch (error) {
    await cleanup();
    throw error;
  }
}

export { projectRoot, serverDir };
