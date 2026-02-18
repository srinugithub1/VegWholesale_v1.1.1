
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Download, FileJson } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { generateMastersXML, generateSalesVouchersXML, generatePurchaseVouchersXML, wrapTallyXML } from "@/lib/tally-xml";
import type { Invoice, Purchase, Customer, Vendor } from "@shared/schema";

export default function TallyExport() {
    const { toast } = useToast();
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [includeMasters, setIncludeMasters] = useState(true);
    const [includeSales, setIncludeSales] = useState(true);
    const [includePurchases, setIncludePurchases] = useState(true);

    // Fetch Data (Full dump for client-side filtering logic for now, or could filter by date in backend. 
    // Given user wants "bulk export", loading all active customers/vendors is cheap. 
    // Loading ALL invoices might be heavy, but we updated limit to 2000. 
    // For proper date range export, we should filter client side efficiently or add API filters. 
    // Implementing client-side filter on the 2000 items is a good start matching current limits.)

    const { data: invoicesResult } = useQuery<{ invoices: Invoice[], total: number }>({
        queryKey: ["/api/invoices?limit=2000"],
    });
    const invoices = invoicesResult?.invoices || [];

    const { data: purchases = [] } = useQuery<Purchase[]>({
        queryKey: ["/api/purchases"],
    });

    const { data: customers = [] } = useQuery<Customer[]>({
        queryKey: ["/api/customers"],
    });

    const { data: vendors = [] } = useQuery<Vendor[]>({
        queryKey: ["/api/vendors"],
    });

    const handleExport = () => {
        if (!date) {
            toast({ title: "Please select a date", variant: "destructive" });
            return;
        }

        try {
            const selectedDateStr = format(date, "yyyy-MM-dd");
            let xmlContent = "";

            // 1. Masters (Optional but recommended)
            if (includeMasters) {
                xmlContent += generateMastersXML(customers, vendors);
            }

            // 2. Sales (Filtered by Date)
            if (includeSales) {
                const dailyInvoices = invoices.filter(inv => inv.date === selectedDateStr);
                if (dailyInvoices.length > 0) {
                    xmlContent += generateSalesVouchersXML(dailyInvoices, customers);
                }
            }

            // 3. Purchases (Filtered by Date)
            if (includePurchases) {
                const dailyPurchases = purchases.filter(p => p.date === selectedDateStr);
                if (dailyPurchases.length > 0) {
                    xmlContent += generatePurchaseVouchersXML(dailyPurchases, vendors);
                }
            }

            if (!xmlContent) {
                toast({ title: "No data found for selected date", variant: "default" });
                return;
            }

            const finalXml = wrapTallyXML(xmlContent);

            // Trigger Download
            const blob = new Blob([finalXml], { type: "application/xml" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `Tally_Data_${selectedDateStr}.xml`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            toast({ title: "XML File Generated", description: "Import this file into Tally Gold." });

        } catch (err: any) {
            console.error("Export error:", err);
            toast({ title: "Export Failed", description: err.message, variant: "destructive" });
        }
    };

    return (
        <div className="p-8 space-y-8 max-w-4xl mx-auto">
            <div className="space-y-1">
                <h2 className="text-3xl font-bold tracking-tight">Tally Integration</h2>
                <p className="text-muted-foreground">Export your daily data to Tally Gold.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileJson className="h-5 w-5 text-primary" />
                        XML Export
                    </CardTitle>
                    <CardDescription>
                        Generate an XML file containing Masters, Sales, and Purchases for a specific date.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">

                    <div className="grid gap-2">
                        <Label>Select Date</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                        "w-[240px] justify-start text-left font-normal",
                                        !date && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {date ? format(date, "PPP") : <span>Pick a date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={date}
                                    onSelect={setDate}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="space-y-4">
                        <Label className="text-base">Data to Export</Label>

                        <div className="flex items-center space-x-2">
                            <Checkbox id="masters" checked={includeMasters} onCheckedChange={(c) => setIncludeMasters(!!c)} />
                            <Label htmlFor="masters">Masters (Customers & Vendors)</Label>
                        </div>

                        <div className="flex items-center space-x-2">
                            <Checkbox id="sales" checked={includeSales} onCheckedChange={(c) => setIncludeSales(!!c)} />
                            <Label htmlFor="sales">Sales (Invoices)</Label>
                        </div>

                        <div className="flex items-center space-x-2">
                            <Checkbox id="purchases" checked={includePurchases} onCheckedChange={(c) => setIncludePurchases(!!c)} />
                            <Label htmlFor="purchases">Purchases</Label>
                        </div>
                    </div>

                    <Button onClick={handleExport} className="w-full sm:w-auto">
                        <Download className="mr-2 h-4 w-4" />
                        Download Tally XML
                    </Button>

                </CardContent>
            </Card>

            <div className="bg-muted/50 p-4 rounded-lg text-sm text-muted-foreground">
                <p className="font-semibold mb-2">How to Import into Tally:</p>
                <ol className="list-decimal list-inside space-y-1">
                    <li>Download the XML file.</li>
                    <li>Open Tally Gold/Prime.</li>
                    <li>Go to <strong>Import Data</strong> &gt; <strong>Vouchers</strong>.</li>
                    <li>Enter the full path format of the downloaded file.</li>
                    <li>Data will be imported automatically. Missing customers will be created.</li>
                </ol>
            </div>
        </div>
    );
}
