import "dotenv/config";
import { db } from "../server/db";
import { invoices, customerPayments, deletedRecords } from "@shared/schema";
import { format } from "date-fns";
import * as fs from "fs";

async function run() {
    const allInvoicesFull = await db.select().from(invoices);
    const allCustomerPaymentsFull = await db.select().from(customerPayments);

    // Filter till yesterday
    const tillYesterday = "2026-03-20";
    const allInvoices = allInvoicesFull.filter(inv => inv.date <= tillYesterday);
    const allCustomerPayments = allCustomerPaymentsFull.filter(p => p.date <= tillYesterday);

    // Calculate Reports dashboard Closing Balance equivalent
    const totalSales = allInvoices.reduce((sum, inv) => sum + (Number(inv.grandTotal) || 0), 0);
    const totalPayments = allCustomerPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const closingBalance = totalSales - totalPayments;

    const activeInvoiceIds = new Set(allInvoicesFull.map(i => i.id)); // Orphan check should look at all invoices
    const orphanedPayments = allCustomerPayments.filter(p => p.invoiceId && !activeInvoiceIds.has(p.invoiceId));
    const orphanedTotal = orphanedPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

    // Check today's sales and payments
    const todaysInvoices = allInvoicesFull.filter(inv => inv.date > tillYesterday);
    const todaysPayments = allCustomerPaymentsFull.filter(p => p.date > tillYesterday);
    const todaySalesTotal = todaysInvoices.reduce((sum, inv) => sum + (Number(inv.grandTotal) || 0), 0);
    const todayPaymentsTotal = todaysPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const stats = {
        totalSalesTillYesterday: totalSales,
        totalPaymentsTillYesterday: totalPayments,
        calculatedClosingBalanceTillYesterday: closingBalance,
        orphanedPaymentsTotalTillYesterday: orphanedTotal,
        balanceWithoutOrphansTillYesterday: closingBalance + orphanedTotal,
        todaySalesTotal,
        todayPaymentsTotal
    };

    fs.writeFileSync("balance-diagnostics.json", JSON.stringify(stats, null, 2));
}

run().then(() => process.exit(0)).catch(console.error);
