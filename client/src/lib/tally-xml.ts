
import { format } from "date-fns";
import type { Invoice, InvoiceItem, Purchase, PurchaseItem, Customer, Vendor } from "@shared/schema";

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

export const generateSalesVouchersXML = (invoices: Invoice[], customers: Customer[], settings?: any): string => {
    let xml = "";
    const customerMap = new Map(customers.map(c => [c.id, c.name]));

    // Default Sales Ledger Name
    const SALES_LEDGER = "Sales Account";

    invoices.forEach(inv => {
        const customerName = escapeXml(customerMap.get(inv.customerId) || "Unknown Customer");
        const date = formatTallyDate(inv.date);
        const voucherNumber = escapeXml(inv.invoiceNumber);
        const amount = inv.grandTotal;

        xml += `
      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Accounting Voucher View">
          <DATE>${date}</DATE>
          <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
          <VOUCHERNUMBER>${voucherNumber}</VOUCHERNUMBER>
          <REFERENCE>${voucherNumber}</REFERENCE>
          <PARTYLEDGERNAME>${customerName}</PARTYLEDGERNAME>
          <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>

          <!-- Ledger Entry for Customer (Debit) -->
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>${customerName}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
            <AMOUNT>-${amount}</AMOUNT> <!-- Negative implies Debit in Tally XML for some reason, or standard rules apply. Usually Debit is positive?? Wait. Tally XML: Debit is Negative usually?? verification needed. Actually: Tally XML Amount: Negative = Debit, Positive = Credit. Correct for Customer (Debtor) is Debit (-). -->
          </ALLLEDGERENTRIES.LIST>

          <!-- Ledger Entry for Sales Account (Credit) -->
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>${SALES_LEDGER}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>${amount}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>
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
