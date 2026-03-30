import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { VendorPayment, CustomerPayment, Vendor, Customer } from "@shared/schema";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useState, useMemo } from "react";
import { format, subDays, isSameDay, addDays, differenceInDays, startOfDay } from "date-fns";
import { IndianRupee, TrendingUp, TrendingDown, Wallet, Info, Calendar as CalendarIcon, ChevronRight } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PaymentDashboardProps {
    shop: 42 | 50 | 'all';
    vendorPayments: VendorPayment[];
    customerPayments: CustomerPayment[];
    purchases: any[]; // Using any to avoid strict type import issues if Purchase type is complex just for totalAmount
    invoices: any[];  // Using any mostly for grandTotal
    customers: Customer[];
}

export function PaymentDashboard({
    shop,
    vendorPayments,
    customerPayments,
    purchases = [],
    invoices = [],
    customers = []
}: PaymentDashboardProps) {
    const [fromDate, setFromDate] = useState<Date | undefined>(new Date());
    const [toDate, setToDate] = useState<Date | undefined>(new Date());

    // Calculate Totals Dynamic by Shop
    const totalPurchases = purchases.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
    const totalVendorPaid = vendorPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

    // Vendor Outstanding = Total Purchases - Total Paid
    // Note: detailed logic might include opening balances, but for shop view, this is transaction-based.
    const totalVendorOutstanding = totalPurchases - totalVendorPaid; // Can be negative if overpaid or opening balance missing

    const totalSales = invoices.reduce((sum, i) => sum + (Number(i.grandTotal) || 0), 0);
    const totalCustomerReceived = customerPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

    // Customer Receivable = Total Sales - Total Received
    const totalCustomerReceivable = totalSales - totalCustomerReceived;

    const netPosition = totalCustomerReceivable - totalVendorOutstanding;

    // Chart Data: Selected Period (Max 31 days)
    const chartData = useMemo(() => {
        const data: any[] = [];
        if (!fromDate || !toDate) return data;

        const start = startOfDay(fromDate);
        const end = startOfDay(toDate);
        const daysCount = differenceInDays(end, start) + 1;

        // Limit to 31 days for chart readability
        const effectiveStart = daysCount > 31 ? subDays(end, 30) : start;

        for (let i = 0; i <= Math.min(daysCount - 1, 30); i++) {
            const date = addDays(effectiveStart, i);
            const dateStr = format(date, "yyyy-MM-dd");

            const paymentsPaid = vendorPayments?.filter(p => p.date === dateStr).reduce((acc, p) => acc + p.amount, 0) || 0;
            const paymentsReceived = customerPayments?.filter(p => p.date === dateStr).reduce((acc, p) => acc + p.amount, 0) || 0;

            data.push({
                name: format(date, "dd MMM"),
                paid: paymentsPaid,
                received: paymentsReceived,
            });
        }
        return data;
    }, [vendorPayments, customerPayments, fromDate, toDate]);

    // Pie Chart Data: Top 5 Receivables (Calculated from Invoices - Payments)
    const receivableData = useMemo(() => {
        // Group by Customer
        const customerStats: Record<string, { name: string, balance: number }> = {};

        // Add Debits (Invoices)
        invoices.forEach(inv => {
            if (!customerStats[inv.customerId]) {
                const customer = customers.find(c => c.id === inv.customerId);
                customerStats[inv.customerId] = {
                    name: customer ? customer.name : "Unknown",
                    balance: 0
                };
            }
            let sTotal = Number(inv.grandTotal) || 0;
            customerStats[inv.customerId].balance += sTotal;
        });

        // Subtract Credits (Payments)
        customerPayments.forEach(pay => {
            if (!customerStats[pay.customerId]) {
                const customer = customers.find(c => c.id === pay.customerId);
                customerStats[pay.customerId] = {
                    name: customer ? customer.name : "Unknown",
                    balance: 0
                };
            }
            customerStats[pay.customerId].balance -= (pay.amount || 0);
        });

        // Convert to array and filter out specialized accounts
        return Object.entries(customerStats)
            .map(([id, stat]) => ({ name: stat.name, value: stat.balance }))
            .filter(c => {
                const nameLower = c.name.toLowerCase();
                return c.value > 0 &&
                    nameLower !== "cash account" &&
                    nameLower !== "cash sale account";
            })
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);
    }, [invoices, customerPayments, customers]);

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Filter Section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-muted/30 p-4 rounded-lg border border-border/50">
                <div className="space-y-1">
                    <h3 className="text-sm font-medium flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4 text-primary" />
                        Dashboard Filter
                    </h3>
                    <p className="text-xs text-muted-foreground">Select date range to filter metrics and charts</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 bg-background p-1 rounded-md border shadow-sm">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={cn(
                                        "h-8 justify-start text-left font-normal px-2",
                                        !fromDate && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-3 w-3" />
                                    {fromDate ? format(fromDate, "dd MMM yyyy") : <span>From Date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <CalendarComponent
                                    mode="single"
                                    selected={fromDate}
                                    onSelect={setFromDate}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>

                        <ChevronRight className="h-3 w-3 text-muted-foreground" />

                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={cn(
                                        "h-8 justify-start text-left font-normal px-2",
                                        !toDate && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-3 w-3" />
                                    {toDate ? format(toDate, "dd MMM yyyy") : <span>To Date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <CalendarComponent
                                    mode="single"
                                    selected={toDate}
                                    onSelect={setToDate}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="flex gap-1">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-[10px] px-2"
                            onClick={() => {
                                setFromDate(new Date());
                                setToDate(new Date());
                            }}
                        >
                            Today
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-[10px] px-2"
                            onClick={() => {
                                setFromDate(subDays(new Date(), 7));
                                setToDate(new Date());
                            }}
                        >
                            Last 7 Days
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-[10px] px-2"
                            onClick={() => {
                                setFromDate(subDays(new Date(), 30));
                                setToDate(new Date());
                            }}
                        >
                            Last 30 Days
                        </Button>
                    </div>
                </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <div className="flex items-center gap-2">
                            <CardTitle className="text-sm font-medium">Amount Owed to Vendors</CardTitle>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger>
                                        <Info className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-[300px]">
                                        <p>Total amount you currently owe to all your suppliers combined.</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                        <TrendingDown className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">
                            {totalVendorOutstanding.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                        </div>
                        <p className="text-xs text-muted-foreground">Pending payments to vendors</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <div className="flex items-center gap-2">
                            <CardTitle className="text-sm font-medium">Total Pending from Customers</CardTitle>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger>
                                        <Info className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-[300px]">
                                        <div className="space-y-2">
                                            <p>Total unpaid credit that all customers currently owe you combined.</p>
                                            <p className="text-xs italic text-muted-foreground">(Total All-Time Sales - Total All-Time Payments)</p>
                                        </div>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                        <TrendingUp className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {totalCustomerReceivable.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                        </div>
                        <p className="text-xs text-muted-foreground">Owed to your shop</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <div className="flex items-center gap-2">
                            <CardTitle className="text-sm font-medium">Net Balance</CardTitle>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger>
                                        <Info className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Your Net Position: (Customer Balance - Vendor Outstanding)</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${netPosition >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {netPosition.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                        </div>
                        <p className="text-xs text-muted-foreground">Receivable - Outstanding</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Card className="bg-green-50/50 border-green-100">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <div className="flex items-center gap-2">
                            <CardTitle className="text-sm font-medium text-green-800">Payments Collected in Period</CardTitle>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger>
                                        <Info className="h-4 w-4 text-green-700 hover:text-green-900 transition-colors cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-[300px]">
                                        <div className="space-y-2">
                                            <p>Total sum of all customer payments received between the selected dates.</p>
                                        </div>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                        <Wallet className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-700">
                            {customerPayments
                                .filter(p => {
                                    const start = fromDate ? format(fromDate, "yyyy-MM-dd") : "";
                                    const end = toDate ? format(toDate, "yyyy-MM-dd") : "";
                                    const name = customers.find(c => c.id === p.customerId)?.name.toLowerCase() || "";
                                    const inRange = (!start || p.date >= start) && (!end || p.date <= end);
                                    return inRange && name !== "cash account" && name !== "cash sale account";
                                })
                                .reduce((sum, p) => sum + p.amount, 0)
                                .toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                        </div>
                        <p className="text-xs text-green-600/80">Sum of customer receipts in selected period</p>
                    </CardContent>
                </Card>
                <Card className="bg-red-50/50 border-red-100">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-red-800">Paid in Period</CardTitle>
                        <Wallet className="h-4 w-4 text-red-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-700">
                            {vendorPayments
                                .filter(p => {
                                    const start = fromDate ? format(fromDate, "yyyy-MM-dd") : "";
                                    const end = toDate ? format(toDate, "yyyy-MM-dd") : "";
                                    return (!start || p.date >= start) && (!end || p.date <= end);
                                })
                                .reduce((sum, p) => sum + p.amount, 0)
                                .toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                        </div>
                        <p className="text-xs text-red-600/80">Total paid to vendors in selected period</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle>Cash Flow</CardTitle>
                        <CardDescription>
                            Payments Made vs Received ({fromDate && toDate ? `${format(fromDate, "dd MMM")} - ${format(toDate, "dd MMM")}` : 'Selected Period'})
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" fontSize={12} />
                                <YAxis fontSize={12} />
                                <RechartsTooltip
                                    formatter={(value: number) => value.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                                />
                                <Legend />
                                <Bar dataKey="received" name="Received" fill="#22c55e" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="paid" name="Paid" fill="#ef4444" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle>Top Receivables</CardTitle>
                        <CardDescription>Highest outstanding customer balances</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={receivableData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {receivableData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip formatter={(value: number) => value.toLocaleString("en-IN", { style: "currency", currency: "INR" })} />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div >
    );
}
