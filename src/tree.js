import { getSettings, pageDims } from './exporter.js';

export const SNAP = 4;
export const snap = v => Math.round(v / SNAP) * SNAP;
export const uid = () => "_" + Math.random().toString(36).slice(2, 9);
export const DCS = ["#1f6feb", "#0e8a7d", "#a86b00", "#c2410c", "#6b5bd2"];
export const dc = d => DCS[d % DCS.length];

// ── Tree ops ──────────────────────────────────────────────────────────────────
export const treeUpd = (tree, id, ch) => ({ ...tree, nodes: { ...tree.nodes, [id]: { ...tree.nodes[id], ...ch } } });

export const treeAdd = (tree, node, parentId, pageIdx = 0) => {
  const nodes = { ...tree.nodes, [node.id]: node };
  if (!parentId) {
    const pages = [...tree.pages];
    pages[pageIdx] = { ...pages[pageIdx], roots: [...pages[pageIdx].roots, node.id] };
    return { ...tree, nodes, pages };
  }
  const p = nodes[parentId];
  return { ...tree, nodes: { ...nodes, [parentId]: { ...p, children: [...(p.children || []), node.id] } } };
};

export const collectIds = (nodes, id, depth = 0) => {
  if (depth > 40) return [id];
  const n = nodes[id]; if (!n) return [id];
  return [id, ...(n.children || []).flatMap(c => collectIds(nodes, c, depth + 1))];
};

export const treeRemove = (tree, id) => {
  const del = new Set(collectIds(tree.nodes, id));
  const nodes = Object.fromEntries(
    Object.entries(tree.nodes).filter(([k]) => !del.has(k))
      .map(([k, v]) => [k, { ...v, children: (v.children || []).filter(c => !del.has(c)) }])
  );
  const pages = tree.pages.map(p => ({ ...p, roots: p.roots.filter(r => !del.has(r)) }));
  return { ...tree, nodes, pages };
};

export const migrateTree = (t) => {
  if (!t) return buildTree();
  const nodes = { ...(t.nodes || {}) };
  // Merge with factory defaults to handle partial JSON imports
  for (const id in nodes) {
    const factory = FACS[nodes[id].type];
    if (factory) {
      nodes[id] = { ...factory(nodes[id].x || 0, nodes[id].y || 0), ...nodes[id], id };
    }
  }
  let pages = t.pages || [];
  if (pages.length === 0 && t.roots) {
    pages = [{ id: uid(), name: "Page 1", roots: t.roots }];
  }
  pages = pages.map(p => ({ ...p, padding: p.padding ?? 40 }));
  return { nodes, pages, settings: getSettings(t) };
};

export const rmFromParent = (tree, id) => {
  const pages = tree.pages.map(p => ({ ...p, roots: p.roots.filter(r => r !== id) }));
  const nodes = Object.fromEntries(Object.entries(tree.nodes).map(([k, v]) => [k, { ...v, children: (v.children || []).filter(c => c !== id) }]));
  return { ...tree, pages, nodes };
};

export const treeMove = (tree, id, newPid) => treeAdd(rmFromParent(tree, id), tree.nodes[id], newPid);

export const findParent = (tree, id) => {
  if (!tree?.pages || !tree?.nodes) return null;
  if ((tree.pages || []).some(p => (p.roots || []).includes(id))) return null;
  for (const [pid, n] of Object.entries(tree.nodes)) {
    if ((n.children || []).includes(id)) return pid;
  }
  return null;
};

export const isDesc = (nodes, ancId, descId, depth = 0) => {
  if (!descId || depth > 40) return false;
  const n = nodes[ancId]; if (!n) return false;
  return (n.children || []).some(c => c === descId || isDesc(nodes, c, descId, depth + 1));
};

export const cloneTree = (nodes, id) => {
  const n = nodes[id]; const nid = uid();
  let res = {};
  const kids = [];
  for (const c of (n.children || [])) {
    const [cid, sub] = cloneTree(nodes, c);
    kids.push(cid); Object.assign(res, sub);
  }
  res[nid] = { ...n, id: nid, children: kids, x: (n.x || 0) + 16, y: (n.y || 0) + 16 };
  return [nid, res];
};

