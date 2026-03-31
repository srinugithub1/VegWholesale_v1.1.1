import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useShop } from "@/hooks/use-shop";
import { format, startOfDay, endOfDay } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Search, FileText, X, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Invoice, CustomerPayment, Customer } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function CompletedPayments() {
  const { shop } = useShop();

  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState<Date | undefined>();
  const [toDate, setToDate] = useState<Date | undefined>();
  
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: customers = [], isLoading: customersLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const { data: customerPayments = [], isLoading: paymentsLoading } = useQuery<CustomerPayment[]>({
    queryKey: ["/api/customer-payments"],
  });

  const isLoading = customersLoading || invoicesLoading || paymentsLoading;

  // Compute Outstanding Balances and filter for matching customers
  const completedCustomers = useMemo(() => {
    if (isLoading) return [];

    // Filter by Shop logic (Optional, since payments technically span cross-shop sometimes
    // but we can apply standard shop filter logic if invoices exist)
    const activeInvoices = shop === 'all' 
        ? invoices 
        : invoices; // Since balance is total debt, we usually compute globally.

    // 1. Calculate balance map globally
    const balanceMap: Record<string, number> = {};
    customers.forEach(c => balanceMap[c.id] = 0);

    // Sum Invoices
    activeInvoices.forEach(inv => {
      if (inv.customerId && balanceMap[inv.customerId] !== undefined) {
          let total = Number(inv.grandTotal) || 0;
          balanceMap[inv.customerId] += total;
      }
    });

    // Subtract Payments
    customerPayments.forEach(pay => {
      if (pay.customerId && balanceMap[pay.customerId] !== undefined) {
          balanceMap[pay.customerId] -= (Number(pay.amount) || 0);
      }
    });

    // 2. Filter for Completed Customers (balance <= 0)
    let filtered = customers.filter(c => {
       const balance = balanceMap[c.id] || 0;
       return balance <= 0.01; // Allow microscopic float inaccuracies
    });

    // 3. Apply Search Filter
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(c => (c.name || "").toLowerCase().includes(q));
    }

    return filtered.map(c => ({
        ...c,
        calculatedBalance: balanceMap[c.id] || 0
    }));

  }, [customers, invoices, customerPayments, shop, searchQuery, isLoading]);

  // Handle Pagination
  const totalPages = Math.max(1, Math.ceil(completedCustomers.length / itemsPerPage));
  const paginatedCustomers = useMemo(() => {
    const startIndex = (page - 1) * itemsPerPage;
    return completedCustomers.slice(startIndex, startIndex + itemsPerPage);
  }, [completedCustomers, page, itemsPerPage]);

  const handleViewTransactions = (customer: Customer) => {
      setSelectedCustomer(customer);
      setIsModalOpen(true);
  };

  const generateStatementPDF = (customer: Customer) => {
    const custInvoices = invoices.filter(i => i.customerId === customer.id);
    const custPayments = customerPayments.filter(p => p.customerId === customer.id);

    let openingBalance = 0;
    const transactions: any[] = [];

    const startStr = fromDate ? format(startOfDay(fromDate), 'yyyy-MM-dd') : null;
    const endStr = toDate ? format(endOfDay(toDate), 'yyyy-MM-dd') : null;

    custInvoices.forEach(inv => {
      const invTotal = Number(inv.grandTotal) || 0;
      if (startStr && inv.date < startStr) {
        openingBalance += invTotal;
      } else if (!endStr || inv.date <= endStr) {
        transactions.push({
          date: inv.date,
          type: inv.invoiceNumber?.startsWith('OB-') ? 'Opening Balance Upload' : 'Invoice',
          ref: inv.invoiceNumber || 'N/A',
          debit: invTotal,
          credit: 0,
          rawDate: new Date(inv.date).getTime()
        });
      }
    });

    custPayments.forEach(pay => {
      const payTotal = Number(pay.amount) || 0;
      if (startStr && pay.date < startStr) {
        openingBalance -= payTotal;
      } else if (!endStr || pay.date <= endStr) {
        transactions.push({
          date: pay.date,
          type: 'Payment',
          ref: pay.paymentMethod || 'Cash',
          debit: 0,
          credit: payTotal,
          rawDate: new Date(pay.date).getTime()
        });
      }
    });

    transactions.sort((a, b) => a.rawDate - b.rawDate);

    let currentBalance = openingBalance;
    const tableBody = transactions.map(t => {
      currentBalance = currentBalance + t.debit - t.credit;
      return [
        t.date,
        t.type,
        t.ref,
        t.debit > 0 ? `Rs. ${t.debit.toFixed(2)}` : '-',
        t.credit > 0 ? `Rs. ${t.credit.toFixed(2)}` : '-',
        `Rs. ${currentBalance.toFixed(2)}`
      ];
    });

    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.text("Customer Account Statement", 105, 15, { align: "center" });
    
    doc.setFontSize(10);
    doc.text(`Customer Name: ${customer.name}`, 14, 25);
    doc.text(`Phone: ${customer.phone || 'N/A'}`, 14, 30);
    
    const dateRangeStr = (fromDate && toDate) 
        ? `${format(fromDate, 'dd-MM-yyyy')} to ${format(toDate, 'dd-MM-yyyy')}`
        : 'All Time';
    doc.text(`Statement Period: ${dateRangeStr}`, 140, 25);
    doc.text(`Generated On: ${format(new Date(), 'dd-MM-yyyy hh:mm a')}`, 140, 30);
    
    // Summary
    doc.text(`Opening Balance: Rs. ${openingBalance.toFixed(2)}`, 14, 40);
    doc.text(`Closing Balance: Rs. ${currentBalance.toFixed(2)}`, 140, 40);

    // Table
    autoTable(doc, {
      startY: 45,
      head: [['Date', 'Type', 'Reference', 'Charged (+)', 'Paid (-)', 'Balance']],
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      styles: { fontSize: 8 },
    });

    doc.save(`Statement_${customer.name.replace(/[^a-z0-9]/gi, '_')}.pdf`);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Completed Payments</h1>
          <p className="text-muted-foreground text-sm">Customers who have fully cleared their outstanding credit.</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-muted/30 border-primary/20">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-end">
          <div className="space-y-2 flex-1">
            <label className="text-sm font-medium">Customer Search</label>
            <div className="relative border shadow-sm rounded-md bg-background">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                value={searchQuery}
                onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                }}
                className="pl-9 bg-transparent border-0 focus-visible:ring-0 shadow-none"
                placeholder="Search by name..."
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">From Date</label>
            <Input
              type="date"
              value={fromDate ? format(fromDate, 'yyyy-MM-dd') : ''}
              onChange={(e) => setFromDate(e.target.value ? new Date(e.target.value) : undefined)}
              className="w-full sm:w-[150px]"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">To Date</label>
            <Input
              type="date"
              value={toDate ? format(toDate, 'yyyy-MM-dd') : ''}
              onChange={(e) => setToDate(e.target.value ? new Date(e.target.value) : undefined)}
              className="w-full sm:w-[150px]"
            />
          </div>
          <Button 
            variant="outline" 
            onClick={() => {
              setSearchQuery("");
              setFromDate(undefined);
              setToDate(undefined);
            }}
          >
            <X className="h-4 w-4 mr-1" /> Clear
          </Button>
        </CardContent>
      </Card>

      {/* Main Table */}
      <Card>
        <CardHeader>
             <CardTitle className="text-lg">Cleared Customer Accounts</CardTitle>
        </CardHeader>
        <CardContent>
            {isLoading ? (
                <div className="text-center py-8">Loading data...</div>
            ) : completedCustomers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground flex items-center justify-center gap-2">
                    <FileText className="h-4 w-4" /> No cleared customers found
                </div>
            ) : (
                <div className="space-y-4">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Customer Name</TableHead>
                                <TableHead>Current Balance</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedCustomers.map((c) => (
                                <TableRow key={c.id}>
                                    <TableCell className="font-medium">{c.name}</TableCell>
                                    <TableCell className="text-green-600 font-mono">₹{c.calculatedBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Button variant="outline" size="sm" onClick={() => handleViewTransactions(c)}>
                                                <Eye className="h-4 w-4 mr-1" /> View
                                            </Button>
                                            <Button variant="default" size="sm" onClick={() => generateStatementPDF(c)}>
                                                <FileText className="h-4 w-4 mr-1" /> Print
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    
                    {/* Pagination */}
                    <div className="flex items-center justify-between border-t border-border/50 pt-4">
                        <p className="text-sm text-muted-foreground">
                        Showing {((page - 1) * itemsPerPage) + 1} to {Math.min(page * itemsPerPage, completedCustomers.length)} of {completedCustomers.length} records
                        </p>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(Math.max(1, page - 1))}
                                disabled={page === 1}
                            >
                                Previous
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(Math.min(totalPages, page + 1))}
                                disabled={page === totalPages}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </CardContent>
      </Card>

      {/* Dynamic Ledger Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
            <DialogHeader>
                <DialogTitle className="text-xl">Transaction Ledger: {selectedCustomer?.name}</DialogTitle>
                <DialogDescription>
                  Chronological history of all invoices and payments.
                </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-1">
                {selectedCustomer && (
                  <LedgerTable 
                    customer={selectedCustomer} 
                    invoices={invoices} 
                    payments={customerPayments} 
                    fromDate={fromDate} 
                    toDate={toDate} 
                  />
                )}
            </div>
            <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t">
               <Button variant="outline" onClick={() => setIsModalOpen(false)}>Close</Button>
               <Button onClick={() => selectedCustomer && generateStatementPDF(selectedCustomer)} className="bg-primary print:hidden">
                 <FileText className="h-4 w-4 mr-2" /> Print PDF
               </Button>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LedgerTable({ customer, invoices, payments, fromDate, toDate }: { customer: Customer, invoices: Invoice[], payments: CustomerPayment[], fromDate?: Date, toDate?: Date }) {
  const ledgerData = useMemo(() => {
    const custInvoices = invoices.filter(i => i.customerId === customer.id);
    const custPayments = payments.filter(p => p.customerId === customer.id);

    let openingBalance = 0;
    const transactions: any[] = [];

    // Filter rules
    const startStr = fromDate ? format(startOfDay(fromDate), 'yyyy-MM-dd') : null;
    const endStr = toDate ? format(endOfDay(toDate), 'yyyy-MM-dd') : null;

    // Process Invoices (Debits)
    custInvoices.forEach(inv => {
      const invTotal = Number(inv.grandTotal) || 0;
      if (startStr && inv.date < startStr) {
        openingBalance += invTotal;
      } else if (!endStr || inv.date <= endStr) {
        transactions.push({
          id: `inv-${inv.id}`,
          date: inv.date,
          type: inv.invoiceNumber?.startsWith('OB-') ? 'Opening Balance Upload' : 'Invoice',
          ref: inv.invoiceNumber || 'N/A',
          debit: invTotal,
          credit: 0,
          rawDate: new Date(inv.date).getTime()
        });
      }
    });

    // Process Payments (Credits)
    custPayments.forEach(pay => {
      const payTotal = Number(pay.amount) || 0;
      if (startStr && pay.date < startStr) {
        openingBalance -= payTotal;
      } else if (!endStr || pay.date <= endStr) {
        transactions.push({
          id: `pay-${pay.id}`,
          date: pay.date,
          type: 'Payment',
          ref: pay.paymentMethod || 'Cash',
          debit: 0,
          credit: payTotal,
          rawDate: new Date(pay.date).getTime()
        });
      }
    });

    // Sort Chronologically
    transactions.sort((a, b) => a.rawDate - b.rawDate);

    // Compute Running Balance
    let currentBalance = openingBalance;
    const computedTxns = transactions.map(t => {
      currentBalance = currentBalance + t.debit - t.credit;
      return { ...t, runningBalance: currentBalance };
    });

    return { openingBalance, transactions: computedTxns, finalBalance: currentBalance };
  }, [customer, invoices, payments, fromDate, toDate]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-muted/50 p-3 rounded-md">
         <span className="font-medium text-sm">Opening Balance (Before Period):</span>
         <span className={`font-mono font-bold ${ledgerData.openingBalance > 0 ? 'text-amber-600' : 'text-green-600'}`}>
            ₹{ledgerData.openingBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
         </span>
      </div>
      
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Ref / Mode</TableHead>
              <TableHead className="text-right">Charged (+)</TableHead>
              <TableHead className="text-right">Paid (-)</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ledgerData.transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No transactions found in this period.
                </TableCell>
              </TableRow>
            ) : (
              ledgerData.transactions.map((t, idx) => (
                <TableRow key={`${t.id}-${idx}`}>
                  <TableCell className="text-xs">{t.date}</TableCell>
                  <TableCell className="text-xs">
                    <span className={t.type === 'Payment' ? 'text-green-600 font-medium' : 'text-amber-600 font-medium'}>
                      {t.type}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">{t.ref}</TableCell>
                  <TableCell className="text-right font-mono text-xs text-amber-600">
                    {t.debit > 0 ? `₹${t.debit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : '-'}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-green-600">
                    {t.credit > 0 ? `₹${t.credit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : '-'}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium text-xs">
                    ₹{t.runningBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-between items-center bg-primary/5 p-3 rounded-md border border-primary/20">
         <span className="font-semibold text-sm">Final Outstanding Balance:</span>
         <span className={`font-mono text-lg font-bold ${ledgerData.finalBalance > 0 ? 'text-amber-600' : 'text-green-600'}`}>
            ₹{ledgerData.finalBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
         </span>
      </div>
    </div>
  );
}
