
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
    console.log("Running migration: Adding vehicle_id to invoice_items...");

    try {
        await db.run(sql`
      ALTER TABLE invoice_items ADD COLUMN vehicle_id text;
    `);
        console.log("Migration successful!");
    } catch (error) {
        console.error("Migration failed:", error);
    }
}

main().catch(console.error);
