import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export interface ReportData {
    date: string;
    title: string; // Dynamic Title
    // Vehicle Info Block
    vendorName: string;
    vehicleNumber: string;
    totalWeight: number; // Truck Load
    totalBags: number;   // Truck Bags
    totalGain: number;
    totalLoss: number;

    // Main Table
    items: {
        no: number;
        invoiceNumber: string; // New field
        item: string;
        customer: string;
        weight: number;
        bags: number;
        price: number;
        type: "CREDIT" | "CASH";
        subtotal: number;
        hamali: number;
        total: number;
    }[];

    // Financial Summary
    summary: {
        totalCredit: number;
        totalCash: number;
        grandTotal: number;

        // Stock Summary
        qtyReceived: number; // Weight
        qtySold: number;     // Weight
        qtySoldBags: number; // Bags
        qtyRemaining: number; // Weight
    };
}

export const generateDetailedReport = (data: ReportData) => {
    const doc = new jsPDF();

    // --- Header ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Dr B. R. Ambedkar Vegetable Market (Shop No. 42)", 14, 15);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text("Bowenpally, Secunderabad", 14, 22);

    // --- Title Box ---
    doc.setLineWidth(0.5);
    doc.setFillColor(255, 255, 255);
    doc.rect(14, 28, 182, 10); // Box
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    // Use dynamic title, fallback to Weight Balance Report if missing (for safety)
    const reportTitle = data.title || `Weight Balance Report`;
    doc.text(`${reportTitle} on Date: ${data.date}`, 18, 34);

    // --- Vehicle/Vendor Info Table ---
    const statsY = 43;

    autoTable(doc, {
        startY: statsY,
        theme: 'grid',
        head: [],
        body: [
            [
                { content: 'Vendor Name', styles: { fontStyle: 'bold' } },
                data.vendorName,
                { content: 'Truck Number', styles: { fontStyle: 'bold' } },
                data.vehicleNumber
            ],
            [
                { content: 'Total Weight', styles: { fontStyle: 'bold' } },
                `${data.totalWeight.toFixed(2)}`,
                { content: 'Total Bags', styles: { fontStyle: 'bold' } },
                `${data.totalBags}`
            ],
            [
                { content: 'Total Gain', styles: { fontStyle: 'bold' } },
                `${data.totalGain.toFixed(2)}`,
                { content: 'Total Loss', styles: { fontStyle: 'bold' } },
                `${data.totalLoss.toFixed(2)}`
            ]
        ],
        styles: {
            fontSize: 10,
            cellPadding: 2,
            lineColor: [0, 0, 0],
            lineWidth: 0.1,
            textColor: [0, 0, 0],
            fillColor: [255, 255, 255]
        },
        columnStyles: {
            0: { cellWidth: 35 },
            1: { cellWidth: 55 },
            2: { cellWidth: 35 },
            3: { cellWidth: 57 }
        }
    });

    // --- Main Items Table ---
    const tableColumn = [
        "S.No",
        "Invoice", // New Column
        "Item",
        "Customer",
        "Weight",
        "Bags",
        "Price",
        "Type",
        "Subtotal",
        "Hamali",
        "Total"
    ];

    const tableRows = data.items.map(item => [
        item.no,
        item.invoiceNumber, // New Data
        item.item,
        item.customer,
        item.weight.toFixed(2),
        item.bags || '',
        item.price.toFixed(2),
        item.type,
        item.subtotal.toFixed(2),
        item.hamali.toFixed(2),
        item.total.toFixed(2)
    ]);

    // Financial Totals for Footer (adjusted colSpan to 10 for new column)
    const footRows = [
        [
            { content: 'Total Credit', colSpan: 10, styles: { halign: 'right' as const, fontStyle: 'bold' as const } },
            { content: data.summary.totalCredit.toFixed(2), styles: { halign: 'right' as const, fontStyle: 'bold' as const } }
        ],
        [
            { content: 'Total Cash', colSpan: 10, styles: { halign: 'right' as const, fontStyle: 'bold' as const } },
            { content: data.summary.totalCash.toFixed(2), styles: { halign: 'right' as const, fontStyle: 'bold' as const } }
        ],
        [
            { content: 'Grand Total', colSpan: 10, styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [240, 253, 244] as [number, number, number] } },
            { content: `₹ ${data.summary.grandTotal.toFixed(2)}`, styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [240, 253, 244] as [number, number, number] } }
        ]
    ];

    // @ts-ignore
    const mainTableY = (doc as any).lastAutoTable.finalY + 5;

    autoTable(doc, {
        startY: mainTableY,
        head: [tableColumn],
        body: tableRows,
        foot: footRows,
        theme: 'grid',
        styles: {
            fontSize: 9,
            cellPadding: 2,
            lineColor: [229, 231, 235], // Light Gray
            lineWidth: 0.1,
            textColor: [31, 41, 55], // Gray 800
            fillColor: [255, 255, 255]
        },
        headStyles: {
            fillColor: [22, 101, 52], // Green 800
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            lineWidth: 0.1,
            lineColor: [22, 101, 52]
        },
        alternateRowStyles: {
            fillColor: [249, 250, 251] // Gray 50
        },
        columnStyles: {
            0: { cellWidth: 10, halign: 'center' }, // S.No
            1: { cellWidth: 20, halign: 'center' }, // Invoice No
            // Item, Customer grow
            4: { halign: 'center' }, // Weight
            5: { halign: 'center' }, // Bags
            6: { halign: 'right' }, // Price
            7: { halign: 'center' }, // Type
            8: { halign: 'right' }, // Subtotal
            9: { halign: 'right' }, // Hamali
            10: { halign: 'right' }, // Total
        }
    });

    // --- Stock Summary ---
    // @ts-ignore
    const stockY = (doc as any).lastAutoTable.finalY + 10;

    autoTable(doc, {
        startY: stockY,
        theme: 'grid',
        head: [],
        body: [
            [{ content: 'Total Quantity Received', styles: { fontStyle: 'bold' } }, `${data.summary.qtyReceived.toFixed(2)}`],
            [{ content: 'Total Quantity Sold', styles: { fontStyle: 'bold' } }, `${data.summary.qtySold.toFixed(2)}`],
            [{ content: 'Total Bags Sold', styles: { fontStyle: 'bold', fillColor: [255, 255, 0] as [number, number, number] } }, `${data.summary.qtySoldBags}`],
            [{ content: 'Total Quantity Remaining', styles: { fontStyle: 'bold' } }, `${data.summary.qtyRemaining.toFixed(2)}`]
        ],
        styles: {
            fontSize: 10,
            cellPadding: 3,
            lineColor: [229, 231, 235],
            lineWidth: 0.1,
            textColor: [31, 41, 55],
            fillColor: [255, 255, 255]
        },
        columnStyles: {
            0: { cellWidth: 90 },
            1: { cellWidth: 92, halign: 'right' }
        }
    });

    doc.save(`${reportTitle.replace(/\s+/g, '_')}_${data.date}.pdf`);
};

