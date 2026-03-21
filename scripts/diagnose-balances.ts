import "dotenv/config";
import { db } from "../server/db";
import { invoices, customerPayments } from "@shared/schema";
import { inArray, isNull, notInArray, eq, sql } from "drizzle-orm";

async function runDiagnostics() {
    console.log("Starting data diagnostics...");

    // 1. Fetch all active invoices
    const allInvoices = await db.select({ id: invoices.id }).from(invoices);
    const activeInvoiceIds = new Set(allInvoices.map(i => i.id));

    // 2. Fetch all customer payments
    const allCustomerPayments = await db.select().from(customerPayments);

    // 3. Find orphaned payments (linked to an invoiceId that no longer exists)
    const orphanedPayments = allCustomerPayments.filter(p => p.invoiceId && !activeInvoiceIds.has(p.invoiceId));

    const orphanedCount = orphanedPayments.length;
    const orphanedTotalAmount = orphanedPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

    console.log("-----------------------------------------");
    console.log(`Orphaned Customer Payments Found: ${orphanedCount}`);
    console.log(`Total Amount of Orphaned Payments: Rs ${orphanedTotalAmount}`);

    // Group by date or print a few
    if (orphanedCount > 0) {
        console.log("\nSample Orphaned Payments:");
        orphanedPayments.slice(0, 5).forEach(p => {
            console.log(` - ID: ${p.id}, Amount: ${p.amount}, Date: ${p.date}, Linked Invoice: ${p.invoiceId}`);
        });
    }

    // 4. Check for payments with no invoice link at all (pure cash payments without invoice?)
    const standalonePayments = allCustomerPayments.filter(p => !p.invoiceId);
    const standaloneTotal = standalonePayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    console.log(`\nStandalone Payments (No Invoice ID): ${standalonePayments.length}`);
    console.log(`Total Amount of Standalone Payments: Rs ${standaloneTotal}`);

    console.log("-----------------------------------------");
    process.exit(0);
}

runDiagnostics().catch(e => {
    console.error(e);
    process.exit(1);
});
