
import { db } from "./server/db";
import { invoices, invoiceItems } from "./shared/schema";
import { eq, and, isNull } from "drizzle-orm";

async function fixInvoiceItems() {
    console.log("Starting data correction for invoice_items...");

    // Get all invoices that have a vehicleId
    const allInvoices = await db.select().from(invoices);
    const invoicesWithVehicle = allInvoices.filter(inv => inv.vehicleId);

    console.log(`Found ${invoicesWithVehicle.length} invoices with vehicles.`);

    let updatedCount = 0;

    for (const inv of invoicesWithVehicle) {
        // Update items for this invoice if they don't have a vehicleId
        const result = await db.update(invoiceItems)
            .set({ vehicleId: inv.vehicleId })
            .where(
                and(
                    eq(invoiceItems.invoiceId, inv.id),
                    isNull(invoiceItems.vehicleId)
                )
            )
            .returning();

        if (result.length > 0) {
            updatedCount += result.length;
            console.log(`Updated ${result.length} items for invoice ${inv.invoiceNumber}`);
        }
    }

    console.log(`Correction complete. Total items updated: ${updatedCount}`);
    process.exit(0);
}

fixInvoiceItems().catch(err => {
    console.error(err);
    process.exit(1);
});
