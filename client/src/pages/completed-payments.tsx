import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useShop } from "@/hooks/use-shop";
import { format, startOfDay, endOfDay, isSameDay } from "date-fns";
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
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CalendarIcon, Search, FileText, X, Eye, CheckCircle, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { type Customer, type CustomerPayment, type Invoice } from "@shared/schema";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { cn } from "@/lib/utils";

function CustomerLedgerContainer({ 
  customer, 
  fromDate, 
  toDate 
}: { 
  customer: Customer, 
  fromDate?: Date, 
  toDate?: Date 
}) {
  const { data: invoicesResp, isLoading: invoicesLoading } = useQuery<{ invoices: Invoice[] }>({
    queryKey: [`/api/customers/${customer.id}/invoices`],
  });

  const { data: payments, isLoading: paymentsLoading } = useQuery<CustomerPayment[]>({
    queryKey: [`/api/customer-payments`, { customerId: customer.id }],
  });

  if (invoicesLoading || paymentsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-3 text-muted-foreground">Loading ledger data...</span>
      </div>
    );
  }

  return (
    <LedgerTable 
      customer={customer} 
      invoices={invoicesResp?.invoices || []} 
      payments={payments || []} 
      fromDate={fromDate} 
      toDate={toDate} 
    />
  );
}

