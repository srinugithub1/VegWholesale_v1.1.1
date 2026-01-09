
import 'dotenv/config';
import { db } from './server/db';
import { vehicles, products, users } from '@shared/schema';
import { sql } from 'drizzle-orm';

async function checkData() {
    try {
        console.log("-----------------------------------------");
        console.log("Checking Data in Current Connection...");

        // Check Vehicles
        const vehicleCount = await db.select({ count: sql`count(*)` }).from(vehicles);
        console.log(`Vehicles Count: ${vehicleCount[0].count}`);

        // Check Products
        const productCount = await db.select({ count: sql`count(*)` }).from(products);
        console.log(`Products Count: ${productCount[0].count}`);

        console.log("-----------------------------------------");
        process.exit(0);
    } catch (error) {
        console.error("Error checking data:", error);
        process.exit(1);
    }
}

checkData();
