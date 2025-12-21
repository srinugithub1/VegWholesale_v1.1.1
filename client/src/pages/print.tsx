import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Printer, FileText, Truck } from "lucide-react";
import type { Invoice, InvoiceItem, Customer, Product, CompanySettings, Vehicle, Vendor } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

export default function PrintCenter() {
  const [selectedInvoice, setSelectedInvoice] = useState<string>("");
  const [documentType, setDocumentType] = useState<"invoice" | "challan">("invoice");

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: vehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  const { data: companySettings } = useQuery<CompanySettings | null>({
    queryKey: ["/api/company-settings"],
  });

  const { data: invoiceItems = [] } = useQuery<InvoiceItem[]>({
    queryKey: ["/api/invoices", selectedInvoice, "items"],
    enabled: !!selectedInvoice,
  });

  const getCustomerName = (id: string) => customers.find((c) => c.id === id)?.name || "Unknown";
  const getCustomer = (id: string) => customers.find((c) => c.id === id);
  const getProductName = (id: string) => products.find((p) => p.id === id)?.name || "Unknown";
  const getProductUnit = (id: string) => products.find((p) => p.id === id)?.unit || "";
  const getVehicle = (id: string | null) => id ? vehicles.find((v) => v.id === id) : null;
  const getVendor = (id: string | null) => id ? vendors.find((v) => v.id === id) : null;

  const selectedInvoiceData = invoices.find((i) => i.id === selectedInvoice);
  const customer = selectedInvoiceData ? getCustomer(selectedInvoiceData.customerId) : null;
  const vehicle = selectedInvoiceData ? getVehicle(selectedInvoiceData.vehicleId) : null;
  const vendor = selectedInvoiceData 
    ? (getVendor(selectedInvoiceData.vendorId) || (vehicle ? getVendor(vehicle.vendorId) : null))
    : null;

  const handlePrint = () => {
    window.print();
  };

  if (invoicesLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
      <div className="flex items-center justify-between gap-4 flex-wrap print:hidden">
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">
          Print Center
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden">
        <div className="space-y-2">
          <Label>Document Type</Label>
          <Select value={documentType} onValueChange={(v) => setDocumentType(v as "invoice" | "challan")}>
            <SelectTrigger data-testid="select-document-type">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="invoice">Tax Invoice</SelectItem>
              <SelectItem value="challan">Delivery Challan</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Select Invoice</Label>
          <Select value={selectedInvoice} onValueChange={setSelectedInvoice}>
            <SelectTrigger data-testid="select-invoice">
              <SelectValue placeholder="Select invoice" />
            </SelectTrigger>
            <SelectContent>
              {invoices.map((invoice) => (
                <SelectItem key={invoice.id} value={invoice.id}>
                  {invoice.invoiceNumber} - {getCustomerName(invoice.customerId)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 flex items-end">
          <Button onClick={handlePrint} disabled={!selectedInvoice} data-testid="button-print">
            <Printer className="h-4 w-4 mr-2" />
            Print Document
          </Button>
        </div>
      </div>

      {selectedInvoiceData && (
        <Card className="print:shadow-none print:border-none">
          <CardContent className="p-8">
            <div className="border border-border rounded-md p-6 space-y-6">
              <div className="flex justify-between items-start border-b border-border pb-4">
                <div>
                  <h2 className="text-xl font-bold" data-testid="text-company-name">
                    {companySettings?.name || "VegWholesale"}
                  </h2>
                  {companySettings?.address && (
                    <p className="text-sm text-muted-foreground">{companySettings.address}</p>
                  )}
                  {companySettings?.phone && (
                    <p className="text-sm text-muted-foreground">Phone: {companySettings.phone}</p>
                  )}
                  {companySettings?.gstNumber && (
                    <p className="text-sm font-medium">GSTIN: {companySettings.gstNumber}</p>
                  )}
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2 justify-end mb-2">
                    {documentType === "invoice" ? (
                      <FileText className="h-5 w-5" />
                    ) : (
                      <Truck className="h-5 w-5" />
                    )}
                    <h3 className="text-lg font-bold uppercase">
                      {documentType === "invoice" ? "Tax Invoice" : "Delivery Challan"}
                    </h3>
                  </div>
                  <p className="text-sm">
                    <span className="font-medium">No:</span> {selectedInvoiceData.invoiceNumber}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Date:</span> {selectedInvoiceData.date}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-semibold mb-1 uppercase text-muted-foreground">Bill To</h4>
                  <div className="border border-border rounded-md p-3">
                    <p className="font-medium">{customer?.name}</p>
                    {customer?.address && (
                      <p className="text-sm text-muted-foreground">{customer.address}</p>
                    )}
                    {customer?.phone && (
                      <p className="text-sm text-muted-foreground">Phone: {customer.phone}</p>
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold mb-1 uppercase text-muted-foreground">Source Details</h4>
                  <div className="border border-border rounded-md p-3">
                    {vehicle && (
                      <p className="text-sm">
                        <span className="font-medium">Vehicle:</span> {vehicle.number}
                      </p>
                    )}
                    {vendor && (
                      <p className="text-sm">
                        <span className="font-medium">Vendor:</span> {vendor.name}
                      </p>
                    )}
                    {!vehicle && !vendor && (
                      <p className="text-sm text-muted-foreground">-</p>
                    )}
                  </div>
                </div>
              </div>
              {documentType === "challan" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-semibold mb-1 uppercase text-muted-foreground">Ship To</h4>
                    <div className="border border-border rounded-md p-3">
                      <p className="font-medium">{customer?.name}</p>
                      {customer?.address && (
                        <p className="text-sm text-muted-foreground">{customer.address}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="border border-border px-3 py-2 text-left text-sm font-semibold">#</th>
                      <th className="border border-border px-3 py-2 text-left text-sm font-semibold">Item</th>
                      <th className="border border-border px-3 py-2 text-right text-sm font-semibold">Qty</th>
                      <th className="border border-border px-3 py-2 text-right text-sm font-semibold">Unit</th>
                      {documentType === "invoice" && (
                        <>
                          <th className="border border-border px-3 py-2 text-right text-sm font-semibold">Rate</th>
                          <th className="border border-border px-3 py-2 text-right text-sm font-semibold">Amount</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceItems.map((item, idx) => (
                      <tr key={item.id}>
                        <td className="border border-border px-3 py-2 text-sm">{idx + 1}</td>
                        <td className="border border-border px-3 py-2 text-sm">{getProductName(item.productId)}</td>
                        <td className="border border-border px-3 py-2 text-right text-sm font-mono">{item.quantity}</td>
                        <td className="border border-border px-3 py-2 text-right text-sm">{getProductUnit(item.productId)}</td>
                        {documentType === "invoice" && (
                          <>
                            <td className="border border-border px-3 py-2 text-right text-sm font-mono">
                              {item.unitPrice.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                            </td>
                            <td className="border border-border px-3 py-2 text-right text-sm font-mono">
                              {item.total.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {documentType === "invoice" && (
                <div className="flex justify-end">
                  <div className="w-64 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal</span>
                      <span className="font-mono">
                        {selectedInvoiceData.subtotal.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                      </span>
                    </div>
                    {selectedInvoiceData.includeHamaliCharge && (
                      <div className="flex justify-between text-sm">
                        <span>Hamali Charge ({selectedInvoiceData.totalKgWeight || 0} KG x {selectedInvoiceData.hamaliRatePerKg || 0}/KG)</span>
                        <span className="font-mono">
                          {(selectedInvoiceData.hamaliChargeAmount || 0).toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-base font-bold border-t border-border pt-2 mt-2">
                      <span>Grand Total</span>
                      <span className="font-mono">
                        {selectedInvoiceData.grandTotal.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-8 pt-8 mt-8 border-t border-border">
                <div className="text-center">
                  <div className="h-16"></div>
                  <p className="text-sm border-t border-border pt-2">Customer Signature</p>
                </div>
                <div className="text-center">
                  <div className="h-16"></div>
                  <p className="text-sm border-t border-border pt-2">Authorized Signature</p>
                </div>
              </div>

              {companySettings?.bankDetails && documentType === "invoice" && (
                <div className="text-sm text-muted-foreground border-t border-border pt-4">
                  <p className="font-medium mb-1">Bank Details:</p>
                  <p className="whitespace-pre-wrap">{companySettings.bankDetails}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {!selectedInvoice && (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Select an invoice to preview and print
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
