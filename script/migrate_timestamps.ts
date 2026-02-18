
import Database from "better-sqlite3";
const db = new Database("sqlite.db");

try {
    console.log("Adding columns to invoices...");
    try {
        db.prepare("ALTER TABLE invoices ADD COLUMN created_at INTEGER DEFAULT (unixepoch())").run();
        console.log("Added created_at to invoices");
    } catch (e: any) {
        if (!e.message.includes("duplicate column")) console.error(e.message);
        else console.log("created_at already exists in invoices");
    }

    try {
        db.prepare("ALTER TABLE invoices ADD COLUMN updated_at INTEGER DEFAULT (unixepoch())").run();
        console.log("Added updated_at to invoices");
    } catch (e: any) {
        if (!e.message.includes("duplicate column")) console.error(e.message);
        else console.log("updated_at already exists in invoices");
    }

    console.log("Adding columns to invoice_items...");
    try {
        db.prepare("ALTER TABLE invoice_items ADD COLUMN created_at INTEGER DEFAULT (unixepoch())").run();
        console.log("Added created_at to invoice_items");
    } catch (e: any) {
        if (!e.message.includes("duplicate column")) console.error(e.message);
        else console.log("created_at already exists in invoice_items");
    }

    try {
        db.prepare("ALTER TABLE invoice_items ADD COLUMN updated_at INTEGER DEFAULT (unixepoch())").run();
        console.log("Added updated_at to invoice_items");
    } catch (e: any) {
        if (!e.message.includes("duplicate column")) console.error(e.message);
        else console.log("updated_at already exists in invoice_items");
    }

    console.log("Migration complete.");
} catch (error) {
    console.error("Migration failed:", error);
}
