
import { db } from "../server/db";
import { invoices } from "../shared/schema";
import { eq, desc } from "drizzle-orm";

async function checkInvoices() {
    console.log("Checking invoices...");
    const allInvoices = await db.select().from(invoices).orderBy(desc(invoices.date)).limit(10);

    console.log("Last 10 invoices:");
    allInvoices.forEach(inv => {
        console.log(`ID: ${inv.id}, Date: ${inv.date}, Status: ${inv.status}, GrandTotal: ${inv.grandTotal}, CustomerId: ${inv.customerId}`);
    });

    const pendingInvoices = await db.select().from(invoices).where(eq(invoices.status, 'pending')).orderBy(desc(invoices.date)).limit(10);
    console.log("\nLast 10 PENDING invoices:");
    pendingInvoices.forEach(inv => {
        console.log(`ID: ${inv.id}, Date: ${inv.date}, Status: ${inv.status}, GrandTotal: ${inv.grandTotal}, CustomerId: ${inv.customerId}`);
    });
}

checkInvoices().catch(console.error).finally(() => process.exit());
