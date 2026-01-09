
import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
    console.log("❌ No DATABASE_URL found.");
    process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
let host = "Unknown";

try {
    // Basic parsing to hide password but show host
    const url = new URL(connectionString);
    host = url.hostname;

    console.log("-----------------------------------------");
    console.log(`Current Database Host: ${host}`);

    if (host.includes("render.com")) {
        console.log("✅ STATUS: CONNECTED TO RENDER CLOUD");
    } else if (host.includes("localhost") || host.includes("127.0.0.1")) {
        console.log("⚠️ STATUS: CONNECTED TO LOCALHOST (Local System)");
    } else {
        console.log("❓ STATUS: Connected to " + host);
    }
    console.log("-----------------------------------------");

} catch (e) {
    console.log("Error parsing URL:", e.message);
}
