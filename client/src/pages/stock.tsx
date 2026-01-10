import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useShop } from "@/hooks/use-shop";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Truck,
  Package,
  Scale,
  ShoppingBag,
  TrendingUp,
  TrendingDown,
  ArrowRight,
} from "lucide-react";
import type { Product, Vehicle, Invoice } from "@shared/schema";

type VehicleInventory = {
  vehicleId: string;
  productId: string;
  quantity: number;
};

type VehicleInventoryMovement = {
  id: string;
  vehicleId: string;
  productId: string;
  type: string;
  quantity: number;
  date: string;
  notes?: string;
};

function formatCurrency(amount: number): string {
  return amount.toLocaleString("en-IN", { style: "currency", currency: "INR" });
}

export default function Stock() {
  const { shop } = useShop();
  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: allVehicles = [], isLoading: vehiclesLoading } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });

  // Filter vehicles by selected shop
  const vehicles = useMemo(() => {
    const safeAllVehicles = Array.isArray(allVehicles) ? allVehicles : [];
    return safeAllVehicles.filter(v => v.shop === shop);
  }, [allVehicles, shop]);

  const { data: allInventories = [] } = useQuery<VehicleInventory[]>({
    queryKey: ["/api/all-vehicle-inventories"],
  });

  const { data: allMovements = [] } = useQuery<VehicleInventoryMovement[]>({
    queryKey: ["/api/vehicle-inventory-movements"],
  });

  const { data: invoicesResult } = useQuery<{ invoices: Invoice[], total: number }>({
    queryKey: ["/api/invoices"],
  });
  const invoices = invoicesResult?.invoices || [];

  // Filter inventories and movements by shop via vehicle
  const shopInventory = useMemo(() => {
    const safeAllInventories = Array.isArray(allInventories) ? allInventories : [];
    const shopVehicleIds = new Set(vehicles.map(v => v.id));
    return safeAllInventories.filter(inv => shopVehicleIds.has(inv.vehicleId));
  }, [allInventories, vehicles]);

  const shopMovements = useMemo(() => {
    const safeAllMovements = Array.isArray(allMovements) ? allMovements : [];
    const shopVehicleIds = new Set(vehicles.map(v => v.id));
    return safeAllMovements.filter(mov => shopVehicleIds.has(mov.vehicleId));
  }, [allMovements, vehicles]);

  const getProductName = (id: string) => products.find((p) => p.id === id)?.name || "Unknown";
  const getProductUnit = (id: string) => products.find((p) => p.id === id)?.unit || "KG";
  const getVehicleNumber = (id: string) => vehicles.find((v) => v.id === id)?.number || "Unknown";

  const productSummary = useMemo(() => {
    const summary = new Map<string, {
      productId: string;
      loaded: number;
      sold: number;
      remaining: number;
    }>();

    shopInventory.forEach((inv) => {
      const existing = summary.get(inv.productId) || {
        productId: inv.productId,
        loaded: 0,
        sold: 0,
        remaining: 0,
      };
      existing.remaining += inv.quantity;
      summary.set(inv.productId, existing);
    });

    shopMovements.forEach((mov) => {
      const existing = summary.get(mov.productId) || {
        productId: mov.productId,
        loaded: 0,
        sold: 0,
        remaining: 0,
      };
      if (mov.type === "load") {
        existing.loaded += mov.quantity;
      } else if (mov.type === "sale") {
        existing.sold += mov.quantity;
      }
      summary.set(mov.productId, existing);
    });

    return Array.from(summary.values()).filter(s => s.loaded > 0 || s.remaining > 0);
  }, [shopInventory, shopMovements]);

  const vehicleSummary = useMemo(() => {
    const summary = new Map<string, {
      vehicleId: string;
      productCount: number;
      totalQuantity: number;
      totalLoaded: number;
      totalSold: number;
    }>();

    shopInventory.forEach((inv) => {
      const existing = summary.get(inv.vehicleId) || {
        vehicleId: inv.vehicleId,
        productCount: 0,
        totalQuantity: 0,
        totalLoaded: 0,
        totalSold: 0,
      };
      if (inv.quantity > 0) {
        existing.productCount += 1;
        existing.totalQuantity += inv.quantity;
      }
      summary.set(inv.vehicleId, existing);
    });

    shopMovements.forEach((mov) => {
      const existing = summary.get(mov.vehicleId);
      if (existing) {
        if (mov.type === "load") {
          existing.totalLoaded += mov.quantity;
        } else if (mov.type === "sale") {
          existing.totalSold += mov.quantity;
        }
      }
    });

    return Array.from(summary.values()).filter(v => v.totalQuantity > 0 || v.totalLoaded > 0);
  }, [shopInventory, shopMovements]);

  const recentMovements = useMemo(() => {
    return [...shopMovements]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 15);
  }, [shopMovements]);

  const totals = useMemo(() => {
    const totalLoaded = productSummary.reduce((sum, p) => sum + p.loaded, 0);
    const totalSold = productSummary.reduce((sum, p) => sum + p.sold, 0);
    const totalRemaining = productSummary.reduce((sum, p) => sum + p.remaining, 0);
    // Invoices are harder to link to shop strictly without vehicleId, but many invoices have vehicleId.
    // Assuming for now filtering by vehicle if available, or just global if no better way?
    // Wait, invoices table has vehicleId.
    const shopVehicleIds = new Set(vehicles.map(v => v.id));

    // Invoices defensive check
    const safeInvoices = Array.isArray(invoices) ? invoices : [];

    const todaysSales = safeInvoices
      .filter(inv => {
        // Filter by date
        const isToday = inv.date === new Date().toISOString().split("T")[0];
        // Filter by vehicle/shop if possible. 
        // If invoice has vehicleId, check if it's in our shop vehicles.
        // If invoice doesn't have vehicleId (e.g. direct sale?), we might miss it or count it wrong.
        // But most sales here seem to be vehicle based?
        // Let's rely on vehicleId being present for stock tracking context.
        const isShopVehicle = inv.vehicleId ? shopVehicleIds.has(inv.vehicleId) : true; // Fallback to true if no vehicle? Or false? 
        // If stock is strictly vehicle based, sales without vehicle don't affect vehicle stock.
        return isToday && isShopVehicle;
      })
      .reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);

    return { totalLoaded, totalSold, totalRemaining, todaysSales };
  }, [productSummary, invoices, vehicles]);

  if (productsLoading || vehiclesLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Stock Tracking</h1>
          <p className="text-sm text-muted-foreground">
            Track products loaded onto vehicles and sales
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Loaded
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono" data-testid="text-total-loaded">
              {totals.totalLoaded.toFixed(2)} KG
            </div>
            <p className="text-xs text-muted-foreground">Products loaded to vehicles</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Sold
            </CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono" data-testid="text-total-sold">
              {totals.totalSold.toFixed(2)} KG
            </div>
            <p className="text-xs text-muted-foreground">Products sold from vehicles</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Remaining Stock
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono" data-testid="text-total-remaining">
              {totals.totalRemaining.toFixed(2)} KG
            </div>
            <p className="text-xs text-muted-foreground">On vehicles, ready to sell</p>
          </CardContent>
        </Card>

        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-primary">
              Today's Sales
            </CardTitle>
            <Scale className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-primary" data-testid="text-todays-sales">
              {formatCurrency(totals.todaysSales)}
            </div>
            <p className="text-xs text-muted-foreground">From all vehicles</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5" />
              Product Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            {productSummary.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No products loaded yet</p>
                <p className="text-sm">Go to Sell tab to add vehicles with products</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Loaded</TableHead>
                    <TableHead className="text-right">Sold</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productSummary.map((item) => (
                    <TableRow key={item.productId} data-testid={`row-product-${item.productId}`}>
                      <TableCell className="font-medium">
                        {getProductName(item.productId)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{getProductUnit(item.productId)}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {item.loaded.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {item.sold.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {item.remaining.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell colSpan={2}>TOTAL</TableCell>
                    <TableCell className="text-right font-mono">
                      {totals.totalLoaded.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {totals.totalSold.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-primary">
                      {totals.totalRemaining.toFixed(2)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Vehicle Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            {vehicleSummary.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Truck className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No vehicles with stock</p>
              </div>
            ) : (
              <div className="space-y-3">
                {vehicleSummary.map((v) => (
                  <div
                    key={v.vehicleId}
                    className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                    data-testid={`vehicle-stock-${v.vehicleId}`}
                  >
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">{getVehicleNumber(v.vehicleId)}</p>
                        <p className="text-xs text-muted-foreground">{v.productCount} products</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-semibold">{v.totalQuantity.toFixed(2)} KG</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span className="text-primary">{v.totalLoaded.toFixed(0)}</span>
                        <ArrowRight className="h-3 w-3" />
                        <span className="text-destructive">{v.totalSold.toFixed(0)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentMovements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No activity yet</p>
              <p className="text-sm">Load products onto vehicles and create sales to see activity</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {recentMovements.map((mov) => (
                <div
                  key={mov.id}
                  className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                  data-testid={`movement-${mov.id}`}
                >
                  <div className="flex items-center gap-2">
                    {mov.type === "load" ? (
                      <TrendingUp className="h-4 w-4 text-primary" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-destructive" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{getProductName(mov.productId)}</p>
                      <p className="text-xs text-muted-foreground">
                        {getVehicleNumber(mov.vehicleId)} - {mov.type === "load" ? "Loaded" : "Sold"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-mono text-sm ${mov.type === "load" ? "text-primary" : "text-destructive"}`}>
                      {mov.type === "load" ? "+" : "-"}{mov.quantity.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">{mov.date}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
