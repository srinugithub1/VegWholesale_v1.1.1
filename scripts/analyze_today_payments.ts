import "dotenv/config";
import { db } from "../server/db";
import { invoices, customerPayments } from "@shared/schema";
import { eq, or } from "drizzle-orm";
import * as fs from "fs";

async function analyze() {
    const targetDate = "2026-03-22";

    const todaysInvoices = await db.select().from(invoices).where(eq(invoices.date, targetDate));
    const todaysPayments = await db.select().from(customerPayments).where(eq(customerPayments.date, targetDate));

    const totalPayments = todaysPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const activeInvoiceIds = new Set(todaysInvoices.map(i => i.id));

    // Actually, wait, a payment might be for an invoice from yesterday!
    // We need to fetch ALL active invoices to check for true orphans.
    const allInvoices = await db.select({ id: invoices.id, customerId: invoices.customerId, invoiceNumber: invoices.invoiceNumber }).from(invoices);
    const allInvoiceIds = new Set(allInvoices.map(i => i.id));

    const orphanedPayments = todaysPayments.filter(p => p.invoiceId && !allInvoiceIds.has(p.invoiceId));
    const standalonePayments = todaysPayments.filter(p => !p.invoiceId);
    const linkedPayments = todaysPayments.filter(p => p.invoiceId && allInvoiceIds.has(p.invoiceId));

    const orphanedTotal = orphanedPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const standaloneTotal = standalonePayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const linkedTotal = linkedPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    // Check what could sum to 1104
    const possible1104 = todaysPayments.filter(p => Number(p.amount) === 1104);

    const stats = {
        targetDate,
        totalPayments,
        expectedDiff: 1104,
        orphanedPayments: {
            count: orphanedPayments.length,
            total: orphanedTotal,
            items: orphanedPayments
        },
        standalonePayments: {
            count: standalonePayments.length,
            total: standaloneTotal
        },
        linkedTotal,
        exactMatchesFor1104: possible1104
    };

    fs.writeFileSync("today_payments_analysis.json", JSON.stringify(stats, null, 2));
}

analyze().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
