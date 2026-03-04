import "dotenv/config";
import { db } from "./server/db";
import { customerPayments, invoices, deletedRecords, customers } from "./shared/schema";
import { sql, desc, eq, and } from "drizzle-orm";
import { format } from "date-fns";

async function diagnose() {
    console.log("--- EXHAUSTIVE DIAGNOSIS START ---");

    const today = format(new Date(), "yyyy-MM-dd");
    console.log(`Current Date: ${today}`);

    // 1. Search ALL Archived Data for 'OB-' (from deleted_records)
    console.log("\n1. Searching ALL Archived Data for 'OB-' (from deleted_records):");
    const archivedResult = await db.execute(sql`
        SELECT * FROM deleted_records 
        WHERE data LIKE '%OB-%'
        ORDER BY deleted_at DESC
    `);

    console.log(`Found ${archivedResult.rows.length} archived records containing 'OB-'.`);
    archivedResult.rows.forEach(r => {
        try {
            const data = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
            const invoiceNum = data.invoiceNumber || data.invoice_number || 'Unknown';
            const customerId = data.customerId || data.customer_id || 'Unknown';
            const amount = data.grandTotal || data.total || data.amount || 0;
            console.log(`- [${r.deleted_at}] Table: ${r.table_name}, ID: ${r.record_id}, Invoice#: ${invoiceNum}, Customer: ${customerId}, Value: ₹${amount}`);
        } catch (e) {
            console.log(`- [${r.deleted_at}] Raw Data Error: ${e.message}`);
        }
    });

    // 2. Current Zero-Total OB Invoices
    console.log("\n2. Current Zero-Total OB Invoices in Production:");
    const currentZeroOB = await db.execute(sql`
        SELECT i.id, i.invoice_number, i.customer_id, i.grand_total, i.date, c.name as customer_name
        FROM invoices i
        LEFT JOIN customers c ON i.customer_id = c.id
        WHERE i.invoice_number LIKE 'OB-%' AND i.grand_total = 0
    `);

    currentZeroOB.rows.forEach(inv => {
        console.log(`- Invoice: ${inv.id} (${inv.invoice_number}), Customer: ${inv.customer_name || 'Unknown'}, Total: ${inv.grand_total}, Date: ${inv.date}`);
    });

    // 3. Global Totals & Gap Analysis
    console.log("\n3. Gap Analysis (Customers vs OB Invoices):");
    const totalCustomers = await db.execute(sql`SELECT COUNT(*)::text as count FROM customers`);
    const totalOB = await db.execute(sql`SELECT COUNT(*)::text as count FROM invoices WHERE invoice_number LIKE 'OB-%'`);

    const custCount = parseInt(totalCustomers.rows[0].count as string);
    const obCount = parseInt(totalOB.rows[0].count as string);

    console.log(`Total Customers in Database: ${custCount}`);
    console.log(`Total OB Invoices in Database: ${obCount}`);
    console.log(`Missing OB Invoices: ${custCount - obCount}`);

    if (custCount > obCount) {
        console.log("\nTop 10 Customers Missing OB Invoices:");
        const missing = await db.execute(sql`
            SELECT name, id FROM customers 
            WHERE id NOT IN (SELECT customer_id FROM invoices WHERE invoice_number LIKE 'OB-%')
            LIMIT 10
        `);
        missing.rows.forEach(r => console.log(`- ${r.name} (ID: ${r.id})`));
    }

    const totalSales = await db.execute(sql`SELECT SUM(grand_total)::text as total FROM invoices`);
    const totalPayments = await db.execute(sql`SELECT SUM(amount)::text as total FROM customer_payments`);

    const sales = parseFloat(totalSales.rows[0].total || "0");
    const payments = parseFloat(totalPayments.rows[0].total || "0");

    console.log("\n4. Current System Totals (All Time):");
    console.log(`Total Sales: ₹${sales.toLocaleString("en-IN")}`);
    console.log(`Total Payments: ₹${payments.toLocaleString("en-IN")}`);
    console.log(`Net Balance: ₹${(sales - payments).toLocaleString("en-IN")}`);

    console.log("\n--- DIAGNOSIS END ---");
    process.exit(0);
}

diagnose().catch(console.error);
