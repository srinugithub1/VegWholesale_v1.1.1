import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useShop } from "@/hooks/use-shop";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "wouter";
import {
  Users,
  UserCheck,
  Package,
  IndianRupee,
  ShoppingCart,
  Receipt,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Wallet,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  Legend,
} from "recharts";
import {
  Tooltip as UiTooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";
import type { Vendor, Customer, Product, Invoice, Purchase, CustomerPayment, Vehicle, VehicleInventory } from "@shared/schema";

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: typeof Users;
  trend?: "up" | "down";
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <div className="text-2xl font-semibold font-mono" data-testid={`text-metric-${title.toLowerCase().replace(/\s/g, '-')}`}>
            {value}
          </div>
          {trend && (
            <div className={trend === "up" ? "text-primary" : "text-destructive"}>
              {trend === "up" ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
            </div>
          )}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

function LowStockAlert({ products }: { products: Product[] }) {
  const lowStockProducts = products.filter(
    (p) => p.currentStock <= (p.reorderLevel || 10)
  );

  if (lowStockProducts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <Package className="h-8 w-8 mb-2" />
        <p className="text-sm">All stock levels are healthy</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {lowStockProducts.slice(0, 5).map((product) => (
        <div
          key={product.id}
          className="flex items-center justify-between p-3 rounded-md bg-muted/50"
          data-testid={`alert-low-stock-${product.id}`}
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-4 w-4 text-chart-2" />
            <div>
              <p className="text-sm font-medium">{product.name}</p>
              <p className="text-xs text-muted-foreground">
                {product.currentStock} {product.unit} remaining
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            Reorder
          </Badge>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { shop } = useShop();

  const { data: vendors = [], isLoading: vendorsLoading } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  const { data: customers = [], isLoading: customersLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: invoicesResult, isLoading: invoicesLoading } = useQuery<{ invoices: Invoice[], total: number }>({
    queryKey: ["/api/invoices?limit=100000"],
  });
  const allInvoices = invoicesResult?.invoices || [];

  const { data: allPurchases = [], isLoading: purchasesLoading } = useQuery<Purchase[]>({
    queryKey: ["/api/purchases"],
  });

  const { data: customerPayments = [], isLoading: paymentsLoading } = useQuery<CustomerPayment[]>({
    queryKey: ["/api/customer-payments"],
  });

  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });

  const { data: vehicleInventories = [] } = useQuery<VehicleInventory[]>({
    queryKey: ["/api/all-vehicle-inventories"],
  });

  const { data: deletedRecordsResult, isLoading: deletedLoading } = useQuery<{ records: any[] }>({
    queryKey: ["/api/admin/deleted-records", {
      // Fetch a wide range for balance filtering
      limit: 10000
    }],
  });
  const deletedRecords = deletedRecordsResult?.records || [];

  const isLoading = vendorsLoading || customersLoading || productsLoading || invoicesLoading || purchasesLoading || paymentsLoading || vehiclesLoading || deletedLoading;

  // Filter data by selected shop
  const { invoices, purchases, shopStock } = useMemo(() => {
    // Defensive checks for array data
    const safeVehicles = Array.isArray(vehicles) ? vehicles : [];
    const safeAllInvoices = Array.isArray(allInvoices) ? allInvoices : [];
    const safeAllPurchases = Array.isArray(allPurchases) ? allPurchases : [];
    const safeVehicleInventories = Array.isArray(vehicleInventories) ? vehicleInventories : [];

    const shopVehicles = safeVehicles.filter(v => shop === 'all' || v.shop === shop);
    const shopVehicleIds = new Set(shopVehicles.map(v => v.id));

    // Filter invoices: Include all if 'all' is selected, otherwise filter by vehicle shop
    const filteredInvoices = safeAllInvoices.filter(i =>
      shop === 'all' || (i.vehicleId && shopVehicleIds.has(i.vehicleId))
    );

    // Filter purchases
    const filteredPurchases = safeAllPurchases.filter(p =>
      shop === 'all' || (p.vehicleId && shopVehicleIds.has(p.vehicleId))
    );

    // Filter stock (vehicle inventory)
    const filteredInventory = safeVehicleInventories.filter(vi =>
      shop === 'all' || (vi.vehicleId && shopVehicleIds.has(vi.vehicleId))
    );

    // Aggregate stock by product for this shop
    const stockMap = new Map<string, number>();
    filteredInventory.forEach(vi => {
      const current = stockMap.get(vi.productId) || 0;
      stockMap.set(vi.productId, current + vi.quantity);
    });

    return {
      invoices: filteredInvoices,
      purchases: filteredPurchases,
      shopStock: stockMap
    };
  }, [shop, vehicles, allInvoices, allPurchases, vehicleInventories]);


  const totalStockValue = useMemo(() => {
    let total = 0;
    shopStock.forEach((quantity, productId) => {
      const product = products.find(p => p.id === productId);
      if (product) {
        total += quantity * product.purchasePrice;
      }
    });
    return total;
  }, [shopStock, products]);

  const today = format(new Date(), "yyyy-MM-dd");

  const todaySales = invoices
    .filter((i) => i.date === today)
    .reduce((acc, i) => acc + (i.subtotal || 0), 0);

  // Calculate opening and closing balances with detailed breakdowns
  const balances = useMemo(() => {
    const totalSalesBeforeToday = invoices
      .filter(inv => inv.date < today)
      .reduce((sum, inv) => sum + (inv.subtotal || 0), 0);

    const shopInvoiceIds = new Set(invoices.map(i => i.id));
    const deletedInvoiceIds = new Set(deletedRecords
      .filter(r => r.tableName === 'invoices' && r.action === 'delete')
      .map(r => r.recordId));

    const filteredPayments = customerPayments.filter(p => {
      // If payment is linked to an invoice, check if that invoice is in our current list
      if (p.invoiceId) {
        // If it's linked to an active invoice BUT not in this shop, exclude it
        const linkedInvoiceExists = allInvoices.some(inv => inv.id === p.invoiceId);
        if (linkedInvoiceExists && !shopInvoiceIds.has(p.invoiceId)) {
          return false;
        }

        // If it's linked to a deleted invoice, exclude it (to match reports logic)
        if (deletedInvoiceIds.has(p.invoiceId)) {
          return false;
        }
      }
      return true;
    });

    const totalPaymentsBeforeToday = filteredPayments
      .filter(p => p.date < today)
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    const openingBalance = totalSalesBeforeToday - totalPaymentsBeforeToday;

    // Today's Sales Breakdown
    const todayInvoices = invoices.filter(inv => inv.date === today);
    const todaySalesBreakdown = todayInvoices.reduce((acc, inv) => {
      const customer = customers.find(c => c.id === inv.customerId);
      const cName = (customer?.name || "").toLowerCase();
      const isCash = cName.includes('cash') || cName === 'direct customer';

      if (isCash) {
        acc.cashSales += (inv.subtotal || 0);
      } else {
        acc.creditSales += (inv.subtotal || 0);
      }
      acc.hamaliAmount += (inv.hamaliChargeAmount || 0);
      return acc;
    }, { cashSales: 0, creditSales: 0, hamaliAmount: 0 });

    const todayTotalSales = todayInvoices.reduce((sum, inv) => sum + (inv.subtotal || 0), 0);

    // Payments Received Breakdown
    const todayPaymentsList = filteredPayments.filter(p => p.date === today);
    const todayPaymentsBreakdown = {
      directCash: 0,
      customerPayments: 0,
      deletedAmount: 0,
    };

    // Calculate Deleted Amount from archived invoices today
    todayPaymentsBreakdown.deletedAmount = deletedRecords
      .filter(r => r.tableName === 'invoices' && r.action === 'delete')
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

    todayPaymentsList.forEach(p => {
      if (p.invoiceId) {
        const inv = allInvoices.find(i => i.id === p.invoiceId);
        const customer = customers.find(c => c.id === (inv?.customerId || p.customerId));
        const cName = (customer?.name || "").toLowerCase();
        if (cName.includes('cash') || cName === 'direct customer') {
          todayPaymentsBreakdown.directCash += (inv?.subtotal || p.amount || 0);
        } else {
          todayPaymentsBreakdown.customerPayments += (p.amount || 0);
        }
      } else {
        todayPaymentsBreakdown.customerPayments += (p.amount || 0);
      }
    });

    const todayPaymentsBigNumber = todayPaymentsBreakdown.directCash + todayPaymentsBreakdown.customerPayments;
    const closingBalance = openingBalance + todayTotalSales - todayPaymentsBigNumber;

    return {
      openingBalance,
      closingBalance,
      todayTotalSales,
      todayPayments: todayPaymentsBigNumber,
      todaySalesBreakdown,
      todayPaymentsBreakdown,
    };
  }, [invoices, customerPayments, today, customers, allInvoices, vehicles, shop, deletedRecords]);

  const recentInvoices = [...invoices]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  const recentPurchases = [...purchases]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  // Chart data: Top products by stock value (Shop specific)
  const stockValueData = useMemo(() => {
    return Array.from(shopStock.entries())
      .map(([productId, quantity]) => {
        const product = products.find(p => p.id === productId);
        if (!product) return null;
        return {
          name: product.name.length > 12 ? product.name.slice(0, 12) + "..." : product.name,
          fullName: product.name,
          value: quantity * product.purchasePrice,
          stock: quantity,
          unit: product.unit,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null && item.stock > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [shopStock, products]);

  // Chart data: Last 7 days sales trend
  const salesTrendData = useMemo(() => {
    // First, aggregate all invoices by date in a single pass
    const salesByDate = new Map<string, { sales: number; count: number }>();
    invoices.forEach((inv) => {
      const existing = salesByDate.get(inv.date) || { sales: 0, count: 0 };
      existing.sales += (inv.subtotal || 0);
      existing.count += 1;
      salesByDate.set(inv.date, existing);
    });

    // Then build the 7-day array using the pre-aggregated map
    const days: { date: string; sales: number; invoices: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = format(d, "yyyy-MM-dd");
      const dayData = salesByDate.get(dateStr) || { sales: 0, count: 0 };
      days.push({
        date: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
        sales: dayData.sales,
        invoices: dayData.count,
      });
    }
    return days;
  }, [invoices]);


  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview of your wholesale business
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Opening Balance */}
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium text-primary">Opening Balance</CardTitle>
              <TooltipProvider>
                <UiTooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[300px]">
                    <p>Total outstanding credit from all customers BEFORE today. Calculated as (Total Past Sales - Total Past Payments).</p>
                  </TooltipContent>
                </UiTooltip>
              </TooltipProvider>
            </div>
            <IndianRupee className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold font-mono ${balances.openingBalance > 0 ? 'text-amber-600 dark:text-amber-500' : 'text-green-600 dark:text-green-500'}`}>
              ₹{balances.openingBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">Outstanding before period</p>
          </CardContent>
        </Card>

        {/* Card 2: Today's Sales */}
        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium text-white">Today's Sales</CardTitle>
              <TooltipProvider>
                <UiTooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[300px]">
                    <p>Total of all invoices created today. Broken down into Cash sales vs Credit sales.</p>
                  </TooltipContent>
                </UiTooltip>
              </TooltipProvider>
            </div>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              ₹{balances.todayTotalSales.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{invoices.filter(i => i.date === today).length} invoices today</p>
            <div className="mt-4 space-y-1 text-sm border-t pt-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">1. Cash Sale:</span>
                <span className="font-medium text-orange-500">₹{balances.todaySalesBreakdown.cashSales.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">2. Credit Sale:</span>
                <span className="font-medium text-blue-500">₹{balances.todaySalesBreakdown.creditSales.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between border-t border-dashed mt-1 pt-1">
                <span className="text-muted-foreground">3. Hamali Amount:</span>
                <span className="font-medium text-green-500">₹{balances.todaySalesBreakdown.hamaliAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Payments Received */}
        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium text-green-500">Payments Received</CardTitle>
              <TooltipProvider>
                <UiTooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[300px]">
                    <p>Total money collected today. Includes immediate cash from sales and payments for past credits.</p>
                  </TooltipContent>
                </UiTooltip>
              </TooltipProvider>
            </div>
            <Wallet className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              ₹{balances.todayPayments.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <div className="mt-4 space-y-1 text-sm border-t pt-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">1. Cash Sale (Direct):</span>
                <span className="font-medium text-orange-500">₹{balances.todayPaymentsBreakdown.directCash.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">2. Customer Payment:</span>
                <span className="font-medium text-blue-500">₹{balances.todayPaymentsBreakdown.customerPayments.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between border-t border-dashed mt-1 pt-1">
                <span className="text-muted-foreground">3. Deleted Record Info:</span>
                <span className="font-medium text-red-500">₹{balances.todayPaymentsBreakdown.deletedAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Closing Balance */}
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium text-primary">Closing Balance</CardTitle>
              <TooltipProvider>
                <UiTooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[300px]">
                    <div className="space-y-2">
                      <p className="font-semibold underline">Closing Balance = Opening + Sales - Payments</p>
                      <p>Outstanding credit at the END of today based on today's activity.</p>
                    </div>
                  </TooltipContent>
                </UiTooltip>
              </TooltipProvider>
            </div>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold font-mono ${balances.closingBalance > 0 ? 'text-amber-600 dark:text-amber-500' : 'text-green-600 dark:text-green-500'}`}>
              ₹{balances.closingBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Outstanding after period</p>
            <div className="mt-4 space-y-1 text-sm border-t pt-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">1. Opening Balance:</span>
                <span className="font-medium text-orange-500">₹{balances.openingBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">2. Total Sales (+):</span>
                <span className="font-medium text-blue-500">₹{balances.todayTotalSales.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between border-t border-dashed mt-1 pt-1">
                <span className="text-muted-foreground">3. Payments (-):</span>
                <span className="font-medium text-green-500">₹{balances.todayPayments.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Stock Value"
          value={`₹${totalStockValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
          subtitle={`${products.length} products`}
          icon={IndianRupee}
        />
        <MetricCard
          title="Active Vendors"
          value={vendors.length}
          subtitle="Suppliers"
          icon={Users}
        />
        <MetricCard
          title="Customers"
          value={customers.length}
          subtitle="Registered buyers"
          icon={UserCheck}
        />
        <MetricCard
          title="Total Invoices"
          value={invoices.length}
          subtitle="All time"
          icon={Receipt}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-lg font-semibold">7-Day Sales Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64" data-testid="chart-sales-trend">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesTrendData}>
                  <defs>
                    <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                  />
                  <ChartTooltip
                    formatter={(value: number) => [`₹${value.toLocaleString("en-IN")}`, "Sales"]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="sales"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#salesGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-lg font-semibold">Stock Value by Product</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64" data-testid="chart-stock-value">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stockValueData} layout="vertical">
                  <XAxis
                    type="number"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={80}
                  />
                  <ChartTooltip
                    formatter={(value: number) => [`₹${value.toLocaleString("en-IN")}`, "Value"]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                    }}
                  />
                  <Bar
                    dataKey="value"
                    fill="hsl(var(--primary))"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-lg font-semibold">Recent Invoices</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/print">View All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentInvoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Receipt className="h-8 w-8 mb-2" />
                <p className="text-sm">No invoices yet</p>
                <Button variant="outline" size="sm" className="mt-2" asChild>
                  <Link href="/weighing">Create First Invoice</Link>
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentInvoices.map((invoice) => (
                    <TableRow key={invoice.id} data-testid={`row-invoice-${invoice.id}`}>
                      <TableCell className="font-mono text-sm">
                        {invoice.invoiceNumber}
                      </TableCell>
                      <TableCell className="text-sm">{invoice.date}</TableCell>
                      <TableCell className="text-right font-mono">
                        ₹{invoice.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={invoice.status === "completed" ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {invoice.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-lg font-semibold">Low Stock Alerts</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/stock">View Stock</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <LowStockAlert products={products} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-lg font-semibold">Recent Purchases</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/purchases">View All</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentPurchases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <ShoppingCart className="h-8 w-8 mb-2" />
              <p className="text-sm">No purchases yet</p>
              <Button variant="outline" size="sm" className="mt-2" asChild>
                <Link href="/purchases">Create First Purchase</Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Purchase ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentPurchases.map((purchase) => (
                  <TableRow key={purchase.id} data-testid={`row-purchase-${purchase.id}`}>
                    <TableCell className="font-mono text-sm">
                      {purchase.id.slice(0, 8)}...
                    </TableCell>
                    <TableCell className="text-sm">{purchase.date}</TableCell>
                    <TableCell className="text-right font-mono">
                      ₹{purchase.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={purchase.status === "completed" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {purchase.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
