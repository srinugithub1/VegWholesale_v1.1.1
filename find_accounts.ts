import "dotenv/config";
import { db } from "./server/db";
import { customers } from "./shared/schema";
import { sql } from "drizzle-orm";

async function run() {
    const res = await db.select().from(customers).where(sql`name ILIKE 'Cash%'`);
    console.log(JSON.stringify(res, null, 2));
    process.exit(0);
}

run().catch(console.error);
