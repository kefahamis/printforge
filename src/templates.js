// Ready-made designs and blocks. Every field named here exists on the standard ERPNext /
// HRMS doctype it is for; anything site-specific (bank details, a tax authority QR field)
// is left as plain text or a default for the user to point at their own field.
import { uid, mkC, mkI, mkL, mkTbl, mkQR, mkBarcode, PLAIN, ROW, COL, flowText } from './tree.js';

// A "part" is an element followed by everything inside it: [root, ...descendants]
const T = (content, o = {}) => [flowText(content, o)];
const label = (content, o = {}) => T(content, { h: 14, fontSize: 9, color: "#666666", ...o });
const box = (base, parts, o = {}) => {
  const c = { ...mkC(0, 0), ...PLAIN, ...base, w: "100%", h: 20, _flow: true, ...o };
  c.children = parts.map(p => p[0].id);
  return [c, ...parts.flat()];
};
const Row = (parts, o) => box(ROW, parts, o);
const Col = (parts, o) => box(COL, parts, o);
const Line = (o = {}) => [{ ...mkL(0, 0), w: "100%", color: "#111111", thickness: 1, _flow: true, ...o }];
const col = (lbl, field, align, width) => ({ id: uid(), label: lbl, field, align, width });
const Table = (childField, columns, o = {}) => [{ ...mkTbl(0, 0), w: "100%", h: 90, childField, columns, _flow: true, ...o }];
const pair = (l, v, lw, vw, o = {}) => Row([T(l, { w: lw, h: 18, color: "#555555", ...o }), T(v, { w: vw, h: 18, align: "right", ...o })], { h: 18 });

const COMPANY_PIN_EXPR = 'frappe.db.get_value("Company", doc.company, "tax_id")';
const COMPANY_PIN = '{{ ' + COMPANY_PIN_EXPR + ' }}';
// A line given as [text, condition] is printed only when the condition holds, so an empty
// value does not leave its label behind
const cond = (line, o) => Array.isArray(line) ? T(line[0], { ...o, showIf: line[1] }) : T(line, o);

const toTree = (parts, settings, padding = 40) => ({
  pages: [{ id: uid(), name: "Page 1", roots: parts.map(p => p[0].id), padding }],
  nodes: Object.fromEntries(parts.flat().map(n => [n.id, n])),
  ...(settings ? { settings } : {}),
});

// ── Blocks (also offered on their own in the Insert panel) ────────────────────
export const signatureBlock = (names = ["Prepared by", "Authorised signature"]) => Row(
  names.map(n => Col([Line({ color: "#333333" }), label(n, { align: "center", h: 16, padding: "4px 0 0 0" })], { w: Math.floor(600 / names.length), h: 30, gap: 0 })),
  { h: 70, padding: "40px 0 0 0" }
);
export const stampArea = () => {
  const [c, ...rest] = Col([label("Official stamp", { align: "center", color: "#999999" })], { w: 180, h: 90, padding: 8, stroke: "#999999", strokeWidth: 1, style: "dashed", justifyContent: "center" });
  return [{ ...c, _flow: true }, ...rest];
};
export const amountInWords = () => T("Amount in words: {{ doc.in_words }}", { h: 18, fontSize: 10, italic: true });
export const taxesTable = () => Table("taxes", [col("Tax", "description", "left", "50%"), col("Rate", "rate", "right", "15%"), col("Amount", "tax_amount", "right", "35%")], { h: 60, fontSize: 11, footerRows: [{ label: "Total taxes", expr: "doc.total_taxes_and_charges" }] });
export const paymentSchedule = () => Table("payment_schedule", [col("Due date", "due_date", "left", "35%"), col("Portion", "invoice_portion", "right", "25%"), col("Amount", "payment_amount", "right", "40%")], { h: 60, fontSize: 11 });
export const paymentDetails = () => Col([
  T("Payment details", { h: 18, fontSize: 11, fontWeight: "700" }),
  T("Bank: Your Bank, Branch", { h: 16, fontSize: 10, color: "#333333" }),
  T("Account name: {{ doc.company }}", { h: 16, fontSize: 10, color: "#333333" }),
  T("Account no.: 0000000000", { h: 16, fontSize: 10, color: "#333333" }),
  T("M-Pesa Paybill: 000000   Account: {{ doc.name }}", { h: 16, fontSize: 10, color: "#333333" }),
], { w: 340, h: 90, padding: 10, fill: "#f5f5f5", gap: 2 });
export const qrWithCaption = () => Col([
  [{ ...mkQR(0, 0), w: 90, h: 90, _flow: true }],
  label("Scan to verify", { w: 90, align: "center" }),
], { w: 90, h: 108, gap: 2 });
export const itemLabels = () => {
  const [c, ...rest] = Col([
    T("{{ item.item_name }}", { h: 18, fontSize: 12, fontWeight: "700" }),
    T("Qty: {{ item.qty }} {{ item.uom }}", { h: 16, fontSize: 10, color: "#333333" }),
    [{ ...mkBarcode(0, 0), w: 240, h: 56, value: "item.item_code", _flow: true }],
  ], { h: 110, padding: 8, gap: 4, stroke: "#cccccc", strokeWidth: 1, margin: "0 0 8px 0" });
  return [{ ...c, repeatFor: "items" }, ...rest];
};

