import "dotenv/config";
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
    console.log("Creating system_metrics table...");
    try {
        await db.execute(sql`
      CREATE TABLE IF NOT EXISTS system_metrics (
        id text PRIMARY KEY DEFAULT gen_random_uuid(),
        date text NOT NULL,
        db_size_bytes real NOT NULL,
        created_at timestamp DEFAULT CURRENT_TIMESTAMP
      );
    `);
        console.log("Success: system_metrics table created (or already exists).");
    } catch (error) {
        console.error("Error creating table:", error);
    }
    process.exit(0);
}

main();
