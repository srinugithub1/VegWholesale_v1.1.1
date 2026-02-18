import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { VendorPayment, CustomerPayment, Vendor, Customer } from "@shared/schema";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useMemo } from "react";
import { format, subDays, isSameDay } from "date-fns";
import { IndianRupee, TrendingUp, TrendingDown, Wallet, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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

    // Calculate Totals Dynamic by Shop
    const totalPurchases = purchases.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
    const totalVendorPaid = vendorPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

    // Vendor Outstanding = Total Purchases - Total Paid
    // Note: detailed logic might include opening balances, but for shop view, this is transaction-based.
    const totalVendorOutstanding = totalPurchases - totalVendorPaid; // Can be negative if overpaid or opening balance missing

    const totalSales = invoices.reduce((sum, i) => sum + (i.grandTotal || 0), 0);
    const totalCustomerReceived = customerPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

    // Customer Receivable = Total Sales - Total Received
    const totalCustomerReceivable = totalSales - totalCustomerReceived;

    const netPosition = totalCustomerReceivable - totalVendorOutstanding;

    // Chart Data: Last 7 Days
    const chartData = useMemo(() => {
        const data = [];
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
            const date = subDays(today, i);
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
    }, [vendorPayments, customerPayments]);

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
            customerStats[inv.customerId].balance += (inv.grandTotal || 0);
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

        // Convert to array
        return Object.entries(customerStats)
            .map(([id, stat]) => ({ name: stat.name, value: stat.balance }))
            .filter(c => c.value > 0)
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);
    }, [invoices, customerPayments, customers]);

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Vendor Outstanding</CardTitle>
                        <TrendingDown className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">
                            {totalVendorOutstanding.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                        </div>
                        <p className="text-xs text-muted-foreground">Total amount to pay vendors</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <div className="flex items-center gap-2">
                            <CardTitle className="text-sm font-medium">Total Customer Balance</CardTitle>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger>
                                        <Info className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Total amount customers currently owe (Sales - Received)</p>
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
                        <p className="text-xs text-muted-foreground">Total amount to receive</p>
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
                        <CardTitle className="text-sm font-medium text-green-800">Collected Today</CardTitle>
                        <Wallet className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-700">
                            {customerPayments
                                .filter(p => p.date === format(new Date(), "yyyy-MM-dd"))
                                .reduce((sum, p) => sum + p.amount, 0)
                                .toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                        </div>
                        <p className="text-xs text-green-600/80">Total received from customers today</p>
                    </CardContent>
                </Card>
                <Card className="bg-red-50/50 border-red-100">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-red-800">Paid Today</CardTitle>
                        <Wallet className="h-4 w-4 text-red-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-700">
                            {vendorPayments
                                .filter(p => p.date === format(new Date(), "yyyy-MM-dd"))
                                .reduce((sum, p) => sum + p.amount, 0)
                                .toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                        </div>
                        <p className="text-xs text-red-600/80">Total paid to vendors today</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle>Cash Flow (Last 7 Days)</CardTitle>
                        <CardDescription>Payments Made vs Received</CardDescription>
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
