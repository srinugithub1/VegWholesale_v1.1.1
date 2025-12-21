import "dotenv/config";
import { Client } from 'pg';

const url = "postgres://postgres:password123@127.0.0.1:5432/postgres";
const client = new Client({ connectionString: url });

async function main() {
    await client.connect();
    console.log("Connected to postgres system db.");
    try {
        await client.query("CREATE DATABASE vegwholesale");
        console.log("Database 'vegwholesale' created successfully.");
    } catch (err) {
        if (err.code === '42P04') {
            console.log("Database 'vegwholesale' already exists.");
        } else {
            console.error("Error creating database:", err);
        }
    }
    await client.end();
}

main();
