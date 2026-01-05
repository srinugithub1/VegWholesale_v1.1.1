import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { VendorPayment, CustomerPayment, Vendor, Customer } from "@shared/schema";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useMemo } from "react";
import { format, subDays, isSameDay } from "date-fns";
import { IndianRupee, TrendingUp, TrendingDown, Wallet } from "lucide-react";

export function PaymentDashboard() {
    const { data: vendorPayments } = useQuery<VendorPayment[]>({
        queryKey: ["/api/vendor-payments"],
    });

    const { data: customerPayments } = useQuery<CustomerPayment[]>({
        queryKey: ["/api/customer-payments"],
    });

    const { data: vendorBalances } = useQuery<(Vendor & { balance: number })[]>({
        queryKey: ["/api/reports/vendor-balances"],
    });

    const { data: customerBalances } = useQuery<(Customer & { balance: number })[]>({
        queryKey: ["/api/reports/customer-balances"],
    });

    // Calculate Totals
    const totalVendorOutstanding = vendorBalances?.reduce((acc, v) => acc + (v.balance || 0), 0) || 0;
    const totalCustomerReceivable = customerBalances?.reduce((acc, c) => acc + (c.balance || 0), 0) || 0;
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

    // Pie Chart Data: Top 5 Receivables
    const receivableData = useMemo(() => {
        if (!customerBalances) return [];
        return customerBalances
            .filter(c => c.balance > 0)
            .sort((a, b) => b.balance - a.balance)
            .slice(0, 5)
            .map(c => ({
                name: c.name,
                value: c.balance,
            }));
    }, [customerBalances]);

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
                        <CardTitle className="text-sm font-medium">Customer Receivable</CardTitle>
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
                        <CardTitle className="text-sm font-medium">Net Position</CardTitle>
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
                                <Tooltip
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
                                    outerRadius={100}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {receivableData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value: number) => value.toLocaleString("en-IN", { style: "currency", currency: "INR" })} />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
