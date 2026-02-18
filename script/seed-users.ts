import "dotenv/config";
import { hashPassword } from "../server/auth";
import { db } from "../server/db";
import { users } from "../shared/schema";

async function main() {
    try {
        console.log("Seeding users...");

        // Create Admin
        const adminPass = await hashPassword("admin123");
        try {
            await db.insert(users).values({
                username: "admin",
                password: adminPass,
                role: "admin",
                firstName: "Admin",
                lastName: "User",
                email: "admin@example.com"
            });
            console.log("Created user 'admin' with password 'admin123'");
        } catch (e: any) {
            if (e.code === '23505') { // Unique violation
                console.log("User 'admin' already exists.");
            } else {
                throw e;
            }
        }

        // Create Regular User
        const userPass = await hashPassword("user123");
        try {
            await db.insert(users).values({
                username: "user",
                password: userPass,
                role: "user",
                firstName: "Regular",
                lastName: "User",
                email: "user@example.com"
            });
            console.log("Created user 'user' with password 'user123'");
        } catch (e: any) {
            if (e.code === '23505') {
                console.log("User 'user' already exists.");
            } else {
                throw e;
            }
        }

        console.log("Seeding complete.");
        process.exit(0);
    } catch (err) {
        console.error("Error seeding users:", err);
        process.exit(1);
    }
}

main();
