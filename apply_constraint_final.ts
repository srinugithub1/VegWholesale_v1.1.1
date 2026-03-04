import "dotenv/config";
import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function applyConstraint() {
    console.log("Applying Hard Database Constraint...");
    try {
        await db.execute(sql`
            ALTER TABLE invoices 
            ADD CONSTRAINT check_ob_total 
            CHECK (NOT (invoice_number LIKE 'OB-%' AND grand_total = 0))
        `);
        console.log("SUCCESS: Hard Database Constraint 'check_ob_total' applied.");
        console.log("This physically prevents any code from zeroing out Opening Balance invoices.");
    } catch (e: any) {
        if (e.message.includes("already exists")) {
            console.log("INFO: Constraint already exists. Safety is already active.");
        } else {
            console.error("ERROR applying constraint:", e.message);
        }
    }
    process.exit(0);
}

applyConstraint().catch(console.error);