// ── Several elements at once ──────────────────────────────────────────────────
// Of the given elements, those not already inside another one of them
export const topLevel = (tree, ids) => ids.filter(id => tree.nodes[id] && !ids.some(o => o !== id && isDesc(tree.nodes, o, id)));

// A self-contained copy of the elements and everything inside them, for the clipboard
export const copyNodes = (tree, ids) => {
  const roots = topLevel(tree, ids);
  const nodes = {};
  for (const id of roots) for (const k of collectIds(tree.nodes, id)) if (tree.nodes[k]) nodes[k] = tree.nodes[k];
  return { pf: "clip", roots, nodes };
};

// Adds a clipboard copy under a parent (or on the page) with fresh ids. Returns [tree, new ids].
export const pasteNodes = (tree, clip, parentId, pageIdx = 0) => {
  if (!clip || clip.pf !== "clip" || !clip.nodes) return [tree, []];
  let next = tree;
  const added = [];
  for (const rid of clip.roots || []) {
    if (!clip.nodes[rid]) continue;
    const [nid, sub] = cloneTree(clip.nodes, rid);
    const flow = !parentId || next.nodes[parentId]?.mode !== "free";
    next = treeAdd({ ...next, nodes: { ...next.nodes, ...sub } }, { ...sub[nid], _flow: flow }, parentId, pageIdx);
    added.push(nid);
  }
  return [next, added];
};

// Only elements placed freely (by x and y) can be lined up; the rest follow their container's layout
export const isFree = (tree, id) => {
  const pid = findParent(tree, id);
  return !!pid && tree.nodes[pid]?.mode === "free" && tree.nodes[pid]?.type === "container";
};
const num = v => typeof v === "number" ? v : 0;
const boxH = el => el.type === "line" ? (el.thickness || 1) : num(el.h);

// how: left | hcenter | right | top | vcenter | bottom
export const alignNodes = (tree, ids, how) => {
  const els = ids.map(id => tree.nodes[id]).filter(Boolean);
  if (els.length < 2) return tree;
  const l = Math.min(...els.map(e => num(e.x))), r = Math.max(...els.map(e => num(e.x) + num(e.w)));
  const t = Math.min(...els.map(e => num(e.y))), b = Math.max(...els.map(e => num(e.y) + boxH(e)));
  const nodes = { ...tree.nodes };
  for (const e of els) {
    const ch = how === "left" ? { x: l } : how === "right" ? { x: r - num(e.w) } : how === "hcenter" ? { x: Math.round((l + r - num(e.w)) / 2) }
      : how === "top" ? { y: t } : how === "bottom" ? { y: b - boxH(e) } : { y: Math.round((t + b - boxH(e)) / 2) };
    nodes[e.id] = { ...e, ...ch };
  }
  return { ...tree, nodes };
};

// Equal gaps between the elements along one axis ("h" or "v"), keeping the outer two in place
export const distributeNodes = (tree, ids, axis) => {
  const pos = axis === "h" ? "x" : "y", size = e => axis === "h" ? num(e.w) : boxH(e);
  const els = ids.map(id => tree.nodes[id]).filter(Boolean).sort((a, b) => num(a[pos]) - num(b[pos]));
  if (els.length < 3) return tree;
  const first = els[0], last = els[els.length - 1];
  const free = (num(last[pos]) + size(last)) - num(first[pos]) - els.reduce((a, e) => a + size(e), 0);
  const gap = free / (els.length - 1);
  const nodes = { ...tree.nodes };
  let at = num(first[pos]);
  for (const e of els) { nodes[e.id] = { ...e, [pos]: Math.round(at) }; at += size(e) + gap; }
  return { ...tree, nodes };
};

export const getDepth = (tree, id) => {
  let d = 0, cur = findParent(tree, id);
  const seen = new Set([id]);
  while (cur && !seen.has(cur)) {
    seen.add(cur); d++; cur = findParent(tree, cur);
    if (d > 50) break;
  }
  return d;
};

