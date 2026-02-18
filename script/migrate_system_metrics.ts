
import { pool } from "../server/db";

async function runMigration() {
    const client = await pool.connect();
    try {
        console.log("Running migration...");
        await client.query(`
      CREATE TABLE IF NOT EXISTS system_metrics (
        id text PRIMARY KEY DEFAULT gen_random_uuid(),
        date text NOT NULL,
        db_size_bytes real NOT NULL,
        created_at timestamp DEFAULT now()
      );
    `);
        console.log("Migration completed successfully.");
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        client.release();
        process.exit(0);
    }
}

runMigration();
