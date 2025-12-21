import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { Plus, Search, Pencil, Trash2, Truck, Phone, User } from "lucide-react";
import { insertVehicleSchema, type Vehicle, type InsertVehicle } from "@shared/schema";

export default function Vehicles() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [deleteVehicle, setDeleteVehicle] = useState<Vehicle | null>(null);

  const { data: vehicles = [], isLoading } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });

  const form = useForm<InsertVehicle>({
    resolver: zodResolver(insertVehicleSchema),
    defaultValues: {
      number: "",
      type: "",
      capacity: "",
      driverName: "",
      driverPhone: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertVehicle) => {
      return apiRequest("POST", "/api/vehicles", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      setIsDialogOpen(false);
      form.reset();
      toast({ title: "Vehicle added successfully" });
    },
    onError: () => {
      toast({ title: "Failed to add vehicle", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: InsertVehicle }) => {
      return apiRequest("PATCH", `/api/vehicles/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      setIsDialogOpen(false);
      setEditingVehicle(null);
      form.reset();
      toast({ title: "Vehicle updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update vehicle", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/vehicles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      setDeleteVehicle(null);
      toast({ title: "Vehicle deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete vehicle", variant: "destructive" });
    },
  });

  const filteredVehicles = vehicles.filter(
    (vehicle) =>
      vehicle.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (vehicle.driverName?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const openEditDialog = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    form.reset({
      number: vehicle.number,
      type: vehicle.type,
      capacity: vehicle.capacity || "",
      driverName: vehicle.driverName || "",
      driverPhone: vehicle.driverPhone || "",
    });
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingVehicle(null);
    form.reset({
      number: "",
      type: "",
      capacity: "",
      driverName: "",
      driverPhone: "",
    });
    setIsDialogOpen(true);
  };

  const onSubmit = (data: InsertVehicle) => {
    if (editingVehicle) {
      updateMutation.mutate({ id: editingVehicle.id, data });
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
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Vehicles</h1>
          <p className="text-sm text-muted-foreground">
            Manage vehicles for stock receiving
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog} data-testid="button-add-vehicle">
              <Plus className="h-4 w-4 mr-2" />
              Add Vehicle
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingVehicle ? "Edit Vehicle" : "Add New Vehicle"}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vehicle Number *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., MH12AB1234"
                            {...field}
                            data-testid="input-vehicle-number"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Truck, Tempo, Van"
                            {...field}
                            data-testid="input-vehicle-type"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="capacity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Capacity</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., 2 Tons"
                          {...field}
                          value={field.value || ""}
                          data-testid="input-vehicle-capacity"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="driverName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Driver Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Driver's name"
                            {...field}
                            value={field.value || ""}
                            data-testid="input-driver-name"
                          />
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
                          <Input
                            placeholder="Driver's phone"
                            {...field}
                            value={field.value || ""}
                            data-testid="input-driver-phone"
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
                    data-testid="button-submit-vehicle"
                  >
                    {createMutation.isPending || updateMutation.isPending
                      ? "Saving..."
                      : editingVehicle
                      ? "Update"
                      : "Add Vehicle"}
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
                placeholder="Search vehicles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-vehicles"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredVehicles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Truck className="h-12 w-12 mb-4" />
              <p className="text-lg font-medium">No vehicles found</p>
              <p className="text-sm">
                {searchQuery
                  ? "Try a different search term"
                  : "Add your first vehicle to get started"}
              </p>
              {!searchQuery && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={openCreateDialog}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Vehicle
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehicle Number</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Driver Phone</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVehicles.map((vehicle) => (
                  <TableRow key={vehicle.id} data-testid={`row-vehicle-${vehicle.id}`}>
                    <TableCell className="font-medium font-mono">
                      {vehicle.number}
                    </TableCell>
                    <TableCell>{vehicle.type}</TableCell>
                    <TableCell>
                      {vehicle.capacity || (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {vehicle.driverName ? (
                        <div className="flex items-center gap-2">
                          <User className="h-3 w-3 text-muted-foreground" />
                          {vehicle.driverName}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {vehicle.driverPhone ? (
                        <div className="flex items-center gap-2">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {vehicle.driverPhone}
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
                          onClick={() => openEditDialog(vehicle)}
                          data-testid={`button-edit-vehicle-${vehicle.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteVehicle(vehicle)}
                          data-testid={`button-delete-vehicle-${vehicle.id}`}
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

      <AlertDialog open={!!deleteVehicle} onOpenChange={() => setDeleteVehicle(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Vehicle</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete vehicle "{deleteVehicle?.number}"? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteVehicle && deleteMutation.mutate(deleteVehicle.id)}
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
