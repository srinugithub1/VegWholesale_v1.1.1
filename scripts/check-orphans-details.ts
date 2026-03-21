import "dotenv/config";
import { db } from "../server/db";
import { invoices, customerPayments } from "@shared/schema";
import * as fs from "fs";

async function run() {
    const allInvoicesFull = await db.select().from(invoices);
    const allCustomerPaymentsFull = await db.select().from(customerPayments);

    const tillYesterday = "2026-03-20";
    const allInvoices = allInvoicesFull.filter(inv => inv.date <= tillYesterday);
    const allCustomerPayments = allCustomerPaymentsFull.filter(p => p.date <= tillYesterday);

    const activeInvoiceIds = new Set(allInvoicesFull.map(i => i.id));
    const orphanedPayments = allCustomerPayments.filter(p => p.invoiceId && !activeInvoiceIds.has(p.invoiceId));

    const cashOrphans = orphanedPayments.filter(p => p.notes === "Auto-payment for Cash & Carry");
    const otherOrphans = orphanedPayments.filter(p => p.notes !== "Auto-payment for Cash & Carry");

    const cashOrphansTotal = cashOrphans.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const otherOrphansTotal = otherOrphans.reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const stats = {
        orphanedPaymentsTotalTillYesterday: cashOrphansTotal + otherOrphansTotal,
        cashOrphansCount: cashOrphans.length,
        cashOrphansTotal,
        otherOrphansCount: otherOrphans.length,
        otherOrphansTotal,
        targetDifference: 201829,
        otherOrphansSample: otherOrphans.slice(0, 5)
    };

    fs.writeFileSync("orphans-breakdown.json", JSON.stringify(stats, null, 2));
}

run().then(() => process.exit(0)).catch(console.error);
