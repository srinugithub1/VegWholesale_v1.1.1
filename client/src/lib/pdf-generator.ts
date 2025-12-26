import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export interface ReportData {
    date: string;
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
    doc.text(`Weight Balance Report on Date: ${data.date}`, 18, 34);

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

    // @ts-ignore
    const mainTableY = (doc as any).lastAutoTable.finalY + 5;

    autoTable(doc, {
        startY: mainTableY,
        head: [tableColumn],
        body: tableRows,
        theme: 'grid',
        styles: {
            fontSize: 9,
            cellPadding: 2,
            lineColor: [0, 0, 0],
            lineWidth: 0.1,
            textColor: [0, 0, 0],
            fillColor: [255, 255, 255]
        },
        headStyles: {
            fillColor: [255, 255, 0], // Yellow Header
            textColor: [0, 0, 0],
            fontStyle: 'bold',
            lineWidth: 0.1,
            lineColor: [0, 0, 0] // Border for header
        },
        columnStyles: {
            0: { cellWidth: 10, halign: 'center' }, // S.No
            // Item, Customer grow
            3: { halign: 'center' }, // Weight
            4: { halign: 'center' }, // Bags
            5: { halign: 'right' }, // Price
            6: { halign: 'center' }, // Type
            7: { halign: 'right' }, // Subtotal
            8: { halign: 'right' }, // Hamali
            9: { halign: 'right' }, // Total
        }
    });

    // --- Financial Summary ---
    // @ts-ignore
    const summaryY = (doc as any).lastAutoTable.finalY + 10;

    autoTable(doc, {
        startY: summaryY,
        theme: 'grid',
        head: [],
        body: [
            [{ content: 'Total Credit', styles: { fontStyle: 'bold', fillColor: [255, 255, 0] } }, `₹ ${data.summary.totalCredit.toFixed(2)}`],
            [{ content: 'Total Cash', styles: { fontStyle: 'bold', fillColor: [255, 255, 0] } }, `₹ ${data.summary.totalCash.toFixed(2)}`],
            [{ content: 'Grand Total', styles: { fontStyle: 'bold', fillColor: [255, 255, 0] } }, `₹ ${data.summary.grandTotal.toFixed(2)}`]
        ],
        showHead: 'never',
        styles: {
            fontSize: 10,
            cellPadding: 3,
            lineColor: [0, 0, 0],
            lineWidth: 0.1,
            textColor: [0, 0, 0],
            fillColor: [255, 255, 255]
        },
        columnStyles: {
            0: { cellWidth: 90 }, // Label
            1: { cellWidth: 92, halign: 'right' } // Value
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
            [{ content: 'Total Quantity Remaining', styles: { fontStyle: 'bold' } }, `${data.summary.qtyRemaining.toFixed(2)}`]
        ],
        styles: {
            fontSize: 10,
            cellPadding: 3,
            lineColor: [0, 0, 0],
            lineWidth: 0.1,
            textColor: [0, 0, 0],
            fillColor: [255, 255, 255]
        },
        columnStyles: {
            0: { cellWidth: 90 },
            1: { cellWidth: 92, halign: 'right' }
        }
    });

    doc.save(`Weight_Balance_Report_${data.date}_${data.vehicleNumber || 'All'}.pdf`);
};
