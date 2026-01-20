import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertVendorSchema,
  insertCustomerSchema,
  insertVehicleSchema,
  insertProductSchema,
  insertStockMovementSchema,
  insertVendorPaymentSchema,
  insertCustomerPaymentSchema,
  insertCompanySettingsSchema,
  insertVendorReturnSchema,
  insertVendorReturnItemSchema,
  insertHamaliCashPaymentSchema,
} from "@shared/schema";
import { hashPassword } from "./auth";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { db } from "./db";
import { sql } from "drizzle-orm";


export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Users (for settings display)
  // Admin only - Get Cloud Storage Stats (Database Size)
  app.get("/api/admin/storage-stats", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "admin") {
      return res.status(403).send("Unauthorized");
    }

    try {
      let usedBytes = 0;

      try {
        // Query Postgres database size
        const result = await db.execute(sql`SELECT pg_database_size(current_database()) as size`);
        usedBytes = Number(result.rows[0].size);
      } catch (err) {
        console.error("Error reading DB size:", err);
      }

      const today = new Date().toISOString().split("T")[0];

      // Update history
      try {
        await storage.upsertSystemMetric({
          date: today,
          dbSizeBytes: usedBytes,
        });
      } catch (err) {
        // If table doesn't exist yet, just log and continue (UI has logic to warn)
        console.error("Failed to upsert metrics (table might be missing):", err);
      }

      let history = [];
      try {
        history = await storage.getSystemMetricsHistory(30);
      } catch (err) {
        console.error("Failed to fetch history:", err);
      }

      res.json({
        usedBytes,
        totalBytes: 1024 * 1024 * 1024, // 1 GB simulated limit
        history
      });
    } catch (error) {
      console.error("Error fetching storage stats:", error);
      res.status(500).json({ error: "Failed to fetch storage stats" });
    }
  });

  // Admin only - Clear Table Data
  app.post("/api/admin/clear-table", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "admin") {
      return res.status(403).send("Unauthorized");
    }

    const { tableName } = req.body;
    if (!tableName) {
      return res.status(400).json({ error: "Table name is required" });
    }

    try {
      await storage.clearTable(tableName);
      res.json({ message: `Table ${tableName} cleared successfully` });
    } catch (error: any) {
      console.error("Error clearing table:", error);
      res.status(500).json({ error: error.message || "Failed to clear table" });
    }
  });

  app.get("/api/admin/table-stats", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "admin") {
      return res.status(403).send("Unauthorized");
    }

    try {
      const stats = await storage.getTableStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching table stats:", error);
      res.status(500).json({ error: "Failed to fetch table stats" });
    }
  });

  app.get("/api/users", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const users = await storage.getUsers();
    // Return users with passwords (hashed) as requested
    res.json(users);
  });

  app.patch("/api/users/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    // Add logic to check if user is admin if needed, but for now allow logged in users to edit (or unrestricted based on user request "give edit permission")

    try {
      const userId = req.params.id;
      const updateData = req.body;

      if (updateData.password) {
        updateData.password = await hashPassword(updateData.password);
      }

      const updatedUser = await storage.updateUser(userId, updateData);
      res.json(updatedUser);
    } catch (e) {
      console.error("Update user error:", e);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // Create new user (manual)
  app.post("/api/users", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).send("Username already exists");
      }

      const hashedPassword = await hashPassword(req.body.password);
      const user = await storage.createUser({
        ...req.body,
        password: hashedPassword,
      });

      res.status(201).json(user);
    } catch (e) {
      console.error("Create user error:", e);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  // Vendors
  app.get("/api/vendors", async (req, res) => {
    const vendors = await storage.getVendors();
    res.json(vendors);
  });

  app.get("/api/vendors/:id", async (req, res) => {
    const vendor = await storage.getVendor(req.params.id);
    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }
    res.json(vendor);
  });

  // Get all purchases for a specific vendor with balance summary
  app.get("/api/vendors/:id/purchases", async (req, res) => {
    try {
      const vendorId = req.params.id;
      const purchases = await storage.getPurchasesWithItemsByVendor(vendorId);
      const balance = await storage.getVendorBalance(vendorId);

      res.json({
        purchases,
        summary: {
          totalPurchases: balance.totalPurchases,
          totalPayments: balance.totalPayments,
          totalReturns: balance.totalReturns,
          balance: balance.balance
        }
      });
    } catch (error) {
      console.error("Error fetching vendor purchases:", error);
      res.status(500).json({ error: "Failed to fetch vendor data" });
    }
  });

  app.get("/api/vendors/:id/balance", async (req, res) => {
    const balance = await storage.getVendorBalance(req.params.id);
    res.json(balance);
  });

  app.post("/api/vendors", async (req, res) => {
    try {
      const data = insertVendorSchema.parse(req.body);
      const vendor = await storage.createVendor(data);
      res.status(201).json(vendor);
    } catch (error) {
      res.status(400).json({ error: "Invalid vendor data" });
    }
  });

  app.patch("/api/vendors/:id", async (req, res) => {
    try {
      const data = insertVendorSchema.partial().parse(req.body);
      const vendor = await storage.updateVendor(req.params.id, data);
      if (!vendor) {
        return res.status(404).json({ error: "Vendor not found" });
      }
      res.json(vendor);
    } catch (error) {
      res.status(400).json({ error: "Invalid vendor data" });
    }
  });

  app.delete("/api/vendors/:id", async (req, res) => {
    const success = await storage.deleteVendor(req.params.id);
    if (!success) {
      return res.status(404).json({ error: "Vendor not found" });
    }
    res.status(204).send();
  });

  // Customers
  app.get("/api/customers", async (req, res) => {
    const customers = await storage.getCustomers();
    res.json(customers);
  });

  app.get("/api/customers/:id", async (req, res) => {
    const customer = await storage.getCustomer(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }
    res.json(customer);
  });

  app.get("/api/customers/:id/balance", async (req, res) => {
    const balance = await storage.getCustomerBalance(req.params.id);
    res.json(balance);
  });

  app.post("/api/customers", async (req, res) => {
    try {
      const data = insertCustomerSchema.parse(req.body);
      const customer = await storage.createCustomer(data);
      res.status(201).json(customer);
    } catch (error) {
      res.status(400).json({ error: "Invalid customer data" });
    }
  });

  app.post("/api/customers/bulk", async (req, res) => {
    try {
      const data = z.array(insertCustomerSchema).parse(req.body);
      const customers = await storage.createCustomersBulk(data);
      res.status(201).json(customers);
    } catch (error) {
      console.error("Bulk create error:", error);
      res.status(400).json({ error: "Invalid bulk customer data" });
    }
  });

  app.patch("/api/customers/:id", async (req, res) => {
    try {
      const data = insertCustomerSchema.partial().parse(req.body);
      const customer = await storage.updateCustomer(req.params.id, data);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      res.status(400).json({ error: "Invalid customer data" });
    }
  });

  app.delete("/api/customers/:id", async (req, res) => {
    const success = await storage.deleteCustomer(req.params.id);
    if (!success) {
      return res.status(404).json({ error: "Customer not found" });
    }
    res.status(204).send();
  });

  // Vehicles
  app.get("/api/vehicles", async (req, res) => {
    const vehicles = await storage.getVehicles();
    res.json(vehicles);
  });

  app.get("/api/vehicles/:id", async (req, res) => {
    const vehicle = await storage.getVehicle(req.params.id);
    if (!vehicle) {
      return res.status(404).json({ error: "Vehicle not found" });
    }
    res.json(vehicle);
  });

  app.post("/api/vehicles", async (req, res) => {
    try {
      const data = insertVehicleSchema.parse(req.body);
      const vehicle = await storage.createVehicle(data);
      res.status(201).json(vehicle);
    } catch (error) {
      res.status(400).json({ error: "Invalid vehicle data" });
    }
  });

  app.patch("/api/vehicles/:id", async (req, res) => {
    try {
      const data = insertVehicleSchema.partial().parse(req.body);
      const vehicle = await storage.updateVehicle(req.params.id, data);
      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }
      res.json(vehicle);
    } catch (error) {
      res.status(400).json({ error: "Invalid vehicle data" });
    }
  });

  app.delete("/api/vehicles/:id", async (req, res) => {
    const success = await storage.deleteVehicle(req.params.id);
    if (!success) {
      return res.status(404).json({ error: "Vehicle not found" });
    }
    res.status(204).send();
  });

  // Products
  app.get("/api/products", async (req, res) => {
    const products = await storage.getProducts();
    res.json(products);
  });

  app.get("/api/products/:id", async (req, res) => {
    const product = await storage.getProduct(req.params.id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(product);
  });

  app.post("/api/products", async (req, res) => {
    try {
      const data = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(data);
      res.status(201).json(product);
    } catch (error) {
      res.status(400).json({ error: "Invalid product data" });
    }
  });

  app.patch("/api/products/:id", async (req, res) => {
    try {
      const data = insertProductSchema.partial().parse(req.body);
      const product = await storage.updateProduct(req.params.id, data);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      res.status(400).json({ error: "Invalid product data" });
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    const success = await storage.deleteProduct(req.params.id);
    if (!success) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.status(204).send();
  });

  // Stock Movements
  app.get("/api/stock-movements", async (req, res) => {
    const { startDate, endDate } = req.query;
    const movements = await storage.getStockMovements(
      startDate as string | undefined,
      endDate as string | undefined
    );
    res.json(movements);
  });

  app.post("/api/stock-movements", async (req, res) => {
    try {
      const data = insertStockMovementSchema.parse(req.body);
      const movement = await storage.createStockMovement(data);
      res.status(201).json(movement);
    } catch (error) {
      res.status(400).json({ error: "Invalid stock movement data" });
    }
  });

  // Purchases
  app.get("/api/purchases", async (req, res) => {
    const purchases = await storage.getPurchases();
    res.json(purchases);
  });

  app.get("/api/purchases/:id", async (req, res) => {
    const purchase = await storage.getPurchase(req.params.id);
    if (!purchase) {
      return res.status(404).json({ error: "Purchase not found" });
    }
    res.json(purchase);
  });

  app.get("/api/purchases/:id/items", async (req, res) => {
    const items = await storage.getPurchaseItems(req.params.id);
    res.json(items);
  });

  const purchaseSchema = z.object({
    vendorId: z.string(),
    vehicleId: z.string().optional(),
    date: z.string(),
    totalAmount: z.number(),
    status: z.string().optional(),
    items: z.array(
      z.object({
        productId: z.string(),
        quantity: z.number(),
        unitPrice: z.number(),
        total: z.number(),
      })
    ),
  });

  app.post("/api/purchases", async (req, res) => {
    try {
      const data = purchaseSchema.parse(req.body);
      const { items, ...purchaseData } = data;
      const purchase = await storage.createPurchase(
        purchaseData,
        items.map((item) => ({ ...item, purchaseId: "" }))
      );
      res.status(201).json(purchase);
    } catch (error) {
      console.error("Purchase error:", error);
      res.status(400).json({ error: "Invalid purchase data" });
    }
  });

  // Invoices
  app.get("/api/invoices", async (req, res) => {
    try {
      // Check if we have filter params, otherwise default to simple list (or redirect to filtered with defaults)
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const shop = req.query.shop ? Number(req.query.shop) : undefined;
      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 50;
      const vehicleId = req.query.vehicleId as string | undefined;

      // Ensure admin only for advanced viewing if strict, but adhering to general RBAC for the page access.
      // The user asked for the TAB to be admin only. The API might also need protection.
      // Assuming session auth is present.
      if (!req.isAuthenticated()) return res.sendStatus(401);

      const result = await storage.getInvoicesFiltered({
        startDate,
        endDate,
        shop,
        page,
        limit,
        vehicleId
      });

      res.json(result);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      res.status(500).json({ error: "Failed to fetch invoices" });
    }
  });

  app.post("/api/invoices/bulk-delete", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== 'admin') {
      return res.status(403).send("Unauthorized");
    }

    try {
      const { ids } = req.body;
      if (!Array.isArray(ids)) {
        return res.status(400).json({ error: "Invalid IDs format" });
      }

      await storage.deleteInvoicesBulk(ids);
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error deleting invoices:", error);
      res.status(500).json({ error: "Failed to delete invoices" });
    }
  });

  app.get("/api/invoices/:id", async (req, res) => {
    const invoice = await storage.getInvoice(req.params.id);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    res.json(invoice);
  });

  app.get("/api/invoices/:id/items", async (req, res) => {
    const items = await storage.getInvoiceItems(req.params.id);
    res.json(items);
  });

  app.get("/api/invoice-items", async (req, res) => {
    try {
      const items = await storage.getAllInvoiceItems();
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to get invoice items" });
    }
  });

  const invoiceSchema = z.object({
    customerId: z.string(),
    vehicleId: z.string().optional(),
    invoiceNumber: z.string(),
    date: z.string(),
    subtotal: z.number(),
    includeHamaliCharge: z.boolean(),
    hamaliRatePerKg: z.number().optional(),
    hamaliChargeAmount: z.number().optional(),
    hamaliPaidByCash: z.boolean().optional(),
    totalKgWeight: z.number().optional(),
    bags: z.number().optional(),
    hamaliRatePerBag: z.number().optional(),
    grandTotal: z.number(),
    status: z.string().optional(),
    items: z.array(
      z.object({
        productId: z.string(),
        quantity: z.number(),
        unitPrice: z.number(),
        total: z.number(),
        weightBreakdown: z.string().optional(),
      })
    ),
  });

  app.post("/api/invoices", async (req, res) => {
    try {
      const data = invoiceSchema.parse(req.body);
      const { items, ...invoiceData } = data;
      const invoice = await storage.createInvoice(
        invoiceData,
        items.map((item) => ({ ...item, invoiceId: "" }))
      );
      res.status(201).json(invoice);
    } catch (error) {
      console.error("Invoice error:", error);
      res.status(400).json({ error: "Invalid invoice data" });
    }
  });

  app.get("/api/customers/:id/invoices", async (req, res) => {
    try {
      const invoicesWithItems = await storage.getInvoicesWithItemsByCustomer(req.params.id);
      const balance = await storage.getCustomerBalance(req.params.id);
      res.json({
        invoices: invoicesWithItems,
        summary: {
          totalInvoices: balance.totalInvoices,
          totalPayments: balance.totalPayments,
          remainingBalance: balance.balance,
        }
      });
    } catch (error) {
      console.error("Error getting customer invoices:", error);
      res.status(500).json({ error: "Failed to get customer invoices" });
    }
  });

  app.patch("/api/invoices/:id", async (req, res) => {
    try {
      const updates = req.body;
      const invoice = await storage.updateInvoice(req.params.id, updates);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error) {
      console.error("Error updating invoice:", error);
      res.status(400).json({ error: "Failed to update invoice" });
    }
  });

  app.patch("/api/invoice-items/:id", async (req, res) => {
    try {
      const updates = req.body;
      const item = await storage.updateInvoiceItem(req.params.id, updates);
      if (!item) {
        return res.status(404).json({ error: "Invoice item not found" });
      }
      res.json(item);
    } catch (error) {
      console.error("Error updating invoice item:", error);
      res.status(400).json({ error: "Failed to update invoice item" });
    }
  });

  // Vendor Payments
  app.get("/api/vendor-payments", async (req, res) => {
    const { vendorId } = req.query;
    const payments = await storage.getVendorPayments(vendorId as string | undefined);
    res.json(payments);
  });

  app.post("/api/vendor-payments", async (req, res) => {
    try {
      const data = insertVendorPaymentSchema.parse(req.body);
      const payment = await storage.createVendorPayment(data);
      res.status(201).json(payment);
    } catch (error) {
      res.status(400).json({ error: "Invalid payment data" });
    }
  });

  // Customer Payments
  app.get("/api/customer-payments", async (req, res) => {
    const { customerId } = req.query;
    const payments = await storage.getCustomerPayments(customerId as string | undefined);

    // Enrich payments with invoice numbers
    const allInvoices = await storage.getInvoices();
    const enrichedPayments = payments.map(payment => {
      const invoice = payment.invoiceId ? allInvoices.find(inv => inv.id === payment.invoiceId) : null;
      return {
        ...payment,
        invoiceNumber: invoice?.invoiceNumber || null,
      };
    });

    res.json(enrichedPayments);
  });

  app.post("/api/customer-payments", async (req, res) => {
    try {
      const data = insertCustomerPaymentSchema.parse(req.body);
      const payment = await storage.createCustomerPayment(data);
      res.status(201).json(payment);
    } catch (error) {
      res.status(400).json({ error: "Invalid payment data" });
    }
  });

  app.patch("/api/customer-payments/:id", async (req, res) => {
    try {
      // Use partial schema for updates or just validate specific fields
      // Using partial of insert schema
      const data = insertCustomerPaymentSchema.partial().parse(req.body);

      const updatedPayment = await storage.updateCustomerPayment(req.params.id, data);
      res.json(updatedPayment);
    } catch (error) {
      // if not found
      if (error instanceof Error && error.message.includes("not found")) {
        return res.status(404).json({ error: "Payment not found" });
      }
      res.status(400).json({ error: "Invalid payment data" });
    }
  });

  app.patch("/api/vendor-payments/:id", async (req, res) => {
    try {
      const data = insertVendorPaymentSchema.partial().parse(req.body);
      const updatedPayment = await storage.updateVendorPayment(req.params.id, data);
      res.json(updatedPayment);
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        return res.status(404).json({ error: "Payment not found" });
      }
      res.status(400).json({ error: "Invalid payment data" });
    }
  });


  // Company Settings
  app.get("/api/company-settings", async (req, res) => {
    const settings = await storage.getCompanySettings();
    res.json(settings || null);
  });

  app.post("/api/company-settings", async (req, res) => {
    try {
      const data = insertCompanySettingsSchema.parse(req.body);
      const settings = await storage.upsertCompanySettings(data);
      res.status(201).json(settings);
    } catch (error) {
      res.status(400).json({ error: "Invalid company settings" });
    }
  });

  // Vehicle Inventory
  app.get("/api/vehicles/:id/inventory", async (req, res) => {
    try {
      const vehicle = await storage.getVehicle(req.params.id);
      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }
      const inventory = await storage.getVehicleInventory(req.params.id);
      res.json(inventory);
    } catch (error) {
      console.error("Error getting vehicle inventory:", error);
      res.status(500).json({ error: "Failed to get vehicle inventory" });
    }
  });

  app.get("/api/vehicles/:id/inventory/movements", async (req, res) => {
    try {
      const vehicle = await storage.getVehicle(req.params.id);
      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }
      const movements = await storage.getVehicleInventoryMovements(req.params.id);
      res.json(movements);
    } catch (error) {
      console.error("Error getting inventory movements:", error);
      res.status(500).json({ error: "Failed to get inventory movements" });
    }
  });

  // All vehicle inventory movements (for Stock page)
  app.get("/api/vehicle-inventory-movements", async (req, res) => {
    try {
      const movements = await storage.getAllVehicleInventoryMovements();
      res.json(movements);
    } catch (error) {
      console.error("Error getting all inventory movements:", error);
      res.status(500).json({ error: "Failed to get inventory movements" });
    }
  });

  // All vehicle inventories (for Stock page)
  app.get("/api/all-vehicle-inventories", async (req, res) => {
    try {
      const inventories = await storage.getAllVehicleInventories();
      res.json(inventories);
    } catch (error) {
      console.error("Error getting all vehicle inventories:", error);
      res.status(500).json({ error: "Failed to get vehicle inventories" });
    }
  });

  const loadInventorySchema = z.object({
    productId: z.string(),
    quantity: z.number().positive(),
    purchaseId: z.string().optional(),
  });

  app.post("/api/vehicles/:id/inventory/load", async (req, res) => {
    try {
      const vehicle = await storage.getVehicle(req.params.id);
      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }

      const data = loadInventorySchema.parse(req.body);
      const inventory = await storage.loadVehicleInventory(
        req.params.id,
        data.productId,
        data.quantity,
        data.purchaseId
      );
      res.status(201).json(inventory);
    } catch (error) {
      console.error("Error loading inventory:", error);
      res.status(400).json({ error: "Invalid inventory data" });
    }
  });

  app.patch("/api/vehicles/:id/inventory/:productId", async (req, res) => {
    try {
      const vehicle = await storage.getVehicle(req.params.id);
      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }

      const { quantity } = req.body;
      if (typeof quantity !== 'number' || quantity < 0) {
        return res.status(400).json({ error: "Invalid quantity" });
      }

      const inventory = await storage.updateVehicleInventory(
        req.params.id,
        req.params.productId,
        quantity
      );
      res.json(inventory);
    } catch (error) {
      console.error("Error updating inventory:", error);
      res.status(500).json({ error: "Failed to update inventory" });
    }
  });

  // Vendor Returns
  app.get("/api/vendor-returns", async (req, res) => {
    const { vendorId } = req.query;
    const returns = await storage.getVendorReturns(vendorId as string | undefined);
    res.json(returns);
  });

  app.get("/api/vendor-returns/:id", async (req, res) => {
    const vendorReturn = await storage.getVendorReturn(req.params.id);
    if (!vendorReturn) {
      return res.status(404).json({ error: "Vendor return not found" });
    }
    res.json(vendorReturn);
  });

  app.get("/api/vendor-returns/:id/items", async (req, res) => {
    const items = await storage.getVendorReturnItems(req.params.id);
    res.json(items);
  });

  const vendorReturnSchema = z.object({
    vendorId: z.string(),
    purchaseId: z.string().optional(),
    vehicleId: z.string().optional(),
    date: z.string(),
    totalAmount: z.number(),
    status: z.string().optional(),
    notes: z.string().optional(),
    items: z.array(
      z.object({
        productId: z.string(),
        quantity: z.number(),
        unitPrice: z.number(),
        total: z.number(),
        reason: z.string(),
      })
    ),
  });

  app.post("/api/vendor-returns", async (req, res) => {
    try {
      const data = vendorReturnSchema.parse(req.body);
      const { items, ...returnData } = data;
      const vendorReturn = await storage.createVendorReturn(
        returnData,
        items.map((item) => ({ ...item, returnId: "" }))
      );
      res.status(201).json(vendorReturn);
    } catch (error) {
      console.error("Vendor return error:", error);
      res.status(400).json({ error: "Invalid vendor return data" });
    }
  });

  // Hamali Cash Payments (direct cash payments not through invoices)
  app.get("/api/hamali-cash", async (req, res) => {
    const payments = await storage.getHamaliCashPayments();
    res.json(payments);
  });

  app.post("/api/hamali-cash", async (req, res) => {
    try {
      const data = insertHamaliCashPaymentSchema.parse(req.body);
      const payment = await storage.createHamaliCashPayment(data);
      res.status(201).json(payment);
    } catch (error) {
      console.error("Hamali cash payment error:", error);
      res.status(400).json({ error: "Invalid Hamali cash payment data" });
    }
  });

  app.delete("/api/hamali-cash/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteHamaliCashPayment(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Hamali cash payment not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete Hamali cash payment" });
    }
  });

  // Reports
  app.get("/api/reports/profit-loss", async (req, res) => {
    try {
      const products = await storage.getProducts();
      const invoices = await storage.getInvoices();
      const purchases = await storage.getPurchases();
      const vendorReturns = await storage.getVendorReturns();
      const customers = await storage.getCustomers();
      const allCustomerPayments = await storage.getCustomerPayments();
      const hamaliCashPayments = await storage.getHamaliCashPayments();

      let totalPurchases = 0;
      let totalSales = 0;
      let totalReturns = 0;

      for (const purchase of purchases) {
        totalPurchases += purchase.totalAmount;
      }

      for (const invoice of invoices) {
        totalSales += invoice.grandTotal;
      }

      for (const vendorReturn of vendorReturns) {
        totalReturns += vendorReturn.totalAmount;
      }

      // Net purchases = purchases - returns (returns reduce cost of goods)
      const netPurchases = totalPurchases - totalReturns;

      const productProfits = products.map((p) => ({
        id: p.id,
        name: p.name,
        purchasePrice: p.purchasePrice,
        salePrice: p.salePrice,
        margin: p.salePrice - p.purchasePrice,
        marginPercent: ((p.salePrice - p.purchasePrice) / p.purchasePrice) * 100,
      }));

      // Hamali charge breakdown
      let invoiceHamaliTotal = 0;  // Hamali from invoices
      let invoicesWithHamali = 0;
      let invoicesWithoutHamali = 0;
      let salesWithHamali = 0;  // Grand total of invoices WITH Hamali charge
      let salesWithoutHamali = 0;  // Grand total of invoices WITHOUT Hamali charge

      // Direct cash payments to Hamali
      const directCashHamaliTotal = hamaliCashPayments.reduce((sum, p) => sum + p.amount, 0);

      // Build invoice details with payment info
      const invoiceDetails = invoices.map((invoice) => {
        const customer = customers.find((c) => c.id === invoice.customerId);
        const customerName = customer?.name || "Unknown";

        // Track Hamali amounts - only count actual Hamali charge amount
        if (invoice.includeHamaliCharge) {
          invoicesWithHamali++;
          invoiceHamaliTotal += invoice.hamaliChargeAmount || 0;
          salesWithHamali += invoice.grandTotal;
        } else {
          invoicesWithoutHamali++;
          salesWithoutHamali += invoice.grandTotal;
        }

        return {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          date: invoice.date,
          customerName,
          customerId: invoice.customerId,
          subtotal: invoice.subtotal,
          includeHamaliCharge: invoice.includeHamaliCharge,
          hamaliRatePerKg: invoice.hamaliRatePerKg,
          hamaliChargeAmount: invoice.hamaliChargeAmount || 0,
          hamaliPaidByCash: invoice.hamaliPaidByCash,
          totalKgWeight: invoice.totalKgWeight,
          grandTotal: invoice.grandTotal,
        };
      });

      // Calculate customer-wise payment summary
      const customerPaymentSummary = customers.map((customer) => {
        const customerInvoices = invoices.filter((i) => i.customerId === customer.id);
        const customerPayments = allCustomerPayments.filter((p) => p.customerId === customer.id);

        const totalInvoiced = customerInvoices.reduce((sum, i) => sum + i.grandTotal, 0);
        const totalPaid = customerPayments.reduce((sum, p) => sum + p.amount, 0);
        const balance = totalInvoiced - totalPaid;

        const hamaliAmount = customerInvoices
          .filter((i) => i.includeHamaliCharge)
          .reduce((sum, i) => sum + (i.hamaliChargeAmount || 0), 0);

        return {
          customerId: customer.id,
          customerName: customer.name,
          totalInvoiced,
          totalPaid,
          balance,
          hamaliAmount,
          paymentStatus: balance <= 0 ? "paid" : balance < totalInvoiced ? "partial" : "unpaid",
        };
      }).filter((c) => c.totalInvoiced > 0); // Only show customers with invoices

      res.json({
        totalPurchases,
        totalReturns,
        netPurchases,
        totalSales,
        grossProfit: totalSales - netPurchases,
        productProfits,
        // Hamali charge data
        hamaliSummary: {
          invoiceHamaliTotal,
          directCashHamaliTotal,
          totalHamaliCollected: invoiceHamaliTotal + directCashHamaliTotal,
          invoicesWithHamali,
          invoicesWithoutHamali,
          salesWithHamali,
          salesWithoutHamali,
        },
        invoiceDetails,
        customerPaymentSummary,
        hamaliCashPayments,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to generate report" });
    }
  });

  app.get("/api/reports/vendor-balances", async (req, res) => {
    try {
      const vendors = await storage.getVendors();
      const balances = await Promise.all(
        vendors.map(async (vendor) => {
          const balance = await storage.getVendorBalance(vendor.id);
          return {
            ...vendor,
            ...balance,
          };
        })
      );
      res.json(balances);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate report" });
    }
  });

  app.get("/api/reports/customer-balances", async (req, res) => {
    try {
      const customers = await storage.getCustomers();
      const balances = await Promise.all(
        customers.map(async (customer) => {
          const balance = await storage.getCustomerBalance(customer.id);
          return {
            ...customer,
            ...balance,
          };
        })
      );
      res.json(balances);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate report" });
    }
  });

  return httpServer;
}