export interface CreditReportData {
    period: string; // "From: ... To: ..."
    items: {
        no: number;
        customerName: string;
        invoiceNumber: string;
        status: string;
        date: string;
        amount: number;
    }[];
    totalAmount: number;
}

export const generateCreditReport = (data: CreditReportData) => {
    const doc = new jsPDF();

    // --- Header ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Dr B. R. Ambedkar Vegetable Market (Shop No. 42)", 14, 15);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text("Bowenpally, Secunderabad", 14, 22);

    // --- Title Box ---
    doc.setLineWidth(0.5);
    doc.setFillColor(255, 255, 255);
    doc.rect(14, 28, 182, 10); // Box
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`Customers Credit Report (${data.period})`, 18, 34);

    // --- Main Table ---
    const tableColumn = [
        "S.No",
        "Customer Name",
        "Invoice No",
        "Status",
        "Date",
        "Credit Amount"
    ];

    const tableRows = data.items.map(item => [
        item.no,
        item.customerName,
        item.invoiceNumber,
        (item.status || "pending").toUpperCase(),
        item.date,
        `Rs ${item.amount.toFixed(2)}`
    ]);

    // Footer Row
    const footRows = [
        [
            { content: 'Total Credit Amount', colSpan: 5, styles: { halign: 'right' as const, fontStyle: 'bold' as const } },
            { content: `Rs ${data.totalAmount.toFixed(2)}`, styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [220, 252, 231] as [number, number, number] } }
        ]
    ];

    autoTable(doc, {
        startY: 45,
        head: [tableColumn],
        body: tableRows,
        foot: footRows,
        theme: 'grid',
        styles: {
            fontSize: 10,
            cellPadding: 3,
            lineColor: [229, 231, 235],
            lineWidth: 0.1,
            textColor: [31, 41, 55],
            fillColor: [255, 255, 255]
        },
        headStyles: {
            fillColor: [22, 163, 74], // Green 600 (Success color)
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            lineWidth: 0.1,
            lineColor: [22, 163, 74]
        },
        alternateRowStyles: {
            fillColor: [249, 250, 251]
        },
        columnStyles: {
            0: { cellWidth: 15, halign: 'center' },
            5: { halign: 'right' }
        }
    });

    const timestamp = new Date().toISOString().split('T')[0];
    doc.save(`Customer_Credit_Report_${timestamp}.pdf`);
};
