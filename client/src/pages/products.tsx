import { useState } from "react";
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
import { Plus, Search, Pencil, Trash2, Package, AlertTriangle } from "lucide-react";
import { insertProductSchema, type Product, type InsertProduct } from "@shared/schema";
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
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

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

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-products"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden">
          {filteredProducts.length === 0 ? (
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
                    <TableHead>Product</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Purchase Price</TableHead>
                    <TableHead className="text-right">Sale Price</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => {
                    const isLowStock = product.currentStock <= (product.reorderLevel || 10);
                    return (
                      <TableRow key={product.id} data-testid={`row-product-${product.id}`}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {product.unit}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          ₹{product.purchasePrice.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          ₹{product.salePrice.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {product.currentStock.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {isLowStock ? (
                            <div className="flex items-center gap-1 text-chart-2">
                              <AlertTriangle className="h-3 w-3" />
                              <span className="text-xs">Low</span>
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              OK
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(product)}
                              data-testid={`button-edit-product-${product.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteProduct(product)}
                              data-testid={`button-delete-product-${product.id}`}
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
          </CardContent>
        </Card>
      </div>

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
    </div>
  );
}
