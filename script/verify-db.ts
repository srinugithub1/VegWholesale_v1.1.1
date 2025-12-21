import "dotenv/config";
import { Client } from 'pg';

const currentUrl = process.env.DATABASE_URL || "";
// Force 127.0.0.1
const ipv4Url = currentUrl.replace("localhost", "127.0.0.1");

console.log("Testing IPv4 URL:", ipv4Url.replace(/:([^:@]+)@/, ":****@"));

const client = new Client({
    connectionString: ipv4Url,
});

async function test() {
    try {
        await client.connect();
        console.log("SUCCESS! Connected via 127.0.0.1");
        // Also try to update .env if this works
        console.log("UPDATING .env TO USE 127.0.0.1...");
        process.exit(0);
    } catch (err) {
        console.error("Connection error:", err.message);
        process.exit(1);
    }
}

test();
