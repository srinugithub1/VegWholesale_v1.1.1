import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { VendorPayment, CustomerPayment, Vendor, Customer } from "@shared/schema";
import { format, isWithinInterval, parseISO } from "date-fns";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Download, Filter } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";

const ITEMS_PER_PAGE = 10;

type ReportType = "all" | "vendor" | "customer";

interface PaymentReportsProps {
    vendorPayments?: VendorPayment[];
    customerPayments?: CustomerPayment[];
    vendors?: Vendor[];
    customers?: Customer[];
    shop?: number | "all";
    users?: any[];
}

export function PaymentReports({
    vendorPayments = [],
    customerPayments = [],
    vendors = [],
    customers = [],
    shop = 'all',
    users = []
}: PaymentReportsProps) {
    const [dateFrom, setDateFrom] = useState(format(new Date(), "yyyy-MM-01")); // Default to start of current month
    const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
    const [reportType, setReportType] = useState<ReportType>("all");
    const [selectedEntityId, setSelectedEntityId] = useState<string>("all");
    const [showCashSalesOnly, setShowCashSalesOnly] = useState(false);
    const [paymentFilters, setPaymentFilters] = useState<string[]>(['all']);
    const [currentPage, setCurrentPage] = useState(1);




    const { data: vendorBalances } = useQuery<(Vendor & { balance: number })[]>({
        queryKey: ["/api/reports/vendor-balances"],
    });

    const { data: customerBalances } = useQuery<(Customer & { balance: number })[]>({
        queryKey: ["/api/reports/customer-balances"],
    });

    const getVendorName = (id: string) => vendors?.find(v => v.id === id)?.name || "Unknown";
    const getCustomerName = (id: string) => customers?.find(c => c.id === id)?.name || "Unknown";

    const filteredData = useMemo(() => {
        let data: any[] = [];
        if (!vendorPayments || !customerPayments) return [];

        const from = new Date(dateFrom);
        const to = new Date(dateTo);
        // Adjust 'to' date to end of day for inclusive comparison if needed, or just string compare
        // Using string comparison since schema is yyyy-mm-dd string

        if (reportType === "all" || reportType === "vendor") {
            const vPayments = vendorPayments.map(p => ({
                ...p,
                type: "Vendor Payment",
                partyName: getVendorName(p.vendorId),
                flow: "Out",
                partyId: p.vendorId
            }));
            data = [...data, ...vPayments];
        }

        if (reportType === "all" || reportType === "customer") {
            const cPayments = customerPayments.map(p => ({
                ...p,
                type: "Customer Receipt",
                partyName: getCustomerName(p.customerId),
                flow: "In",
                partyId: p.customerId
            }));
            data = [...data, ...cPayments];
        }

        // Filter by date
        data = data.filter(item => {
            return item.date >= dateFrom && item.date <= dateTo;
        });

        // Filter by Entity
        if (selectedEntityId !== "all") {
            data = data.filter(item => item.partyId === selectedEntityId);
        }

        // Cash Sale Account Filter
        if (showCashSalesOnly) {
            // Show ONLY Cash Sale Account records
            data = data.filter(item => {
                const nameLower = item.partyName.toLowerCase();
                return nameLower.includes("cash sale account") || nameLower === "cash account";
            });
        } else {
            // Default: Show EVERYTHING, but if the user wants to see ONLY regular customers, 
            // they would select them individually. 
            // The previous logic was hiding Cash Account entirely by default, which confused the user.
            // We keep it visible unless showCashSalesOnly is used to ISOLATE it.
        }

        // Payment Method Filter
        if (paymentFilters.length > 0 && !paymentFilters.includes('all')) {
            data = data.filter(item => {
                const method = (item.paymentMethod || '').toLowerCase();
                const partyLower = item.partyName.toLowerCase();
                const isCashAccount = partyLower === "cash account" || partyLower === "cash sale account";

                if (paymentFilters.includes('direct') && isCashAccount) return true;
                if (paymentFilters.includes('cash') && method === 'cash' && !isCashAccount) return true;
                if (paymentFilters.includes('upi') && method === 'upi') return true;
                if (paymentFilters.includes('bank') && (method === 'bank' || method === 'bank transfer')) return true;
                if (paymentFilters.includes('cheque') && method === 'cheque') return true;
                return false;
            });
        }

        return data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [vendorPayments, customerPayments, vendors, customers, dateFrom, dateTo, reportType, selectedEntityId, showCashSalesOnly, paymentFilters]);

    // Pagination Logic
    const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredData.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredData, currentPage]);

    // Calculate Total Amount for current filtered list (Not just page)
    const totalFilteredAmount = useMemo(() => {
        return filteredData.reduce((sum, item) => sum + item.amount, 0);
    }, [filteredData]);

    const generatePDF = () => {
        const doc = new jsPDF();

        // Title
        doc.setFontSize(18);
        doc.text("Payment Report", 14, 22);
        doc.setFontSize(11);
        doc.text(`Date Range: ${dateFrom} to ${dateTo}`, 14, 30);

        // Summary Section
        const totalIn = filteredData.filter(d => d.flow === "In").reduce((sum, d) => sum + d.amount, 0);
        const totalOut = filteredData.filter(d => d.flow === "Out").reduce((sum, d) => sum + d.amount, 0);

        doc.text(`Total Received: ${totalIn.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}`, 14, 40);
        doc.text(`Total Paid: ${totalOut.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}`, 100, 40);

        // Current Balances Summary (if filtered by entity)
        let yPos = 50;
        if (selectedEntityId !== "all") {
            if (reportType === "vendor") {
                const vendor = vendorBalances?.find(v => v.id === selectedEntityId);
                if (vendor) {
                    doc.text(`Current Outstanding Balance: ${vendor.balance.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}`, 14, yPos);
                    yPos += 10;
                }
            } else if (reportType === "customer") {
                const customer = customerBalances?.find(c => c.id === selectedEntityId);
                if (customer) {
                    doc.text(`Current Receivable Balance: ${customer.balance.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}`, 14, yPos);
                    yPos += 10;
                }
            }
        }

        // Table
        autoTable(doc, {
            startY: yPos,
            head: [['Date', 'Type', 'Party', 'Method', 'Notes', 'Amount']],
            body: filteredData.map(row => [
                row.date,
                row.type,
                row.partyName,
                row.paymentMethod,
                row.notes || "-",
                row.amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })
            ]),
            theme: 'grid',
            styles: { fontSize: 9 },
            headStyles: { fillColor: [22, 163, 74] } // Green header
        });

        doc.save(`payment-report-${dateFrom}-to-${dateTo}.pdf`);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Filter className="h-5 w-5" />
                        Report Filters
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <Label>From Date</Label>
                            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>To Date</Label>
                            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Type</Label>
                            <Select value={reportType} onValueChange={(val: ReportType) => {
                                setReportType(val);
                                setSelectedEntityId("all");
                            }}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Payments</SelectItem>
                                    <SelectItem value="vendor">Vendor Payments</SelectItem>
                                    <SelectItem value="customer">Customer Receipts</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {reportType !== 'all' && (
                            <div className="space-y-2">
                                <Label>Select {reportType === 'vendor' ? 'Vendor' : 'Customer'}</Label>
                                <Select value={selectedEntityId} onValueChange={setSelectedEntityId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="All" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All</SelectItem>
                                        {reportType === 'vendor' && vendors?.map(v => (
                                            <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                                        ))}
                                        {reportType === 'customer' && customers?.filter(c => c.name.toLowerCase() !== "cash account" && c.name.toLowerCase() !== "cash sale account").map(c => (
                                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        <div className="flex flex-col gap-2">
                            <Label>Payment Type</Label>
                            <div className="flex flex-wrap gap-4 items-center border p-2 rounded-md bg-muted/30">
                                <Label className="text-xs font-bold mr-2">Payment Type:</Label>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="pay-all"
                                        checked={paymentFilters.length === 0} // 'all' is represented by an empty array
                                        onCheckedChange={(checked) => {
                                            if (checked) setPaymentFilters([]);
                                            else setPaymentFilters(['cash', 'upi', 'bank', 'cheque']); // If 'all' is unchecked, select all specific types
                                            setCurrentPage(1);
                                        }}
                                    />
                                    <Label htmlFor="pay-all" className="text-xs">All</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="pay-cash"
                                        checked={paymentFilters.includes('cash')}
                                        onCheckedChange={(checked) => {
                                            if (checked) setPaymentFilters(prev => [...prev.filter(p => p !== 'all'), 'cash']);
                                            else setPaymentFilters(prev => prev.filter(f => f !== 'cash'));
                                            setCurrentPage(1);
                                        }}
                                    />
                                    <Label htmlFor="pay-cash" className="text-xs">Cash</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="pay-direct"
                                        checked={paymentFilters.includes('direct')}
                                        onCheckedChange={(checked) => {
                                            if (checked) setPaymentFilters(prev => [...prev.filter(p => p !== 'all'), 'direct']);
                                            else setPaymentFilters(prev => prev.filter(f => f !== 'direct'));
                                            setCurrentPage(1);
                                        }}
                                    />
                                    <Label htmlFor="pay-direct" className="text-xs">Direct Customer</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="pay-upi"
                                        checked={paymentFilters.includes('upi')}
                                        onCheckedChange={(checked) => {
                                            if (checked) setPaymentFilters(prev => [...prev.filter(p => p !== 'all'), 'upi']);
                                            else setPaymentFilters(prev => prev.filter(f => f !== 'upi'));
                                            setCurrentPage(1);
                                        }}
                                    />
                                    <Label htmlFor="pay-upi" className="text-xs">UPI</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="pay-bank"
                                        checked={paymentFilters.includes('bank')}
                                        onCheckedChange={(checked) => {
                                            if (checked) setPaymentFilters(prev => [...prev, 'bank']);
                                            else setPaymentFilters(prev => prev.filter(f => f !== 'bank'));
                                            setCurrentPage(1);
                                        }}
                                    />
                                    <Label htmlFor="pay-bank" className="text-xs">Bank</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="pay-cheque"
                                        checked={paymentFilters.includes('cheque')}
                                        onCheckedChange={(checked) => {
                                            if (checked) setPaymentFilters(prev => [...prev, 'cheque']);
                                            else setPaymentFilters(prev => prev.filter(f => f !== 'cheque'));
                                            setCurrentPage(1);
                                        }}
                                    />
                                    <Label htmlFor="pay-cheque" className="text-xs">Cheque</Label>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col justify-end space-y-2">
                            <div className="flex items-center space-x-2 pb-2">
                                <Checkbox
                                    id="cash-sales"
                                    checked={showCashSalesOnly}
                                    onCheckedChange={(checked) => {
                                        setShowCashSalesOnly(checked as boolean);
                                        setCurrentPage(1); // Reset page on filter change
                                    }}
                                />
                                <Label htmlFor="cash-sales">Cash Sale Account</Label>
                            </div>
                        </div>
                        <div className="flex items-end">
                            <Button onClick={generatePDF} className="w-full gap-2">
                                <Download className="h-4 w-4" />
                                Download PDF Report
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="pt-6">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Party</TableHead>
                                <TableHead>Method</TableHead>
                                <TableHead>Notes</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        No records found for selected criteria
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedData.map((row, i) => (
                                    <TableRow key={i}>
                                        <TableCell>{row.date}</TableCell>
                                        <TableCell>
                                            <span className={`px-2 py-1 rounded-full text-xs ${row.flow === 'In' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {row.type}
                                            </span>
                                        </TableCell>
                                        <TableCell className="font-medium">{row.partyName}</TableCell>
                                        <TableCell className="capitalize">
                                            {(row.partyName.toLowerCase() === "cash account" || row.partyName.toLowerCase() === "cash sale account")
                                                ? "Direct Customer"
                                                : row.paymentMethod}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">{row.notes || "-"}</TableCell>
                                        <TableCell className="text-right font-mono font-bold">
                                            {row.amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                            {filteredData.length > 0 && (
                                <TableRow className="bg-muted/50 font-bold border-t-2">
                                    <TableCell colSpan={5} className="text-right">Total Amount:</TableCell>
                                    <TableCell className="text-right font-mono text-base">
                                        {totalFilteredAmount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {totalPages > 1 && (
                <div className="flex justify-center">
                    <Pagination>
                        <PaginationContent>
                            <PaginationItem>
                                <PaginationPrevious
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                                />
                            </PaginationItem>

                            <PaginationItem>
                                <span className="px-4 text-sm font-medium">
                                    Page {currentPage} of {totalPages}
                                </span>
                            </PaginationItem>

                            <PaginationItem>
                                <PaginationNext
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                                />
                            </PaginationItem>
                        </PaginationContent>
                    </Pagination>
                </div>
            )}
        </div>
    );
}
