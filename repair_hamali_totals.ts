import "dotenv/config";
import { db } from "./server/db";
import { invoices, invoiceItems } from "./shared/schema";
import { eq, sql } from "drizzle-orm";

async function repair() {
    console.log("Starting Hamali data repair...");

    const allInvoices = await db.select().from(invoices);
    console.log(`Auditing ${allInvoices.length} invoices...`);

    let repairedCount = 0;

    for (const inv of allInvoices) {
        if (inv.invoiceNumber.startsWith("OB-")) continue;

        // Get items for this invoice
        const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, inv.id));
        const subtotal = items.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
        const hamali = Number(inv.hamaliChargeAmount || 0);
        const expectedGrandTotal = subtotal + hamali;
        const currentGrandTotal = Number(inv.grandTotal || 0);
        const currentSubtotal = Number(inv.subtotal || 0);

        // Check for discrepancy (allow small float diff)
        if (Math.abs(currentGrandTotal - expectedGrandTotal) > 0.01 || Math.abs(currentSubtotal - subtotal) > 0.01) {
            console.log(`Repairing Invoice ${inv.invoiceNumber}:`);
            console.log(`  Current Subtotal: ${currentSubtotal}, Expected: ${subtotal}`);
            console.log(`  Current GrandTotal: ${currentGrandTotal}, Expected: ${expectedGrandTotal} (Hamali: ${hamali})`);

            await db.update(invoices)
                .set({
                    grandTotal: expectedGrandTotal,
                    subtotal: subtotal
                })
                .where(eq(invoices.id, inv.id));

            repairedCount++;
        }
    }

    console.log(`Repair complete. ${repairedCount} invoices were corrected.`);
    process.exit(0);
}

repair().catch(err => {
    console.error("Repair failed:", err);
    process.exit(1);
});
