# VegWholesale - Vegetable Wholesale Business Manager

## Overview
VegWholesale is a comprehensive business management system designed for vegetable wholesale operations. It streamlines the entire workflow from procurement (buying from vendors/farmers) to sales (selling to customers). The system aims to provide robust management for vendor and customer relations, inventory, purchases, sales, and financial tracking, ultimately enhancing efficiency and profitability for wholesale businesses.

## User Preferences
- Currency: Indian Rupees (₹)
- Date format: YYYY-MM-DD
- Business focused, minimal UI

## System Architecture
The application is built with a modern web stack:
-   **Frontend**: React with TypeScript, utilizing TailwindCSS for styling and Shadcn UI for componentry. Wouter handles client-side routing, and TanStack Query manages state.
-   **Backend**: Express.js with TypeScript provides the API endpoints.
-   **Database**: PostgreSQL is used for data persistence, managed with Drizzle ORM.

**Key Features & Design Decisions:**
-   **Comprehensive Workflow**: Manages vendors, customers, products, stock, purchases, sales (invoicing), payments, and vehicle tracking.
-   **Inventory Management**: Real-time stock tracking with movement history, reorder level alerts, and a dedicated "Returned" column for vendor returns.
-   **Vendor Returns**: Supports returning defective products with detailed reason tracking, automatic stock deduction, and vendor balance adjustments.
-   **Weighing Station**: Features multi-unit support (weight-based/count-based), auto-detection of product units, and quick invoice generation.
    -   **Weighing Machine Integration**: Direct connectivity with USB/Serial weighing scales via Web Serial API (Chrome/Edge), with configurable settings and a demo mode.
    -   **Hamali Charge System**: Configurable rate per KG, inclusion/exclusion from invoice, and separate cash payment tracking.
-   **Billing/Invoicing**: Automated calculations, stock deduction, and integrated Hamali charge management.
-   **Payment Tracking**: Records vendor and customer payments, tracks outstanding balances, and maintains payment history.
-   **Reporting & Analytics**:
    -   Date range filtering and "View By" options (All Data, Day-wise, Monthly).
    -   CSV export for all reports including totals.
    -   Graphical analytics (Recharts) for sales trends, revenue breakdown, Hamali collection, stock value, and profit margins, adhering to Carbon Design System color tokens.
-   **Sell Page (Fleet View)**: Visual representation of vehicles as cards, showing loaded products and quantities, with direct navigation to the weighing station for sales.
-   **Dashboard**: Provides quick actions, key metrics, outstanding balances, 7-day sales trend, and stock value distribution charts.
-   **Print Center**: Generates print-ready tax invoices and delivery challans with company branding.
-   **User Interface**: Employs IBM Plex Sans and IBM Plex Mono fonts. A green primary color (142 hue) is used for a vegetable/organic theme, with dark/light mode support, following Carbon Design System principles.
-   **Database Schema**: A normalized PostgreSQL schema supports all core entities (users, vendors, customers, products, vehicles, stock, purchases, invoices, payments, returns, Hamali cash, company settings, vehicle inventory, etc.).

## External Dependencies
-   **Replit Auth**: For user authentication.
-   **PostgreSQL**: Relational database.
-   **Drizzle ORM**: ORM for database interaction.
-   **React**: Frontend library.
-   **TailwindCSS**: CSS framework.
-   **Shadcn UI**: UI component library.
-   **Wouter**: Client-side router.
-   **TanStack Query (React Query)**: Data fetching and state management.
-   **Express.js**: Backend web framework.
-   **Web Serial API**: For direct integration with USB/Serial weighing scales (browser-specific).
-   **Recharts**: Charting library for data visualization in reports and dashboard.

## Recent Changes
- December 10, 2025: Customer payment enhancement with invoice editing
  - Two-step payment dialog: Select customer → Review/edit invoices → Finalize payment
  - View all customer invoices with line items in payment dialog
  - Inline editing of product prices per item
  - Inline editing of Hamali charge per invoice
  - Automatic total recalculation as prices are modified
  - "Save Changes Only" option to persist edits without recording payment
  - "Finalize & Record Payment" to save edits and record full payment
  - New API endpoints: GET /api/customers/:id/invoices, PATCH /api/invoices/:id, PATCH /api/invoice-items/:id

- December 10, 2025: Product stock synchronization with vehicle operations
  - Loading products onto vehicles (Sell page) now increases product.currentStock
  - Sales from vehicles now decrease product.currentStock
  - Products tab reflects real-time stock levels after vehicle loading/sales
  - Stock validation prevents sales when product stock is 0 or insufficient
  - Clear error messages show available vs requested quantities
  - Frontend cache invalidates products after sales for immediate UI refresh

- December 9, 2025: Multi-vehicle selection on Sell page
  - Select multiple vehicles simultaneously (click to toggle selection)
  - Each selected vehicle shows independent Customer Sale form (VehicleSalePane component)
  - Vehicle cards show "Selected" badge with check icon when active
  - Sale panes render in responsive 2-column grid
  - "Clear All" button to deselect all vehicles at once
  - Each sale has independent state: products, customer, hamali rate
  - Creating sale on one vehicle doesn't affect others