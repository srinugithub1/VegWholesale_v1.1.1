
import { format } from "date-fns";
import type { Invoice, InvoiceItem, Customer, Product } from "@shared/schema";

/**
 * Generates a Tally-compatible CSV for Sales Vouchers based on the user's 15-field requirement.
 */
export const generateSalesCSV = (
    invoices: Invoice[],
    customers: Customer[],
    invoiceItems: InvoiceItem[],
    products: Product[]
): string => {
    const customerMap = new Map(customers.map(c => [c.id, c.name]));
    const productMap = new Map(products.map(p => [p.id, { name: p.name, unit: p.unit }]));
    const itemsByInvoice = new Map<string, InvoiceItem[]>();

    invoiceItems.forEach(item => {
        const list = itemsByInvoice.get(item.invoiceId) || [];
        list.push(item);
        itemsByInvoice.set(item.invoiceId, list);
    });

    const headers = [
        "Date",
        "Invoice No",
        "Invoice No",
        "VCHTYPE",
        "PARTYLEDGERNAME",
        "State",
        "Country",
        "Place of Supply",
        "Company State",
        "STOCKITEMNAME",
        "ACTUALQTY",
        "UOM",
        "RATE",
        "Sales Ledger",
        "Amount",
        "Hamali"
    ];

    const rows: string[][] = [headers];

    invoices.forEach(inv => {
        const customerName = customerMap.get(inv.customerId) || "Unknown Customer";
        const dateFormatted = format(new Date(inv.date), "dd-MM-yyyy");
        const currentInvoiceItems = itemsByInvoice.get(inv.id) || [];

        currentInvoiceItems.forEach(item => {
            const productInfo = productMap.get(item.productId) || { name: "Unknown Product", unit: "Kg" };

            const row = [
                dateFormatted,                     // 1. Date
                inv.invoiceNumber,                 // 2. Invoice No
                inv.invoiceNumber,                 // 3. Invoice No (Duplicate)
                "Sales",                           // 4. VCHTYPE
                customerName,                      // 5. PARTYLEDGERNAME
                "Telangana",                       // 6. State
                "India",                           // 7. Country
                "Telangana",                       // 8. Place of Supply
                "Telangana",                       // 9. Company State
                productInfo.name,                  // 10. STOCKITEMNAME
                item.quantity.toString(),          // 11. ACTUALQTY
                productInfo.unit,                  // 12. UOM
                item.unitPrice.toString(),         // 13. RATE
                "Sales Account",                   // 14. Sales Ledger
                item.total.toFixed(2),             // 15. Amount
                (inv.hamaliChargeAmount || 0).toString() // 16. Hamali
            ];
            rows.push(row);
        });

        // If an invoice has no items, we might want to still export it with a general entry? 
        // But Tally inventory vouchers usually require items. 
        // Based on user's fields, they are focusing on itemized sales.
    });

    return rows.map(r => r.join(",")).join("\n");
};
