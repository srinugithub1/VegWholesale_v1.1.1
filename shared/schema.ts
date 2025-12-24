import { sql } from "drizzle-orm";
import { pgTable, text, serial, integer, real, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (compatible with connect-pg-simple)
// Session storage table (compatible with connect-pg-simple)
// export const sessions = pgTable("session", {
//   sid: text("sid").primaryKey(),
//   sess: text("sess").notNull(), // JSON stored as text
//   expire: timestamp("expire", { mode: "date" }).notNull(), 
// });

// Vendors - suppliers/farmers who provide vegetables
export const vendors = pgTable("vendors", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  address: text("address"),
  email: text("email"),
});

export const insertVendorSchema = createInsertSchema(vendors).omit({ id: true });
export type InsertVendor = z.infer<typeof insertVendorSchema>;
export type Vendor = typeof vendors.$inferSelect;

// Customers - buyers who purchase vegetables
export const customers = pgTable("customers", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  address: text("address"),
  email: text("email"),
});

export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true });
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

// Vehicles - used for receiving stock from vendors
export const vehicles = pgTable("vehicles", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  number: text("number").notNull(),
  type: text("type").notNull(),
  capacity: text("capacity"),
  driverName: text("driver_name"),
  driverPhone: text("driver_phone"),
  entryDate: text("entry_date"),
  vendorId: text("vendor_id"),
  shop: integer("shop").notNull().default(45),
  totalWeightGain: real("total_weight_gain").default(0),
  totalWeightLoss: real("total_weight_loss").default(0),
});

export const insertVehicleSchema = createInsertSchema(vehicles).omit({ id: true });
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type Vehicle = typeof vehicles.$inferSelect;

// Products - vegetables and items
export const products = pgTable("products", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  unit: text("unit").notNull(),
  purchasePrice: real("purchase_price").notNull(),
  salePrice: real("sale_price").notNull(),
  currentStock: real("current_stock").notNull().default(0),
  reorderLevel: real("reorder_level").default(10),
});

export const insertProductSchema = createInsertSchema(products).omit({ id: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

// Purchase Orders - buying from vendors
export const purchases = pgTable("purchases", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  vendorId: text("vendor_id").notNull(),
  vehicleId: text("vehicle_id"),
  date: text("date").notNull(),
  totalAmount: real("total_amount").notNull(),
  status: text("status").notNull().default("pending"),
});

export const insertPurchaseSchema = createInsertSchema(purchases).omit({ id: true });
export type InsertPurchase = z.infer<typeof insertPurchaseSchema>;
export type Purchase = typeof purchases.$inferSelect;

// Purchase Items
export const purchaseItems = pgTable("purchase_items", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  purchaseId: text("purchase_id").notNull(),
  productId: text("product_id").notNull(),
  quantity: real("quantity").notNull(),
  unitPrice: real("unit_price").notNull(),
  total: real("total").notNull(),
});

export const insertPurchaseItemSchema = createInsertSchema(purchaseItems).omit({ id: true });
export type InsertPurchaseItem = z.infer<typeof insertPurchaseItemSchema>;
export type PurchaseItem = typeof purchaseItems.$inferSelect;

// Invoices - selling to customers
export const invoices = pgTable("invoices", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  invoiceNumber: text("invoice_number").notNull(),
  customerId: text("customer_id").notNull(),
  vehicleId: text("vehicle_id"),
  vendorId: text("vendor_id"),
  date: text("date").notNull(),
  subtotal: real("subtotal").notNull(),
  includeHamaliCharge: boolean("include_halal_charge").notNull().default(false),
  hamaliRatePerKg: real("hamali_rate_per_kg").default(2),
  hamaliChargeAmount: real("halal_charge_amount").default(0),
  hamaliPaidByCash: boolean("hamali_paid_by_cash").notNull().default(false),
  totalKgWeight: real("total_kg_weight").default(0),
  bags: integer("bags").default(0),
  hamaliRatePerBag: real("hamali_rate_per_bag").default(0),
  grandTotal: real("grand_total").notNull(),
  status: text("status").notNull().default("pending"),
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true });
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;

// Invoice Items
export const invoiceItems = pgTable("invoice_items", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  invoiceId: text("invoice_id").notNull(),
  productId: text("product_id").notNull(),
  vehicleId: text("vehicle_id"), // Added for tracking source vehicle
  quantity: real("quantity").notNull(),
  unitPrice: real("unit_price").notNull(),
  total: real("total").notNull(),
});

export const insertInvoiceItemSchema = createInsertSchema(invoiceItems).omit({ id: true });
export type InsertInvoiceItem = z.infer<typeof insertInvoiceItemSchema>;
export type InvoiceItem = typeof invoiceItems.$inferSelect;

// Stock Movements - track stock changes
export const stockMovements = pgTable("stock_movements", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  productId: text("product_id").notNull(),
  type: text("type").notNull(), // 'in' or 'out'
  quantity: real("quantity").notNull(),
  reason: text("reason").notNull(),
  date: text("date").notNull(),
  referenceId: text("reference_id"),
});

export const insertStockMovementSchema = createInsertSchema(stockMovements).omit({ id: true });
export type InsertStockMovement = z.infer<typeof insertStockMovementSchema>;
export type StockMovement = typeof stockMovements.$inferSelect;

