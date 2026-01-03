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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { Invoice, InvoiceItem, Customer, Vendor, Product, Vehicle } from "@shared/schema";
import { Loader2, Search, Filter, Edit, Save, ArrowUpDown, ArrowLeft, ArrowRight } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function CustomerEdit() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // --- State ---
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: new Date(),
        to: new Date(),
    });
    const [selectedVendorId, setSelectedVendorId] = useState<string>("all");
    const [selectedVehicleId, setSelectedVehicleId] = useState<string>("all"); // Added Vehicle Filter
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
        customerName: string;
        vendorName: string;
        vehicleNumber: string;
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

        if (dateRange?.from) {
            const fromStr = format(dateRange.from, 'yyyy-MM-dd');
            filteredInvoices = filteredInvoices.filter(inv => inv.date >= fromStr);
        }
        if (dateRange?.to) {
            const toStr = format(dateRange.to, 'yyyy-MM-dd');
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
                    customerName,
                    vendorName: vendor?.name || "-",
                    vehicleNumber: vehicle?.number || "-", // Added for context
                    productName,
                    weight: item.quantity,
                    bags: invoice.bags || 0,
                    price: item.unitPrice,
                    amount: (item.quantity * item.unitPrice)
                };
            })
            .filter(Boolean) as any[];

        // SORTING: Updated Record First (Descending)
        return mappedData.sort((a, b) => b.updatedDate.getTime() - a.updatedDate.getTime());

    }, [invoices, invoiceItems, customers, vendors, vehicles, products, dateRange, selectedVendorId, selectedVehicleId, customerSearch, loadingInvoices, loadingItems]);

    // --- Pagination Logic ---
    const totalPages = Math.ceil(tableData.length / itemsPerPage);
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return tableData.slice(start, start + itemsPerPage);
    }, [tableData, currentPage]);


    // --- Mutation ---
    const updateItemMutation = useMutation({
        mutationFn: async (values: { id: number, invoiceId: number, weight: number, price: number, bags: number }) => {
            const total = values.weight * values.price;
            await apiRequest("PATCH", `/api/invoice-items/${values.id}`, {
                quantity: values.weight,
                unitPrice: values.price,
                total: total
            });
            await apiRequest("PATCH", `/api/invoices/${values.invoiceId}`, {
                bags: values.bags
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
            customerName: row.customerName,
            vendorName: row.vendorName,
            vehicleNumber: row.vehicleNumber,
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

        updateItemMutation.mutate({
            id: editingItem.id,
            invoiceId: editingItem.invoiceId,
            weight: w,
            price: p,
            bags: b
        });
    };

    // Auto-calculate Amount when Weight or Price changes in dialog
    const handleDialogChange = (field: 'weight' | 'price' | 'bags', value: string) => {
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
                            <Label>Date Range</Label>
                            <DatePickerWithRange date={dateRange} setDate={setDateRange} className="w-[300px]" />
                        </div>

                        <div className="space-y-2">
                            <Label>Vendor</Label>
                            <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
                                <SelectTrigger className="w-48">
                                    <SelectValue placeholder="All Vendors" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Vendors</SelectItem>
                                    {vendors.map(v => (
                                        <SelectItem key={v.id} value={v.id.toString()}>{v.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Vehicle</Label>
                            <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
                                <SelectTrigger className="w-48">
                                    <SelectValue placeholder="All Vehicles" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Vehicles</SelectItem>
                                    {vehicles.map(v => (
                                        <SelectItem key={v.id} value={v.id.toString()}>{v.number} ({v.type})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

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
                                setDateRange({ from: new Date(), to: new Date() });
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
                                <TableHead>Vendor</TableHead>
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
                                        <TableCell>{row.vendorName}</TableCell>
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
                        <div className="flex items-center justify-end p-4 border-t gap-2">
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
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Edit Record</DialogTitle>
                    </DialogHeader>

                    {editingItem && (
                        <div className="grid gap-6 py-4">
                            {/* Read-only Context Info */}
                            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                                <div className="space-y-1 col-span-2">
                                    <Label className="text-xs text-muted-foreground">Customer</Label>
                                    <div className="font-semibold text-lg">{editingItem.customerName}</div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Vehicle</Label>
                                    <div className="font-medium">{editingItem.vehicleNumber}</div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Vendor</Label>
                                    <div className="font-medium">{editingItem.vendorName}</div>
                                </div>
                            </div>

                            {/* Editable Fields */}
                            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="weight">Weight</Label>
                                    <Input
                                        id="weight"
                                        value={editingItem.weight}
                                        onChange={(e) => handleDialogChange('weight', e.target.value)}
                                    />
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
