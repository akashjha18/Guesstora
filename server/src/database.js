export function parseMysqlUrl(mysqlUrl) {
  let url;
  try {
    url = new URL(String(mysqlUrl || '').trim());
  } catch {
    throw new Error('MYSQL_URL must be a valid MySQL connection URL.');
  }

  if (url.protocol !== 'mysql:') {
    throw new Error('MYSQL_URL must use the mysql:// protocol.');
  }

  const databaseName = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
  if (!databaseName) {
    throw new Error('MYSQL_URL must include a database name.');
  }

  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    databaseName,
  };
}

export function buildBootstrapConnectionConfig(env = process.env) {
  if (env.MYSQL_URL) {
    return {
      ...parseMysqlUrl(env.MYSQL_URL),
      database: 'mysql',
    };
  }

  return {
    host: String(env.MYSQL_HOST || '127.0.0.1').trim(),
    port: Number(env.MYSQL_PORT || 3306),
    user: String(env.MYSQL_USER || 'root').trim(),
    password: String(env.MYSQL_PASSWORD || '').trim(),
    database: 'mysql',
  };
}

export function buildCreateDatabaseSql(databaseName) {
  const safeDb = String(databaseName || '').trim();
  if (!safeDb) {
    throw new Error('Database name is required.');
  }

  return `CREATE DATABASE IF NOT EXISTS \`${safeDb}\`;`;
}
