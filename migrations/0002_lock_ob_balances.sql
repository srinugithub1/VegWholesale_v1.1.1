-- Lock Opening Balance (OB-) invoices to prevent them from hitting 0
-- This is a safety measure to ensure the recalculation logic can NEVER zero out these records.
ALTER TABLE invoices ADD CONSTRAINT check_ob_total 
CHECK (NOT (invoice_number LIKE 'OB-%' AND grand_total = 0));
