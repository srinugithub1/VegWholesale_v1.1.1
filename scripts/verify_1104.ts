import "dotenv/config";
import { db } from "../server/db";
import { invoices, customerPayments, customers } from "@shared/schema";
import { eq } from "drizzle-orm";

async function verify() {
    const targetDate = "2026-03-22";

    // 1. Get all today's payments
    const todaysPayments = await db.select().from(customerPayments).where(eq(customerPayments.date, targetDate));
    const totalSystemPayments = todaysPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

    // 2. Get all all-time active invoices to find orphans
    const allInvoices = await db.select().from(invoices);
    const activeInvoiceIds = new Set(allInvoices.map(i => i.id));

    const orphanedPayments = todaysPayments.filter(p => p.invoiceId && !activeInvoiceIds.has(p.invoiceId));
    const orphanedTotal = orphanedPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

    // 3. Find Direct Customers (Cash Accounts)
    const allCustomers = await db.select().from(customers);
    const directCustomerIds = new Set(
        allCustomers
            .filter(c => c.name.toLowerCase() === "cash account" || c.name.toLowerCase() === "cash sale account" || c.name.toLowerCase() === "cash")
            .map(c => c.id)
    );

    // 4. Get today's Direct Customer INVOICES (Sales)
    const todaysInvoices = allInvoices.filter(i => i.date === targetDate);
    const directInvoices = todaysInvoices.filter(i => directCustomerIds.has(i.customerId));
    const directSalesTotal = directInvoices.reduce((sum, i) => sum + Number(i.grandTotal || 0), 0);

    // 5. Get today's Linked Payments for Direct Customers
    const linkedDirectPayments = todaysPayments.filter(p => p.invoiceId && activeInvoiceIds.has(p.invoiceId) && directCustomerIds.has(p.customerId));
    const directPaymentsTotal = linkedDirectPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

    // 6. Standalone payments (Manual Entries)
    const standalonePayments = todaysPayments.filter(p => !p.invoiceId);
    const standaloneTotal = standalonePayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

    console.log("=== Verification of 1104 Rs Discrepancy ===");
    console.log(`UI Display (Total Payments): ${totalSystemPayments}`);
    console.log(`User's Manual Formula: Direct Sales (${directSalesTotal}) + Standalone Payments (${standaloneTotal}) = ${directSalesTotal + standaloneTotal}`);
    console.log(`Difference: ${totalSystemPayments - (directSalesTotal + standaloneTotal)}\n`);

    console.log(`Breakdown of the difference:`);
    console.log(`  Orphaned Ghost Payments (created before server reboot): +${orphanedTotal}`);
    console.log(`  Unpaid amount on Direct Invoices (Sales ${directSalesTotal} - Payments ${directPaymentsTotal}): -${directSalesTotal - directPaymentsTotal}`);
    console.log(`  Net Mathematical Difference: ${orphanedTotal - (directSalesTotal - directPaymentsTotal)}`);

    console.log("\nIf we ONLY clean the orphans, the true collected amount is:");
    console.log(`  ${totalSystemPayments} - ${orphanedTotal} = ${totalSystemPayments - orphanedTotal}`);
}

verify().catch(console.error).then(() => process.exit(0));
