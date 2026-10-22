import { parseMysqlUrl } from './database.js';

export function validateAppConfig(env = process.env) {
  const mysqlUrl = env.MYSQL_URL ? String(env.MYSQL_URL).trim() : undefined;
  const urlConfig = mysqlUrl ? parseMysqlUrl(mysqlUrl) : null;
  const configuredDatabaseName = String(env.MYSQL_DATABASE || '').trim();
  if (configuredDatabaseName && urlConfig && configuredDatabaseName !== urlConfig.databaseName) {
    throw new Error('MYSQL_DATABASE must match the database name in MYSQL_URL.');
  }

  const databaseName = configuredDatabaseName || urlConfig?.databaseName || '';
  const jwtSecret = String(env.JWT_SECRET || '').trim();
  const portValue = Number(env.PORT || 5000);
  const trustProxyHops = Number(env.TRUST_PROXY_HOPS || 0);
  const clientUrl = String(env.CLIENT_URL || '').trim();

  if (!databaseName) {
    throw new Error('MYSQL_DATABASE is required.');
  }

  if (!jwtSecret) {
    throw new Error('JWT_SECRET is required.');
  }

  if (env.NODE_ENV === 'production' && jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production.');
  }

  if (env.NODE_ENV === 'production') {
    if (!clientUrl) {
      throw new Error('CLIENT_URL must contain the HTTPS frontend origin in production.');
    }
    for (const origin of clientUrl.split(',').map(value => value.trim())) {
      try {
        const parsedOrigin = new URL(origin);
        if (parsedOrigin.protocol !== 'https:' || parsedOrigin.origin !== origin) {
          throw new Error();
        }
      } catch {
        throw new Error('CLIENT_URL must contain only HTTPS origins without paths in production.');
      }
    }
  }

  if (!Number.isFinite(portValue) || portValue <= 0 || portValue > 65535) {
    throw new Error('PORT must be a valid TCP port.');
  }

  if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0) {
    throw new Error('TRUST_PROXY_HOPS must be a non-negative integer.');
  }

  return {
    databaseName,
    jwtSecret,
    port: portValue,
    trustProxyHops,
    host: String(env.MYSQL_HOST || urlConfig?.host || '127.0.0.1').trim(),
    user: String(env.MYSQL_USER || urlConfig?.user || 'root').trim(),
    password: String(env.MYSQL_PASSWORD || urlConfig?.password || '').trim(),
    mysqlUrl,
  };
}
