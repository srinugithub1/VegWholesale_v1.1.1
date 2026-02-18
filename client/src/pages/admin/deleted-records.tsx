import { useQuery } from "@tanstack/react-query";
import { DeletedRecord } from "@shared/schema";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function DeletedRecords() {
    const [selectedTable, setSelectedTable] = useState<string>("all");

    const { data: records, isLoading } = useQuery<DeletedRecord[]>({
        queryKey: ["/api/admin/deleted-records", selectedTable],
        queryFn: async () => {
            const url = selectedTable === "all"
                ? "/api/admin/deleted-records"
                : `/api/admin/deleted-records?table=${selectedTable}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error("Failed to fetch deleted records");
            return res.json();
        },
    });

    const tableOptions = [
        { value: "all", label: "All Tables" },
        { value: "customers", label: "Customers" },
        { value: "vendors", label: "Vendors" },
        { value: "products", label: "Products" },
        { value: "vehicles", label: "Vehicles" },
        { value: "invoices", label: "Invoices" },
        { value: "customer_payments", label: "Customer Payments" },
        { value: "vendor_payments", label: "Vendor Payments" },
        { value: "hamali_payments", label: "Hamali Payments" },
    ];

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Deleted Records Archive</h2>
            </div>

            <div className="flex items-center space-x-2">
                <Select value={selectedTable} onValueChange={setSelectedTable}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select Table" />
                    </SelectTrigger>
                    <SelectContent>
                        {tableOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Deleted Records ({records?.length || 0})</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Table Name</TableHead>
                                <TableHead>Record ID</TableHead>
                                <TableHead>Deleted At</TableHead>
                                <TableHead>Deleted By</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center">Loading...</TableCell>
                                </TableRow>
                            ) : records?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center">No deleted records found</TableCell>
                                </TableRow>
                            ) : (
                                records?.map((record) => (
                                    <TableRow key={record.id}>
                                        <TableCell className="capitalize">{record.tableName}</TableCell>
                                        <TableCell className="font-mono text-xs">{record.recordId}</TableCell>
                                        <TableCell>
                                            {record.deletedAt && format(new Date(record.deletedAt), "PPP p")}
                                        </TableCell>
                                        <TableCell>{record.deletedBy || "System"}</TableCell>
                                        <TableCell>
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button variant="outline" size="sm">
                                                        <Eye className="mr-2 h-4 w-4" />
                                                        View Data
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className="max-w-2xl max-h-[80vh]">
                                                    <DialogHeader>
                                                        <DialogTitle>Deleted Record Details</DialogTitle>
                                                        <DialogDescription>
                                                            Table: {record.tableName} | ID: {record.recordId}
                                                        </DialogDescription>
                                                    </DialogHeader>
                                                    <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                                                        <pre className="text-sm">
                                                            {JSON.stringify(JSON.parse(record.data), null, 2)}
                                                        </pre>
                                                    </ScrollArea>
                                                </DialogContent>
                                            </Dialog>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
