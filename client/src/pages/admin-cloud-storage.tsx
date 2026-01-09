import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Database, HardDrive, ArrowUpRight } from "lucide-react";
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    AreaChart,
    Area,
    CartesianGrid
} from "recharts";
import { format } from "date-fns";

type StorageStats = {
    usedBytes: number;
    totalBytes: number;
    history: {
        date: string;
        dbSizeBytes: number;
    }[];
};

export default function AdminCloudStorage() {
    const { data, isLoading } = useQuery<StorageStats>({
        queryKey: ["/api/admin/storage-stats"],
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[50vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!data) return null;

    const freeBytes = data.totalBytes - data.usedBytes;
    const usedGB = (data.usedBytes / (1024 * 1024 * 1024)).toFixed(2);
    const totalGB = (data.totalBytes / (1024 * 1024 * 1024)).toFixed(0);
    const usedPercentage = ((data.usedBytes / data.totalBytes) * 100).toFixed(1);

    const pieData = [
        { name: "Used", value: data.usedBytes },
        { name: "Available", value: freeBytes },
    ];

    const COLORS = ["#8884d8", "#e5e7eb"]; // Primary color vs Gray

    // Format history for chart
    const historyData = data.history.map(item => ({
        date: format(new Date(item.date), "MMM dd"),
        sizeMB: Number((item.dbSizeBytes / (1024 * 1024)).toFixed(2))
    })).reverse(); // Reverse if server returns desc

    return (
        <div className="p-8 space-y-8 max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h2 className="text-3xl font-bold tracking-tight">Cloud Database Storage</h2>
                    <p className="text-muted-foreground">
                        Monitor your database usage and growth trends.
                    </p>
                </div>
                <div className="flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-lg">
                    <Database className="h-5 w-5" />
                    <span className="font-semibold">{usedGB} GB used of {totalGB} GB</span>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Storage Usage Card */}
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <HardDrive className="h-5 w-5" />
                            Storage Allocation
                        </CardTitle>
                        <CardDescription>Current database file size vs allocated limit.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full flex items-center justify-center relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={80}
                                        outerRadius={110}
                                        fill="#8884d8"
                                        paddingAngle={2}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        <Cell key="cell-used" fill="#a855f7" />
                                        <Cell key="cell-free" fill="#f3f4f6" />
                                    </Pie>
                                    <Tooltip
                                        formatter={(value: number) => {
                                            if (value > 1024 * 1024 * 1024) return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
                                            return `${(value / (1024 * 1024)).toFixed(2)} MB`;
                                        }}
                                    />
                                    <Legend verticalAlign="bottom" height={36} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-4xl font-bold text-primary">{usedPercentage}%</span>
                                <span className="text-sm text-muted-foreground">Used</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Growth Trend Card */}
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ArrowUpRight className="h-5 w-5" />
                            Growth Trend
                        </CardTitle>
                        <CardDescription>Daily database size history.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart
                                    data={historyData}
                                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                                >
                                    <defs>
                                        <linearGradient id="colorSize" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#a855f7" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} />
                                    <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `${val}MB`} />
                                    <Tooltip formatter={(value) => `${value} MB`} />
                                    <Area type="monotone" dataKey="sizeMB" stroke="#a855f7" fillOpacity={1} fill="url(#colorSize)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