export const BLOCKS = [
  { label: "Taxes table", icon: "%", create: taxesTable },
  { label: "Payment schedule", icon: "▤", create: paymentSchedule },
  { label: "Bank and M-Pesa details", icon: "⌂", create: paymentDetails },
  { label: "Amount in words", icon: "Aa", create: amountInWords },
  { label: "Signatures", icon: "✎", create: () => signatureBlock() },
  { label: "Stamp area", icon: "▢", create: stampArea },
  { label: "QR code with caption", icon: "▦", create: qrWithCaption },
  { label: "One block per item row", icon: "≡", create: itemLabels },
];

// ── Full documents ────────────────────────────────────────────────────────────
// One A4 layout serves the trading documents: header, party and reference panel, rows,
// totals beside notes, then signatures.
function tradeDocument({ title, accent = "#111111", companyLines = [], partyLabel, partyLines, meta, table, totals = [], left = [], signatures }) {
  const head = Row([
    [{ ...mkI(0, 0), w: 130, h: 60, _flow: true }],
    Col([
      T(title, { h: 30, fontSize: 22, fontWeight: "700", color: accent, align: "right", lineHeight: 1.3 }),
      T("{{ doc.company }}", { h: 18, fontSize: 12, fontWeight: "600", align: "right" }),
      ...companyLines.map(l => cond(l, { h: 14, fontSize: 9, color: "#333333", align: "right", lineHeight: 1.4 })),
    ], { w: 440, h: 70, gap: 1 }),
  ], { h: 84, padding: "0 0 14px 0" });

  const info = Row([
    Col([label(partyLabel), ...partyLines.map((l, i) => cond(l, i === 0 ? { h: 20, fontSize: 13, fontWeight: "600" } : { h: 16, fontSize: 10, color: "#333333" }))], { w: 380, h: 70 }),
    Col(meta.map(([l, v, when]) => { const [r, ...rest] = pair(l, v, 110, 190, { fontSize: 10 }); return [when ? { ...r, showIf: when } : r, ...rest]; }), { w: 300, h: 70, gap: 1 }),
  ], { h: 96, padding: "14px 0" });

  const parts = [head, Line({ color: accent }), info, table];
  if (totals.length || left.length) {
    parts.push(Row([
      Col(left, { w: 380, h: 40, gap: 4 }),
      Col(totals.map(([l, v, bold]) => pair(l, v, 130, 170, bold ? { fontSize: 13, fontWeight: "700", color: "#111111", h: 22 } : { fontSize: 11 })), { w: 300, h: 40, gap: 4 }),
    ], { h: 60, padding: "14px 0 0 0" }));
  }
  if (signatures) parts.push(signatureBlock(signatures));
  return toTree(parts);
}