export const getGlobalBox = (tree, id) => {
  const el = tree.nodes[id];
  if (!el) return { x: 0, y: 0, w: 0, h: 0 };
  let x = el.x || 0, y = el.y || 0;
  let cur = findParent(tree, id);
  while (cur) {
    const p = tree.nodes[cur];
    if (p) { x += (p.x || 0); y += (p.y || 0); }
    cur = findParent(tree, cur);
  }
  return { x, y, w: el.w || 0, h: el.h || 0 };
};

export const calcGuides = (tree, targetId, box, activePageIdx) => {
  const threshold = 5;
  const guides = { h: [], v: [] };
  const page = tree.pages[activePageIdx];
  if (!page) return guides;

  const parentId = findParent(tree, targetId);
  const pBox = parentId ? getGlobalBox(tree, parentId) : { x: 0, y: 0 };

  // Global proposed box
  const tx = box.x + pBox.x, ty = box.y + pBox.y, tw = box.w, th = box.h;
  const tcx = tx + tw / 2, tcy = ty + th / 2, tr = tx + tw, tb = ty + th;

  const others = [];
  const collect = (ids) => {
    for (const id of (ids || [])) {
      if (id === targetId) continue;
      const gBox = getGlobalBox(tree, id);
      if (gBox) {
        others.push({ id, ...gBox });
        const el = tree.nodes[id];
        if (el?.children) collect(el.children);
      }
    }
  };
  collect(page.roots);
  const pg = pageDims(tree);
  others.push({ id: 'page', x: 0, y: 0, w: pg.w, h: pg.h });
  others.push({ id: 'page-center', x: pg.w / 2, y: pg.h / 2, w: 0, h: 0 });

  for (const o of others) {
    const ox = o.x, oy = o.y, ow = o.w, oh = o.h;
    const ocx = ox + ow / 2, ocy = oy + oh / 2, or = ox + ow, ob = oy + oh;

    const hPoints = [
      { t: ty, o: oy }, { t: ty, o: ob }, { t: ty, o: ocy },
      { t: tb, o: oy }, { t: tb, o: ob }, { t: tb, o: ocy },
      { t: tcy, o: oy }, { t: tcy, o: ob }, { t: tcy, o: ocy }
    ];
    for (const p of hPoints) {
      if (Math.abs(p.t - p.o) < threshold) guides.h.push(p.o);
    }

    const vPoints = [
      { t: tx, o: ox }, { t: tx, o: or }, { t: tx, o: ocx },
      { t: tr, o: ox }, { t: tr, o: or }, { t: tr, o: ocx },
      { t: tcx, o: ox }, { t: tcx, o: or }, { t: tcx, o: ocx }
    ];
    for (const p of vPoints) {
      if (Math.abs(p.t - p.o) < threshold) guides.v.push(p.o);
    }
  }

  return {
    h: [...new Set(guides.h.map(v => Math.round(v)))],
    v: [...new Set(guides.v.map(v => Math.round(v)))]
  };
};

// ── Preview Data ──────────────────────────────────────────────────────────────
export const SAMPLE_DATA = {
  // Values are written the way Frappe's formatter prints them
  name: "ACC-SINV-2026-00001", customer_name: "Tagrit", posting_date: "22-02-2026", due_date: "24-03-2026",
  grand_total: "KES 12,500.00", net_total: "KES 10,775.86", tax_amount: "KES 1,724.14", currency: "KES",
  company: "EXAMPLE COMPANY LTD", company_address_display: "123 Example Road<br>Nairobi",
  in_words: "KES Twelve Thousand Five Hundred only.", total_taxes_and_charges: "KES 1,724.14", total: "KES 10,775.86",
  supplier_name: "Example Supplier Ltd", transaction_date: "22-02-2026", valid_till: "24-03-2026", schedule_date: "01-03-2026",
  party_name: "Tagrit", paid_amount: "KES 12,500.00", mode_of_payment: "M-Pesa", reference_no: "SLK4H7XQ2P", reference_date: "22-02-2026",
  employee_name: "Amina Otieno", designation: "Accountant", department: "Finance", start_date: "01-02-2026", end_date: "28-02-2026",
  gross_pay: "KES 85,000.00", total_deduction: "KES 21,450.00", net_pay: "KES 63,550.00", owner: "Administrator", po_no: "PO-0042",
  address_display: "P.O. Box 00000-00100<br>Nairobi",
  items: [
    { idx: 1, item_name: "Hydro Filter (Small)", qty: 2, rate: "KES 4,500.00", amount: "KES 9,000.00" },
    { idx: 2, item_name: "Connector Valve v2", qty: 5, rate: "KES 700.00", amount: "KES 3,500.00" }
  ]
};

