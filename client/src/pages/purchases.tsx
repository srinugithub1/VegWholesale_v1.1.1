import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import type { Vendor, Vehicle, Product, Purchase } from "@shared/schema";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

interface PurchaseLineItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

const purchaseFormSchema = z.object({
  vendorId: z.string().min(1, "Please select a vendor"),
  vehicleId: z.string().optional(),
  date: z.string().min(1, "Please select a date"),
});

type PurchaseFormData = z.infer<typeof purchaseFormSchema>;

export default function Purchases() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [lineItems, setLineItems] = useState<PurchaseLineItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [itemQuantity, setItemQuantity] = useState("");
  const [itemPrice, setItemPrice] = useState("");

  const { data: vendors = [], isLoading: vendorsLoading } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  const { data: vehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: purchases = [], isLoading: purchasesLoading } = useQuery<Purchase[]>({
    queryKey: ["/api/purchases"],
  });

  const form = useForm<PurchaseFormData>({
    resolver: zodResolver(purchaseFormSchema),
    defaultValues: {
      vendorId: "",
      vehicleId: "",
      date: new Date().toISOString().split("T")[0],
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: PurchaseFormData & { items: PurchaseLineItem[] }) => {
      return apiRequest("POST", "/api/purchases", {
        ...data,
        totalAmount: data.items.reduce((acc, item) => acc + item.total, 0),
        items: data.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
        })),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stock-movements"] });
      setIsDialogOpen(false);
      setLineItems([]);
      form.reset();
      toast({ title: "Purchase order created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create purchase order", variant: "destructive" });
    },
  });

  const addLineItem = () => {
    if (!selectedProduct || !itemQuantity || !itemPrice) {
      toast({ title: "Please fill all item fields", variant: "destructive" });
      return;
    }

    const product = products.find((p) => p.id === selectedProduct);
    if (!product) return;

    const quantity = parseFloat(itemQuantity);
    const unitPrice = parseFloat(itemPrice);

    if (isNaN(quantity) || isNaN(unitPrice) || quantity <= 0 || unitPrice <= 0) {
      toast({ title: "Please enter valid quantity and price", variant: "destructive" });
      return;
    }

    setLineItems([
      ...lineItems,
      {
        productId: product.id,
        productName: product.name,
        quantity,
        unitPrice,
        total: quantity * unitPrice,
      },
    ]);

    setSelectedProduct("");
    setItemQuantity("");
    setItemPrice("");
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const totalAmount = lineItems.reduce((acc, item) => acc + item.total, 0);

  const onSubmit = (data: PurchaseFormData) => {
    if (lineItems.length === 0) {
      toast({ title: "Please add at least one item", variant: "destructive" });
      return;
    }

    createMutation.mutate({ ...data, items: lineItems });
  };

  const openCreateDialog = () => {
    form.reset({
      vendorId: "",
      vehicleId: "",
      date: new Date().toISOString().split("T")[0],
    });
    setLineItems([]);
    setIsDialogOpen(true);
  };

  const filteredPurchases = purchases.filter((purchase) => {
    const vendor = vendors.find((v) => v.id === purchase.vendorId);
    return (
      vendor?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      purchase.id.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const isLoading = vendorsLoading || purchasesLoading;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-9 w-32" />
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Purchases</h1>
          <p className="text-sm text-muted-foreground">
            Manage purchase orders from vendors
          </p>
        </div>
        <Button onClick={openCreateDialog} data-testid="button-new-purchase">
          <Plus className="h-4 w-4 mr-2" />
          New Purchase
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search purchases..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-purchases"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredPurchases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mb-4" />
              <p className="text-lg font-medium">No purchases found</p>
              <p className="text-sm">
                {searchQuery
                  ? "Try a different search term"
                  : "Create your first purchase order"}
              </p>
              {!searchQuery && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={openCreateDialog}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Purchase
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Purchase ID</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPurchases.map((purchase) => {
                  const vendor = vendors.find((v) => v.id === purchase.vendorId);
                  return (
                    <TableRow key={purchase.id} data-testid={`row-purchase-${purchase.id}`}>
                      <TableCell className="font-mono text-sm">
                        {purchase.id.slice(0, 8)}...
                      </TableCell>
                      <TableCell className="font-medium">
                        {vendor?.name || "Unknown"}
                      </TableCell>
                      <TableCell>{purchase.date}</TableCell>
                      <TableCell className="text-right font-mono">
                        ₹{purchase.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={purchase.status === "completed" ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {purchase.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Purchase Order</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="vendorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendor *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-vendor">
                            <SelectValue placeholder="Select vendor" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
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
                <FormField
                  control={form.control}
                  name="vehicleId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vehicle</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || ""}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-vehicle">
                            <SelectValue placeholder="Select vehicle" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {vehicles.map((vehicle) => (
                            <SelectItem key={vehicle.id} value={vehicle.id}>
                              {vehicle.number} - {vehicle.type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-purchase-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Add Items</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="text-sm font-medium">Product</label>
                      <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                        <SelectTrigger data-testid="select-item-product">
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name} ({product.unit})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Quantity</label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0"
                        value={itemQuantity}
                        onChange={(e) => setItemQuantity(e.target.value)}
                        data-testid="input-item-quantity"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Unit Price</label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={itemPrice}
                        onChange={(e) => setItemPrice(e.target.value)}
                        data-testid="input-item-price"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        onClick={addLineItem}
                        className="w-full"
                        data-testid="button-add-item"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add
                      </Button>
                    </div>
                  </div>

                  {lineItems.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Price</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lineItems.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>{item.productName}</TableCell>
                            <TableCell className="text-right font-mono">
                              {item.quantity}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              ₹{item.unitPrice.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              ₹{item.total.toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeLineItem(index)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-md">
                <span className="font-medium">Total Amount</span>
                <span className="text-2xl font-semibold font-mono" data-testid="text-purchase-total">
                  ₹{totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || lineItems.length === 0}
                  data-testid="button-submit-purchase"
                >
                  {createMutation.isPending ? "Creating..." : "Create Purchase"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
