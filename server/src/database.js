export function buildBootstrapConnectionConfig(env = process.env) {
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
