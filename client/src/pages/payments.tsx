
import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Search, Plus, Calendar, Save, Trash2, Printer, CreditCard, Wallet, X, CheckCircle, FileDown, Edit2 as Pencil } from "lucide-react"; // Aliasing Edit2 to Pencil to avoid changing all usages
import type { Vendor, Customer, VendorPayment, CustomerPayment, HamaliCashPayment, Invoice, InvoiceItem, Product, Purchase, PurchaseItem } from "@shared/schema";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

type VendorWithBalance = Vendor & { totalPurchases: number; totalPayments: number; balance: number };
type CustomerWithBalance = Customer & { totalInvoices: number; totalPayments: number; balance: number };
type CustomerPaymentWithInvoice = CustomerPayment & { invoiceNumber?: string | null };

interface PurchaseWithItems extends Purchase {
  items: (PurchaseItem & { product?: Product })[];
}

interface InvoiceWithItems extends Invoice {
  items: (InvoiceItem & { product?: Product })[];
  originalSubtotal: number;
  originalHamali: number;
  originalGrandTotal: number;
  shop?: number | null;
}

interface EditedItem {
  itemId: string;
  unitPrice: number;
  quantity: number;
  total: number;
}

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

const ITEMS_PER_PAGE = 10;

interface EditedInvoice {
  invoiceId: string;
  bags: number;
  ratePerBag: number;
  hamaliChargeAmount: number;
  items: EditedItem[];
}

import { PaymentDashboard } from "@/components/payments/payment-dashboard";
import { PaymentReports } from "@/components/payments/payment-reports";
import { ExternalLink, LayoutDashboard, FileText, List } from "lucide-react";

