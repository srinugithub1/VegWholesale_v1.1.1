import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Plus, Search, Pencil, Trash2, Users, Phone, Mail, MapPin } from "lucide-react";
import { insertVendorSchema, type Vendor, type InsertVendor } from "@shared/schema";

export default function Vendors() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [deleteVendor, setDeleteVendor] = useState<Vendor | null>(null);

  const { data: vendors = [], isLoading } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  const form = useForm<InsertVendor>({
    resolver: zodResolver(insertVendorSchema),
    defaultValues: {
      name: "",
      phone: "",
      address: "",
      email: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertVendor) => {
      return apiRequest("POST", "/api/vendors", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      setIsDialogOpen(false);
      form.reset();
      toast({ title: "Vendor added successfully" });
    },
    onError: () => {
      toast({ title: "Failed to add vendor", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: InsertVendor }) => {
      return apiRequest("PATCH", `/api/vendors/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      setIsDialogOpen(false);
      setEditingVendor(null);
      form.reset();
      toast({ title: "Vendor updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update vendor", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/vendors/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      setDeleteVendor(null);
      toast({ title: "Vendor deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete vendor", variant: "destructive" });
    },
  });

  const filteredVendors = vendors.filter(
    (vendor) =>
      vendor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vendor.phone.includes(searchQuery)
  );

  const openEditDialog = (vendor: Vendor) => {
    setEditingVendor(vendor);
    form.reset({
      name: vendor.name,
      phone: vendor.phone,
      address: vendor.address || "",
      email: vendor.email || "",
    });
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingVendor(null);
    form.reset({
      name: "",
      phone: "",
      address: "",
      email: "",
    });
    setIsDialogOpen(true);
  };

  const onSubmit = (data: InsertVendor) => {
    if (editingVendor) {
      updateMutation.mutate({ id: editingVendor.id, data });
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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Vendors</h1>
          <p className="text-sm text-muted-foreground">
            Manage your suppliers and farmers
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog} data-testid="button-add-vendor">
              <Plus className="h-4 w-4 mr-2" />
              Add Vendor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingVendor ? "Edit Vendor" : "Add New Vendor"}
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
                            placeholder="Vendor name"
                            {...field}
                            data-testid="input-vendor-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Phone number"
                            {...field}
                            data-testid="input-vendor-phone"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Email address"
                          type="email"
                          {...field}
                          value={field.value || ""}
                          data-testid="input-vendor-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Full address"
                          {...field}
                          value={field.value || ""}
                          data-testid="input-vendor-address"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                    data-testid="button-submit-vendor"
                  >
                    {createMutation.isPending || updateMutation.isPending
                      ? "Saving..."
                      : editingVendor
                      ? "Update"
                      : "Add Vendor"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search vendors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-vendors"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredVendors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mb-4" />
              <p className="text-lg font-medium">No vendors found</p>
              <p className="text-sm">
                {searchQuery
                  ? "Try a different search term"
                  : "Add your first vendor to get started"}
              </p>
              {!searchQuery && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={openCreateDialog}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Vendor
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVendors.map((vendor) => (
                  <TableRow key={vendor.id} data-testid={`row-vendor-${vendor.id}`}>
                    <TableCell className="font-medium">{vendor.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        {vendor.phone}
                      </div>
                    </TableCell>
                    <TableCell>
                      {vendor.email ? (
                        <div className="flex items-center gap-2">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          {vendor.email}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {vendor.address ? (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span className="truncate max-w-[200px]">
                            {vendor.address}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(vendor)}
                          data-testid={`button-edit-vendor-${vendor.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteVendor(vendor)}
                          data-testid={`button-delete-vendor-${vendor.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteVendor} onOpenChange={() => setDeleteVendor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Vendor</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteVendor?.name}"? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteVendor && deleteMutation.mutate(deleteVendor.id)}
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
