CREATE TABLE "company_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"phone" text,
	"email" text,
	"gst_number" text,
	"bank_details" text,
	"scale_settings" text
);
--> statement-breakpoint
CREATE TABLE "customer_payments" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"invoice_id" text,
	"amount" real NOT NULL,
	"date" text NOT NULL,
	"payment_method" text NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"address" text,
	"email" text
);
--> statement-breakpoint
CREATE TABLE "halal_cash_payments" (
	"id" text PRIMARY KEY NOT NULL,
	"amount" real NOT NULL,
	"date" text NOT NULL,
	"payment_method" text DEFAULT 'cash' NOT NULL,
	"customer_id" text,
	"invoice_id" text,
	"invoice_number" text,
	"total_bill_amount" real,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "invoice_items" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"product_id" text NOT NULL,
	"vehicle_id" text,
	"quantity" real NOT NULL,
	"unit_price" real NOT NULL,
	"total" real NOT NULL,
	"weight_breakdown" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_number" text NOT NULL,
	"customer_id" text NOT NULL,
	"vehicle_id" text,
	"vendor_id" text,
	"date" text NOT NULL,
	"subtotal" real NOT NULL,
	"include_halal_charge" boolean DEFAULT false NOT NULL,
	"hamali_rate_per_kg" real DEFAULT 2,
	"halal_charge_amount" real DEFAULT 0,
	"hamali_paid_by_cash" boolean DEFAULT false NOT NULL,
	"total_kg_weight" real DEFAULT 0,
	"bags" integer DEFAULT 0,
	"hamali_rate_per_bag" real DEFAULT 0,
	"grand_total" real NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"unit" text NOT NULL,
	"purchase_price" real NOT NULL,
	"sale_price" real NOT NULL,
	"current_stock" real DEFAULT 0 NOT NULL,
	"reorder_level" real DEFAULT 10
);
--> statement-breakpoint
CREATE TABLE "purchase_items" (
	"id" text PRIMARY KEY NOT NULL,
	"purchase_id" text NOT NULL,
	"product_id" text NOT NULL,
	"quantity" real NOT NULL,
	"unit_price" real NOT NULL,
	"total" real NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" text PRIMARY KEY NOT NULL,
	"vendor_id" text NOT NULL,
	"vehicle_id" text,
	"date" text NOT NULL,
	"total_amount" real NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"type" text NOT NULL,
	"quantity" real NOT NULL,
	"reason" text NOT NULL,
	"date" text NOT NULL,
	"reference_id" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"first_name" text,
	"last_name" text,
	"email" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "vehicle_inventory" (
	"id" text PRIMARY KEY NOT NULL,
	"vehicle_id" text NOT NULL,
	"product_id" text NOT NULL,
	"quantity" real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_inventory_movements" (
	"id" text PRIMARY KEY NOT NULL,
	"vehicle_id" text NOT NULL,
	"product_id" text NOT NULL,
	"type" text NOT NULL,
	"quantity" real NOT NULL,
	"reference_id" text,
	"reference_type" text,
	"date" text NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" text PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"type" text NOT NULL,
	"capacity" text,
	"driver_name" text,
	"driver_phone" text,
	"entry_date" text,
	"vendor_id" text,
	"shop" integer DEFAULT 45 NOT NULL,
	"total_weight_gain" real DEFAULT 0,
	"total_weight_loss" real DEFAULT 0,
	"starting_weight" real DEFAULT 0,
	"starting_bags" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "vendor_payments" (
	"id" text PRIMARY KEY NOT NULL,
	"vendor_id" text NOT NULL,
	"purchase_id" text,
	"amount" real NOT NULL,
	"date" text NOT NULL,
	"payment_method" text NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "vendor_return_items" (
	"id" text PRIMARY KEY NOT NULL,
	"return_id" text NOT NULL,
	"product_id" text NOT NULL,
	"quantity" real NOT NULL,
	"unit_price" real NOT NULL,
	"total" real NOT NULL,
	"reason" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_returns" (
	"id" text PRIMARY KEY NOT NULL,
	"vendor_id" text NOT NULL,
	"purchase_id" text,
	"vehicle_id" text,
	"date" text NOT NULL,
	"total_amount" real NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"address" text,
	"email" text
);
