
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileSpreadsheet, AlertCircle, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { InsertCustomer } from "@shared/schema";

type ExcelRow = Record<string, any>;

export function ImportCustomersDialog() {
    const [open, setOpen] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [headers, setHeaders] = useState<string[]>([]);
    const [rows, setRows] = useState<ExcelRow[]>([]);
    const [mapping, setMapping] = useState<{
        name: string;
        phone: string;
        email: string;
        address: string;
    }>({
        name: "",
        phone: "",
        email: "",
        address: "",
    });
    const [isUploading, setIsUploading] = useState(false);
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setFile(selectedFile);

        // Read Excel Data
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: "binary" });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json<ExcelRow>(ws, { header: 1 });

                if (data.length > 0) {
                    const headers = data[0] as string[];
                    const rows = XLSX.utils.sheet_to_json<ExcelRow>(ws);

                    setHeaders(headers);
                    setRows(rows.slice(0, 5)); // Preview first 5 rows

                    // Auto-guess mapping
                    const newMapping = { ...mapping };
                    headers.forEach(h => {
                        const lower = h.toLowerCase();
                        if (lower.includes("name")) newMapping.name = h;
                        if (lower.includes("phone") || lower.includes("mobile")) newMapping.phone = h;
                        if (lower.includes("email")) newMapping.email = h;
                        if (lower.includes("add") || lower.includes("city")) newMapping.address = h;
                    });
                    setMapping(newMapping);
                }
            } catch (error) {
                console.error("Error parsing excel:", error);
                toast({ title: "Failed to parse file", variant: "destructive" });
            }
        };
        reader.readAsBinaryString(selectedFile);
    };

    const handleImport = async () => {
        if (!file || !mapping.name || !mapping.phone) {
            toast({ title: "Please map Name and Phone fields", variant: "destructive" });
            return;
        }

        setIsUploading(true);

        try {
            // Re-read full file to get all rows
            const reader = new FileReader();
            reader.onload = async (evt) => {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: "binary" });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const allRows = XLSX.utils.sheet_to_json<ExcelRow>(ws);

                const customersToImport: InsertCustomer[] = allRows.map((row) => ({
                    name: String(row[mapping.name] || "").trim(),
                    phone: String(row[mapping.phone] || "").trim(),
                    email: mapping.email ? String(row[mapping.email] || "") : undefined,
                    address: mapping.address ? String(row[mapping.address] || "") : undefined,
                })).filter(c => c.name && c.phone); // Filter empty rows

                if (customersToImport.length === 0) {
                    toast({ title: "No valid customers found", variant: "destructive" });
                    setIsUploading(false);
                    return;
                }

                await apiRequest("POST", "/api/customers/bulk", customersToImport);

                queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
                toast({ title: `Successfully imported ${customersToImport.length} customers` });
                setOpen(false);
                setFile(null);
                setRows([]);
                setIsUploading(false);
            };
            reader.readAsBinaryString(file);

        } catch (error) {
            console.error("Import error:", error);
            toast({ title: "Import failed", variant: "destructive" });
            setIsUploading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <Upload className="h-4 w-4 mr-2" />
                    Import
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Import Customers</DialogTitle>
                    <DialogDescription>
                        Upload an Excel or CSV file to create customers in bulk.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* File Upload Area */}
                    {!file && (
                        <div
                            className="border-2 border-dashed rounded-lg p-12 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-4" />
                            <p className="font-medium">Click to upload Excel/CSV</p>
                            <p className="text-sm text-muted-foreground mt-1">Supported formats: .xlsx, .xls, .csv</p>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx, .xls, .csv"
                                className="hidden"
                                onChange={handleFileChange}
                            />
                        </div>
                    )}

                    {/* Mapping & Preview Area */}
                    {file && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <FileSpreadsheet className="h-5 w-5 text-green-600" />
                                    <span className="font-medium">{file.name}</span>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => { setFile(null); setRows([]); }}>
                                    Change File
                                </Button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Map "Name" Column <span className="text-red-500">*</span></Label>
                                    <Select value={mapping.name} onValueChange={(v) => setMapping(p => ({ ...p, name: v }))}>
                                        <SelectTrigger><SelectValue placeholder="Select column" /></SelectTrigger>
                                        <SelectContent>
                                            {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Map "Phone" Column <span className="text-red-500">*</span></Label>
                                    <Select value={mapping.phone} onValueChange={(v) => setMapping(p => ({ ...p, phone: v }))}>
                                        <SelectTrigger><SelectValue placeholder="Select column" /></SelectTrigger>
                                        <SelectContent>
                                            {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Map "Email" Column</Label>
                                    <Select value={mapping.email} onValueChange={(v) => setMapping(p => ({ ...p, email: v }))}>
                                        <SelectTrigger><SelectValue placeholder="Select column" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="">-- Skip --</SelectItem>
                                            {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Map "Address" Column</Label>
                                    <Select value={mapping.address} onValueChange={(v) => setMapping(p => ({ ...p, address: v }))}>
                                        <SelectTrigger><SelectValue placeholder="Select column" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="">-- Skip --</SelectItem>
                                            {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Preview Table */}
                            <div className="border rounded-md">
                                <div className="bg-muted px-4 py-2 text-sm font-medium border-b">Preview (First 5 rows)</div>
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Mapped Name</TableHead>
                                                <TableHead>Mapped Phone</TableHead>
                                                <TableHead>Mapped Email</TableHead>
                                                <TableHead>Mapped Address</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {rows.map((row, i) => (
                                                <TableRow key={i}>
                                                    <TableCell>{row[mapping.name] || <span className="text-muted-foreground italic">Missing</span>}</TableCell>
                                                    <TableCell>{row[mapping.phone] || <span className="text-muted-foreground italic">Missing</span>}</TableCell>
                                                    <TableCell>{row[mapping.email]}</TableCell>
                                                    <TableCell>{row[mapping.address]}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleImport} disabled={!file || isUploading || !mapping.name || !mapping.phone}>
                        {isUploading ? "Importing..." : "Import Customers"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
