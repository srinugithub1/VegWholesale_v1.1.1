import "dotenv/config";
import { db } from "../server/db";
import { invoices, customerPayments, customers } from "@shared/schema";
import { eq } from "drizzle-orm";
import * as fs from "fs";

async function findMissing() {
    const targetDate = "2026-03-22";

    // 1. Find Direct Customers (Cash Accounts)
    const allCustomers = await db.select().from(customers);
    const directCustomerIds = new Set(
        allCustomers
            .filter(c => c.name.toLowerCase().includes("cash"))
            .map(c => c.id)
    );

    // 2. Get today's Direct Customer INVOICES
    const allInvoices = await db.select().from(invoices);
    const todaysInvoices = allInvoices.filter(i => i.date === targetDate);
    const directInvoices = todaysInvoices.filter(i => directCustomerIds.has(i.customerId));

    // 3. Get all today's payments
    const todaysPayments = await db.select().from(customerPayments).where(eq(customerPayments.date, targetDate));

    const discrepancies = [];

    for (const inv of directInvoices) {
        // Find payments for this invoice
        const invPayments = todaysPayments.filter(p => p.invoiceId === inv.id);
        const totalPaid = invPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
        const expected = Number(inv.grandTotal || 0);

        if (Math.abs(expected - totalPaid) > 0.01) {
            discrepancies.push({
                invoiceNumber: inv.invoiceNumber,
                expectedAmount: expected,
                actualPaidAmount: totalPaid,
                difference: expected - totalPaid
            });
        }
    }

    console.log("=== Found Mismatched Cash Invoices Today ===");
    console.table(discrepancies);

    fs.writeFileSync("mismatched_invoices.json", JSON.stringify(discrepancies, null, 2));
}

findMissing().catch(console.error).then(() => process.exit(0));
