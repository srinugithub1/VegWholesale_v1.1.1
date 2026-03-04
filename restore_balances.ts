import "dotenv/config";
import { db } from "./server/db";
import { invoices, customers } from "./shared/schema";
import { sql, eq, and } from "drizzle-orm";

const restorationData = [
    { name: "JSR % JR WARNGAL", value: 273287 },
    { name: "SL VEGGIS VEG INDPVT", value: 321750.13 },
    { name: "GSR %G NIKITHA", value: 137208 },
    { name: "HEMANTH REDDY %", value: 193303 },
    { name: "MM VEGETABLE MERCHANT", value: 207894 },
    { name: "SRIKANTH BV", value: 121427 },
    { name: "ANJI YADAV", value: 331272 },
    { name: "BATHULA SRINU", value: 132399 },
    { name: "BMC ASHOK% VINAY", value: 83805 },
    { name: "MS GHATKESAR", value: 10464 }
];

async function restore() {
    console.log("--- BALANCE RESTORATION START ---");
    let totalRestored = 0;

    for (const entry of restorationData) {
        // 1. Find Customer by Name (using ILIKE for robustness)
        const customerResult = await db.execute(sql`
            SELECT id, name FROM customers WHERE name ILIKE ${entry.name + '%'}
        `);

        if (customerResult.rows.length === 0) {
            console.warn(`[SKIP] Customer not found: ${entry.name}`);
            continue;
        }

        const customerId = customerResult.rows[0].id as string;
        const customerName = customerResult.rows[0].name as string;

        // 2. Find their OB- invoice
        const obInvoiceResult = await db.execute(sql`
            SELECT id, invoice_number, grand_total FROM invoices 
            WHERE customer_id = ${customerId} AND invoice_number LIKE 'OB-%'
        `);

        if (obInvoiceResult.rows.length === 0) {
            console.log(`[CREATE] No OB invoice for ${customerName}. Creating new...`);
            // Create a unique OB number if needed, but let's try to match existing pattern
            const newObNum = `OB-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
            await db.insert(invoices).values({
                invoiceNumber: newObNum,
                customerId: customerId,
                date: "2026-03-03", // Standard OB date from diagnostic
                grandTotal: entry.value,
                subtotal: entry.value,
                status: "completed",
                paymentStatus: "unpaid"
            });
            console.log(`Successfully created ${newObNum} for ${customerName} with ₹${entry.value}`);
            totalRestored += entry.value;
        } else {
            const invoiceId = obInvoiceResult.rows[0].id as string;
            const invoiceNum = obInvoiceResult.rows[0].invoice_number as string;
            const currentTotal = Number(obInvoiceResult.rows[0].grand_total);

            if (currentTotal === entry.value) {
                console.log(`[KEEP] ${customerName} already has correct balance ₹${entry.value}`);
            } else {
                console.log(`[UPDATE] ${customerName} (${invoiceNum}): ₹${currentTotal} -> ₹${entry.value}`);
                await db.update(invoices)
                    .set({ grandTotal: entry.value, subtotal: entry.value })
                    .where(eq(invoices.id, invoiceId));
                totalRestored += entry.value;
            }
        }
    }

    console.log(`\n--- Restoration Complete ---`);
    console.log(`Total Value Restored: ₹${totalRestored.toLocaleString("en-IN")}`);
    process.exit(0);
}

restore().catch(console.error);