export const subst = (txt, data = SAMPLE_DATA) => {
  if (!txt) return "";
  return txt.replace(/\{\{\s*doc\.(\w+).*?\}\}/g, (m, k) => data[k] ?? m)
    .replace(/\{\{\s*item\.(\w+).*?\}\}/g, (m, k) => data[k] ?? m);
};

// ── Factories ─────────────────────────────────────────────────────────────────
// The logo lives on the Company record, not on the document being printed
export const COMPANY_LOGO_EXPR = '{{ frappe.db.get_value("Company", doc.company, "company_logo") }}';
export const mkT = (x = 80, y = 80) => ({ id: uid(), type: "text", children: [], x, y, w: 240, h: 32, content: "{{ doc.field_name }}", fontSize: 13, fontWeight: "400", color: "#111111", align: "left", italic: false, lineHeight: 1.5, bg: "transparent", padding: 4, borderRadius: 0, isRich: false });
export const mkC = (x = 40, y = 80) => ({ id: uid(), type: "container", children: [], x, y, w: 714, h: 120, fill: "transparent", stroke: "#d4d4d4", strokeWidth: 1, borderRadius: 0, opacity: 1, padding: 12, mode: "flow", layout: "flex", flexDir: "row", flexWrap: "wrap", justifyContent: "flex-start", alignItems: "stretch", gap: 12, gridCols: "1fr 1fr", gridRows: "auto", colGap: 12, rowGap: 12 });
export const mkI = (x = 80, y = 80) => ({ id: uid(), type: "image", children: [], x, y, w: 160, h: 80, logoType: "company", jinjaExpr: COMPANY_LOGO_EXPR, customUrl: "", label: "Logo", objectFit: "contain", fallbackBg: "#f2f2f2" });
export const mkR = (x = 80, y = 80) => ({ id: uid(), type: "rect", children: [], x, y, w: 200, h: 80, fill: "#d9d9d9", stroke: "transparent", strokeWidth: 0, borderRadius: 0, opacity: 1, mode: "absolute", layout: "flex", flexDir: "column", justifyContent: "center", alignItems: "center", gap: 10, padding: 10 });
export const mkL = (x = 40, y = 80) => ({ id: uid(), type: "line", children: [], x, y, w: 714, h: 1, color: "#cccccc", thickness: 1, style: "solid" });
export const mkCircle = (x = 80, y = 80) => ({ id: uid(), type: "circle", children: [], x, y, w: 100, h: 100, fill: "#d9d9d9", stroke: "transparent", strokeWidth: 0, opacity: 1, mode: "absolute", layout: "flex", flexDir: "column", justifyContent: "center", alignItems: "center", gap: 10, padding: 10 });
export const mkTriangle = (x = 80, y = 80) => ({ id: uid(), type: "triangle", children: [], x, y, w: 100, h: 100, fill: "#d9d9d9", stroke: "transparent", strokeWidth: 0, opacity: 1, mode: "absolute", layout: "flex", flexDir: "column", justifyContent: "center", alignItems: "center", gap: 10, padding: 10 });
export const mkPath = (x = 80, y = 80, points = []) => ({ id: uid(), type: "path", children: [], x, y, w: 100, h: 100, points, fill: "transparent", stroke: "#111111", strokeWidth: 2, opacity: 1 });
export const mkTbl = (x = 40, y = 80) => ({ id: uid(), type: "table", children: [], x, y, w: 714, h: 200, childField: "items", columns: [{ id: uid(), label: "Description", field: "item_name", align: "left", width: "40%" }, { id: uid(), label: "Qty", field: "qty", align: "center", width: "12%" }, { id: uid(), label: "Rate", field: "rate", align: "right", width: "22%" }, { id: uid(), label: "Amount", field: "amount", align: "right", width: "26%" }], headerBg: "#f2f2f2", headerColor: "#111111", headerFontSize: 11, rowBg: "#ffffff", rowAltBg: "#ffffff", rowColor: "#222222", borderColor: "#cccccc", fontSize: 12, footerRows: [] });
// Both are drawn by the site when printing; `value` is a template expression unless `source` is "text"
export const mkQR = (x = 80, y = 80) => ({ id: uid(), type: "qr", children: [], x, y, w: 96, h: 96, source: "expr", value: "doc.name" });
export const mkBarcode = (x = 80, y = 80) => ({ id: uid(), type: "barcode", children: [], x, y, w: 220, h: 64, source: "expr", value: "doc.name", symbology: "code128", showText: true });
export const FACS = { text: mkT, container: mkC, image: mkI, rect: mkR, line: mkL, circle: mkCircle, triangle: mkTriangle, table: mkTbl, path: mkPath, qr: mkQR, barcode: mkBarcode };

