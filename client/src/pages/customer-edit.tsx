import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useShop } from "@/hooks/use-shop";
import { format } from "date-fns";
import { Invoice, InvoiceItem, Customer, Vendor, Product, Vehicle } from "@shared/schema";
import { Loader2, Search, Filter, Edit, Save, ArrowUpDown, ArrowLeft, ArrowRight, Check, ChevronsUpDown, X, ShoppingBag, Calendar } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

export default function CustomerEdit() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // --- State ---
    const [fromDate, setFromDate] = useState<Date | undefined>(new Date());
    const [toDate, setToDate] = useState<Date | undefined>(new Date());
    const [selectedVendorId, setSelectedVendorId] = useState<string>("all");
    const [selectedVehicleId, setSelectedVehicleId] = useState<string>("all"); // Added Vehicle Filter

    const { shop } = useShop(); // Use global shop context
    const [customerSearch, setCustomerSearch] = useState("");

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    // Edit Dialog State
    const [editingItem, setEditingItem] = useState<{
        id: number; // InvoiceItem ID
        invoiceId: number;
        weight: string;
        bags: string;
        price: string; // Price per Kg
        amount: string; // Calculated (ReadOnly)
        customerId: string;
        vendorId: string;
        vehicleId: string;
        customerName: string; // Keep for fallback display
        vendorName: string;
        vehicleNumber: string;
        weightBreakdown: number[]; // Added
    } | null>(null);

    // --- Data Fetching ---
    const { data: invoices = [], isLoading: loadingInvoices } = useQuery<Invoice[]>({
        queryKey: ["/api/invoices"]
    });
    const { data: invoiceItems = [], isLoading: loadingItems } = useQuery<InvoiceItem[]>({
        queryKey: ["/api/invoice-items"]
    });
    const { data: customers = [] } = useQuery<Customer[]>({ queryKey: ["/api/customers"] });
    const { data: vendors = [] } = useQuery<Vendor[]>({ queryKey: ["/api/vendors"] });
    const { data: vehicles = [] } = useQuery<Vehicle[]>({ queryKey: ["/api/vehicles"] });
    const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });

    // --- Derived Data (Flattened) ---
    const tableData = useMemo(() => {
        if (loadingInvoices || loadingItems) return [];

        // Filter by Date
        let filteredInvoices = invoices;

        if (fromDate) {
            const fromStr = format(fromDate, 'yyyy-MM-dd');
            filteredInvoices = filteredInvoices.filter(inv => inv.date >= fromStr);
        }
        if (toDate) {
            const toStr = format(toDate, 'yyyy-MM-dd');
            filteredInvoices = filteredInvoices.filter(inv => inv.date <= toStr);
        }

        // Filter by Vendor
        // NOTE: Updated logic to correctly identify Vendor from both direct Invoice.vendorId AND Invoice.vehicleId's vendor
        if (selectedVendorId !== "all") {
            filteredInvoices = filteredInvoices.filter(inv => {
                const vId = String(selectedVendorId);

                // Direct Vendor ID match (assuming string comparison to be safe)
                if (inv.vendorId && String(inv.vendorId) === vId) return true;

                // Indirect match via Vehicle
                if (inv.vehicleId) {
                    const vehicle = vehicles.find(v => String(v.id) === String(inv.vehicleId));
                    if (vehicle && String(vehicle.vendorId) === vId) return true;
                }

                return false;
            });
        }

        // Filter by Vehicle (New)
        if (selectedVehicleId !== "all") {
            filteredInvoices = filteredInvoices.filter(inv => {
                return inv.vehicleId && String(inv.vehicleId) === String(selectedVehicleId);
            });
        }

        // Filter by Shop
        if (shop !== "all") {
            filteredInvoices = filteredInvoices.filter(inv => {
                const vehicle = vehicles.find(v => v.id === inv.vehicleId);
                return vehicle && String(vehicle.shop) === String(shop);
            });
        }

        const relevantIds = new Set(filteredInvoices.map(i => i.id));

        const mappedData = invoiceItems
            .filter(item => relevantIds.has(item.invoiceId))
            .map(item => {
                const invoice = invoices.find(i => i.id === item.invoiceId);
                if (!invoice) return null;

                const customer = customers.find(c => c.id === invoice.customerId);
                const customerName = customer?.name || "Unknown";

                if (customerSearch && !customerName.toLowerCase().includes(customerSearch.toLowerCase())) {
                    return null;
                }

                const vehicle = vehicles.find(v => v.id === invoice.vehicleId);
                const vendor = vendors.find(v => v.id === (invoice.vendorId || vehicle?.vendorId));
                const productName = products.find(p => p.id === item.productId)?.name || "Unknown";

                // Timestamps
                const createdAt = (invoice as any).createdAt ? new Date((invoice as any).createdAt) : new Date(invoice.date);
                const updatedAt = (item as any).updatedAt ? new Date((item as any).updatedAt) :
                    ((invoice as any).updatedAt ? new Date((invoice as any).updatedAt) : createdAt);

                return {
                    itemId: item.id,
                    invoiceId: invoice.id,
                    invoiceNo: invoice.invoiceNumber,
                    date: invoice.date,
                    createdDate: createdAt,
                    updatedDate: updatedAt,
                    customerId: invoice.customerId,
                    customerName,
                    vendorId: vendor?.id || "",
                    vendorName: vendor?.name || "-",
                    vehicleId: vehicle?.id || "",
                    vehicleNumber: vehicle?.number || "-",
                    shopNumber: vehicle?.shop || "-", // Added Shop Number
                    productName,
                    vehicleNumberOld: vehicle?.number,
                    weight: item.quantity,
                    bags: invoice.bags || 0,
                    price: item.unitPrice,
                    amount: (item.quantity * item.unitPrice),
                    weightBreakdown: item.weightBreakdown ? JSON.parse(item.weightBreakdown) : [],
                };
            })
            .filter(Boolean) as any[];

        // SORTING: Updated Record First (Descending)
        return mappedData.sort((a, b) => b.updatedDate.getTime() - a.updatedDate.getTime());

    }, [invoices, invoiceItems, customers, vendors, vehicles, products, fromDate, toDate, selectedVendorId, selectedVehicleId, customerSearch, loadingInvoices, loadingItems, shop]);

    // --- Pagination Logic ---
    const totalPages = Math.ceil(tableData.length / itemsPerPage);
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return tableData.slice(start, start + itemsPerPage);
    }, [tableData, currentPage]);


    // --- Mutation ---
    const updateItemMutation = useMutation({
        mutationFn: async (values: {
            id: number,
            invoiceId: number,
            weight: number,
            price: number,
            bags: number,
            customerId: string,
            vehicleId: string | null,
            vehicleId: string | null,
            vendorId: string | null,
            weightBreakdown: number[]
        }) => {
            const total = values.weight * values.price;
            await apiRequest("PATCH", `/api/invoice-items/${values.id}`, {
                quantity: values.weight,
                unitPrice: values.price,
                total: total,
                weightBreakdown: JSON.stringify(values.weightBreakdown)
            });
            await apiRequest("PATCH", `/api/invoices/${values.invoiceId}`, {
                bags: values.bags,
                customerId: values.customerId,
                vehicleId: values.vehicleId,
                vendorId: values.vendorId
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
            queryClient.invalidateQueries({ queryKey: ["/api/invoice-items"] });
            toast({ title: "Updated", description: "Record updated successfully" });
            setEditingItem(null);
        },
        onError: (e) => {
            toast({ title: "Error", description: "Failed to update", variant: "destructive" });
        }
    });

    const handleEditClick = (row: any) => {
        setEditingItem({
            id: row.itemId,
            invoiceId: row.invoiceId,
            weight: row.weight.toString(),
            bags: row.bags.toString(),
            price: row.price.toString(),
            amount: row.amount.toFixed(2),
            customerId: row.customerId,
            vehicleId: row.vehicleId,
            vendorId: row.vendorId,
            customerName: row.customerName,
            vendorName: row.vendorName,
            vehicleNumber: row.vehicleNumber,
            weightBreakdown: row.weightBreakdown || [],
        });
    };

    const handleSave = () => {
        if (!editingItem) return;
        const w = parseFloat(editingItem.weight);
        const p = parseFloat(editingItem.price);
        const b = parseInt(editingItem.bags);

        if (isNaN(w) || isNaN(p) || isNaN(b)) {
            toast({ title: "Invalid Input", variant: "destructive" });
            return;
        }

        if (!editingItem.customerId) {
            toast({ title: "Customer Required", variant: "destructive" });
            return;
        }

        updateItemMutation.mutate({
            id: editingItem.id,
            invoiceId: editingItem.invoiceId,
            weight: w,
            price: p,
            bags: b,
            customerId: editingItem.customerId,
            vehicleId: editingItem.vehicleId || null,
            vendorId: editingItem.vendorId || null,
            weightBreakdown: editingItem.weightBreakdown
        });
    };

    // Auto-calculate Amount when Weight or Price changes in dialog
    const handleDialogChange = (field: 'weight' | 'price' | 'bags' | 'customerId' | 'vehicleId' | 'vendorId', value: string) => {
        if (!editingItem) return;

        let newItem = { ...editingItem, [field]: value };

        if (field === 'weight' || field === 'price') {
            const w = parseFloat(field === 'weight' ? value : editingItem.weight);
            const p = parseFloat(field === 'price' ? value : editingItem.price);
            if (!isNaN(w) && !isNaN(p)) {
                newItem.amount = (w * p).toFixed(2);
            }
        }
        setEditingItem(newItem);
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Customer Edit</h1>
                <div className="bg-primary/10 text-primary px-4 py-2 rounded-lg font-medium">
                    Total Records: {tableData.length}
                </div>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Filter className="h-4 w-4" /> Filters
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-4 items-end">
                        <div className="space-y-2">
                            <Label>From Date</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-[160px] justify-start text-left font-normal",
                                            !fromDate && "text-muted-foreground"
                                        )}
                                    >
                                        <Calendar className="mr-2 h-4 w-4" />
                                        {fromDate ? format(fromDate, "dd/MM/yyyy") : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <CalendarComponent
                                        mode="single"
                                        selected={fromDate}
                                        onSelect={setFromDate}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="space-y-2">
                            <Label>To Date</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-[160px] justify-start text-left font-normal",
                                            !toDate && "text-muted-foreground"
                                        )}
                                    >
                                        <Calendar className="mr-2 h-4 w-4" />
                                        {toDate ? format(toDate, "dd/MM/yyyy") : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <CalendarComponent
                                        mode="single"
                                        selected={toDate}
                                        onSelect={setToDate}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="space-y-2 flex flex-col">
                            <Label>Vendor</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        className={cn(
                                            "w-48 justify-between",
                                            selectedVendorId === "all" && "text-muted-foreground"
                                        )}
                                    >
                                        {selectedVendorId !== "all"
                                            ? vendors.find((v) => v.id.toString() === selectedVendorId)?.name
                                            : "All Vendors"}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[200px] p-0">
                                    <Command>
                                        <CommandInput placeholder="Search vendor..." h-9 />
                                        <CommandList>
                                            <CommandEmpty>No vendor found.</CommandEmpty>
                                            <CommandGroup>
                                                <CommandItem
                                                    value="all"
                                                    onSelect={() => setSelectedVendorId("all")}
                                                >
                                                    <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            selectedVendorId === "all"
                                                                ? "opacity-100"
                                                                : "opacity-0"
                                                        )}
                                                    />
                                                    All Vendors
                                                </CommandItem>
                                                {vendors.map((vendor) => (
                                                    <CommandItem
                                                        value={vendor.name}
                                                        key={vendor.id}
                                                        onSelect={() => {
                                                            setSelectedVendorId(vendor.id.toString());
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                selectedVendorId === vendor.id.toString()
                                                                    ? "opacity-100"
                                                                    : "opacity-0"
                                                            )}
                                                        />
                                                        {vendor.name}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="space-y-2 flex flex-col">
                            <Label>Vehicle</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        className={cn(
                                            "w-48 justify-between",
                                            selectedVehicleId === "all" && "text-muted-foreground"
                                        )}
                                    >
                                        {selectedVehicleId !== "all"
                                            ? vehicles.find((v) => v.id.toString() === selectedVehicleId)?.number
                                            : "All Vehicles"}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[200px] p-0">
                                    <Command>
                                        <CommandInput placeholder="Search vehicle..." h-9 />
                                        <CommandList>
                                            <CommandEmpty>No vehicle found.</CommandEmpty>
                                            <CommandGroup>
                                                <CommandItem
                                                    value="all"
                                                    onSelect={() => setSelectedVehicleId("all")}
                                                >
                                                    <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            selectedVehicleId === "all"
                                                                ? "opacity-100"
                                                                : "opacity-0"
                                                        )}
                                                    />
                                                    All Vehicles
                                                </CommandItem>
                                                {vehicles.map((vehicle) => (
                                                    <CommandItem
                                                        value={vehicle.number}
                                                        key={vehicle.id}
                                                        onSelect={() => {
                                                            setSelectedVehicleId(vehicle.id.toString());
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                selectedVehicleId === vehicle.id.toString()
                                                                    ? "opacity-100"
                                                                    : "opacity-0"
                                                            )}
                                                        />
                                                        {vehicle.number} ({vehicle.type})
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* Shop Filter Removed - Uses Global Toggle */}

                        <div className="space-y-2">
                            <Label>Customer Search</Label>
                            <div className="relative">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search Customer..."
                                    className="pl-8 w-64"
                                    value={customerSearch}
                                    onChange={(e) => setCustomerSearch(e.target.value)}
                                />
                            </div>
                        </div>

                        <Button
                            variant="outline"
                            onClick={() => {
                                setSelectedVendorId("all");
                                setSelectedVehicleId("all");
                                setCustomerSearch("");
                                setFromDate(new Date());
                                setToDate(new Date());
                            }}
                        >
                            Reset
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px]">S.No</TableHead>
                                <TableHead>Invoice No</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Created</TableHead>
                                <TableHead>Modified</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead>Vendor</TableHead>
                                <TableHead>Shop</TableHead>
                                <TableHead>Vehicle</TableHead> {/* Optionally show vehicle col too? */}
                                <TableHead className="text-right">Weight</TableHead>
                                <TableHead className="text-right">Bags</TableHead>
                                <TableHead className="text-right">Price</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead className="w-[80px]">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={13} className="text-center h-24 text-muted-foreground">
                                        No records found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedData.map((row, index) => (
                                    <TableRow key={row.itemId}>
                                        <TableCell>{((currentPage - 1) * itemsPerPage) + index + 1}</TableCell>
                                        <TableCell className="font-mono">{row.invoiceNo}</TableCell>
                                        <TableCell>{row.date}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {format(row.createdDate, "dd/MM/yy HH:mm")}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {format(row.updatedDate, "dd/MM/yy HH:mm")}
                                        </TableCell>
                                        <TableCell>{row.customerName}</TableCell>
                                        <TableCell>{row.customerName}</TableCell>
                                        <TableCell>{row.vendorName}</TableCell>
                                        <TableCell>{row.shopNumber}</TableCell>
                                        <TableCell>{row.vehicleNumber}</TableCell>
                                        <TableCell className="text-right">{row.weight.toFixed(2)}</TableCell>
                                        <TableCell className="text-right">{row.bags}</TableCell>
                                        <TableCell className="text-right">{row.price.toFixed(2)}</TableCell>
                                        <TableCell className="text-right font-medium">{row.amount.toFixed(2)}</TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="icon" onClick={() => handleEditClick(row)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-center p-4 border-t gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                            >
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-sm font-medium">
                                Page {currentPage} of {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                            >
                                <ArrowRight className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Edit Dialog */}
            <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Edit Record</DialogTitle>
                    </DialogHeader>

                    {editingItem && (
                        <div className="grid gap-6 py-4">
                            {/* Editable Fields Section */}
                            <div className="grid grid-cols-2 gap-x-6 gap-y-4">

                                {/* Customer - Searchable Combobox */}
                                <div className="space-y-2 flex flex-col">
                                    <Label>Customer <span className="text-red-500">*</span></Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                className={cn(
                                                    "w-full justify-between",
                                                    !editingItem.customerId && "text-muted-foreground"
                                                )}
                                            >
                                                {editingItem.customerId
                                                    ? customers.find(c => c.id === editingItem.customerId)?.name
                                                    : "Select Customer"}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[300px] p-0">
                                            <Command>
                                                <CommandInput placeholder="Search customer..." />
                                                <CommandList>
                                                    <CommandEmpty>No customer found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {customers.map((customer) => (
                                                            <CommandItem
                                                                value={customer.name}
                                                                key={customer.id}
                                                                onSelect={() => {
                                                                    handleDialogChange("customerId", customer.id);
                                                                }}
                                                            >
                                                                <Check
                                                                    className={cn(
                                                                        "mr-2 h-4 w-4",
                                                                        customer.id === editingItem.customerId
                                                                            ? "opacity-100"
                                                                            : "opacity-0"
                                                                    )}
                                                                />
                                                                {customer.name}
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                {/* Vehicle - Searchable Combobox */}
                                <div className="space-y-2 flex flex-col">
                                    <Label>Vehicle</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                className={cn(
                                                    "w-full justify-between",
                                                    !editingItem.vehicleId && "text-muted-foreground"
                                                )}
                                            >
                                                {editingItem.vehicleId
                                                    ? vehicles.find(v => v.id === editingItem.vehicleId)?.number
                                                    : "Select Vehicle"}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[300px] p-0">
                                            <Command>
                                                <CommandInput placeholder="Search vehicle..." />
                                                <CommandList>
                                                    <CommandEmpty>No vehicle found.</CommandEmpty>
                                                    <CommandGroup>
                                                        <CommandItem
                                                            value="none"
                                                            onSelect={() => handleDialogChange("vehicleId", "")}
                                                        >
                                                            <Check className={cn("mr-2 h-4 w-4", !editingItem.vehicleId ? "opacity-100" : "opacity-0")} />
                                                            None
                                                        </CommandItem>
                                                        {vehicles.map((vehicle) => (
                                                            <CommandItem
                                                                value={vehicle.number}
                                                                key={vehicle.id}
                                                                onSelect={() => {
                                                                    handleDialogChange("vehicleId", vehicle.id);
                                                                }}
                                                            >
                                                                <Check
                                                                    className={cn(
                                                                        "mr-2 h-4 w-4",
                                                                        vehicle.id === editingItem.vehicleId
                                                                            ? "opacity-100"
                                                                            : "opacity-0"
                                                                    )}
                                                                />
                                                                {vehicle.number} ({vehicle.type})
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                {/* Vendor - Searchable Combobox */}
                                <div className="space-y-2 flex flex-col">
                                    <Label>Vendor</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                className={cn(
                                                    "w-full justify-between",
                                                    !editingItem.vendorId && "text-muted-foreground"
                                                )}
                                            >
                                                {editingItem.vendorId
                                                    ? vendors.find(v => v.id === editingItem.vendorId)?.name
                                                    : "Select Vendor"}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[300px] p-0">
                                            <Command>
                                                <CommandInput placeholder="Search vendor..." />
                                                <CommandList>
                                                    <CommandEmpty>No vendor found.</CommandEmpty>
                                                    <CommandGroup>
                                                        <CommandItem
                                                            value="none"
                                                            onSelect={() => handleDialogChange("vendorId", "")}
                                                        >
                                                            <Check className={cn("mr-2 h-4 w-4", !editingItem.vendorId ? "opacity-100" : "opacity-0")} />
                                                            None
                                                        </CommandItem>
                                                        {vendors.map((vendor) => (
                                                            <CommandItem
                                                                value={vendor.name}
                                                                key={vendor.id}
                                                                onSelect={() => {
                                                                    handleDialogChange("vendorId", vendor.id);
                                                                }}
                                                            >
                                                                <Check
                                                                    className={cn(
                                                                        "mr-2 h-4 w-4",
                                                                        vendor.id === editingItem.vendorId
                                                                            ? "opacity-100"
                                                                            : "opacity-0"
                                                                    )}
                                                                />
                                                                {vendor.name}
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div className="space-y-2">
                                    {/* Spacer to align grid if needed, or leave empty */}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="weight">Weight</Label>
                                    <Input
                                        id="weight"
                                        value={editingItem.weight}
                                        onChange={(e) => handleDialogChange('weight', e.target.value)}
                                        readOnly={editingItem.weightBreakdown.length > 0}
                                        className={editingItem.weightBreakdown.length > 0 ? "bg-muted" : ""}
                                    />
                                </div>

                                <div className="col-span-2 space-y-2 border rounded-md p-2 bg-slate-50 dark:bg-slate-900/50">
                                    <Label>Bag Weights Breakdown</Label>
                                    <div className="flex flex-wrap gap-2">
                                        {editingItem.weightBreakdown.map((w, idx) => (
                                            <div key={idx} className="flex items-center bg-white dark:bg-slate-800 border rounded px-1.5 py-0.5 shadow-sm">
                                                <span className="text-sm font-medium mr-1">{w}</span>
                                                <Button
                                                    variant="ghost" size="icon" className="h-4 w-4 text-muted-foreground hover:text-destructive"
                                                    onClick={() => {
                                                        const newBreakdown = [...editingItem.weightBreakdown];
                                                        newBreakdown.splice(idx, 1);
                                                        const newWeight = newBreakdown.reduce((a, b) => a + b, 0);
                                                        setEditingItem({
                                                            ...editingItem,
                                                            weightBreakdown: newBreakdown,
                                                            weight: newWeight.toString(),
                                                            bags: newBreakdown.length.toString(),
                                                            amount: (newWeight * parseFloat(editingItem.price || "0")).toFixed(2)
                                                        });
                                                    }}
                                                >
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        ))}
                                        <div className="flex items-center gap-1">
                                            <Input
                                                className="h-7 w-20 text-xs"
                                                placeholder="Add Wt"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        const val = parseFloat(e.currentTarget.value);
                                                        if (!isNaN(val) && val > 0) {
                                                            const newBreakdown = [...editingItem.weightBreakdown, val];
                                                            const newWeight = newBreakdown.reduce((a, b) => a + b, 0);
                                                            setEditingItem({
                                                                ...editingItem,
                                                                weightBreakdown: newBreakdown,
                                                                weight: newWeight.toString(),
                                                                bags: newBreakdown.length.toString(),
                                                                amount: (newWeight * parseFloat(editingItem.price || "0")).toFixed(2)
                                                            });
                                                            e.currentTarget.value = "";
                                                        }
                                                    }
                                                }}
                                            />
                                            <span className="text-[10px] text-muted-foreground">(Enter)</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="bags">Bags</Label>
                                    <Input
                                        id="bags"
                                        value={editingItem.bags}
                                        onChange={(e) => handleDialogChange('bags', e.target.value)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="price">Price/Kg</Label>
                                    <Input
                                        id="price"
                                        value={editingItem.price}
                                        onChange={(e) => handleDialogChange('price', e.target.value)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="amount">Amount</Label>
                                    <Input
                                        id="amount"
                                        value={editingItem.amount}
                                        className="bg-muted font-bold"
                                        readOnly
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingItem(null)}>Cancel</Button>
                        <Button onClick={handleSave} disabled={updateItemMutation.isPending}>
                            {updateItemMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

