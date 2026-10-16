import { Sequelize } from 'sequelize';

export async function runMigrations({ sequelize, migrations = [] }) {
  const queryInterface = sequelize.getQueryInterface();

  await queryInterface.createTable('schema_migrations', {
    id: { type: 'VARCHAR(255)', allowNull: false, primaryKey: true },
    appliedAt: { type: 'DATETIME', allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
  }, { logging: false });

  for (const migration of migrations) {
    const existing = await sequelize.query('SELECT 1 FROM schema_migrations WHERE id = ?', {
      replacements: [migration.id],
      raw: true,
      logging: false,
    });

    if (Array.isArray(existing) && existing[0] && existing[0].length > 0) {
      continue;
    }

    await migration.up({ sequelize, queryInterface });
    await sequelize.query('INSERT INTO schema_migrations (id) VALUES (?)', {
      replacements: [migration.id],
      logging: false,
    });
  }
}