// ── Initial data ──────────────────────────────────────────────────────────────
// Nested boxes must not inherit mkC's 714x120 default size, and widths in a row
// leave 2px for the editor's dashed container outline.
export const PLAIN = { fill: "transparent", stroke: "transparent", strokeWidth: 0, borderRadius: 0, padding: 0 };
export const ROW = { ...PLAIN, layout: "flex", flexDir: "row", flexWrap: "nowrap", justifyContent: "space-between", alignItems: "flex-start", gap: 0 };
export const COL = { ...PLAIN, layout: "flex", flexDir: "column", flexWrap: "nowrap", gap: 2 };
export const flowText = (content, o = {}) => ({ ...mkT(0, 0), content, w: "100%", h: 16, fontSize: 11, color: "#111111", padding: 0, _flow: true, ...o });
export const treeOf = (roots, all, settings) => ({ pages: [{ id: uid(), name: "Page 1", roots: roots.map(n => n.id), padding: 40 }], nodes: Object.fromEntries(all.map(n => [n.id, n])), ...(settings ? { settings } : {}) });

export function buildTree() {
  // Nested boxes must not inherit mkC's 714x120 default size, and widths in a row
  // leave 2px for the editor's dashed container outline.
  const plain = { fill: "transparent", stroke: "transparent", strokeWidth: 0, borderRadius: 0, padding: 0 };
  const row = { ...plain, layout: "flex", flexDir: "row", flexWrap: "nowrap", justifyContent: "space-between", alignItems: "flex-start", gap: 0 };
  const col = { ...plain, layout: "flex", flexDir: "column", flexWrap: "nowrap", gap: 2 };
  const txt = (content, o = {}) => ({ ...mkT(0, 0), content, w: "100%", h: 16, fontSize: 11, color: "#111111", padding: 0, _flow: true, ...o });
  const label = (content, o = {}) => txt(content, { h: 14, fontSize: 9, color: "#666666", ...o });

  const hdr = { ...mkC(0, 0), ...row, w: "100%", h: 76, padding: "0 0 20px 0" };
  const logo = { ...mkI(0, 0), w: 130, h: 56, _flow: true };
  const co = txt("{{ doc.company }}<br>{{ doc.company_address_display }}", { w: 330, h: 34, color: "#333333", padding: "0 0 0 16px" });
  const inv = txt("INVOICE<br>{{ doc.name }}", { w: 252, h: 48, fontSize: 18, fontWeight: "700", align: "right", lineHeight: 1.3 });
  hdr.children = [logo.id, co.id, inv.id];
  const div1 = { ...mkL(0, 0), color: "#111111", thickness: 1, w: "100%" };

  const brow = { ...mkC(0, 0), ...plain, w: "100%", h: 100, layout: "grid", gridCols: "1fr 1fr", colGap: 0, rowGap: 0, padding: "16px 0" };
  const bbl = { ...mkC(0, 0), ...col, w: "100%", h: 68, _flow: true };
  const blbl = label("Bill to");
  const bnm = txt("{{ doc.customer_name }}", { h: 20, fontSize: 13, fontWeight: "600" });
  const bad = txt("{{ doc.address_display }}", { h: 30, color: "#333333" });
  bbl.children = [blbl.id, bnm.id, bad.id];
  const dbl = { ...mkC(0, 0), ...col, w: "100%", h: 68, _flow: true };
  const dlbl = label("Invoice date", { align: "right" });
  const dval = txt("{{ doc.posting_date }}", { h: 18, fontSize: 12, align: "right" });
  const dulbl = label("Due date", { align: "right" });
  const duval = txt("{{ doc.due_date }}", { h: 18, fontSize: 12, align: "right" });
  dbl.children = [dlbl.id, dval.id, dulbl.id, duval.id];
  brow.children = [bbl.id, dbl.id];

  const tbl = { ...mkTbl(0, 0), w: "100%", h: 110 };

  const foot = { ...mkC(0, 0), ...row, w: "100%", h: 64, padding: "16px 0 0 0" };
  const note = txt("Payment due by {{ doc.due_date }}.", { w: 372, h: 18, fontSize: 10, color: "#555555" });
  const smry = { ...mkC(0, 0), ...col, w: 340, h: 44, gap: 6, _flow: true };
  const sr = { ...mkC(0, 0), ...row, w: "100%", h: 18, _flow: true };
  const sl = txt("Subtotal", { w: 70, h: 18, color: "#555555" });
  const sv = txt("{{ doc.net_total }}", { w: 268, h: 18, align: "right" });
  sr.children = [sl.id, sv.id];
  const tr = { ...mkC(0, 0), ...row, w: "100%", h: 20, _flow: true };
  const tl2 = txt("Total", { w: 70, h: 20, fontSize: 13, fontWeight: "700" });
  const tv = txt("{{ doc.grand_total }}", { w: 268, h: 20, fontSize: 13, fontWeight: "700", align: "right" });
  tr.children = [tl2.id, tv.id];
  smry.children = [sr.id, tr.id];
  foot.children = [note.id, smry.id];

  const all = [hdr, logo, co, inv, div1, brow, bbl, blbl, bnm, bad, dbl, dlbl, dval, dulbl, duval, tbl, foot, note, smry, sr, sl, sv, tr, tl2, tv];
  const nodes = Object.fromEntries(all.map(n => [n.id, n]));
  const roots = [hdr.id, div1.id, brow.id, tbl.id, foot.id];
  return { pages: [{ id: uid(), name: "Page 1", roots }], nodes };
}

