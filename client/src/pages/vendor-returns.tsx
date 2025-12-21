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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Plus,
  Search,
  RotateCcw,
  Trash2,
  X,
  AlertTriangle,
} from "lucide-react";
import type { Vendor, Vehicle, Product, VendorReturn } from "@shared/schema";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

interface ReturnLineItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  reason: string;
}

const RETURN_REASONS = [
  "Damaged",
  "Rotten/Spoiled",
  "Wrong Item",
  "Quality Issue",
  "Excess Stock",
  "Other",
];

const returnFormSchema = z.object({
  vendorId: z.string().min(1, "Please select a vendor"),
  vehicleId: z.string().optional(),
  date: z.string().min(1, "Please select a date"),
  notes: z.string().optional(),
});

type ReturnFormData = z.infer<typeof returnFormSchema>;

export default function VendorReturns() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [lineItems, setLineItems] = useState<ReturnLineItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [itemQuantity, setItemQuantity] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [selectedReason, setSelectedReason] = useState("");

  const { data: vendors = [], isLoading: vendorsLoading } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  const { data: vehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: vendorReturns = [], isLoading: returnsLoading } = useQuery<VendorReturn[]>({
    queryKey: ["/api/vendor-returns"],
  });

  const form = useForm<ReturnFormData>({
    resolver: zodResolver(returnFormSchema),
    defaultValues: {
      vendorId: "",
      vehicleId: "",
      date: new Date().toISOString().split("T")[0],
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ReturnFormData & { items: ReturnLineItem[] }) => {
      return apiRequest("POST", "/api/vendor-returns", {
        ...data,
        vehicleId: data.vehicleId === "none" ? undefined : data.vehicleId,
        totalAmount: data.items.reduce((acc, item) => acc + item.total, 0),
        items: data.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
          reason: item.reason,
        })),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor-returns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stock-movements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      setIsDialogOpen(false);
      setLineItems([]);
      form.reset();
      toast({ title: "Vendor return created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create vendor return", variant: "destructive" });
    },
  });

  const addLineItem = () => {
    if (!selectedProduct || !itemQuantity || !itemPrice || !selectedReason) {
      toast({ title: "Please fill all item fields including reason", variant: "destructive" });
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

    if (quantity > product.currentStock) {
      toast({
        title: "Insufficient stock",
        description: `Only ${product.currentStock} ${product.unit} available`,
        variant: "destructive",
      });
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
        reason: selectedReason,
      },
    ]);

    setSelectedProduct("");
    setItemQuantity("");
    setItemPrice("");
    setSelectedReason("");
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const totalAmount = lineItems.reduce((acc, item) => acc + item.total, 0);

  const onSubmit = (data: ReturnFormData) => {
    if (lineItems.length === 0) {
      toast({ title: "Please add at least one item", variant: "destructive" });
      return;
    }

    createMutation.mutate({ ...data, items: lineItems });
  };

  const filteredReturns = vendorReturns.filter((ret) => {
    const vendor = vendors.find((v) => v.id === ret.vendorId);
    const vendorName = vendor?.name.toLowerCase() || "";
    return vendorName.includes(searchQuery.toLowerCase());
  });

  const handleProductChange = (productId: string) => {
    setSelectedProduct(productId);
    const product = products.find((p) => p.id === productId);
    if (product) {
      setItemPrice(product.purchasePrice.toString());
    }
  };

  const openDialog = () => {
    form.reset({
      vendorId: "",
      vehicleId: "",
      date: new Date().toISOString().split("T")[0],
      notes: "",
    });
    setLineItems([]);
    setIsDialogOpen(true);
  };

  if (vendorsLoading || returnsLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Vendor Returns</h1>
          <p className="text-muted-foreground">
            Return defective or unwanted products to vendors
          </p>
        </div>
        <Button onClick={openDialog} data-testid="button-create-return">
          <Plus className="h-4 w-4 mr-2" />
          Create Return
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Return History
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search returns..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-returns"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredReturns.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No vendor returns found</p>
              <p className="text-sm">Create a return to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReturns.map((ret) => {
                  const vendor = vendors.find((v) => v.id === ret.vendorId);
                  const vehicle = vehicles.find((v) => v.id === ret.vehicleId);
                  return (
                    <TableRow key={ret.id} data-testid={`row-return-${ret.id}`}>
                      <TableCell>{ret.date}</TableCell>
                      <TableCell>{vendor?.name || "Unknown"}</TableCell>
                      <TableCell>{vehicle?.number || "-"}</TableCell>
                      <TableCell className="text-right font-mono">
                        Rs {ret.totalAmount.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={ret.status === "completed" ? "default" : "secondary"}>
                          {ret.status}
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
            <DialogTitle>Create Vendor Return</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="vendorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendor</FormLabel>
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
                      <FormLabel>Vehicle (Optional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-vehicle">
                            <SelectValue placeholder="Select vehicle" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {vehicles.map((vehicle) => (
                            <SelectItem key={vehicle.id} value={vehicle.id}>
                              {vehicle.number} - {vehicle.driverName}
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
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Add notes..." {...field} data-testid="input-notes" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="font-medium">Add Items to Return</h3>
                <div className="grid grid-cols-5 gap-2">
                  <Select value={selectedProduct} onValueChange={handleProductChange}>
                    <SelectTrigger data-testid="select-product">
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} ({product.currentStock} {product.unit})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    type="number"
                    placeholder="Quantity"
                    value={itemQuantity}
                    onChange={(e) => setItemQuantity(e.target.value)}
                    min="0"
                    step="0.01"
                    data-testid="input-quantity"
                  />

                  <Input
                    type="number"
                    placeholder="Price"
                    value={itemPrice}
                    onChange={(e) => setItemPrice(e.target.value)}
                    min="0"
                    step="0.01"
                    data-testid="input-price"
                  />

                  <Select value={selectedReason} onValueChange={setSelectedReason}>
                    <SelectTrigger data-testid="select-reason">
                      <SelectValue placeholder="Reason" />
                    </SelectTrigger>
                    <SelectContent>
                      {RETURN_REASONS.map((reason) => (
                        <SelectItem key={reason} value={reason}>
                          {reason}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button type="button" onClick={addLineItem} data-testid="button-add-item">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {lineItems.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lineItems.map((item, index) => (
                        <TableRow key={index} data-testid={`row-item-${index}`}>
                          <TableCell>{item.productName}</TableCell>
                          <TableCell className="text-right font-mono">
                            {item.quantity}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            Rs {item.unitPrice.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            Rs {item.total.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{item.reason}</Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => removeLineItem(index)}
                              data-testid={`button-remove-item-${index}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                {lineItems.length > 0 && (
                  <div className="flex justify-end">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Total Credit Amount</p>
                      <p className="text-2xl font-bold font-mono" data-testid="text-total-amount">
                        Rs {totalAmount.toFixed(2)}
                      </p>
                    </div>
                  </div>
                )}
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
                  data-testid="button-submit-return"
                >
                  {createMutation.isPending ? "Creating..." : "Create Return"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