const itemColumns = [col("No.", "idx", "left", "7%"), col("Description", "item_name", "left", "41%"), col("Qty", "qty", "right", "12%"), col("Rate", "rate", "right", "18%"), col("Amount", "amount", "right", "22%")];
const tradeTotals = [["Subtotal", "{{ doc.net_total }}"], ["Taxes", "{{ doc.total_taxes_and_charges }}"], ["Total", "{{ doc.grand_total }}", true]];
const inWords = T("Amount in words: {{ doc.in_words }}", { h: 18, fontSize: 10, italic: true });

const taxInvoice = () => {
  const tree = tradeDocument({
    title: "TAX INVOICE", accent: "#7f2a7b",
    companyLines: ["{{ doc.company_address_display }}", ["PIN: " + COMPANY_PIN, COMPANY_PIN_EXPR]],
    partyLabel: "Bill to", partyLines: ["{{ doc.customer_name }}", "{{ doc.address_display }}", ["PIN: {{ doc.tax_id }}", "doc.tax_id"]],
    meta: [["Invoice no.", "{{ doc.name }}"], ["Date", "{{ doc.posting_date }}"], ["Due date", "{{ doc.due_date }}"], ["Customer PO", "{{ doc.po_no }}", "doc.po_no"]],
    table: Table("items", itemColumns, { headerBg: "#f3e8f2" }),
    totals: tradeTotals,
    left: [inWords, qrWithCaption()],
  });
  return tree;
};

const quotation = () => tradeDocument({
  title: "QUOTATION", accent: "#1f6feb",
  companyLines: ["{{ doc.company_address_display }}"],
  partyLabel: "Prepared for", partyLines: ["{{ doc.customer_name }}", "{{ doc.address_display }}"],
  meta: [["Quotation no.", "{{ doc.name }}"], ["Date", "{{ doc.transaction_date }}"], ["Valid until", "{{ doc.valid_till }}"]],
  table: Table("items", itemColumns),
  totals: tradeTotals,
  left: [inWords, T("{{ doc.terms }}", { h: 30, fontSize: 9, color: "#444444", showIf: "doc.terms" })],
  signatures: ["Prepared by", "Accepted by (customer)"],
});

const purchaseOrder = () => tradeDocument({
  title: "PURCHASE ORDER", accent: "#0e8a7d",
  companyLines: [["PIN: " + COMPANY_PIN, COMPANY_PIN_EXPR]],
  partyLabel: "Supplier", partyLines: ["{{ doc.supplier_name }}", "{{ doc.address_display }}"],
  meta: [["Order no.", "{{ doc.name }}"], ["Date", "{{ doc.transaction_date }}"], ["Required by", "{{ doc.schedule_date }}"]],
  table: Table("items", itemColumns),
  totals: tradeTotals,
  left: [inWords],
  signatures: ["Prepared by", "Approved by"],
});

const deliveryNote = () => tradeDocument({
  title: "DELIVERY NOTE",
  companyLines: ["{{ doc.company_address_display }}"],
  partyLabel: "Deliver to", partyLines: ["{{ doc.customer_name }}", "{{ doc.shipping_address }}"],
  meta: [["Delivery no.", "{{ doc.name }}"], ["Date", "{{ doc.posting_date }}"], ["Vehicle", "{{ doc.vehicle_no }}", "doc.vehicle_no"], ["Driver", "{{ doc.driver_name }}", "doc.driver_name"]],
  table: Table("items", [col("No.", "idx", "left", "8%"), col("Item code", "item_code", "left", "22%"), col("Description", "item_name", "left", "42%"), col("Qty", "qty", "right", "14%"), col("Unit", "uom", "left", "14%")]),
  left: [[{ ...mkBarcode(0, 0), w: 240, h: 56, _flow: true }]],
  signatures: ["Delivered by", "Received by (name, signature, date)"],
});

