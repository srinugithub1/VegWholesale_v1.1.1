import "dotenv/config";
import { db } from "./server/db";
import { invoices, customerPayments, customers } from "./shared/schema";
import { eq, sql } from "drizzle-orm";

async function analyze() {
    const today = "2026-03-04";
    console.log(`--- Payment Analysis for ${today} ---`);

    // Get all payments for today
    const payments = await db.select({
        id: customerPayments.id,
        amount: customerPayments.amount,
        date: customerPayments.date,
        customerId: customerPayments.customerId,
        invoiceId: customerPayments.invoiceId,
        customerName: customers.name
    })
        .from(customerPayments)
        .leftJoin(customers, eq(customerPayments.customerId, customers.id))
        .where(eq(customerPayments.date, today));

    console.log(`Total Payments Count: ${payments.length}`);

    let totalAmount = 0;
    let cashAccountAmount = 0;
    let orphanAmount = 0;

    for (const p of payments) {
        const amt = Number(p.amount || 0);
        totalAmount += amt;

        if (p.customerName === "CASH ACCOUNT") {
            cashAccountAmount += amt;
        }

        if (p.invoiceId) {
            const [inv] = await db.select().from(invoices).where(eq(invoices.id, p.invoiceId));
            if (!inv) {
                orphanAmount += amt;
                console.log(`Orphan Payment: ${p.customerName}, Amount: ${amt}, ID: ${p.id}`);
            }
        }
    }

    console.log(`\nTotal Amount: ${totalAmount}`);
    console.log(`CASH ACCOUNT Payments: ${cashAccountAmount}`);
    console.log(`Orphan Payments: ${orphanAmount}`);
    console.log(`Net (General Customers): ${totalAmount - cashAccountAmount}`);

    // List top 10 payments for context
    console.log("\nTop 10 Payments:");
    payments.sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 10).forEach(p => {
        console.log(`- ${p.customerName}: ${p.amount} (Invoice: ${p.invoiceId || 'N/A'})`);
    });

    process.exit(0);
}

analyze().catch(console.error);
