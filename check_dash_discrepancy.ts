import "dotenv/config";
import { db } from "./server/db";
import { invoices, customerPayments, invoiceItems } from "./shared/schema";
import { eq, sql, and, gte, lte } from "drizzle-orm";

async function diagnose() {
    const today = "2026-03-04";

    console.log(`--- Diagnosis for ${today} ---`);

    // 1. Check Hamali in Grand Totals
    const todayInvoices = await db.select().from(invoices).where(eq(invoices.date, today));

    let totalGrandTotal = 0;
    let totalSubtotal = 0;
    let totalHamali = 0;
    let problematicInvoices = 0;

    for (const inv of todayInvoices) {
        totalGrandTotal += Number(inv.grandTotal || 0);
        totalSubtotal += Number(inv.subtotal || 0);
        totalHamali += Number(inv.hamaliChargeAmount || 0);

        const expectedGrandTotal = Number(inv.subtotal || 0) + Number(inv.hamaliChargeAmount || 0);
        if (Math.abs(Number(inv.grandTotal) - expectedGrandTotal) > 0.01) {
            if (problematicInvoices < 5) {
                console.log(`Invoice ${inv.invoiceNumber}: DB GrandTotal=${inv.grandTotal}, Expected=${expectedGrandTotal} (Sub=${inv.subtotal}, Hamali=${inv.hamaliChargeAmount})`);
            }
            problematicInvoices++;
        }
    }

    console.log(`Today's Invoices Count: ${todayInvoices.length}`);
    console.log(`Total DB GrandTotal: ${totalGrandTotal}`);
    console.log(`Total DB Subtotal: ${totalSubtotal}`);
    console.log(`Total DB Hamali: ${totalHamali}`);
    console.log(`Discrepancy (Sub + Hamali - Grand): ${totalSubtotal + totalHamali - totalGrandTotal}`);
    console.log(`Number of invoices where GrandTotal is wrong: ${problematicInvoices}`);

    // 2. Check Payments
    const todayPayments = await db.select().from(customerPayments).where(eq(customerPayments.date, today));
    const totalPayments = todayPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

    console.log(`\nToday's Payments Count: ${todayPayments.length}`);
    console.log(`Total Payments Amount: ${totalPayments}`);

    // Check for orphan payments (linked to non-existent invoices)
    let orphanCount = 0;
    let orphanAmount = 0;
    for (const p of todayPayments) {
        if (p.invoiceId) {
            const [inv] = await db.select().from(invoices).where(eq(invoices.id, p.invoiceId));
            if (!inv) {
                orphanCount++;
                orphanAmount += Number(p.amount || 0);
            }
        }
    }
    console.log(`Orphan Payments (linked to missing invoices): ${orphanCount}, Amount: ${orphanAmount}`);

    // 3. Check Invoice Counts and Limit Issue
    const [invCountResult] = await db.select({ count: sql<number>`count(*)` }).from(invoices);
    console.log(`\nTotal Invoices in DB: ${invCountResult.count}`);
    if (invCountResult.count > 2000) {
        console.log(`WARNING: Reports 2000 limit is definitely excluding ${invCountResult.count - 2000} records!`);
    }

    // 4. Check decimal discrepancy (.111)
    console.log(`\nChecking for 3-decimal precision grand_totals...`);
    const precisionIssues = await db.select().from(invoices).where(sql`char_length(CAST(${invoices.grandTotal} as text)) > 10`).limit(5);
    for (const inv of precisionIssues) {
        console.log(`Invoice ${inv.invoiceNumber} has GrandTotal: ${inv.grandTotal}`);
    }

    process.exit(0);
}

diagnose().catch(console.error);