const paymentReceipt = () => tradeDocument({
  title: "PAYMENT RECEIPT", accent: "#2f9e5b",
  partyLabel: "Received from", partyLines: ["{{ doc.party_name }}"],
  meta: [["Receipt no.", "{{ doc.name }}"], ["Date", "{{ doc.posting_date }}"], ["Paid by", "{{ doc.mode_of_payment }}", "doc.mode_of_payment"], ["Reference", "{{ doc.reference_no }}", "doc.reference_no"]],
  table: Table("references", [col("Document", "reference_name", "left", "40%"), col("Invoice total", "total_amount", "right", "30%"), col("Paid now", "allocated_amount", "right", "30%")], { h: 60 }),
  totals: [["Amount received", "{{ doc.paid_amount }}", true]],
  left: [T("Amount in words: {{ frappe.utils.money_in_words(doc.paid_amount, doc.paid_from_account_currency) }}", { h: 18, fontSize: 10, italic: true })],
  signatures: ["Received by", "Official stamp"],
});

const payslip = () => {
  const head = Row([
    [{ ...mkI(0, 0), w: 130, h: 60, _flow: true }],
    Col([T("PAYSLIP", { h: 30, fontSize: 22, fontWeight: "700", align: "right", lineHeight: 1.3 }), T("{{ doc.company }}", { h: 18, fontSize: 12, fontWeight: "600", align: "right" }), T("{{ doc.start_date }} to {{ doc.end_date }}", { h: 16, fontSize: 10, color: "#333333", align: "right" })], { w: 440, h: 70, gap: 1 }),
  ], { h: 84, padding: "0 0 14px 0" });
  const who = Row([
    Col([label("Employee"), T("{{ doc.employee_name }}", { h: 20, fontSize: 13, fontWeight: "600" }), T("{{ doc.designation }}", { h: 16, fontSize: 10, color: "#333333" }), T("{{ doc.department }}", { h: 16, fontSize: 10, color: "#333333" })], { w: 380, h: 70 }),
    Col([pair("Payslip no.", "{{ doc.name }}", 110, 190, { fontSize: 10 }), pair("Employee no.", "{{ doc.employee }}", 110, 190, { fontSize: 10 }), pair("Payment days", "{{ doc.payment_days }}", 110, 190, { fontSize: 10 })], { w: 300, h: 60, gap: 1 }),
  ], { h: 96, padding: "14px 0" });
  const money = [col("Component", "salary_component", "left", "60%"), col("Amount", "amount", "right", "40%")];
  const tables = Row([
    Col([Table("earnings", money.map(c => ({ ...c, id: uid() })), { h: 80, fontSize: 11, footerRows: [{ label: "Gross pay", expr: "doc.gross_pay" }] })], { w: 345, h: 90 }),
    Col([Table("deductions", money.map(c => ({ ...c, id: uid(), label: c.field === "amount" ? "Amount" : "Deduction" })), { h: 80, fontSize: 11, footerRows: [{ label: "Total deductions", expr: "doc.total_deduction" }] })], { w: 345, h: 90 }),
  ], { h: 100, alignItems: "flex-start" });
  const net = Row([
    T("Net pay in words: {{ doc.total_in_words }}", { w: 400, h: 18, fontSize: 10, italic: true }),
    Col([pair("Net pay", "{{ doc.net_pay }}", 110, 170, { fontSize: 14, fontWeight: "700", color: "#111111", h: 24 })], { w: 280, h: 24 }),
  ], { h: 50, padding: "16px 0 0 0" });
  return toTree([head, Line(), who, tables, net]);
};

// Small paper: everything stacks in one column
const posReceipt = () => {
  const c = (content, o) => T(content, { h: 14, fontSize: 9, align: "center", ...o });
  return toTree([
    c("{{ doc.company }}", { h: 18, fontSize: 12, fontWeight: "700" }),
    c("PIN: " + COMPANY_PIN, { showIf: COMPANY_PIN_EXPR }),
    c("{{ doc.name }}   {{ doc.posting_date }}", { padding: "4px 0" }),
    Line({ style: "dashed" }),
    Table("items", [col("Item", "item_name", "left", "50%"), col("Qty", "qty", "right", "16%"), col("Amount", "amount", "right", "34%")], { h: 60, fontSize: 9, headerFontSize: 9, headerBg: "transparent", borderColor: "transparent" }),
    Line({ style: "dashed" }),
    pair("Taxes", "{{ doc.total_taxes_and_charges }}", 100, 170, { fontSize: 9 }),
    pair("TOTAL", "{{ doc.grand_total }}", 100, 170, { fontSize: 12, fontWeight: "700", color: "#111111", h: 20 }),
    c("Served by {{ doc.owner }}", { padding: "6px 0 2px 0" }),
    [{ ...mkQR(0, 0), w: 100, h: 100, margin: "4px auto" }],
    c("Thank you"),
  ], { pageSize: "Custom", customW: 80, customH: 200, statusHeading: false }, 12);
};

