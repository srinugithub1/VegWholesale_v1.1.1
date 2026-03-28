import {
  type User,
  type InsertUser,
  type Vendor,
  type InsertVendor,
  type Customer,
  type InsertCustomer,
  type Vehicle,
  type InsertVehicle,
  type Product,
  type InsertProduct,
  type Purchase,
  type InsertPurchase,
  type PurchaseItem,
  type InsertPurchaseItem,
  type Invoice,
  type InsertInvoice,
  type InvoiceItem,
  type InsertInvoiceItem,
  type StockMovement,
  type InsertStockMovement,
  type VendorPayment,
  type InsertVendorPayment,
  type CustomerPayment,
  type InsertCustomerPayment,
  type CompanySettings,
  type InsertCompanySettings,
  type VehicleInventory,
  type InsertVehicleInventory,
  type VehicleInventoryMovement,
  type InsertVehicleInventoryMovement,
  type VendorReturn,
  type InsertVendorReturn,
  type VendorReturnItem,
  type InsertVendorReturnItem,
  type HamaliCashPayment,
  type InsertHamaliCashPayment,
  vendors,
  customers,
  vehicles,
  products,
  purchases,
  purchaseItems,
  invoices,
  invoiceItems,
  stockMovements,
  vendorPayments,
  customerPayments,
  companySettings,
  vehicleInventory,
  vehicleInventoryMovements,
  vendorReturns,
  vendorReturnItems,
  hamaliCashPayments,
  users,
  type SystemMetric,
  type InsertSystemMetric,
  systemMetrics,
  type DeletedRecord,
  type InsertDeletedRecord,
  deletedRecords,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, inArray, sql, desc } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresStore = connectPg(session);

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User>;

  sessionStore: session.Store;

  getVendors(): Promise<Vendor[]>;
  getVendor(id: string): Promise<Vendor | undefined>;
  createVendor(vendor: InsertVendor): Promise<Vendor>;
  createVendorsBulk(vendors: InsertVendor[]): Promise<Vendor[]>;
  updateVendor(id: string, vendor: Partial<InsertVendor>): Promise<Vendor | undefined>;
  deleteVendor(id: string): Promise<boolean>;

  getCustomers(): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  createCustomersBulk(customers: InsertCustomer[]): Promise<Customer[]>;
  updateCustomer(id: string, customer: Partial<InsertCustomer>): Promise<Customer | undefined>;
  deleteCustomer(id: string): Promise<boolean>;

  getVehicles(): Promise<Vehicle[]>;
  getVehicle(id: string): Promise<Vehicle | undefined>;
  createVehicle(vehicle: InsertVehicle): Promise<Vehicle>;
  updateVehicle(id: string, vehicle: Partial<InsertVehicle>): Promise<Vehicle | undefined>;
  deleteVehicle(id: string): Promise<boolean>;

  getProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<boolean>;
  updateProductStock(id: string, quantity: number, type: 'in' | 'out'): Promise<Product | undefined>;
  updateProductAveragePrice(productId: string, date: string): Promise<void>;

  getPurchases(): Promise<Purchase[]>;
  getPurchase(id: string): Promise<Purchase | undefined>;
  createPurchase(purchase: InsertPurchase, items: InsertPurchaseItem[]): Promise<Purchase>;
  getPurchaseItems(purchaseId: string): Promise<PurchaseItem[]>;
  getPurchasesWithItemsByVendor(vendorId: string): Promise<(Purchase & { items: PurchaseItem[] })[]>;

  getInvoices(): Promise<Invoice[]>;
  getInvoicesFiltered(filters: { startDate?: string, endDate?: string, shop?: number, page?: number, limit?: number, vehicleId?: string, status?: string, excludeCashAccount?: boolean }): Promise<{ invoices: (Invoice & { shop?: number | null, customerName?: string | null })[], total: number, totalAmount: number }>;
  deleteInvoicesBulk(ids: string[]): Promise<boolean>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  getInvoicesByCustomer(customerId: string): Promise<(Invoice & { shop?: number | null })[]>;
  getInvoicesWithItemsByCustomer(customerId: string): Promise<(Invoice & { shop?: number | null, items: InvoiceItem[] })[]>;
  createInvoice(invoice: InsertInvoice, items: InsertInvoiceItem[]): Promise<Invoice>;
  updateInvoice(id: string, updates: Partial<InsertInvoice>): Promise<Invoice | undefined>;
  updateInvoiceItem(id: string, updates: Partial<InsertInvoiceItem>): Promise<InvoiceItem | undefined>;
  deleteInvoiceItem(id: string): Promise<boolean>;
  getInvoiceItems(invoiceId: string): Promise<InvoiceItem[]>;
  getAllInvoiceItems(): Promise<InvoiceItem[]>;

  getStockMovements(startDate?: string, endDate?: string): Promise<StockMovement[]>;
  createStockMovement(movement: InsertStockMovement): Promise<StockMovement>;

  getVendorPayments(vendorId?: string): Promise<VendorPayment[]>;
  createVendorPayment(payment: InsertVendorPayment): Promise<VendorPayment>;
  updateVendorPayment(id: string, payment: Partial<InsertVendorPayment>): Promise<VendorPayment | undefined>;
  getVendorBalance(vendorId: string): Promise<{ totalPurchases: number; totalPayments: number; totalReturns: number; balance: number }>;

  getCustomerPayments(customerId?: string): Promise<CustomerPayment[]>;
  createCustomerPayment(payment: InsertCustomerPayment): Promise<CustomerPayment>;
  updateCustomerPayment(id: string, payment: Partial<InsertCustomerPayment>): Promise<CustomerPayment | undefined>;
  getCustomerBalance(customerId: string): Promise<{ totalInvoices: number; totalPayments: number; balance: number }>;

  getCompanySettings(): Promise<CompanySettings | undefined>;
  upsertCompanySettings(settings: InsertCompanySettings): Promise<CompanySettings>;
  createOpeningBalanceInvoice(customerId: string, amount: number): Promise<Invoice>;

  // Vehicle Inventory
  getVehicleInventory(vehicleId: string): Promise<VehicleInventory[]>;
  getAllVehicleInventories(): Promise<VehicleInventory[]>;
  loadVehicleInventory(vehicleId: string, productId: string, quantity: number, purchaseId?: string): Promise<VehicleInventory>;
  deductVehicleInventory(vehicleId: string, productId: string, quantity: number, invoiceId?: string): Promise<VehicleInventory | undefined>;
  getVehicleInventoryMovements(vehicleId: string): Promise<VehicleInventoryMovement[]>;
  getAllVehicleInventoryMovements(): Promise<VehicleInventoryMovement[]>;
  updateVehicleInventory(vehicleId: string, productId: string, quantity: number): Promise<VehicleInventory>;

  // Vendor Returns
  createVendorReturn(returnItem: InsertVendorReturn, items: InsertVendorReturnItem[]): Promise<VendorReturn>;
  getVendorReturn(id: string): Promise<VendorReturn | undefined>;
  getVendorReturns(): Promise<VendorReturn[]>;
  getVendorReturnItems(returnId: string): Promise<VendorReturnItem[]>;

  // Optimized Reporting
  getAllVendorBalances(): Promise<(Vendor & { totalPurchases: number, totalPayments: number, totalReturns: number, balance: number })[]>;
  getAllCustomerBalances(): Promise<(Customer & { totalInvoices: number, totalPayments: number, balance: number })[]>;

  getVendorReturns(vendorId?: string): Promise<VendorReturn[]>;
  getVendorReturn(id: string): Promise<VendorReturn | undefined>;
  createVendorReturn(vendorReturn: InsertVendorReturn, items: InsertVendorReturnItem[]): Promise<VendorReturn>;
  getVendorReturnItems(returnId: string): Promise<VendorReturnItem[]>;

  // Hamali Cash Payments
  getHamaliCashPayments(): Promise<HamaliCashPayment[]>;
  createHamaliCashPayment(payment: InsertHamaliCashPayment): Promise<HamaliCashPayment>;
  deleteHamaliCashPayment(id: string, userId?: string): Promise<boolean>;
  deleteVendorPayment(id: string, userId?: string): Promise<boolean>;
  deleteCustomerPayment(id: string, userId?: string): Promise<boolean>;

  // System Metrics
  getSystemMetricsHistory(limit?: number): Promise<SystemMetric[]>;
  upsertSystemMetric(metric: InsertSystemMetric): Promise<SystemMetric>;

  // Admin Data Management
  clearTable(tableName: string): Promise<boolean>;
  getTableStats(): Promise<Record<string, { count: number; sizeBytes: number }>>;

  getShortPayments(filters?: { fromDate?: string, toDate?: string, limit?: number, offset?: number }): Promise<{ records: any[], total: number }>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresStore({
      pool,
      createTableIfMissing: true,
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, userData: Partial<InsertUser>): Promise<User> {
    const [user] = await db
      .update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getVendors(): Promise<Vendor[]> {
    return await db.select().from(vendors);
  }

  async getVendor(id: string): Promise<Vendor | undefined> {
    const [vendor] = await db.select().from(vendors).where(eq(vendors.id, id));
    return vendor || undefined;
  }

  async createVendor(insertVendor: InsertVendor): Promise<Vendor> {
    const [vendor] = await db.insert(vendors).values(insertVendor).returning();
    return vendor;
  }

  async createVendorsBulk(insertVendors: InsertVendor[]): Promise<Vendor[]> {
    if (insertVendors.length === 0) return [];
    const createdVendors = await db.insert(vendors).values(insertVendors).returning();
    return createdVendors;
  }

  async updateVendor(id: string, updates: Partial<InsertVendor>, userId?: string): Promise<Vendor | undefined> {
    const vendor = await this.getVendor(id);
    if (vendor) {
      await this.archiveRecord('vendors', id, vendor, userId, 'edit');
    }
    const [updated] = await db.update(vendors).set(updates).where(eq(vendors.id, id)).returning();
    return updated || undefined;
  }

  async deleteVendor(id: string, userId?: string): Promise<boolean> {
    const vendor = await this.getVendor(id);
    if (vendor) {
      await this.archiveRecord('vendors', id, vendor, userId, 'delete');
    }
    const result = await db.delete(vendors).where(eq(vendors.id, id)).returning();
    return result.length > 0;
  }

  async getCustomers(): Promise<Customer[]> {
    return await db.select().from(customers);
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer || undefined;
  }

  async createCustomer(insertCustomer: InsertCustomer): Promise<Customer> {
    const [customer] = await db.insert(customers).values(insertCustomer).returning();
    return customer;
  }

  async createCustomersBulk(insertCustomers: InsertCustomer[]): Promise<Customer[]> {
    if (insertCustomers.length === 0) return [];

    const createdCustomers = await db
      .insert(customers)
      .values(insertCustomers)
      .returning();
    return createdCustomers;
  }

  async updateCustomer(id: string, updates: Partial<InsertCustomer>, userId?: string): Promise<Customer | undefined> {
    const customer = await this.getCustomer(id);
    if (customer) {
      await this.archiveRecord('customers', id, customer, userId, 'edit');
    }
    const [updated] = await db.update(customers).set(updates).where(eq(customers.id, id)).returning();
    return updated || undefined;
  }

  async deleteCustomer(id: string, userId?: string): Promise<boolean> {
    const customer = await this.getCustomer(id);
    if (customer) {
      await this.archiveRecord('customers', id, customer, userId, 'delete');
    }
    const result = await db.delete(customers).where(eq(customers.id, id)).returning();
    return result.length > 0;
  }

  async getVehicles(): Promise<Vehicle[]> {
    return await db.select().from(vehicles);
  }

  async getVehicle(id: string): Promise<Vehicle | undefined> {
    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, id));
    return vehicle || undefined;
  }

  async createVehicle(insertVehicle: InsertVehicle): Promise<Vehicle> {
    const [vehicle] = await db.insert(vehicles).values(insertVehicle).returning();
    return vehicle;
  }

  async updateVehicle(id: string, updates: Partial<InsertVehicle>, userId?: string): Promise<Vehicle | undefined> {
    const vehicle = await this.getVehicle(id);
    if (vehicle) {
      await this.archiveRecord('vehicles', id, vehicle, userId, 'edit');
    }
    const [updated] = await db.update(vehicles).set(updates).where(eq(vehicles.id, id)).returning();
    return updated || undefined;
  }

  async deleteVehicle(id: string, userId?: string): Promise<boolean> {
    const vehicle = await this.getVehicle(id);
    if (vehicle) {
      await this.archiveRecord('vehicles', id, vehicle, userId, 'delete');
    }
    const result = await db.delete(vehicles).where(eq(vehicles.id, id)).returning();
    return result.length > 0;
  }

  async deleteInvoice(id: string, userId?: string): Promise<boolean> {
    const invoice = await this.getInvoice(id);
    if (invoice) {
      await this.archiveRecord('invoices', id, invoice, userId, 'delete');
    }
    const result = await db.delete(invoices).where(eq(invoices.id, id)).returning();
    return result.length > 0;
  }

  async getProducts(): Promise<Product[]> {
    return await db.select().from(products);
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product || undefined;
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const [product] = await db.insert(products).values({
      ...insertProduct,
      currentStock: insertProduct.currentStock ?? 0,
      reorderLevel: insertProduct.reorderLevel ?? 10,
    }).returning();
    return product;
  }

  async updateProduct(id: string, updates: Partial<InsertProduct>, userId?: string): Promise<Product | undefined> {
    const product = await this.getProduct(id);
    if (product) {
      await this.archiveRecord('products', id, product, userId, 'edit');
    }
    const [updated] = await db.update(products).set(updates).where(eq(products.id, id)).returning();
    return updated || undefined;
  }

  async deleteProduct(id: string, userId?: string): Promise<boolean> {
    const product = await this.getProduct(id);
    if (product) {
      await this.archiveRecord('products', id, product, userId, 'delete');
    }
    const result = await db.delete(products).where(eq(products.id, id)).returning();
    return result.length > 0;
  }

  async updateProductStock(id: string, quantity: number, type: 'in' | 'out'): Promise<Product | undefined> {
    const product = await this.getProduct(id);
    if (!product) return undefined;

    const newStock = type === 'in'
      ? product.currentStock + quantity
      : product.currentStock - quantity;

    const [updated] = await db.update(products)
      .set({ currentStock: Math.max(0, newStock) })
      .where(eq(products.id, id))
      .returning();
    return updated || undefined;
  }

  async updateProductAveragePrice(productId: string, date: string): Promise<void> {
    // Calculate weighted average price for the product on the given date
    // Query: Join invoice_items with invoices, filter by productId and date
    const result = await db.select({
      totalQuantity: sql<number>`sum(${invoiceItems.quantity})`,
      totalAmount: sql<number>`sum(${invoiceItems.total})`,
    })
      .from(invoiceItems)
      .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
      .where(and(
        eq(invoiceItems.productId, productId),
        eq(invoices.date, date)
      ));

    const { totalQuantity, totalAmount } = result[0];

    // If we have valid sales data for today
    if (totalQuantity && totalQuantity > 0 && totalAmount) {
      const averagePrice = Number((totalAmount / totalQuantity).toFixed(2));

      // Update the product's sale price
      await db.update(products)
        .set({ salePrice: averagePrice })
        .where(eq(products.id, productId));

      console.log(`Updated product ${productId} sale price to ${averagePrice} based on daily average.`);
    }
  }

  async getPurchases(): Promise<Purchase[]> {
    return await db.select().from(purchases);
  }

  async getPurchase(id: string): Promise<Purchase | undefined> {
    const [purchase] = await db.select().from(purchases).where(eq(purchases.id, id));
    return purchase || undefined;
  }

  async createPurchase(insertPurchase: InsertPurchase, items: InsertPurchaseItem[]): Promise<Purchase> {
    const [purchase] = await db.insert(purchases).values({
      ...insertPurchase,
      status: insertPurchase.status ?? "completed",
    }).returning();

    for (const item of items) {
      await db.insert(purchaseItems).values({
        ...item,
        purchaseId: purchase.id,
      });

      // Only update product stock if no vehicle is specified
      // When vehicle is specified, loadVehicleInventory handles stock update
      if (!insertPurchase.vehicleId) {
        await this.updateProductStock(item.productId, item.quantity, 'in');
      }

      await db.insert(stockMovements).values({
        productId: item.productId,
        type: 'in',
        quantity: item.quantity,
        reason: `Purchase order ${purchase.id.slice(0, 8)}`,
        date: insertPurchase.date,
        referenceId: purchase.id,
      });

      // Load products into vehicle inventory if a vehicle is specified
      if (insertPurchase.vehicleId) {
        await this.loadVehicleInventory(
          insertPurchase.vehicleId,
          item.productId,
          item.quantity,
          purchase.id
        );
      }
    }

    return purchase;
  }

  async getPurchaseItems(purchaseId: string): Promise<PurchaseItem[]> {
    return await db.select().from(purchaseItems).where(eq(purchaseItems.purchaseId, purchaseId));
  }

  async getPurchasesWithItemsByVendor(vendorId: string): Promise<(Purchase & { items: PurchaseItem[] })[]> {
    const rows = await db.select().from(purchases).where(eq(purchases.vendorId, vendorId));
    const purchaseIds = rows.map(r => r.id);

    let allItems: PurchaseItem[] = [];
    if (purchaseIds.length > 0) {
      allItems = await db.select().from(purchaseItems).where(inArray(purchaseItems.purchaseId, purchaseIds));
    }

    return rows.map(purchase => ({
      ...purchase,
      items: allItems.filter(item => item.purchaseId === purchase.id)
    }));
  }

  async getInvoices(): Promise<Invoice[]> {
    return await db.select().from(invoices).orderBy(desc(invoices.date), desc(invoices.invoiceNumber));
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    return invoice || undefined;
  }

  async createInvoice(insertInvoice: InsertInvoice, items: InsertInvoiceItem[]): Promise<Invoice> {
    const [invoice] = await db.insert(invoices).values({
      ...insertInvoice,
      status: insertInvoice.status ?? "pending",
      hamaliRatePerKg: insertInvoice.hamaliRatePerKg ?? 2,
      hamaliChargeAmount: insertInvoice.hamaliChargeAmount ?? 0,
      hamaliPaidByCash: insertInvoice.hamaliPaidByCash ?? false,
      totalKgWeight: insertInvoice.totalKgWeight ?? 0,
    }).returning();

    for (const item of items) {
      await db.insert(invoiceItems).values({
        ...item,
        invoiceId: invoice.id,
        vehicleId: item.vehicleId || insertInvoice.vehicleId, // Ensure vehicleId is populated for tracking
      });

      // Only update product stock if no vehicle is specified
      // When vehicle is specified, deductVehicleInventory handles stock update
      if (!insertInvoice.vehicleId) {
        await this.updateProductStock(item.productId, item.quantity, 'out');
      }

      await db.insert(stockMovements).values({
        productId: item.productId,
        type: 'out',
        quantity: item.quantity,
        reason: `Invoice ${insertInvoice.invoiceNumber}`,
        date: insertInvoice.date,
        referenceId: invoice.id,
      });

      // Deduct from vehicle inventory if a vehicle is specified
      if (insertInvoice.vehicleId) {
        const deductResult = await this.deductVehicleInventory(
          insertInvoice.vehicleId,
          item.productId,
          item.quantity,
          invoice.id
        );
        // Log warning if deduction failed (insufficient stock), but don't block invoice creation
        // as vehicle inventory is a convenience feature, not a hard constraint
        if (!deductResult) {
          console.warn(`Failed to deduct ${item.quantity} of product ${item.productId} from vehicle ${insertInvoice.vehicleId}`);
        }
      }
    }

    // After adding all items, verify/update the average sale price for the products in this invoice
    // This ensures the product catalog reflects the daily weighted average
    for (const item of items) {
      await this.updateProductAveragePrice(item.productId, insertInvoice.date);
    }

    // Auto-create hamali cash payment if paid by cash
    if (insertInvoice.includeHamaliCharge && insertInvoice.hamaliPaidByCash && invoice.hamaliChargeAmount && invoice.hamaliChargeAmount > 0) {
      await db.insert(hamaliCashPayments).values({
        amount: invoice.hamaliChargeAmount,
        date: insertInvoice.date,
        paymentMethod: "cash",
        customerId: insertInvoice.customerId,
        invoiceId: invoice.id,
        invoiceNumber: insertInvoice.invoiceNumber,
        totalBillAmount: invoice.grandTotal,
        notes: `Auto-recorded from Invoice ${insertInvoice.invoiceNumber}`,
      });
    }

    return invoice;
  }

  async deleteInvoiceItem(id: string): Promise<boolean> {
    const [item] = await db.select().from(invoiceItems).where(eq(invoiceItems.id, id));
    if (!item) return false;

    // Delete the item
    await db.delete(invoiceItems).where(eq(invoiceItems.id, id));

    // Update the invoice grand total
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, item.invoiceId));
    if (invoice) {
      // Recalculate total
      const items = await this.getInvoiceItems(invoice.id);

      if (items.length === 0) {
        // SAFETY: Never delete an Opening Balance invoice even if it has no items
        if (invoice.invoiceNumber.startsWith("OB-")) {
          console.log(`Protected Opening Balance invoice ${invoice.invoiceNumber} from deletion.`);
          return true;
        }

        // If no items left, delete the invoice (archive first)
        await this.archiveRecord('invoices', invoice.id, invoice, 'system');
        await db.delete(invoices).where(eq(invoices.id, invoice.id));
      } else {
        const newSubtotal = items.reduce((sum, i) => sum + (Number(i.total) || 0), 0);

        // SAFETY: Never recalculate total for Opening Balance invoices based on items
        if (invoice.invoiceNumber.startsWith("OB-")) {
          console.log(`Skipping total recalculation for Opening Balance invoice ${invoice.invoiceNumber}`);
          return true;
        }

        const hamali = Number(invoice.hamaliChargeAmount || 0);

        await db.update(invoices)
          .set({
            grandTotal: newSubtotal + hamali,
            subtotal: newSubtotal
          })
          .where(eq(invoices.id, invoice.id));
      }
    }
    return true;
  }

  async updateInvoiceItem(id: string, data: Partial<InsertInvoiceItem>): Promise<InvoiceItem | undefined> {
    const [updated] = await db
      .update(invoiceItems)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(invoiceItems.id, id))
      .returning();

    // Recalculate invoice total
    if (updated) {
      const [invoice] = await db.select().from(invoices).where(eq(invoices.id, updated.invoiceId));
      if (invoice && invoice.invoiceNumber.startsWith("OB-")) {
        console.log(`Skipping total update for Opening Balance invoice ${invoice.invoiceNumber}`);
        return updated;
      }

      const items = await this.getInvoiceItems(updated.invoiceId);
      const newSubtotal = items.reduce((sum, i) => sum + (Number(i.total) || 0), 0);
      const hamali = Number(invoice.hamaliChargeAmount || 0);
      await db.update(invoices)
        .set({
          grandTotal: newSubtotal + hamali,
          subtotal: newSubtotal
        })
        .where(eq(invoices.id, updated.invoiceId));
    }
    return updated;
  }

  async updateInvoice(id: string, data: Partial<InsertInvoice>, userId?: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    if (invoice) {
      await this.archiveRecord('invoices', id, invoice, userId, 'edit');
    }
    const [updated] = await db
      .update(invoices)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(invoices.id, id))
      .returning();
    return updated;
  }

  async getInvoiceItems(invoiceId: string): Promise<InvoiceItem[]> {
    return await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
  }

  async getAllInvoiceItems(): Promise<InvoiceItem[]> {
    return await db.select().from(invoiceItems);
  }

  async getInvoicesByCustomer(customerId: string): Promise<(Invoice & { shop?: number | null })[]> {
    const rows = await db.select({
      invoice: invoices,
      shop: vehicles.shop,
    })
      .from(invoices)
      .leftJoin(vehicles, eq(invoices.vehicleId, vehicles.id))
      .where(eq(invoices.customerId, customerId))
      .orderBy(desc(invoices.date), desc(invoices.invoiceNumber));

    return rows.map(({ invoice, shop }) => ({
      ...invoice,
      shop
    }));
  }

  async getInvoicesWithItemsByCustomer(customerId: string): Promise<(Invoice & { shop?: number | null, items: InvoiceItem[] })[]> {
    const rows = await db.select({
      invoice: invoices,
      shop: vehicles.shop,
    })
      .from(invoices)
      .leftJoin(vehicles, eq(invoices.vehicleId, vehicles.id))
      .where(eq(invoices.customerId, customerId))
      .orderBy(desc(invoices.date), desc(invoices.invoiceNumber));

    const invoiceIds = rows.map(r => r.invoice.id);

    let allItems: InvoiceItem[] = [];
    if (invoiceIds.length > 0) {
      allItems = await db.select().from(invoiceItems).where(inArray(invoiceItems.invoiceId, invoiceIds));
    }

    return rows.map(({ invoice, shop }) => ({
      ...invoice,
      shop,
      items: allItems.filter(item => item.invoiceId === invoice.id)
    }));
  }

  async getInvoicesFiltered(filters: { startDate?: string, endDate?: string, shop?: number, page?: number, limit?: number, vehicleId?: string, status?: string, excludeCashAccount?: boolean }): Promise<{ invoices: (Invoice & { shop?: number | null, customerName?: string | null })[], total: number, totalAmount: number }> {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (filters.startDate) conditions.push(gte(invoices.date, filters.startDate));
    if (filters.endDate) conditions.push(lte(invoices.date, filters.endDate));
    if (filters.shop) conditions.push(eq(vehicles.shop, filters.shop));
    if (filters.vehicleId) conditions.push(eq(invoices.vehicleId, filters.vehicleId));
    if (filters.status) conditions.push(eq(invoices.status, filters.status));

    if (filters.excludeCashAccount) {
      conditions.push(sql`LOWER(${customers.name}) != 'cash account'`);
    }

    // Get total count first
    const countQuery = db.select({ count: sql<number>`count(*)` })
      .from(invoices)
      .leftJoin(vehicles, eq(invoices.vehicleId, vehicles.id))
      .leftJoin(customers, eq(invoices.customerId, customers.id));

    if (conditions.length > 0) {
      countQuery.where(and(...conditions));
    }

    const [countResult] = await countQuery;

    // Get total sum
    const sumQuery = db.select({ totalAmount: sql<number>`COALESCE(SUM(${invoices.grandTotal}), 0)` })
      .from(invoices)
      .leftJoin(vehicles, eq(invoices.vehicleId, vehicles.id))
      .leftJoin(customers, eq(invoices.customerId, customers.id));

    if (conditions.length > 0) {
      sumQuery.where(and(...conditions));
    }

    const [sumResult] = await sumQuery;

    // Get paginated data
    const query = db.select({
      invoice: invoices,
      shop: vehicles.shop,
      customerName: customers.name
    })
      .from(invoices)
      .leftJoin(vehicles, eq(invoices.vehicleId, vehicles.id))
      .leftJoin(customers, eq(invoices.customerId, customers.id))
      .limit(limit)
      .offset(offset)
      .orderBy(desc(invoices.date), desc(invoices.invoiceNumber)); // Order by date descending

    if (conditions.length > 0) {
      query.where(and(...conditions));
    }

    const rows = await query;
    return {
      invoices: rows.map(r => ({ ...r.invoice, shop: r.shop, customerName: r.customerName })),
      total: Number(countResult?.count || 0),
      totalAmount: Number(sumResult?.totalAmount || 0)
    };
  }

  async deleteInvoicesBulk(ids: string[], userId?: string): Promise<boolean> {
    if (ids.length === 0) return false;

    // Archive invoices before deletion
    const invoicesToDelete = await db.select().from(invoices).where(inArray(invoices.id, ids));
    for (const inv of invoicesToDelete) {
      // Ideally we should also archive items, but for now invoice header + total is most critical for audit
      // To be thorough, let's fetch items too
      const items = await this.getInvoiceItems(inv.id);
      const fullRecord = { ...inv, items };
      await this.archiveRecord('invoices', inv.id, fullRecord, userId);
    }

    // First delete invoice items
    await db.delete(invoiceItems).where(inArray(invoiceItems.invoiceId, ids));

    // Also need to handle stock movements reversal? 
    // For now, removing stock movements associated with these invoices
    await db.delete(stockMovements).where(and(inArray(stockMovements.referenceId, ids), eq(stockMovements.type, 'out')));

    // Double check for Opening Balance protection in bulk delete
    const finalIdsToDelete = invoicesToDelete
      .filter(inv => !inv.invoiceNumber.startsWith("OB-"))
      .map(inv => inv.id);

    if (finalIdsToDelete.length < ids.length) {
      console.log(`Protected ${ids.length - finalIdsToDelete.length} Opening Balance invoices from bulk deletion.`);
    }

    if (finalIdsToDelete.length === 0) return true;

    // Also delete associated customer payments to prevent orphaned payments in reports
    const orphanedPayments = await db.select().from(customerPayments).where(inArray(customerPayments.invoiceId, finalIdsToDelete));
    for (const payment of orphanedPayments) {
      await this.archiveRecord('customer_payments', payment.id, payment, userId);
    }
    await db.delete(customerPayments).where(inArray(customerPayments.invoiceId, finalIdsToDelete));

    // Delete the invoices
    await db.delete(invoices).where(inArray(invoices.id, finalIdsToDelete));

    return true;
  }



  async getStockMovements(startDate?: string, endDate?: string): Promise<StockMovement[]> {
    if (startDate && endDate) {
      return await db.select().from(stockMovements)
        .where(and(gte(stockMovements.date, startDate), lte(stockMovements.date, endDate)))
        .orderBy(desc(stockMovements.date), desc(stockMovements.id));
    }
    return await db.select().from(stockMovements).orderBy(desc(stockMovements.date), desc(stockMovements.id));
  }

  async createStockMovement(insertMovement: InsertStockMovement): Promise<StockMovement> {
    const [movement] = await db.insert(stockMovements).values(insertMovement).returning();
    await this.updateProductStock(insertMovement.productId, insertMovement.quantity, insertMovement.type as 'in' | 'out');
    return movement;
  }

  async getVendorPayments(vendorId?: string): Promise<VendorPayment[]> {
    if (vendorId) {
      return await db.select().from(vendorPayments).where(eq(vendorPayments.vendorId, vendorId));
    }
    return await db.select().from(vendorPayments);
  }

  async createVendorPayment(insertPayment: InsertVendorPayment): Promise<VendorPayment> {
    const [payment] = await db.insert(vendorPayments).values(insertPayment).returning();
    return payment;
  }

  async updateVendorPayment(id: string, updateData: Partial<InsertVendorPayment>): Promise<VendorPayment | undefined> {
    const [updated] = await db
      .update(vendorPayments)
      .set(updateData)
      .where(eq(vendorPayments.id, id))
      .returning();
    return updated;
  }

  async deleteVendorPayment(id: string, userId?: string): Promise<boolean> {
    const [payment] = await db.select().from(vendorPayments).where(eq(vendorPayments.id, id));
    if (payment) {
      await this.archiveRecord('vendor_payments', id, payment, userId);
    }
    const result = await db.delete(vendorPayments).where(eq(vendorPayments.id, id)).returning();
    return result.length > 0;
  }

  async getVendorBalance(vendorId: string): Promise<{ totalPurchases: number; totalPayments: number; totalReturns: number; balance: number }> {
    const purchaseResult = await db.select({ total: sql<number>`COALESCE(SUM(${purchases.totalAmount}), 0)` })
      .from(purchases)
      .where(eq(purchases.vendorId, vendorId));

    const paymentResult = await db.select({ total: sql<number>`COALESCE(SUM(${vendorPayments.amount}), 0)` })
      .from(vendorPayments)
      .where(eq(vendorPayments.vendorId, vendorId));

    const returnResult = await db.select({ total: sql<number>`COALESCE(SUM(${vendorReturns.totalAmount}), 0)` })
      .from(vendorReturns)
      .where(eq(vendorReturns.vendorId, vendorId));

    const totalPurchases = Number(purchaseResult[0]?.total || 0);
    const totalPayments = Number(paymentResult[0]?.total || 0);
    const totalReturns = Number(returnResult[0]?.total || 0);

    return {
      totalPurchases,
      totalPayments,
      totalReturns,
      balance: totalPurchases - totalPayments - totalReturns,
    };
  }

  async getVendorBalances(): Promise<(Vendor & { totalPurchases: number; totalPayments: number; totalReturns: number; balance: number })[]> {
    // Bulk fetch optimization using simple group by or just fetching all and mapping in memory if aggregation is complex?
    // SQL aggregation is better.
    // However, for simplicity and stability with current Drizzle setup, let's try to do it efficiently.
    // Fetch all vendors, purchases, payments, returns.

    // Better: Use LEFT JOINs and GROUP BY.
    // But constructing that query with Drizzle here might be tricky without modifying schema exports.
    // Let's stick to a robust standard approach: select all vendors, and perform bulk stats.
    // Actually, SQL is best.

    const allVendors = await db.select().from(vendors);

    const purchaseStats = await db.select({
      vendorId: purchases.vendorId,
      total: sql<number>`COALESCE(SUM(${purchases.totalAmount}), 0)`
    }).from(purchases).groupBy(purchases.vendorId);

    const paymentStats = await db.select({
      vendorId: vendorPayments.vendorId,
      total: sql<number>`COALESCE(SUM(${vendorPayments.amount}), 0)`
    }).from(vendorPayments).groupBy(vendorPayments.vendorId);

    const returnStats = await db.select({
      vendorId: vendorReturns.vendorId,
      total: sql<number>`COALESCE(SUM(${vendorReturns.totalAmount}), 0)`
    }).from(vendorReturns).groupBy(vendorReturns.vendorId);

    const purchaseMap = new Map(purchaseStats.map(s => [s.vendorId, Number(s.total)]));
    const paymentMap = new Map(paymentStats.map(s => [s.vendorId, Number(s.total)]));
    const returnMap = new Map(returnStats.map(s => [s.vendorId, Number(s.total)]));

    return allVendors.map(vendor => {
      const totalPurchases = purchaseMap.get(vendor.id) || 0;
      const totalPayments = paymentMap.get(vendor.id) || 0;
      const totalReturns = returnMap.get(vendor.id) || 0;
      return {
        ...vendor,
        totalPurchases,
        totalPayments,
        totalReturns,
        balance: totalPurchases - totalPayments - totalReturns
      };
    });
  }

  async getCustomerPayments(customerId?: string): Promise<CustomerPayment[]> {
    if (customerId) {
      return await db.select().from(customerPayments)
        .where(eq(customerPayments.customerId, customerId))
        .orderBy(desc(customerPayments.date), desc(customerPayments.id));
    }
    return await db.select().from(customerPayments).orderBy(desc(customerPayments.date), desc(customerPayments.id));
  }

  async createCustomerPayment(insertPayment: InsertCustomerPayment): Promise<CustomerPayment> {
    const [payment] = await db.insert(customerPayments).values(insertPayment).returning();
    return payment;
  }

  async updateCustomerPayment(id: string, updateData: Partial<InsertCustomerPayment>): Promise<CustomerPayment | undefined> {
    const [updated] = await db
      .update(customerPayments)
      .set(updateData)
      .where(eq(customerPayments.id, id))
      .returning();
    return updated;
  }

  async deleteCustomerPayment(id: string, userId?: string): Promise<boolean> {
    const [payment] = await db.select().from(customerPayments).where(eq(customerPayments.id, id));
    if (payment) {
      await this.archiveRecord('customer_payments', id, payment, userId);
    }
    const result = await db.delete(customerPayments).where(eq(customerPayments.id, id)).returning();
    return result.length > 0;
  }

  async getCustomerBalance(customerId: string): Promise<{ totalInvoices: number; totalPayments: number; balance: number }> {
    const invoiceResult = await db.select({ total: sql<number>`COALESCE(SUM(${invoices.subtotal}), 0)` })
      .from(invoices)
      .where(eq(invoices.customerId, customerId));

    const paymentResult = await db.select({ total: sql<number>`COALESCE(SUM(${customerPayments.amount}), 0)` })
      .from(customerPayments)
      .where(eq(customerPayments.customerId, customerId));

    const totalInvoices = Number(invoiceResult[0]?.total || 0);
    const totalPayments = Number(paymentResult[0]?.total || 0);

    return {
      totalInvoices,
      totalPayments,
      balance: totalInvoices - totalPayments,
    };
  }

  async getCustomerBalances(): Promise<(Customer & { totalInvoices: number; totalPayments: number; balance: number })[]> {
    const allCustomers = await db.select().from(customers);

    const invoiceStats = await db.select({
      customerId: invoices.customerId,
      total: sql<number>`COALESCE(SUM(${invoices.subtotal}), 0)`
    }).from(invoices).groupBy(invoices.customerId);

    const paymentStats = await db.select({
      customerId: customerPayments.customerId,
      total: sql<number>`COALESCE(SUM(${customerPayments.amount}), 0)`
    }).from(customerPayments).groupBy(customerPayments.customerId);

    const invoiceMap = new Map(invoiceStats.map(s => [s.customerId, Number(s.total)]));
    const paymentMap = new Map(paymentStats.map(s => [s.customerId, Number(s.total)]));

    return allCustomers.map(customer => {
      const totalInvoices = invoiceMap.get(customer.id) || 0;
      const totalPayments = paymentMap.get(customer.id) || 0;
      return {
        ...customer,
        totalInvoices,
        totalPayments,
        balance: totalInvoices - totalPayments
      };
    });
  }

  async getAllVendorBalances(): Promise<(Vendor & { totalPurchases: number, totalPayments: number, totalReturns: number, balance: number })[]> {
    const allVendors = await db.select().from(vendors);

    // Get total purchases per vendor
    const purchasesData = await db.select({
      vendorId: purchases.vendorId,
      total: sql<number>`COALESCE(SUM(${purchases.totalAmount}), 0)`
    })
      .from(purchases)
      .groupBy(purchases.vendorId);

    // Get total payments per vendor
    const paymentsData = await db.select({
      vendorId: vendorPayments.vendorId,
      total: sql<number>`COALESCE(SUM(${vendorPayments.amount}), 0)`
    })
      .from(vendorPayments)
      .groupBy(vendorPayments.vendorId);

    // Get total returns per vendor
    const returnsData = await db.select({
      vendorId: vendorReturns.vendorId,
      total: sql<number>`COALESCE(SUM(${vendorReturns.totalAmount}), 0)`
    })
      .from(vendorReturns)
      .groupBy(vendorReturns.vendorId);

    // Map to simple lookups
    const purchaseMap = new Map(purchasesData.map(p => [p.vendorId, p.total]));
    const paymentMap = new Map(paymentsData.map(p => [p.vendorId, p.total]));
    const returnMap = new Map(returnsData.map(p => [p.vendorId, p.total]));

    return allVendors.map(vendor => {
      const totalPurchases = purchaseMap.get(vendor.id) || 0;
      const totalPayments = paymentMap.get(vendor.id) || 0;
      const totalReturns = returnMap.get(vendor.id) || 0;
      return {
        ...vendor,
        totalPurchases,
        totalPayments,
        totalReturns,
        balance: totalPurchases - totalPayments - totalReturns
      };
    });
  }

  async getAllCustomerBalances(): Promise<(Customer & { totalInvoices: number, totalPayments: number, balance: number })[]> {
    const allCustomers = await db.select().from(customers);

    // Get total invoices per customer
    const invoiceData = await db.select({
      customerId: invoices.customerId,
      total: sql<number>`COALESCE(SUM(${invoices.subtotal}), 0)`
    })
      .from(invoices)
      .groupBy(invoices.customerId);

    // Get total payments per customer
    const paymentData = await db.select({
      customerId: customerPayments.customerId,
      total: sql<number>`COALESCE(SUM(${customerPayments.amount}), 0)`
    })
      .from(customerPayments)
      .groupBy(customerPayments.customerId);

    const invoiceMap = new Map(invoiceData.map(i => [i.customerId, i.total]));
    const paymentMap = new Map(paymentData.map(p => [p.customerId, p.total]));

    return allCustomers.map(customer => {
      const totalInvoices = invoiceMap.get(customer.id) || 0;
      const totalPayments = paymentMap.get(customer.id) || 0;
      return {
        ...customer,
        totalInvoices,
        totalPayments,
        balance: totalInvoices - totalPayments
      };
    });
  }

  async getCompanySettings(): Promise<CompanySettings | undefined> {
    const [settings] = await db.select().from(companySettings).limit(1);
    return settings || undefined;
  }

  async upsertCompanySettings(insertSettings: InsertCompanySettings): Promise<CompanySettings> {
    const existing = await this.getCompanySettings();
    if (existing) {
      const [updated] = await db.update(companySettings).set(insertSettings).where(eq(companySettings.id, existing.id)).returning();
      return updated;
    }
    const [created] = await db.insert(companySettings).values(insertSettings).returning();
    return created;
  }

  // Vehicle Inventory Methods
  async getVehicleInventory(vehicleId: string): Promise<VehicleInventory[]> {
    return await db.select().from(vehicleInventory).where(eq(vehicleInventory.vehicleId, vehicleId));
  }

  async getAllVehicleInventories(): Promise<VehicleInventory[]> {
    return await db.select().from(vehicleInventory);
  }

  async getVehicleProductInventory(vehicleId: string, productId: string): Promise<VehicleInventory | undefined> {
    // Get total quantity for this vehicle+product combination (aggregate all matching rows)
    const records = await db.select().from(vehicleInventory)
      .where(and(eq(vehicleInventory.vehicleId, vehicleId), eq(vehicleInventory.productId, productId)));

    if (records.length === 0) return undefined;

    // Return first record - we'll ensure only one exists via upsert logic
    return records[0];
  }

  async loadVehicleInventory(vehicleId: string, productId: string, quantity: number, purchaseId?: string): Promise<VehicleInventory> {
    // Check if inventory record exists for this vehicle+product
    const [existing] = await db.select().from(vehicleInventory)
      .where(and(eq(vehicleInventory.vehicleId, vehicleId), eq(vehicleInventory.productId, productId)));

    let inventoryRecord: VehicleInventory;

    if (existing) {
      // Update existing inventory (upsert pattern)
      const [updated] = await db.update(vehicleInventory)
        .set({ quantity: existing.quantity + quantity })
        .where(and(eq(vehicleInventory.vehicleId, vehicleId), eq(vehicleInventory.productId, productId)))
        .returning();
      inventoryRecord = updated;
    } else {
      // Create new inventory record
      const [created] = await db.insert(vehicleInventory)
        .values({ vehicleId, productId, quantity })
        .returning();
      inventoryRecord = created;
    }

    // Update product's currentStock (increase when loading onto vehicle)
    await this.updateProductStock(productId, quantity, 'in');

    // Log the movement
    const today = new Date().toISOString().split("T")[0];
    await db.insert(vehicleInventoryMovements).values({
      vehicleId,
      productId,
      type: 'load',
      quantity,
      referenceId: purchaseId,
      referenceType: purchaseId ? 'purchase' : undefined,
      date: today,
    });

    return inventoryRecord;
  }

  async deductVehicleInventory(vehicleId: string, productId: string, quantity: number, invoiceId?: string): Promise<VehicleInventory | undefined> {
    // Find existing inventory
    const [existing] = await db.select().from(vehicleInventory)
      .where(and(eq(vehicleInventory.vehicleId, vehicleId), eq(vehicleInventory.productId, productId)));

    // Guard against insufficient stock - return undefined if not enough
    if (!existing) {
      console.warn(`Vehicle ${vehicleId} has no inventory for product ${productId}`);
      return undefined;
    }

    if (existing.quantity < quantity) {
      console.warn(`Insufficient stock: Vehicle ${vehicleId} has ${existing.quantity} but requested ${quantity}`);
      return undefined;
    }

    const newQuantity = Math.max(0, existing.quantity - quantity);

    const [updated] = await db.update(vehicleInventory)
      .set({ quantity: newQuantity })
      .where(and(eq(vehicleInventory.vehicleId, vehicleId), eq(vehicleInventory.productId, productId)))
      .returning();

    // Update product's currentStock (decrease when selling)
    await this.updateProductStock(productId, quantity, 'out');

    // Log the movement
    const today = new Date().toISOString().split("T")[0];
    await db.insert(vehicleInventoryMovements).values({
      vehicleId,
      productId,
      type: 'sale',
      quantity,
      referenceId: invoiceId,
      referenceType: invoiceId ? 'invoice' : undefined,
      date: today,
    });

    return updated;
  }

  async getVehicleInventoryMovements(vehicleId: string): Promise<VehicleInventoryMovement[]> {
    return await db.select().from(vehicleInventoryMovements)
      .where(eq(vehicleInventoryMovements.vehicleId, vehicleId))
      .orderBy(desc(vehicleInventoryMovements.date), desc(vehicleInventoryMovements.id));
  }

  async getAllVehicleInventoryMovements(): Promise<VehicleInventoryMovement[]> {
    return await db.select().from(vehicleInventoryMovements)
      .orderBy(desc(vehicleInventoryMovements.date), desc(vehicleInventoryMovements.id));
  }

  async updateVehicleInventory(vehicleId: string, productId: string, newQuantity: number): Promise<VehicleInventory> {
    const [existing] = await db.select().from(vehicleInventory)
      .where(and(eq(vehicleInventory.vehicleId, vehicleId), eq(vehicleInventory.productId, productId)));

    const oldQuantity = existing ? existing.quantity : 0;
    const diff = newQuantity - oldQuantity;

    if (diff === 0 && existing) return existing;

    let inventoryRecord: VehicleInventory;

    if (existing) {
      const [updated] = await db.update(vehicleInventory)
        .set({ quantity: newQuantity })
        .where(and(eq(vehicleInventory.vehicleId, vehicleId), eq(vehicleInventory.productId, productId)))
        .returning();
      inventoryRecord = updated;
    } else {
      const [created] = await db.insert(vehicleInventory)
        .values({ vehicleId, productId, quantity: newQuantity })
        .returning();
      inventoryRecord = created;
    }

    // Update product stock accordingly
    // If diff is positive (added stock), we assume it came from outside or implies "loading" logic? 
    // In current logic: "load" -> increases product stock?
    // Wait, loadVehicleInventory calls updateProductStock(..., quantity, 'in').
    // BUT usually 'loading' into a vehicle means taking FROM warehouse (if warehouse exists).
    // Here, products have `currentStock`. 
    // `createPurchase` increases product stock and optionally loads into vehicle.
    // `createInvoice` decreases product stock (if selling from warehouse) or vehicle stock (if vehicleId).

    // When manually updating vehicle stock:
    // If we add to vehicle, does it come from warehouse? Or just "correction"?
    // User interface says "Update Stock". Simpler to treat as correction.
    // If we want to align with `loadVehicleInventory` (which does 'in'), let's assume it INCREASES total system stock too?
    // `loadVehicleInventory` implementation:
    // await this.updateProductStock(productId, quantity, 'in');

    // So if we add to vehicle, we add to product total stock.
    if (diff !== 0) {
      await this.updateProductStock(productId, Math.abs(diff), diff > 0 ? 'in' : 'out');

      const today = new Date().toISOString().split("T")[0];
      await db.insert(vehicleInventoryMovements).values({
        vehicleId,
        productId,
        type: diff > 0 ? 'load' : 'sale', // or 'correction'? sticking to 'load'/'sale' for existing UI compat or 'adjustment'
        quantity: Math.abs(diff),
        date: today,
        notes: "Manual stock update",
      });
    }

    return inventoryRecord;
  }

  // Vendor Returns Methods
  async getVendorReturns(vendorId?: string): Promise<VendorReturn[]> {
    if (vendorId) {
      return await db.select().from(vendorReturns)
        .where(eq(vendorReturns.vendorId, vendorId))
        .orderBy(desc(vendorReturns.date), desc(vendorReturns.id));
    }
    return await db.select().from(vendorReturns).orderBy(desc(vendorReturns.date), desc(vendorReturns.id));
  }

  async getVendorReturn(id: string): Promise<VendorReturn | undefined> {
    const [vendorReturn] = await db.select().from(vendorReturns).where(eq(vendorReturns.id, id));
    return vendorReturn || undefined;
  }

  async createVendorReturn(insertVendorReturn: InsertVendorReturn, items: InsertVendorReturnItem[]): Promise<VendorReturn> {
    const [vendorReturn] = await db.insert(vendorReturns).values({
      ...insertVendorReturn,
      status: insertVendorReturn.status ?? "completed",
    }).returning();

    for (const item of items) {
      await db.insert(vendorReturnItems).values({
        ...item,
        returnId: vendorReturn.id,
      });

      // Deduct stock when returning to vendor (stock goes out)
      await this.updateProductStock(item.productId, item.quantity, 'out');

      // Record stock movement
      await db.insert(stockMovements).values({
        productId: item.productId,
        type: 'out',
        quantity: item.quantity,
        reason: `Vendor return: ${item.reason}`,
        date: insertVendorReturn.date,
        referenceId: vendorReturn.id,
      });

      // If vehicle is specified, also deduct from vehicle inventory
      if (insertVendorReturn.vehicleId) {
        await this.deductVehicleInventory(
          insertVendorReturn.vehicleId,
          item.productId,
          item.quantity,
          vendorReturn.id
        );
      }
    }

    return vendorReturn;
  }

  async getVendorReturnItems(returnId: string): Promise<VendorReturnItem[]> {
    return await db.select().from(vendorReturnItems).where(eq(vendorReturnItems.returnId, returnId));
  }

  // Hamali Cash Payments
  async getHamaliCashPayments(): Promise<HamaliCashPayment[]> {
    return await db.select().from(hamaliCashPayments).orderBy(desc(hamaliCashPayments.date), desc(hamaliCashPayments.id));
  }

  async createHamaliCashPayment(insertPayment: InsertHamaliCashPayment): Promise<HamaliCashPayment> {
    const [payment] = await db.insert(hamaliCashPayments).values(insertPayment).returning();
    return payment;
  }

  async deleteHamaliCashPayment(id: string, userId?: string): Promise<boolean> {
    const [payment] = await db.select().from(hamaliCashPayments).where(eq(hamaliCashPayments.id, id));
    if (payment) {
      await this.archiveRecord('hamali_payments', id, payment, userId);
    }
    const result = await db.delete(hamaliCashPayments).where(eq(hamaliCashPayments.id, id)).returning();
    return result.length > 0;
  }

  // System Metrics
  async getSystemMetricsHistory(limit: number = 30): Promise<SystemMetric[]> {
    return await db.select()
      .from(systemMetrics)
      .orderBy(desc(systemMetrics.date))
      .limit(limit);
  }

  async upsertSystemMetric(metric: InsertSystemMetric): Promise<SystemMetric> {
    const [existing] = await db
      .select()
      .from(systemMetrics)
      .where(eq(systemMetrics.date, metric.date));

    if (existing) {
      const [updated] = await db
        .update(systemMetrics)
        .set(metric)
        .where(eq(systemMetrics.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db.insert(systemMetrics).values(metric).returning();
    return created;
  }

  async clearTable(tableName: string): Promise<boolean> {
    // Safety check - whitelist allowed tables
    const allowedTables = [
      "invoices", "purchases", "customers", "vendors",
      "vehicles", "products", "stock_movements",
      "customer_payments", "vendor_payments", "vendor_returns",
      "hamali_cash_payments", "vehicle_inventory_movements",
      "vehicle_inventory", "deleted_records"
    ];

    if (!allowedTables.includes(tableName)) {
      throw new Error(`Deletion of table '${tableName}' is not allowed.`);
    }

    // Handle dependencies first
    if (tableName === "invoices") {
      await db.delete(invoiceItems);
      await db.delete(invoices);
      console.log("Cleared all invoices including Opening Balances.");
    } else if (tableName === "purchases") {
      await db.delete(purchaseItems);
      await db.delete(purchases);
    } else if (tableName === "vendor_returns") {
      await db.delete(vendorReturnItems);
      await db.delete(vendorReturns);
    } else if (tableName === "customers") {
      await db.delete(customers);
    } else if (tableName === "vendors") {
      await db.delete(vendors);
    } else if (tableName === "vehicles") {
      await db.delete(vehicles);
    } else if (tableName === "products") {
      await db.delete(products);
    } else if (tableName === "stock_movements") {
      await db.delete(stockMovements);
    } else if (tableName === "customer_payments") {
      await db.delete(customerPayments);
    } else if (tableName === "vendor_payments") {
      await db.delete(vendorPayments);
    } else if (tableName === "hamali_cash_payments") {
      await db.delete(hamaliCashPayments);
    } else if (tableName === "vehicle_inventory_movements") {
      await db.delete(vehicleInventoryMovements);
    } else if (tableName === "vehicle_inventory") {
      await db.delete(vehicleInventory);
    } else if (tableName === "deleted_records") {
      await db.delete(deletedRecords);
    } else {
      return false;
    }

    return true;
  }

  async getTableStats(): Promise<Record<string, { count: number; sizeBytes: number }>> {
    const stats: Record<string, { count: number; sizeBytes: number }> = {};

    // Whitelist allowed tables for stats (same as clearTable + maybe others if needed)
    const allowedTables = [
      "invoices", "purchases", "customers", "vendors",
      "vehicles", "products", "stock_movements",
      "customer_payments", "vendor_payments", "vendor_returns",
      "hamali_cash_payments", "vehicle_inventory_movements",
      "vehicle_inventory", "deleted_records"
    ];

    for (const table of allowedTables) {
      try {
        // Get count
        // Note: We use sql.raw because table names cannot be parameterized in identifiers easily without sql identifier helpers,
        // but here we are using a strict whitelist so it is safe from injection.
        const countResult = await db.execute(sql.raw(`SELECT count(*) as count FROM ${table}`));
        const count = Number(countResult.rows[0].count);

        // Get size
        const sizeResult = await db.execute(sql.raw(`SELECT pg_total_relation_size('${table}') as size`));
        const size = Number(sizeResult.rows[0].size);

        stats[table] = { count, sizeBytes: size };
      } catch (err) {
        console.error(`Failed to get stats for table ${table}:`, err);
        stats[table] = { count: 0, sizeBytes: 0 };
      }
    }

    return stats;
  }

  // Helper to archive record
  async archiveRecord(tableName: string, recordId: string, data: any, userId?: string, action: string = 'delete') {
    try {
      let invoiceNumber = null;
      let customerName = null;
      let amount = null;
      let hamali = null;
      let grandTotal = null;

      if (tableName === 'invoices') {
        invoiceNumber = data.invoiceNumber || data.invoice_number;
        amount = Number(data.subtotal || data.amount || 0);
        hamali = Number(data.hamaliChargeAmount || data.hamali || 0);
        grandTotal = Number(data.grandTotal || data.grand_total || 0);

        // Fetch customer name if possible
        const customerId = data.customerId || data.customer_id;
        if (customerId) {
          const [customer] = await db.select().from(customers).where(eq(customers.id, customerId));
          if (customer) customerName = customer.name;
        } else if (data.customerName) {
          customerName = data.customerName;
        }
      } else if (tableName === 'customer_payments') {
        amount = Number(data.amount || 0);
        grandTotal = amount; // For payments, grandTotal is the amount
        const customerId = data.customerId || data.customer_id;
        if (customerId) {
          const [customer] = await db.select().from(customers).where(eq(customers.id, customerId));
          if (customer) customerName = customer.name;
        }
        invoiceNumber = data.invoiceNumber || data.invoice_number || null;
      }

      await db.insert(deletedRecords).values({
        tableName,
        recordId,
        data: JSON.stringify(data),
        action,
        invoiceNumber,
        customerName,
        amount,
        hamali,
        grandTotal,
        deletedBy: userId || 'system',
      });
    } catch (error) {
      console.error(`Failed to archive record ${recordId} from ${tableName}:`, error);
      // Don't block deletion if archive fails, but log it critical
    }
  }

  async getDeletedRecords(filters: {
    tableName?: string;
    action?: string;
    fromDate?: string;
    toDate?: string;
    userId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ records: DeletedRecord[]; total: number }> {
    const conditions = [];

    if (filters.tableName && filters.tableName !== 'all') {
      conditions.push(eq(deletedRecords.tableName, filters.tableName));
    }
    if (filters.action) {
      conditions.push(eq(deletedRecords.action, filters.action));
    }
    if (filters.fromDate) {
      conditions.push(gte(deletedRecords.deletedAt, new Date(filters.fromDate)));
    }
    if (filters.toDate) {
      const endOfDay = new Date(filters.toDate);
      endOfDay.setHours(23, 59, 59, 999);
      conditions.push(lte(deletedRecords.deletedAt, endOfDay));
    }
    if (filters.userId && filters.userId !== 'all') {
      conditions.push(eq(deletedRecords.deletedBy, filters.userId));
    }

    const baseQuery = db.select().from(deletedRecords);
    const countQuery = db.select({ count: sql<number>`count(*)` }).from(deletedRecords);

    if (conditions.length > 0) {
      baseQuery.where(and(...conditions));
      countQuery.where(and(...conditions));
    }

    const [countResult] = await countQuery;
    const total = Number(countResult?.count || 0);

    const records = await baseQuery
      .orderBy(desc(deletedRecords.deletedAt))
      .limit(filters.limit || 50)
      .offset(filters.offset || 0);

    return { records, total };
  }

  async restoreDeletedRecord(id: string): Promise<boolean> {
    // This is complex because we need to know where to restore.
    // For now, we just return true to satisfy interface or implement later.
    // This requires specific logic per table type.
    return false;
  }

  async getShortPayments(filters?: { fromDate?: string, toDate?: string, limit?: number, offset?: number }): Promise<{ records: any[], total: number }> {
    const allCustomers = await db.select().from(customers);
    const directCustomerIds = new Set(
      allCustomers
        .filter(c => c.name.toLowerCase().includes("cash") || c.name.toLowerCase() === "direct customer")
        .map(c => c.id)
    );

    const allInvoices = await db.select().from(invoices);
    let directInvoices = allInvoices.filter(i => directCustomerIds.has(i.customerId));

    if (filters?.fromDate) {
      const fromD = filters.fromDate.split('T')[0];
      directInvoices = directInvoices.filter(i => i.date >= fromD);
    }
    if (filters?.toDate) {
      const toD = filters.toDate.split('T')[0];
      directInvoices = directInvoices.filter(i => i.date <= toD);
    }

    const allPayments = await db.select().from(customerPayments);

    let shortPayments = [];

    for (const inv of directInvoices) {
      const invPayments = allPayments.filter(p => p.invoiceId === inv.id);
      const totalPaid = invPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const expected = Number(inv.grandTotal || 0);

      // Catch underpayments (shortfalls)
      if (expected - totalPaid > 0.01) {
        const customer = allCustomers.find(c => c.id === inv.customerId);
        shortPayments.push({
          id: inv.id,
          date: inv.date,
          invoiceNumber: inv.invoiceNumber,
          customerName: customer?.name || "Unknown",
          expectedAmount: expected,
          paidAmount: totalPaid,
          difference: expected - totalPaid
        });
      }
    }

    shortPayments.sort((a, b) => b.date.localeCompare(a.date));

    const total = shortPayments.length;
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;
    const records = shortPayments.slice(offset, offset + limit);

    return { records, total };
  }

  async createOpeningBalanceInvoice(customerId: string, amount: number): Promise<Invoice> {
    const invoiceNumber = `OB-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const today = new Date().toISOString().split("T")[0];

    const [invoice] = await db.insert(invoices).values({
      invoiceNumber,
      customerId,
      date: today,
      subtotal: amount,
      grandTotal: amount,
      status: "pending",
      includeHamaliCharge: false,
      hamaliPaidByCash: false,
    }).returning();

    return invoice;
  }
  
  async clearOpeningBalances(customerId: string): Promise<boolean> {
    const customerInvoices = await db.select().from(invoices).where(eq(invoices.customerId, customerId));
    const obInvoices = customerInvoices.filter(inv => inv.invoiceNumber.startsWith("OB-"));
    const obIds = obInvoices.map(inv => inv.id);
    
    if (obIds.length === 0) return true;
    
    // Safety archive
    for (const inv of obInvoices) {
       await this.archiveRecord('invoices', inv.id, inv, 'system', 'clear_ob');
    }
    
    // Since OB invoices usually don't have items or stock movements, a simple delete is mostly fine, 
    // but let's be thorough and delete associated items if any
    await db.delete(invoiceItems).where(inArray(invoiceItems.invoiceId, obIds));
    await db.delete(invoices).where(inArray(invoices.id, obIds));
    
    return true;
  }
}

export const storage = new DatabaseStorage();