// Vendor Payments - track payments to vendors
export const vendorPayments = pgTable("vendor_payments", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  vendorId: text("vendor_id").notNull(),
  purchaseId: text("purchase_id"),
  amount: real("amount").notNull(),
  date: text("date").notNull(),
  paymentMethod: text("payment_method").notNull(),
  notes: text("notes"),
});

export const insertVendorPaymentSchema = createInsertSchema(vendorPayments).omit({ id: true });
export type InsertVendorPayment = z.infer<typeof insertVendorPaymentSchema>;
export type VendorPayment = typeof vendorPayments.$inferSelect;

// Customer Payments - track payments from customers
export const customerPayments = pgTable("customer_payments", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  customerId: text("customer_id").notNull(),
  invoiceId: text("invoice_id"),
  amount: real("amount").notNull(),
  date: text("date").notNull(),
  paymentMethod: text("payment_method").notNull(),
  notes: text("notes"),
});

export const insertCustomerPaymentSchema = createInsertSchema(customerPayments).omit({ id: true });
export type InsertCustomerPayment = z.infer<typeof insertCustomerPaymentSchema>;
export type CustomerPayment = typeof customerPayments.$inferSelect;

// Vehicle Inventory - track products in each vehicle
export const vehicleInventory = pgTable("vehicle_inventory", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  vehicleId: text("vehicle_id").notNull(),
  productId: text("product_id").notNull(),
  quantity: real("quantity").notNull().default(0),
});

export const insertVehicleInventorySchema = createInsertSchema(vehicleInventory).omit({ id: true });
export type InsertVehicleInventory = z.infer<typeof insertVehicleInventorySchema>;
export type VehicleInventory = typeof vehicleInventory.$inferSelect;

// Vehicle Inventory Movements - track loading and selling from vehicles
export const vehicleInventoryMovements = pgTable("vehicle_inventory_movements", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  vehicleId: text("vehicle_id").notNull(),
  productId: text("product_id").notNull(),
  type: text("type").notNull(), // 'load' or 'sale' or 'adjustment'
  quantity: real("quantity").notNull(),
  referenceId: text("reference_id"), // purchase_id or invoice_id
  referenceType: text("reference_type"), // 'purchase' or 'invoice'
  date: text("date").notNull(),
  notes: text("notes"),
});

export const insertVehicleInventoryMovementSchema = createInsertSchema(vehicleInventoryMovements).omit({ id: true });
export type InsertVehicleInventoryMovement = z.infer<typeof insertVehicleInventoryMovementSchema>;
export type VehicleInventoryMovement = typeof vehicleInventoryMovements.$inferSelect;

// Company Settings - for invoice branding
export const companySettings = pgTable("company_settings", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  gstNumber: text("gst_number"),
  bankDetails: text("bank_details"),
  scaleSettings: text("scale_settings"), // JSON string of ScaleSettings
});

export const insertCompanySettingsSchema = createInsertSchema(companySettings).omit({ id: true });
export type InsertCompanySettings = z.infer<typeof insertCompanySettingsSchema>;
export type CompanySettings = typeof companySettings.$inferSelect;

// Vendor Returns - returning defective products to vendors
export const vendorReturns = pgTable("vendor_returns", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  vendorId: text("vendor_id").notNull(),
  purchaseId: text("purchase_id"),
  vehicleId: text("vehicle_id"),
  date: text("date").notNull(),
  totalAmount: real("total_amount").notNull(),
  status: text("status").notNull().default("completed"),
  notes: text("notes"),
});

export const insertVendorReturnSchema = createInsertSchema(vendorReturns).omit({ id: true });
export type InsertVendorReturn = z.infer<typeof insertVendorReturnSchema>;
export type VendorReturn = typeof vendorReturns.$inferSelect;

// Vendor Return Items - individual products being returned
export const vendorReturnItems = pgTable("vendor_return_items", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  returnId: text("return_id").notNull(),
  productId: text("product_id").notNull(),
  quantity: real("quantity").notNull(),
  unitPrice: real("unit_price").notNull(),
  total: real("total").notNull(),
  reason: text("reason").notNull(),
});

export const insertVendorReturnItemSchema = createInsertSchema(vendorReturnItems).omit({ id: true });
export type InsertVendorReturnItem = z.infer<typeof insertVendorReturnItemSchema>;
export type VendorReturnItem = typeof vendorReturnItems.$inferSelect;

// Hamali Cash Payments - direct cash given to Hamali (not through invoices)
export const hamaliCashPayments = pgTable("halal_cash_payments", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  amount: real("amount").notNull(),
  date: text("date").notNull(),
  paymentMethod: text("payment_method").notNull().default("cash"),
  customerId: text("customer_id"), // optional - which customer gave the cash
  invoiceId: text("invoice_id"), // linked invoice if auto-created from weighing
  invoiceNumber: text("invoice_number"), // invoice number for easy display
  totalBillAmount: real("total_bill_amount"), // total bill amount from invoice
  notes: text("notes"),
});

export const insertHamaliCashPaymentSchema = createInsertSchema(hamaliCashPayments).omit({ id: true });
export type InsertHamaliCashPayment = z.infer<typeof insertHamaliCashPaymentSchema>;
export type HamaliCashPayment = typeof hamaliCashPayments.$inferSelect;

// Users table for Authentication
export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"), // 'admin' or 'user'
  firstName: text("first_name"),
  lastName: text("last_name"),
  email: text("email"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
