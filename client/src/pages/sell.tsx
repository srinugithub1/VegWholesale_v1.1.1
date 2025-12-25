import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useShop } from "@/hooks/use-shop";
// ... (existing imports stay conceptually, but I need to target the block correctly)

// I will target the imports area first to add Switch and Label, then the UI part.
// Actually replace_file_content replaces a contiguous block. I can't do two separate places in one call unless I replace everything in between, which is too huge.
// I will use multi_replace_file_content.

import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Truck, Plus, Package, X, Check, Minus, Weight, ShoppingBag, Scale, Plug, Unplug, Printer, Share2 } from "lucide-react";
import { useScale } from "@/hooks/use-scale";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Vehicle, Product, VehicleInventory, Vendor, Customer, Invoice } from "@shared/schema";
import { format } from "date-fns";

const productItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().min(0),
  bags: z.number().min(0).optional(),
});

const vehicleFormSchema = z.object({
  vehicleNumber: z.string().min(1, "Vehicle number is required"),
  vehicleType: z.string().min(1, "Vehicle type is required"),
  capacity: z.string().optional(),
  driverName: z.string().optional(),
  driverPhone: z.string().optional(),
  vendorId: z.string().optional(),
  newVendorName: z.string().optional(),
});

interface NewProduct {
  name: string;
  unit: string;
  purchasePrice: number;
  quantity: number;
  bags: number;
}

type ProductItem = z.infer<typeof productItemSchema>;
type VehicleFormValues = z.infer<typeof vehicleFormSchema>;

interface SaleProduct {
  productId: string;
  productName: string;
  unit: string;
  weight: number;
  bags: number;
  price: number;
  available: number;
}

interface SaleDraft {
  products: SaleProduct[];
  customerName: string;
  customerPhone: string;
  selectedCustomerId: string;
  hamaliCharge: number;
  hamaliRatePerBag: number;
}

interface VehicleSalePaneProps {
  vehicle: Vehicle;
  inventory: VehicleInventory[];
  products: Product[];
  customers: Customer[];
  vendors: Vendor[];
  draft: SaleDraft;
  onUpdateDraft: (draft: SaleDraft) => void;
  onClose: () => void;
  onSaleComplete: (invoice: Invoice) => void;
  currentWeight: number | null;
  rawWeight: number | null;
  isScaleConnected: boolean;
}