function LedgerTable({ customer, invoices, payments, fromDate, toDate }: { customer: Customer, invoices: Invoice[], payments: CustomerPayment[], fromDate?: Date, toDate?: Date }) {
  const ledgerData = useMemo(() => {
    if (!Array.isArray(invoices) || !Array.isArray(payments)) {
        return { openingBalance: 0, transactions: [], finalBalance: 0 };
    }

    const custInvoices = invoices.filter(i => i.customerId === customer.id);
    const custPayments = payments.filter(p => p.customerId === customer.id);

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

    transactions.sort((a, b) => a.rawDate - b.rawDate);

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

export default function CompletedPayments() {
  const { shop } = useShop();

  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState<Date | undefined>(new Date());
  const [toDate, setToDate] = useState<Date | undefined>(new Date());
  
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: customerBalances = [], isLoading: balancesLoading } = useQuery<(Customer & { balance: number })[]>({
    queryKey: ["/api/reports/customer-balances"],
  });

  const { data: recentPayments = [], isLoading: paymentsLoading } = useQuery<CustomerPayment[]>({
    queryKey: ["/api/customer-payments", { 
      startDate: fromDate ? format(fromDate, 'yyyy-MM-dd') : undefined,
      endDate: toDate ? format(toDate, 'yyyy-MM-dd') : undefined
    }],
    enabled: !!fromDate && !!toDate,
  });

  const isLoading = balancesLoading || paymentsLoading;

  const completedCustomers = useMemo(() => {
    if (isLoading) return [];
    if (!Array.isArray(customerBalances) || !Array.isArray(recentPayments)) return [];

    const paymentCustomerIds = new Set(recentPayments.map(p => p.customerId));

    let filtered = customerBalances.filter(c => {
       const isCleared = (c.balance || 0) <= 0.01;
       const hasRecentPayment = paymentCustomerIds.has(c.id);
       return isCleared && hasRecentPayment;
    });

    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(c => (c.name || "").toLowerCase().includes(q));
    }

    return filtered.map(c => ({
        ...c,
        calculatedBalance: c.balance || 0
    }));

  }, [customerBalances, recentPayments, searchQuery, isLoading]);

  const totalPages = Math.max(1, Math.ceil(completedCustomers.length / itemsPerPage));
  const paginatedCustomers = useMemo(() => {
    const startIndex = (page - 1) * itemsPerPage;
    return completedCustomers.slice(startIndex, startIndex + itemsPerPage);
  }, [completedCustomers, page, itemsPerPage]);

  const handleViewTransactions = (customer: Customer) => {
      setSelectedCustomer(customer);
      setIsModalOpen(true);
  };

  const generateStatementPDF = async (customer: Customer) => {
    try {
      const invoicesResp = await fetch(`/api/customers/${customer.id}/invoices`).then(res => res.json());
      const custInvoices: Invoice[] = invoicesResp.invoices || [];
      const custPayments: CustomerPayment[] = await fetch(`/api/customer-payments?customerId=${customer.id}`).then(res => res.json());

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
            type: inv.invoiceNumber?.startsWith('OB-') ? 'Opening Balance' : 'Invoice',
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
      doc.setFontSize(20);
      doc.text("Customer Statement", 105, 15, { align: 'center' });
      
      doc.setFontSize(12);
      doc.text(`Customer: ${customer.name}`, 14, 25);
      doc.text(`Period: ${fromDate ? format(fromDate, 'dd/MM/yyyy') : 'All'} - ${toDate ? format(toDate, 'dd/MM/yyyy') : 'Today'}`, 14, 32);
      doc.text(`Opening Balance: Rs. ${openingBalance.toFixed(2)}`, 14, 39);

      autoTable(doc, {
        startY: 45,
        head: [['Date', 'Type', 'Reference', 'Debit', 'Credit', 'Balance']],
        body: tableBody,
        theme: 'striped',
        headStyles: { fillColor: [71, 85, 105] },
        foot: [['', '', '', '', 'Final Balance:', `Rs. ${currentBalance.toFixed(2)}`]],
        footStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontStyle: 'bold' }
      });

      doc.save(`Statement_${customer.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`);
    } catch (error) {
      console.error("Failed to generate PDF:", error);
      alert("Failed to generate statement PDF. Please try again.");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Completed Payments</h1>
          <p className="text-muted-foreground text-sm">Customers who have fully cleared their outstanding credit.</p>
        </div>
      </div>

      <Card className="bg-muted/30 border-primary/20">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-end">
          <div className="space-y-2 flex-1">
            <label className="text-sm font-medium">Customer Search</label>
            <div className="relative border shadow-sm rounded-md bg-background">
              < Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
              setFromDate(new Date());
              setToDate(new Date());
            }}
          >
            <X className="h-4 w-4 mr-1" /> Reset
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
             <CardTitle className="text-lg">Cleared Customer Accounts</CardTitle>
        </CardHeader>
        <CardContent>
            {isLoading ? (
                <div className="text-center py-8">Loading data...</div>
            ) : completedCustomers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground flex flex-col items-center justify-center gap-3">
                    <div className="bg-primary/5 p-4 rounded-full">
                      <CheckCircle className="h-8 w-8 text-primary/40" />
                    </div>
                    <div>
                      <p className="text-lg font-medium text-foreground">
                        {(!fromDate || isSameDay(fromDate, new Date())) && (!toDate || isSameDay(toDate, new Date())) 
                          ? "Today no customers cleared due amount" 
                          : "No customers cleared for this period"}
                      </p>
                      <p className="text-sm">Try adjusting your date filters or search query.</p>
                    </div>
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
                                                <Download className="h-4 w-4 mr-1" /> Print
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    
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
                                <ChevronLeft className="h-4 w-4" /> Previous
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(Math.min(totalPages, page + 1))}
                                disabled={page === totalPages}
                            >
                                Next <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col border-none shadow-2xl p-0 overflow-hidden">
            <div className="bg-primary p-6 text-primary-foreground">
                <DialogTitle className="text-2xl font-bold">Transaction Ledger</DialogTitle>
                <DialogDescription className="text-primary-foreground/80 mt-1">
                  {selectedCustomer?.name} • Contact: {selectedCustomer?.phone || 'N/A'}
                </DialogDescription>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-background">
                {selectedCustomer && (
                  <CustomerLedgerContainer
                    customer={selectedCustomer} 
                    fromDate={fromDate} 
                    toDate={toDate} 
                  />
                )}
            </div>
            <div className="p-4 bg-muted/30 border-t flex items-center justify-end gap-3">
               <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Close</Button>
               <Button onClick={() => selectedCustomer && generateStatementPDF(selectedCustomer)} className="gap-2">
                 <FileText className="h-4 w-4" /> Print PDF Statement
               </Button>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
