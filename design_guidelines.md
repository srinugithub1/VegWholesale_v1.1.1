# Vegetable Wholesale Business Management System - Design Guidelines

## Design Approach
**Carbon Design System** - Selected for its excellence in data-heavy enterprise applications. Carbon's structured approach provides the clarity and efficiency needed for managing complex business operations.

## Core Design Principles
1. **Data Clarity First**: Information hierarchy optimized for quick scanning and decision-making
2. **Workflow Efficiency**: Minimize clicks, prioritize frequently-used actions
3. **Professional Restraint**: Clean, business-appropriate aesthetics without unnecessary decoration

## Typography System
- **Primary Font**: IBM Plex Sans (Carbon's native typeface) via Google Fonts
- **Headings**: 
  - Dashboard title: text-2xl font-semibold
  - Section headers: text-lg font-semibold
  - Card titles: text-base font-medium
- **Body Text**: text-sm for tables and forms, text-base for descriptions
- **Data/Numbers**: font-mono for amounts, quantities, invoice numbers

## Layout System
**Spacing Units**: Tailwind units of 2, 4, 6, and 8 for consistent rhythm
- Component padding: p-4, p-6
- Section margins: mb-6, mb-8
- Form field spacing: space-y-4
- Table cell padding: px-4 py-3

**Grid Structure**:
- Dashboard cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-4 (metrics)
- Tables: Full-width with responsive scroll
- Forms: Single column on mobile, 2-column (md:grid-cols-2) on desktop
- Side-by-side views: Split 60/40 for list/detail patterns

## Component Library

### Navigation
- **Top Navigation Bar**: Fixed header with app logo, main navigation links (Dashboard, Vendors, Customers, Products, Vehicles, Stock, Billing), user profile dropdown
- **Sidebar** (optional for larger screens): Collapsible left sidebar with icon + text navigation
- Active state: Subtle background highlight, not color-based

### Dashboard
- **Metric Cards**: 4-column grid showing Total Stock Value, Active Vendors, Pending Orders, Today's Sales
- **Recent Activity Table**: Latest 10 transactions with quick filters
- **Stock Alerts**: Warning indicators for low-stock items
- **Quick Actions**: Prominent buttons for "New Purchase Order" and "New Invoice"

### Data Tables
- **Structure**: Striped rows for readability, sticky headers on scroll
- **Column Types**: 
  - Text data: left-aligned
  - Numbers/amounts: right-aligned with monospace font
  - Actions: right-aligned icon buttons (Edit, Delete, View)
- **Pagination**: Bottom-aligned with page size selector
- **Search/Filter**: Top-aligned search bar with filter dropdowns
- **Empty States**: Centered message with action button to add first item

### Forms
- **Layout**: Two-column grid for related fields (Name/Phone, Product/Quantity)
- **Input Fields**: Full-width with clear labels above, helper text below when needed
- **Required Fields**: Asterisk (*) indicator next to label
- **Dropdowns**: Searchable selects for Vendors, Customers, Products
- **Number Inputs**: Steppers for quantities, formatted inputs for currency
- **Toggle Switches**: For Hamali Charge include/exclude option
- **Submit Actions**: Primary button (right-aligned), secondary cancel button

### Billing Interface
- **Invoice Header**: Company info, invoice number, date, customer details in structured layout
- **Line Items Table**: Product, Quantity, Unit Price, Total columns
- **Calculations Section**: 
  - Subtotal (right-aligned)
  - Hamali Charge toggle with amount display
  - Grand Total (emphasized with larger font)
- **Action Buttons**: Print, Save, Send to Customer

### Stock Management
- **Inventory View**: Table with Product Name, Current Stock, Unit, Reorder Level, Last Updated
- **Color-coded Indicators**: Use neutral backgrounds (not colors) with icons for stock levels
- **Quick Adjust**: Inline buttons to add/reduce stock with modal for entry details

### Modals & Overlays
- **Standard Modal**: Centered, max-width-2xl, with header, scrollable content, footer actions
- **Confirmation Dialogs**: Smaller, focused confirmations for delete/critical actions
- **Backdrop**: Semi-transparent overlay, click to close for non-critical modals

## Page Layouts

### Dashboard Layout
Full-width container with metric cards at top, followed by two-column grid (Recent Purchases | Recent Sales), bottom section for stock alerts

### List Pages (Vendors, Customers, Products)
Header with title + "Add New" button, search/filter bar, data table with pagination

### Detail/Edit Pages
Breadcrumb navigation, page title, tabbed interface (Details | History | Documents), form or read-only data display

### Billing Page
Three-column layout: Product selection (left 40%) | Invoice preview (center 40%) | Summary/actions (right 20%)

## Animations
**Minimal Motion**: 
- Table row hover: subtle background transition (150ms)
- Modal enter/exit: fade + slight scale (200ms)
- No scroll-triggered animations
- Loading states: simple spinner, no skeleton screens

## Accessibility
- All form inputs have associated labels (not placeholders)
- Keyboard navigation throughout (Tab order, Enter to submit)
- Focus indicators on all interactive elements
- ARIA labels for icon-only buttons
- Sufficient contrast for all text

## Images
**No hero images** - This is a business management tool. Visual elements limited to:
- Company logo in header (simple icon or wordmark)
- Empty state illustrations (simple line drawings)
- User avatars (initials fallback)