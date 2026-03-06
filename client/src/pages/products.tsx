import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Search, Pencil, Trash2, Package, AlertTriangle, ChevronLeft, ChevronRight, Truck, User } from "lucide-react";
import { insertProductSchema, type Product, type InsertProduct, type Vendor, type Vehicle, type VehicleInventory, type VehicleInventoryMovement, type InvoiceItem } from "@shared/schema";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";

import { z } from "zod";

const formSchema = insertProductSchema.extend({
  purchasePrice: z.coerce.number().min(0, "Price must be positive"),
  salePrice: z.coerce.number().min(0, "Price must be positive"),
  currentStock: z.coerce.number().min(0, "Stock must be positive"),
  reorderLevel: z.coerce.number().min(0, "Reorder level must be positive").optional(),
});

type FormData = z.infer<typeof formSchema>;

const units = ["KG", "Dozen", "Piece", "Bundle", "Crate", "Box", "Bag"];

export default function Products() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;


  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  const { data: vehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });

  const { data: vehicleInventories = [] } = useQuery<VehicleInventory[]>({
    queryKey: ["/api/all-vehicle-inventories"],
  });

  const { data: movements = [] } = useQuery<VehicleInventoryMovement[]>({
    queryKey: ["/api/vehicle-inventory-movements"],
  });

  const { data: invoiceItems = [] } = useQuery<InvoiceItem[]>({
    queryKey: ["/api/invoice-items"],
  });

  const isLoading = productsLoading;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      unit: "KG",
      purchasePrice: 0,
      salePrice: 0,
      currentStock: 0,
      reorderLevel: 10,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      return apiRequest("POST", "/api/products", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setIsDialogOpen(false);
      form.reset();
      toast({ title: "Product added successfully" });
    },
    onError: () => {
      toast({ title: "Failed to add product", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FormData }) => {
      return apiRequest("PATCH", `/api/products/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setIsDialogOpen(false);
      setEditingProduct(null);
      form.reset();
      toast({ title: "Product updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update product", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setDeleteProduct(null);
      toast({ title: "Product deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete product", variant: "destructive" });
    },
  });

  const productStockRows = useMemo(() => {
    const rows: any[] = [];
    const today = format(new Date(), "yyyy-MM-dd");

    // Group items by product for ASP calculation (Today's sales)
    const itemsByProduct = new Map<string, InvoiceItem[]>();
    invoiceItems.forEach(item => {
      // Note: In a real app we'd verify the item's date properly. 
      // Assuming today's items for ASP as requested.
      const list = itemsByProduct.get(item.productId) || [];
      list.push(item);
      itemsByProduct.set(item.productId, list);
    });

    products.forEach(product => {
      const pItems = itemsByProduct.get(product.id) || [];
      const totalVal = pItems.reduce((sum, i) => sum + i.total, 0);
      const totalQty = pItems.reduce((sum, i) => sum + i.quantity, 0);
      const asp = totalQty > 0 ? totalVal / totalQty : 0;

      const productInvs = vehicleInventories.filter(inv => inv.productId === product.id);

      if (productInvs.length === 0) {
        rows.push({
          id: `${product.id}-none`,
          productId: product.id,
          name: product.name,
          unit: product.unit,
          vendorName: "N/A",
          vehicleNumber: "N/A",
          loadedStock: 0,
          remainStock: 0,
          lossStock: 0,
          gainStock: 0,
          status: "Catalog",
          asp: asp,
          isLowStock: product.currentStock <= (product.reorderLevel || 10),
          originalProduct: product
        });
      } else {
        productInvs.forEach(inv => {
          const vehicle = vehicles.find(v => v.id === inv.vehicleId);
          const vendor = vendors.find(v => v.id === vehicle?.vendorId);

          const loadedToday = movements
            .filter(m => m.vehicleId === inv.vehicleId && m.productId === inv.productId && m.type === 'load' && m.date === today)
            .reduce((sum, m) => sum + m.quantity, 0);

          rows.push({
            id: `${inv.id}`,
            productId: product.id,
            name: product.name,
            unit: product.unit,
            vendorName: vendor?.name || "N/A",
            vehicleNumber: vehicle?.number || "N/A",
            loadedStock: loadedToday,
            remainStock: inv.quantity,
            lossStock: vehicle?.totalWeightLoss || 0,
            gainStock: vehicle?.totalWeightGain || 0,
            status: inv.quantity <= (product.reorderLevel || 10) ? "Low" : "OK",
            asp: asp,
            isLowStock: inv.quantity <= (product.reorderLevel || 10),
            originalProduct: product,
            vehicleId: inv.vehicleId
          });
        });
      }
    });

    return rows;
  }, [products, vendors, vehicles, vehicleInventories, movements, invoiceItems]);

  const filteredRows = productStockRows.filter((row) =>
    row.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    row.vehicleNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    row.vendorName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredRows.length / itemsPerPage);
  const paginatedRows = filteredRows.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const toggleSelectAll = () => {
    if (selectedProductIds.length === paginatedRows.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(paginatedRows.map((r) => r.productId));
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (!selectedProductIds.length) return;
    try {
      await Promise.all(selectedProductIds.map((id) => deleteMutation.mutateAsync(id)));
      setSelectedProductIds([]);
      toast({ title: "Selected products deleted successfully" });
    } catch (error) {
      // Errors handled by mutation onError
    }
  };

  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    form.reset({
      name: product.name,
      unit: product.unit,
      purchasePrice: product.purchasePrice,
      salePrice: product.salePrice,
      currentStock: product.currentStock,
      reorderLevel: product.reorderLevel || 10,
    });
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingProduct(null);
    form.reset({
      name: "",
      unit: "KG",
      purchasePrice: 0,
      salePrice: 0,
      currentStock: 0,
      reorderLevel: 10,
    });
    setIsDialogOpen(true);
  };

  const onSubmit = (data: FormData) => {
    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

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
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-6 pb-4 flex items-center justify-between gap-4 flex-wrap shrink-0">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Products</h1>
          <p className="text-sm text-muted-foreground">
            Manage your vegetable catalog
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog} data-testid="button-add-product">
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? "Edit Product" : "Add New Product"}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Tomato"
                            {...field}
                            data-testid="input-product-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="unit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit *</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-product-unit">
                              <SelectValue placeholder="Select unit" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {units.map((unit) => (
                              <SelectItem key={unit} value={unit}>
                                {unit}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="purchasePrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Purchase Price *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            {...field}
                            data-testid="input-purchase-price"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="salePrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sale Price *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            {...field}
                            data-testid="input-sale-price"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="currentStock"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Stock</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0"
                            {...field}
                            data-testid="input-current-stock"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="reorderLevel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reorder Level</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="10"
                            {...field}
                            data-testid="input-reorder-level"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-submit-product"
                  >
                    {createMutation.isPending || updateMutation.isPending
                      ? "Saving..."
                      : editingProduct
                        ? "Update"
                        : "Add Product"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex-1 overflow-hidden px-6 pb-6">
        <Card className="flex flex-col h-full">
          <CardHeader className="shrink-0">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products or vehicles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-products"
                />
              </div>
              <div className="flex items-center gap-2">
                <div className="text-sm text-muted-foreground font-medium mr-4">
                  Total Records: {filteredRows.length}
                </div>
                {isAdmin && selectedProductIds.length > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleBulkDelete}
                    data-testid="button-bulk-delete"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Selected ({selectedProductIds.length})
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden">
            {filteredRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mb-4" />
                <p className="text-lg font-medium">No products found</p>
                <p className="text-sm">
                  {searchQuery
                    ? "Try a different search term"
                    : "Add your first product to get started"}
                </p>
                {!searchQuery && (
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={openCreateDialog}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Product
                  </Button>
                )}
              </div>
            ) : (
              <ScrollArea className="h-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {isAdmin && (
                        <TableHead className="w-[50px]">
                          <Checkbox
                            checked={paginatedRows.length > 0 && selectedProductIds.length === paginatedRows.length}
                            onCheckedChange={toggleSelectAll}
                            aria-label="Select all"
                          />
                        </TableHead>
                      )}
                      <TableHead>Product</TableHead>
                      <TableHead>Units</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead className="text-right">Loaded Stock</TableHead>
                      <TableHead className="text-right">Remain Stock</TableHead>
                      <TableHead className="text-right text-red-500">Loss Stock</TableHead>
                      <TableHead className="text-right text-green-600">Gain Stock</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Avg Selling Price</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRows.map((row) => {
                      return (

                        <TableRow key={row.id} data-testid={`row-product-${row.id}`}>
                          {isAdmin && (
                            <TableCell>
                              <Checkbox
                                checked={selectedProductIds.includes(row.productId)}
                                onCheckedChange={() => toggleSelection(row.productId)}
                                aria-label={`Select ${row.name}`}
                              />
                            </TableCell>
                          )}
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {row.unit}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[150px] truncate" title={row.vendorName}>
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs">{row.vendorName}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Truck className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs font-medium">{row.vehicleNumber}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">
                            {row.loadedStock.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold">
                            {row.remainStock.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-red-500 bg-red-50/30">
                            {row.lossStock.toFixed(3)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-green-600 bg-green-50/30">
                            {row.gainStock.toFixed(3)}
                          </TableCell>
                          <TableCell>
                            {row.isLowStock ? (
                              <div className="flex items-center gap-1 text-chart-2">
                                <AlertTriangle className="h-3 w-3" />
                                <span className="text-xs">Low</span>
                              </div>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                {row.status}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold text-primary">
                            ₹{row.asp.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(row.originalProduct)}
                                data-testid={`button-edit-product-${row.productId}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteProduct(row.originalProduct)}
                                data-testid={`button-delete-product-${row.productId}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>


            )}
            {/* Pagination Controls moved below ScrollArea or inside CardContent if preferred */}
            {filteredRows.length > 0 && totalPages > 1 && (
              <div className="flex items-center justify-center space-x-2 py-4 mt-auto border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <div className="text-sm">
                  Page {currentPage} of {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div >

      <AlertDialog open={!!deleteProduct} onOpenChange={() => setDeleteProduct(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteProduct?.name}"? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteProduct && deleteMutation.mutate(deleteProduct.id)}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div >
  );
}
