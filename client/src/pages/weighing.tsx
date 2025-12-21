// ... imports
import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Scale, Plus, Trash2, Truck, User, FileText, Wifi, WifiOff, RefreshCw, HandCoins, Settings } from "lucide-react";
import type { Vehicle, Customer, Product, VehicleInventory } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Package } from "lucide-react";
import { useScale } from "@/hooks/use-scale";

type WeighingItem = {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
};

// Unit classification helpers
const WEIGHT_UNITS = ["KG", "Kg", "kg"];
const COUNT_UNITS = ["Box", "Bag", "Crate", "Piece", "Dozen", "Bundle"];

const isWeightBasedUnit = (unit: string): boolean => {
  return WEIGHT_UNITS.some(u => u.toLowerCase() === unit.toLowerCase());
};

const getUnitLabel = (unit: string): string => {
  if (isWeightBasedUnit(unit)) return "Weight";
  return "Quantity";
};

export default function Weighing() {
  const { toast } = useToast();
  const [selectedVehicle, setSelectedVehicle] = useState<string>("");
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [weighingItems, setWeighingItems] = useState<WeighingItem[]>([]);
  // Hamali charge state - simplified with rate per KG and two checkboxes
  const [includeHamali, setIncludeHamali] = useState(false);
  const [hamaliRatePerKg, setHamaliRatePerKg] = useState("2"); // Rate per KG
  const [hamaliPaidByCash, setHamaliPaidByCash] = useState(false);

  // Real scale connection using Web Serial API
  // Hooks handles both Real and Demo modes now
  const scale = useScale();

  // Local state for UI display (syncs with scale hook)
  const [scaleSettingsOpen, setScaleSettingsOpen] = useState(false);

  // Live weight display
  const liveWeight = scale.currentWeight || 0;
  const weightStable = scale.isConnected && scale.currentWeight !== null;

  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });

  const { data: customers = [], isLoading: customersLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  // Vehicle inventory query
  const { data: vehicleInventoryData = [], isLoading: inventoryLoading } = useQuery<VehicleInventory[]>({
    queryKey: ["/api/vehicles", selectedVehicle, "inventory"],
    queryFn: async () => {
      if (!selectedVehicle) return [];
      const res = await fetch(`/api/vehicles/${selectedVehicle}/inventory`);
      return res.json();
    },
    enabled: !!selectedVehicle,
  });

  // Calculate remaining inventory (account for items added to current bill)
  const getVehicleStock = (productId: string): number => {
    const inventoryItem = vehicleInventoryData.find(inv => inv.productId === productId);
    const baseQty = inventoryItem?.quantity || 0;
    const usedQty = weighingItems
      .filter(item => item.productId === productId)
      .reduce((sum, item) => sum + item.quantity, 0);
    return Math.max(0, baseQty - usedQty);
  };

  // Get selected product details
  const selectedProductData = products.find(p => p.id === selectedProduct);
  const isWeightBased = selectedProductData ? isWeightBasedUnit(selectedProductData.unit) : true;

  const toggleScaleConnection = async () => {
    if (scale.isConnected) {
      await scale.disconnect();
      toast({ title: "Scale Disconnected" });
    } else {
      const success = await scale.connect();
      if (success) {
        if (scale.isDemoMode) {
          toast({
            title: "Demo Mode Active",
            description: "Simulating weight readings.",
          });
        } else {
          toast({ title: "Scale Connected", description: "Weighing machine connected successfully." });
        }
      } else if (scale.error) {
        // Error toast is handled by usage site or we can show it here
        toast({ title: "Connection Failed", description: scale.error, variant: "destructive" });
      }
    }
  };

  const captureWeight = () => {
    // Only allow weight capture for weight-based products
    if (!isWeightBased) {
      toast({
        title: "Scale Not Applicable",
        description: "This product uses count-based units. Please enter quantity manually.",
        variant: "destructive",
      });
      return;
    }

    if (weightStable && liveWeight > 0) {
      setQuantity(liveWeight.toFixed(2));
      toast({
        title: "Weight Captured",
        description: `Captured ${liveWeight.toFixed(2)} KG from scale`,
      });
    } else {
      toast({
        title: "Weight Not Stable",
        description: "Please wait for the weight to stabilize before capturing.",
        variant: "destructive",
      });
    }
  };

  // ... createInvoice mutation and other helper functions (omitted for brevity as they are unchanged)

  const createInvoice = useMutation({
    mutationFn: async (data: {
      customerId: string;
      vehicleId?: string;
      invoiceNumber: string;
      date: string;
      subtotal: number;
      includeHamaliCharge: boolean;
      hamaliRatePerKg: number;
      hamaliChargeAmount: number;
      hamaliPaidByCash: boolean;
      totalKgWeight: number;
      grandTotal: number;
      items: { productId: string; quantity: number; unitPrice: number; total: number }[];
    }) => {
      return apiRequest("POST", "/api/invoices", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles", selectedVehicle, "inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hamali-cash"] });
      setWeighingItems([]);
      setSelectedCustomer("");
      setSelectedVehicle("");
      setIncludeHamali(false);
      setHamaliPaidByCash(false);
      toast({ title: "Invoice Created", description: "Weighing completed and invoice generated successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create invoice.", variant: "destructive" });
    },
  });

  const getProduct = (id: string) => products.find((p) => p.id === id);

  const addWeighingItem = () => {
    if (!selectedProduct || !quantity || parseFloat(quantity) <= 0) {
      const productUnit = selectedProductData?.unit || "KG";
      const label = isWeightBasedUnit(productUnit) ? "weight" : "quantity";
      toast({ title: "Invalid Entry", description: `Please select a product and enter a valid ${label}.`, variant: "destructive" });
      return;
    }

    const product = getProduct(selectedProduct);
    if (!product) return;

    const qtyNum = parseFloat(quantity);

    // Check vehicle inventory if a vehicle is selected
    if (selectedVehicle && vehicleInventoryData.length > 0) {
      const remainingStock = getVehicleStock(selectedProduct);
      if (qtyNum > remainingStock) {
        toast({
          title: "Insufficient Stock",
          description: `Only ${remainingStock.toFixed(2)} ${product.unit} available in the selected vehicle.`,
          variant: "destructive"
        });
        return;
      }
    }

    const total = qtyNum * product.salePrice;

    const newItem: WeighingItem = {
      id: Date.now().toString(),
      productId: product.id,
      productName: product.name,
      quantity: qtyNum,
      unit: product.unit,
      unitPrice: product.salePrice,
      total,
    };

    setWeighingItems([...weighingItems, newItem]);
    setSelectedProduct("");
    setQuantity("");
  };

  const incrementQuantity = () => {
    const current = parseFloat(quantity) || 0;
    setQuantity((current + 1).toString());
  };

  const decrementQuantity = () => {
    const current = parseFloat(quantity) || 0;
    if (current > 0) {
      setQuantity(Math.max(0, current - 1).toString());
    }
  };

  const removeWeighingItem = (id: string) => {
    setWeighingItems(weighingItems.filter((item) => item.id !== id));
  };

  const subtotal = weighingItems.reduce((sum, item) => sum + item.total, 0);

  // Calculate total KG weight from weight-based items only
  const totalKgWeight = weighingItems
    .filter(item => isWeightBasedUnit(item.unit))
    .reduce((sum, item) => sum + item.quantity, 0);

  // Calculate Hamali amount based on rate per KG
  const hamaliAmount = includeHamali ? totalKgWeight * parseFloat(hamaliRatePerKg || "0") : 0;

  // Grand total: Add hamali only if NOT paid by cash
  // If paid by cash, hamali is recorded separately and not added to invoice
  const grandTotal = subtotal + (includeHamali && !hamaliPaidByCash ? hamaliAmount : 0);

  const handleGenerateInvoice = () => {
    if (!selectedCustomer) {
      toast({ title: "Select Customer", description: "Please select a customer for this invoice.", variant: "destructive" });
      return;
    }

    if (weighingItems.length === 0) {
      toast({ title: "No Items", description: "Please add at least one item to the invoice.", variant: "destructive" });
      return;
    }

    const invoiceNumber = `INV-${Date.now().toString().slice(-8)}`;
    const today = new Date().toISOString().split("T")[0];

    createInvoice.mutate({
      customerId: selectedCustomer,
      vehicleId: selectedVehicle || undefined,
      invoiceNumber,
      date: today,
      subtotal,
      includeHamaliCharge: includeHamali,
      hamaliRatePerKg: parseFloat(hamaliRatePerKg || "0"),
      hamaliChargeAmount: hamaliAmount,
      hamaliPaidByCash,
      totalKgWeight,
      grandTotal,
      items: weighingItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
      })),
    });
  };

  if (vehiclesLoading || customersLoading || productsLoading) {
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
        <div className="flex items-center gap-3">
          <Scale className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold" data-testid="text-page-title">
              Weighing Station
            </h1>
            <p className="text-sm text-muted-foreground">Take products from vehicle, weigh, and bill customer</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="demo-mode" className="text-sm text-muted-foreground">Demo Mode</Label>
            <Switch
              id="demo-mode"
              checked={scale.isDemoMode}
              onCheckedChange={scale.toggleDemoMode}
              data-testid="switch-demo-mode"
            />
          </div>
          <Badge variant={scale.isConnected ? "default" : "secondary"} className="gap-1">
            {scale.isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {scale.isConnected ? "Scale Connected" : "Scale Disconnected"}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Live Scale Display */}
          <Card className={scale.isConnected ? "border-primary" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Scale className="h-4 w-4" />
                  Live Scale Reading
                  {scale.isDemoMode && <Badge variant="outline" className="text-xs">Demo</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  {!scale.isDemoMode && !scale.isConnected && (
                    <Dialog open={scaleSettingsOpen} onOpenChange={setScaleSettingsOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="icon" data-testid="button-scale-settings">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Scale Settings</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <p className="text-sm text-muted-foreground">
                            Configure your weighing machine connection settings. Check your scale manual for correct values.
                          </p>
                          <div className="grid gap-4">
                            <div className="flex items-center justify-between">
                              <Label>Baud Rate</Label>
                              <Select value={scale.settings.baudRate.toString()} onValueChange={(v) => scale.updateSettings({ baudRate: parseInt(v) })}>
                                <SelectTrigger className="w-40" data-testid="select-baud-rate">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="9600">9600 (Common)</SelectItem>
                                  <SelectItem value="4800">4800</SelectItem>
                                  <SelectItem value="19200">19200</SelectItem>
                                  <SelectItem value="115200">115200</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex items-center justify-between">
                              <Label>Data Bits</Label>
                              <Select value={scale.settings.dataBits.toString()} onValueChange={(v) => scale.updateSettings({ dataBits: parseInt(v) as 7 | 8 })}>
                                <SelectTrigger className="w-40" data-testid="select-data-bits">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="8">8 (Common)</SelectItem>
                                  <SelectItem value="7">7</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex items-center justify-between">
                              <Label>Parity</Label>
                              <Select value={scale.settings.parity} onValueChange={(v) => scale.updateSettings({ parity: v as "none" | "even" | "odd" })}>
                                <SelectTrigger className="w-40" data-testid="select-parity">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">None (Common)</SelectItem>
                                  <SelectItem value="even">Even</SelectItem>
                                  <SelectItem value="odd">Odd</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="space-y-0.5">
                                <Label>Weight Multiplier</Label>
                                <p className="text-[10px] text-muted-foreground">Fix decimal issues (e.g. 10 or 0.1)</p>
                              </div>
                              <Input
                                type="number"
                                className="w-40"
                                step="0.001"
                                value={scale.settings.multiplier || 1}
                                onChange={(e) => scale.updateSettings({ multiplier: parseFloat(e.target.value) || 1 })}
                                data-testid="input-multiplier"
                              />
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Settings are saved automatically. Works with USB/Serial scales in Chrome/Edge browsers.
                          </p>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                  <Button
                    variant={scale.isConnected ? "destructive" : "default"}
                    size="sm"
                    onClick={toggleScaleConnection}
                    disabled={!scale.isDemoMode && scale.isConnecting}
                    data-testid="button-toggle-scale"
                  >
                    {!scale.isDemoMode && scale.isConnecting ? "Connecting..." : scale.isConnected ? "Disconnect" : "Connect Scale"}
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <div className={`text-5xl font-mono font-bold text-center py-6 rounded-md ${scale.isConnected
                    ? weightStable
                      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                      : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400"
                    : "bg-muted text-muted-foreground"
                    }`} data-testid="display-live-weight">
                    {scale.isConnected ? `${liveWeight.toFixed(2)} KG` : "-- KG"}
                  </div>
                  <div className="text-center mt-2 text-sm">
                    {scale.isConnected ? (
                      weightStable ? (
                        <span className="text-green-600 dark:text-green-400">Weight Stable</span>
                      ) : (
                        <span className="text-yellow-600 dark:text-yellow-400 flex items-center justify-center gap-1">
                          <RefreshCw className="h-3 w-3 animate-spin" />
                          Stabilizing...
                        </span>
                      )
                    ) : (
                      <span className="text-muted-foreground">Scale not connected</span>
                    )}
                  </div>
                </div>
                <Button
                  size="lg"
                  onClick={captureWeight}
                  disabled={!scale.isConnected || !weightStable || liveWeight <= 0 || !isWeightBased}
                  className="min-w-[150px]"
                  data-testid="button-capture-weight"
                >
                  <Scale className="h-4 w-4 mr-2" />
                  Capture Weight
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Step 1: Select Vehicle & Customer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Vehicle (Parked Near Shop)</Label>
                  <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                    <SelectTrigger data-testid="select-vehicle">
                      <SelectValue placeholder="Select vehicle" />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicles.map((vehicle) => (
                        <SelectItem key={vehicle.id} value={vehicle.id}>
                          {vehicle.number} - {vehicle.driverName || vehicle.type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Customer</Label>
                  <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
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
              </div>

              {/* Vehicle Inventory Display */}
              {selectedVehicle && (
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-primary" />
                      <span className="font-medium">Products Available in Vehicle</span>
                    </div>
                    {inventoryLoading && <Badge variant="outline">Loading...</Badge>}
                  </div>
                  {vehicleInventoryData.length === 0 && !inventoryLoading ? (
                    <div className="text-center py-4 bg-muted/50 rounded-md">
                      <Package className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">No products loaded in this vehicle</p>
                      <p className="text-xs text-muted-foreground mt-1">Create a purchase order with this vehicle to load products</p>
                    </div>
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead className="text-right">Available Qty</TableHead>
                            <TableHead className="text-right">Unit</TableHead>
                            <TableHead className="text-right">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {vehicleInventoryData.map((inv) => {
                            const product = products.find(p => p.id === inv.productId);
                            const remaining = getVehicleStock(inv.productId);
                            return (
                              <TableRow
                                key={inv.id}
                                data-testid={`vehicle-stock-${inv.productId}`}
                              >
                                <TableCell className="font-medium">{product?.name || "Unknown Product"}</TableCell>
                                <TableCell className="text-right font-mono text-lg font-semibold">
                                  {remaining.toFixed(2)}
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground">
                                  {product?.unit || "KG"}
                                </TableCell>
                                <TableCell className="text-right">
                                  {remaining > (product?.reorderLevel || 10) ? (
                                    <Badge variant="default" className="bg-green-600">In Stock</Badge>
                                  ) : remaining > 0 ? (
                                    <Badge variant="secondary" className="bg-yellow-500 text-yellow-950">Low Stock</Badge>
                                  ) : (
                                    <Badge variant="destructive">Out of Stock</Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-4 w-4" />
                Step 2: Add Products to Bill
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="space-y-2 md:col-span-2">
                  <Label>Product</Label>
                  <Select value={selectedProduct} onValueChange={(val) => { setSelectedProduct(val); setQuantity(""); }}>
                    <SelectTrigger data-testid="select-product">
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} - {product.salePrice.toLocaleString("en-IN", { style: "currency", currency: "INR" })}/{product.unit}
                          {!isWeightBasedUnit(product.unit) && <Badge variant="outline" className="ml-2 text-xs">{product.unit}</Badge>}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>
                    {selectedProductData ? getUnitLabel(selectedProductData.unit) : "Quantity"} ({selectedProductData?.unit || "KG"})
                  </Label>
                  {isWeightBased ? (
                    <Input
                      type="number"
                      step="0.01"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder={scale.isConnected ? "From scale" : "Enter weight"}
                      data-testid="input-quantity"
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={decrementQuantity}
                        data-testid="button-decrement"
                      >
                        -
                      </Button>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder="0"
                        className="text-center"
                        data-testid="input-quantity"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={incrementQuantity}
                        data-testid="button-increment"
                      >
                        +
                      </Button>
                    </div>
                  )}
                </div>
                <Button onClick={addWeighingItem} data-testid="button-add-item">
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </div>

              {/* Show scale capture hint for weight-based products */}
              {isWeightBased && selectedProduct && (
                <p className="text-sm text-muted-foreground mt-2">
                  {scale.isConnected
                    ? "Use 'Capture Weight' button above to get weight from scale, or enter manually."
                    : "Connect scale to capture weight automatically, or enter weight manually."}
                </p>
              )}

              {/* Show count hint for count-based products */}
              {!isWeightBased && selectedProduct && (
                <p className="text-sm text-muted-foreground mt-2">
                  Enter the number of {selectedProductData?.unit.toLowerCase()}s for this product.
                </p>
              )}

              <div className="mt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {weighingItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No items added yet. Select a product and enter quantity to add.
                        </TableCell>
                      </TableRow>
                    ) : (
                      weighingItems.map((item) => (
                        <TableRow key={item.id} data-testid={`row-item-${item.id}`}>
                          <TableCell className="font-medium">{item.productName}</TableCell>
                          <TableCell className="text-right font-mono">
                            {isWeightBasedUnit(item.unit) ? item.quantity.toFixed(2) : item.quantity} {item.unit}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {item.unitPrice.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            {item.total.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => removeWeighingItem(item.id)}
                              data-testid={`button-remove-${item.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Customer Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedCustomer ? (
                <div className="space-y-2">
                  <p className="font-medium">
                    {customers.find((c) => c.id === selectedCustomer)?.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {customers.find((c) => c.id === selectedCustomer)?.phone}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {customers.find((c) => c.id === selectedCustomer)?.address}
                  </p>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Select a customer</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Invoice Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between gap-2 text-sm">
                  <span>Items</span>
                  <Badge variant="secondary">{weighingItems.length}</Badge>
                </div>
                <div className="flex justify-between gap-2 text-sm">
                  <span>Subtotal</span>
                  <span className="font-mono" data-testid="text-subtotal">
                    {subtotal.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                  </span>
                </div>
              </div>

              {/* Hamali Charge Section */}
              <div className="space-y-3 pt-3 border-t">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="includeHamali"
                    checked={includeHamali}
                    onChange={(e) => {
                      setIncludeHamali(e.target.checked);
                      if (!e.target.checked) {
                        setHamaliPaidByCash(false);
                      }
                    }}
                    className="rounded"
                    data-testid="checkbox-include-hamali"
                  />
                  <Label htmlFor="includeHamali" className="text-sm">Include Hamali</Label>
                </div>

                {includeHamali && (
                  <div className="space-y-3 pl-5">
                    <div className="flex justify-between gap-2 text-sm">
                      <span className="text-muted-foreground">Total Weight:</span>
                      <span className="font-mono font-medium" data-testid="text-total-kg">
                        {totalKgWeight.toFixed(2)} KG
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Rate:</span>
                      <Input
                        type="number"
                        step="0.01"
                        value={hamaliRatePerKg}
                        onChange={(e) => setHamaliRatePerKg(e.target.value)}
                        className="w-20"
                        data-testid="input-hamali-rate-per-kg"
                      />
                      <span className="text-sm text-muted-foreground">per KG</span>
                    </div>

                    <div className="flex justify-between gap-2 text-sm">
                      <span className="font-medium">Hamali Amount:</span>
                      <span className="font-mono font-semibold" data-testid="text-hamali-amount">
                        {hamaliAmount.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {totalKgWeight.toFixed(2)} KG x ₹{hamaliRatePerKg}/KG = ₹{hamaliAmount.toFixed(2)}
                    </p>

                    <div className="flex items-center gap-2 pt-2 border-t border-dashed">
                      <input
                        type="checkbox"
                        id="hamaliPaidByCash"
                        checked={hamaliPaidByCash}
                        onChange={(e) => setHamaliPaidByCash(e.target.checked)}
                        className="rounded"
                        data-testid="checkbox-hamali-paid-cash"
                      />
                      <Label htmlFor="hamaliPaidByCash" className="text-sm flex items-center gap-1">
                        <HandCoins className="h-3 w-3" />
                        Paid by Cash
                      </Label>
                    </div>

                    {hamaliPaidByCash && (
                      <p className="text-xs text-muted-foreground pl-5">
                        Hamali will be recorded as cash payment (not added to invoice total)
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t">
                <div className="flex justify-between gap-2 text-lg font-bold">
                  <span>Grand Total</span>
                  <span className="font-mono" data-testid="text-grand-total">
                    {grandTotal.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                  </span>
                </div>
              </div>

              <Button
                onClick={handleGenerateInvoice}
                disabled={weighingItems.length === 0 || !selectedCustomer || createInvoice.isPending}
                className="w-full"
                data-testid="button-generate-invoice"
              >
                {createInvoice.isPending ? "Generating..." : "Generate Invoice"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
