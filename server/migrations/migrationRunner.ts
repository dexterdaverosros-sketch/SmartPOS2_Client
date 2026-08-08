import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function runMigrations(db: Database.Database): void {
  // Create schema_migrations table if missing
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      executed_at TEXT NOT NULL
    );
  `);

  const migrationsDir = __dirname;
  if (!fs.existsSync(migrationsDir)) return;

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const executedRows = db.prepare('SELECT version FROM schema_migrations').all() as { version: string }[];
  const executedVersions = new Set(executedRows.map(r => r.version));

  for (const file of files) {
    if (!executedVersions.has(file)) {
      console.log(`[MIGRATIONS] Executing migration: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      db.transaction(() => {
        db.exec(sql);
        db.prepare('INSERT INTO schema_migrations (version, executed_at) VALUES (?, ?)').run(file, new Date().toISOString());
      })();
      console.log(`[MIGRATIONS] Migration ${file} applied successfully.`);
    }
  }
}
