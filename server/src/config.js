export function validateAppConfig(env = process.env) {
  const databaseName = String(env.MYSQL_DATABASE || '').trim();
  const jwtSecret = String(env.JWT_SECRET || '').trim();
  const portValue = Number(env.PORT || 5000);

  if (!databaseName) {
    throw new Error('MYSQL_DATABASE is required.');
  }

  if (!jwtSecret) {
    throw new Error('JWT_SECRET is required.');
  }

  if (!Number.isFinite(portValue) || portValue <= 0 || portValue > 65535) {
    throw new Error('PORT must be a valid TCP port.');
  }

  return {
    databaseName,
    jwtSecret,
    port: portValue,
    host: String(env.MYSQL_HOST || '127.0.0.1').trim(),
    user: String(env.MYSQL_USER || 'root').trim(),
    password: String(env.MYSQL_PASSWORD || '').trim(),
    mysqlUrl: env.MYSQL_URL ? String(env.MYSQL_URL).trim() : undefined,
  };
}
