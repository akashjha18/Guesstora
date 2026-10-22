import { Sequelize } from 'sequelize';
import { parseMysqlUrl } from './database.js';

const mysqlUrl = process.env.MYSQL_URL ? String(process.env.MYSQL_URL).trim() : undefined;
const config = {
  databaseName: String(process.env.MYSQL_DATABASE || (mysqlUrl ? parseMysqlUrl(mysqlUrl).databaseName : 'cafe_loyalty')).trim(),
  jwtSecret: String(process.env.JWT_SECRET || 'dev-secret-change-me').trim(),
  port: Number(process.env.PORT || 5000),
  host: String(process.env.MYSQL_HOST || '127.0.0.1').trim(),
  user: String(process.env.MYSQL_USER || 'root').trim(),
  password: String(process.env.MYSQL_PASSWORD || '').trim(),
  mysqlUrl,
};

// Accepts either a full MYSQL_URL (mysql://user:pass@host:port/db)
// or discrete MYSQL_HOST / MYSQL_PORT / MYSQL_USER / MYSQL_PASSWORD / MYSQL_DATABASE vars.
export const sequelize = config.mysqlUrl
  ? new Sequelize(config.mysqlUrl, { logging: false })
  : new Sequelize(config.databaseName, config.user, config.password, {
      host: config.host,
      port: Number(process.env.MYSQL_PORT || 3306),
      dialect: 'mysql',
      logging: false,
    });

export { config };
