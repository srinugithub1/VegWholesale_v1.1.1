import "dotenv/config";
import { db } from "../server/db";
import { invoices, customerPayments } from "@shared/schema";
import { eq } from "drizzle-orm";
import { format } from "date-fns";

async function fix() {
    const invNumber = "INV-1774154549857";

    // 1. Find the invoice
    const [invoice] = await db.select().from(invoices).where(eq(invoices.invoiceNumber, invNumber));

    if (!invoice) {
        console.error("Invoice not found.");
        process.exit(1);
    }

    // 2. Check current payments
    const existingPayments = await db.select().from(customerPayments).where(eq(customerPayments.invoiceId, invoice.id));
    const totalPaid = existingPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const expected = Number(invoice.grandTotal || 0);

    console.log(`Invoice ${invNumber} Expected: ${expected}, Current Paid: ${totalPaid}`);

    if (Math.abs(expected - totalPaid) < 0.01) {
        console.log("Invoice is already fully paid.");
        process.exit(0);
    }

    const difference = expected - totalPaid;
    console.log(`Fixing discrepancy by adding payment of Rs ${difference}`);

    // 3. Add the missing payment
    await db.insert(customerPayments).values({
        customerId: invoice.customerId,
        invoiceId: invoice.id,
        amount: difference,
        date: format(new Date(), "yyyy-MM-dd"), // Today
        paymentMethod: "cash",
        notes: "Auto-correction for unpaid 416 Rs difference"
    });

    console.log("Missing payment inserted successfully.");
}

fix().catch(console.error).then(() => process.exit(0));