function VehicleSalePane({
  vehicle,
  inventory,
  products,
  customers,
  vendors,
  draft,
  onUpdateDraft,
  onClose,
  onSaleComplete,
  currentWeight,
  rawWeight,
  isScaleConnected
}: VehicleSalePaneProps) {
  const { toast } = useToast();
  const [errors, setErrors] = useState<{ customer?: string; products?: Record<string, { price?: string }> }>({});

  const validateForm = () => {
    const newErrors: { customer?: string; products?: Record<string, { price?: string }> } = {};
    let isValid = true;

    if ((!draft.selectedCustomerId || (draft.selectedCustomerId === "new" && !draft.customerName.trim())) && !draft.customerName.trim()) {
      newErrors.customer = "Customer is required";
      isValid = false;
    }

    const productErrors: Record<string, { price?: string }> = {};
    draft.products.forEach(p => {
      if (p.weight > 0 && (!p.price || p.price <= 0)) {
        productErrors[p.productId] = { price: "Price required" };
        isValid = false;
      }
    });

    if (Object.keys(productErrors).length > 0) {
      newErrors.products = productErrors;
    }

    setErrors(newErrors);
    return isValid;
  };

  const availableProducts = useMemo(() => {
    return inventory
      .filter(inv => inv.quantity > 0)
      .map(inv => {
        const product = products.find(p => p.id === inv.productId);
        const draftProduct = draft.products.find(p => p.productId === inv.productId);
        return {
          ...inv,
          product,
          weight: draftProduct?.weight || 0,
          price: draftProduct?.price || product?.salePrice || 0,
        };
      })
      .filter(item => item.product);
  }, [inventory, products, draft.products]);

  const updateProductField = (productId: string, field: 'weight' | 'bags' | 'price', value: number) => {
    const exists = draft.products.find(p => p.productId === productId);
    const product = products.find(p => p.id === productId);
    const inv = inventory.find(i => i.productId === productId);

    if (!product || !inv) return;

    let newProducts: SaleProduct[];
    if (exists) {
      newProducts = draft.products.map(p =>
        p.productId === productId ? { ...p, [field]: Math.max(0, value) } : p
      );
    } else {
      newProducts = [...draft.products, {
        productId,
        productName: product.name,
        unit: product.unit || "Units",
        weight: field === 'weight' ? value : 0,
        bags: field === 'bags' ? value : 0,
        price: field === 'price' ? value : (product.salePrice || 0),
        available: inv.quantity,
      }];
    }

    const newTotalBags = newProducts.reduce((sum, p) => sum + (p.bags || 0), 0);
    const newHamaliCharge = newTotalBags * draft.hamaliRatePerBag;

    onUpdateDraft({
      ...draft,
      products: newProducts,
      hamaliCharge: newHamaliCharge,
    });
  };

  const accumulateWeightAndBags = async (productId: string, weightToAdd: number) => {
    const exists = draft.products.find(p => p.productId === productId);
    const product = products.find(p => p.id === productId);
    const inv = inventory.find(i => i.productId === productId);

    if (!product || !inv) return;

    // Calculate weight difference for tracking (Gain/Loss)
    // weightToAdd is the ROUNDED weight from currentWeight
    // We need the RAW weight to compare.
    // Since we don't pass rawWeight here directly in the current signature, 
    // we should ideally pass it from the button click.
    // However, to avoid changing too much, let's assume `weightToAdd` IS `currentWeight` (rounded).
    // But we need `rawWeight`.
    // The cleaner way is to update the signature or access it from props if available.
    // But accessing props inside this function which is inside component is fine if `rawWeight` is passed to VehicleSalePane.

    // NOTE: I need to update VehicleSalePane props to accept rawWeight first.
    // For now, I will modify the logic assuming specific Gain/Loss logic requested by user:
    // Gain: rounded UP (e.g. 1.8 -> 2.0). Diff is +0.2
    // Loss: rounded DOWN (e.g. 1.7 -> 1.0). Diff is -0.7
    // User wants to store POSITIVE diff (0.2) in GAIN field.
    // And POSITIVE value (0.7) in LOSS field (implied, or just negative).
    // "1st field stores 1.800 to 2.000 increase(weight) values"
    // "2nd field stores 1.799 to 1.000 decrease values(weight)"

    // I will trigger the calculation here.
    // But wait, I need the RAW weight.
    // I will invoke a callback/mutation or passed function to handle the vehicle update.
    // Let's postpone the DB update logic to `onAccumulate` prop if I can refactor,
    // OR just use `apiRequest` here if I have vehicleId.

    let newProducts: SaleProduct[];
    if (exists) {
      newProducts = draft.products.map(p =>
        p.productId === productId ? {
          ...p,
          weight: p.weight + weightToAdd,
          bags: (p.bags || 0) + 1
        } : p
      );
    } else {
      newProducts = [...draft.products, {
        productId,
        productName: product.name,
        unit: product.unit || "Units",
        weight: weightToAdd,
        bags: 1,
        price: product.salePrice || 0,
        available: inv.quantity,
      }];
    }

    const newTotalBags = newProducts.reduce((sum, p) => sum + (p.bags || 0), 0);
    const newHamaliCharge = newTotalBags * draft.hamaliRatePerBag;

    onUpdateDraft({
      ...draft,
      products: newProducts,
      hamaliCharge: newHamaliCharge,
    });
  };

  const handleCustomerChange = (value: string) => {
    if (value === "new") {
      onUpdateDraft({ ...draft, selectedCustomerId: "new", customerName: "", customerPhone: "" });
    } else {
      const customer = customers.find(c => c.id === value);
      onUpdateDraft({
        ...draft,
        selectedCustomerId: value,
        customerName: customer?.name || "",
        customerPhone: customer?.phone || ""
      });
    }
  };

  const saleTotalWeight = useMemo(() => {
    return draft.products.reduce((sum, p) => sum + p.weight, 0);
  }, [draft.products]);

  const saleTotalBags = useMemo(() => {
    return draft.products.reduce((sum, p) => sum + (p.bags || 0), 0);
  }, [draft.products]);

  const saleSubtotal = useMemo(() => {
    return draft.products.reduce((sum, p) => sum + (p.weight * p.price), 0);
  }, [draft.products]);

  const createSaleMutation = useMutation({
    mutationKey: ['/api/invoices', 'create', vehicle.id],
    mutationFn: async () => {
      if (draft.products.length === 0) {
        throw new Error("Please select products to sell");
      }

      // Check if all products have sufficient stock in the vehicle's inventory
      for (const saleProduct of draft.products) {
        if (saleProduct.weight <= 0) continue;
        const product = products.find(p => p.id === saleProduct.productId);
        const vehicleInventoryItem = inventory.find(i => i.productId === saleProduct.productId);

        // First check vehicle inventory (primary validation for sales from vehicles)
        if (vehicleInventoryItem) {
          if (vehicleInventoryItem.quantity < saleProduct.weight) {
            throw new Error(`Insufficient stock in vehicle for ${product?.name || 'product'}. Available in vehicle: ${vehicleInventoryItem.quantity} KG, Requested: ${saleProduct.weight} KG`);
          }
          if (vehicleInventoryItem.quantity === 0) {
            throw new Error(`No stock available in vehicle for ${product?.name || 'product'}`);
          }
        } else {
          throw new Error(`${product?.name || 'Product'} is not loaded in this vehicle`);
        }
      }

      let customerId = draft.selectedCustomerId;
      if ((!customerId || customerId === "new") && draft.customerName.trim()) {
        const customerRes = await apiRequest("POST", "/api/customers", {
          name: draft.customerName.trim(),
          phone: draft.customerPhone || "",
          address: "",
          email: "",
        });
        const newCustomer = await customerRes.json();
        customerId = newCustomer.id;
      }

      if (!customerId) {
        throw new Error("Please select or enter a customer name");
      }

      const subtotal = draft.products.reduce((sum, p) => sum + (p.weight * p.price), 0);

      const today = new Date().toISOString().split('T')[0];
      const invoiceNumber = `INV-${Date.now()}`;

      const items = draft.products
        .filter(p => p.weight > 0)
        .map(saleProduct => ({
          productId: saleProduct.productId,
          quantity: saleProduct.weight,
          unitPrice: saleProduct.price,
          total: saleProduct.weight * saleProduct.price,
        }));

      const invoiceRes = await apiRequest("POST", "/api/invoices", {
        invoiceNumber,
        customerId,
        vehicleId: vehicle.id,
        vendorId: vehicle.vendorId || null,
        date: today,
        subtotal,
        includeHamaliCharge: draft.hamaliCharge > 0,
        hamaliRatePerKg: 0,
        hamaliChargeAmount: draft.hamaliCharge,
        hamaliPaidByCash: false,
        totalKgWeight: saleTotalWeight,
        bags: saleTotalBags,
        hamaliRatePerBag: draft.hamaliRatePerBag,
        grandTotal: subtotal + draft.hamaliCharge,
        items,
      });

      const invoice = await invoiceRes.json();

      // Auto-payment for "Cash" customers
      const currentCustomerName = draft.customerName || customers.find(c => c.id === customerId)?.name || "";
      if (currentCustomerName.toLowerCase().includes("cash")) {
        try {
          await apiRequest("POST", "/api/customer-payments", {
            customerId,
            invoiceId: invoice.id,
            amount: invoice.grandTotal,
            date: today,
            paymentMethod: "cash",
            notes: "Auto-payment for Cash & Carry",
          });
        } catch (err) {
          console.error("Failed to auto-record cash payment:", err);
          // We don't throw here to avoid rolling back the sale, just log the error
        }
      }

      for (const saleProduct of draft.products) {
        const currentInventory = inventory.find(i => i.productId === saleProduct.productId);
        if (currentInventory) {
          const newQuantity = Math.max(0, currentInventory.quantity - saleProduct.weight);
          await apiRequest("PATCH", `/api/vehicles/${vehicle.id}/inventory/${saleProduct.productId}`, {
            quantity: newQuantity,
          });

          await apiRequest("POST", "/api/vehicle-inventory-movements", {
            vehicleId: vehicle.id,
            productId: saleProduct.productId,
            type: "sale",
            quantity: saleProduct.weight,
            date: today,
            notes: `Sold to ${draft.customerName}`,
          });
        }
      }

      return invoice;
    },
    onSuccess: (invoice) => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/all-vehicle-inventories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });

      toast({
        title: "Sale Created",
        description: `Invoice created for ${vehicle.number}.`,
      });

      onSaleComplete(invoice);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create sale.",
        variant: "destructive",
      });
    },
  });

  const hasProductsWithWeight = draft.products.some(p => p.weight > 0);
  const grandTotal = saleSubtotal + draft.hamaliCharge;

  // Check if vehicle is new (today's date)
  const today = new Date().toISOString().split("T")[0];
  const isNewVehicle = vehicle.entryDate === today;

  // Calculate total stock for this vehicle
  const totalVehicleStock = inventory.reduce((sum, inv) => sum + inv.quantity, 0);

  return (
    <Card className={`w-80 flex-shrink-0 ${isNewVehicle ? 'border-primary/50 ring-1 ring-primary/30' : 'border-amber-500/50'}`} data-testid={`section-customer-sale-${vehicle.id}`}>
      <CardHeader className={`p-3 pb-2 ${isNewVehicle ? 'bg-primary/5' : 'bg-amber-50 dark:bg-amber-950/20'}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Truck className={`h-5 w-5 flex-shrink-0 ${isNewVehicle ? 'text-primary' : 'text-amber-600'}`} />
            <div className="flex flex-col">
              <span className="font-semibold text-sm" data-testid={`text-sale-vehicle-number-${vehicle.id}`}>
                {vehicle.number}
                {vehicle.vendorId && vendors.find(v => v.id === vehicle.vendorId) && (
                  <span className="text-muted-foreground font-normal"> - {vendors.find(v => v.id === vehicle.vendorId)?.name}</span>
                )}
              </span>
              <span className={`text-xs ${isNewVehicle ? 'text-primary' : 'text-amber-600'}`}>
                Stock: {totalVehicleStock.toFixed(1)} KG
              </span>
              <div className="flex gap-2 text-[10px] text-muted-foreground mt-0.5">
                <span className="text-green-600">Gain: {vehicle.totalWeightGain?.toFixed(3) || '0.000'}</span>
                <span className="text-red-500">Loss: {vehicle.totalWeightLoss?.toFixed(3) || '0.000'}</span>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose} data-testid={`button-close-sale-${vehicle.id}`}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0 space-y-3">
        <div className="space-y-4 mb-4">
          <div className="flex items-center gap-2">
            {!draft.customerName && !draft.selectedCustomerId && (
              <Select value={draft.selectedCustomerId} onValueChange={(val) => {
                handleCustomerChange(val);
                setErrors(prev => ({ ...prev, customer: undefined }));
              }}>
                <SelectTrigger className={`w-full text-xs h-8 ${errors.customer ? "border-destructive ring-1 ring-destructive" : ""}`}>
                  <SelectValue placeholder="Select Customer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">+ New Customer</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {(draft.customerName || draft.selectedCustomerId === "new") && (
              <div className="flex-1 flex items-center gap-2">
                <Input
                  value={draft.customerName}
                  onChange={(e) => {
                    onUpdateDraft({ ...draft, customerName: e.target.value });
                    if (e.target.value.trim()) setErrors(prev => ({ ...prev, customer: undefined }));
                  }}
                  placeholder="Customer Name"
                  className={`text-xs h-8 flex-1 ${errors.customer ? "border-destructive ring-1 ring-destructive" : ""}`}
                  autoFocus={!draft.customerName}
                />
                {draft.selectedCustomerId === "new" && (
                  <Input
                    value={draft.customerPhone || ""}
                    onChange={(e) => onUpdateDraft({ ...draft, customerPhone: e.target.value })}
                    placeholder="Phone"
                    className="text-xs h-8 w-28"
                  />
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onUpdateDraft({ ...draft, selectedCustomerId: "", customerName: "", customerPhone: "" })}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <div className="grid grid-cols-12 gap-1 text-[10px] text-muted-foreground font-medium px-1">
            <div className="col-span-3">Product</div>
            <div className="col-span-2 text-center">Weight</div>
            <div className="col-span-2 text-center">Bags</div>
            <div className="col-span-3 text-center">Price/KG</div>
            <div className="col-span-2 text-right">Total</div>
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {availableProducts.map((item) => {
              const draftProduct = draft.products.find(p => p.productId === item.productId);
              const weight = draftProduct?.weight || 0;
              const bags = draftProduct?.bags || 0;
              const price = draftProduct?.price || item.product?.salePrice || 0;
              const lineTotal = weight * price;

              return (
                <div key={item.productId} className="grid grid-cols-12 gap-1 items-center">
                  <div className="col-span-3 text-xs truncate" title={item.product?.name}>
                    {item.product?.name}
                  </div>
                  <div className="col-span-2 flex items-center gap-1">
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      className="h-6 text-xs text-center px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none w-full"
                      value={weight || ""}
                      placeholder="0"
                      onChange={(e) => updateProductField(item.productId, 'weight', parseFloat(e.target.value) || 0)}
                      data-testid={`input-weight-${vehicle.id}-${item.productId}`}
                    />
                    {isScaleConnected && (
                      <Button
                        title="Add Scale Weight (+1 Bag)"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 text-muted-foreground hover:text-primary"
                        disabled={currentWeight === null}
                        onClick={async () => {
                          const rounded = currentWeight || 0;
                          const raw = rawWeight || 0;

                          // Track Gain/Loss
                          if (raw > 0) {
                            const diff = rounded - raw;
                            // Update vehicle stats
                            // We need to send a PATCH request. 
                            // This is a side effect.
                            try {
                              const gain = diff > 0 ? diff : 0;
                              const loss = diff < 0 ? Math.abs(diff) : 0;

                              if (gain > 0 || loss > 0) {
                                await apiRequest("PATCH", `/api/vehicles/${vehicle.id}`, {
                                  totalWeightGain: (vehicle.totalWeightGain || 0) + gain,
                                  totalWeightLoss: (vehicle.totalWeightLoss || 0) + loss
                                });
                                // Invalidate queries to refresh UI
                                queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
                              }
                            } catch (e) {
                              console.error("Failed to update weight stats", e);
                            }
                          }
                          accumulateWeightAndBags(item.productId, currentWeight || 0)
                        }}
                      >
                        <Scale className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      className="h-6 text-xs text-center px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      value={bags || ""}
                      placeholder="0"
                      onChange={(e) => updateProductField(item.productId, 'bags', parseInt(e.target.value) || 0)}
                      data-testid={`input-bags-${vehicle.id}-${item.productId}`}
                    />
                  </div>
                  <div className="col-span-3">
                    <Input
                      type="number"
                      min="0"
                      className={`h-6 text-xs text-center px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${errors.products?.[item.productId]?.price ? "border-destructive ring-1 ring-destructive bg-destructive/10" : ""}`}
                      title={errors.products?.[item.productId]?.price}
                      value={price || ""}
                      placeholder="0"
                      onChange={(e) => {
                        updateProductField(item.productId, 'price', parseFloat(e.target.value) || 0);
                        if (errors.products?.[item.productId]) {
                          setErrors(prev => {
                            const newProducts = { ...prev.products };
                            delete newProducts[item.productId];
                            return { ...prev, products: newProducts };
                          });
                        }
                      }}
                      data-testid={`input-price-${vehicle.id}-${item.productId}`}
                    />
                  </div>
                  <div className="col-span-2 text-xs text-right font-medium">
                    {lineTotal > 0 ? `₹${lineTotal.toFixed(0)}` : "-"}
                  </div>
                </div>
              );
            })}
            {availableProducts.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">No products</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Hamali:</span>
          <span className="text-xs text-muted-foreground">{saleTotalBags} bags ×</span>
          <Input
            type="number"
            min="0"
            className="h-6 text-xs w-16 px-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            value={draft.hamaliRatePerBag || ""}
            placeholder="₹/bag"
            onChange={(e) => {
              const rate = parseFloat(e.target.value) || 0;
              onUpdateDraft({
                ...draft,
                hamaliRatePerBag: rate,
                hamaliCharge: saleTotalBags * rate
              });
            }}
            data-testid={`input-hamali-rate-${vehicle.id}`}
          />
          <span className="text-xs">=</span>
          <span className="text-xs font-medium">₹{draft.hamaliCharge.toFixed(0)}</span>
        </div>

        <div className="pt-2 border-t space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Weight:</span>
            <span data-testid={`text-total-weight-${vehicle.id}`}>{saleTotalWeight.toFixed(1)} KG</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Bags:</span>
            <span data-testid={`text-total-bags-${vehicle.id}`}>{saleTotalBags}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Subtotal:</span>
            <span>₹{saleSubtotal.toFixed(0)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Hamali:</span>
            <span>₹{draft.hamaliCharge.toFixed(0)}</span>
          </div>
          <div className="flex items-center justify-between pt-1 border-t">
            <span className="text-sm font-medium">Grand Total:</span>
            <span className="font-bold text-base text-primary" data-testid={`text-grand-total-${vehicle.id}`}>₹{grandTotal.toFixed(0)}</span>
          </div>
        </div>

        <Button
          size="sm"
          className="w-full h-8"
          onClick={() => {
            if (validateForm()) {
              createSaleMutation.mutate();
            } else {
              toast({
                title: "Validation Error",
                description: "Please check the highlighted fields.",
                variant: "destructive",
              });
            }
          }}
          disabled={createSaleMutation.isPending || !hasProductsWithWeight}
          data-testid={`button-create-sale-${vehicle.id}`}
        >
          {createSaleMutation.isPending ? "..." : "Create Sale"}
        </Button>
      </CardContent>
    </Card>
  );
}



function SaleSuccessDialog({
  invoice,
  open,
  onClose
}: {
  invoice: Invoice | null;
  open: boolean;
  onClose: () => void
}) {
  if (!invoice) return null;

  const handleWhatsAppShare = () => {
    // Format the message
    // Note: invoice items are not directly available in standard Invoice type from schema
    // as it's a flat table select. We'd need to fetch items or pass them.
    // However, for simplicity and speed, we'll format the header info first.
    // Ideally we should pass the full invoice with items, or just the summary.

    // Constructing message
    let message = `*🧾 VegWholesale Invoice* %0A`;
    message += `Invoice No: ${invoice.invoiceNumber} %0A`;
    message += `Date: ${format(new Date(invoice.date), 'dd/MM/yyyy')} %0A`;
    message += `Customer: ${invoice.customerId} %0A`; // Ideally name, but let's stick to ID or passed name if refactored
    // Wait, we need customer name. We can't get it easily inside this isolated dialog without data.
    // Let's rely on the user to select the contact or just send the bill amount for now.

    message += `%0A*Total Amount: ₹${invoice.grandTotal.toFixed(0)}* %0A`;
    message += `Status: ${invoice.status === 'completed' ? 'Paid ✅' : 'Pending ⏳'} %0A`;
    message += `%0AThank you for your business! 🙏`;

    // WhatsApp URL
    const url = `https://wa.me/?text=${message}`;
    window.open(url, '_blank');
  };

  // Improving Message with better data if possible
  // We will pass customerName and Items from the parent to make it rich.
  // But for now, let's keep it simple as requested: "Click to Send". 

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">
              <span className="text-lg">✓</span>
            </div>
            Sale Completed Successfully!
          </DialogTitle>
          <DialogDescription>
            Invoice <strong>{invoice.invoiceNumber}</strong> has been created.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="flex flex-col items-center justify-center space-y-2 bg-muted/50 p-4 rounded-lg">
            <span className="text-sm text-muted-foreground">Grand Total</span>
            <span className="text-3xl font-bold text-primary">₹{invoice.grandTotal.toFixed(0)}</span>
          </div>
        </div>

        <DialogFooter className="sm:justify-between gap-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
            <Button className="bg-[#25D366] hover:bg-[#128C7E] text-white" onClick={handleWhatsAppShare}>
              <Share2 className="mr-2 h-4 w-4" />
              WhatsApp
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Sell() {
  const scale = useScale();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { shop } = useShop();

  // Success Dialog State
  const [lastInvoice, setLastInvoice] = useState<Invoice | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<ProductItem[]>([]);
  const [newProducts, setNewProducts] = useState<NewProduct[]>([]);
  const [showNewProductForm, setShowNewProductForm] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newProductUnit, setNewProductUnit] = useState("KG");
  const [newProductPrice, setNewProductPrice] = useState("");

  const [selectedVehicleIds, setSelectedVehicleIds] = useState<Set<string>>(new Set());
  const [saleDrafts, setSaleDrafts] = useState<Record<string, SaleDraft>>({});

  const form = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: {
      vehicleNumber: "",
      vehicleType: "Truck",
      capacity: "",
      driverName: "",
      driverPhone: "",
      vendorId: "",
      newVendorName: "",
    },
  });

  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: vehicleInventories = {} } = useQuery<Record<string, VehicleInventory[]>>({
    queryKey: ["/api/all-vehicle-inventories", vehicles.map((v) => v.id).join(",")],
    queryFn: async () => {
      if (vehicles.length === 0) return {};
      const results: Record<string, VehicleInventory[]> = {};
      await Promise.all(
        vehicles.map(async (vehicle) => {
          try {
            const res = await fetch(`/api/vehicles/${vehicle.id}/inventory`);
            if (res.ok) {
              results[vehicle.id] = await res.json();
            }
          } catch {
            results[vehicle.id] = [];
          }
        })
      );
      return results;
    },
    enabled: vehicles.length > 0,
  });

  const createVehicleMutation = useMutation({
    mutationFn: async (data: VehicleFormValues) => {
      let actualVendorId = data.vendorId && data.vendorId !== "new" ? data.vendorId : null;

      if (data.vendorId === "new" && data.newVendorName?.trim()) {
        const vendorRes = await apiRequest("POST", "/api/vendors", {
          name: data.newVendorName.trim(),
          phone: "",
          address: "",
          email: "",
        });
        const newVendor = await vendorRes.json();
        actualVendorId = newVendor.id;
      }

      const createdProductIds: Record<string, string> = {};
      for (const np of newProducts) {
        if (np.name.trim() && np.quantity > 0) {
          const productRes = await apiRequest("POST", "/api/products", {
            name: np.name.trim(),
            unit: np.unit,
            category: "General",
            purchasePrice: np.purchasePrice || 0,
            salePrice: 0,
            currentStock: 0,
            reorderLevel: 0,
          });
          const createdProduct = await productRes.json();
          createdProductIds[np.name] = createdProduct.id;
        }
      }

      const vehicleResponse = await apiRequest("POST", "/api/vehicles", {
        number: data.vehicleNumber,
        type: data.vehicleType,
        capacity: data.capacity || null,
        driverName: data.driverName || null,
        driverPhone: data.driverPhone || null,
        entryDate: new Date().toISOString().split("T")[0],
        vendorId: actualVendorId,
        shop,
      });

      const vehicle = await vehicleResponse.json();

      const productsToLoad = selectedProducts.filter(p => p.quantity > 0);
      if (productsToLoad.length > 0 && vehicle.id) {
        for (const item of productsToLoad) {
          await apiRequest("POST", `/api/vehicles/${vehicle.id}/inventory/load`, {
            productId: item.productId,
            quantity: item.quantity,
          });
        }
      }

      for (const np of newProducts) {
        const productId = createdProductIds[np.name];
        if (productId && np.quantity > 0 && vehicle.id) {
          await apiRequest("POST", `/api/vehicles/${vehicle.id}/inventory/load`, {
            productId,
            quantity: np.quantity,
          });
        }
      }

      return vehicle;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/all-vehicle-inventories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setIsDialogOpen(false);
      form.reset();
      setSelectedProducts([]);
      setNewProducts([]);
      setShowNewProductForm(false);
      setNewProductName("");
      setNewProductUnit("KG");
      toast({
        title: "Vehicle Created",
        description: "New vehicle has been added with loaded products.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create vehicle.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: VehicleFormValues) => {
    createVehicleMutation.mutate(data);
  };



  // Calculate global totals for floating footer
  const globalTotals = useMemo(() => {
    let bags = 0;
    let weight = 0;
    let amount = 0;

    Object.values(saleDrafts).forEach(draft => {
      const draftBags = draft.products.reduce((sum, p) => sum + (p.bags || 0), 0);
      bags += draftBags;
      weight += draft.products.reduce((sum, p) => sum + p.weight, 0);
      amount += draft.products.reduce((sum, p) => sum + (p.weight * p.price), 0);
      amount += (draftBags * (draft.hamaliRatePerBag || 0));
    });

    return { bags, weight, amount };
  }, [saleDrafts]);

  const handleDialogClose = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      form.reset();
      setSelectedProducts([]);
      setNewProducts([]);
      setShowNewProductForm(false);
      setNewProductName("");
      setNewProductUnit("KG");
      setNewProductPrice("");
    }
  };

  const addNewProduct = () => {
    if (newProductName.trim()) {
      setNewProducts(prev => [...prev, {
        name: newProductName.trim(),
        unit: newProductUnit,
        purchasePrice: parseFloat(newProductPrice) || 0,
        quantity: 0,
        bags: 0,
      }]);
      setNewProductName("");
      setNewProductUnit("KG");
      setNewProductPrice("");
      setShowNewProductForm(false);
    }
  };

  const updateNewProductQuantity = (index: number, value: number) => {
    setNewProducts(prev => prev.map((p, i) =>
      i === index ? { ...p, quantity: Math.max(0, value) } : p
    ));
  };

  const updateNewProductBags = (index: number, value: number) => {
    setNewProducts(prev => prev.map((p, i) =>
      i === index ? { ...p, bags: Math.max(0, Math.floor(value)) } : p
    ));
  };

  const removeNewProduct = (index: number) => {
    setNewProducts(prev => prev.filter((_, i) => i !== index));
  };

  const toggleProduct = (productId: string) => {
    setSelectedProducts((prev) => {
      const exists = prev.find((p) => p.productId === productId);
      if (exists) {
        return prev.filter((p) => p.productId !== productId);
      }
      return [...prev, { productId, quantity: 0, bags: 0 }];
    });
  };

  const updateProductQuantity = (productId: string, value: number) => {
    setSelectedProducts((prev) =>
      prev.map((p) =>
        p.productId === productId ? { ...p, quantity: Math.max(0, value) } : p
      )
    );
  };

  const updateProductBags = (productId: string, value: number) => {
    setSelectedProducts((prev) =>
      prev.map((p) =>
        p.productId === productId ? { ...p, bags: Math.max(0, Math.floor(value)) } : p
      )
    );
  };

  const getProduct = (productId: string): Product | undefined => {
    return products.find((p) => p.id === productId);
  };

  const getProductName = (productId: string): string => {
    return getProduct(productId)?.name || "Unknown Product";
  };

  const getProductUnit = (productId: string): string => {
    return getProduct(productId)?.unit || "Units";
  };

  const { totalWeight, totalBags } = useMemo(() => {
    let weight = 0;
    let bags = 0;

    for (const item of selectedProducts) {
      const product = getProduct(item.productId);
      if (!product) continue;

      const unit = product.unit?.toLowerCase() || "";
      if (unit === "kg" && item.quantity > 0) {
        weight += item.quantity;
      }
      bags += item.bags || 0;
    }

    for (const np of newProducts) {
      const unit = np.unit?.toLowerCase() || "";
      if (unit === "kg" && np.quantity > 0) {
        weight += np.quantity;
      }
      bags += np.bags || 0;
    }

    return { totalWeight: weight, totalBags: bags };
  }, [selectedProducts, products, newProducts]);

  useEffect(() => {
    if (totalWeight > 0) {
      const tons = (totalWeight / 1000).toFixed(2);
      form.setValue("capacity", tons);
    }
  }, [totalWeight, form]);

  const handleVehicleSelect = useCallback((vehicleId: string) => {
    const isCurrentlySelected = selectedVehicleIds.has(vehicleId);

    if (isCurrentlySelected) {
      setSelectedVehicleIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(vehicleId);
        return newSet;
      });
      setSaleDrafts(prevDrafts => {
        const newDrafts = { ...prevDrafts };
        delete newDrafts[vehicleId];
        return newDrafts;
      });
    } else {
      setSelectedVehicleIds(prev => {
        const newSet = new Set(prev);
        newSet.add(vehicleId);
        return newSet;
      });
      setSaleDrafts(prevDrafts => ({
        ...prevDrafts,
        [vehicleId]: {
          products: [],
          customerName: "",
          customerPhone: "",
          selectedCustomerId: "",
          hamaliCharge: 0,
          hamaliRatePerBag: 0,
        },
      }));
    }
  }, [selectedVehicleIds]);

  const handleUpdateDraft = useCallback((vehicleId: string, draft: SaleDraft) => {
    setSaleDrafts(prev => ({
      ...prev,
      [vehicleId]: draft,
    }));
  }, []);

  const handleCloseSale = useCallback((vehicleId: string) => {
    setSelectedVehicleIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(vehicleId);
      return newSet;
    });
    setSaleDrafts(prev => {
      const newDrafts = { ...prev };
      delete newDrafts[vehicleId];
      return newDrafts;
    });
  }, []);

  const handleSaleComplete = useCallback((vehicleId: string) => {
    // Reset the draft instead of closing - pane stays open for more sales
    setSaleDrafts(prev => ({
      ...prev,
      [vehicleId]: {
        products: [],
        customerName: "",
        customerPhone: "",
        selectedCustomerId: "",
        hamaliCharge: 0,
        hamaliRatePerBag: 0,
      },
    }));
  }, []);

  if (vehiclesLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold">Sell</h1>
            <p className="text-muted-foreground">Select vehicles to start selling</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  const selectedVehiclesArray = vehicles.filter(v => selectedVehicleIds.has(v.id));

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold" data-testid="text-section-vehicles">Sell</h1>

          {selectedVehicleIds.size > 0 && (
            <Badge variant="secondary" className="text-xs">{selectedVehicleIds.size} selected</Badge>
          )}

          {/* Weighing Scale Integration */}
          <div className="flex items-center gap-2 bg-muted/50 rounded-md px-2 py-1 ml-2">
            <div className="flex items-center gap-1 mr-1 border-r pr-2 border-border/50">
              <Label htmlFor="demo-mode-sell" className="text-[10px] text-muted-foreground cursor-pointer font-normal">Demo</Label>
              <Switch
                id="demo-mode-sell"
                className="h-3 w-5 scale-75"
                checked={scale.isDemoMode}
                onCheckedChange={scale.toggleDemoMode}
              />
            </div>
            <Scale className="h-4 w-4 text-muted-foreground" />
            {scale.isConnected ? (
              <>
                <Badge variant="outline" className="bg-background text-primary font-mono">
                  {scale.currentWeight !== null ? scale.currentWeight.toFixed(3) : "---"} KG
                </Badge>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={scale.disconnect} title="Disconnect Scale">
                  <Unplug className="h-3 w-3 text-destructive" />
                </Button>
              </>
            ) : (
              <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={scale.connect}>
                <Plug className="h-3 w-3 mr-1" />
                Connect Scale
              </Button>
            )}
            {scale.error && (
              <span className="text-xs text-destructive max-w-[150px] truncate" title={scale.error}>
                {scale.error}
              </span>
            )}
          </div>
        </div>
        {selectedVehicleIds.size > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedVehicleIds(new Set());
              setSaleDrafts({});
            }}
            data-testid="button-clear-all-sales"
          >
            Clear All
          </Button>
        )}
      </div>




      <div className="flex gap-2 overflow-x-auto pb-2">
        <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
          <DialogTrigger asChild>
            <Card
              className="hover-elevate cursor-pointer border-dashed border-2 flex items-center justify-center w-28 h-24 flex-shrink-0"
              data-testid="button-add-vehicle"
            >
              <CardContent className="flex flex-col items-center justify-center p-2 text-center">
                <Plus className="h-5 w-5 text-primary mb-1" />
                <span className="text-xs font-medium">Add</span>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Vehicle</DialogTitle>
              <DialogDescription>Enter the vehicle details and select products to load.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="vehicleNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vehicle Number *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., MH12AB1234" {...field} data-testid="input-vehicle-number" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="vehicleType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vehicle Type *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-vehicle-type">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Truck">Truck</SelectItem>
                            <SelectItem value="Mini Truck">Mini Truck</SelectItem>
                            <SelectItem value="Tempo">Tempo</SelectItem>
                            <SelectItem value="Van">Van</SelectItem>
                            <SelectItem value="Pickup">Pickup</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="capacity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Capacity (Tons)</FormLabel>
                        <FormControl>
                          <Input placeholder="Auto-calculated" {...field} data-testid="input-capacity" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="vendorId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vendor (Source)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-vendor">
                              <SelectValue placeholder="Select vendor" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="new">+ Add New Vendor</SelectItem>
                            {vendors.map((vendor) => (
                              <SelectItem key={vendor.id} value={vendor.id}>
                                {vendor.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {form.watch("vendorId") === "new" && (
                    <FormField
                      control={form.control}
                      name="newVendorName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New Vendor Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter vendor name" {...field} data-testid="input-new-vendor-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  <FormField
                    control={form.control}
                    name="driverName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Driver Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Driver name" {...field} data-testid="input-driver-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="driverPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Driver Phone</FormLabel>
                        <FormControl>
                          <Input placeholder="Driver phone" {...field} data-testid="input-driver-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-md">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Weight className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Weight</p>
                      <p className="text-lg font-semibold" data-testid="text-total-weight">
                        {totalWeight.toFixed(1)} KG
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <ShoppingBag className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Bags</p>
                      <p className="text-lg font-semibold" data-testid="text-total-bags">
                        {totalBags} Bags
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h3 className="text-lg font-medium">Select Products to Load</h3>
                    <div className="flex items-center gap-2">
                      {(selectedProducts.length > 0 || newProducts.length > 0) && (
                        <Badge variant="secondary">{selectedProducts.length + newProducts.length} selected</Badge>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowNewProductForm(true)}
                        data-testid="button-add-new-product"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add New
                      </Button>
                    </div>
                  </div>

                  {showNewProductForm && (
                    <div className="p-3 border rounded-md bg-muted/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">Add New Product</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setShowNewProductForm(false);
                            setNewProductName("");
                            setNewProductUnit("KG");
                            setNewProductPrice("");
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                        <Input
                          placeholder="Product name"
                          value={newProductName}
                          onChange={(e) => setNewProductName(e.target.value)}
                          data-testid="input-new-product-name"
                        />
                        <Select value={newProductUnit} onValueChange={setNewProductUnit}>
                          <SelectTrigger data-testid="select-new-product-unit">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="KG">KG</SelectItem>
                            <SelectItem value="Units">Units</SelectItem>
                            <SelectItem value="Dozen">Dozen</SelectItem>
                            <SelectItem value="Bundle">Bundle</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          placeholder="Purchase Price (₹)"
                          value={newProductPrice}
                          onChange={(e) => setNewProductPrice(e.target.value)}
                          data-testid="input-new-product-price"
                        />
                        <Button
                          type="button"
                          onClick={addNewProduct}
                          disabled={!newProductName.trim()}
                          data-testid="button-confirm-new-product"
                        >
                          Add Product
                        </Button>
                      </div>
                    </div>
                  )}

                  {newProducts.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-sm text-muted-foreground">New Products (will be created):</span>
                      {newProducts.map((np, index) => (
                        <div key={index} className="p-3 border rounded-md border-primary/50 bg-primary/5">
                          <div className="flex items-start gap-3">
                            <div className="flex-1">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium">{np.name}</span>
                                  <Badge variant="outline" className="text-xs">{np.unit}</Badge>
                                  {np.purchasePrice > 0 && (
                                    <Badge variant="outline" className="text-xs font-mono">₹{np.purchasePrice}/unit</Badge>
                                  )}
                                  <Badge variant="secondary" className="text-xs">New</Badge>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeNewProduct(index)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <label className="text-sm text-muted-foreground mb-1 block">
                                    Quantity ({np.unit})
                                  </label>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="outline"
                                      onClick={() => updateNewProductQuantity(index, np.quantity - 1)}
                                      className="h-8 w-8"
                                    >
                                      <Minus className="h-3 w-3" />
                                    </Button>
                                    <Input
                                      type="number"
                                      min="0"
                                      step={np.unit === "KG" ? "0.1" : "1"}
                                      value={np.quantity || 0}
                                      onChange={(e) => updateNewProductQuantity(index, parseFloat(e.target.value) || 0)}
                                      className="text-center h-8 w-20"
                                      data-testid={`input-new-product-qty-${index}`}
                                    />
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="outline"
                                      onClick={() => updateNewProductQuantity(index, np.quantity + 1)}
                                      className="h-8 w-8"
                                    >
                                      <Plus className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                                <div>
                                  <label className="text-sm text-muted-foreground mb-1 block">Bags</label>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="outline"
                                      onClick={() => updateNewProductBags(index, np.bags - 1)}
                                      className="h-8 w-8"
                                    >
                                      <Minus className="h-3 w-3" />
                                    </Button>
                                    <Input
                                      type="number"
                                      min="0"
                                      step="1"
                                      value={np.bags || 0}
                                      onChange={(e) => updateNewProductBags(index, parseInt(e.target.value) || 0)}
                                      className="text-center h-8 w-20"
                                      data-testid={`input-new-product-bags-${index}`}
                                    />
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="outline"
                                      onClick={() => updateNewProductBags(index, np.bags + 1)}
                                      className="h-8 w-8"
                                    >
                                      <Plus className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <ScrollArea className="h-64 border rounded-md p-4">
                    <div className="space-y-3">
                      {products.map((product) => {
                        const isSelected = selectedProducts.some((p) => p.productId === product.id);
                        const productData = selectedProducts.find((p) => p.productId === product.id);

                        return (
                          <div
                            key={product.id}
                            className={`p-3 border rounded-md transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                          >
                            <div className="flex items-start gap-3">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleProduct(product.id)}
                                data-testid={`checkbox-product-${product.id}`}
                              />
                              <div className="flex-1">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{product.name}</span>
                                    <Badge variant="outline" className="text-xs">{product.unit}</Badge>
                                  </div>
                                  <span className="text-sm text-muted-foreground">Stock: {product.currentStock}</span>
                                </div>

                                {isSelected && (
                                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                      <label className="text-sm text-muted-foreground mb-1 block">
                                        Quantity ({product.unit})
                                      </label>
                                      <div className="flex items-center gap-1">
                                        <Button
                                          type="button"
                                          size="icon"
                                          variant="outline"
                                          onClick={() => updateProductQuantity(product.id, (productData?.quantity || 0) - 1)}
                                          className="h-8 w-8"
                                        >
                                          <Minus className="h-3 w-3" />
                                        </Button>
                                        <Input
                                          type="number"
                                          min="0"
                                          step={product.unit === "KG" ? "0.1" : "1"}
                                          value={productData?.quantity || 0}
                                          onChange={(e) => updateProductQuantity(product.id, parseFloat(e.target.value) || 0)}
                                          className="text-center h-8 w-20"
                                          data-testid={`input-quantity-${product.id}`}
                                        />
                                        <Button
                                          type="button"
                                          size="icon"
                                          variant="outline"
                                          onClick={() => updateProductQuantity(product.id, (productData?.quantity || 0) + 1)}
                                          className="h-8 w-8"
                                        >
                                          <Plus className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                    <div>
                                      <label className="text-sm text-muted-foreground mb-1 block flex items-center gap-1">
                                        Bags
                                        {(productData?.bags || 0) > 0 && (
                                          <Badge variant="secondary" className="text-xs ml-1">{productData?.bags}</Badge>
                                        )}
                                      </label>
                                      <div className="flex items-center gap-1">
                                        <Button
                                          type="button"
                                          size="icon"
                                          variant="outline"
                                          onClick={() => updateProductBags(product.id, (productData?.bags || 0) - 1)}
                                          className="h-8 w-8"
                                        >
                                          <Minus className="h-3 w-3" />
                                        </Button>
                                        <Input
                                          type="number"
                                          min="0"
                                          step="1"
                                          value={productData?.bags || 0}
                                          onChange={(e) => updateProductBags(product.id, parseInt(e.target.value) || 0)}
                                          className="text-center h-8 w-20"
                                          data-testid={`input-bags-${product.id}`}
                                        />
                                        <Button
                                          type="button"
                                          size="icon"
                                          variant="outline"
                                          onClick={() => updateProductBags(product.id, (productData?.bags || 0) + 1)}
                                          className="h-8 w-8"
                                        >
                                          <Plus className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {products.length === 0 && (
                        <p className="text-center text-muted-foreground py-8">
                          No products available. Add products first.
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => handleDialogClose(false)} data-testid="button-cancel-vehicle">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createVehicleMutation.isPending} data-testid="button-submit-vehicle">
                    {createVehicleMutation.isPending ? "Creating..." : "Create Vehicle"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {vehicles.filter(v => v.shop === shop).map((vehicle) => {
          const inventory = vehicleInventories[vehicle.id] || [];
          const itemsWithStock = inventory.filter((inv) => inv.quantity > 0);
          const hasInventory = itemsWithStock.length > 0;
          const isSelected = selectedVehicleIds.has(vehicle.id);

          if (isSelected) {
            return (
              <VehicleSalePane
                key={vehicle.id}
                vehicle={vehicle}
                inventory={vehicleInventories[vehicle.id] || []}
                products={products}
                customers={customers}
                vendors={vendors}
                draft={saleDrafts[vehicle.id] || { products: [], customerName: "", selectedCustomerId: "", hamaliCharge: 0 }}
                onUpdateDraft={(draft) => handleUpdateDraft(vehicle.id, draft)}
                onClose={() => handleCloseSale(vehicle.id)}
                onSaleComplete={() => handleSaleComplete(vehicle.id)}
                currentWeight={scale.currentWeight}
                rawWeight={scale.rawWeight}
                isScaleConnected={scale.isConnected}
              />
            );
          }

          const totalQty = itemsWithStock.reduce((sum, inv) => sum + inv.quantity, 0);

          // Check if vehicle is new (today's date)
          const today = new Date().toISOString().split("T")[0];
          const isNewVehicle = vehicle.entryDate === today;

          return (
            <Card
              key={vehicle.id}
              className={`hover-elevate cursor-pointer w-48 flex-shrink-0 ${isNewVehicle ? 'ring-2 ring-primary' : ''}`}
              onClick={() => handleVehicleSelect(vehicle.id)}
              data-testid={`card-vehicle-${vehicle.id}`}
            >
              <CardContent className="p-3 flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <Truck className={`h-10 w-10 flex-shrink-0 ${isNewVehicle ? 'text-primary' : 'text-amber-600'}`} />
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold" data-testid={`text-vehicle-number-${vehicle.id}`}>
                      {vehicle.number}
                    </span>
                    <span className="text-xs text-muted-foreground">{vehicle.type}</span>
                    {vehicle.entryDate ? (
                      <span className={`text-xs ${isNewVehicle ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                        {vehicle.entryDate} {isNewVehicle && '(New)'}
                      </span>
                    ) : (
                      <span className="text-xs text-amber-600">(Old Vehicle)</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">Total:</span>
                  <span className="text-sm font-bold text-primary" data-testid={`text-vehicle-total-${vehicle.id}`}>
                    {totalQty.toFixed(1)} KG
                  </span>
                </div>
                {hasInventory ? (
                  <div className="space-y-1 pt-1 border-t">
                    {itemsWithStock.map((inv) => {
                      const product = products.find(p => p.id === inv.productId);
                      return (
                        <div key={inv.productId} className="flex items-center justify-between text-xs">
                          <span className="truncate max-w-20">{product?.name || "?"}</span>
                          <span className="font-mono text-muted-foreground">{inv.quantity}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground italic">No products loaded</div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      <SaleSuccessDialog
        invoice={lastInvoice}
        open={showSuccessDialog}
        onClose={() => setShowSuccessDialog(false)}
      />
    </div>
  );
}
