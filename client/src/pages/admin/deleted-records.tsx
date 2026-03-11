import { useQuery } from "@tanstack/react-query";
import { DeletedRecord, User } from "@shared/schema";
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
import { useState, useMemo } from "react";
import { format, startOfDay, endOfDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { Eye, ChevronLeft, ChevronRight } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";

export default function ModifiedRecords() {
    const [activeTab, setActiveTab] = useState<string>("edit");
    const [selectedTable, setSelectedTable] = useState<string>("all");
    const [selectedUser, setSelectedUser] = useState<string>("all");
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: startOfDay(new Date()),
        to: endOfDay(new Date()),
    });
    const [page, setPage] = useState(1);
    const limit = 20;

    const { data: users } = useQuery<User[]>({
        queryKey: ["/api/users"],
    });

    const { data, isLoading } = useQuery<{ records: DeletedRecord[]; total: number }>({
        queryKey: [
            "/api/admin/deleted-records",
            activeTab,
            selectedTable,
            selectedUser,
            dateRange?.from?.toISOString(),
            dateRange?.to?.toISOString(),
            page,
        ],
        queryFn: async () => {
            const params = new URLSearchParams({
                action: activeTab,
                table: selectedTable,
                user: selectedUser,
                page: page.toString(),
                limit: limit.toString(),
            });

            if (dateRange?.from) params.append("fromDate", dateRange.from.toISOString());
            if (dateRange?.to) params.append("toDate", dateRange.to.toISOString());

            const res = await fetch(`/api/admin/deleted-records?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to fetch records");
            return res.json();
        },
    });

    const records = data?.records || [];
    const total = data?.total || 0;
    const totalPages = Math.ceil(total / limit);

    const tableOptions = [
        { value: "all", label: "All Tables" },
        { value: "invoices", label: "Invoices" },
        { value: "customers", label: "Customers" },
        { value: "vendors", label: "Vendors" },
        { value: "products", label: "Products" },
        { value: "vehicles", label: "Vehicles" },
        { value: "customer_payments", label: "Customer Payments" },
        { value: "vendor_payments", label: "Vendor Payments" },
        { value: "halal_cash_payments", label: "Hamali Payments" },
    ];

    const renderTable = (records: DeletedRecord[]) => (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Record ID</TableHead>
                    <TableHead>Customer Name</TableHead>
                    <TableHead>{activeTab === "delete" ? "Deleted At" : "Edited At"}</TableHead>
                    <TableHead>{activeTab === "delete" ? "Deleted By" : "Edited By"}</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Hamali</TableHead>
                    <TableHead className="text-right">Grand Total</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading ? (
                    <TableRow>
                        <TableCell colSpan={9} className="text-center py-10">Loading...</TableCell>
                    </TableRow>
                ) : records.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={9} className="text-center py-10">No records found</TableCell>
                    </TableRow>
                ) : (
                    records.map((record) => (
                        <TableRow key={record.id}>
                            <TableCell className="font-medium text-blue-600">
                                {record.invoiceNumber || "-"}
                            </TableCell>
                            <TableCell className="font-mono text-[10px] text-muted-foreground">
                                {record.recordId}
                            </TableCell>
                            <TableCell>{record.customerName || "-"}</TableCell>
                            <TableCell className="whitespace-nowrap">
                                {record.deletedAt && format(new Date(record.deletedAt), "MMM dd, p")}
                            </TableCell>
                            <TableCell className="capitalize">{record.deletedBy || "System"}</TableCell>
                            <TableCell className="text-right">
                                {record.amount ? `₹${Number(record.amount).toLocaleString()}` : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                                {record.hamali ? `₹${Number(record.hamali).toLocaleString()}` : "-"}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                                {record.grandTotal ? `₹${Number(record.grandTotal).toLocaleString()}` : "-"}
                            </TableCell>
                            <TableCell className="text-center">
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button variant="ghost" size="icon">
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-2xl max-h-[80vh]">
                                        <DialogHeader>
                                            <DialogTitle>Record Details</DialogTitle>
                                            <DialogDescription>
                                                Table: {record.tableName} | ID: {record.recordId}
                                            </DialogDescription>
                                        </DialogHeader>
                                        <ScrollArea className="h-[400px] w-full rounded-md border p-4 bg-muted/30">
                                            <pre className="text-xs font-mono">
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
    );

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight text-white">Modified Records</h2>
            </div>

            <Tabs defaultValue="edit" onValueChange={(v) => { setActiveTab(v); setPage(1); }}>
                <div className="flex flex-col space-y-4">
                    <div className="flex items-center justify-between bg-card p-2 rounded-lg border border-border">
                        <TabsList className="grid grid-cols-2 w-[400px]">
                            <TabsTrigger value="edit">Edited Records</TabsTrigger>
                            <TabsTrigger value="delete">Deleted Records</TabsTrigger>
                        </TabsList>

                        <div className="flex items-center space-x-2">
                            <DatePickerWithRange date={dateRange} setDate={setDateRange} />

                            <Select value={selectedTable} onValueChange={(v) => { setSelectedTable(v); setPage(1); }}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="All Tables" />
                                </SelectTrigger>
                                <SelectContent>
                                    {tableOptions.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select value={selectedUser} onValueChange={(v) => { setSelectedUser(v); setPage(1); }}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="All Users" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Users</SelectItem>
                                    {users?.map((u) => (
                                        <SelectItem key={u.id} value={u.username}>{u.username}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <Card className="border-border bg-card/50 backdrop-blur-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">
                                Showing {records.length} of {total} records
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <TabsContent value="edit" className="mt-0">
                                {renderTable(records)}
                            </TabsContent>
                            <TabsContent value="delete" className="mt-0">
                                {renderTable(records)}
                            </TabsContent>

                            {totalPages > 1 && (
                                <div className="flex items-center justify-end space-x-2 py-4">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                    >
                                        <ChevronLeft className="h-4 w-4 mr-2" />
                                        Previous
                                    </Button>
                                    <div className="text-sm font-medium">
                                        Page {page} of {totalPages}
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                        disabled={page === totalPages}
                                    >
                                        Next
                                        <ChevronRight className="h-4 w-4 ml-2" />
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </Tabs>
        </div>
    );
}
