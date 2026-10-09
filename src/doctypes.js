

export const PRESET_DOCTYPES = {
  "Selling": [
    { label: "Sales Order", fields: [{ name: "name", label: "Order #" }, { name: "customer", label: "Customer" }, { name: "transaction_date", label: "Date" }, { name: "delivery_date", label: "Delivery" }, { name: "grand_total", label: "Total" }, { name: "items", isChild: true }] },
    { label: "Sales Invoice", fields: [{ name: "name", label: "Invoice #" }, { name: "customer", label: "Customer" }, { name: "posting_date", label: "Date" }, { name: "due_date", label: "Due" }, { name: "grand_total", label: "Total" }, { name: "items", isChild: true }, { name: "taxes", isChild: true }] },
    { label: "Quotation", fields: [{ name: "name", label: "Quo #" }, { name: "party_name", label: "Customer" }, { name: "transaction_date", label: "Date" }, { name: "valid_till", label: "Valid Until" }, { name: "grand_total", label: "Total" }, { name: "items", isChild: true }] },
    { label: "Delivery Note", fields: [{ name: "name", label: "DN #" }, { name: "customer", label: "Customer" }, { name: "posting_date", label: "Date" }, { name: "items", isChild: true }] },
    { label: "Sales Return", fields: [{ name: "name", label: "Return #" }, { name: "customer", label: "Customer" }, { name: "posting_date", label: "Date" }, { name: "grand_total", label: "Total" }, { name: "items", isChild: true }] }
  ],
  "Buying": [
    { label: "Purchase Order", fields: [{ name: "name", label: "PO #" }, { name: "supplier", label: "Supplier" }, { name: "transaction_date", label: "Date" }, { name: "grand_total", label: "Total" }, { name: "items", isChild: true }] },
    { label: "Purchase Invoice", fields: [{ name: "name", label: "PI #" }, { name: "supplier", label: "Supplier" }, { name: "posting_date", label: "Date" }, { name: "bill_no", label: "Bill #" }, { name: "grand_total", label: "Total" }, { name: "items", isChild: true }] },
    { label: "Purchase Receipt", fields: [{ name: "name", label: "Receipt #" }, { name: "supplier", label: "Supplier" }, { name: "posting_date", label: "Date" }, { name: "items", isChild: true }] },
    { label: "Supplier Quotation", fields: [{ name: "name", label: "Sup Quo #" }, { name: "supplier", label: "Supplier" }, { name: "transaction_date", label: "Date" }, { name: "items", isChild: true }] },
    { label: "Request for Quotation", fields: [{ name: "name", label: "RFQ #" }, { name: "transaction_date", label: "Date" }, { name: "items", isChild: true }] }
  ],
  "Accounting": [
    { label: "Payment Entry", fields: [{ name: "name", label: "ID" }, { name: "party", label: "Party" }, { name: "posting_date", label: "Date" }, { name: "paid_amount", label: "Amount" }, { name: "references", isChild: true }] },
    { label: "Journal Entry", fields: [{ name: "name", label: "ID" }, { name: "posting_date", label: "Date" }, { name: "user_remark", label: "Remark" }, { name: "accounts", isChild: true }] },
    { label: "Bank Reconciliation", fields: [{ name: "bank_account", label: "Account" }, { name: "from_date", label: "From" }, { name: "to_date", label: "To" }] },
    { label: "Tax Withholding Certificate", fields: [{ name: "name", label: "ID" }, { name: "tax_withholding_category", label: "Category" }, { name: "certificate_date", label: "Date" }] }
  ],
  "HR & Payroll": [
    { label: "Salary Slip", fields: [{ name: "name", label: "ID" }, { name: "employee_name", label: "Employee" }, { name: "posting_date", label: "Date" }, { name: "net_pay", label: "Net Pay" }, { name: "earnings", isChild: true }, { name: "deductions", isChild: true }] },
    { label: "Offer Letter", fields: [{ name: "name", label: "ID" }, { name: "applicant_name", label: "Applicant" }, { name: "offer_date", label: "Date" }, { name: "designation", label: "Post" }] },
    { label: "Appraisal", fields: [{ name: "name", label: "ID" }, { name: "employee_name", label: "Employee" }, { name: "start_date", label: "Start" }, { name: "end_date", label: "End" }] },
    { label: "Leave Application", fields: [{ name: "name", label: "ID" }, { name: "employee", label: "Employee" }, { name: "leave_type", label: "Type" }, { name: "from_date", label: "From" }, { name: "to_date", label: "To" }] },
    { label: "Employee Contract", fields: [{ name: "name", label: "ID" }, { name: "employee", label: "Employee" }, { name: "contract_start_date", label: "Start" }, { name: "contract_end_date", label: "End" }] }
  ],
  "Stock": [
    { label: "Stock Entry", fields: [{ name: "name", label: "ID" }, { name: "stock_entry_type", label: "Type" }, { name: "posting_date", label: "Date" }, { name: "items", isChild: true }] },
    { label: "Material Request", fields: [{ name: "name", label: "ID" }, { name: "material_request_type", label: "Type" }, { name: "transaction_date", label: "Date" }, { name: "items", isChild: true }] },
    { label: "Packing Slip", fields: [{ name: "name", label: "ID" }, { name: "delivery_note", label: "DN #" }, { name: "items", isChild: true }] },
    { label: "Quality Inspection", fields: [{ name: "name", label: "ID" }, { name: "report_date", label: "Date" }, { name: "inspected_by", label: "Inspector" }, { name: "readings", isChild: true }] }
  ],
  "Manufacturing": [
    { label: "Work Order", fields: [{ name: "name", label: "ID" }, { name: "production_item", label: "Item" }, { name: "qty", label: "Qty" }, { name: "planned_start_date", label: "Start" }, { name: "operations", isChild: true }] },
    { label: "BOM", fields: [{ name: "name", label: "ID" }, { name: "item", label: "Root Item" }, { name: "quantity", label: "Qty" }, { name: "items", isChild: true }] },
    { label: "Job Card", fields: [{ name: "name", label: "ID" }, { name: "work_order", label: "WO #" }, { name: "operation", label: "Op" }, { name: "time_logs", isChild: true }] }
  ],
  "Projects": [
    { label: "Timesheet", fields: [{ name: "employee", label: "Employee" }, { name: "total_hours", label: "Hours" }, { name: "time_logs", isChild: true }] },
    { label: "Expense Claim", fields: [{ name: "employee", label: "Employee" }, { name: "posting_date", label: "Date" }, { name: "total_claimed_amount", label: "Amount" }, { name: "expenses", isChild: true }] }
  ],
  "CRM": [
    { label: "Lead", fields: [{ name: "name", label: "ID" }, { name: "lead_name", label: "Name" }, { name: "email_id", label: "Email" }, { name: "mobile_no", label: "Mobile" }] },
    { label: "Opportunity", fields: [{ name: "name", label: "ID" }, { name: "party_name", label: "Lead/Customer" }, { name: "transaction_date", label: "Date" }] },
    { label: "Prospect", fields: [{ name: "name", label: "ID" }, { name: "company_name", label: "Company" }] }
  ]
};
