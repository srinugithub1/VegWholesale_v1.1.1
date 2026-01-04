import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Package, ArrowUpRight, Receipt, CreditCard, Download, Calendar, Filter, Truck, Users, Scale, ShoppingBag, FileText, BarChart3 } from "lucide-react";
import type { Product, Invoice, Customer, Vehicle, InvoiceItem, Vendor, CustomerPayment } from "@shared/schema";
import { generateDetailedReport } from "@/lib/pdf-generator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { useShop } from "@/hooks/use-shop";

type DailySummary = {
  date: string;
  sales: number;
  invoiceCount: number;
  hamaliTotal: number;
  totalWeight: number;
};

function formatCurrency(amount: number): string {
  return amount.toLocaleString("en-IN", { style: "currency", currency: "INR" });
}

function formatWeight(weight: number): string {
  return `${weight.toFixed(2)} KG`;
}

function downloadCSV(data: string[][], filename: string) {
  const csvContent = data.map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export default function Reports() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(),
    to: new Date(),
  });
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("all");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("all");
  const [selectedVendorId, setSelectedVendorId] = useState<string>("all");
  const { shop } = useShop();

  const startDate = dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : "";
  const endDate = dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : "";

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const { data: invoiceItems = [] } = useQuery<InvoiceItem[]>({
    queryKey: ["/api/invoice-items"],
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: vehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  const { data: customerPayments = [] } = useQuery<CustomerPayment[]>({
    queryKey: ["/api/customer-payments"],
  });

  const getCustomerName = (id: string) => customers.find((c) => c.id === id)?.name || "Unknown";
  const getVendorName = (id: string | null) => vendors.find((v) => v.id === id)?.name || "-";
  const getProductName = (id: string) => products.find((p) => p.id === id)?.name || "Unknown";
  const getVehicleNumber = (id: string | null) => vehicles.find((v) => v.id === id)?.number || "-";
  const getInvoiceVendorName = (inv: Invoice) => {
    if (inv.vendorId) {
      return getVendorName(inv.vendorId);
    }
    const vehicle = vehicles.find(v => v.id === inv.vehicleId);
    if (vehicle?.vendorId) {
      return getVendorName(vehicle.vendorId);
    }
    return "-";
  };


  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (startDate && inv.date < startDate) return false;
      if (endDate && inv.date > endDate) return false;
      if (selectedVehicleId !== "all" && inv.vehicleId !== selectedVehicleId) return false;
      if (selectedCustomerId !== "all" && inv.customerId !== selectedCustomerId) return false;
      if (selectedVendorId !== "all") {
        const invoiceVendorId = inv.vendorId || vehicles.find(v => v.id === inv.vehicleId)?.vendorId;
        if (invoiceVendorId !== selectedVendorId) return false;
      }
      if (shop !== 'all') {
        const vehicle = vehicles.find(v => v.id === inv.vehicleId);
        if (vehicle && vehicle.shop !== shop) return false;
      }
      return true;
    }).sort((a, b) => b.date.localeCompare(a.date) || b.invoiceNumber.localeCompare(a.invoiceNumber));
  }, [invoices, startDate, endDate, selectedVehicleId, selectedCustomerId, selectedVendorId, vehicles, shop]);

  const summary = useMemo(() => {
    const totalSales = filteredInvoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
    const totalSubtotal = filteredInvoices.reduce((sum, inv) => sum + (inv.subtotal || 0), 0);
    const totalHamali = filteredInvoices.reduce((sum, inv) => sum + (inv.hamaliChargeAmount || 0), 0);
    const totalWeight = filteredInvoices.reduce((sum, inv) => sum + (inv.totalKgWeight || 0), 0);
    const totalBags = filteredInvoices.reduce((sum, inv) => sum + (inv.bags || 0), 0);
    const invoiceCount = filteredInvoices.length;
    const invoicesWithHamali = filteredInvoices.filter(inv => inv.includeHamaliCharge && (inv.hamaliChargeAmount || 0) > 0).length;

    const filteredInvoiceIds = new Set(filteredInvoices.map(inv => inv.id));
    const totalPaid = customerPayments
      .filter(p => p.invoiceId && filteredInvoiceIds.has(p.invoiceId))
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalRemaining = totalSales - totalPaid;

    // Calculate opening and closing balance for the date range
    const salesBeforePeriod = invoices
      .filter(inv => startDate && inv.date < startDate)
      .reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
    const paymentsBeforePeriod = customerPayments
      .filter(p => startDate && p.date < startDate)
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    const openingBalance = salesBeforePeriod - paymentsBeforePeriod;

    const salesInPeriod = filteredInvoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
    const paymentsInPeriod = customerPayments
      .filter(p => {
        if (startDate && p.date < startDate) return false;
        if (endDate && p.date > endDate) return false;
        return true;
      })
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    const closingBalance = openingBalance + salesInPeriod - paymentsInPeriod;

    return {
      totalSales,
      totalSubtotal,
      totalHamali,
      totalWeight,
      totalBags,
      invoiceCount,
      invoicesWithHamali,
      totalPaid,
      totalRemaining,
      openingBalance,
      closingBalance,
      paymentsInPeriod,
    };
  }, [filteredInvoices, customerPayments, invoices, startDate, endDate]);

  const dailySummary = useMemo((): DailySummary[] => {
    const dateMap = new Map<string, DailySummary>();

    filteredInvoices.forEach((inv) => {
      const existing = dateMap.get(inv.date) || {
        date: inv.date,
        sales: 0,
        invoiceCount: 0,
        hamaliTotal: 0,
        totalWeight: 0,
      };
      existing.sales += inv.grandTotal || 0;
      existing.invoiceCount += 1;
      existing.hamaliTotal += inv.hamaliChargeAmount || 0;
      existing.totalWeight += inv.totalKgWeight || 0;
      dateMap.set(inv.date, existing);
    });

    return Array.from(dateMap.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredInvoices]);

  const chartData = useMemo(() => {
    return [...dailySummary].reverse().slice(-14).map((day) => ({
      date: new Date(day.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      sales: day.sales,
      hamali: day.hamaliTotal,
    }));
  }, [dailySummary]);

  const salesBreakdownData = useMemo(() => {
    return [
      { name: "Product Sales", value: summary.totalSubtotal },
      { name: "Hamali Charges", value: summary.totalHamali },
    ].filter((d) => d.value > 0);
  }, [summary]);


  const reportItems = useMemo(() => {
    const relevantInvoiceIds = new Set(filteredInvoices.map(inv => inv.id));

    return invoiceItems
      .filter(item => relevantInvoiceIds.has(item.invoiceId))
      .map((item, index) => {
        const invoice = invoices.find(inv => inv.id === item.invoiceId);

        // Context Data
        const customer = invoice ? getCustomerName(invoice.customerId) : "Unknown";
        const invoiceNumber = invoice?.invoiceNumber || "-";
        const date = invoice?.date || "";
        const vehicleNumber = getVehicleNumber(invoice?.vehicleId || null);
        const vendorName = getInvoiceVendorName(invoice as Invoice);
        const productName = getProductName(item.productId);

        const quantity = item.quantity;
        const unitPrice = item.unitPrice;
        const subtotal = quantity * unitPrice;

        // Determine if this is a single-item invoice to allow precise Bag/Hamali mapping
        const itemsInInvoice = invoiceItems.filter(i => i.invoiceId === item.invoiceId);
        const isSingleItem = itemsInInvoice.length === 1;

        // Hamali logic
        let hamali = 0;
        const invoiceHamali = invoice?.hamaliChargeAmount || 0;

        if (invoice && invoiceHamali > 0) {
          if (isSingleItem) {
            hamali = invoiceHamali;
          } else if (itemsInInvoice.length > 0) {
            // Pro-rate by weight share
            const totalInvWeight = invoice.totalKgWeight || 1;
            if (totalInvWeight > 0) {
              hamali = (item.quantity / totalInvWeight) * invoiceHamali;
            }
          }
        }

        const total = subtotal + hamali;

        // Bags Logic
        const bags = (invoice && isSingleItem) ? (invoice.bags || 0) : 0;

        // Payment Type Logic
        const paymentType = (invoice?.status === "completed") ? "CASH" : "CREDIT";

        return {
          no: index + 1,
          id: item.id,
          invoiceId: item.invoiceId,

          invoiceNumber,
          date,
          vehicle: vehicleNumber,
          customer,
          vendor: vendorName,

          item: productName,
          weight: quantity,
          bags,
          price: unitPrice,
          type: paymentType as "CASH" | "CREDIT",
          subtotal,
          hamali,
          total
        };
      });
  }, [filteredInvoices, invoiceItems, invoices, customers, vehicles, vendors, products]);

  const reportSummary = useMemo(() => {
    if (reportItems.length === 0) return summary;

    const totalWeight = reportItems.reduce((sum, i) => sum + i.weight, 0);
    const totalBags = reportItems.reduce((sum, i) => sum + i.bags, 0);
    const totalSubtotal = reportItems.reduce((sum, i) => sum + i.subtotal, 0);
    const totalHamali = reportItems.reduce((sum, i) => sum + i.hamali, 0);
    const totalSales = reportItems.reduce((sum, i) => sum + i.total, 0);

    return {
      ...summary,
      totalWeight,
      totalBags,
      totalSubtotal,
      totalHamali,
      totalSales,
      grandTotal: totalSales
    };
  }, [reportItems, summary]);

  const CHART_COLORS = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
  ];

  const downloadSalesReport = () => {
    const headers = ["Invoice #", "Date", "Vehicle", "Customer", "Vendor", "Weight (KG)", "Subtotal", "Hamali", "Grand Total"];
    const rows = filteredInvoices.map((inv) => [
      inv.invoiceNumber || "",
      inv.date || "",
      getVehicleNumber(inv.vehicleId),
      getCustomerName(inv.customerId),
      getInvoiceVendorName(inv),
      (inv.totalKgWeight || 0).toFixed(2),
      (inv.subtotal || 0).toFixed(2),
      (inv.hamaliChargeAmount || 0).toFixed(2),
      (inv.grandTotal || 0).toFixed(2),
    ]);
    const totals = [
      "TOTAL",
      "",
      "",
      `${filteredInvoices.length} sales`,
      "",
      summary.totalWeight.toFixed(2),
      summary.totalSubtotal.toFixed(2),
      summary.totalHamali.toFixed(2),
      summary.totalSales.toFixed(2),
    ];
    downloadCSV([headers, ...rows, totals], `sales-report-${startDate}-to-${endDate}.csv`);
  };

  const downloadDailySummaryReport = () => {
    const headers = ["Date", "Total Sales", "Invoice Count", "Total Hamali", "Total Weight (KG)"];
    const rows = dailySummary.map((day) => [
      day.date,
      day.sales.toFixed(2),
      day.invoiceCount.toString(),
      day.hamaliTotal.toFixed(2),
      day.totalWeight.toFixed(2),
    ]);
    const totals = [
      "TOTAL",
      dailySummary.reduce((sum, d) => sum + d.sales, 0).toFixed(2),
      dailySummary.reduce((sum, d) => sum + d.invoiceCount, 0).toString(),
      dailySummary.reduce((sum, d) => sum + d.hamaliTotal, 0).toFixed(2),
      dailySummary.reduce((sum, d) => sum + d.totalWeight, 0).toFixed(2),
    ];
    downloadCSV([headers, ...rows, totals], `daily-summary-${startDate}-to-${endDate}.csv`);
  };

  const downloadDetailedPDF = () => {
    try {
      // Determine Report Title
      let reportTitle = "Daily Sales Report";
      if (selectedVehicleId !== "all") {
        const v = vehicles.find(v => v.id === selectedVehicleId);
        reportTitle = `Vehicle Report - ${v?.number || 'Unknown'}`;
      } else if (selectedCustomerId !== "all") {
        const c = customers.find(c => c.id === selectedCustomerId);
        reportTitle = `Customer Report - ${c?.name || 'Unknown'}`;
      } else if (selectedVendorId !== "all") {
        const v = vendors.find(v => v.id === selectedVendorId);
        reportTitle = `Vendor Report - ${v?.name || 'Unknown'}`;
      }

      // Determine vehicle details for header
      let vehicleNumber = "N/A";
      let vendorName = "";
      let vehicleTotalGain = 0;
      let vehicleTotalLoss = 0;

      if (selectedVehicleId !== "all") {
        vehicleNumber = getVehicleNumber(selectedVehicleId);
        const v = vehicles.find(v => v.id === selectedVehicleId);
        if (v) {
          const ven = vendors.find(vn => vn.id === v.vendorId);
          vendorName = ven ? ven.name : "";
          vehicleTotalGain = v.totalWeightGain || 0;
          vehicleTotalLoss = v.totalWeightLoss || 0;
        }
      }

      // Calculate Vehicle Load Totals (if applicable)
      const currentVehicle = vehicles.find(v => v.id === selectedVehicleId);
      const totalSoldWeight = reportSummary.totalWeight;
      const totalSoldBags = reportSummary.totalBags;

      const vehicleTotalWeight = currentVehicle?.startingWeight && currentVehicle.startingWeight > 0
        ? currentVehicle.startingWeight
        : totalSoldWeight;

      const vehicleTotalBags = currentVehicle?.startingBags && currentVehicle.startingBags > 0
        ? currentVehicle.startingBags
        : totalSoldBags;

      // Filter Credit/Cash from reportItems
      const totalCredit = reportItems.filter(i => i.type === "CREDIT").reduce((sum, i) => sum + i.total, 0);
      const totalCash = reportItems.filter(i => i.type === "CASH").reduce((sum, i) => sum + i.total, 0);

      generateDetailedReport({
        date: startDate === endDate ? startDate : `${startDate} to ${endDate}`,
        title: reportTitle,
        vehicleNumber,
        vendorName,
        totalWeight: vehicleTotalWeight,
        totalBags: vehicleTotalBags,
        totalGain: vehicleTotalGain,
        totalLoss: vehicleTotalLoss,
        // Map reportItems to PDF specific interface
        items: reportItems.map(item => ({
          no: item.no,
          invoiceNumber: item.invoiceNumber,
          item: item.item,
          customer: item.customer,
          weight: item.weight,
          bags: item.bags,
          price: item.price,
          type: item.type,
          subtotal: item.subtotal,
          hamali: item.hamali,
          total: item.total
        })),
        summary: {
          qtyReceived: vehicleTotalWeight,
          qtySold: totalSoldWeight,
          qtyRemaining: vehicleTotalWeight - totalSoldWeight - (vehicleTotalLoss || 0),
          totalCredit,
          totalCash,
          grandTotal: reportSummary.totalSales
        }
      });
    } catch (error) {
      console.error("PDF Generation Error:", error);
      alert(`Failed to generate PDF: ${(error as Error).message}`);
    }
  };

  const FilterSection = () => (
    <Card className="mb-4">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Filter className="h-4 w-4" />
          Filters
        </CardTitle>
        <Button variant="default" size="sm" onClick={downloadDetailedPDF} data-testid="button-download-pdf">
          <FileText className="h-4 w-4 mr-1" />
          PDF Report
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-4 flex-wrap">
          <div className="space-y-2">
            <Label>Date Range</Label>
            <DatePickerWithRange date={dateRange} setDate={setDateRange} className="w-[300px]" />
          </div>
          <div className="space-y-2">
            <Label>Vehicle</Label>
            <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
              <SelectTrigger className="w-44" data-testid="select-filter-vehicle">
                <Truck className="h-4 w-4 mr-1" />
                <SelectValue placeholder="All Vehicles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vehicles</SelectItem>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.number}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Customer</Label>
            <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
              <SelectTrigger className="w-44" data-testid="select-filter-customer">
                <Users className="h-4 w-4 mr-1" />
                <SelectValue placeholder="All Customers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Customers</SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Vendor</Label>
            <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
              <SelectTrigger className="w-44" data-testid="select-filter-vendor">
                <Package className="h-4 w-4 mr-1" />
                <SelectValue placeholder="All Vendors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vendors</SelectItem>
                {vendors.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(selectedVehicleId !== "all" || selectedCustomerId !== "all" || selectedVendorId !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedVehicleId("all");
                setSelectedCustomerId("all");
                setSelectedVendorId("all");
              }}
              data-testid="button-clear-filters"
            >
              Clear Filters
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (invoicesLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">
          Sales Reports
        </h1>
        <div className="flex items-center gap-2">
          {/* CSV Download buttons removed */}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-primary">Opening Balance</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={`text-xl font-bold font-mono ${summary.openingBalance > 0 ? 'text-amber-600 dark:text-amber-500' : 'text-green-600 dark:text-green-500'}`} data-testid="text-opening-balance">
              {formatCurrency(summary.openingBalance)}
            </div>
            <p className="text-xs text-muted-foreground">Outstanding before period</p>
          </CardContent>
        </Card>

        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-primary">Payments Received</CardTitle>
            <CreditCard className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold font-mono text-green-600 dark:text-green-500" data-testid="text-period-payments">
              {formatCurrency(summary.paymentsInPeriod)}
            </div>
            <p className="text-xs text-muted-foreground">During selected period</p>
          </CardContent>
        </Card>

        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-primary">Closing Balance</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={`text-xl font-bold font-mono ${summary.closingBalance > 0 ? 'text-amber-600 dark:text-amber-500' : 'text-green-600 dark:text-green-500'}`} data-testid="text-closing-balance">
              {formatCurrency(summary.closingBalance)}
            </div>
            <p className="text-xs text-muted-foreground">Outstanding after period</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-primary">
              Total Sales
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold font-mono text-primary" data-testid="text-total-sales">
              {formatCurrency(summary.totalSales)}
            </div>
            <p className="text-xs text-muted-foreground">{summary.invoiceCount} sales</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Product Sales
            </CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold font-mono" data-testid="text-product-sales">
              {formatCurrency(summary.totalSubtotal)}
            </div>
            <p className="text-xs text-muted-foreground">Without Hamali</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Hamali Charges
            </CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold font-mono" data-testid="text-hamali-total">
              {formatCurrency(summary.totalHamali)}
            </div>
            <p className="text-xs text-muted-foreground">{summary.invoicesWithHamali} sales with Hamali</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Weight
            </CardTitle>
            <Scale className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold font-mono" data-testid="text-total-weight">
              {formatWeight(summary.totalWeight)}
            </div>
            <p className="text-xs text-muted-foreground">Sold</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg per Sale
            </CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold font-mono" data-testid="text-avg-sale">
              {formatCurrency(summary.invoiceCount > 0 ? summary.totalSales / summary.invoiceCount : 0)}
            </div>
            <p className="text-xs text-muted-foreground">Per transaction</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Paid
            </CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold font-mono text-green-600 dark:text-green-500" data-testid="text-total-paid">
              {formatCurrency(summary.totalPaid)}
            </div>
            <p className="text-xs text-muted-foreground">Received from customers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Remaining
            </CardTitle>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-xl font-bold font-mono ${summary.totalRemaining > 0 ? 'text-amber-600 dark:text-amber-500' : 'text-green-600 dark:text-green-500'}`} data-testid="text-total-remaining">
              {formatCurrency(summary.totalRemaining)}
            </div>
            <p className="text-xs text-muted-foreground">Outstanding balance</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="sales" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sales" data-testid="tab-sales">
            <FileText className="h-4 w-4 mr-1" />
            Sales Details
          </TabsTrigger>
          <TabsTrigger value="daily" data-testid="tab-daily">
            <Calendar className="h-4 w-4 mr-1" />
            Daily Summary
          </TabsTrigger>
          <TabsTrigger value="charts" data-testid="tab-charts">
            <BarChart3 className="h-4 w-4 mr-1" />
            Charts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-4">
          <FilterSection />
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Sales List ({reportItems.length} items)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {reportItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ShoppingBag className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No sales found for this period</p>
                  <p className="text-sm">Create sales from the Sell tab</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">S.No</TableHead>
                        <TableHead>Invoice</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Vehicle</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Weight</TableHead>
                        <TableHead className="text-right">Bags</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-center">Type</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                        <TableHead className="text-right">Hamali</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportItems.map((item) => (
                        <TableRow key={`${item.id}-${item.no}`} data-testid={`row-item-${item.id}`}>
                          <TableCell className="font-mono text-sm">{item.no}</TableCell>
                          <TableCell className="font-mono text-sm">{item.invoiceNumber}</TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{item.date}</TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{item.vehicle}</TableCell>
                          <TableCell className="text-sm">{item.customer}</TableCell>
                          <TableCell className="text-sm">{item.vendor}</TableCell>
                          <TableCell className="text-sm">{item.item}</TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {item.weight.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {item.bags}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {item.price.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-center text-xs">
                            <Badge variant={item.type === "CASH" ? "outline" : "secondary"} className="text-xs">
                              {item.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatCurrency(item.subtotal)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {item.hamali > 0 ? formatCurrency(item.hamali) : "-"}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            {formatCurrency(item.total)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell colSpan={7}>TOTAL</TableCell>
                        <TableCell className="text-right font-mono">
                          {reportSummary.totalWeight.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {reportSummary.totalBags}
                        </TableCell>
                        <TableCell colSpan={2}></TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(reportSummary.totalSubtotal)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(reportSummary.totalHamali)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-primary">
                          {formatCurrency(reportSummary.totalSales)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="daily" className="space-y-4">
          <FilterSection />
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Daily Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dailySummary.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No data for this period</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Sales Count</TableHead>
                        <TableHead className="text-right">Total Weight</TableHead>
                        <TableHead className="text-right">Hamali</TableHead>
                        <TableHead className="text-right">Total Sales</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dailySummary.map((day) => (
                        <TableRow key={day.date} data-testid={`row-daily-${day.date}`}>
                          <TableCell className="font-medium">
                            {new Date(day.date).toLocaleDateString("en-IN", {
                              weekday: "short",
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline">{day.invoiceCount}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {day.totalWeight.toFixed(2)} KG
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatCurrency(day.hamaliTotal)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            {formatCurrency(day.sales)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell>TOTAL</TableCell>
                        <TableCell className="text-right">
                          {dailySummary.reduce((sum, d) => sum + d.invoiceCount, 0)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {dailySummary.reduce((sum, d) => sum + d.totalWeight, 0).toFixed(2)} KG
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(dailySummary.reduce((sum, d) => sum + d.hamaliTotal, 0))}
                        </TableCell>
                        <TableCell className="text-right font-mono text-primary">
                          {formatCurrency(dailySummary.reduce((sum, d) => sum + d.sales, 0))}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="charts" className="space-y-4">
          <FilterSection />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Sales Trend</CardTitle>
              </CardHeader>
              <CardContent>
                {chartData.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    No data to display
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={chartData}>
                      <XAxis dataKey="date" fontSize={11} />
                      <YAxis fontSize={11} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar dataKey="sales" fill={CHART_COLORS[0]} name="Sales" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="hamali" fill={CHART_COLORS[1]} name="Hamali" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Sales Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                {salesBreakdownData.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    No data to display
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={salesBreakdownData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {salesBreakdownData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
