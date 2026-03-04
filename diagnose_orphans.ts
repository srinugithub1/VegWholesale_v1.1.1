import "dotenv/config";
import { db } from "./server/db";
import { customerPayments, invoices, customers } from "./shared/schema";
import { sql, eq } from "drizzle-orm";

async function findOrphans() {
    console.log("--- ORPHAN ANALYSIS ---");

    // 1. Get Orphan Payment Details
    const orphans = await db.execute(sql`
        SELECT p.id, p.amount, p.customer_id, p.invoice_id, c.name as customer_name
        FROM customer_payments p 
        LEFT JOIN invoices i ON p.invoice_id = i.id 
        LEFT JOIN customers c ON p.customer_id = c.id
        WHERE p.invoice_id IS NOT NULL AND i.id IS NULL
    `);

    console.log(`Found ${orphans.rows.length} orphan payments:`);
    orphans.rows.forEach(r => {
        console.log(`- Amount: ₹${r.amount}, Customer: ${r.customer_name}, Target InvoiceID: ${r.invoice_id}`);
    });

    // 2. See if these customers have ZERO OB invoices
    const affectedCustomers = orphans.rows.map(r => r.customer_id);
    if (affectedCustomers.length > 0) {
        console.log("\nChecking for OB invoices for these customers:");
        const obInvoices = await db.execute(sql`
            SELECT invoice_number, grand_total, customer_id FROM invoices 
            WHERE invoice_number LIKE 'OB-%' AND customer_id IN (${sql.join(affectedCustomers.map(id => sql`${id}`), sql`,`)})
        `);
        obInvoices.rows.forEach(r => {
            console.log(`- CustomerID: ${r.customer_id}, OB-Invoice: ${r.invoice_number}, Total: ${r.grand_total}`);
        });
    }

    console.log("\n--- END ---");
    process.exit(0);
}

findOrphans().catch(console.error);