export default function Payments() {
  const { toast } = useToast();
  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<string>("");
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [vendorPaymentAmount, setVendorPaymentAmount] = useState("");
  const [customerPaymentAmount, setCustomerPaymentAmount] = useState("");
  const [vendorPaymentMethod, setVendorPaymentMethod] = useState("cash");
  const [customerPaymentMethod, setCustomerPaymentMethod] = useState("cash");
  const [hamaliDialogOpen, setHamaliDialogOpen] = useState(false);
  const [hamaliAmount, setHamaliAmount] = useState("");
  const [historyCustomerFilter, setHistoryCustomerFilter] = useState<string>("all");
  const [hamaliCustomerId, setHamaliCustomerId] = useState<string>("none");
  const [hamaliNotes, setHamaliNotes] = useState("");
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [vendorHistoryDialogOpen, setVendorHistoryDialogOpen] = useState(false);
  // Vendor Payment State
  const [vendorPurchases, setVendorPurchases] = useState<PurchaseWithItems[]>([]);
  const [vendorStep, setVendorStep] = useState<'select' | 'review' | 'completed'>('select');
  const [completedVendorPaymentData, setCompletedVendorPaymentData] = useState<any>(null);
  const [editingPayment, setEditingPayment] = useState<{ id: string, type: 'vendor' | 'customer', amount: string, date: string, method: string, notes?: string } | null>(null);

  // Customer Payment State
  const [listDateFrom, setListDateFrom] = useState(format(new Date(), "yyyy-MM-dd"));
  const [listDateTo, setListDateTo] = useState(format(new Date(), "yyyy-MM-dd"));

  // Customer Credit Tab State
  const [creditDateFrom, setCreditDateFrom] = useState(format(new Date(), "yyyy-MM-dd"));
  const [creditDateTo, setCreditDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [showCreditOnly, setShowCreditOnly] = useState(true);
  const [customerInvoices, setCustomerInvoices] = useState<InvoiceWithItems[]>([]);
  const [editedInvoices, setEditedInvoices] = useState<Record<string, EditedInvoice>>({});
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [vendorPage, setVendorPage] = useState(1);
  const [customerPage, setCustomerPage] = useState(1);
  const [customerSummary, setCustomerSummary] = useState<{
    totalInvoices: number;
    totalPayments: number;
    remainingBalance: number;
  } | null>(null);
  const [step, setStep] = useState<'select' | 'review' | 'completed'>('select');
  const [completedPaymentData, setCompletedPaymentData] = useState<{
    customerName: string;
    amount: number;
    grandTotal: number;
    previouslyPaid: number;
    paymentMethod: string;
    date: string;
    invoices: InvoiceWithItems[];
    editedInvoices: Record<string, EditedInvoice>;
  } | null>(null);

  const { data: vendors = [], isLoading: vendorsLoading } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  const { data: customers = [], isLoading: customersLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: vendorBalances = [], isLoading: vendorBalancesLoading } = useQuery<VendorWithBalance[]>({
    queryKey: ["/api/reports/vendor-balances"],
  });

  const { data: customerBalances = [], isLoading: customerBalancesLoading } = useQuery<CustomerWithBalance[]>({
    queryKey: ["/api/reports/customer-balances"],
  });

  const [vendorHistoryFilter, setVendorHistoryFilter] = useState<string>("all");

  const { data: vendorPayments = [] } = useQuery<VendorPayment[]>({
    queryKey: ["/api/vendor-payments"],
  });

  const filteredVendorPayments = useMemo(() => {
    if (vendorHistoryFilter === "all") return vendorPayments;
    return vendorPayments.filter(p => p.vendorId === vendorHistoryFilter);
  }, [vendorPayments, vendorHistoryFilter]);


  const { data: customerPayments = [] } = useQuery<CustomerPaymentWithInvoice[]>({
    queryKey: ["/api/customer-payments"],
  });

  const filteredCustomerPayments = useMemo(() => {
    if (historyCustomerFilter === "all") return customerPayments;
    return customerPayments.filter(p => p.customerId === historyCustomerFilter);
  }, [customerPayments, historyCustomerFilter]);

  const { data: hamaliCashPayments = [] } = useQuery<HamaliCashPayment[]>({
    queryKey: ["/api/hamali-cash"],
  });

  // Fetch Invoices for Customer Credit Tab
  const { data: creditInvoicesData, isLoading: creditInvoicesLoading } = useQuery<{ invoices: InvoiceWithItems[] }>({
    queryKey: ["/api/invoices", { startDate: creditDateFrom, endDate: creditDateTo, status: showCreditOnly ? 'pending' : undefined }],
  });

  const creditInvoices = useMemo(() => {
    return creditInvoicesData?.invoices || [];
  }, [creditInvoicesData]);

  const totalCreditAmount = useMemo(() => {
    return creditInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0);
  }, [creditInvoices]);

  const customerPaymentStats = useMemo(() => {
    const stats: Record<string, number> = {};
    customerPayments.forEach(payment => {
      if (payment.date >= listDateFrom && payment.date <= listDateTo) {
        stats[payment.customerId] = (stats[payment.customerId] || 0) + payment.amount;
      }
    });
    return stats;
  }, [customerPayments, listDateFrom, listDateTo]);

  const [vendorSummary, setVendorSummary] = useState<{
    totalPurchases: number;
    totalPayments: number;
    totalReturns: number;
    balance: number;
  } | null>(null);

  const loadVendorPurchases = async (vendorId: string) => {
    try {
      const res = await fetch(`/api/vendors/${vendorId}/purchases`);
      if (!res.ok) throw new Error("Failed to fetch purchases");
      const data = await res.json();

      const purchases = data.purchases;
      const summary = data.summary;

      setVendorSummary(summary);
      setVendorPaymentAmount(summary.balance > 0 ? String(summary.balance) : "");

      const purchasesWithItems: PurchaseWithItems[] = purchases.map((purchase: any) => ({
        ...purchase,
        items: (purchase.items || []).map((item: any) => ({
          ...item,
          product: products.find(p => p.id === item.productId),
        })),
      }));

      setVendorPurchases(purchasesWithItems);
    } catch (error) {
      console.error("Error loading vendor purchases:", error);
      toast({ title: "Error", description: "Failed to load vendor purchases.", variant: "destructive" });
    }
  };

  const loadCustomerInvoices = async (customerId: string) => {
    console.log("Loading customer invoices for:", customerId);
    setLoadingInvoices(true);
    try {
      const invoicesRes = await fetch(`/api/customers/${customerId}/invoices`);
      if (!invoicesRes.ok) throw new Error("Failed to fetch invoices");
      const data = await invoicesRes.json();
      console.log("Invoices fetched:", data);
      const invoices = data.invoices;
      const summary = data.summary;

      setCustomerSummary(summary);
      setCustomerPaymentAmount(summary.remainingBalance > 0 ? String(summary.remainingBalance) : "");

      const invoicesWithItems: InvoiceWithItems[] = invoices.map((invoice: any) => ({
        ...invoice,
        items: (invoice.items || []).map((item: any) => ({
          ...item,
          product: products.find(p => p.id === item.productId),
        })),
        originalSubtotal: invoice.subtotal,
        originalHamali: invoice.hamaliChargeAmount || 0,
        originalGrandTotal: invoice.grandTotal,
      }));

      setCustomerInvoices(invoicesWithItems);

      const initialEdited: Record<string, EditedInvoice> = {};
      invoicesWithItems.forEach(inv => {
        const existingBags = (inv as any).bags || 0;
        const existingRatePerBag = (inv as any).hamaliRatePerBag || 0;
        const existingHamali = inv.hamaliChargeAmount || 0;
        initialEdited[inv.id] = {
          invoiceId: inv.id,
          bags: existingBags,
          ratePerBag: existingRatePerBag,
          hamaliChargeAmount: existingHamali,
          items: inv.items.map(item => ({
            itemId: item.id,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            total: item.total,
          })),
        };
      });
      setEditedInvoices(initialEdited);
      setStep('review');
    } catch (error) {
      console.error("Error loading customer invoices:", error);
      toast({ title: "Error", description: "Failed to load customer invoices", variant: "destructive" });
    } finally {
      setLoadingInvoices(false);
    }
  };

  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomer(customerId);
    if (customerId) {
      loadCustomerInvoices(customerId);
    }
  };

  const updateItemPrice = (invoiceId: string, itemId: string, newPrice: number) => {
    setEditedInvoices(prev => {
      const invoice = prev[invoiceId];
      if (!invoice) return prev;

      const updatedItems = invoice.items.map(item => {
        if (item.itemId === itemId) {
          const newTotal = item.quantity * newPrice;
          return { ...item, unitPrice: newPrice, total: newTotal };
        }
        return item;
      });

      return {
        ...prev,
        [invoiceId]: { ...invoice, items: updatedItems },
      };
    });
  };

  const updateHamaliBags = (invoiceId: string, newBags: number) => {
    setEditedInvoices(prev => {
      const invoice = prev[invoiceId];
      if (!invoice) return prev;
      const newHamali = newBags * invoice.ratePerBag;
      return {
        ...prev,
        [invoiceId]: { ...invoice, bags: newBags, hamaliChargeAmount: newHamali },
      };
    });
  };

  const updateHamaliRate = (invoiceId: string, newRate: number) => {
    setEditedInvoices(prev => {
      const invoice = prev[invoiceId];
      if (!invoice) return prev;
      const newHamali = invoice.bags * newRate;
      return {
        ...prev,
        [invoiceId]: { ...invoice, ratePerBag: newRate, hamaliChargeAmount: newHamali },
      };
    });
  };

  const updateHamaliAmount = (invoiceId: string, newHamali: number) => {
    setEditedInvoices(prev => {
      const invoice = prev[invoiceId];
      if (!invoice) return prev;
      return {
        ...prev,
        [invoiceId]: { ...invoice, hamaliChargeAmount: newHamali },
      };
    });
  };

  const handleHamaliChange = (invoiceId: string, field: 'bags' | 'ratePerBag', value: string) => {
    const numValue = parseFloat(value) || 0;
    if (field === 'bags') {
      updateHamaliBags(invoiceId, numValue);
    } else if (field === 'ratePerBag') {
      updateHamaliRate(invoiceId, numValue);
    }
  };

  const getInvoiceTotal = (invoiceId: string) => {
    const edited = editedInvoices[invoiceId];
    if (!edited) return { subtotal: 0, hamali: 0, grandTotal: 0 };

    const subtotal = edited.items.reduce((sum, item) => sum + item.total, 0);
    const hamali = edited.hamaliChargeAmount;
    return { subtotal, hamali, grandTotal: subtotal + hamali };
  };

  const grandTotalAllInvoices = useMemo(() => {
    return Object.keys(editedInvoices).reduce((sum, invoiceId) => {
      return sum + getInvoiceTotal(invoiceId).grandTotal;
    }, 0);
  }, [editedInvoices]);

  const handleVendorPaymentClick = (vendorId: string) => {
    setSelectedVendor(vendorId);
    setVendorStep('review');
    setVendorDialogOpen(true);
    loadVendorPurchases(vendorId);
  };

  const resetVendorDialog = () => {
    setVendorStep('select');
    setSelectedVendor("");
    setVendorPurchases([]);
    setVendorSummary(null);
    setVendorPaymentAmount("");
    setCompletedVendorPaymentData(null);
  };

  const handleVendorDialogClose = (open: boolean) => {
    if (!open) {
      resetVendorDialog();
      setVendorDialogOpen(false);
    }
  };

  const handleCustomerPaymentClick = (customerId: string) => {
    setSelectedCustomer(customerId);
    setStep('review');
    setCustomerDialogOpen(true);
    loadCustomerInvoices(customerId);
  };

  const saveInvoiceChanges = useMutation({
    mutationFn: async () => {
      for (const invoiceId of Object.keys(editedInvoices)) {
        const edited = editedInvoices[invoiceId];
        const totals = getInvoiceTotal(invoiceId);

        await apiRequest("PATCH", `/api/invoices/${invoiceId}`, {
          subtotal: totals.subtotal,
          hamaliChargeAmount: edited.hamaliChargeAmount,
          bags: edited.bags,
          hamaliRatePerBag: edited.ratePerBag,
          grandTotal: totals.grandTotal,
        });

        for (const item of edited.items) {
          await apiRequest("PATCH", `/api/invoice-items/${item.itemId}`, {
            unitPrice: item.unitPrice,
            total: item.total,
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/customer-balances"] });
      toast({ title: "Changes saved", description: "Invoice changes have been saved successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save invoice changes.", variant: "destructive" });
    },
  });

  const getVendorName = (id: string) => vendors.find(v => v.id === id)?.name || "Unknown Vendor";

  const createVendorPayment = useMutation({
    mutationFn: async (data: { vendorId: string; amount: number; paymentMethod: string; date: string }) => {
      return apiRequest("POST", "/api/vendor-payments", data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor-payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/vendor-balances"] });

      setCompletedVendorPaymentData({
        vendorName: getVendorName(variables.vendorId),
        amount: variables.amount,
        totalPurchases: vendorSummary?.totalPurchases ?? 0,
        previouslyPaid: vendorSummary?.totalPayments ?? 0,
        balance: (vendorSummary?.totalPurchases ?? 0) - (vendorSummary?.totalPayments ?? 0) - (vendorSummary?.totalReturns ?? 0),
        paymentMethod: variables.paymentMethod,
        date: variables.date,
        purchases: vendorPurchases
      });
      setVendorStep('completed');
      toast({ title: "Payment recorded", description: "Vendor payment has been recorded successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to record payment.", variant: "destructive" });
    },
  });

  const updateVendorPayment = useMutation({
    mutationFn: async (data: { id: string; amount: number; paymentMethod: string; date: string; notes?: string }) => {
      const res = await apiRequest("PATCH", `/api/vendor-payments/${data.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor-payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/vendor-balances"] });
      // Also invalidate specific vendor purchases logic if necessary, though balance is derived
      toast({ title: "Payment Updated", description: "Vendor payment has been updated successfully." });
      setEditingPayment(null);
    },
    onError: (error: any) => {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    },
  });

  const updateCustomerPayment = useMutation({
    mutationFn: async (data: { id: string; amount: number; paymentMethod: string; date: string; notes?: string }) => {
      const res = await apiRequest("PATCH", `/api/customer-payments/${data.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer-payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/customer-balances"] });
      toast({ title: "Payment Updated", description: "Customer payment has been updated successfully." });
      setEditingPayment(null);
    },
    onError: (error: any) => {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    },
  });

  const handleVendorPaymentSubmit = () => {
    if (!selectedVendor || !vendorPaymentAmount || Number(vendorPaymentAmount) <= 0) return;

    createVendorPayment.mutate({
      vendorId: selectedVendor,
      amount: Number(vendorPaymentAmount),
      paymentMethod: vendorPaymentMethod,
      date: new Date().toISOString().split('T')[0],
    });
  };

  const createCustomerPayment = useMutation({
    mutationFn: async (data: { customerId: string; invoiceId?: string; amount: number; paymentMethod: string; date: string }) => {
      return apiRequest("POST", "/api/customer-payments", data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer-payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/customer-balances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });

      setCompletedPaymentData({
        customerName: getCustomerName(variables.customerId),
        amount: variables.amount,
        grandTotal: grandTotalAllInvoices,
        previouslyPaid: customerSummary?.totalPayments ?? 0,
        paymentMethod: variables.paymentMethod,
        date: variables.date,
        invoices: customerInvoices,
        editedInvoices: editedInvoices,
      });
      setStep('completed');
      toast({ title: "Payment recorded", description: "Customer payment has been recorded successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to record payment.", variant: "destructive" });
    },
  });

  const createHamaliCashPayment = useMutation({
    mutationFn: async (data: { amount: number; date: string; paymentMethod: string; customerId?: string; notes?: string }) => {
      return apiRequest("POST", "/api/hamali-cash", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hamali-cash"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/profit-loss"] });
      setHamaliDialogOpen(false);
      setHamaliAmount("");
      setHamaliCustomerId("none");
      setHamaliNotes("");
      toast({ title: "Hamali payment recorded", description: "Direct Hamali cash payment has been recorded." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to record Hamali payment.", variant: "destructive" });
    },
  });

  const deleteHamaliCashPayment = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/hamali-cash/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hamali-cash"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/profit-loss"] });
      toast({ title: "Payment deleted", description: "Hamali cash payment has been deleted." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete payment.", variant: "destructive" });
    },
  });

  const resetCustomerDialog = () => {
    setSelectedCustomer("");
    setCustomerPaymentAmount("");
    setCustomerInvoices([]);
    setEditedInvoices({});
    setStep('select');
    setCompletedPaymentData(null);
    setCustomerPaymentMethod("cash");
    setCustomerSummary(null);
  };

  const handlePrintReceipt = () => {
    if (!completedPaymentData) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({ title: "Error", description: "Please allow popups to print receipt", variant: "destructive" });
      return;
    }


    try {
      const totalHamali = completedPaymentData.invoices.reduce((sum, inv) => {
        const edited = completedPaymentData.editedInvoices?.[inv.id];
        return sum + (edited?.hamaliChargeAmount || inv.hamaliChargeAmount || 0);
      }, 0);

      const totalBags = completedPaymentData.invoices.reduce((sum, inv) => {
        const edited = completedPaymentData.editedInvoices?.[inv.id];
        return sum + (edited?.bags || 0);
      }, 0);

      const invoiceRows = completedPaymentData.invoices.flatMap(inv => {
        const edited = completedPaymentData.editedInvoices?.[inv.id];
        // Always use original items to ensure product details are available
        const items = inv.items || [];

        return items.map((item, index) => {
          const isFirstItem = index === 0;
          const editedItem = edited?.items?.find(e => e.itemId === item.id);
          const price = editedItem?.unitPrice ?? item.unitPrice;
          const total = editedItem?.total ?? item.total;

          const hamaliBags = edited?.bags || 0;
          const hamaliRate = edited?.ratePerBag || 0;
          const hamaliAmount = edited?.hamaliChargeAmount || inv.hamaliChargeAmount || 0;
          const invoiceTotal = (edited?.items?.reduce((s, i) => s + i.total, 0) || inv.subtotal) + hamaliAmount;

          return `
          <tr style="border-bottom: 1px solid #e0e0e0;">
            <td style="padding: 8px 10px; text-align: center; vertical-align: top;">
              ${isFirstItem ? completedPaymentData.invoices.indexOf(inv) + 1 : ''}
            </td>
            <td style="padding: 8px 10px; vertical-align: top;">
              ${isFirstItem ? `
                <div style="font-weight: 600;">${inv.date}</div>
                <div style="font-size: 11px; color: #666;">${inv.invoiceNumber}</div>
                ${inv.shop ? `<span style="font-size: 10px; background: ${inv.shop === 45 ? '#fff7ed' : '#eff6ff'}; color: ${inv.shop === 45 ? '#c2410c' : '#1d4ed8'}; border: 1px solid ${inv.shop === 45 ? '#fed7aa' : '#bfdbfe'}; padding: 1px 4px; border-radius: 4px;">Shop ${inv.shop}</span>` : ''}
              ` : ''}
            </td>
            <td style="padding: 8px 10px; vertical-align: top;">${item.product?.name || 'Unknown'}</td>
            <td style="padding: 8px 10px; text-align: center; vertical-align: top;">${item.quantity}</td>
            <td style="padding: 8px 10px; text-align: right; vertical-align: top;">₹${price.toFixed(2)}</td>
            <td style="padding: 8px 10px; text-align: center; vertical-align: top;">
              ${isFirstItem ? `
                <div style="font-size: 12px;">
                  ${hamaliBags} × ₹${hamaliRate}
                </div>
                <div style="font-weight: 600; font-size: 13px;">= ₹${hamaliAmount.toFixed(0)}</div>
              ` : ''}
            </td>
            <td style="padding: 8px 10px; text-align: right; font-weight: 600; vertical-align: top;">
              ${isFirstItem ? `₹${invoiceTotal.toFixed(2)}` : ''}
            </td>
          </tr>
        `;
        }).join('');
      }).join('');

      const invoiceSubtotal = completedPaymentData.invoices.reduce((sum, inv) => {
        const edited = completedPaymentData.editedInvoices?.[inv.id];
        const itemsTotal = edited?.items?.reduce((s, i) => s + i.total, 0) || inv.subtotal || 0;
        return sum + itemsTotal;
      }, 0);
      const grandTotal = invoiceSubtotal + totalHamali;
      const amountPaid = completedPaymentData.amount;
      const totalPaidIncludingThis = completedPaymentData.previouslyPaid + amountPaid;
      const balanceRemaining = grandTotal - totalPaidIncludingThis;

      const paymentMethodLabel = {
        cash: 'CASH',
        bank: 'BANK TRANSFER',
        upi: 'UPI',
      }[completedPaymentData.paymentMethod] || completedPaymentData.paymentMethod.toUpperCase();

      printWindow.document.open();
      printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payment Receipt - ${completedPaymentData.customerName}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; color: #333; }
          .header { text-align: center; margin-bottom: 25px; padding-bottom: 15px; border-bottom: 3px solid #2e7d32; }
          .header h1 { margin: 0 0 5px 0; color: #2e7d32; font-size: 28px; }
          .header .business-name { margin: 0; color: #666; font-size: 14px; }
          .header .receipt-date { margin-top: 8px; font-size: 12px; color: #888; }
          .customer-info { background: #f8f9fa; border-radius: 8px; padding: 15px; margin-bottom: 20px; }
          .customer-info h3 { margin: 0 0 12px 0; font-size: 14px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
          .info-item { display: flex; justify-content: space-between; font-size: 14px; }
          .info-item .label { color: #666; }
          .info-item .value { font-weight: 600; color: #333; }
          .payment-method { display: inline-block; background: #2e7d32; color: white; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; }
          .invoices-section { margin-bottom: 20px; }
          .invoices-section h3 { margin: 0 0 15px 0; font-size: 16px; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 8px; }
          .summary-box { background: #f8f9fa; border: 2px solid #2e7d32; border-radius: 8px; padding: 20px; }
          .summary-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
          .summary-row.separator { border-top: 1px solid #ddd; margin-top: 8px; padding-top: 12px; }
          .summary-row .label { color: #666; }
          .summary-row .value { font-weight: 600; }
          .summary-row.total { font-size: 16px; border-top: 2px solid #333; margin-top: 10px; padding-top: 12px; }
          .summary-row.total .label, .summary-row.total .value { font-weight: 700; color: #333; }
          .summary-row.paid { font-size: 18px; }
          .summary-row.paid .value { color: #2e7d32; font-size: 20px; }
          .summary-row.balance .value { color: ${balanceRemaining > 0 ? '#d32f2f' : '#2e7d32'}; }
          .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
          .footer p { margin: 5px 0; font-size: 12px; color: #888; }
          @media print { 
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } 
            .summary-box { break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>PAYMENT RECEIPT</h1>
          <p class="business-name">PSK Vegitables</p>
          <p class="receipt-date">${new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        
        <div class="customer-info">
          <h3>Customer Details</h3>
          <div class="info-grid">
            <div class="info-item">
              <span class="label">Customer Name:</span>
              <span class="value">${completedPaymentData.customerName}</span>
            </div>
            <div class="info-item">
              <span class="label">Payment Date:</span>
              <span class="value">${completedPaymentData.date}</span>
            </div>
            <div class="info-item">
              <span class="label">Payment Method:</span>
              <span class="payment-method">${paymentMethodLabel}</span>
            </div>
            <div class="info-item">
              <span class="label">Total Invoices:</span>
              <span class="value">${completedPaymentData.invoices.length}</span>
            </div>
          </div>
        </div>
        
        <div class="invoices-section">
          <h3>Invoice Details</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="background: #fafafa; border-bottom: 2px solid #e0e0e0;">
                <th style="padding: 8px 10px; text-align: center; font-weight: 600; color: #444; width: 40px;">S.No</th>
                <th style="padding: 8px 10px; text-align: left; font-weight: 600; color: #444;">Date/Inv/Shop</th>
                <th style="padding: 8px 10px; text-align: left; font-weight: 600; color: #444;">Product</th>
                <th style="padding: 8px 10px; text-align: center; font-weight: 600; color: #444;">Qty</th>
                <th style="padding: 8px 10px; text-align: right; font-weight: 600; color: #444;">Price/Unit</th>
                <th style="padding: 8px 10px; text-align: center; font-weight: 600; color: #444;">Hamali</th>
                <th style="padding: 8px 10px; text-align: right; font-weight: 600; color: #444;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${invoiceRows}
            </tbody>
          </table>
        </div>
        
        <div class="summary-box">
          <div class="summary-row">
            <span class="label">Products Subtotal:</span>
            <span class="value">₹${invoiceSubtotal.toFixed(2)}</span>
          </div>
          <div class="summary-row">
            <span class="label">Total Hamali (${totalBags} bags):</span>
            <span class="value">₹${totalHamali.toFixed(2)}</span>
          </div>
          <div class="summary-row total">
            <span class="label">GRAND TOTAL:</span>
            <span class="value">₹${grandTotal.toFixed(2)}</span>
          </div>
          ${completedPaymentData.previouslyPaid > 0 ? `
          <div class="summary-row" style="font-size: 13px; color: #666;">
            <span class="label">Previously Paid:</span>
            <span class="value">-₹${completedPaymentData.previouslyPaid.toFixed(2)}</span>
          </div>
          ` : ''}
          <div class="summary-row separator paid">
            <span class="label">THIS PAYMENT:</span>
            <span class="value">₹${amountPaid.toFixed(2)}</span>
          </div>
          ${completedPaymentData.previouslyPaid > 0 ? `
          <div class="summary-row" style="font-size: 13px; color: #666;">
            <span class="label">Total Paid:</span>
            <span class="value">₹${totalPaidIncludingThis.toFixed(2)}</span>
          </div>
          ` : ''}
          <div class="summary-row balance">
            <span class="label">${balanceRemaining > 0 ? 'BALANCE DUE:' : 'BALANCE:'}</span>
            <span class="value">${balanceRemaining > 0 ? '₹' + balanceRemaining.toFixed(2) : '₹0.00 (Paid in Full)'}</span>
          </div>
        </div>
        
        <div class="footer">
          <p>Thank you for your business!</p>
          <p>For any queries, please contact us.</p>
        </div>
        
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `);
      printWindow.document.close();
    } catch (error) {
      console.error("Error generating print receipt:", error);
      toast({ title: "Error", description: "Failed to generate print receipt", variant: "destructive" });
      if (printWindow) printWindow.close();
    }
  };

  const handlePrintVendorReceipt = () => {
    if (!completedVendorPaymentData) return;

    const receiptContent = `
      <html>
        <head>
          <title>Payment Receipt</title>
          <style>
            body { font-family: 'Courier New', monospace; padding: 20px; max-width: 300px; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 1px dashed #000; padding-bottom: 10px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 5px; }
            .total-row { border-top: 1px dashed #000; margin-top: 10px; pt-2; font-weight: bold; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h3>VEG WHOLESALE</h3>
            <p>Vendor Payment Receipt</p>
          </div>
          <div class="content">
            <div class="row"><span>Date:</span> <span>${completedVendorPaymentData.date}</span></div>
            <div class="row"><span>Vendor:</span> <span>${completedVendorPaymentData.vendorName}</span></div>
            <div class="row"><span>Method:</span> <span>${completedVendorPaymentData.paymentMethod.toUpperCase()}</span></div>
            <div class="row"><span>Total Purchases:</span> <span>₹${completedVendorPaymentData.totalPurchases.toLocaleString()}</span></div>
            <div class="row"><span>Previous Paid:</span> <span>₹${completedVendorPaymentData.previouslyPaid.toLocaleString()}</span></div>
            <div class="row total-row"><span>PAID NOW:</span> <span>₹${completedVendorPaymentData.amount.toLocaleString()}</span></div>
            <div class="row"><span>Balance Due:</span> <span>₹${(completedVendorPaymentData.balance - completedVendorPaymentData.amount).toLocaleString()}</span></div>
          </div>
          <div class="footer">
            <p>Thank you!</p>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '', 'width=400,height=600');
    if (printWindow) {
      printWindow.document.write(receiptContent);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    }
  };

  const printPaymentHistory = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({ title: "Error", description: "Please allow popups to print", variant: "destructive" });
      return;
    }

    const customerName = historyCustomerFilter === "all"
      ? "All Customers"
      : getCustomerName(historyCustomerFilter);

    const totalAmount = filteredCustomerPayments.reduce((sum, p) => sum + p.amount, 0);

    const paymentRows = filteredCustomerPayments.map(payment => `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e0e0e0;">${payment.date}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e0e0e0;">${getCustomerName(payment.customerId)}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e0e0e0; font-family: monospace; font-size: 11px;">${payment.invoiceNumber || '-'}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e0e0e0; text-transform: capitalize;">${payment.paymentMethod}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e0e0e0; text-align: right; font-family: monospace;">₹${payment.amount.toLocaleString("en-IN")}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payment History - ${customerName}</title>
        <style>
          body { 
            font-family: 'IBM Plex Sans', -apple-system, sans-serif; 
            padding: 20px; 
            color: #1a1a1a;
          }
          .header {
            text-align: center;
            margin-bottom: 24px;
            padding-bottom: 16px;
            border-bottom: 2px solid #0f172a;
          }
          .header h1 { margin: 0 0 8px 0; font-size: 22px; }
          .header p { margin: 0; color: #666; font-size: 14px; }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 16px;
          }
          th { 
            background: #f8f9fa; 
            padding: 10px 12px; 
            text-align: left; 
            font-weight: 600;
            font-size: 12px;
            border-bottom: 2px solid #e0e0e0;
          }
          th:last-child { text-align: right; }
          .total-row {
            background: #f0fdf4;
            font-weight: 600;
          }
          .total-row td { padding: 12px; border-top: 2px solid #0f172a; }
          .footer {
            margin-top: 24px;
            text-align: center;
            color: #666;
            font-size: 12px;
          }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Payment History</h1>
          <p class="business-name" style="font-weight: 600; font-size: 16px; margin: 5px 0;">PSK Vegitables</p>
          <p>${customerName} | Generated: ${new Date().toLocaleDateString('en-IN')}</p>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Customer</th>
              <th>Invoice</th>
              <th>Method</th>
              <th style="text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${paymentRows}
            <tr class="total-row">
              <td colspan="4"><strong>Total (${filteredCustomerPayments.length} payments)</strong></td>
              <td style="text-align: right; font-family: monospace;"><strong>₹${totalAmount.toLocaleString("en-IN")}</strong></td>
            </tr>
          </tbody>
        </table>
        
        <div class="footer">
          <p>Printed on ${new Date().toLocaleString('en-IN')}</p>
        </div>
        
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleCustomerDialogClose = (open: boolean) => {
    setCustomerDialogOpen(open);
    if (!open) {
      resetCustomerDialog();
    }
  };



  const handleFinalizeAndPay = async () => {
    if (!selectedCustomer) return;

    await saveInvoiceChanges.mutateAsync();

    const paymentAmount = customerPaymentAmount ? parseFloat(customerPaymentAmount) : grandTotalAllInvoices;

    // Link payment to the first unpaid/partially paid invoice
    const invoiceId = customerInvoices.length > 0 ? customerInvoices[0].id : undefined;

    createCustomerPayment.mutate({
      customerId: selectedCustomer,
      invoiceId,
      amount: paymentAmount,
      paymentMethod: customerPaymentMethod,
      date: new Date().toISOString().split("T")[0],
    });
  };

  const handleHamaliPayment = () => {
    if (!hamaliAmount) return;
    createHamaliCashPayment.mutate({
      amount: parseFloat(hamaliAmount),
      date: new Date().toISOString().split("T")[0],
      paymentMethod: "cash",
      customerId: hamaliCustomerId === "none" ? undefined : hamaliCustomerId,
      notes: hamaliNotes || undefined,
    });
  };

  const getCustomerName = (id: string) => customers.find((c) => c.id === id)?.name || "Unknown";

  const totalVendorOutstanding = vendorBalances.reduce((sum, v) => sum + v.balance, 0);
  const totalCustomerReceivable = customerBalances.reduce((sum, c) => sum + c.balance, 0);

  if (vendorsLoading || customersLoading || vendorBalancesLoading || customerBalancesLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const handleSaveChanges = () => {
    saveInvoiceChanges.mutate();
  };

  const handleCustomerPaymentSubmit = () => {
    if (!selectedCustomer || !customerPaymentAmount || Number(customerPaymentAmount) <= 0) return;

    createCustomerPayment.mutate({
      customerId: selectedCustomer,
      amount: Number(customerPaymentAmount),
      paymentMethod: customerPaymentMethod,
      date: new Date().toISOString().split('T')[0],
    });
  };

  return (
    <div className="p-6 space-y-6 h-full flex flex-col">

      <Dialog open={!!editingPayment} onOpenChange={(open) => !open && setEditingPayment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Payment</DialogTitle>
            <DialogDescription>
              Modify payment details.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-date" className="text-right">
                Date
              </Label>
              <Input
                id="edit-date"
                type="date"
                value={editingPayment?.date || ""}
                onChange={(e) => setEditingPayment(prev => prev ? ({ ...prev, date: e.target.value }) : null)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-amount" className="text-right">
                Amount
              </Label>
              <Input
                id="edit-amount"
                type="number"
                value={editingPayment?.amount || ""}
                onChange={(e) => setEditingPayment(prev => prev ? ({ ...prev, amount: e.target.value }) : null)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-method" className="text-right">
                Method
              </Label>
              <Select
                value={editingPayment?.method || "cash"}
                onValueChange={(value) => setEditingPayment(prev => prev ? ({ ...prev, method: value }) : null)}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank">Bank Transfer</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-notes" className="text-right">
                Notes
              </Label>
              <Input
                id="edit-notes"
                value={editingPayment?.notes || ""}
                onChange={(e) => setEditingPayment(prev => prev ? ({ ...prev, notes: e.target.value }) : null)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPayment(null)}>cancel</Button>
            <Button onClick={() => {
              if (!editingPayment) return;
              const payload = {
                id: editingPayment.id,
                amount: parseFloat(editingPayment.amount),
                date: editingPayment.date,
                paymentMethod: editingPayment.method,
                notes: editingPayment.notes
              };
              if (editingPayment.type === 'vendor') {
                updateVendorPayment.mutate(payload);
              } else {
                updateCustomerPayment.mutate(payload);
              }
            }}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <Tabs defaultValue="dashboard" className="space-y-4 w-full h-full flex flex-col">
        <TabsList className="w-full grid grid-cols-3 h-12 bg-muted/20 p-1">
          <TabsTrigger value="dashboard" className="h-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-base">Dashboard</TabsTrigger>
          <TabsTrigger value="transactions" className="h-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-base">Transactions</TabsTrigger>
          <TabsTrigger value="reports" className="h-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-base">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <PaymentDashboard />
        </TabsContent>

        <TabsContent value="reports">
          <PaymentReports />
        </TabsContent>

        <TabsContent value="transactions">
          <Tabs defaultValue="vendors" className="space-y-4">
            <TabsList>
              <TabsTrigger value="vendors" data-testid="tab-vendors">Vendor Payments</TabsTrigger>
              <TabsTrigger value="customers" data-testid="tab-customers">Customer Payments</TabsTrigger>
              <TabsTrigger value="customer-credit">Customers Credit</TabsTrigger>
            </TabsList>

            <TabsContent value="customer-credit">
              <Card>
                <CardHeader>
                  <CardTitle>Customers Credit Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 mb-6">
                    <div>
                      <Label>From Date</Label>
                      <Input type="date" value={creditDateFrom} onChange={(e) => setCreditDateFrom(e.target.value)} />
                    </div>
                    <div>
                      <Label>To Date</Label>
                      <Input type="date" value={creditDateTo} onChange={(e) => setCreditDateTo(e.target.value)} />
                    </div>
                    <div className="flex items-center space-x-2 pt-6">
                      <Checkbox
                        id="showCreditOnly"
                        checked={showCreditOnly}
                        onCheckedChange={(checked) => setShowCreditOnly(checked as boolean)}
                      />
                      <Label
                        htmlFor="showCreditOnly"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Show Credit Only (Pending)
                      </Label>
                    </div>
                  </div>

                  <div className="min-h-[300px]">
                    {creditInvoicesLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    ) : creditInvoices.length > 0 ? (
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[50px]">S.No</TableHead>
                              <TableHead>Customer Name</TableHead>
                              <TableHead>Invoice No</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Date</TableHead>
                              <TableHead className="text-right">Credit Amount</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {creditInvoices.map((invoice, index) => {
                              const customerName = customers.find(c => c.id === invoice.customerId)?.name || "Unknown";
                              return (
                                <TableRow key={invoice.id}>
                                  <TableCell>{index + 1}</TableCell>
                                  <TableCell className="font-medium">{customerName}</TableCell>
                                  <TableCell>{invoice.invoiceNumber}</TableCell>
                                  <TableCell>
                                    <Badge variant={invoice.status === 'pending' ? 'destructive' : 'default'} className="uppercase text-[10px]">
                                      {invoice.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>{invoice.date}</TableCell>
                                  <TableCell className="text-right">₹{invoice.grandTotal.toFixed(2)}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                        <div className="p-4 bg-muted/20 border-t flex justify-between items-center font-bold">
                          <span>Total Credit Amount:</span>
                          <span>₹{totalCreditAmount.toFixed(2)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-8 text-muted-foreground border rounded-md border-dashed">
                        <p className="text-lg font-medium">No Credit Records Found</p>
                        <p className="text-sm">Try selecting a different date range.</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="vendors" className="space-y-4">
              <Dialog open={vendorDialogOpen} onOpenChange={handleVendorDialogClose}>
                <DialogContent className="max-w-4xl max-h-[85vh] overflow-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {vendorStep === 'select' && 'Select Vendor'}
                      {vendorStep === 'review' && `Review & Finalize - ${getVendorName(selectedVendor)}`}
                      {vendorStep === 'completed' && 'Payment Completed'}
                    </DialogTitle>
                    <DialogDescription>
                      {vendorStep === 'select' && 'Select a vendor to record payment'}
                      {vendorStep === 'review' && 'Review purchases and record payment'}
                      {vendorStep === 'completed' && 'Payment has been recorded successfully'}
                    </DialogDescription>
                  </DialogHeader>

                  {vendorStep === 'review' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setVendorDialogOpen(false)}>
                            <X className="h-4 w-4 mr-1" /> Close
                          </Button>
                          <Badge variant="secondary" className="text-xs">{vendorPurchases.length} Purchase(s)</Badge>
                        </div>
                        {vendorSummary && (
                          <div className="flex items-center gap-3 text-sm">
                            <span className="text-muted-foreground font-medium">
                              Total: <span className="font-mono text-base text-foreground">{vendorSummary.totalPurchases.toLocaleString("en-IN", { style: "currency", currency: "INR" })}</span>
                            </span>
                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded-md border border-green-200 shadow-sm flex items-center gap-1">
                              <span className="text-xs font-semibold uppercase">Paid:</span>
                              <span className="font-mono font-bold text-base">{vendorSummary.totalPayments.toLocaleString("en-IN", { style: "currency", currency: "INR" })}</span>
                            </span>
                            <span className={`${vendorSummary.balance > 0 ? "bg-yellow-100 text-yellow-800 border-yellow-200" : "bg-green-100 text-green-800 border-green-200"} px-2 py-1 rounded-md border shadow-sm flex items-center gap-1`}>
                              <span className="text-xs font-semibold uppercase">Due:</span>
                              <span className="font-mono font-bold text-base">{vendorSummary.balance.toLocaleString("en-IN", { style: "currency", currency: "INR" })}</span>
                            </span>
                          </div>
                        )}
                      </div>

                      {vendorSummary && vendorSummary.totalPayments > 0 ? (
                        <div className="border rounded-md">
                          <div className="p-4 space-y-4">
                            <div className="text-sm text-muted-foreground mb-2">
                              Products purchased from vendor
                            </div>
                            {vendorPurchases.map((purchase) => (
                              <Card key={purchase.id} className="overflow-hidden">
                                <CardHeader className="py-2 bg-muted/30">
                                  <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <CardTitle className="text-sm">Purchase {purchase.id.slice(0, 8)}</CardTitle>
                                    <Badge variant="secondary" className="text-xs">{purchase.date}</Badge>
                                  </div>
                                </CardHeader>
                                <CardContent className="p-3 space-y-2">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="text-xs">Product</TableHead>
                                        <TableHead className="text-xs text-center">Qty</TableHead>
                                        <TableHead className="text-xs text-right">Rate</TableHead>
                                        <TableHead className="text-xs text-right">Total</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {purchase.items.map((item) => (
                                        <TableRow key={item.id}>
                                          <TableCell className="text-sm">{item.product?.name || 'Unknown'}</TableCell>
                                          <TableCell className="text-sm text-center">{item.quantity}</TableCell>
                                          <TableCell className="text-sm text-right font-mono">₹{item.unitPrice}</TableCell>
                                          <TableCell className="text-sm text-right font-mono">{item.total.toLocaleString("en-IN", { style: "currency", currency: "INR" })}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                  <div className="flex justify-end pt-2 border-t text-sm">
                                    <span className="font-semibold">
                                      Total: <span className="font-mono text-primary">{purchase.totalAmount.toLocaleString("en-IN", { style: "currency", currency: "INR" })}</span>
                                    </span>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="border rounded-md overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/40 uppercase text-xs hover:bg-muted/40">
                                <TableHead className="w-[50px] text-center font-bold text-black">S.No</TableHead>
                                <TableHead className="w-[100px] font-bold text-black">Date</TableHead>
                                <TableHead className="min-w-[150px] font-bold text-black">Product</TableHead>
                                <TableHead className="w-[80px] text-center font-bold text-black">Qty</TableHead>
                                <TableHead className="w-[100px] text-center font-bold text-black">Price/Unit</TableHead>
                                <TableHead className="w-[120px] text-right font-bold text-black">Total</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {vendorPurchases.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                    No purchases found for this vendor
                                  </TableCell>
                                </TableRow>
                              ) : (
                                vendorPurchases.map((purchase, index) => {
                                  const items = purchase.items || [];
                                  return items.map((item, itemIndex) => {
                                    const isFirstItem = itemIndex === 0;
                                    return (
                                      <TableRow key={`${purchase.id}-${item.id}`} className={isFirstItem ? "border-t" : "border-0"}>
                                        {isFirstItem && (
                                          <>
                                            <TableCell rowSpan={items.length} className="text-center align-top border-r bg-muted/5">{index + 1}</TableCell>
                                            <TableCell rowSpan={items.length} className="align-top border-r bg-muted/5">
                                              <div className="font-semibold">{purchase.date}</div>
                                            </TableCell>
                                          </>
                                        )}
                                        <TableCell className="align-top border-r">{item.product?.name || 'Unknown'}</TableCell>
                                        <TableCell className="text-center align-top border-r">{item.quantity}</TableCell>
                                        <TableCell className="text-center align-top border-r">₹{item.unitPrice}</TableCell>
                                        <TableCell className="text-right align-top border-r font-mono">₹{item.total}</TableCell>
                                      </TableRow>
                                    )
                                  })
                                })
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      )}

                      <div className="grid gap-4 md:grid-cols-2 bg-muted/20 p-4 rounded-lg">
                        <div className="space-y-2">
                          <Label>Payment Method</Label>
                          <Select value={vendorPaymentMethod} onValueChange={setVendorPaymentMethod}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cash">Cash</SelectItem>
                              <SelectItem value="bank">Bank Transfer</SelectItem>
                              <SelectItem value="upi">UPI</SelectItem>
                              <SelectItem value="cheque">Cheque</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Payment Amount (Enter amount to pay now)</Label>
                          <Input
                            type="number"
                            placeholder="Enter payment amount"
                            value={vendorPaymentAmount}
                            onChange={(e) => setVendorPaymentAmount(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 pt-4">
                        <Button variant="secondary" onClick={() => setVendorDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button
                          onClick={handleVendorPaymentSubmit}
                          disabled={!vendorPaymentAmount || Number(vendorPaymentAmount) <= 0 || createVendorPayment.isPending}
                          className={Number(vendorPaymentAmount) > 0 ? "bg-green-600 hover:bg-green-700" : ""}
                        >
                          {createVendorPayment.isPending ? "Processing..." : `PAY: ₹${Number(vendorPaymentAmount || 0).toLocaleString("en-IN")}`}
                        </Button>
                      </div>
                    </div>
                  )}

                  {vendorStep === 'completed' && completedVendorPaymentData && (
                    <div className="flex flex-col items-center justify-center py-8 space-y-6">
                      <div className="flex flex-col items-center space-y-2 text-center">
                        <div className="h-16 w-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-2">
                          <CheckCircle className="h-10 w-10" />
                        </div>
                        <h3 className="text-2xl font-bold text-green-600">Payment Recorded Successfully!</h3>
                        <p className="text-muted-foreground">
                          Payment of ₹{completedVendorPaymentData.amount.toLocaleString("en-IN")} recorded for {completedVendorPaymentData.vendorName}
                        </p>
                      </div>

                      <div className="w-full max-w-md bg-muted/30 p-6 rounded-lg border space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Date:</span>
                          <span className="font-medium">{completedVendorPaymentData.date}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Payment Method:</span>
                          <span className="font-medium capitalize">{completedVendorPaymentData.paymentMethod}</span>
                        </div>
                        <div className="my-2 border-t border-dashed" />
                        <div className="flex justify-between font-medium">
                          <span>Total Paid Now:</span>
                          <span>₹{completedVendorPaymentData.amount.toLocaleString("en-IN")}</span>
                        </div>
                      </div>

                      <div className="flex justify-center gap-3 w-full">
                        <Button variant="outline" onClick={() => {
                          resetVendorDialog();
                          setVendorDialogOpen(false);
                        }}>
                          Close
                        </Button>
                        <Button variant="outline" onClick={handlePrintVendorReceipt}>
                          <Printer className="mr-2 h-4 w-4" /> Print Receipt
                        </Button>
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
              <Card>
                <CardHeader>
                  <CardTitle>Vendor Balances</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vendor</TableHead>
                        <TableHead className="text-right">Total Purchases</TableHead>
                        <TableHead className="text-right">Total Paid</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vendorBalances.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            No vendor data available
                          </TableCell>
                        </TableRow>
                      ) : (
                        vendorBalances
                          .slice((vendorPage - 1) * ITEMS_PER_PAGE, vendorPage * ITEMS_PER_PAGE)
                          .map((vendor) => (
                            <TableRow key={vendor.id} data-testid={`row-vendor-${vendor.id}`}>
                              <TableCell className="font-medium">{vendor.name}</TableCell>
                              <TableCell className="text-right font-mono">
                                {vendor.totalPurchases.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {vendor.totalPayments.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                              </TableCell>
                              <TableCell className="text-right font-mono font-semibold">
                                {vendor.balance.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                              </TableCell>
                              <TableCell className="text-right space-x-2">
                                <Button
                                  size="sm"
                                  variant={vendor.balance > 0 ? "destructive" : "outline"}
                                  onClick={() => handleVendorPaymentClick(vendor.id)}
                                  className="h-8"
                                >
                                  <CreditCard className="mr-2 h-4 w-4" />
                                  Payment
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setVendorHistoryFilter(vendor.id);
                                    setVendorHistoryDialogOpen(true);
                                  }}
                                  className="h-8"
                                >
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Edit
                                </Button>

                              </TableCell>
                            </TableRow>
                          ))
                      )}
                    </TableBody>
                  </Table>

                  {vendorBalances.length > ITEMS_PER_PAGE && (
                    <div className="mt-4">
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious
                              onClick={() => setVendorPage(p => Math.max(1, p - 1))}
                              className={vendorPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                            />
                          </PaginationItem>
                          {Array.from({ length: Math.ceil(vendorBalances.length / ITEMS_PER_PAGE) }).map((_, i) => (
                            <PaginationItem key={i}>
                              <PaginationLink
                                isActive={vendorPage === i + 1}
                                onClick={() => setVendorPage(i + 1)}
                                className="cursor-pointer"
                              >
                                {i + 1}
                              </PaginationLink>
                            </PaginationItem>
                          ))}
                          <PaginationItem>
                            <PaginationNext
                              onClick={() => setVendorPage(p => Math.min(Math.ceil(vendorBalances.length / ITEMS_PER_PAGE), p + 1))}
                              className={vendorPage === Math.ceil(vendorBalances.length / ITEMS_PER_PAGE) ? "pointer-events-none opacity-50" : "cursor-pointer"}
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Dialog open={vendorHistoryDialogOpen} onOpenChange={setVendorHistoryDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[85vh] overflow-auto">
                  <DialogHeader>
                    <DialogTitle>
                      Payment History - {getVendorName(vendorHistoryFilter === "all" ? "" : vendorHistoryFilter)}
                    </DialogTitle>
                  </DialogHeader>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredVendorPayments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No payment history found</TableCell>
                        </TableRow>
                      ) : (
                        filteredVendorPayments.map(payment => (
                          <TableRow key={payment.id}>
                            <TableCell>{payment.date}</TableCell>
                            <TableCell>{getVendorName(payment.vendorId)}</TableCell>
                            <TableCell className="capitalize">{payment.paymentMethod}</TableCell>
                            <TableCell className="text-right font-mono flex items-center justify-end gap-2">
                              {payment.amount.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => {
                                  setEditingPayment({
                                    id: payment.id,
                                    type: 'vendor',
                                    amount: payment.amount.toString(),
                                    date: payment.date,
                                    method: payment.paymentMethod,
                                    notes: payment.notes || ""
                                  });
                                  setVendorHistoryDialogOpen(false);
                                }}
                              >
                                <Pencil className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                  <div className="flex justify-end mt-4">
                    {filteredVendorPayments.length > 0 && (
                      <Button variant="outline" onClick={handlePrintVendorReceipt}>
                        <Printer className="mr-2 h-4 w-4" /> Print History
                      </Button>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </TabsContent>

            <TabsContent value="customers" className="space-y-4">
              <div className="flex items-center space-x-2 mb-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search Customer..."
                    value={customerSearchQuery}
                    onChange={(e) => setCustomerSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>

              <Dialog open={customerDialogOpen} onOpenChange={handleCustomerDialogClose}>
                <DialogContent className="max-w-4xl max-h-[85vh] overflow-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {step === 'select' && 'Select Customer'}
                      {step === 'review' && `Review & Finalize - ${getCustomerName(selectedCustomer)}`}
                      {step === 'completed' && 'Payment Completed'}
                    </DialogTitle>
                    <DialogDescription>
                      {step === 'select' && 'Select a customer to view and edit their invoices'}
                      {step === 'review' && (customerSummary && customerSummary.totalPayments > 0
                        ? 'Review products taken and record remaining payment'
                        : 'Review invoice details, edit prices if needed, then finalize payment')}
                      {step === 'completed' && 'Payment has been recorded successfully'}
                    </DialogDescription>
                  </DialogHeader>

                  {step === 'select' && (
                    <div className="space-y-4 pt-4">
                      {loadingInvoices ? (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4 text-muted-foreground">
                          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                          <p>Loading customer details...</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Label>Customer</Label>
                          <Select value={selectedCustomer} onValueChange={handleCustomerSelect}>
                            <SelectTrigger data-testid="select-customer">
                              <SelectValue placeholder="Select customer" />
                            </SelectTrigger>
                            <SelectContent>
                              {customers.map((customer) => (
                                <SelectItem key={customer.id} value={customer.id}>
                                  {customer.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-sm text-muted-foreground">Select a customer to process payment</p>
                        </div>
                      )}
                    </div>
                  )}

                  {step === 'review' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setStep('select')}>
                            <X className="h-4 w-4 mr-1" /> Back
                          </Button>
                          <Badge variant="secondary" className="text-xs">{customerInvoices.length} Invoice(s)</Badge>
                        </div>
                        {customerSummary && (
                          <div className="flex items-center gap-3 text-sm">
                            <span className="text-muted-foreground font-medium">
                              Total: <span className="font-mono text-base text-foreground">{customerSummary.totalInvoices.toLocaleString("en-IN", { style: "currency", currency: "INR" })}</span>
                            </span>
                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded-md border border-green-200 shadow-sm flex items-center gap-1">
                              <span className="text-xs font-semibold uppercase">Paid:</span>
                              <span className="font-mono font-bold text-base">{customerSummary.totalPayments.toLocaleString("en-IN", { style: "currency", currency: "INR" })}</span>
                            </span>
                            <span className={`${customerSummary.remainingBalance > 0 ? "bg-yellow-100 text-yellow-800 border-yellow-200" : "bg-green-100 text-green-800 border-green-200"} px-2 py-1 rounded-md border shadow-sm flex items-center gap-1`}>
                              <span className="text-xs font-semibold uppercase">Due:</span>
                              <span className="font-mono font-bold text-base">{customerSummary.remainingBalance.toLocaleString("en-IN", { style: "currency", currency: "INR" })}</span>
                            </span>
                          </div>
                        )}
                      </div>

                      {customerSummary && customerSummary.totalPayments > 0 ? (
                        <div className="border rounded-md">
                          <div className="p-4 space-y-4">
                            <div className="text-sm text-muted-foreground mb-2">
                              Products taken by customer (read-only - already invoiced)
                            </div>
                            {customerInvoices.map((invoice) => (
                              <Card key={invoice.id} className="overflow-hidden" data-testid={`card-invoice-${invoice.id}`}>
                                <CardHeader className="py-2 bg-muted/30">
                                  <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <div className="flex items-center gap-2">
                                      <CardTitle className="text-sm">{invoice.invoiceNumber}</CardTitle>
                                      <Badge variant="secondary" className="text-xs">{invoice.date}</Badge>
                                      {invoice.shop && (
                                        <Badge variant="outline" className={`text-xs ${invoice.shop === 45 ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
                                          Shop {invoice.shop}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </CardHeader>
                                <CardContent className="p-3 space-y-2">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="text-xs">Product</TableHead>
                                        <TableHead className="text-xs text-center">Qty</TableHead>
                                        <TableHead className="text-xs text-right">Rate</TableHead>
                                        <TableHead className="text-xs text-right">Amount</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {invoice.items.map((item) => (
                                        <TableRow key={item.id}>
                                          <TableCell className="text-sm">{item.product?.name || 'Unknown'}</TableCell>
                                          <TableCell className="text-sm text-center">{item.quantity}</TableCell>
                                          <TableCell className="text-sm text-right font-mono">₹{item.unitPrice}</TableCell>
                                          <TableCell className="text-sm text-right font-mono">{item.total.toLocaleString("en-IN", { style: "currency", currency: "INR" })}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                  <div className="flex items-center justify-between pt-2 border-t text-sm">
                                    <span className="text-muted-foreground">
                                      Hamali: {invoice.bags || 0} bags × ₹{invoice.hamaliRatePerBag || 0} = <span className="font-mono">₹{invoice.hamaliChargeAmount || 0}</span>
                                    </span>
                                    <span className="font-semibold">
                                      Total: <span className="font-mono text-primary">{invoice.grandTotal.toLocaleString("en-IN", { style: "currency", currency: "INR" })}</span>
                                    </span>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="border rounded-md overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/40 uppercase text-xs hover:bg-muted/40">
                                <TableHead className="w-[50px] text-center font-bold text-black">S.No</TableHead>
                                <TableHead className="w-[100px] font-bold text-black">Date</TableHead>
                                <TableHead className="w-[140px] font-bold text-black">Invoice No</TableHead>
                                <TableHead className="w-[80px] text-center font-bold text-black">Shop</TableHead>
                                <TableHead className="min-w-[150px] font-bold text-black">Product</TableHead>
                                <TableHead className="w-[80px] text-center font-bold text-black">Qty</TableHead>
                                <TableHead className="w-[100px] text-center font-bold text-black">Price/Unit</TableHead>
                                <TableHead className="w-[200px] text-center font-bold text-black">Hamali Charge</TableHead>
                                <TableHead className="w-[120px] text-right font-bold text-black">Total</TableHead>
                                <TableHead className="w-[80px] text-center font-bold text-black">Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {customerInvoices.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                                    No invoices found for this customer
                                  </TableCell>
                                </TableRow>
                              ) : (
                                customerInvoices.map((invoice, index) => {
                                  const edited = editedInvoices[invoice.id];
                                  const items = invoice.items; // ALWAYS iterate over original items to ensure product data and IDs exist

                                  return items.map((item, itemIndex) => {
                                    const isFirstItem = itemIndex === 0;
                                    // Find the edited item to get current values
                                    const editedItem = edited?.items?.find(e => e.itemId === item.id);
                                    const quantity = editedItem?.quantity ?? item.quantity;
                                    const unitPrice = editedItem?.unitPrice ?? item.unitPrice;
                                    const total = editedItem?.total ?? item.total;

                                    const hamaliBags = edited?.bags || 0;
                                    const hamaliRate = edited?.ratePerBag || 0;
                                    const hamaliAmount = edited?.hamaliChargeAmount || invoice.hamaliChargeAmount || 0;
                                    const invoiceTotal = (edited?.items?.reduce((s, i) => s + i.total, 0) || invoice.subtotal) + hamaliAmount;

                                    return (
                                      <TableRow key={`${invoice.id}-${item.id}`} className={isFirstItem ? "border-t" : "border-0"}>
                                        {isFirstItem && (
                                          <>
                                            <TableCell rowSpan={items.length} className="text-center align-top border-r bg-muted/5">{index + 1}</TableCell>
                                            <TableCell rowSpan={items.length} className="align-top border-r bg-muted/5">
                                              <div className="font-semibold">{invoice.date}</div>
                                            </TableCell>
                                            <TableCell rowSpan={items.length} className="align-top border-r bg-muted/5">
                                              <div className="font-mono text-xs text-muted-foreground">{invoice.invoiceNumber}</div>
                                            </TableCell>
                                            <TableCell rowSpan={items.length} className="text-center align-top border-r bg-muted/5">
                                              {invoice.shop && (
                                                <Badge variant="outline" className={`text-xs ${invoice.shop === 45 ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
                                                  Shop {invoice.shop}
                                                </Badge>
                                              )}
                                            </TableCell>
                                          </>
                                        )}

                                        <TableCell className="align-top border-r">{item.product?.name || 'Unknown'}</TableCell>

                                        <TableCell className="text-center align-top border-r p-1">
                                          {/* Editable Quantity handled here if needed, but per request only Hamali is editable now, wait, previous instructions said make fields editable. But sticking to current state. */}
                                          {quantity}
                                        </TableCell>

                                        <TableCell className="text-center align-top border-r p-1">
                                          ₹{unitPrice}
                                        </TableCell>

                                        {isFirstItem && (
                                          <TableCell rowSpan={items.length} className="text-center align-top border-r bg-muted/5 p-2">
                                            <div className="flex flex-col gap-1 items-center">
                                              <div className="flex items-center gap-1 justify-center">
                                                <Input
                                                  type="number"
                                                  className="h-7 w-12 px-1 text-center"
                                                  value={hamaliBags || ''}
                                                  readOnly // Made read-only as per previous task
                                                  placeholder="Bags"
                                                />
                                                <span className="text-xs text-muted-foreground">×</span>
                                                <Input
                                                  type="number"
                                                  className="h-7 w-12 px-1 text-center"
                                                  value={hamaliRate || ''}
                                                  onChange={(e) => handleHamaliChange(invoice.id, 'ratePerBag', e.target.value)}
                                                  placeholder="Rate"
                                                />
                                                <span className="text-xs text-muted-foreground">=</span>
                                              </div>
                                              <div className="font-semibold text-xs">
                                                ₹{hamaliAmount}
                                              </div>
                                            </div>
                                          </TableCell>
                                        )}

                                        {isFirstItem && (
                                          <TableCell rowSpan={items.length} className="text-right align-top border-r font-mono font-bold bg-muted/5">
                                            ₹{invoiceTotal.toFixed(2)}
                                          </TableCell>
                                        )}

                                        {isFirstItem && (
                                          <TableCell rowSpan={items.length} className="text-center align-top bg-muted/5">
                                            <Badge variant={invoice.status === 'completed' ? 'default' : 'secondary'} className={invoice.status === 'completed' ? 'bg-green-500 hover:bg-green-600' : 'bg-yellow-500 hover:bg-yellow-600'}>
                                              {invoice.status === 'completed' ? 'Completed' : 'Pending'}
                                            </Badge>
                                          </TableCell>
                                        )}
                                      </TableRow>
                                    );
                                  });
                                })
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      )}

                      <div className="flex justify-between items-center bg-muted/50 p-4 rounded-lg">
                        <div className="text-sm font-medium">Grand Total (All Invoices):</div>
                        <div className="text-2xl font-bold font-mono">
                          {customerInvoices.reduce((sum, inv) => {
                            const edited = editedInvoices[inv.id];
                            const hamaliAmount = edited?.hamaliChargeAmount || inv.hamaliChargeAmount || 0;
                            const itemTotal = edited?.items?.reduce((s, i) => s + i.total, 0) || inv.subtotal;
                            return sum + itemTotal + hamaliAmount;
                          }, 0).toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                        </div>
                      </div>

                      {/* Remaining Balance Section */}
                      <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                        <div className="flex justify-between items-center text-yellow-800">
                          <div className="font-bold text-lg">Remaining Balance:</div>
                          <div className="text-xl font-bold font-mono">
                            {/* Dynamic Remaining Balance Calculation */}
                            {(customerInvoices.reduce((sum, inv) => {
                              const edited = editedInvoices[inv.id];
                              const hamaliAmount = edited?.hamaliChargeAmount || inv.hamaliChargeAmount || 0;
                              const itemTotal = edited?.items?.reduce((s, i) => s + i.total, 0) || inv.subtotal;
                              return sum + itemTotal + hamaliAmount;
                            }, 0) - (customerSummary?.totalPayments || 0)).toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2 bg-muted/20 p-4 rounded-lg">
                        <div className="space-y-2">
                          <Label>Payment Method</Label>
                          <Select value={customerPaymentMethod} onValueChange={setCustomerPaymentMethod}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cash">Cash</SelectItem>
                              <SelectItem value="bank">Bank Transfer</SelectItem>
                              <SelectItem value="upi">UPI</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Payment Amount (Enter amount to pay now)</Label>
                          <Input
                            type="number"
                            placeholder="Enter payment amount"
                            value={customerPaymentAmount}
                            onChange={(e) => setCustomerPaymentAmount(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 pt-4">
                        {completedPaymentData ? (
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => {
                              setCustomerPaymentAmount("");
                              setCompletedPaymentData(null);
                              setStep('select');
                            }}>
                              New Payment
                            </Button>
                            <Button variant="outline" size="sm" onClick={handlePrintReceipt}>
                              <Printer className="mr-2 h-4 w-4" /> Print Receipt
                            </Button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <Button variant="outline" onClick={() => handleCustomerDialogClose(false)}>
                              Cancel
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={handleSaveChanges}
                              disabled={saveInvoiceChanges.isPending}
                            >
                              <Save className="mr-2 h-4 w-4" /> Save Changes
                            </Button>
                            <Button
                              onClick={handleCustomerPaymentSubmit}
                              disabled={!customerPaymentAmount || Number(customerPaymentAmount) <= 0 || createCustomerPayment.isPending}
                              className={Number(customerPaymentAmount) > 0 ? "bg-green-600 hover:bg-green-700" : ""}
                            >
                              {createCustomerPayment.isPending ? "Processing..." : `PAID: ₹${Number(customerPaymentAmount || 0).toLocaleString("en-IN")}`}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {step === 'completed' && completedPaymentData && (
                    <div className="flex flex-col items-center justify-center py-8 space-y-4">
                      <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                        <CheckCircle className="h-8 w-8 text-green-600" />
                      </div>
                      <div className="text-center">
                        <h3 className="text-lg font-semibold">Payment Successful</h3>
                        <p className="text-muted-foreground">
                          Payment of {completedPaymentData.amount.toLocaleString("en-IN", { style: "currency", currency: "INR" })} has been recorded.
                        </p>
                      </div>
                      <div className="text-center">
                        <span className="font-medium font-mono text-xs text-muted-foreground">
                          Invoices: {completedPaymentData.invoices.map(inv => inv.invoiceNumber).join(', ')}
                        </span>
                      </div>
                      <div className="flex gap-4 pt-4">
                        <Button variant="outline" onClick={handlePrintReceipt}>
                          <Printer className="mr-2 h-4 w-4" /> Print Receipt
                        </Button>
                        <Button onClick={() => {
                          setStep('select');
                          setCompletedPaymentData(null);
                          setCustomerPaymentAmount("");
                          // queryClient.invalidateQueries({ queryKey: ["/api/reports/customer-balances"] });
                          handleCustomerDialogClose(false);
                        }}>
                          Done
                        </Button>
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>

              <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[85vh] overflow-auto">
                  <DialogHeader>
                    <DialogTitle>Payment History - {getCustomerName(historyCustomerFilter === "all" ? "" : historyCustomerFilter)}</DialogTitle>
                  </DialogHeader>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCustomerPayments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No payment history found</TableCell>
                        </TableRow>
                      ) : (
                        filteredCustomerPayments.map(payment => (
                          <TableRow key={payment.id}>
                            <TableCell>{payment.date}</TableCell>
                            <TableCell>{getCustomerName(payment.customerId)}</TableCell>
                            <TableCell className="capitalize">{payment.paymentMethod}</TableCell>
                            <TableCell className="text-right font-mono flex items-center justify-end gap-2">
                              {payment.amount.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => {
                                  setEditingPayment({
                                    id: payment.id,
                                    type: 'customer',
                                    amount: payment.amount.toString(),
                                    date: payment.date,
                                    method: payment.paymentMethod,
                                    notes: payment.notes || ""
                                  });
                                  setHistoryDialogOpen(false); // Close history so edit dialog can open (or keep open if stacked, but better to swap)
                                }}
                              >
                                <Pencil className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                  <div className="flex justify-end mt-4">
                    {filteredCustomerPayments.length > 0 && (
                      <Button variant="outline" onClick={printPaymentHistory}>
                        <Printer className="mr-2 h-4 w-4" /> Print History
                      </Button>
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              <Card>
                <CardHeader>
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <CardTitle>Customer Payment Details</CardTitle>
                    <div className="flex items-center gap-2">
                      <Label>From:</Label>
                      <Input type="date" className="w-[150px]" value={listDateFrom} onChange={(e) => setListDateFrom(e.target.value)} />
                      <Label>To:</Label>
                      <Input type="date" className="w-[150px]" value={listDateTo} onChange={(e) => setListDateTo(e.target.value)} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer Name</TableHead>
                        <TableHead className="text-right">Total Invoice</TableHead>
                        <TableHead className="text-right">Total Paid</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customerBalances
                        .filter(c => c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()))
                        .filter(c => c.balance > 0)
                        .slice((customerPage - 1) * ITEMS_PER_PAGE, customerPage * ITEMS_PER_PAGE)
                        .map((customer) => (
                          <TableRow key={customer.id} data-testid={`row-customer-${customer.id}`}>
                            <TableCell className="font-medium">{customer.name}</TableCell>
                            <TableCell className="text-right font-mono">
                              {customer.totalInvoices.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {(customerPaymentStats[customer.id] || 0).toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold">
                              {customer.balance.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                            </TableCell>
                            <TableCell className="text-right space-x-2">
                              <Button
                                size="sm"
                                variant={customer.balance > 0 ? "default" : "outline"}
                                className={customer.balance > 0 ? "bg-green-600 hover:bg-green-700" : ""}
                                onClick={() => handleCustomerPaymentClick(customer.id)}
                              >
                                <CreditCard className="mr-2 h-4 w-4" />
                                Payment
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setHistoryCustomerFilter(customer.id);
                                  setHistoryDialogOpen(true);
                                }}
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      {customerBalances.filter(c => c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) && c.balance > 0).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                            No customers found
                          </TableCell>
                        </TableRow>
                      )}

                      {customerBalances.filter(c => c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) && c.balance > 0).length > 0 && (
                        <TableRow className="bg-muted/50 font-bold border-t-2">
                          <TableCell>Total</TableCell>
                          <TableCell className="text-right font-mono">
                            {customerBalances
                              .filter(c => c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) && c.balance > 0)
                              .reduce((sum, c) => sum + c.totalInvoices, 0)
                              .toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {customerBalances
                              .filter(c => c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) && c.balance > 0)
                              .reduce((sum, c) => sum + (customerPaymentStats[c.id] || 0), 0)
                              .toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {customerBalances
                              .filter(c => c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) && c.balance > 0)
                              .reduce((sum, c) => sum + c.balance, 0)
                              .toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                          </TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>

                  {customerBalances.filter(c => c.name.toLowerCase().includes(customerSearchQuery.toLowerCase())).length > ITEMS_PER_PAGE && (
                    <div className="mt-4">
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious
                              onClick={() => setCustomerPage(p => Math.max(1, p - 1))}
                              className={customerPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                            />
                          </PaginationItem>
                          {/* We limit the number of page links shown to avoid clutter if too many pages. For now showing all for simplicity or simplified view */}
                          {/* Simplified pagination for potentially large lists: Just show Prev, Next and Current Page info, OR use ellipsis logic (complex to implement inline). 
                               I will implement a simple Previous | Page X of Y | Next for robustness if list is huge.
                               But User asked for pagination. I'll stick to simple numbered list for now, assuming not thousands of pages.
                           */}
                          <PaginationItem>
                            <span className="px-4 text-sm text-muted-foreground">
                              Page {customerPage} of {Math.ceil(customerBalances.filter(c => c.name.toLowerCase().includes(customerSearchQuery.toLowerCase())).length / ITEMS_PER_PAGE)}
                            </span>
                          </PaginationItem>

                          <PaginationItem>
                            <PaginationNext
                              onClick={() => setCustomerPage(p => Math.min(Math.ceil(customerBalances.filter(c => c.name.toLowerCase().includes(customerSearchQuery.toLowerCase())).length / ITEMS_PER_PAGE), p + 1))}
                              className={customerPage === Math.ceil(customerBalances.filter(c => c.name.toLowerCase().includes(customerSearchQuery.toLowerCase())).length / ITEMS_PER_PAGE) ? "pointer-events-none opacity-50" : "cursor-pointer"}
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>


          </Tabs>
        </TabsContent>
      </Tabs>
    </div >
  );
}
