import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Trash2, AlertTriangle, Database } from "lucide-react";

type TableInfo = {
    id: string;
    label: string;
    description: string;
    risk: "high" | "medium" | "low";
};

const TABLES: TableInfo[] = [
    {
        id: "invoices",
        label: "Invoices",
        description: "All customer sales and linked items.",
        risk: "high"
    },
    {
        id: "purchases",
        label: "Purchases",
        description: "All vendor purchases and linked items.",
        risk: "high"
    },
    {
        id: "stock_movements",
        label: "Stock Movements",
        description: "History of all stock in/out records.",
        risk: "medium"
    },
    {
        id: "customers",
        label: "Customers",
        description: "Customer registry.",
        risk: "high"
    },
    {
        id: "vendors",
        label: "Vendors",
        description: "Vendor registry.",
        risk: "high"
    },
    {
        id: "customer_payments",
        label: "Customer Payments",
        description: "Payment records from customers.",
        risk: "medium"
    },
    {
        id: "vendor_payments",
        label: "Vendor Payments",
        description: "Payment records to vendors.",
        risk: "medium"
    },
    {
        id: "vehicles",
        label: "Vehicles",
        description: "Registered vehicles.",
        risk: "medium"
    },
    {
        id: "products",
        label: "Products",
        description: "Product catalog.",
        risk: "medium"
    },
    {
        id: "vehicle_inventory",
        label: "Vehicle Inventory",
        description: "Current stock loaded on vehicles.",
        risk: "low"
    },
    {
        id: "vehicle_inventory_movements",
        label: "Vehicle Inv. Movements",
        description: "Logs of loading/selling from vehicles.",
        risk: "low"
    },
    {
        id: "hamali_cash_payments",
        label: "Hamali Cash Records",
        description: "Cash payments for Hamali.",
        risk: "low"
    },
    {
        id: "vendor_returns",
        label: "Vendor Returns",
        description: "Records of returned goods.",
        risk: "medium"
    }
];

export default function AdminDataManagement() {
    const { toast } = useToast();
    const [selectedTable, setSelectedTable] = useState<TableInfo | null>(null);
    const [confirmationInput, setConfirmationInput] = useState("");
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);

    const clearTableMutation = useMutation({
        mutationFn: async (tableName: string) => {
            await apiRequest("POST", "/api/admin/clear-table", { tableName });
        },
        onSuccess: () => {
            toast({
                title: "Table Cleared",
                description: `Successfully cleared data from ${selectedTable?.label}.`,
            });
            // Refresh queries to show empty state elsewhere
            queryClient.invalidateQueries();
            handleClose();
        },
        onError: (error: any) => {
            toast({
                title: "Error",
                description: error.message || "Failed to clear table.",
                variant: "destructive",
            });
        },
    });

    const handleInitiateClear = (table: TableInfo) => {
        setSelectedTable(table);
        setConfirmationInput("");
        setIsConfirmOpen(true);
    };

    const handleConfirmClear = () => {
        if (!selectedTable) return;
        if (confirmationInput !== "DELETE") return;

        clearTableMutation.mutate(selectedTable.id);
    };

    const handleClose = () => {
        setIsConfirmOpen(false);
        setSelectedTable(null);
        setConfirmationInput("");
    };

    return (
        <div className="p-8 space-y-8 max-w-7xl mx-auto">
            <div className="space-y-1">
                <h2 className="text-3xl font-bold tracking-tight">Data Cleanup</h2>
                <p className="text-muted-foreground">
                    Manage and clear database tables. <span className="text-destructive font-semibold">Warning: This action is irreversible.</span>
                </p>
            </div>

            <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Danger Zone</AlertTitle>
                <AlertDescription>
                    Deleting data here effectively resets parts of your application. Ensure you have backups if necessary.
                </AlertDescription>
            </Alert>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {TABLES.map((table) => (
                    <Card key={table.id} className="border-l-4 border-l-transparent hover:border-l-primary transition-all">
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <CardTitle className="text-lg">{table.label}</CardTitle>
                                {table.risk === "high" && <Badge variant="destructive">High Risk</Badge>}
                            </div>
                            <CardDescription>{table.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button
                                variant="outline"
                                className="w-full border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => handleInitiateClear(table)}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Clear Data
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Dialog open={isConfirmOpen} onOpenChange={handleClose}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Deletion</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to clear all data from <span className="font-bold text-foreground">{selectedTable?.label}</span>?
                            <br /><br />
                            This action cannot be undone. All related data will also be removed.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Type <span className="font-mono font-bold">DELETE</span> to confirm:</label>
                            <Input
                                value={confirmationInput}
                                onChange={(e) => setConfirmationInput(e.target.value)}
                                placeholder="DELETE"
                                className="border-destructive/50 focus-visible:ring-destructive"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={handleClose}>Cancel</Button>
                        <Button
                            variant="destructive"
                            onClick={handleConfirmClear}
                            disabled={confirmationInput !== "DELETE" || clearTableMutation.isPending}
                        >
                            {clearTableMutation.isPending ? "Clearing..." : "Yes, Clear All Data"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
