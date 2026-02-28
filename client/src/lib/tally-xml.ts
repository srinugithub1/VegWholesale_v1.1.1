
import { format } from "date-fns";
import type { Invoice, InvoiceItem, Purchase, PurchaseItem, Customer, Vendor, Product } from "@shared/schema";

// Helper to escape special XML characters
const escapeXml = (unsafe: string | null | undefined): string => {
  if (!unsafe) return "";
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "'": return "&apos;";
      case '"': return "&quot;";
      default: return c;
    }
  });
};

// Converts standard YYYY-MM-DD to Tally Date format YYYYMMDD
const formatTallyDate = (dateStr: string): string => {
  try {
    const cleanDate = dateStr.split("T")[0]; // Handle timestamps if present
    return cleanDate.replace(/-/g, "");
  } catch (e) {
    return format(new Date(), "yyyyMMdd");
  }
};

const TALLY_HEADER = `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>VegWholesale</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>`;

const TALLY_FOOTER = `
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

// --- Masters Generation ---

export const generateMastersXML = (customers: Customer[], vendors: Vendor[]): string => {
  let xml = "";

  // Customer Ledgers (Sundry Debtors)
  customers.forEach(cust => {
    xml += `
      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <LEDGER NAME="${escapeXml(cust.name)}" RESERVEDNAME="">
           <ADDRESS.LIST TYPE="String">
             <ADDRESS>${escapeXml(cust.address || "")}</ADDRESS>
             <ADDRESS>${escapeXml(cust.phone || "")}</ADDRESS>
           </ADDRESS.LIST>
           <PARENT>Sundry Debtors</PARENT>
           <OPENINGBALANCE>0</OPENINGBALANCE>
           <ISBILLWISEON>No</ISBILLWISEON>
        </LEDGER>
      </TALLYMESSAGE>`;
  });

  // Vendor Ledgers (Sundry Creditors)
  vendors.forEach(vend => {
    xml += `
      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <LEDGER NAME="${escapeXml(vend.name)}" RESERVEDNAME="">
           <ADDRESS.LIST TYPE="String">
             <ADDRESS>${escapeXml(vend.address || "")}</ADDRESS>
             <ADDRESS>${escapeXml(vend.phone || "")}</ADDRESS>
           </ADDRESS.LIST>
           <PARENT>Sundry Creditors</PARENT>
           <OPENINGBALANCE>0</OPENINGBALANCE>
           <ISBILLWISEON>No</ISBILLWISEON>
        </LEDGER>
      </TALLYMESSAGE>`;
  });

  return xml;
};

// --- Vouchers Generation ---

export const SALES_FIELDS = [
  { id: "partyName", label: "Customer Name" },
  { id: "itemName", label: "Product" },
  { id: "quantity", label: "Quantity" },
  { id: "rate", label: "Rate" },
  { id: "weight", label: "Total Weight" },
  { id: "amount", label: "Total Amount" },
  { id: "hamali", label: "Hamali" },
  { id: "date", label: "Date" },
  { id: "voucherNumber", label: "Voucher Number" }
];

export const generateSalesVouchersXML = (
  invoices: Invoice[],
  customers: Customer[],
  selectedFields: string[] = SALES_FIELDS.map(f => f.id),
  invoiceItems: InvoiceItem[] = [],
  products: Product[] = []
): string => {
  let xml = "";
  const customerMap = new Map(customers.map(c => [c.id, c.name]));
  const productMap = new Map(products.map(p => [p.id, p.name]));
  const itemsByInvoice = new Map<string, InvoiceItem[]>();

  invoiceItems.forEach(item => {
    const list = itemsByInvoice.get(item.invoiceId) || [];
    list.push(item);
    itemsByInvoice.set(item.invoiceId, list);
  });

  // Default Sales Ledger Name
  const SALES_LEDGER = "Sales Account";

  invoices.forEach(inv => {
    const customerName = escapeXml(customerMap.get(inv.customerId) || "Unknown Customer");
    const date = formatTallyDate(inv.date);
    const voucherNumber = escapeXml(inv.invoiceNumber);
    const amount = inv.grandTotal;
    const currentInvoiceItems = itemsByInvoice.get(inv.id) || [];

    const hasInventoryFields = selectedFields.some(f => ["itemName", "quantity", "rate"].includes(f));

    xml += `
      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Accounting Voucher View">
          ${selectedFields.includes("date") ? `<DATE>${date}</DATE>` : ""}
          <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
          ${selectedFields.includes("voucherNumber") ? `<VOUCHERNUMBER>${voucherNumber}</VOUCHERNUMBER>` : ""}
          ${selectedFields.includes("voucherNumber") ? `<REFERENCE>${voucherNumber}</REFERENCE>` : ""}
          ${selectedFields.includes("partyName") ? `<PARTYLEDGERNAME>${customerName}</PARTYLEDGERNAME>` : ""}
          
          ${selectedFields.includes("partyName") ? `
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>${customerName}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
            ${selectedFields.includes("amount") ? `<AMOUNT>-${amount}</AMOUNT>` : ""}
          </ALLLEDGERENTRIES.LIST>` : ""}

          <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>
          ${inv.totalKgWeight && selectedFields.includes("weight") ? `<NARRATION>Total Weight: ${inv.totalKgWeight} kg</NARRATION>` : ""}

          ${hasInventoryFields && currentInvoiceItems.length > 0 ?
        currentInvoiceItems.map(item => {
          const productName = escapeXml(productMap.get(item.productId) || "Unknown Product");
          return `
          <!-- Inventory Entry -->
          <ALLINVENTORYENTRIES.LIST>
            ${selectedFields.includes("itemName") ? `<STOCKITEMNAME>${productName}</STOCKITEMNAME>` : ""}
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            ${selectedFields.includes("quantity") ? `<ACTUALQTY>${item.quantity}</ACTUALQTY><BILLEDQTY>${item.quantity}</BILLEDQTY>` : ""}
            ${selectedFields.includes("rate") ? `<RATE>${item.unitPrice}</RATE>` : ""}
            ${selectedFields.includes("amount") ? `<AMOUNT>${item.total}</AMOUNT>` : ""}
            <ACCOUNTINGALLOCATIONS.LIST>
                <LEDGERNAME>${SALES_LEDGER}</LEDGERNAME>
                <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                ${selectedFields.includes("amount") ? `<AMOUNT>${item.total}</AMOUNT>` : ""}
            </ACCOUNTINGALLOCATIONS.LIST>
          </ALLINVENTORYENTRIES.LIST>`;
        }).join("") : (selectedFields.includes("amount") ? `
          <!-- Ledger Entry for Sales Account (Credit) -->
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>${SALES_LEDGER}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>${amount}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>` : "")}

          ${selectedFields.includes("hamali") && inv.hamaliChargeAmount && inv.hamaliChargeAmount > 0 ? `
          <!-- Hamali Charges Ledger Entry -->
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>Hamali Income</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>${inv.hamaliChargeAmount}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>` : ""}
        </VOUCHER>
      </TALLYMESSAGE>`;
  });

  return xml;
};

export const generatePurchaseVouchersXML = (purchases: Purchase[], vendors: Vendor[]): string => {
  let xml = "";
  const vendorMap = new Map(vendors.map(v => [v.id, v.name]));
  const PURCHASE_LEDGER = "Purchase Account";

  purchases.forEach(pur => {
    const vendorName = escapeXml(vendorMap.get(pur.vendorId) || "Unknown Vendor");
    const date = formatTallyDate(pur.date);
    const voucherNumber = escapeXml(pur.id.substring(0, 8)); // Using ID as Ref since Purchase usually has vendor's ref
    const amount = pur.totalAmount;

    xml += `
      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <VOUCHER VCHTYPE="Purchase" ACTION="Create" OBJVIEW="Accounting Voucher View">
          <DATE>${date}</DATE>
          <VOUCHERTYPENAME>Purchase</VOUCHERTYPENAME>
          <VOUCHERNUMBER>${voucherNumber}</VOUCHERNUMBER>
          <REFERENCE>${voucherNumber}</REFERENCE>
          <PARTYLEDGERNAME>${vendorName}</PARTYLEDGERNAME>

          <!-- Ledger Entry for Vendor (Credit) -->
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>${vendorName}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>${amount}</AMOUNT> <!-- Credit is Positive -->
          </ALLLEDGERENTRIES.LIST>

          <!-- Ledger Entry for Purchase Account (Debit) -->
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>${PURCHASE_LEDGER}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
            <AMOUNT>-${amount}</AMOUNT> <!-- Debit is Negative -->
          </ALLLEDGERENTRIES.LIST>
        </VOUCHER>
      </TALLYMESSAGE>`;
  });

  return xml;
};

export const wrapTallyXML = (content: string): string => {
  return TALLY_HEADER + content + TALLY_FOOTER;
};
