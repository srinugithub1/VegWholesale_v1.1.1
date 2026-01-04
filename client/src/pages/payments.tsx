import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Plus, CreditCard, Wallet, Trash2, ChevronRight, Edit, Save, X, Printer, CheckCircle } from "lucide-react";
import type { Vendor, Customer, VendorPayment, CustomerPayment, HamaliCashPayment, Invoice, InvoiceItem, Product } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

type VendorWithBalance = Vendor & { totalPurchases: number; totalPayments: number; balance: number };
type CustomerWithBalance = Customer & { totalInvoices: number; totalPayments: number; balance: number };
type CustomerPaymentWithInvoice = CustomerPayment & { invoiceNumber?: string | null };

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

interface EditedInvoice {
  invoiceId: string;
  bags: number;
  ratePerBag: number;
  hamaliChargeAmount: number;
  items: EditedItem[];
}

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

  const [customerInvoices, setCustomerInvoices] = useState<InvoiceWithItems[]>([]);
  const [editedInvoices, setEditedInvoices] = useState<Record<string, EditedInvoice>>({});
  const [loadingInvoices, setLoadingInvoices] = useState(false);
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

  const { data: vendorPayments = [] } = useQuery<VendorPayment[]>({
    queryKey: ["/api/vendor-payments"],
  });

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

  const loadCustomerInvoices = async (customerId: string) => {
    setLoadingInvoices(true);
    try {
      const invoicesRes = await fetch(`/api/customers/${customerId}/invoices`);
      const data = await invoicesRes.json();
      const invoices: Invoice[] = data.invoices;
      const summary = data.summary;

      setCustomerSummary(summary);
      setCustomerPaymentAmount(summary.remainingBalance > 0 ? String(summary.remainingBalance) : "");

      const invoicesWithItems: InvoiceWithItems[] = await Promise.all(
        invoices.map(async (invoice) => {
          const itemsRes = await fetch(`/api/invoices/${invoice.id}/items`);
          const items: InvoiceItem[] = await itemsRes.json();
          const itemsWithProducts = items.map(item => ({
            ...item,
            product: products.find(p => p.id === item.productId),
          }));
          return {
            ...invoice,
            items: itemsWithProducts,
            originalSubtotal: invoice.subtotal,
            originalHamali: invoice.hamaliChargeAmount || 0,
            originalGrandTotal: invoice.grandTotal,
          };
        })
      );

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

  const createVendorPayment = useMutation({
    mutationFn: async (data: { vendorId: string; amount: number; paymentMethod: string; date: string }) => {
      return apiRequest("POST", "/api/vendor-payments", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor-payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/vendor-balances"] });
      setVendorDialogOpen(false);
      setSelectedVendor("");
      setVendorPaymentAmount("");
      toast({ title: "Payment recorded", description: "Vendor payment has been recorded successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to record payment.", variant: "destructive" });
    },
  });

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

    const totalHamali = completedPaymentData.invoices.reduce((sum, inv) => {
      const edited = completedPaymentData.editedInvoices[inv.id];
      return sum + (edited?.hamaliChargeAmount || inv.hamaliChargeAmount || 0);
    }, 0);

    const totalBags = completedPaymentData.invoices.reduce((sum, inv) => {
      const edited = completedPaymentData.editedInvoices[inv.id];
      return sum + (edited?.bags || 0);
    }, 0);

    const invoiceSubtotal = completedPaymentData.invoices.reduce((sum, inv) => {
      const edited = completedPaymentData.editedInvoices[inv.id];
      const itemsTotal = edited?.items.reduce((s, i) => s + i.total, 0) || inv.subtotal;
      return sum + itemsTotal;
    }, 0);

    const grandTotal = invoiceSubtotal + totalHamali;
    const amountPaid = completedPaymentData.amount;
    const totalPaidIncludingThis = completedPaymentData.previouslyPaid + amountPaid;
    const balanceRemaining = grandTotal - totalPaidIncludingThis;

    const invoiceDetails = completedPaymentData.invoices.map(inv => {
      const edited = completedPaymentData.editedInvoices[inv.id];
      const itemsHtml = inv.items.map(item => {
        const editedItem = edited?.items.find(e => e.itemId === item.id);
        const price = editedItem?.unitPrice ?? item.unitPrice;
        const total = editedItem?.total ?? item.total;
        return `
          <tr>
            <td style="padding: 6px 10px; border-bottom: 1px solid #e0e0e0;">${item.product?.name || 'Unknown'}</td>
            <td style="padding: 6px 10px; border-bottom: 1px solid #e0e0e0; text-align: center;">${item.quantity}</td>
            <td style="padding: 6px 10px; border-bottom: 1px solid #e0e0e0; text-align: right;">₹${price.toFixed(2)}</td>
            <td style="padding: 6px 10px; border-bottom: 1px solid #e0e0e0; text-align: right; font-weight: 500;">₹${total.toFixed(2)}</td>
          </tr>
        `;
      }).join('');

      const hamali = edited?.hamaliChargeAmount || inv.hamaliChargeAmount || 0;
      const bags = edited?.bags || 0;
      const subtotal = edited?.items.reduce((s, i) => s + i.total, 0) || inv.subtotal;

      return `
        <div style="margin-bottom: 15px; border: 1px solid #ddd; border-radius: 6px; overflow: hidden;">
          <div style="display: flex; justify-content: space-between; padding: 8px 12px; background: #f5f5f5; border-bottom: 1px solid #ddd;">
            <strong style="color: #333;">${inv.invoiceNumber}</strong>
            <span style="color: #666;">${inv.date}</span>
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="background: #fafafa;">
                <th style="padding: 8px 10px; text-align: left; font-weight: 600; color: #555;">Product</th>
                <th style="padding: 8px 10px; text-align: center; font-weight: 600; color: #555;">Qty</th>
                <th style="padding: 8px 10px; text-align: right; font-weight: 600; color: #555;">Rate</th>
                <th style="padding: 8px 10px; text-align: right; font-weight: 600; color: #555;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          <div style="padding: 10px 12px; background: #fafafa; border-top: 1px solid #e0e0e0;">
            <div style="display: flex; justify-content: space-between; font-size: 12px; color: #666; margin-bottom: 4px;">
              <span>Products Total:</span>
              <span>₹${subtotal.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; color: #666; margin-bottom: 4px;">
              <span>Hamali (${bags} bags):</span>
              <span>₹${hamali.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 600; color: #333; padding-top: 6px; border-top: 1px dashed #ddd;">
              <span>Invoice Total:</span>
              <span>₹${(subtotal + hamali).toFixed(2)}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    const paymentMethodLabel = {
      cash: 'CASH',
      bank: 'BANK TRANSFER',
      upi: 'UPI',
    }[completedPaymentData.paymentMethod] || completedPaymentData.paymentMethod.toUpperCase();

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
          <p class="business-name">VegWholesale Business</p>
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
          ${invoiceDetails}
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

  const handleVendorPayment = () => {
    if (!selectedVendor || !vendorPaymentAmount) return;
    createVendorPayment.mutate({
      vendorId: selectedVendor,
      amount: parseFloat(vendorPaymentAmount),
      paymentMethod: vendorPaymentMethod,
      date: new Date().toISOString().split("T")[0],
    });
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

  const getVendorName = (id: string) => vendors.find((v) => v.id === id)?.name || "Unknown";
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">
          Payments
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Vendor Outstanding
            </CardTitle>
            <Wallet className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono" data-testid="text-vendor-outstanding">
              {totalVendorOutstanding.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
            </div>
            <p className="text-xs text-muted-foreground">Amount to pay vendors</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Customer Receivable
            </CardTitle>
            <CreditCard className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono" data-testid="text-customer-receivable">
              {totalCustomerReceivable.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
            </div>
            <p className="text-xs text-muted-foreground">Amount to receive from customers</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="vendors" className="space-y-4">
        <TabsList>
          <TabsTrigger value="vendors" data-testid="tab-vendors">Vendor Payments</TabsTrigger>
          <TabsTrigger value="customers" data-testid="tab-customers">Customer Payments</TabsTrigger>
          <TabsTrigger value="hamali" data-testid="tab-hamali">Hamali Cash</TabsTrigger>
        </TabsList>

        <TabsContent value="vendors" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={vendorDialogOpen} onOpenChange={setVendorDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-vendor-payment">
                  <Plus className="h-4 w-4 mr-2" />
                  Record Payment
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Record Vendor Payment</DialogTitle>
                  <DialogDescription>Record a payment made to a vendor</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Vendor</Label>
                    <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                      <SelectTrigger data-testid="select-vendor">
                        <SelectValue placeholder="Select vendor" />
                      </SelectTrigger>
                      <SelectContent>
                        {vendors.map((vendor) => (
                          <SelectItem key={vendor.id} value={vendor.id}>
                            {vendor.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Amount</Label>
                    <Input
                      type="number"
                      value={vendorPaymentAmount}
                      onChange={(e) => setVendorPaymentAmount(e.target.value)}
                      placeholder="Enter amount"
                      data-testid="input-vendor-payment-amount"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Payment Method</Label>
                    <Select value={vendorPaymentMethod} onValueChange={setVendorPaymentMethod}>
                      <SelectTrigger data-testid="select-payment-method">
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
                  <Button
                    onClick={handleVendorPayment}
                    disabled={!selectedVendor || !vendorPaymentAmount || createVendorPayment.isPending}
                    className="w-full"
                    data-testid="button-submit-vendor-payment"
                  >
                    {createVendorPayment.isPending ? "Recording..." : "Record Payment"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendorBalances.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No vendor data available
                      </TableCell>
                    </TableRow>
                  ) : (
                    vendorBalances.map((vendor) => (
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
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
            </CardHeader>
            <CardContent>
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
                  {vendorPayments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No payment history
                      </TableCell>
                    </TableRow>
                  ) : (
                    vendorPayments.map((payment) => (
                      <TableRow key={payment.id} data-testid={`row-payment-${payment.id}`}>
                        <TableCell>{payment.date}</TableCell>
                        <TableCell>{getVendorName(payment.vendorId)}</TableCell>
                        <TableCell className="capitalize">{payment.paymentMethod}</TableCell>
                        <TableCell className="text-right font-mono">
                          {payment.amount.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={customerDialogOpen} onOpenChange={handleCustomerDialogClose}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-customer-payment">
                  <Plus className="h-4 w-4 mr-2" />
                  Record Payment
                </Button>
              </DialogTrigger>
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
                    </div>
                    {loadingInvoices && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Skeleton className="h-4 w-4 animate-spin rounded-full" />
                        Loading invoices...
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
                        <Badge variant="outline">{customerInvoices.length} Invoice(s)</Badge>
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
                                const totals = getInvoiceTotal(invoice.id);
                                const editedItems = invoice.items.map(item => {
                                  const eItem = edited?.items.find(e => e.itemId === item.id);
                                  return {
                                    ...item,
                                    currentPrice: eItem?.unitPrice ?? item.unitPrice,
                                    currentTotal: eItem?.total ?? item.total
                                  };
                                });

                                return (
                                  <TableRow key={invoice.id} className="hover:bg-muted/5">
                                    <TableCell className="text-center font-medium">{index + 1}</TableCell>
                                    <TableCell className="text-xs">{invoice.date}</TableCell>
                                    <TableCell className="text-xs font-medium">{invoice.invoiceNumber}</TableCell>
                                    <TableCell className="text-center">
                                      {invoice.shop && (
                                        <Badge variant="outline" className={`text-[10px] px-1 py-0 ${invoice.shop === 45 ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                                          Shop {invoice.shop}
                                        </Badge>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex flex-col gap-1">
                                        {editedItems.map(item => (
                                          <div key={item.id} className="text-sm truncate h-7 flex items-center" title={item.product?.name}>
                                            {item.product?.name || 'Unknown'}
                                          </div>
                                        ))}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex flex-col gap-1 items-center">
                                        {editedItems.map(item => (
                                          <div key={item.id} className="text-sm h-7 flex items-center">
                                            {item.quantity}
                                          </div>
                                        ))}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex flex-col gap-1 items-center">
                                        {editedItems.map(item => (
                                          <div key={item.id} className="h-7 flex items-center">
                                            <span className="text-sm">
                                              {item.currentPrice}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center justify-center gap-1">
                                        <Input
                                          type="number"
                                          className="h-7 w-14 text-center text-sm px-1"
                                          value={edited?.bags ?? 0}
                                          onChange={(e) => updateHamaliBags(invoice.id, parseInt(e.target.value) || 0)}
                                          placeholder="B"
                                          title="Bags"
                                        />
                                        <span className="text-xs text-muted-foreground">×</span>
                                        <Input
                                          type="number"
                                          className="h-7 w-14 text-center text-sm px-1"
                                          value={edited?.ratePerBag ?? 0}
                                          onChange={(e) => updateHamaliRate(invoice.id, parseFloat(e.target.value) || 0)}
                                          placeholder="Rate"
                                          title="Rate/Bag"
                                        />
                                        <span className="text-xs text-muted-foreground">=</span>
                                        <div className="min-w-[40px] text-right font-mono text-sm font-medium">
                                          {(edited?.hamaliChargeAmount ?? 0).toFixed(0)}
                                        </div>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right font-bold text-sm">
                                      {totals.grandTotal.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <Badge variant={invoice.status === 'completed' ? 'default' : 'outline'} className="text-[10px] capitalize">
                                        {invoice.status}
                                      </Badge>
                                    </TableCell>
                                  </TableRow>
                                );
                              })
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-base text-muted-foreground">Grand Total (All Invoices):</span>
                        <span className="text-lg font-bold font-mono" data-testid="text-grand-total">
                          {grandTotalAllInvoices.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                        </span>
                      </div>
                      {customerSummary && customerSummary.totalPayments > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-base text-muted-foreground">Already Paid:</span>
                          <span className="text-lg font-mono text-green-600">
                            -{customerSummary.totalPayments.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between border-t pt-2 bg-yellow-50 p-3 rounded-md border-yellow-100 shadow-sm mt-2">
                        <span className="text-lg font-bold text-yellow-900">Remaining Balance:</span>
                        <span className={`text-3xl font-bold font-mono ${customerSummary && customerSummary.remainingBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {(customerSummary?.remainingBalance ?? grandTotalAllInvoices).toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2 bg-yellow-50/50 p-2 rounded-md">
                        <Label className="font-semibold text-foreground">Payment Method</Label>
                        <Select value={customerPaymentMethod} onValueChange={setCustomerPaymentMethod}>
                          <SelectTrigger data-testid="select-customer-payment-method">
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
                      <div className="space-y-2 bg-yellow-50/50 p-2 rounded-md">
                        <Label className="font-semibold text-foreground">Payment Amount (Enter amount to pay now)</Label>
                        <Input
                          type="number"
                          value={customerPaymentAmount}
                          onChange={(e) => setCustomerPaymentAmount(e.target.value)}
                          placeholder={`Max: ${(customerSummary?.remainingBalance ?? grandTotalAllInvoices).toLocaleString("en-IN")}`}
                          data-testid="input-customer-payment-amount"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {(!customerSummary || customerSummary.totalPayments === 0) && (
                        <Button
                          variant="outline"
                          onClick={() => saveInvoiceChanges.mutate()}
                          disabled={saveInvoiceChanges.isPending}
                          className="flex-1"
                          data-testid="button-save-changes"
                        >
                          <Save className="h-4 w-4 mr-2" />
                          {saveInvoiceChanges.isPending ? "Saving..." : "Save Changes Only"}
                        </Button>
                      )}
                      <Button
                        onClick={handleFinalizeAndPay}
                        disabled={customerInvoices.length === 0 || createCustomerPayment.isPending || saveInvoiceChanges.isPending}
                        className="flex-1"
                        data-testid="button-finalize-payment"
                      >
                        {createCustomerPayment.isPending ? "Processing..." : "Finalize & Record Payment"}
                      </Button>
                    </div>
                  </div>
                )}


                {step === 'completed' && completedPaymentData && (
                  <ScrollArea className="flex-1">
                    <div className="flex flex-col items-center justify-center space-y-6 py-6 px-4">
                      <div className="rounded-full bg-primary/10 p-4">
                        <CheckCircle className="h-12 w-12 text-primary" />
                      </div>

                      <div className="text-center space-y-1">
                        <h3 className="text-lg font-semibold">Payment Recorded Successfully</h3>
                        <p className="text-sm text-muted-foreground">
                          Payment of {completedPaymentData.amount.toLocaleString("en-IN", { style: "currency", currency: "INR" })} received from {completedPaymentData.customerName}
                        </p>
                      </div>

                      <Card className="w-full max-w-sm">
                        <CardContent className="pt-4 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Customer:</span>
                            <span className="font-medium">{completedPaymentData.customerName}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Date:</span>
                            <span className="font-medium">{completedPaymentData.date}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Method:</span>
                            <span className="font-medium capitalize">{completedPaymentData.paymentMethod}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Invoice{completedPaymentData.invoices.length > 1 ? 's' : ''}:</span>
                            <span className="font-medium font-mono text-xs">
                              {completedPaymentData.invoices.map(inv => inv.invoiceNumber).join(', ')}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm border-t pt-2">
                            <span className="text-muted-foreground">Total Bags:</span>
                            <span className="font-medium font-mono">
                              {completedPaymentData.invoices.reduce((sum, inv) => {
                                const edited = completedPaymentData.editedInvoices[inv.id];
                                return sum + (edited?.bags || 0);
                              }, 0)}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Total Hamali:</span>
                            <span className="font-medium font-mono">
                              {completedPaymentData.invoices.reduce((sum, inv) => {
                                const edited = completedPaymentData.editedInvoices[inv.id];
                                return sum + (edited?.hamaliChargeAmount || inv.hamaliChargeAmount || 0);
                              }, 0).toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm border-t pt-2">
                            <span className="text-muted-foreground">Grand Total:</span>
                            <span className="font-medium font-mono">
                              {completedPaymentData.grandTotal.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                            </span>
                          </div>
                          {completedPaymentData.previouslyPaid > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Previously Paid:</span>
                              <span className="font-medium font-mono text-green-600">
                                -{completedPaymentData.previouslyPaid.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">This Payment:</span>
                            <span className="font-medium font-mono text-primary">
                              {completedPaymentData.amount.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                            </span>
                          </div>
                          <div className="flex justify-between border-t pt-2">
                            <span className="font-medium">Remaining Balance:</span>
                            <span className={`text-lg font-bold font-mono ${(completedPaymentData.grandTotal - completedPaymentData.previouslyPaid - completedPaymentData.amount) > 0 ? 'text-destructive' : 'text-primary'}`}>
                              {(completedPaymentData.grandTotal - completedPaymentData.previouslyPaid - completedPaymentData.amount).toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                            </span>
                          </div>
                        </CardContent>
                      </Card>

                      <div className="flex gap-3">
                        <Button
                          variant="outline"
                          onClick={handlePrintReceipt}
                          data-testid="button-print-receipt"
                        >
                          <Printer className="h-4 w-4 mr-2" />
                          Print Receipt
                        </Button>
                        <Button
                          onClick={() => handleCustomerDialogClose(false)}
                          data-testid="button-close-payment"
                        >
                          Done
                        </Button>
                      </div>
                    </div>
                  </ScrollArea>
                )}
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Customer Balances</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Total Invoices</TableHead>
                    <TableHead className="text-right">Total Paid</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customerBalances.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No customer data available
                      </TableCell>
                    </TableRow>
                  ) : (
                    customerBalances.map((customer) => (
                      <TableRow key={customer.id} data-testid={`row-customer-${customer.id}`}>
                        <TableCell className="font-medium">{customer.name}</TableCell>
                        <TableCell className="text-right font-mono">
                          {customer.totalInvoices.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {customer.totalPayments.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          {customer.balance.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <CardTitle>Payment History</CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={historyCustomerFilter} onValueChange={setHistoryCustomerFilter}>
                  <SelectTrigger className="w-48" data-testid="select-history-customer">
                    <SelectValue placeholder="Filter by customer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Customers</SelectItem>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => printPaymentHistory()}
                  disabled={filteredCustomerPayments.length === 0}
                  data-testid="button-print-payment-history"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomerPayments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No payment history
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCustomerPayments.map((payment) => (
                      <TableRow key={payment.id} data-testid={`row-customer-payment-${payment.id}`}>
                        <TableCell>{payment.date}</TableCell>
                        <TableCell>{getCustomerName(payment.customerId)}</TableCell>
                        <TableCell>
                          {payment.invoiceNumber ? (
                            <Badge variant="outline" className="font-mono text-xs">
                              {payment.invoiceNumber}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="capitalize">{payment.paymentMethod}</TableCell>
                        <TableCell className="text-right font-mono">
                          {payment.amount.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent >

        <TabsContent value="hamali" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={hamaliDialogOpen} onOpenChange={setHamaliDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-hamali-payment">
                  <Plus className="h-4 w-4 mr-2" />
                  Record Hamali Cash
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Record Hamali Cash Payment</DialogTitle>
                  <DialogDescription>Record direct cash given for Hamali (not through invoice)</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Amount</Label>
                    <Input
                      type="number"
                      value={hamaliAmount}
                      onChange={(e) => setHamaliAmount(e.target.value)}
                      placeholder="Enter amount"
                      data-testid="input-hamali-amount"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Customer (Optional)</Label>
                    <Select value={hamaliCustomerId} onValueChange={setHamaliCustomerId}>
                      <SelectTrigger data-testid="select-hamali-customer">
                        <SelectValue placeholder="Select customer (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No customer</SelectItem>
                        {customers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Notes (Optional)</Label>
                    <Input
                      value={hamaliNotes}
                      onChange={(e) => setHamaliNotes(e.target.value)}
                      placeholder="Add notes"
                      data-testid="input-hamali-notes"
                    />
                  </div>
                  <Button
                    onClick={handleHamaliPayment}
                    disabled={!hamaliAmount || createHamaliCashPayment.isPending}
                    className="w-full"
                    data-testid="button-submit-hamali-payment"
                  >
                    {createHamaliCashPayment.isPending ? "Recording..." : "Record Payment"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Direct Hamali Cash Payments</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hamaliCashPayments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No direct Hamali cash payments recorded
                      </TableCell>
                    </TableRow>
                  ) : (
                    hamaliCashPayments.map((payment) => (
                      <TableRow key={payment.id} data-testid={`row-hamali-payment-${payment.id}`}>
                        <TableCell>{payment.date}</TableCell>
                        <TableCell>{payment.customerId ? getCustomerName(payment.customerId) : "-"}</TableCell>
                        <TableCell className="text-muted-foreground">{payment.notes || "-"}</TableCell>
                        <TableCell className="text-right font-mono">
                          {payment.amount.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteHamaliCashPayment.mutate(payment.id)}
                            disabled={deleteHamaliCashPayment.isPending}
                            data-testid={`button-delete-hamali-${payment.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {hamaliCashPayments.length > 0 && (
                <div className="mt-4 pt-4 border-t flex justify-between items-center">
                  <span className="text-muted-foreground">Total Direct Hamali Cash:</span>
                  <span className="text-xl font-bold font-mono" data-testid="text-hamali-cash-total">
                    {hamaliCashPayments.reduce((sum, p) => sum + p.amount, 0).toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs >
    </div >
  );
}
