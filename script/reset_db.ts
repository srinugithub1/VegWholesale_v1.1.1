
import "dotenv/config";
import { db } from "../server/db";
import {
    invoices, invoiceItems,
    purchases, purchaseItems,
    stockMovements,
    vendorPayments, customerPayments,
    vehicleInventory, vehicleInventoryMovements,
    vendorReturns, vendorReturnItems,
    vehicles,
    hamaliCashPayments,
    products
} from "../shared/schema";
import { sql } from "drizzle-orm";

async function resetDatabase() {
    console.log("⚠️  STARTING DATABASE RESET ⚠️");
    console.log("This will delete all sales, stock history, and vehicle data.");
    console.log("Master data (Customers, Vendors, Products, Settings) will be preserved.");

    try {
        // Disable foreign key checks if possible or just delete in order
        // Order matters mostly for foreign keys if enforced.

        console.log("Deleting Vehicle Inventory Movements...");
        await db.delete(vehicleInventoryMovements);

        console.log("Deleting Vehicle Inventory...");
        await db.delete(vehicleInventory);

        console.log("Deleting Vendor Return Items...");
        await db.delete(vendorReturnItems);

        console.log("Deleting Vendor Returns...");
        await db.delete(vendorReturns);

        console.log("Deleting Invoice Items...");
        await db.delete(invoiceItems);

        console.log("Deleting Customer Payments...");
        await db.delete(customerPayments);

        console.log("Deleting Invoices...");
        await db.delete(invoices);

        console.log("Deleting Purchase Items...");
        await db.delete(purchaseItems);

        console.log("Deleting Vendor Payments...");
        await db.delete(vendorPayments);

        console.log("Deleting Purchases...");
        await db.delete(purchases);

        console.log("Deleting Stock Movements...");
        await db.delete(stockMovements);

        console.log("Deleting Hamali Cash Payments...");
        await db.delete(hamaliCashPayments);

        console.log("Deleting Vehicles...");
        await db.delete(vehicles);

        // Reset current stock of products to 0
        console.log("Resetting Product Stock levels to 0...");
        await db.update(products).set({ currentStock: 0 });

        console.log("✅ Database reset successful!");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error resetting database:", error);
        process.exit(1);
    }
}

resetDatabase();
