import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function run() {
    console.log("Running migration...");
    try {
        db.run(sql`ALTER TABLE vehicles ADD COLUMN shop INTEGER NOT NULL DEFAULT 45`);
        console.log("Migration successful");
    } catch (error: any) {
        if (error.message && error.message.includes("duplicate column name")) {
            console.log("Column already exists");
        } else {
            console.error("Migration failed:", error);
        }
    }
}

run();
