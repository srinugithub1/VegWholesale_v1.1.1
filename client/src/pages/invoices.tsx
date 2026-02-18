import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Loader2,
    Trash2,
    Filter,
    AlertCircle,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Invoice } from "@shared/schema";

type InvoiceWithDetails = Invoice & {
    shop?: number | null;
    customerName?: string | null;
};

type InvoicesResponse = {
    invoices: InvoiceWithDetails[];
    total: number;
};

export default function InvoicesPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Filters
    const [startDate, setStartDate] = useState<string>("");
    const [endDate, setEndDate] = useState<string>("");
    const [shopFilter, setShopFilter] = useState<string>("all");

    // Pagination
    const [page, setPage] = useState(1);
    const limit = 50;

    // Selection
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    // Query
    const { data, isLoading, error } = useQuery<InvoicesResponse>({
        queryKey: ["/api/invoices", { startDate, endDate, shop: shopFilter, page, limit }],
        queryFn: async ({ queryKey }) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const [_, params] = queryKey;
            const queryParams = new URLSearchParams();
            if (startDate) queryParams.append("startDate", startDate);
            if (endDate) queryParams.append("endDate", endDate);
            if (shopFilter && shopFilter !== "all") queryParams.append("shop", shopFilter);
            queryParams.append("page", page.toString());
            queryParams.append("limit", limit.toString());

            const res = await fetch(`/api/invoices?${queryParams.toString()}`);
            if (!res.ok) throw new Error("Failed to fetch invoices");
            return res.json();
        },
        // Keep previous data while fetching new page for smoother transition
        placeholderData: (previousData) => previousData,
    });

    // Bulk Delete Mutation
    const deleteMutation = useMutation({
        mutationFn: async (ids: string[]) => {
            await apiRequest("POST", "/api/invoices/bulk-delete", { ids });
        },
        onSuccess: () => {
            toast({
                title: "Invoices deleted",
                description: `Successfully deleted ${selectedIds.length} invoice(s).`,
            });
            setSelectedIds([]);
            queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
        },
        onError: (error: Error) => {
            toast({
                title: "Delete failed",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    // Access Control
    if (user?.role !== "admin") {
        return (
            <div className="flex flex-col items-center justify-center h-full min-h-[50vh] space-y-4">
                <AlertCircle className="h-12 w-12 text-destructive" />
                <h2 className="text-xl font-semibold">Access Denied</h2>
                <p className="text-muted-foreground">You do not have permission to view this page.</p>
            </div>
        );
    }

    const invoices = data?.invoices || [];
    const total = data?.total || 0;
    const totalPages = Math.ceil(total / limit);

    // Selection Handlers
    const handleSelectAll = (checked: boolean | "indeterminate") => {
        if (checked === true) {
            const ids = invoices.map((inv) => inv.id);
            setSelectedIds(ids);
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectRow = (id: string, checked: boolean | "indeterminate") => {
        if (checked === true) {
            setSelectedIds((prev) => [...prev, id]);
        } else {
            setSelectedIds((prev) => prev.filter((prevId) => prevId !== id));
        }
    };

    const handleBulkDelete = () => {
        deleteMutation.mutate(selectedIds);
    };

    const isAllSelected = invoices.length > 0 && selectedIds.length === invoices.length;
    const isIndeterminate = selectedIds.length > 0 && selectedIds.length < invoices.length;

    return (
        <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h2 className="text-3xl font-bold tracking-tight">Invoices</h2>
                    <p className="text-muted-foreground">
                        Manage and view all customer invoices.
                    </p>
                </div>
                {selectedIds.length > 0 && (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Selected ({selectedIds.length})
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the selected invoices
                                    and their associated data.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    Delete
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row gap-4 items-end md:items-center justify-between">
                        <CardTitle className="text-lg font-medium flex items-center gap-2">
                            <Filter className="h-5 w-5" />
                            Filters
                        </CardTitle>
                        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                            <div className="flex flex-col gap-1.5">
                                <span className="text-xs font-medium">From Date</span>
                                <Input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => {
                                        setStartDate(e.target.value);
                                        setPage(1);
                                    }}
                                    className="w-[150px]"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <span className="text-xs font-medium">To Date</span>
                                <Input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => {
                                        setEndDate(e.target.value);
                                        setPage(1);
                                    }}
                                    className="w-[150px]"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <span className="text-xs font-medium">Shop</span>
                                <Select
                                    value={shopFilter}
                                    onValueChange={(val) => {
                                        setShopFilter(val);
                                        setPage(1);
                                    }}
                                >
                                    <SelectTrigger className="w-[150px]">
                                        <SelectValue placeholder="All Shops" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Shops</SelectItem>
                                        <SelectItem value="42">Shop 42</SelectItem>
                                        <SelectItem value="50">Shop 50</SelectItem>
                                        {/* Add more shops if dynamic list is needed later */}
                                    </SelectContent>
                                </Select>
                            </div>
                            {(startDate || endDate || shopFilter !== "all") && (
                                <Button
                                    variant="ghost"
                                    onClick={() => {
                                        setStartDate("");
                                        setEndDate("");
                                        setShopFilter("all");
                                        setPage(1);
                                    }}
                                    className="mt-5 h-9"
                                >
                                    Clear
                                </Button>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : error ? (
                        <div className="flex items-center justify-center py-10 text-destructive">
                            Failed to load invoices.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[50px]">
                                                <Checkbox
                                                    checked={isAllSelected}
                                                    onCheckedChange={handleSelectAll}
                                                //   ref={(ref) => ref && (ref.indeterminate = isIndeterminate)} 
                                                /* Checkbox component handle indeterminate logic usually via prop or internal ref, 
                                                   standard HTML checkbox needs ref. Radix checkbox usually handles 'indeterminate' state passed as checked value if supported 
                                                   but standard shadcn checkbox is boolean | 'indeterminate'. Checking types... */
                                                />
                                            </TableHead>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Invoice #</TableHead>
                                            <TableHead>Customer</TableHead>
                                            <TableHead>Shop</TableHead>
                                            <TableHead className="text-right">Amount (₹)</TableHead>
                                            <TableHead>Status</TableHead>
                                            {/* <TableHead className="w-[100px]">Actions</TableHead> */}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {invoices.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={7} className="h-24 text-center">
                                                    No invoices found.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            invoices.map((invoice) => (
                                                <TableRow key={invoice.id}>
                                                    <TableCell>
                                                        <Checkbox
                                                            checked={selectedIds.includes(invoice.id)}
                                                            onCheckedChange={(checked) => handleSelectRow(invoice.id, checked)}
                                                        />
                                                    </TableCell>
                                                    <TableCell>{format(new Date(invoice.date), "dd/MM/yyyy")}</TableCell>
                                                    <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                                                    <TableCell>{invoice.customerName || "Unknown"}</TableCell>
                                                    <TableCell>
                                                        {invoice.shop ? (
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${invoice.shop === 42 ? "bg-orange-100 text-orange-800" :
                                                                invoice.shop === 50 ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-800"
                                                                }`}>
                                                                Shop {invoice.shop}
                                                            </span>
                                                        ) : "-"}
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium">
                                                        {invoice.grandTotal.toLocaleString("en-IN")}
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${invoice.status === "completed" || invoice.status === "paid" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                                                            }`}>
                                                            {invoice.status}
                                                        </span>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Pagination */}
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-muted-foreground">
                                    Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} results
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                        Previous
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                        disabled={page === totalPages || totalPages === 0}
                                    >
                                        Next
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