// Starting point for a report format: the report title over a table of its columns.
// Report formats are filled in the browser, with `title`, `filters`, `columns` and `data` in scope.
export function buildReportTree(fields) {
  const title = { ...mkT(0, 0), content: "{{ title }}", w: "100%", h: 28, fontSize: 18, fontWeight: "700", color: "#111111", padding: "0 0 12px 0" };
  const cols = (fields || []).filter(f => !f.isChild).slice(0, 6);
  const numeric = f => ["Currency", "Float", "Int", "Percent"].includes(f.fieldtype);
  const tbl = {
    ...mkTbl(0, 0), w: "100%", h: 110,
    columns: cols.length
      ? cols.map(f => ({ id: uid(), label: f.label || f.name, field: f.name, align: numeric(f) ? "right" : "left", width: Math.floor(100 / cols.length) + "%" }))
      : [{ id: uid(), label: "Column", field: "fieldname", align: "left", width: "100%" }]
  };
  return { pages: [{ id: uid(), name: "Page 1", roots: [title.id, tbl.id], padding: 40 }], nodes: { [title.id]: title, [tbl.id]: tbl }, settings: { printFor: "Report" } };
}

// A second starting point: a coloured invoice with a boxed reference panel.
export function buildSampleInvoiceTree() {
  const blue = "#3bc7f4";
  const hdr = { ...mkC(0, 0), ...ROW, w: "100%", h: 110, padding: "0 0 16px 0" };
  const logo = { ...mkI(0, 0), w: 120, h: 70, _flow: true };
  const side = { ...mkC(0, 0), ...COL, w: 360, h: 94, alignItems: "flex-end", _flow: true };
  const title = flowText("INVOICE", { h: 34, fontSize: 26, fontWeight: "700", color: blue, align: "right", lineHeight: 1.3 });
  const company = flowText("{{ doc.company }}", { h: 22, fontSize: 15, fontWeight: "700", align: "right" });
  const address = flowText("{{ doc.company_address_display }}", { h: 34, fontSize: 9, color: "#333333", align: "right", lineHeight: 1.4 });
  side.children = [title.id, company.id, address.id];
  hdr.children = [logo.id, side.id];

  const info = { ...mkC(0, 0), ...ROW, w: "100%", h: 96, padding: "0 0 16px 0" };
  const billTo = { ...mkC(0, 0), ...COL, w: 400, h: 80, gap: 0, _flow: true };
  const billHead = flowText("BILL TO", { h: 22, fontSize: 10, fontWeight: "700", color: "#ffffff", bg: blue, padding: "4px 10px" });
  const billName = flowText("{{ doc.customer_name }}", { h: 30, fontSize: 15, fontWeight: "700", padding: "8px 10px 0 10px" });
  const billAddr = flowText("{{ doc.address_display }}", { h: 28, fontSize: 10, color: "#333333", padding: "2px 10px 0 10px" });
  billTo.children = [billHead.id, billName.id, billAddr.id];

  const meta = { ...mkC(0, 0), ...COL, w: 280, h: 72, gap: 0, stroke: blue, strokeWidth: 1, _flow: true };
  const metaRow = (label, value) => {
    const r = { ...mkC(0, 0), ...ROW, w: "100%", h: 24, _flow: true };
    const l = flowText(label, { w: 108, h: 24, fontSize: 10, fontWeight: "700", color: "#ffffff", bg: blue, padding: "5px 8px" });
    const v = flowText(value, { w: 170, h: 24, fontSize: 10, color: "#333333", align: "right", padding: "5px 8px" });
    r.children = [l.id, v.id];
    return [r, l, v];
  };
  const rows = [metaRow("Date", "{{ doc.posting_date }}"), metaRow("Invoice no.", "{{ doc.name }}"), metaRow("Due date", "{{ doc.due_date }}")];
  meta.children = rows.map(r => r[0].id);
  info.children = [billTo.id, meta.id];

  const tbl = {
    ...mkTbl(0, 0), w: "100%", h: 140, headerBg: blue, headerColor: "#000000", headerFontSize: 10, borderColor: blue, columns: [
      { id: uid(), label: "No.", field: "idx", align: "left", width: "8%" },
      { id: uid(), label: "Item description", field: "item_name", align: "left", width: "42%" },
      { id: uid(), label: "Qty", field: "qty", align: "right", width: "12%" },
      { id: uid(), label: "Rate", field: "rate", align: "right", width: "18%" },
      { id: uid(), label: "Amount", field: "amount", align: "right", width: "20%" }
    ],
    footerRows: [{ label: "Total", expr: "doc.grand_total" }]
  };

  const words = flowText("In words: {{ doc.in_words }}", { h: 30, fontSize: 10, italic: true, align: "right", padding: "12px 0 0 0", _flow: false });
  const served = flowText("You were served by {{ doc.owner }}", { h: 40, fontSize: 10, color: "#333333", padding: "24px 0 0 0", _flow: false });
  const terms = flowText("ACCOUNTS ARE DUE ON DEMAND", { h: 46, fontSize: 11, fontWeight: "700", align: "center", bg: "#d9f1fb", padding: "8px 20px", margin: "24px 0 0 0", _flow: false });

  return treeOf([hdr, info, tbl, words, served, terms],
    [hdr, logo, side, title, company, address, info, billTo, billHead, billName, billAddr, meta, ...rows.flat(), tbl, words, served, terms]);
}