const itemLabel = () => toTree([
  T("{{ doc.item_name }}", { h: 26, fontSize: 9, fontWeight: "700", lineHeight: 1.2 }),
  [{ ...mkBarcode(0, 0), w: 172, h: 50, value: "doc.item_code" }],
], { pageSize: "Custom", customW: 50, customH: 25, statusHeading: false }, 4);

const deliveryLabels = () => {
  const [c, ...rest] = Col([
    T("{{ doc.customer_name }}", { h: 18, fontSize: 11, color: "#333333" }),
    T("{{ item.item_name }}", { h: 22, fontSize: 14, fontWeight: "700" }),
    T("Qty: {{ item.qty }} {{ item.uom }}   ·   {{ doc.name }}", { h: 16, fontSize: 10, color: "#333333" }),
    [{ ...mkBarcode(0, 0), w: 300, h: 60, value: "item.item_code", _flow: true }],
  ], { h: 150, gap: 4 });
  return toTree([[{ ...c, repeatFor: "items", breakAfter: true }, ...rest]], { pageSize: "Custom", customW: 100, customH: 50, statusHeading: false }, 8);
};

export const DOC_TEMPLATES = [
  { id: "tax-invoice", label: "Tax invoice", doctype: "Sales Invoice", note: "A4, tax PINs, taxes and a QR code", build: taxInvoice },
  { id: "quotation", label: "Quotation", doctype: "Quotation", note: "A4 with validity and acceptance", build: quotation },
  { id: "purchase-order", label: "Purchase order", doctype: "Purchase Order", note: "A4 with approval signatures", build: purchaseOrder },
  { id: "delivery-note", label: "Delivery note", doctype: "Delivery Note", note: "A4 with barcode and receiving signature", build: deliveryNote },
  { id: "payment-receipt", label: "Payment receipt", doctype: "Payment Entry", note: "A4 receipt for money received", build: paymentReceipt },
  { id: "payslip", label: "Payslip", doctype: "Salary Slip", note: "A4, earnings beside deductions", build: payslip },
  { id: "pos-receipt", label: "Till receipt", doctype: "Sales Invoice", note: "80 mm receipt roll", build: posReceipt },
  { id: "item-label", label: "Item label", doctype: "Item", note: "50 x 25 mm sticker with barcode", build: itemLabel },
  { id: "delivery-labels", label: "Carton labels", doctype: "Delivery Note", note: "100 x 50 mm, one label per item", build: deliveryLabels },
];

// The fields a design refers to, for the field list when no site is there to ask
export function fieldsFromTree(tree) {
  const seen = new Map();
  const add = (name, extra = {}) => { if (!seen.has(name)) seen.set(name, { name, label: name.replace(/_/g, " ").replace(/^./, c => c.toUpperCase()), ...extra }); };
  add("name", { label: "ID" });
  for (const n of Object.values(tree.nodes || {})) {
    for (const text of [n.content, n.value, n.showIf, n.jinjaExpr]) {
      for (const m of String(text || "").matchAll(/\bdoc\.([A-Za-z_]\w*)/g)) if (!["meta", "get_formatted", "docstatus"].includes(m[1])) add(m[1]);
    }
    if (n.type === "table" && n.childField) add(n.childField, { isChild: true, columns: (n.columns || []).map(c => ({ name: c.field, label: c.label })) });
    if (n.repeatFor) add(n.repeatFor, { isChild: true });
  }
  return [...seen.values()];
}
