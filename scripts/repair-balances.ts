import "dotenv/config";
import { db } from "../server/db";
import { invoices, customerPayments } from "@shared/schema";
import { inArray } from "drizzle-orm";

async function run() {
    console.log("Starting repair script: Removing orphaned ghost payments...");

    // 1. Fetch all active invoices
    const allInvoices = await db.select({ id: invoices.id }).from(invoices);
    const activeInvoiceIds = new Set(allInvoices.map(i => i.id));

    // 2. Fetch all customer payments
    const allCustomerPayments = await db.select().from(customerPayments);

    // 3. Find orphaned payments
    const orphanedPayments = allCustomerPayments.filter(p => p.invoiceId && !activeInvoiceIds.has(p.invoiceId));

    const orphanedTotal = orphanedPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

    console.log(`Found ${orphanedPayments.length} orphaned payments.`);
    console.log(`Total phantom amount to remove: Rs ${orphanedTotal}`);

    // 4. Delete them
    if (orphanedPayments.length > 0) {
        const idsToDelete = orphanedPayments.map(p => p.id);
        console.log("Deleting orphaned payments from database...");

        // Delete in chunks if there are many, but 49 is small enough for one query
        await db.delete(customerPayments).where(inArray(customerPayments.id, idsToDelete));

        console.log("Cleanup complete. The ghost payments have been removed.");
    } else {
        console.log("No orphaned payments found. System is clean.");
    }
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
