import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

// Define interface for report data
export interface ReportData {
    date: string;
    vehicleNumber?: string;
    items: {
        no: number;
        item: string;
        customer: string;
        weight: number;
        bags: number;
        avgPrice: number;
        sale: number;
        type: string;
    }[];
    summary: {
        totalReceivedWeight: number;
        totalReceivedBags: number;
        totalSoldWeight: number;
        totalSoldBags: number;
        totalRemainingWeight: number;
        totalRemainingBags: number;
        totalSaleAmount: number;
        creditAmount: number;
        cashAmount: number;
    };
}

export const generateDetailedReport = (data: ReportData) => {
    const doc = new jsPDF();

    // --- Header ---
    // Logo placeholder (Green box for now, or text)
    doc.setFillColor(220, 250, 220);
    doc.rect(14, 10, 25, 25, "F");
    doc.setTextColor(34, 139, 34); // Forest Green
    doc.setFontSize(10);
    doc.text("PSK", 18, 25);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Dr.B R Ambedkar Vegetable Market (50)", 14, 45);
    doc.setFont("helvetica", "normal");
    doc.text("Bowenpally, Secunderabad", 14, 52);

    // --- Title Bar ---
    doc.setFillColor(245, 245, 245);
    doc.rect(14, 58, 182, 12, "F");

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`Weight Balance Report on Date: ${data.date}`, 18, 66);

    // --- Vehicle Details ---
    if (data.vehicleNumber) {
        doc.setFontSize(11);
        doc.text(`Truck Number: ${data.vehicleNumber}`, 14, 80);
    }

    // --- Table ---
    const tableColumn = [
        "No",
        "Item",
        "Customer",
        "Weight\n(Kg)",
        "Bags",
        "Avg.\nPrice",
        "Sale",
        "Type"
    ];

    const tableRows = data.items.map(item => [
        item.no,
        item.item,
        item.customer,
        item.weight.toFixed(0),
        item.bags,
        item.avgPrice.toFixed(0),
        `₹ ${item.sale.toLocaleString('en-IN')}`,
        item.type.toUpperCase()
    ]);

    // Use autoTable (cast to any because of type definition issues in some environments)
    (doc as any).autoTable({
        startY: 85,
        head: [tableColumn],
        body: tableRows,
        theme: 'plain',
        styles: {
            fontSize: 9,
            cellPadding: 3,
            valign: 'middle',
            lineColor: [220, 220, 220],
            lineWidth: 0.1,
        },
        headStyles: {
            fontStyle: 'bold',
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0],
            lineWidth: 0,
            minCellHeight: 15, // Make header taller
            valign: 'bottom'
        },
        columnStyles: {
            0: { cellWidth: 10, halign: 'center' }, // No
            1: { cellWidth: 25 }, // Item
            2: { cellWidth: 50 }, // Customer
            3: { cellWidth: 20, halign: 'center' }, // Weight
            4: { cellWidth: 15, halign: 'center' }, // Bags
            5: { cellWidth: 20, halign: 'center' }, // Avg Price
            6: { cellWidth: 25, halign: 'right' }, // Sale
            7: { cellWidth: 20, halign: 'center' }, // Type
        },
        didDrawPage: (_data: any) => {
            // Footer on every page if needed, but we do summary at end
        }
    });

    // --- Footer / Summary ---
    // @ts-ignore
    const finalY = (doc as any).lastAutoTable.finalY + 10;

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");

    let currentY = finalY;

    // Stock Summary
    doc.text(`Total Quantity Received: ${data.summary.totalReceivedWeight} Kg AND ${data.summary.totalReceivedBags} Bags`, 14, currentY);
    currentY += 6;
    doc.text(`Total Quantity Sold: ${data.summary.totalSoldWeight} Kg AND ${data.summary.totalSoldBags} Bags`, 14, currentY);
    currentY += 6;
    doc.text(`Total Quantity Remaining: ${data.summary.totalRemainingWeight} Kg AND ${data.summary.totalRemainingBags} Bags`, 14, currentY);

    // Financial Summary
    currentY += 10;
    // Black Line
    doc.setLineWidth(0.5);
    doc.line(14, currentY - 5, 196, currentY - 5);

    doc.text(`Total Sale: ₹${data.summary.totalSaleAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 14, currentY);

    currentY += 8;
    doc.text(`CREDIT: ₹${data.summary.creditAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} + CASH: ₹${data.summary.cashAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 14, currentY);

    // Save the PDF
    doc.save(`Weight_Balance_Report_${data.date}_${data.vehicleNumber || 'All'}.pdf`);
};
