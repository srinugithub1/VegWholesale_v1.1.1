import "dotenv/config";
import * as fs from "fs";
import { db } from "../server/db";
import { invoices, customerPayments } from "@shared/schema";

async function run() {
    const allInvoices = await db.select({ id: invoices.id }).from(invoices);
    const activeInvoiceIds = new Set(allInvoices.map(i => i.id));

    const allCustomerPayments = await db.select().from(customerPayments);

    const orphanedPayments = allCustomerPayments.filter(p => p.invoiceId && !activeInvoiceIds.has(p.invoiceId));
    const standalonePayments = allCustomerPayments.filter(p => !p.invoiceId);
    const orphanedTotalAmount = orphanedPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const standaloneTotal = standalonePayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const results = {
        orphanedCount: orphanedPayments.length,
        orphanedTotalAmount,
        standaloneCount: standalonePayments.length,
        standaloneTotalAmount: standaloneTotal,
        sampleOrphaned: orphanedPayments.slice(0, 10)
    };

    fs.writeFileSync("diagnostics.json", JSON.stringify(results, null, 2));
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
