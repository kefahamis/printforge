import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as htmlToImage from 'html-to-image';

const A4W = 794, A4H = 1123, SNAP = 4;
const snap = v => Math.round(v / SNAP) * SNAP;
const uid = () => "_" + Math.random().toString(36).slice(2, 9);
const getPathData = (pts, closed = false) => {
  if (!pts || pts.length < 2) return "";
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i], prev = pts[i - 1];
    d += ` C ${prev.c2.x} ${prev.c2.y}, ${p.c1.x} ${p.c1.y}, ${p.x} ${p.y}`;
  }
  if (closed) {
    const p = pts[0], prev = pts[pts.length - 1];
    d += ` C ${prev.c2.x} ${prev.c2.y}, ${p.c1.x} ${p.c1.y}, ${p.x} ${p.y} Z`;
  }
  return d;
};
const DCS = ["#1f6feb", "#0e8a7d", "#a86b00", "#c2410c", "#6b5bd2"];
const dc = d => DCS[d % DCS.length];

function injectStyles(theme = "dark") {
  const isDark = theme === "dark";
  const s0 = isDark ? {
    b0: "#111111", b1: "#191919", b2: "#1f1f1f", b3: "#272727", b4: "#313131",
    bd: "rgba(255,255,255,.06)", bm: "rgba(255,255,255,.1)", bh: "rgba(255,255,255,.18)",
    t0: "#ededed", t1: "#a8a8a8", t2: "#7c7c7c", ac: "#4c9aff", ad: "rgba(76,154,255,.14)"
  } : {
    b0: "#f3f3f3", b1: "#ffffff", b2: "#f6f6f6", b3: "#ececec", b4: "#dfdfdf",
    bd: "rgba(0,0,0,.09)", bm: "rgba(0,0,0,.14)", bh: "rgba(0,0,0,.2)",
    t0: "#171717", t1: "#4d4d4d", t2: "#737373", ac: "#1f6feb", ad: "rgba(31,111,235,.1)"
  };

  const id = "pf6";
  let s = document.getElementById(id);
  if (!s) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800&display=swap";
    document.head.appendChild(link);
    s = document.createElement("style");
    s.id = id;
    document.head.appendChild(s);
  }

  const rules = [
    "*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}",
    `:root{--b0:${s0.b0};--b1:${s0.b1};--b2:${s0.b2};--b3:${s0.b3};--b4:${s0.b4};--bd:${s0.bd};--bm:${s0.bm};--bh:${s0.bh};--t0:${s0.t0};--t1:${s0.t1};--t2:${s0.t2};--ac:${s0.ac};--ad:${s0.ad};--gn:#2f9e5b;--rd:#d9484d;--r4:4px;--r6:6px;--sans:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;--mono:ui-monospace,'Cascadia Mono',Consolas,Menlo,monospace}`,
    "body{background:var(--b0);font-family:var(--sans);color:var(--t0);overflow:hidden}",
    "button{font-family:inherit}",
    ".pf-print-area{font-family:'Geist',sans-serif}",
    "input,select,textarea{font-family:inherit}",
    "::-webkit-scrollbar{width:6px;height:6px}",
    "::-webkit-scrollbar-track{background:transparent}",
    "::-webkit-scrollbar-thumb{background:var(--b4)}",
    "::-webkit-scrollbar-thumb:hover{background:var(--bh)}",
    ".pi{width:100%;padding:6px 10px;background:var(--b0);border:1px solid var(--bm);border-radius:var(--r4);color:var(--t0);font-size:11px;outline:none}",
    ".pi:focus{border-color:var(--ac)}",
    ".pi::placeholder{color:var(--t2);opacity:.6}",
    ".mono{font-family:var(--mono)}",
    ".ps{width:100%;padding:5px 8px;background:var(--b0);border:1px solid var(--bm);border-radius:var(--r4);color:var(--t0);font-size:11px;outline:none;cursor:pointer;-webkit-appearance:none;appearance:none;background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2360607a'/%3E%3C/svg%3E\");background-repeat:no-repeat;background-position:calc(100% - 8px) center;padding-right:24px}",
    ".ps:focus{border-color:var(--ac)}",
    ".ib{display:flex;align-items:center;justify-content:center;width:26px;height:26px;border:1px solid var(--bd);border-radius:var(--r4);background:transparent;cursor:pointer;color:var(--t1);font-size:12px;transition:all .12s;flex-shrink:0}",
    ".ib:hover{background:var(--b4);color:var(--t0);border-color:var(--bm)}",
    ".ib.on{background:var(--ad);color:var(--ac);border-color:var(--ac)}",
    ".ib.del:hover{background:rgba(248,113,113,.12);color:var(--rd);border-color:var(--rd)}",
    ".tb{display:flex;align-items:center;gap:5px;padding:5px 10px;border:none;border-radius:var(--r4);background:transparent;cursor:pointer;color:var(--t1);font-size:11px;font-weight:500;transition:all .12s;white-space:nowrap}",
    ".tb:hover{background:var(--b4);color:var(--t0)}",
    ".tb.on{background:var(--ad);color:var(--ac)}",
    ".tab{flex:1;padding:8px 4px;background:transparent;border:none;border-bottom:2px solid transparent;cursor:pointer;font-size:11px;font-weight:500;color:var(--t2)}",
    ".tab:hover{color:var(--t1)}",
    ".tab.on{color:var(--t0);border-bottom-color:var(--ac)}",
    ".sl{font-size:11px;font-weight:600;color:var(--t1);margin-bottom:6px}",
    ".sdiv{height:1px;background:var(--bd);margin:12px -12px}",
    ".prow{display:flex;gap:4px;align-items:flex-end;margin-bottom:4px}",
    ".pf{display:flex;flex-direction:column;gap:3px;flex:1;min-width:0}",
    ".pf>label{font-size:10px;color:var(--t2)}",
    ".cv{background:var(--b0);position:relative}",
    ".rh{position:absolute;width:8px;height:8px;background:var(--b1);border:1.5px solid var(--ac);z-index:40}",
    ".rh:hover{background:var(--ac)}",
    ".rh-nw{top:-5px;left:-5px;cursor:nw-resize}",
    ".rh-n{top:-5px;left:calc(50% - 4px);cursor:n-resize}",
    ".rh-ne{top:-5px;right:-5px;cursor:ne-resize}",
    ".rh-e{top:calc(50% - 4px);right:-5px;cursor:e-resize}",
    ".rh-se{bottom:-5px;right:-5px;cursor:ne-resize}",
    ".rh-s{bottom:-5px;left:calc(50% - 4px);cursor:s-resize}",
    ".rh-sw{bottom:-5px;left:-5px;cursor:sw-resize}",
    ".rh-w{top:calc(50% - 4px);left:-5px;cursor:w-resize}",
    ".sel-ring{position:absolute;inset:-1px;pointer-events:none;border:1px solid var(--ac)}",
    ".dz{position:absolute;inset:0;border-radius:inherit;pointer-events:none;border:2px dashed transparent;transition:all .15s}",
    ".dz.over{border-color:var(--ac);background:var(--ad)}",
    ".dz.hint{border-color:var(--bh)}",
    ".chip{position:absolute;top:-18px;left:-1px;padding:2px 6px;color:#fff;font-size:9px;font-weight:500;white-space:nowrap;font-family:var(--mono);pointer-events:none;opacity:0}",
    ".elw:hover>.chip,.elw.sel>.chip{opacity:1}",
    ".li{display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:var(--r4);cursor:pointer;font-size:11px;font-weight:500;transition:all .1s;border:1px solid transparent}",
    ".li:hover{background:var(--b3)}",
    ".li.sel{background:var(--ad);border-color:var(--ac);color:var(--t0)}",
    ".bcb{padding:3px 8px;border:1px solid var(--bd);border-radius:var(--r4);background:transparent;cursor:pointer;color:var(--t1);font-size:10px;transition:all .12s;white-space:nowrap}",
    ".bcb:hover{background:var(--b3);color:var(--t0)}",
    ".bcb.on{background:var(--ad);color:var(--ac);border-color:var(--ac)}",
    ".pf-ruler{background:var(--b1);color:var(--t2);font-size:9px;position:relative;user-select:none;flex-shrink:0}",
    ".pf-ruler-h{height:20px;border-bottom:1px solid var(--bd);width:100%}",
    ".pf-ruler-v{width:20px;border-right:1px solid var(--bd);height:100%}",
    ".pf-ruler-marker{position:absolute;background:var(--t2);opacity:0.5}",
    ".pf-ruler-label{position:absolute;color:var(--t2);font-size:8px;font-family:var(--mono)}",
    ".pf-grid{position:absolute;inset:0;pointer-events:none;z-index:0;background-image:linear-gradient(var(--gc) 1px,transparent 1px),linear-gradient(90deg,var(--gc) 1px,transparent 1px);background-size:var(--gs) var(--gs)}",
    ".pf-guide-h{position:absolute;left:0;right:0;height:1px;background:#ff00ff;z-index:1000;pointer-events:none;}",
    ".pf-guide-v{position:absolute;top:0;bottom:0;width:1px;background:#ff00ff;z-index:1000;pointer-events:none;}",
    `@media print {
      @page { size: A4; margin: 0; }
      body * { visibility: hidden; }
      .pf-print-area, .pf-print-area * { visibility: visible; }
      .pf-print-area { 
        position: fixed !important; 
        left: 0 !important; 
        top: 0 !important; 
        width: ${A4W}px !important;
        height: ${A4H}px !important;
        padding: 0 !important;
        margin: 0 !important;
        box-shadow: none !important;
        transform: none !important;
      }
      #pf-editor-ui { display: none !important; }
    }`
  ];
  s.textContent = rules.join("\n");
  document.head.appendChild(s);
}

// ── Tree ops ──────────────────────────────────────────────────────────────────
const treeUpd = (tree, id, ch) => ({ ...tree, nodes: { ...tree.nodes, [id]: { ...tree.nodes[id], ...ch } } });

const treeAdd = (tree, node, parentId, pageIdx = 0) => {
  const nodes = { ...tree.nodes, [node.id]: node };
  if (!parentId) {
    const pages = [...tree.pages];
    pages[pageIdx] = { ...pages[pageIdx], roots: [...pages[pageIdx].roots, node.id] };
    return { ...tree, nodes, pages };
  }
  const p = nodes[parentId];
  return { ...tree, nodes: { ...nodes, [parentId]: { ...p, children: [...(p.children || []), node.id] } } };
};

const collectIds = (nodes, id, depth = 0) => {
  if (depth > 40) return [id];
  const n = nodes[id]; if (!n) return [id];
  return [id, ...(n.children || []).flatMap(c => collectIds(nodes, c, depth + 1))];
};

const treeRemove = (tree, id) => {
  const del = new Set(collectIds(tree.nodes, id));
  const nodes = Object.fromEntries(
    Object.entries(tree.nodes).filter(([k]) => !del.has(k))
      .map(([k, v]) => [k, { ...v, children: (v.children || []).filter(c => !del.has(c)) }])
  );
  const pages = tree.pages.map(p => ({ ...p, roots: p.roots.filter(r => !del.has(r)) }));
  return { ...tree, nodes, pages };
};

const migrateTree = (t) => {
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
  return { nodes, pages };
};

const rmFromParent = (tree, id) => {
  const pages = tree.pages.map(p => ({ ...p, roots: p.roots.filter(r => r !== id) }));
  const nodes = Object.fromEntries(Object.entries(tree.nodes).map(([k, v]) => [k, { ...v, children: (v.children || []).filter(c => c !== id) }]));
  return { ...tree, pages, nodes };
};

const treeMove = (tree, id, newPid) => treeAdd(rmFromParent(tree, id), tree.nodes[id], newPid);

const findParent = (tree, id) => {
  if (!tree?.pages || !tree?.nodes) return null;
  if ((tree.pages || []).some(p => (p.roots || []).includes(id))) return null;
  for (const [pid, n] of Object.entries(tree.nodes)) {
    if ((n.children || []).includes(id)) return pid;
  }
  return null;
};

const isDesc = (nodes, ancId, descId, depth = 0) => {
  if (!descId || depth > 40) return false;
  const n = nodes[ancId]; if (!n) return false;
  return (n.children || []).some(c => c === descId || isDesc(nodes, c, descId, depth + 1));
};

const cloneTree = (nodes, id) => {
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

const getDepth = (tree, id) => {
  let d = 0, cur = findParent(tree, id);
  const seen = new Set([id]);
  while (cur && !seen.has(cur)) {
    seen.add(cur); d++; cur = findParent(tree, cur);
    if (d > 50) break;
  }
  return d;
};

const getGlobalBox = (tree, id) => {
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

const calcGuides = (tree, targetId, box, activePageIdx) => {
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
  others.push({ id: 'page', x: 0, y: 0, w: A4W, h: A4H });
  others.push({ id: 'page-center', x: A4W / 2, y: A4H / 2, w: 0, h: 0 });

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
const SAMPLE_DATA = {
  name: "ACC-SINV-2026-00001", customer_name: "Tagrit", posting_date: "2026-02-22", due_date: "2026-03-24",
  grand_total: 12500.00, net_total: 10775.86, tax_amount: 1724.14, currency: "KES",
  company: "EXAMPLE COMPANY LTD", company_address: "123 Example Road, Nairobi",
  items: [
    { idx: 1, item_name: "Hydro Filter (Small)", qty: 2, rate: 4500, amount: 9000 },
    { idx: 2, item_name: "Connector Valve v2", qty: 5, rate: 700, amount: 3500 }
  ]
};

const subst = (txt, data = SAMPLE_DATA) => {
  if (!txt) return "";
  return txt.replace(/\{\{\s*doc\.(\w+).*?\}\}/g, (m, k) => data[k] ?? m)
    .replace(/\{\{\s*item\.(\w+).*?\}\}/g, (m, k) => data[k] ?? m);
};

// ── Factories ─────────────────────────────────────────────────────────────────
const mkT = (x = 80, y = 80) => ({ id: uid(), type: "text", children: [], x, y, w: 240, h: 32, content: "{{ doc.field_name }}", fontSize: 13, fontWeight: "400", color: "#111111", align: "left", italic: false, lineHeight: 1.5, bg: "transparent", padding: 4, borderRadius: 0, isRich: false });
const mkC = (x = 40, y = 80) => ({ id: uid(), type: "container", children: [], x, y, w: 714, h: 120, fill: "transparent", stroke: "#d4d4d4", strokeWidth: 1, borderRadius: 0, opacity: 1, padding: 12, mode: "flow", layout: "flex", flexDir: "row", flexWrap: "wrap", justifyContent: "flex-start", alignItems: "stretch", gap: 12, gridCols: "1fr 1fr", gridRows: "auto", colGap: 12, rowGap: 12 });
const mkI = (x = 80, y = 80) => ({ id: uid(), type: "image", children: [], x, y, w: 160, h: 80, logoType: "company", jinjaExpr: "{{ doc.company_logo }}", customUrl: "", label: "Logo", objectFit: "contain", fallbackBg: "#f2f2f2" });
const mkR = (x = 80, y = 80) => ({ id: uid(), type: "rect", children: [], x, y, w: 200, h: 80, fill: "#d9d9d9", stroke: "transparent", strokeWidth: 0, borderRadius: 0, opacity: 1, mode: "absolute", layout: "flex", flexDir: "column", justifyContent: "center", alignItems: "center", gap: 10, padding: 10 });
const mkL = (x = 40, y = 80) => ({ id: uid(), type: "line", children: [], x, y, w: 714, h: 1, color: "#cccccc", thickness: 1, style: "solid" });
const mkCircle = (x = 80, y = 80) => ({ id: uid(), type: "circle", children: [], x, y, w: 100, h: 100, fill: "#d9d9d9", stroke: "transparent", strokeWidth: 0, opacity: 1, mode: "absolute", layout: "flex", flexDir: "column", justifyContent: "center", alignItems: "center", gap: 10, padding: 10 });
const mkTriangle = (x = 80, y = 80) => ({ id: uid(), type: "triangle", children: [], x, y, w: 100, h: 100, fill: "#d9d9d9", stroke: "transparent", strokeWidth: 0, opacity: 1, mode: "absolute", layout: "flex", flexDir: "column", justifyContent: "center", alignItems: "center", gap: 10, padding: 10 });
const mkPath = (x = 80, y = 80, points = []) => ({ id: uid(), type: "path", children: [], x, y, w: 100, h: 100, points, fill: "transparent", stroke: "#111111", strokeWidth: 2, opacity: 1 });
const mkTbl = (x = 40, y = 80) => ({ id: uid(), type: "table", children: [], x, y, w: 714, h: 200, childField: "items", columns: [{ id: uid(), label: "Description", field: "item_name", align: "left", width: "40%" }, { id: uid(), label: "Qty", field: "qty", align: "center", width: "12%" }, { id: uid(), label: "Rate", field: "rate", align: "right", width: "22%" }, { id: uid(), label: "Amount", field: "amount", align: "right", width: "26%" }], headerBg: "#f2f2f2", headerColor: "#111111", headerFontSize: 11, rowBg: "#ffffff", rowAltBg: "#ffffff", rowColor: "#222222", borderColor: "#cccccc", fontSize: 12, footerRows: [] });
const FACS = { text: mkT, container: mkC, image: mkI, rect: mkR, line: mkL, circle: mkCircle, triangle: mkTriangle, table: mkTbl, path: mkPath };

// ── Jinja ─────────────────────────────────────────────────────────────────────
const cssLen = v => typeof v === "number" ? v + "px" : (v || "0");

function renderNode(tree, id, indent, extraStyle = "", inFlow = false) {
  const el = tree.nodes[id]; if (!el) return "";
  const p = "  ".repeat(indent);
  const isRoot = tree.pages.some(p => (p.roots || []).includes(id));
  const isFlow = isRoot || inFlow || el.mode === "flow" || el._flow;

  const isShape = ["rect", "circle", "triangle", "line", "image", "path"].includes(el.type);
  const pos = isFlow
    ? ("position:relative;" + (isRoot && !isShape ? "width:100%;" : "width:" + cssLen(el.w) + ";"))
    : "position:absolute;left:" + (el.x || 0) + "px;top:" + (el.y || 0) + "px;width:" + cssLen(el.w) + ";";

  const base = pos + (extraStyle || "");

  // Layout conversion for wkhtmltopdf (Tables are most robust)
  let kids = el.children || [];
  let childrenHtml = "";
  let layoutStyle = "";

  if (el.layout === "flex" && (el.flexDir === "row" || el.flexDir === "row-reverse")) {
    const actualKids = el.flexDir === "row-reverse" ? [...kids].reverse() : kids;
    const cells = actualKids.map(childId => {
      const child = tree.nodes[childId];
      const wStr = child && child.w ? `width:${cssLen(child.w)};` : "";
      const va = el.alignItems === 'center' ? 'middle' : el.alignItems === 'flex-end' ? 'bottom' : 'top';
      return `<td class="pf-c" style="${wStr}vertical-align:${va} !important;">${renderNode(tree, childId, indent + 2, "", true)}</td>`;
    }).join("\n");
    childrenHtml = `\n${p}<table style="width:100%;border-collapse:separate;border-spacing:${el.gap || 0}px 0;"><tr>${cells}</tr></table>\n`;
  } else if (el.layout === "grid") {
    const gridSpec = String(el.gridCols || "1fr 1fr").trim();
    const colsCount = /^\d+$/.test(gridSpec) ? parseInt(gridSpec) : gridSpec.split(/\s+/).length || 2;
    let rows = [];
    for (let i = 0; i < kids.length; i += colsCount) {
      const rowKids = kids.slice(i, i + colsCount);
      const cells = rowKids.map(childId => `<td class="pf-c" style="width:${Math.round(100 / colsCount)}%;vertical-align:top;">${renderNode(tree, childId, indent + 2, "", true)}</td>`).join("");
      rows.push(`${p}  <tr>${cells}</tr>`);
    }
    childrenHtml = `\n${p}<table style="width:100%;border-collapse:separate;border-spacing:${el.colGap || 0}px ${el.rowGap || 0}px;">\n${rows.join("\n")}\n${p}</table>\n`;
  } else {
    childrenHtml = kids.map((childId, i) => {
      let extra = "";
      if (el.layout === "flex" && (el.flexDir === "column" || el.flexDir === "column-reverse") && el.gap > 0 && i < kids.length - 1) {
        extra = `margin-bottom:${el.gap}px;`;
      }
      return renderNode(tree, childId, indent + 1, extra, el.mode === "flow" || inFlow);
    }).join("\n");
  }

  if (el.type === "text") return p + '<div style="' + base + 'min-height:' + el.h + 'px;' + (el.isRich ? '' : 'font-size:' + el.fontSize + 'px;font-weight:' + el.fontWeight + ';color:' + el.color + ';text-align:' + el.align + ';font-style:' + (el.italic ? "italic" : "normal") + ';line-height:' + el.lineHeight + ';') + 'background:' + el.bg + ';padding:' + cssLen(el.padding) + ';border-radius:' + el.borderRadius + 'px;">' + (el.content || "") + '</div>';

  if (el.type === "rect") {
    const border = (el.strokeWidth || 0) + 'px solid ' + (el.stroke || "transparent");
    return p + `<div style="${base}height:${el.h}px;background:${el.fill};border:${border};border-radius:${el.borderRadius || 0}px;opacity:${el.opacity || 1};padding:${el.padding || 0}px;overflow:hidden;">${childrenHtml}${p}</div>`;
  }

  if (el.type === "circle") {
    const svgCircle = `<svg width="${el.w}" height="${el.h}" style="position:absolute;top:0;left:0;z-index:-1;"><ellipse cx="${el.w / 2}" cy="${el.h / 2}" rx="${el.w / 2}" ry="${el.h / 2}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth || 0}" /></svg>`;
    return p + `<div style="${base}height:${el.h}px;opacity:${el.opacity || 1};padding:${el.padding || 0}px;overflow:hidden;">\n${p}  ${svgCircle}\n${childrenHtml}${p}</div>`;
  }

  if (el.type === "triangle") {
    const svgTri = `<svg width="${el.w}" height="${el.h}" style="position:absolute;top:0;left:0;z-index:-1;"><polygon points="${el.w / 2},0 0,${el.h} ${el.w},${el.h}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth || 0}" /></svg>`;
    return p + `<div style="${base}height:${el.h}px;opacity:${el.opacity || 1};padding:${el.padding || 0}px;overflow:hidden;">\n${p}  ${svgTri}\n${childrenHtml}${p}</div>`;
  }

  if (el.type === "path") {
    const d = getPathData(el.points, el.closed);
    return p + `<div style="${base}overflow:visible;"><svg width="${el.w}" height="${el.h}" viewBox="0 0 ${el.w} ${el.h}" style="width:100%;height:100%;overflow:visible;"><path d="${d}" fill="${el.fill || 'transparent'}" stroke="${el.stroke || '#000'}" stroke-width="${el.strokeWidth || 1}" opacity="${el.opacity || 1}" /></svg></div>`;
  }

  if (el.type === "line") return p + '<div style="' + base + 'height:' + el.thickness + 'px;border-top:' + el.thickness + 'px ' + el.style + ' ' + el.color + ';"></div>';

  if (el.type === "image") {
    const fit = el.objectFit || "contain";
    if (el.logoType === "custom" && el.customUrl) {
      return p + '<img src="' + el.customUrl + '" style="' + base + 'height:' + el.h + 'px;object-fit:' + fit + ';" />';
    }
    const expr = (el.jinjaExpr || "").replace(/[{}]/g, "").trim();
    return p + '{%if ' + (expr || "True") + '%}\n' + p + '<img src="' + (el.jinjaExpr || "") + '" style="' + base + 'height:' + el.h + 'px;object-fit:' + fit + ';" />\n' + p + '{%endif%}';
  }

  if (el.type === "table") {
    const cols = el.columns || [];
    const ths = cols.map(c => '<th style="width:' + (c?.width || "auto") + ';text-align:' + (c?.align || "left") + ';padding:7px 10px !important;font-size:' + (el.headerFontSize || 11) + 'px;font-weight:600;color:' + (el.headerColor || "inherit") + ';">' + (c?.label || "") + '</th>').join("");
    const tdSt = 'padding:6px 10px !important;font-size:' + (el.fontSize || 12) + 'px;color:' + (el.rowColor || "inherit") + ';border-bottom:1px solid ' + (el.borderColor || "transparent") + ';';
    const tds = cols.map(c => '<td style="text-align:' + (c?.align || "left") + ';' + tdSt + '">{{item.' + (c?.field || "field") + '|default("")}}</td>').join("");
    const rowBg = el.rowBg || "transparent", rowAltBg = el.rowAltBg || rowBg;
    const rowBgSt = rowAltBg === rowBg ? rowBg : "{{ '" + rowBg + "' if loop.index0 % 2 == 0 else '" + rowAltBg + "' }}";
    let tblSt = base.replace(/position:\s*relative;?/g, "").replace(/width:\s*[^;]+;?/g, "") + "width:100%;border-collapse:collapse;table-layout:fixed;";
    return p + '<table style="' + tblSt + '">\n' + p + '<thead><tr style="background:' + (el.headerBg || "transparent") + ';color:' + (el.headerColor || "inherit") + ';">' + ths + '</tr></thead>\n' + p + '<tbody>\n' + p + '{%for item in doc.' + (el.childField || "items") + '%}\n' + p + '<tr style="page-break-inside:avoid;background:' + rowBgSt + ';">' + tds + '</tr>\n' + p + '{%endfor%}\n' + p + '</tbody>\n' + p + '</table>';
  }

  if (el.type === "container") {
    if (indent > 25) return p + "<!-- max depth reached -->";
    const bg = el.fill || "transparent";
    const border = (el.strokeWidth || 0) + 'px ' + (el.style || "solid") + ' ' + (el.stroke || "transparent");
    return p + `<div style="${base}min-height:${el.h}px;background:${bg};border:${border};border-radius:${el.borderRadius || 0}px;opacity:${el.opacity || 1};padding:${cssLen(el.padding)};overflow:hidden;">${childrenHtml}${p}</div>`;
  }
  return "";
}

// Frappe renders a Print Format's HTML inside its own page (.print-format) with `doc`
// already in scope, so the published version is a fragment with scoped CSS. The page
// padding becomes the Print Format's PDF margins instead of padding on the page box.
function toPrintFormatHtml(tree) {
  const pad = tree.pages[0]?.padding ?? 40;
  const css = `
  @media screen { .print-format { padding: ${pad}px !important; } }
  @media print { .print-format { padding: 0 !important; } }
  .print-format { max-width: ${A4W}px !important; }
  .pf-doc, .pf-doc * { box-sizing: border-box; }
  .pf-doc { color: #111111; -webkit-print-color-adjust: exact; }
  .pf-doc div, .pf-doc p { margin: 0; }
  .pf-doc table { width: 100%; border-collapse: collapse; table-layout: fixed; margin: 0; }
  .print-format .pf-doc td.pf-c { padding: 0 !important; border: 0 !important; }
  .pf-doc img { max-width: 100%; display: block; }
  .pf-page { position: relative; width: ${A4W - pad * 2}px; max-width: 100%; }
`;
  const last = tree.pages.length - 1;
  const pagesHtml = tree.pages.map((page, i) => {
    const rootsHtml = (page.roots || []).map(id => renderNode(tree, id, 1, "", true)).join("\n");
    return `<div class="pf-page"${i < last ? ' style="page-break-after:always;"' : ""}>\n${rootsHtml}\n</div>`;
  }).join("\n");
  return `<style>${css}</style>\n<div class="pf-doc">\n${pagesHtml}\n</div>`;
}

function toJinja(tree, doctype) {
  try {
    const css = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Geist', sans-serif; background: #fff; color: #111111; margin: 0; padding: 0; -webkit-print-color-adjust: exact; }
    .page { 
      position: relative; 
      width: ${A4W}px; 
      min-height: ${A4H}px; 
      page-break-after: always; 
      overflow: hidden;
      background: #fff;
    }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    img { max-width: 100%; height: auto; display: block; }
    @media print {
      body { background: none; }
      .page { box-shadow: none; }
    }
  `;

    const pagesHtml = tree.pages.map((page, i) => {
      const rootsHtml = (page.roots || []).map(id => renderNode(tree, id, 1, "", true)).join("\n");
      return `<div class="page" style="padding: ${page.padding ?? 40}px;">\n${rootsHtml}\n</div>`;
    }).join("\n");

    return `{%- set doc = frappe.get_doc(doc.doctype, doc.name) -%}
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${doctype}</title>
  <style>${css}</style>
</head>
<body>
${pagesHtml}
</body>
</html>`;
  } catch (e) {
    console.error("Jinja generation error:", e);
    return "Error generating Jinja template. Please check console.";
  }
}

// ── Frappe site ───────────────────────────────────────────────────────────────
// Set by the /printforge page of the Frappe app; absent when run standalone with Vite.
const FRAPPE = typeof window !== "undefined" ? window.PF_FRAPPE || null : null;

async function frappeCall(method, args = {}) {
  const res = await fetch("/api/method/printforge.api." + method, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "Accept": "application/json", "X-Frappe-CSRF-Token": FRAPPE?.csrf_token || "" },
    body: JSON.stringify(args)
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* non-JSON error page */ }
  if (!res.ok) {
    let msg = "";
    try { msg = JSON.parse(data._server_messages).map(m => JSON.parse(m).message).join(" "); } catch (e) { /* no server message */ }
    msg = (msg || data?.exception || res.status + " " + res.statusText).replace(/<[^>]+>/g, "");
    throw new Error(msg);
  }
  return data?.message;
}

// ── Smart Guides ─────────────────────────────────────────────────────────────
function SmartGuides({ guides }) {
  if (!guides || (!guides.h?.length && !guides.v?.length)) return null;
  return (
    <>
      {(guides.h || []).map((y, i) => <div key={'h' + i} className="pf-guide-h" style={{ top: y }} />)}
      {(guides.v || []).map((x, i) => <div key={'v' + i} className="pf-guide-v" style={{ left: x }} />)}
    </>
  );
}

// ── Atoms ─────────────────────────────────────────────────────────────────────
function Swatch({ value, onChange }) {
  return (
    <div style={{ width: 26, height: 26, borderRadius: 4, border: "1.5px solid var(--bm)", cursor: "pointer", position: "relative", overflow: "hidden", flexShrink: 0, backgroundImage: "linear-gradient(45deg,#bbb 25%,transparent 25%),linear-gradient(-45deg,#bbb 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#bbb 75%),linear-gradient(-45deg,transparent 75%,#bbb 75%)", backgroundSize: "7px 7px", backgroundPosition: "0 0,0 3.5px,3.5px -3.5px,-3.5px 0" }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: 3, background: value }} />
      <input type="color" value={value} onChange={e => onChange(e.target.value)} style={{ position: "absolute", inset: -4, width: "calc(100% + 8px)", height: "calc(100% + 8px)", opacity: 0, cursor: "pointer" }} />
    </div>
  );
}
function Num({ label, value, onChange, unit, min, max }) {
  return (
    <div className="pf">
      {label && <label>{label}</label>}
      <div style={{ position: "relative" }}>
        <input type="number" className="pi" value={value ?? 0} min={min} max={max} onChange={e => onChange(Number(e.target.value))} style={{ paddingRight: unit ? 22 : 8 }} />
        {unit && <span style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)", fontSize: 9, color: "var(--t2)", pointerEvents: "none" }}>{unit}</span>}
      </div>
    </div>
  );
}
function Txt({ label, value, onChange, mono, ph, rows }) {
  const cls = "pi" + (mono ? " mono" : "");
  return (
    <div className="pf">
      {label && <label>{label}</label>}
      {rows ? <textarea className={cls} value={value} onChange={e => onChange(e.target.value)} rows={rows} placeholder={ph} style={{ resize: "vertical", lineHeight: 1.6 }} /> : <input className={cls} value={value} onChange={e => onChange(e.target.value)} placeholder={ph} />}
    </div>
  );
}
function RichTextEditor({ value, onChange }) {
  const ref = useRef(null);
  const quillRef = useRef(null);
  const skip = useRef(false);

  useEffect(() => {
    if (ref.current && !quillRef.current && window.Quill) {
      quillRef.current = new window.Quill(ref.current, {
        theme: 'snow',
        modules: {
          toolbar: [
            ['bold', 'italic', 'underline'],
            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
            ['clean']
          ]
        }
      });
      quillRef.current.on('text-change', () => {
        if (!skip.current) {
          onChange(quillRef.current.root.innerHTML);
        }
      });
    }
  }, [onChange]);

  useEffect(() => {
    if (quillRef.current && quillRef.current.root.innerHTML !== value) {
      skip.current = true;
      quillRef.current.root.innerHTML = value || '';
      skip.current = false;
    }
  }, [value]);

  return (
    <div className="pf">
      <div ref={ref} />
    </div>
  );
}
function Sel({ label, value, onChange, options }) {
  return (
    <div className="pf">
      {label && <label>{label}</label>}
      <select className="ps" value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o.v ?? o} value={o.v ?? o}>{o.l ?? o}</option>)}
      </select>
    </div>
  );
}
function CRow({ label, value, onChange }) {
  return (
    <div className="pf" style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Swatch value={value === "transparent" ? "#ffffff" : value} onChange={onChange} />
      <div style={{ flex: 1 }}>
        {label && <label style={{ fontSize: 10, color: "var(--t2)", display: "block", marginBottom: 2 }}>{label}</label>}
        <input className="pi mono" value={value} onChange={e => onChange(e.target.value)} style={{ fontSize: 10 }} />
      </div>
    </div>
  );
}
function Sec({ title, children, badge }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span className="sl" style={{ margin: 0 }}>{title}</span>
        {badge && <span style={{ fontSize: 8, padding: "1px 5px", background: "var(--ad)", color: "var(--ac)", borderRadius: 3, fontWeight: 700 }}>{badge}</span>}
      </div>
      {children}
    </div>
  );
}
const Sdiv = () => <div className="sdiv" />;

// ── Resize handles ────────────────────────────────────────────────────────────
function RH({ el, onUpdate, zoom, preview, tree, pageIdx, onGuides }) {
  const mk = dir => e => {
    e.stopPropagation();
    const ox = e.clientX, oy = e.clientY, { x: ix, y: iy, w: iw, h: ih } = el;
    const mv = ev => {
      const dx = (ev.clientX - ox) / zoom, dy = (ev.clientY - oy) / zoom;
      let nx = ix, ny = iy, nw = iw, nh = ih;
      if (dir.includes("e")) nw = Math.max(20, snap(iw + dx));
      if (dir.includes("s")) nh = Math.max(8, snap(ih + dy));
      if (dir.includes("w")) { nw = Math.max(20, snap(iw - dx)); nx = snap(ix + dx); }
      if (dir.includes("n")) { nh = Math.max(8, snap(ih - dy)); ny = snap(iy + dy); }

      if (onGuides) onGuides(calcGuides(tree, el.id, { x: nx, y: ny, w: nw, h: nh }, pageIdx));
      if (el.type === 'path') {
        const sw = nw / el.w, sh = nh / el.h;
        const pts = (el.points || []).map(p => ({
          x: p.x * sw, y: p.y * sh,
          c1: { x: p.c1.x * sw, y: p.c1.y * sh },
          c2: { x: p.c2.x * sw, y: p.c2.y * sh }
        }));
        onUpdate(el.id, { x: nx, y: ny, w: nw, h: nh, points: pts });
      } else {
        onUpdate(el.id, { x: nx, y: ny, w: nw, h: nh });
      }
    };
    const up = () => {
      if (onGuides) onGuides({ h: [], v: [] });
      window.removeEventListener("mousemove", mv);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up);
  };
  return <>{preview ? null : ["nw", "n", "ne", "e", "se", "s", "sw", "w"].map(d => <div key={d} className={"rh rh-" + d} onMouseDown={mk(d)} />)}</>;
}

// ── Canvas node ───────────────────────────────────────────────────────────────
function CNode({ nodeId, tree, selected, onSelect, onUpdate, onDrop, zoom, depth, flow, preview, onActive, pageIdx, onGuides, penMode, setPenMode, editPointIdx, setEditPointIdx, selPointIdx, setSelPointIdx, editHandle, setEditHandle }) {
  const [over, setOver] = useState(false);
  const el = tree.nodes[nodeId];
  if (!el) return null;

  const isSel = selected === nodeId;
  const isCont = el.type === "container";
  const isEmpty = isCont && (el.children || []).length === 0;
  const isFlow = el.mode === "flow";
  const color = dc(depth);

  const onMD = e => {
    if (preview || e.target.classList.contains("rh")) return;
    e.stopPropagation(); onSelect(nodeId);
    if (onActive) onActive();
    if (flow) return;
    const ox = e.clientX, oy = e.clientY, ex = el.x, ey = el.y;
    const mv = ev => {
      const nx = snap(ex + (ev.clientX - ox) / zoom);
      const ny = snap(ey + (ev.clientY - oy) / zoom);
      if (onGuides) onGuides(calcGuides(tree, nodeId, { x: nx, y: ny, w: el.w, h: el.h }, pageIdx));
      onUpdate(nodeId, { x: nx, y: ny });
    };
    const up = () => {
      if (onGuides) onGuides({ h: [], v: [] });
      window.removeEventListener("mousemove", mv);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up);
  };

  const label = el.type === "container" ? (el.layout || "container") + " (" + ((el.children || []).length) + ")" : (el.type || "element");

  // Natural Flow Logic for Canvas View
  const isRoot = tree.pages.some(p => (p.roots || []).includes(nodeId));
  const isFlowWrapper = isRoot || flow;
  const isShape = ["rect", "circle", "triangle", "line", "image"].includes(el.type);

  const baseStyle = isFlowWrapper
    ? { position: "relative", cursor: "move", userSelect: "none", flexShrink: 0, width: isRoot && !isShape ? "100%" : el.w, marginBottom: isRoot ? 4 : 0 }
    : { position: "absolute", left: el.x, top: el.y, width: el.w, cursor: "move", userSelect: "none" };

  let body = null;
  const canHold = ["container", "rect", "circle", "triangle"].includes(el.type);
  const layoutStyles = el.layout === "flex" ? { display: "flex", flexDirection: el.flexDir, flexWrap: el.flexWrap, justifyContent: el.justifyContent, alignItems: el.alignItems, gap: el.gap } : el.layout === "grid" ? { display: "grid", gridTemplateColumns: el.gridCols, columnGap: el.colGap, rowGap: el.rowGap } : {};

  if (el.type === "text") {
    const txt = preview ? subst(el.content) : el.content;
    body = <div dangerouslySetInnerHTML={{ __html: txt }} style={{ minHeight: el.h, fontSize: el.isRich ? "inherit" : el.fontSize, fontWeight: el.isRich ? "inherit" : el.fontWeight, color: el.isRich ? "inherit" : el.color, textAlign: el.isRich ? "inherit" : el.align, fontStyle: el.isRich ? "inherit" : (el.italic ? "italic" : "normal"), lineHeight: el.isRich ? "inherit" : el.lineHeight, background: el.bg, padding: el.padding, borderRadius: el.borderRadius, whiteSpace: el.isRich ? "normal" : "pre-wrap", overflow: "hidden", wordBreak: "break-word", ...(flow ? { width: "100%" } : {}) }} />;
  } else if (el.type === "rect") {
    body = (
      <div style={{ height: "100%", background: el.fill, border: el.strokeWidth > 0 ? el.strokeWidth + "px " + (el.style || "solid") + " " + el.stroke : "none", borderRadius: el.borderRadius, opacity: el.opacity, padding: el.padding, position: "relative", overflow: "hidden", ...layoutStyles }}>
        {(el.children || []).map(c => <CNode key={c} nodeId={c} tree={tree} selected={selected} onSelect={onSelect} onUpdate={onUpdate} onDrop={onDrop} zoom={zoom} depth={depth + 1} flow={true} preview={preview} onActive={onActive} pageIdx={pageIdx} onGuides={onGuides} penMode={penMode} setPenMode={setPenMode} editPointIdx={editPointIdx} setEditPointIdx={setEditPointIdx} selPointIdx={selPointIdx} setSelPointIdx={setSelPointIdx} editHandle={editHandle} setEditHandle={setEditHandle} />)}
        {!preview && over && <div className="dz over" />}
      </div>
    );
  } else if (el.type === "circle") {
    body = (
      <div style={{ height: "100%", background: el.fill, border: el.strokeWidth > 0 ? el.strokeWidth + "px " + (el.style || "solid") + " " + el.stroke : "none", borderRadius: "50%", opacity: el.opacity, padding: el.padding, position: "relative", overflow: "hidden", ...layoutStyles }}>
        {(el.children || []).map(c => <CNode key={c} nodeId={c} tree={tree} selected={selected} onSelect={onSelect} onUpdate={onUpdate} onDrop={onDrop} zoom={zoom} depth={depth + 1} flow={true} preview={preview} onActive={onActive} pageIdx={pageIdx} onGuides={onGuides} penMode={penMode} setPenMode={setPenMode} editPointIdx={editPointIdx} setEditPointIdx={setEditPointIdx} selPointIdx={selPointIdx} setSelPointIdx={setSelPointIdx} editHandle={editHandle} setEditHandle={setEditHandle} />)}
        {!preview && over && <div className="dz over" />}
      </div>
    );
  } else if (el.type === "triangle") {
    body = (
      <div style={{ height: "100%", background: el.fill, clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)", opacity: el.opacity, padding: el.padding, position: "relative", overflow: "hidden", ...layoutStyles }}>
        {(el.children || []).map(c => <CNode key={c} nodeId={c} tree={tree} selected={selected} onSelect={onSelect} onUpdate={onUpdate} onDrop={onDrop} zoom={zoom} depth={depth + 1} flow={true} preview={preview} onActive={onActive} pageIdx={pageIdx} onGuides={onGuides} penMode={penMode} setPenMode={setPenMode} editPointIdx={editPointIdx} setEditPointIdx={setEditPointIdx} selPointIdx={selPointIdx} setSelPointIdx={setSelPointIdx} editHandle={editHandle} setEditHandle={setEditHandle} />)}
        {!preview && over && <div className="dz over" />}
      </div>
    );
  } else if (el.type === "path") {
    body = (
      <div style={{ width: "100%", height: "100%", overflow: "visible" }}>
        <svg width={el.w} height={el.h} viewBox={`0 0 ${el.w} ${el.h}`} style={{ width: "100%", height: "100%", overflow: "visible", pointerEvents: "none" }}>
          <path d={getPathData(el.points, el.closed)} fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth} opacity={el.opacity} />
        </svg>
      </div>
    );
  } else if (el.type === "line") {
    body = <div style={{ borderTop: el.thickness + "px " + (el.style || "solid") + " " + el.color }} />;
  } else if (el.type === "image") {
    const showCustom = el.logoType === "custom" && el.customUrl;
    body = preview ? (
      <div style={{ height: el.h, background: el.fallbackBg, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {showCustom ? <img src={el.customUrl} style={{ width: "100%", height: "100%", objectFit: el.objectFit }} /> : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--t2)" strokeWidth="1" opacity=".2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>
        )}
      </div>
    ) : (
      <div style={{ height: el.h, background: el.fallbackBg, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 6, border: "1px dashed #c4c4c4", borderRadius: 4, overflow: "hidden", position: "relative" }}>
        {showCustom ? <img src={el.customUrl} style={{ width: "100%", height: "100%", objectFit: el.objectFit, opacity: .6 }} /> : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8a8a8a" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>
        )}
        <span style={{ fontSize: 9, color: "#666", fontFamily: "var(--mono)", background: "rgba(255,255,255,.8)", padding: "2px 4px", borderRadius: 3, position: "relative", zIndex: 1 }}>{el.logoType === "company" ? el.jinjaExpr : "Custom Logo"}</span>
      </div>
    );
  } else if (el.type === "table") {
    const cols = el.columns || [];
    const rows = preview ? SAMPLE_DATA.items : [{}, {}, {}];
    body = (
      <div style={{ overflow: "hidden", height: el.h }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <thead><tr style={{ background: el.headerBg, color: el.headerColor }}>
            {cols.map((c, i) => c ? <th key={c.id || i} style={{ width: c.width, textAlign: c.align, padding: "7px 10px", fontSize: el.headerFontSize, fontWeight: 600 }}>{c.label}</th> : null)}
          </tr></thead>
          <tbody>{rows.map((row, i) => <tr key={i} style={{ background: i % 2 === 0 ? el.rowBg : el.rowAltBg }}>
            {cols.map((c, j) => c ? (
              <td key={c.id || j} style={{ textAlign: c.align, padding: "6px 10px", fontSize: el.fontSize, color: el.rowColor, borderBottom: "1px solid " + el.borderColor }}>
                {preview ? subst("{{item." + c.field + "}}", row) : <span style={{ opacity: .3, fontSize: 9, fontFamily: "var(--mono)" }}>item.{c.field}</span>}
              </td>
            ) : null)}
          </tr>)}</tbody>
        </table>
      </div>
    );
  } else if (el.type === "container") {
    body = (
      <div style={{ height: flow ? "auto" : el.h, minHeight: el.h, background: el.fill, border: el.strokeWidth > 0 ? el.strokeWidth + "px solid " + el.stroke : preview ? "none" : "1px dashed #d0d0d0", borderRadius: el.borderRadius, opacity: el.opacity, padding: el.padding, position: "relative", overflow: "hidden", ...(isFlow ? layoutStyles : {}) }}>
        {!preview && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 2, background: color, opacity: .4, pointerEvents: "none" }} />}
        {depth < 30 ? (el.children || []).map(c => <CNode key={c} nodeId={c} tree={tree} selected={selected} onSelect={onSelect} onUpdate={onUpdate} onDrop={onDrop} zoom={zoom} depth={depth + 1} flow={isFlow} preview={preview} onActive={onActive} pageIdx={pageIdx} onGuides={onGuides} penMode={penMode} setPenMode={setPenMode} editPointIdx={editPointIdx} setEditPointIdx={setEditPointIdx} selPointIdx={selPointIdx} setSelPointIdx={setSelPointIdx} editHandle={editHandle} setEditHandle={setEditHandle} />) : <div style={{ fontSize: 8, color: "red" }}>Max depth</div>}
        {!preview && <div className={"dz" + (over ? " over" : isEmpty ? " hint" : "")} />}
        {isEmpty && !over && !preview && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 4, pointerEvents: "none" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b0b0b0" strokeWidth="1.5"><path d="M12 5v14M5 12h14" /></svg>
          <span style={{ fontSize: 9, color: "#9a9a9a", fontFamily: "var(--mono)" }}>drop here</span>
        </div>}
      </div>
    );
  }

  return (
    <div className={"elw" + (isSel && !preview ? " sel" : "")} style={baseStyle}
      onMouseDown={onMD}
      onClick={e => e.stopPropagation()}
      onDragOver={e => { if (!canHold || preview) return; e.preventDefault(); e.stopPropagation(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { if (!canHold || preview) return; e.preventDefault(); e.stopPropagation(); setOver(false); const id = e.dataTransfer.getData("text/plain"); if (id && id !== nodeId && !isDesc(tree.nodes, id, nodeId)) onDrop(id, nodeId); }}
      draggable={!flow && !preview}
      onDragStart={e => { if (preview) return; e.dataTransfer.setData("text/plain", nodeId); e.stopPropagation(); }}>
      {!preview && <div className="chip" style={{ background: color }}>{label}</div>}
      {body}
      {selected && penMode === 'editing' && el.type === 'path' && (
        <svg style={{ position: "absolute", inset: 0, width: el.w, height: el.h, overflow: "visible", pointerEvents: "none", zIndex: 1000 }}>
          {el.points.map((p, i) => (
            <g key={i}>
              <line x1={p.x} y1={p.y} x2={p.c1.x} y2={p.c1.y} stroke="rgba(0,0,0,.2)" strokeWidth="1" strokeDasharray="2" />
              <line x1={p.x} y1={p.y} x2={p.c2.x} y2={p.c2.y} stroke="rgba(0,0,0,.2)" strokeWidth="1" strokeDasharray="2" />
              <circle cx={p.x} cy={p.y} r={selPointIdx === i ? "5" : "4"} fill={selPointIdx === i ? "var(--rd)" : "var(--ac)"} stroke={selPointIdx === i ? "#fff" : "none"} strokeWidth="1.5" style={{ pointerEvents: "auto", cursor: "move" }} onMouseDown={(e) => { e.stopPropagation(); setEditPointIdx(i); setSelPointIdx(i); setEditHandle('p'); }} />
              <circle cx={p.c1.x} cy={p.c1.y} r="3" fill="#fff" stroke="var(--ac)" strokeWidth="1" style={{ pointerEvents: "auto", cursor: "crosshair" }} onMouseDown={(e) => { e.stopPropagation(); setEditPointIdx(i); setSelPointIdx(i); setEditHandle('c1'); }} />
              <circle cx={p.c2.x} cy={p.c2.y} r="3" fill="#fff" stroke="var(--ac)" strokeWidth="1" style={{ pointerEvents: "auto", cursor: "crosshair" }} onMouseDown={(e) => { e.stopPropagation(); setEditPointIdx(i); setSelPointIdx(i); setEditHandle('c2'); }} />
            </g>
          ))}
        </svg>
      )}
      {isSel && !preview && !penMode && <div className="sel-ring" style={{ borderColor: color }} />}
      {isSel && !preview && <RH el={el} onUpdate={onUpdate} zoom={zoom} preview={preview} tree={tree} pageIdx={pageIdx} onGuides={onGuides} />}
    </div>
  );
}

// ── Layer tree ────────────────────────────────────────────────────────────────
// ── Layer tree ────────────────────────────────────────────────────────────────
function LayerTree({ tree, selected, onSelect, depth, ids }) {
  const [collapsed, setCollapsed] = useState({});
  const toggle = (id, e) => { e.stopPropagation(); setCollapsed(prev => ({ ...prev, [id]: !prev[id] })); };

  const icons = {
    text: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 7V4h16v3M9 20h6M12 4v16" /></svg>,
    container: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>,
    image: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>,
    rect: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="4" y="4" width="16" height="16" rx="2" /></svg>,
    circle: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="9" /></svg>,
    triangle: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 3L2 21H22L12 3Z" /></svg>,
    line: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="4" y1="12" x2="20" y2="12" /></svg>,
    table: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" /><line x1="9" y1="3" x2="9" y2="21" /></svg>,
    page: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="13 2 13 9 20 9" /></svg>
  };

  if (!ids) {
    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        {tree.pages.map((page, i) => (
          <div key={page.id}>
            <div className="li" style={{ paddingLeft: 10, background: "var(--b2)", borderBottom: "1px solid var(--bd)" }}>
              <span style={{ fontSize: 10, color: "var(--ac)", width: 16, display: "flex", alignItems: "center", marginRight: 2 }}>{icons.page}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--t0)", flex: 1 }}>{page.name}</span>
            </div>
            <LayerTree tree={tree} selected={selected} onSelect={onSelect} depth={1} ids={page.roots} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {ids.map(id => {
        const el = tree.nodes[id]; if (!el) return null;
        const isSel = selected === id;
        const hasKids = el.type === "container" && (el.children || []).length > 0;
        const isCollapsed = collapsed[id];
        const color = dc(depth);

        let label = el.type === "text"
          ? (el.content || "").replace(/\{\{.*?\}\}/g, "V").replace(/\n/g, " ").slice(0, 24)
          : el.type === "container" ? (el.label || "Group " + id.slice(-2))
            : el.type === "image" ? (el.label || `${el.w} × ${el.h}`)
              : el.type === "table" ? "Table (" + (el.columns || []).length + ")"
                : (el.type.charAt(0).toUpperCase() + el.type.slice(1));

        return (
          <div key={id}>
            <div className={"li" + (isSel ? " sel" : "")} onClick={() => onSelect(id)} style={{ paddingLeft: depth * 14 + 10, position: "relative" }}>
              {depth > 0 && <div style={{ position: "absolute", left: (depth - 1) * 14 + 16, top: 0, bottom: 0, width: 1, background: "var(--bd)", opacity: .3 }} />}
              <div style={{ width: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center", marginRight: 6, cursor: "pointer", opacity: hasKids ? 0.6 : 0 }} onClick={e => toggle(id, e)}>
                <svg width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" style={{ transform: isCollapsed ? "rotate(-90deg)" : "none", transition: "transform .15s" }}><polyline points="6 9 12 15 18 9" /></svg>
              </div>
              <span style={{ fontSize: 10, color: color, width: 16, display: "flex", alignItems: "center", flexShrink: 0, marginRight: 2, opacity: isSel ? 1 : 0.6 }}>{icons[el.type]}</span>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11, fontWeight: isSel ? 600 : 400, color: isSel ? "var(--t0)" : "var(--t1)", fontFamily: el.type === "text" ? "inherit" : "var(--mono)" }}>
                {label}
              </span>
              {el.mode === "flow" && <span style={{ fontSize: 7, padding: "1px 3px", background: "var(--ad)", color: "var(--ac)", borderRadius: 2, flexShrink: 0, opacity: .7, marginLeft: 4 }}>{el.layout}</span>}
            </div>
            {hasKids && !isCollapsed && <LayerTree tree={tree} selected={selected} onSelect={onSelect} depth={depth + 1} ids={el.children} />}
          </div>
        );
      })}
    </div>
  );
}

// ── Breadcrumb ────────────────────────────────────────────────────────────────
function Breadcrumb({ tree, selected, onSelect }) {
  if (!selected) return null;
  const chain = []; let cur = selected;
  const seen = new Set();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    chain.unshift(cur);
    cur = findParent(tree, cur);
    if (chain.length > 50) break; // emergency break
  }
  if (chain.length <= 1) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", background: "var(--b2)", borderBottom: "1px solid var(--bd)", flexShrink: 0, overflowX: "auto" }}>
      <span style={{ fontSize: 9, color: "var(--t2)", marginRight: 2, flexShrink: 0 }}>PATH</span>
      {chain.map((id, i) => {
        const el = tree.nodes[id];
        const lbl = el?.type === "container" ? "Container" : el?.type === "text" ? ((el.content || "").slice(0, 12) + "…") : (el?.type || id);
        return (
          <span key={id} style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            {i > 0 && <span style={{ color: "var(--t2)", fontSize: 9 }}>›</span>}
            <button className={"bcb" + (id === selected ? " on" : "")} onClick={() => onSelect(id)} style={{ color: dc(i) }}>{lbl}</button>
          </span>
        );
      })}
    </div>
  );
}

// ── Props panel ───────────────────────────────────────────────────────────────
function Props({ tree, selected, docFields, onUpdate, onDelete, onDup, onZOrder, onAddChild, showRulers, setShowRulers, showGrid, setShowGrid, gridSize, setGridSize, activePageIdx, onUpdatePage, penMode, setPenMode, selPointIdx, setSelPointIdx }) {
  const el = selected ? tree.nodes[selected] : null;
  const page = tree.pages[activePageIdx];
  const isRoot = selected ? (page.roots || []).includes(selected) : false;
  const u = (k, v) => onUpdate(selected, { [k]: v });
  const up = (k, v) => onUpdatePage(activePageIdx, { [k]: v });
  const pid = selected ? findParent(tree, selected) : null;
  const dep = selected ? getDepth(tree, selected) : 0;
  const TL = { text: "Text", container: "Container", image: "Image", rect: "Rectangle", circle: "Circle", triangle: "Triangle", line: "Line", table: "Table", path: "Path" };

  if (!el) return (
    <div style={{ padding: "12px", overflowY: "auto", height: "100%" }}>
      <Sec title="Page">
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          <button className={"tb" + (showRulers ? " on" : "")} onClick={() => setShowRulers(!showRulers)} style={{ flex: 1 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}><path d="M22 12V5a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7" /><path d="M2 7h20" /><path d="M7 2v5" /><path d="M12 2v3" /><path d="M17 2v5" /><path d="M2 12h5" /><path d="M2 17h3" /></svg>
            Rulers
          </button>
          <button className={"tb" + (showGrid ? " on" : "")} onClick={() => setShowGrid(!showGrid)} style={{ flex: 1 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" /><line x1="9" y1="3" x2="9" y2="21" /><line x1="15" y1="3" x2="15" y2="21" /></svg>
            Grid
          </button>
        </div>
        <div className="prow" style={{ marginBottom: 12 }}>
          <Num label="Page Padding" value={page?.padding ?? 40} onChange={v => up("padding", v)} unit="px" />
        </div>
        {showGrid && (
          <div className="prow">
            <Num label="Grid Size" value={gridSize} onChange={setGridSize} unit="px" />
          </div>
        )}
        <Sdiv />
        <Sec title="Tracing image">
          <p style={{ fontSize: 10, color: "var(--t2)", marginBottom: 8 }}>Shown behind the page while editing. Not exported.</p>
          {page?.backgroundImg ? (
            <div style={{ position: "relative", width: "100%", height: 120, background: "var(--b0)", border: "1px solid var(--bd)", borderRadius: "var(--r4)", overflow: "hidden", marginBottom: 8 }}>
              <img src={page.backgroundImg} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              <button className="ib del" style={{ position: "absolute", top: 4, right: 4 }} onClick={() => up("backgroundImg", null)}>×</button>
            </div>
          ) : (
            <button onClick={() => document.getElementById('bg-upload').click()} style={{ width: "100%", padding: "12px", border: "1px dashed var(--bh)", borderRadius: "var(--r4)", background: "transparent", color: "var(--t1)", cursor: "pointer", fontSize: 11, marginBottom: 8 }}>Upload image</button>
          )}
          <input type="file" id="bg-upload" accept="image/*" style={{ display: "none" }} onChange={(e) => {
            const file = e.target.files[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = (re) => up("backgroundImg", re.target.result);
              reader.readAsDataURL(file);
            }
          }} />
          {page?.backgroundImg && (
            <div className="pf">
              <label>Opacity</label>
              <input type="range" min="0" max="100" value={Math.round((page.bgOpacity ?? 0.3) * 100)} onChange={(e) => up("bgOpacity", e.target.value / 100)} style={{ width: "100%", accentColor: "var(--ac)" }} />
            </div>
          )}
        </Sec>
      </Sec>
      <Sdiv />
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div className="sl" style={{ margin: 0 }}>Shortcuts</div>
        <div style={{ width: "100%" }}>
          {[["Ctrl+Z", "Undo"], ["Ctrl+Y", "Redo"], ["Arrows", "Nudge 1px"], ["Shift+Arrows", "Nudge 8px"], ["Ctrl+D", "Duplicate"], ["Del", "Delete"], ["Esc", "Select parent"]].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 9, padding: "1px 5px", background: "var(--b4)", border: "1px solid var(--bm)", borderRadius: 3, fontFamily: "var(--mono)", color: "var(--t2)" }}>{k}</span>
              <span style={{ fontSize: 10, color: "var(--t2)" }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ padding: "12px", overflowY: "auto", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, paddingBottom: 10, borderBottom: "1px solid var(--bd)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 20, height: 20, borderRadius: 4, background: dc(dep) + "22", border: "1px solid " + dc(dep), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: dc(dep), fontWeight: 700 }}>{TL[el.type]?.[0]}</div>
          <div>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--t0)" }}>{TL[el.type]}</span>
            {pid && <div style={{ fontSize: 9, color: "var(--t2)" }}>depth {dep}</div>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 3 }}>
          <button className="ib" onClick={() => onDup(selected)} title="Dup"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg></button>
          <button className="ib" onClick={() => onZOrder(selected, "up")} title="Move Up">↑</button>
          <button className="ib" onClick={() => onZOrder(selected, "down")} title="Move Down">↓</button>
          <button className="ib del" onClick={() => onDelete(selected)}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg></button>
        </div>
      </div>

      {!el._flow && !isRoot && el.type !== "container" && <><Sec title="Layout"><div className="prow"><Num label="X" value={el.x} onChange={v => u("x", v)} unit="px" /><Num label="Y" value={el.y} onChange={v => u("y", v)} unit="px" /></div><div className="prow"><Num label="W" value={el.w} onChange={v => u("w", v)} unit="px" /><Num label="H" value={el.h} onChange={v => u("h", v)} unit="px" /></div></Sec><Sdiv /></>}
      {isRoot && <><Sec title="Layout"><div className="prow"><Num label="W" value={el.w} onChange={v => u("w", v)} unit="px" /><Num label="H" value={el.h} onChange={v => u("h", v)} unit="px" /></div></Sec><Sdiv /></>}

      {el.type === "container" && <>
        <Sec title="Size"><div className="prow"><Num label="W" value={el.w} onChange={v => u("w", v)} unit="px" /><Num label="H" value={el.h} onChange={v => u("h", v)} unit="px" /></div></Sec><Sdiv />
        <Sec title="Child Mode">
          <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
            {[{ v: "flow", l: "Flow" }, { v: "free", l: "Free" }].map(o => (
              <button key={o.v} onClick={() => u("mode", o.v)} style={{ flex: 1, padding: "6px 4px", border: "1px solid " + (el.mode === o.v ? "var(--ac)" : "var(--bm)"), borderRadius: "var(--r4)", background: el.mode === o.v ? "var(--ad)" : "var(--b3)", color: el.mode === o.v ? "var(--ac)" : "var(--t1)", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>{o.l}</button>
            ))}
          </div>
          <div style={{ fontSize: 9, color: "var(--t2)", lineHeight: 1.6 }}>{el.mode === "flow" ? "Children use flex/grid" : "Children positioned absolutely"}</div>
        </Sec>
        {el.mode === "flow" && <>
          <Sdiv />
          <Sec title="Layout">
            <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
              {[{ v: "flex", l: "Flex" }, { v: "grid", l: "Grid" }, { v: "none", l: "Block" }].map(o => (
                <button key={o.v} onClick={() => u("layout", o.v)} style={{ flex: 1, padding: "5px 4px", border: "1px solid " + (el.layout === o.v ? "var(--ac)" : "var(--bm)"), borderRadius: "var(--r4)", background: el.layout === o.v ? "var(--ad)" : "var(--b3)", color: el.layout === o.v ? "var(--ac)" : "var(--t1)", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>{o.l}</button>
              ))}
            </div>
            {el.layout === "flex" && <>
              <div className="prow"><Sel label="Direction" value={el.flexDir} onChange={v => u("flexDir", v)} options={[{ v: "row", l: "→ Row" }, { v: "column", l: "↓ Col" }, { v: "row-reverse", l: "← Row Rev" }, { v: "column-reverse", l: "↑ Col Rev" }]} /><Sel label="Wrap" value={el.flexWrap} onChange={v => u("flexWrap", v)} options={[{ v: "nowrap", l: "No wrap" }, { v: "wrap", l: "Wrap" }]} /></div>
              <div className="prow"><Sel label="Justify" value={el.justifyContent} onChange={v => u("justifyContent", v)} options={[{ v: "flex-start", l: "Start" }, { v: "center", l: "Center" }, { v: "flex-end", l: "End" }, { v: "space-between", l: "Space-between" }, { v: "space-around", l: "Space-around" }]} /></div>
              <div className="prow"><Sel label="Align" value={el.alignItems} onChange={v => u("alignItems", v)} options={[{ v: "stretch", l: "Stretch" }, { v: "flex-start", l: "Start" }, { v: "center", l: "Center" }, { v: "flex-end", l: "End" }]} /><Num label="Gap" value={el.gap} onChange={v => u("gap", v)} unit="px" /></div>
            </>}
            {el.layout === "grid" && <>
              <div className="prow"><Txt label="Columns" value={el.gridCols} onChange={v => u("gridCols", v)} mono ph="1fr 1fr" /></div>
              <div className="prow"><Num label="Col gap" value={el.colGap} onChange={v => u("colGap", v)} unit="px" /><Num label="Row gap" value={el.rowGap} onChange={v => u("rowGap", v)} unit="px" /></div>
            </>}
          </Sec>
          <Sdiv />
          <Sec title="Add Children" badge="nested">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
              {[["text", "Text"], ["container", "Container"], ["image", "Image"], ["rect", "Rect"], ["circle", "Circle"], ["triangle", "Triangle"], ["line", "Line"], ["path", "Path"]].map(([t, l]) => (
                <button key={t} onClick={() => onAddChild(selected, t)} style={{ padding: "7px 4px", border: "1px dashed var(--bm)", borderRadius: "var(--r4)", background: "var(--b3)", color: "var(--t1)", cursor: "pointer", fontSize: 11 }} onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--ac)"; e.currentTarget.style.color = "var(--ac)"; }} onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--bm)"; e.currentTarget.style.color = "var(--t1)"; }}> + {l}</button>
              ))}
            </div>
          </Sec>
        </>}
        <Sdiv />
        <Sec title="Appearance">
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <CRow label="Fill" value={el.fill} onChange={v => u("fill", v)} />
            <CRow label="Border" value={el.stroke} onChange={v => u("stroke", v)} />
          </div>
          <div className="prow" style={{ marginTop: 6 }}><Num label="Border W" value={el.strokeWidth} onChange={v => u("strokeWidth", v)} unit="px" /><Num label="Radius" value={el.borderRadius} onChange={v => u("borderRadius", v)} unit="px" /><Num label="Padding" value={el.padding} onChange={v => u("padding", v)} unit="px" /></div>
        </Sec>
      </>}

      {el.type === "path" && <>
        <Sec title="Path Style">
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <CRow label="Fill" value={el.fill} onChange={v => u("fill", v)} />
            <CRow label="Stroke" value={el.stroke} onChange={v => u("stroke", v)} />
          </div>
          <div className="prow" style={{ marginTop: 6 }}><Num label="Stroke W" value={el.strokeWidth} onChange={v => u("strokeWidth", v)} unit="px" /><Num label="Opacity" value={el.opacity} onChange={v => u("opacity", v)} min={0} max={1} step={0.1} /></div>
        </Sec>
        <Sdiv />
        <Sec title="Vector Actions">
          <button className="tb" onClick={() => { setPenMode(penMode === 'editing' ? false : 'editing'); setSelPointIdx(-1); }} style={{ width: "100%", background: penMode === 'editing' ? "var(--ad)" : "var(--b3)", color: "var(--ac)", border: "1px solid " + (penMode === 'editing' ? "var(--ac)" : "var(--bd)"), justifyContent: "center" }}>{penMode === 'editing' ? "Exit Vector Edit" : "Edit Points"}</button>
          <button className="tb" onClick={() => u("closed", !el.closed)} style={{ width: "100%", marginTop: 4, justifyContent: "center" }}>{el.closed ? "Open Path" : "Close Path"}</button>
          {selPointIdx !== -1 && (
            <div style={{ marginTop: 8, padding: "8px", background: "var(--rd)", borderRadius: "var(--r4)", color: "#fff", fontSize: 10, fontWeight: 600, textAlign: "center" }}>
              Point {selPointIdx + 1} Selected. Hit Delete to remove.
            </div>
          )}
        </Sec>
      </>}

      {el.type === "text" && <>
        <Sec title="Content Mode">
          <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
            {[{ v: false, l: "Plain / Jinja" }, { v: true, l: "Rich Text" }].map(o => (
              <button key={o.l} onClick={() => u("isRich", o.v)} style={{ flex: 1, padding: "6px 4px", border: "1px solid " + (el.isRich === o.v ? "var(--ac)" : "var(--bm)"), borderRadius: "var(--r4)", background: el.isRich === o.v ? "var(--ad)" : "var(--b3)", color: el.isRich === o.v ? "var(--ac)" : "var(--t1)", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>{o.l}</button>
            ))}
          </div>
        </Sec>
        <Sdiv />
        <Sec title="Content">
          {el.isRich ? (
            <RichTextEditor value={el.content} onChange={v => u("content", v)} />
          ) : (
            <Txt value={el.content} onChange={v => u("content", v)} mono rows={4} />
          )}
        </Sec>
        {docFields.filter(f => !f.isChild).length > 0 && <div style={{ marginBottom: 12 }}>
          <div className="sl">Insert Variable</div>
          <select className="ps" onChange={e => { if (e.target.value) { u("content", el.content + (el.isRich ? " {{ doc." + e.target.value + " }} " : "{{ doc." + e.target.value + " }}")); e.target.value = ""; } }} defaultValue="">
            <option value="">— pick field —</option>
            {docFields.filter(f => !f.isChild).map(f => <option key={f.name} value={f.name}>{f.label || f.name}</option>)}
          </select>
        </div>}
        {!el.isRich && <>
          <Sdiv />
          <Sec title="Typography">
            <div className="prow"><Num label="Size" value={el.fontSize} onChange={v => u("fontSize", v)} unit="px" /><Sel label="Weight" value={el.fontWeight} onChange={v => u("fontWeight", v)} options={[{ v: "300", l: "Light" }, { v: "400", l: "Regular" }, { v: "500", l: "Medium" }, { v: "600", l: "Semibold" }, { v: "700", l: "Bold" }, { v: "800", l: "Extrabold" }]} /></div>
            <div className="prow"><Sel label="Align" value={el.align} onChange={v => u("align", v)} options={["left", "center", "right", "justify"]} /><Num label="Line H" value={el.lineHeight} onChange={v => u("lineHeight", v)} min={.8} max={4} /></div>
            <button className={"ib" + (el.italic ? " on" : "")} onClick={() => u("italic", !el.italic)} style={{ marginTop: 4, width: "auto", padding: "0 10px", fontStyle: "italic", fontSize: 12 }}>I</button>
          </Sec>
          <Sdiv />
          <Sec title="Color">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <CRow label="Text" value={el.color} onChange={v => u("color", v)} />
              <CRow label="Background" value={el.bg === "transparent" ? "#ffffff" : el.bg} onChange={v => u("bg", v)} />
            </div>
          </Sec>
        </>}
        {el.isRich && <>
          <Sdiv />
          <Sec title="Box Styles">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <CRow label="Background" value={el.bg === "transparent" ? "#ffffff" : el.bg} onChange={v => u("bg", v)} />
            </div>
          </Sec>
        </>}
        <Sdiv />
        <Sec title="Box Layout"><div className="prow"><Num label="Radius" value={el.borderRadius} onChange={v => u("borderRadius", v)} unit="px" /><Num label="Padding" value={el.padding} onChange={v => u("padding", v)} unit="px" /></div></Sec>
      </>}

      {(el.type === "rect" || el.type === "circle" || el.type === "triangle") && <>
        <Sec title="Shape Type">
          <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
            {[{ v: "rect", l: "Rect" }, { v: "circle", l: "Circle" }, { v: "triangle", l: "Triangle" }].map(o => (
              <button key={o.v} onClick={() => u("type", o.v)} style={{ flex: 1, padding: "6px 4px", border: "1px solid " + (el.type === o.v ? "var(--ac)" : "var(--bm)"), borderRadius: "var(--r4)", background: el.type === o.v ? "var(--ad)" : "var(--b3)", color: el.type === o.v ? "var(--ac)" : "var(--t0)", cursor: "pointer", fontSize: 10, fontWeight: 600 }}>{o.l}</button>
            ))}
          </div>
        </Sec>
        <Sdiv />
        <Sec title="Appearance">
          <CRow label="Fill" value={el.fill} onChange={v => u("fill", v)} />
          <div style={{ marginTop: 6 }}>
            <CRow label="Stroke" value={el.stroke} onChange={v => u("stroke", v)} />
          </div>
          <div className="prow" style={{ marginTop: 6 }}>
            <Num label="Stroke W" value={el.strokeWidth} onChange={v => u("strokeWidth", v)} unit="px" />
            {el.type === "rect" && <Num label="Radius" value={el.borderRadius} onChange={v => u("borderRadius", v)} unit="px" />}
          </div>
        </Sec>
        <Sdiv />
        <Sec title="Opacity">
          <input type="range" min={0} max={100} value={Math.round(el.opacity * 100)} onChange={e => u("opacity", e.target.value / 100)} style={{ width: "100%", accentColor: "var(--ac)", marginBottom: 4 }} />
          <div style={{ textAlign: "right", fontSize: 10, color: "var(--t2)" }}>{Math.round(el.opacity * 100)}%</div>
        </Sec>
        <Sdiv />
        <Sec title="Layout" badge="nested">
          <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
            {[{ v: "flex", l: "Flex" }, { v: "grid", l: "Grid" }, { v: "none", l: "Block" }].map(o => (
              <button key={o.v} onClick={() => u("layout", o.v)} style={{ flex: 1, padding: "5px 4px", border: "1px solid " + (el.layout === o.v ? "var(--ac)" : "var(--bm)"), borderRadius: "var(--r4)", background: el.layout === o.v ? "var(--ad)" : "var(--b3)", color: el.layout === o.v ? "var(--ac)" : "var(--t1)", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>{o.l}</button>
            ))}
          </div>
          {el.layout === "flex" && <>
            <div className="prow"><Sel label="Direction" value={el.flexDir} onChange={v => u("flexDir", v)} options={[{ v: "row", l: "→ Row" }, { v: "column", l: "↓ Col" }, { v: "row-reverse", l: "← Row Rev" }, { v: "column-reverse", l: "↑ Col Rev" }]} /><Sel label="Wrap" value={el.flexWrap} onChange={v => u("flexWrap", v)} options={[{ v: "nowrap", l: "No wrap" }, { v: "wrap", l: "Wrap" }]} /></div>
            <div className="prow"><Sel label="Justify" value={el.justifyContent} onChange={v => u("justifyContent", v)} options={[{ v: "flex-start", l: "Start" }, { v: "center", l: "Center" }, { v: "flex-end", l: "End" }, { v: "space-between", l: "Space-between" }, { v: "space-around", l: "Space-around" }]} /></div>
            <div className="prow"><Sel label="Align" value={el.alignItems} onChange={v => u("alignItems", v)} options={[{ v: "stretch", l: "Stretch" }, { v: "flex-start", l: "Start" }, { v: "center", l: "Center" }, { v: "flex-end", l: "End" }]} /><Num label="Gap" value={el.gap} onChange={v => u("gap", v)} unit="px" /></div>
          </>}
          {el.layout === "grid" && <>
            <div className="prow"><Txt label="Columns" value={el.gridCols} onChange={v => u("gridCols", v)} mono ph="1fr 1fr" /></div>
            <div className="prow"><Num label="Col gap" value={el.colGap} onChange={v => u("colGap", v)} unit="px" /><Num label="Row gap" value={el.rowGap} onChange={v => u("rowGap", v)} unit="px" /></div>
          </>}
        </Sec>
        <Sdiv />
        <Sec title="Add Children" badge="nested">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
            {[["text", "Text"], ["container", "Container"], ["image", "Image"], ["rect", "Rect"], ["circle", "Circle"], ["triangle", "Triangle"], ["line", "Line"]].map(([t, l]) => (
              <button key={t} onClick={() => onAddChild(selected, t)} style={{ padding: "7px 4px", border: "1px dashed var(--bm)", borderRadius: "var(--r4)", background: "var(--b3)", color: "var(--t1)", cursor: "pointer", fontSize: 11 }} onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--ac)"; e.currentTarget.style.color = "var(--ac)"; }} onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--bm)"; e.currentTarget.style.color = "var(--t1)"; }}> + {l}</button>
            ))}
          </div>
        </Sec>
        <Sdiv />
        <Sec title="Padding"><div className="prow"><Num label="All" value={el.padding} onChange={v => u("padding", v)} unit="px" /></div></Sec>
      </>}

      {el.type === "line" && <Sec title="Stroke"><CRow label="Color" value={el.color} onChange={v => u("color", v)} /><div className="prow" style={{ marginTop: 6 }}><Num label="Thickness" value={el.thickness} onChange={v => u("thickness", v)} unit="px" /><Sel label="Style" value={el.style} onChange={v => u("style", v)} options={["solid", "dashed", "dotted"]} /></div></Sec>}

      {el.type === "image" && <>
        <Sec title="Logo Type">
          <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
            {[{ v: "company", l: "Company" }, { v: "custom", l: "Custom" }].map(o => (
              <button key={o.v} onClick={() => u("logoType", o.v)} style={{ flex: 1, padding: "6px 4px", border: "1px solid " + (el.logoType === o.v ? "var(--ac)" : "var(--bm)"), borderRadius: "var(--r4)", background: el.logoType === o.v ? "var(--ad)" : "var(--b3)", color: el.logoType === o.v ? "var(--ac)" : "var(--t0)", cursor: "pointer", fontSize: 10, fontWeight: 600 }}>{o.l}</button>
            ))}
          </div>
        </Sec>
        <Sdiv />
        <Sec title="Source">
          {el.logoType === "company" ? (
            <Txt label="Jinja Expression" value={el.jinjaExpr} onChange={v => u("jinjaExpr", v)} mono />
          ) : (
            <>
              <Txt label="Image URL" value={el.customUrl} onChange={v => u("customUrl", v)} ph="https://..." />
              <div style={{ marginTop: 8 }}>
                <input type="file" accept="image/*" onChange={e => {
                  const file = e.target.files[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (re) => u("customUrl", re.target.result);
                    reader.readAsDataURL(file);
                  }
                }} style={{ display: "none" }} id="logo-upload" />
                <button onClick={() => document.getElementById('logo-upload').click()} style={{ width: "100%", padding: "7px", border: "1px dashed var(--ac)", borderRadius: "var(--r6)", background: "var(--ad)", color: "var(--ac)", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Upload Image</button>
              </div>
            </>
          )}
          <div style={{ marginTop: 6 }}><Txt label="Label" value={el.label} onChange={v => u("label", v)} /></div>
        </Sec>
        <Sdiv />
        <Sec title="Display"><Sel label="Object Fit" value={el.objectFit} onChange={v => u("objectFit", v)} options={["contain", "cover", "fill", "scale-down"]} /><div style={{ marginTop: 6 }}><CRow label="Fallback bg" value={el.fallbackBg} onChange={v => u("fallbackBg", v)} /></div></Sec>
      </>}

      {el.type === "table" && <>
        <Sec title="Data Source"><Txt label="Child field" value={el.childField || ""} onChange={v => u("childField", v)} mono /></Sec>
        <Sdiv />
        <Sec title="Columns">
          {(el.columns || []).map((col, i) => (
            <div key={col.id} style={{ marginBottom: 8, padding: 8, background: "var(--b3)", borderRadius: "var(--r6)", border: "1px solid var(--bd)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}><span style={{ fontSize: 10, color: "var(--t2)", fontWeight: 600 }}>Col {i + 1}</span><button className="ib del" onClick={() => u("columns", (el.columns || []).filter((_, j) => j !== i))} style={{ width: 20, height: 20, fontSize: 11 }}>×</button></div>
              <div className="prow"><Txt label="Label" value={col.label} onChange={v => { const c = [...(el.columns || [])]; c[i] = { ...col, label: v }; u("columns", c); }} /></div>
              <div className="prow"><Txt label="Field" value={col.field} onChange={v => { const c = [...(el.columns || [])]; c[i] = { ...col, field: v }; u("columns", c); }} mono /><Txt label="Width" value={col.width} onChange={v => { const c = [...(el.columns || [])]; c[i] = { ...col, width: v }; u("columns", c); }} /></div>
              <div className="prow"><Sel label="Align" value={col.align} onChange={v => { const c = [...(el.columns || [])]; c[i] = { ...col, align: v }; u("columns", c); }} options={["left", "center", "right"]} /></div>
            </div>
          ))}
          <button onClick={() => u("columns", [...(el.columns || []), { id: uid(), label: "Column", field: "field", align: "left", width: "auto" }])} style={{ width: "100%", padding: "7px", border: "1px dashed var(--bm)", borderRadius: "var(--r4)", background: "transparent", color: "var(--t1)", cursor: "pointer", fontSize: 11 }} onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--ac)"; e.currentTarget.style.color = "var(--ac)"; }} onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--bm)"; e.currentTarget.style.color = "var(--t1)"; }}>+ Add Column</button>
        </Sec>
        <Sdiv />
        <Sec title="Styles"><CRow label="Header bg" value={el.headerBg} onChange={v => u("headerBg", v)} /><div style={{ marginTop: 6 }}><CRow label="Header text" value={el.headerColor} onChange={v => u("headerColor", v)} /></div><div className="prow" style={{ marginTop: 6 }}><Num label="H font" value={el.headerFontSize} onChange={v => u("headerFontSize", v)} unit="px" /><Num label="Row font" value={el.fontSize} onChange={v => u("fontSize", v)} unit="px" /></div><div style={{ marginTop: 6 }}><CRow label="Row bg" value={el.rowBg} onChange={v => u("rowBg", v)} /></div><div style={{ marginTop: 6 }}><CRow label="Alt row" value={el.rowAltBg} onChange={v => u("rowAltBg", v)} /></div></Sec>
        <Sdiv />
        <Sec title="Footer Rows">
          {(el.footerRows || []).map((fr, i) => (
            <div key={i} style={{ display: "flex", gap: 4, marginBottom: 4 }}>
              <input value={fr.label} onChange={e => { const r = [...(el.footerRows || [])]; r[i] = { ...fr, label: e.target.value }; u("footerRows", r); }} placeholder="Label" className="pi" style={{ flex: 1 }} />
              <input value={fr.expr} onChange={e => { const r = [...(el.footerRows || [])]; r[i] = { ...fr, expr: e.target.value }; u("footerRows", r); }} placeholder="doc.grand_total" className="pi mono" style={{ flex: 1 }} />
              <button className="ib del" onClick={() => u("footerRows", (el.footerRows || []).filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
          <button onClick={() => u("footerRows", [...(el.footerRows || []), { label: "Total", expr: "doc.grand_total" }])} style={{ width: "100%", padding: "6px", border: "1px dashed var(--bm)", borderRadius: "var(--r4)", background: "transparent", color: "var(--t1)", cursor: "pointer", fontSize: 11 }}>+ Footer Row</button>
        </Sec>
      </>}
    </div>
  );
}

// ── Left panel ────────────────────────────────────────────────────────────────
const TOOLS = [
  { type: "text", label: "Text", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" /></svg> },
  { type: "container", label: "Container", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="18" rx="2" /><line x1="2" y1="9" x2="22" y2="9" /></svg> },
  { type: "table", label: "Table", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" /><line x1="9" y1="3" x2="9" y2="21" /></svg> },
  { type: "image", label: "Image", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg> },
];

const SHAPE_TOOLS = [
  { type: "rect", label: "Rect", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /></svg> },
  { type: "circle", label: "Circle", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /></svg> },
  { type: "triangle", label: "Triangle", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3L2 21H22L12 3Z" /></svg> },
  { type: "line", label: "Line", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="12" x2="20" y2="12" /></svg> },
  { type: "path", label: "Pen", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /></svg> },
];

const COMPONENT_TEMPLATES = [
  {
    label: "Invoice Header",
    icon: "▣",
    create: (idx) => {
      const h = { ...mkC(0, 0), h: 100, flexDir: "row", justifyContent: "space-between", alignItems: "center", padding: "0 0 16px 0", mode: "flow", fill: "transparent", stroke: "transparent", strokeWidth: 0 };
      const logo = { ...mkI(0, 0), w: 100, h: 60, _flow: true };
      const info = { ...mkT(0, 0), content: "<strong>{{ doc.company }}</strong><br>{{ doc.company_address }}", fontSize: 11, _flow: true, align: "right" };
      h.children = [logo.id, info.id];
      return [h, logo, info];
    }
  },
  {
    label: "Total Summary",
    icon: "∑",
    create: (idx) => {
      const c = { ...mkC(0, 0), w: 240, h: 80, x: 474, layout: "flex", flexDir: "column", gap: 4, padding: 0, fill: "transparent", stroke: "transparent", strokeWidth: 0 };
      const r1 = { ...mkC(0, 0), flexDir: "row", justifyContent: "space-between", stroke: "transparent", strokeWidth: 0, padding: 0, _flow: true };
      const l1 = { ...mkT(0, 0), content: "Net Total", fontSize: 10, color: "#555555", _flow: true };
      const v1 = { ...mkT(0, 0), content: "{{ doc.net_total }}", fontSize: 10, fontWeight: "600", _flow: true, align: "right" };
      r1.children = [l1.id, v1.id];
      const r2 = { ...mkC(0, 0), flexDir: "row", justifyContent: "space-between", stroke: "transparent", strokeWidth: 0, padding: 0, _flow: true };
      const l2 = { ...mkT(0, 0), content: "Grand Total", fontSize: 12, fontWeight: "700", _flow: true };
      const v2 = { ...mkT(0, 0), content: "KES {{ doc.grand_total }}", fontSize: 12, fontWeight: "700", _flow: true, align: "right" };
      r2.children = [l2.id, v2.id];
      c.children = [r1.id, r2.id];
      return [c, r1, l1, v1, r2, l2, v2];
    }
  }
];

function LeftPanel({ onAdd, onAddTemplate, doctype, setDoctype, docFields, setDocFields, tree, selected, onSelect, penMode, setPenMode, assets, setAssets, onSetTrace }) {
  const [tab, setTab] = useState("insert");
  const [nf, setNf] = useState({ name: "", label: "", isChild: false });
  const [siteFields, setSiteFields] = useState(null); // null | "loading" | { ok, msg }
  const loadSiteFields = async () => {
    setSiteFields("loading");
    try {
      const fields = await frappeCall("get_doctype_fields", { doctype });
      setDocFields(fields);
      setSiteFields({ ok: true, msg: fields.length + " fields loaded from " + doctype + "." });
    } catch (e) {
      setSiteFields({ ok: false, msg: e.message });
    }
  };
  return (
    <div style={{ width: 216, background: "var(--b1)", borderRight: "1px solid var(--bd)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ display: "flex", borderBottom: "1px solid var(--bd)", flexShrink: 0 }}>
        {[["insert", "Insert"], ["layers", "Layers"], ["assets", "Assets"], ["doc", "Doctype"]].map(([t, l]) => (
          <button key={t} className={"tab" + (tab === t ? " on" : "")} onClick={() => setTab(t)}>{l}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {tab === "insert" && <div style={{ padding: 8 }}>
          <div className="sl" style={{ paddingInline: 4, marginBottom: 6 }}>Elements</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 12 }}>
            {TOOLS.map(t => (
              <button key={t.type} onClick={() => onAdd(t.type)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "11px 8px", background: "var(--b2)", border: "1px solid var(--bd)", borderRadius: "var(--r6)", cursor: "pointer", color: "var(--t1)", fontSize: 11, fontWeight: 500, transition: "all .15s" }} onMouseEnter={e => { e.currentTarget.style.background = "var(--b4)"; e.currentTarget.style.color = "var(--t0)"; e.currentTarget.style.borderColor = "var(--bm)"; }} onMouseLeave={e => { e.currentTarget.style.background = "var(--b2)"; e.currentTarget.style.color = "var(--t1)"; e.currentTarget.style.borderColor = "var(--bd)"; }}>
                <span style={{ color: "var(--t2)" }}>{t.icon}</span>{t.label}
              </button>
            ))}
          </div>
          <div className="sl" style={{ paddingInline: 4, marginBottom: 6 }}>Shapes</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4, marginBottom: 12 }}>
            {SHAPE_TOOLS.map(t => (
              <button key={t.type} onClick={() => t.type === 'path' ? setPenMode(penMode ? false : 'drawing') : onAdd(t.type)} title={t.label}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "10px 4px",
                  background: (t.type === 'path' && penMode) ? "var(--ad)" : "var(--b2)",
                  border: "1px solid " + ((t.type === 'path' && penMode) ? "var(--ac)" : "var(--bd)"),
                  borderRadius: "var(--r6)", cursor: "pointer",
                  color: (t.type === 'path' && penMode) ? "var(--ac)" : "var(--t1)", transition: "all .15s"
                }}
                onMouseEnter={e => { if (t.type === 'path' && penMode) return; e.currentTarget.style.background = "var(--b4)"; e.currentTarget.style.color = "var(--t0)"; e.currentTarget.style.borderColor = "var(--bm)"; }}
                onMouseLeave={e => { if (t.type === 'path' && penMode) return; e.currentTarget.style.background = "var(--b2)"; e.currentTarget.style.color = "var(--t1)"; e.currentTarget.style.borderColor = "var(--bd)"; }}>
                {t.icon}
              </button>
            ))}
          </div>
          <div className="sl" style={{ paddingInline: 4, marginBottom: 6 }}>Templates</div>
          <div style={{ marginBottom: 12 }}>
            {COMPONENT_TEMPLATES.map(t => (
              <button key={t.label} onClick={() => onAddTemplate(t.create)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px", marginBottom: 3, border: "1px solid var(--bd)", borderRadius: "var(--r4)", background: "var(--b2)", color: "var(--t1)", cursor: "pointer", fontSize: 11, transition: "all .12s" }} onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--ac)"; e.currentTarget.style.color = "var(--ac)"; }} onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--bd)"; e.currentTarget.style.color = "var(--t1)"; }}>
                <span style={{ fontSize: 13, color: "var(--t2)" }}>{t.icon}</span>{t.label}
              </button>
            ))}
          </div>
          <div className="sl" style={{ paddingInline: 4, marginBottom: 6 }}>Container Presets</div>
          {[{ label: "Flex Row", cfg: { layout: "flex", flexDir: "row", mode: "flow" } }, { label: "Flex Col", cfg: { layout: "flex", flexDir: "column", mode: "flow" } }, { label: "Grid 2 col", cfg: { layout: "grid", gridCols: "1fr 1fr", mode: "flow" } }, { label: "Grid 3 col", cfg: { layout: "grid", gridCols: "1fr 1fr 1fr", mode: "flow" } }, { label: "Free", cfg: { mode: "free" } }].map(p => (
            <button key={p.label} onClick={() => onAdd("container", p.cfg)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px", marginBottom: 3, border: "1px solid var(--bd)", borderRadius: "var(--r4)", background: "var(--b2)", color: "var(--t1)", cursor: "pointer", fontSize: 11, transition: "all .12s" }} onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--ac)"; e.currentTarget.style.color = "var(--ac)"; }} onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--bd)"; e.currentTarget.style.color = "var(--t1)"; }}>
              <span style={{ fontSize: 13, color: "var(--t2)" }}>◫</span>{p.label}
            </button>
          ))}
        </div>}
        {tab === "layers" && <div style={{ padding: "8px 0" }}>
          <div className="li" style={{ paddingInline: 12, marginBottom: 4, cursor: "default" }}>
            <span style={{ fontSize: 11, color: "var(--ac)", marginRight: 8 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18" /></svg>
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--t0)" }}>{doctype || "Untitled"}</span>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 9, color: "var(--t2)", opacity: .6 }}>{Object.keys(tree.nodes).length}</span>
          </div>
          <LayerTree tree={tree} selected={selected} onSelect={onSelect} depth={0} />
        </div>}
        {tab === "assets" && <div style={{ padding: 12 }}>
          <div className="sl" style={{ marginBottom: 8 }}>Images</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {assets.map((src, i) => (
              <div key={i} className="li" style={{ padding: 4, background: "var(--b0)", border: "1px solid var(--bd)", borderRadius: "var(--r4)", position: "relative", height: 100, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                <div style={{ flex: 1, overflow: "hidden", cursor: "pointer" }} onClick={() => onAdd("image", { logoType: "custom", customUrl: src })}>
                  <img src={src} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                </div>
                <div style={{ display: "flex", gap: 2, padding: 2 }}>
                  <button className="tb" style={{ flex: 1, fontSize: 8, padding: "2px 0" }} onClick={() => onSetTrace(src)}>Trace</button>
                  <button className="ib del" style={{ width: 18, height: 18 }} onClick={() => setAssets(assets.filter((_, j) => j !== i))}>×</button>
                </div>
              </div>
            ))}
            <div style={{ border: "1px dashed var(--bh)", borderRadius: "var(--r4)", height: 80, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} onClick={() => document.getElementById('asset-upload').click()}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--t2)" strokeWidth="1.5"><path d="M12 5v14M5 12h14" /></svg>
              <input type="file" id="asset-upload" accept="image/*" style={{ display: "none" }} onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (re) => setAssets([...assets, re.target.result]);
                  reader.readAsDataURL(file);
                }
              }} />
            </div>
          </div>
        </div>}
        {tab === "doc" && <div style={{ padding: 12 }}>
          <Sec title="Document Type">
            <input className="pi" value={doctype} onChange={e => setDoctype(e.target.value)} placeholder="e.g. Sales Invoice" style={{ fontSize: 12 }} />
            {FRAPPE && <>
              <button className="bcb" disabled={siteFields === "loading"} onClick={loadSiteFields} style={{ width: "100%", marginTop: 6, padding: "6px 8px" }}>{siteFields === "loading" ? "Loading" : "Load fields from site"}</button>
              {siteFields && siteFields !== "loading" && <p style={{ fontSize: 10, color: siteFields.ok ? "var(--t2)" : "var(--rd)", marginTop: 4 }}>{siteFields.msg}</p>}
            </>}
          </Sec>
          <div className="sdiv" />
          <Sec title="Fields">
            {docFields.map((f, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, padding: "5px 8px", background: "var(--b3)", borderRadius: "var(--r4)", border: "1px solid var(--bd)" }}>
                <span style={{ fontSize: 10, fontFamily: "var(--mono)", color: "var(--ac)", flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</span>
                {f.isChild && <span style={{ fontSize: 8, padding: "1px 4px", background: "var(--ad)", color: "var(--ac)", borderRadius: 3 }}>child</span>}
                <button className="ib del" onClick={() => setDocFields(docFields.filter((_, j) => j !== i))} style={{ width: 18, height: 18, fontSize: 10 }}>×</button>
              </div>
            ))}
            <div style={{ marginTop: 8, padding: 10, background: "var(--b3)", borderRadius: "var(--r6)", border: "1px solid var(--bd)" }}>
              <div className="sl" style={{ marginBottom: 6 }}>Add field</div>
              <input value={nf.name} onChange={e => setNf({ ...nf, name: e.target.value })} placeholder="field_name" className="pi mono" style={{ marginBottom: 4 }} />
              <input value={nf.label} onChange={e => setNf({ ...nf, label: e.target.value })} placeholder="Display label" className="pi" style={{ marginBottom: 6 }} />
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--t1)", marginBottom: 8, cursor: "pointer" }}><input type="checkbox" checked={nf.isChild} onChange={e => setNf({ ...nf, isChild: e.target.checked })} style={{ accentColor: "var(--ac)" }} />Child table field</label>
              <button onClick={() => { if (!nf.name.trim()) return; setDocFields([...docFields, { ...nf }]); setNf({ name: "", label: "", isChild: false }); }} style={{ width: "100%", padding: "6px", border: "1px solid var(--ac)", borderRadius: "var(--r4)", background: "var(--ad)", color: "var(--ac)", cursor: "pointer", fontSize: 11, fontWeight: 500 }}>Add field</button>
            </div>
          </Sec>
          <div className="sdiv" />
          <Sec title="Presets">
            {[{ label: "Sales Invoice", fields: [{ name: "name", label: "Invoice #" }, { name: "customer_name", label: "Customer" }, { name: "posting_date", label: "Date" }, { name: "due_date", label: "Due" }, { name: "currency", label: "Currency" }, { name: "net_total", label: "Net" }, { name: "tax_amount", label: "Tax" }, { name: "grand_total", label: "Total" }, { name: "company", label: "Company" }, { name: "company_address", label: "Address" }, { name: "items", isChild: true }, { name: "taxes", isChild: true }] }, { label: "Purchase Order", fields: [{ name: "name", label: "PO #" }, { name: "supplier_name", label: "Supplier" }, { name: "transaction_date", label: "Date" }, { name: "grand_total", label: "Total" }, { name: "company", label: "Company" }, { name: "items", isChild: true }] }].map(p => (
              <button key={p.label} onClick={() => { setDoctype(p.label); setDocFields(p.fields); }} style={{ display: "block", width: "100%", padding: "7px 10px", marginBottom: 4, border: "1px solid var(--bd)", borderRadius: "var(--r4)", background: "var(--b3)", color: "var(--t1)", cursor: "pointer", fontSize: 11, textAlign: "left", transition: "all .12s" }} onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--ac)"; e.currentTarget.style.color = "var(--ac)"; }} onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--bd)"; e.currentTarget.style.color = "var(--t1)"; }}>
                {p.label}
              </button>
            ))}
          </Sec>
        </div>}
      </div>
    </div>
  );
}

// ── Initial data ──────────────────────────────────────────────────────────────
function buildTree() {
  // Nested boxes must not inherit mkC's 714x120 default size, and widths in a row
  // leave 2px for the editor's dashed container outline.
  const plain = { fill: "transparent", stroke: "transparent", strokeWidth: 0, borderRadius: 0, padding: 0 };
  const row = { ...plain, layout: "flex", flexDir: "row", flexWrap: "nowrap", justifyContent: "space-between", alignItems: "flex-start", gap: 0 };
  const col = { ...plain, layout: "flex", flexDir: "column", flexWrap: "nowrap", gap: 2 };
  const txt = (content, o = {}) => ({ ...mkT(0, 0), content, w: "100%", h: 16, fontSize: 11, color: "#111111", padding: 0, _flow: true, ...o });
  const label = (content, o = {}) => txt(content, { h: 14, fontSize: 9, color: "#666666", ...o });

  const hdr = { ...mkC(0, 0), ...row, w: "100%", h: 76, padding: "0 0 20px 0" };
  const logo = { ...mkI(0, 0), w: 130, h: 56, _flow: true };
  const co = txt("{{ doc.company }}<br>{{ doc.company_address }}", { w: 330, h: 34, color: "#333333", padding: "0 0 0 16px" });
  const inv = txt("INVOICE<br>{{ doc.name }}", { w: 252, h: 48, fontSize: 18, fontWeight: "700", align: "right", lineHeight: 1.3 });
  hdr.children = [logo.id, co.id, inv.id];
  const div1 = { ...mkL(0, 0), color: "#111111", thickness: 1, w: "100%" };

  const brow = { ...mkC(0, 0), ...plain, w: "100%", h: 100, layout: "grid", gridCols: "1fr 1fr", colGap: 0, rowGap: 0, padding: "16px 0" };
  const bbl = { ...mkC(0, 0), ...col, w: "100%", h: 68, _flow: true };
  const blbl = label("Bill to");
  const bnm = txt("{{ doc.customer_name }}", { h: 20, fontSize: 13, fontWeight: "600" });
  const bad = txt("{{ doc.customer_address }}", { h: 30, color: "#333333" });
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
  const sv = txt("{{ doc.currency }} {{ doc.net_total }}", { w: 268, h: 18, align: "right" });
  sr.children = [sl.id, sv.id];
  const tr = { ...mkC(0, 0), ...row, w: "100%", h: 20, _flow: true };
  const tl2 = txt("Total", { w: 70, h: 20, fontSize: 13, fontWeight: "700" });
  const tv = txt("{{ doc.currency }} {{ doc.grand_total }}", { w: 268, h: 20, fontSize: 13, fontWeight: "700", align: "right" });
  tr.children = [tl2.id, tv.id];
  smry.children = [sr.id, tr.id];
  foot.children = [note.id, smry.id];

  const all = [hdr, logo, co, inv, div1, brow, bbl, blbl, bnm, bad, dbl, dlbl, dval, dulbl, duval, tbl, foot, note, smry, sr, sl, sv, tr, tl2, tv];
  const nodes = Object.fromEntries(all.map(n => [n.id, n]));
  const roots = [hdr.id, div1.id, brow.id, tbl.id, foot.id];
  return { pages: [{ id: uid(), name: "Page 1", roots }], nodes };
}

function buildSampleInvoiceTree() {
  const p_bl = "#3bc7f4";
  const hdr = { ...mkC(0, 0), w: "100%", h: 120, layout: "flex", flexDir: "row", justifyContent: "space-between" };
  const logo = { ...mkI(0, 0), w: 120, h: 70, _flow: true };
  const rside = { ...mkC(0, 0), w: 340, _flow: true, layout: "flex", flexDir: "column", alignItems: "flex-end", gap: 2 };
  const inv_t = { ...mkT(0, 0), content: "INVOICE", fontSize: 28, fontWeight: "700", color: p_bl, _flow: true, align: "right" };
  const co_t = { ...mkT(0, 0), content: "EXAMPLE COMPANY LTD", fontSize: 16, fontWeight: "700", color: "#000", _flow: true, align: "right" };
  const ad_t = { ...mkT(0, 0), content: "123 Example Road, 1st Floor\nP.O. Box 00000-00100, Nairobi\nEmail: accounts@example.com\nWeb: https://www.example.com\nTel: 254700000000 / 254700000001", fontSize: 9, color: "#333", _flow: true, align: "right", lineHeight: 1.4 };
  rside.children = [inv_t.id, co_t.id, ad_t.id];
  hdr.children = [logo.id, rside.id];

  const btr = { ...mkC(0, 0), w: "100%", h: 100, layout: "flex", flexDir: "row", gap: 20, margin: "20px 0" };
  const bto = { ...mkC(0, 0), flex: 1, _flow: true };
  const bt_hdr = { ...mkT(0, 0), content: "BILL TO:", fontSize: 11, fontWeight: "700", color: "#fff", bg: p_bl, padding: "4px 10px", w: "100%", _flow: true };
  const bt_val = { ...mkT(0, 0), content: "Tagrit", fontSize: 16, fontWeight: "700", color: "#000", padding: "12px 10px", _flow: true };
  bto.children = [bt_hdr.id, bt_val.id];

  const meta = { ...mkC(0, 0), w: 280, _flow: true, fill: "transparent", stroke: p_bl, strokeWidth: 1, layout: "flex", flexDir: "column" };
  const m_row = (l, v) => {
    const r = { ...mkC(0, 0), w: "100%", _flow: true, layout: "flex", flexDir: "row", borderBottom: `1px solid ${p_bl}` };
    const label = { ...mkT(0, 0), content: l, fontSize: 10, fontWeight: "700", color: "#fff", bg: p_bl, w: 120, padding: 6, _flow: true };
    const val = { ...mkT(0, 0), content: v, fontSize: 11, color: "#333", flex: 1, padding: 6, align: "right", _flow: true };
    r.children = [label.id, val.id];
    return [r, label, val];
  };
  const [r1, r1l, r1v] = m_row("DATE:", "2026-02-22");
  const [r2, r2l, r2v] = m_row("Invoice No:", "ACC-SINV-2026-00001");
  const [r3, r3l, r3v] = m_row("Due Date:", "2026-02-22");
  meta.children = [r1.id, r2.id, r3.id];
  btr.children = [bto.id, meta.id];

  const tbl = {
    ...mkTbl(0, 0), w: "100%", headerBg: p_bl, headerColor: "#000", headerFontSize: 10, borderColor: p_bl, margin: "20px 0", columns: [
      { id: uid(), label: "NO.", field: "idx", align: "left", width: "10%" },
      { id: uid(), label: "ITEM DESCRIPTION", field: "item_name", align: "left", width: "40%" },
      { id: uid(), label: "QTY:", field: "qty", align: "right", width: "15%" },
      { id: uid(), label: "UNIT:", field: "rate", align: "right", width: "15%" },
      { id: uid(), label: "AMOUNT", field: "amount", align: "right", width: "20%" }
    ]
  };

  const total = { ...mkC(0, 0), w: "100%", layout: "flex", flexDir: "column", alignItems: "flex-end", margin: "10px 0" };
  const line = { ...mkL(0, 0), w: 280, color: "#666", _flow: true };
  const t_txt = { ...mkT(0, 0), content: "TOTAL: 0.00", fontSize: 14, fontWeight: "700", _flow: true, align: "right", padding: 10 };
  total.children = [line.id, t_txt.id];

  const inw = { ...mkT(0, 0), w: "100%", content: "IN WORDS: KES Zero only.", fontSize: 11, italic: true, align: "right", margin: "10px 0" };

  const served = { ...mkT(0, 0), w: 320, content: "YOU WERE SERVED BY:\nADMINISTRATOR", fontSize: 11, fontWeight: "700", lineHeight: 1.4, margin: "40px 0 40px auto" };

  const dotted = { ...mkR(0, 0), w: 220, h: 100, fill: "transparent", stroke: "#aaa", strokeWidth: 1.5, borderRadius: 4, style: "dashed", margin: "20px 0" };

  const paid = { ...mkC(0, 0), w: 210, h: 84, fill: "rgba(71, 187, 120, 0.1)", stroke: "rgba(71, 187, 120, 0.3)", strokeWidth: 4, borderRadius: 8, layout: "flex", justifyContent: "center", alignItems: "center", margin: "20px 0 20px auto" };
  const paid_t = { ...mkT(0, 0), content: "PAID", fontSize: 48, fontWeight: "900", color: "rgba(71, 187, 120, 0.3)", _flow: true, letterSpacing: 4 };
  paid.children = [paid_t.id];

  const bottom = { ...mkT(0, 0), content: "ACCOUNTS ARE DUE ON DEMAND", fontSize: 12, fontWeight: "700", bg: "#99ccee", color: "#000", padding: "4px 20px", margin: "40px auto" };

  const nodes = Object.fromEntries([hdr, logo, rside, inv_t, co_t, ad_t, btr, bto, bt_hdr, bt_val, meta, r1, r1l, r1v, r2, r2l, r2v, r3, r3l, r3v, tbl, total, line, t_txt, inw, served, dotted, paid, paid_t, bottom].map(n => [n.id, n]));
  const roots = [hdr.id, btr.id, tbl.id, total.id, inw.id, served.id, dotted.id, paid.id, bottom.id];
  return { pages: [{ id: uid(), name: "Page 1", roots }], nodes };
}

// ── Error Guardian ────────────────────────────────────────────────────────────
class ErrorGuardian extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error("PF Crash:", error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, background: "#111111", color: "#ededed", height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}>
          <div style={{ border: "1px solid #333", padding: 24, borderRadius: 6, maxWidth: 600 }}>
            <h1 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>PrintForge crashed</h1>
            <p style={{ color: "#a8a8a8", fontSize: 13, lineHeight: 1.5, marginBottom: 16 }}>Reload to get back to the editor. The error was:</p>
            <pre style={{ background: "#000", padding: 12, borderRadius: 4, fontSize: 11, color: "#a8a8a8", overflowX: "auto", marginBottom: 16 }}>{this.state.error?.toString()}</pre>
            <button onClick={() => window.location.reload()} style={{ background: "#ededed", color: "#111", border: "none", padding: "8px 16px", borderRadius: 4, fontWeight: 600, cursor: "pointer" }}>Reload</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const TAGRIT_DOCTYPES = {
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

// ── New Design Modal ──────────────────────────────────────────────────────────
function NewDesignModal({ onCancel, onCreate }) {
  const [doctype, setDoctype] = useState("Sales Invoice");
  const [fields, setFields] = useState(TAGRIT_DOCTYPES.Selling[1].fields);
  const [activeCat, setActiveCat] = useState("Selling");
  const [nf, setNf] = useState({ name: "", label: "", isChild: false });

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 480, background: "var(--b1)", border: "1px solid var(--bd)", borderRadius: "var(--r6)", overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "90vh", boxShadow: "0 8px 24px rgba(0,0,0,.25)" }}>
        <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--bd)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--t0)" }}>New design</h2>
          <button onClick={onCancel} className="ib">×</button>
        </div>

        <div style={{ padding: 24, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
          <Sec title="Module">
            <div style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 8, scrollbarWidth: "none" }}>
              {Object.keys(TAGRIT_DOCTYPES).map(cat => (
                <button key={cat} onClick={() => setActiveCat(cat)} style={{ padding: "5px 10px", fontSize: 11, fontWeight: 500, borderRadius: "var(--r4)", whiteSpace: "nowrap", border: "1px solid " + (activeCat === cat ? "var(--ac)" : "var(--bd)"), background: activeCat === cat ? "var(--ad)" : "var(--b2)", color: activeCat === cat ? "var(--ac)" : "var(--t2)", cursor: "pointer" }}>
                  {cat}
                </button>
              ))}
              <button onClick={() => setActiveCat("Other")} style={{ padding: "5px 10px", fontSize: 11, fontWeight: 500, borderRadius: "var(--r4)", whiteSpace: "nowrap", border: "1px solid " + (activeCat === "Other" ? "var(--ac)" : "var(--bd)"), background: activeCat === "Other" ? "var(--ad)" : "var(--b2)", color: activeCat === "Other" ? "var(--ac)" : "var(--t2)", cursor: "pointer" }}>Other</button>
            </div>
          </Sec>

          <Sec title="Document">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
              {activeCat === "Other" ? (
                <button onClick={() => { setDoctype("Blank Document"); setFields([]); }} style={{ padding: "8px 4px", fontSize: 11, borderRadius: "var(--r4)", background: "var(--ad)", border: "1px solid var(--ac)", color: "var(--t0)", cursor: "pointer" }}>Blank document</button>
              ) : (
                TAGRIT_DOCTYPES[activeCat].map(p => (
                  <button key={p.label} onClick={() => { setDoctype(p.label); setFields(p.fields); }} style={{ padding: "8px 4px", fontSize: 11, borderRadius: "var(--r4)", background: doctype === p.label ? "var(--ad)" : "var(--b2)", border: "1px solid " + (doctype === p.label ? "var(--ac)" : "var(--bd)"), color: doctype === p.label ? "var(--t0)" : "var(--t1)", cursor: "pointer" }}>
                    {p.label}
                  </button>
                ))
              )}
            </div>
          </Sec>

          <Sec title={`Fields (${(fields || []).length})`}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12, maxHeight: 180, overflowY: "auto", paddingRight: 4 }}>
              {(fields || []).map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", background: "var(--b0)", border: "1px solid var(--bd)", borderRadius: "var(--r4)" }}>
                  <span style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--ac)", flex: 1 }}>{f.name}</span>
                  {f.isChild && <span style={{ fontSize: 8, background: "var(--ad)", color: "var(--ac)", padding: "1px 5px", borderRadius: 4 }}>child</span>}
                  <button onClick={() => setFields(fields.filter((_, j) => j !== i))} className="ib del" style={{ width: 20, height: 20, fontSize: 10 }}>×</button>
                </div>
              ))}
              {(fields || []).length === 0 && <div style={{ padding: 20, textAlign: "center", fontSize: 11, color: "var(--t2)", border: "1px dashed var(--bd)", borderRadius: "var(--r4)" }}>No fields yet</div>}
            </div>

            <div style={{ background: "var(--b2)", padding: 10, borderRadius: "var(--r4)", border: "1px solid var(--bd)" }}>
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                <input className="pi mono" value={nf.name} onChange={e => setNf({ ...nf, name: e.target.value })} placeholder="field_name" style={{ fontSize: 11 }} />
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "var(--t2)", whiteSpace: "nowrap", cursor: "pointer" }}>
                  <input type="checkbox" checked={nf.isChild} onChange={e => setNf({ ...nf, isChild: e.target.checked })} /> Child
                </label>
              </div>
              <button onClick={() => { if (!nf.name.trim()) return; setFields([...fields, { ...nf }]); setNf({ name: "", label: "", isChild: false }); }} style={{ width: "100%", padding: "6px", background: "var(--ad)", color: "var(--ac)", border: "1px solid var(--ac)", borderRadius: "var(--r4)", fontSize: 11, fontWeight: 500, cursor: "pointer" }}>Add field</button>
            </div>
          </Sec>
        </div>

        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--bd)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onCancel} style={{ padding: "7px 14px", background: "transparent", border: "1px solid var(--bm)", color: "var(--t1)", borderRadius: "var(--r4)", fontSize: 12, cursor: "pointer" }}>Cancel</button>
          <button onClick={() => onCreate(doctype, fields)} style={{ padding: "7px 14px", background: "var(--ac)", border: "1px solid var(--ac)", color: "#fff", borderRadius: "var(--r4)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Create {doctype}</button>
        </div>
      </div>
    </div>
  );
}

// ── Design History Modal ──────────────────────────────────────────────────────
function DesignHistoryModal({ onCancel, onLoad, onDelete, onLoadSite }) {
  const [items, setItems] = useState([]);
  const [site, setSite] = useState(FRAPPE ? "loading" : null); // null | "loading" | { error } | { list }
  useEffect(() => {
    const history = JSON.parse(localStorage.getItem("pf_history") || "[]");
    setItems(history);
    if (FRAPPE) frappeCall("list_designs").then(list => setSite({ list: list || [] }), e => setSite({ error: e.message }));
  }, []);
  const openSite = async (name) => {
    try {
      const d = await frappeCall("get_design", { print_format: name });
      onLoadSite(d.name, JSON.parse(d.design));
    } catch (e) {
      setSite(s => ({ ...s, error: e.message }));
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 540, background: "var(--b1)", border: "1px solid var(--bd)", borderRadius: "var(--r6)", overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "80vh", boxShadow: "0 8px 24px rgba(0,0,0,.25)" }}>
        <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--bd)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--t0)" }}>Saved designs</h2>
          <button onClick={onCancel} className="ib">×</button>
        </div>

        <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
          {site && <div style={{ marginBottom: 20 }}>
            <div className="sl">Print Formats on {FRAPPE.site}</div>
            {site === "loading" && <div style={{ fontSize: 12, color: "var(--t2)" }}>Loading</div>}
            {site.error && <div style={{ fontSize: 12, color: "var(--rd)", marginBottom: 6 }}>{site.error}</div>}
            {site.list && site.list.length === 0 && <div style={{ fontSize: 12, color: "var(--t2)" }}>None published yet. Use Publish in the toolbar.</div>}
            {site.list && <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {site.list.map(it => (
                <div key={it.name} onClick={() => openSite(it.name)} style={{ padding: "8px 12px", background: "var(--b0)", border: "1px solid var(--bd)", borderRadius: "var(--r4)", cursor: "pointer" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t0)" }}>{it.name}</div>
                  <div style={{ fontSize: 10, color: "var(--t2)", marginTop: 2 }}>{it.doc_type} · {it.modified}</div>
                </div>
              ))}
            </div>}
          </div>}
          {site && <div className="sl">This browser</div>}
          {items.length === 0 ? (
            <div style={{ padding: "32px 0", textAlign: "center", color: "var(--t2)", fontSize: 12 }}>Nothing saved yet. Use Save in the toolbar to keep a design here.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {items.map((it, i) => (
                <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", background: "var(--b0)", border: "1px solid var(--bd)", borderRadius: "var(--r4)" }}>
                  <div style={{ flex: 1, cursor: "pointer" }} onClick={() => onLoad(it)}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t0)" }}>{it.name}</div>
                    <div style={{ fontSize: 10, color: "var(--t2)", marginTop: 2 }}>{new Date(it.updatedAt).toLocaleString()} · {it.nodeCount} elements</div>
                  </div>
                  <button onClick={() => { if (confirm("Delete this design?")) onDelete(it.id); setItems(items.filter(x => x.id !== it.id)); }} className="ib del" style={{ padding: 8 }} title="Delete">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: "10px 20px", borderTop: "1px solid var(--bd)" }}>
          <p style={{ fontSize: 11, color: "var(--t2)" }}>Saved in this browser only. Export as JSON to keep a copy.</p>
        </div>
      </div>
    </div>
  );
}

// ── Publish Modal ─────────────────────────────────────────────────────────────
function PublishModal({ doctype, initialName, onCancel, onPublish }) {
  const [name, setName] = useState(initialName || doctype + " PrintForge");
  const [makeDefault, setMakeDefault] = useState(false);
  const [state, setState] = useState(null); // null | "busy" | { error } | { done }
  const submit = async () => {
    if (!name.trim()) return;
    setState("busy");
    try {
      setState({ done: await onPublish(name.trim(), makeDefault) });
    } catch (e) {
      setState({ error: e.message });
    }
  };
  const done = state?.done;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 420, background: "var(--b1)", border: "1px solid var(--bd)", borderRadius: "var(--r6)", overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,.25)" }}>
        <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--bd)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--t0)" }}>Publish as Print Format</h2>
          <button onClick={onCancel} className="ib">×</button>
        </div>
        {done ? (
          <div style={{ padding: 20, fontSize: 12, color: "var(--t1)", lineHeight: 1.6 }}>
            <p style={{ color: "var(--t0)", marginBottom: 6 }}>{done.created ? "Created" : "Updated"} “{done.name}” for {doctype}{done.is_default ? ", and set it as the default" : ""}.</p>
            <p>It is now in the Print Format list when printing a {doctype}. <a href={done.route} target="_blank" rel="noreferrer" style={{ color: "var(--ac)" }}>Open the Print Format</a></p>
          </div>
        ) : (
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
            <Txt label="Print Format name" value={name} onChange={setName} />
            <p style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.5 }}>For {doctype} on {FRAPPE.site}. Publishing under the name of a format made here before updates it.</p>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--t1)", cursor: "pointer" }}>
              <input type="checkbox" checked={makeDefault} onChange={e => setMakeDefault(e.target.checked)} style={{ accentColor: "var(--ac)" }} />Make this the default print format for {doctype}
            </label>
            {state?.error && <p style={{ fontSize: 12, color: "var(--rd)", lineHeight: 1.5 }}>{state.error}</p>}
          </div>
        )}
        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--bd)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onCancel} style={{ padding: "7px 14px", background: "transparent", border: "1px solid var(--bm)", color: "var(--t1)", borderRadius: "var(--r4)", fontSize: 12, cursor: "pointer" }}>{done ? "Close" : "Cancel"}</button>
          {!done && <button onClick={submit} disabled={state === "busy" || !name.trim()} style={{ padding: "7px 14px", background: "var(--ac)", border: "1px solid var(--ac)", color: "#fff", borderRadius: "var(--r4)", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: state === "busy" || !name.trim() ? .6 : 1 }}>{state === "busy" ? "Publishing" : "Publish"}</button>}
        </div>
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
function MainApp() {
  const [theme, setTheme] = useState(() => localStorage.getItem("pf_theme") || "dark");
  useEffect(() => { injectStyles(theme); localStorage.setItem("pf_theme", theme); }, [theme]);

  // Load persistence or default
  const savedState = useMemo(() => {
    try {
      const s = localStorage.getItem("pf_current");
      return s ? JSON.parse(s) : null;
    } catch (e) { return null; }
  }, []);

  const [tree, setTree] = useState(() => migrateTree(savedState?.tree || buildTree()));
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);

  const record = useCallback((nextTree) => {
    setPast(p => [...p.slice(-49), tree]);
    setFuture([]);
    setTree(nextTree);
  }, [tree]);

  const undo = useCallback(() => {
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    setFuture(f => [tree, ...f]);
    setPast(p => p.slice(0, -1));
    setTree(prev);
  }, [past, tree]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setPast(p => [...p, tree]);
    setFuture(f => f.slice(1));
    setTree(next);
  }, [future, tree]);
  const [activePageIdx, setActivePageIdx] = useState(0);
  const [sel, setSel] = useState(null);
  const [penMode, setPenMode] = useState(false); // false, 'drawing', 'editing'
  const [activePath, setActivePath] = useState(null); // { points: [], closed: false }
  const [doctype, setDoctype] = useState(savedState?.doctype || "Sales Invoice");
  const [activeGuides, setActiveGuides] = useState({ h: [], v: [] });
  const [docFields, setDocFields] = useState(savedState?.docFields || [
    { name: "name", label: "Invoice #" }, { name: "customer_name", label: "Customer" }, { name: "customer_address", label: "Address" },
    { name: "posting_date", label: "Date" }, { name: "due_date", label: "Due Date" }, { name: "currency", label: "Currency" },
    { name: "net_total", label: "Net Total" }, { name: "tax_amount", label: "Tax" }, { name: "grand_total", label: "Grand Total" },
    { name: "company", label: "Company" }, { name: "company_address", label: "Company Address" },
    { name: "items", label: "Items", isChild: true }, { name: "taxes", label: "Taxes", isChild: true },
  ]);
  const [assets, setAssets] = useState(savedState?.assets || []);
  // Name of the Print Format on the site this design was published to or opened from
  const [printFormat, setPrintFormat] = useState(savedState?.printFormat || "");
  const [showPublish, setShowPublish] = useState(false);

  // Auto-Save Effect
  useEffect(() => {
    const state = { tree, doctype, docFields, assets, printFormat };
    localStorage.setItem("pf_current", JSON.stringify(state));
  }, [tree, doctype, docFields, assets, printFormat]);

  const [zoom, setZoom] = useState(0.76);
  const [showCode, setShowCode] = useState(false);
  const [preview, setPreview] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const printRef = useRef(null);
  const [scrollPos, setScrollPos] = useState({ x: 0, y: 0 });
  const handleScroll = (e) => {
    setScrollPos({ x: e.currentTarget.scrollLeft, y: e.currentTarget.scrollTop });
  };
  const [showRulers, setShowRulers] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [gridSize, setGridSize] = useState(20);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMove = (e) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, []);

  const jinja = useMemo(() => toJinja(tree, doctype), [tree, doctype]);

  const handlePrint = useCallback(() => {
    setIsPrinting(true);
    setPreview(true);
    setShowExportMenu(false);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 100);
  }, []);

  const handleExportImage = useCallback(async (format) => {
    if (!printRef.current) return;
    setIsPrinting(true);
    setPreview(true);
    setShowExportMenu(false);

    // Allow UI to settle
    await new Promise(r => setTimeout(r, 150));

    try {
      const node = printRef.current;
      const options = {
        backgroundColor: '#ffffff',
        width: A4W,
        height: A4H,
        style: {
          transform: 'none',
          borderRadius: '0',
          boxShadow: 'none'
        }
      };

      let dataUrl;
      const fileName = `${doctype.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.${format}`;

      if (format === 'png') {
        dataUrl = await htmlToImage.toPng(node, options);
      } else {
        dataUrl = await htmlToImage.toJpeg(node, { ...options, quality: 0.95 });
      }

      const link = document.createElement('a');
      link.download = fileName;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsPrinting(false);
    }
  }, [doctype, printRef]);

  const [activePathPoints, setActivePathPoints] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [dragPointIdx, setDragPointIdx] = useState(-1);
  const [editPointIdx, setEditPointIdx] = useState(-1);
  const [selPointIdx, setSelPointIdx] = useState(-1);
  const [editHandle, setEditHandle] = useState(null); // 'p', 'c1', 'c2'

  const getCanvasCoords = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    return { x: Math.round(x), y: Math.round(y) };
  };

  const handlePenMouseDown = (e) => {
    if (penMode !== 'drawing') return;
    const raw = getCanvasCoords(e);
    const s = showGrid ? snap : (v => v);
    const pos = { x: s(raw.x), y: s(raw.y) };

    if (activePathPoints.length > 2) {
      const first = activePathPoints[0];
      const dist = Math.sqrt((pos.x - first.x) ** 2 + (pos.y - first.y) ** 2);
      if (dist < 10) {
        finishPath(true);
        return;
      }
    }

    const newPoint = { x: pos.x, y: pos.y, c1: { x: pos.x, y: pos.y }, c2: { x: pos.x, y: pos.y } };
    const newPoints = [...activePathPoints, newPoint];
    setActivePathPoints(newPoints);
    setDragPointIdx(newPoints.length - 1);
    setIsDrawing(true);
  };

  const handlePenMouseMove = (e) => {
    if (!isDrawing || dragPointIdx === -1) return;
    const pos = getCanvasCoords(e);
    const points = [...activePathPoints];
    const p = points[dragPointIdx];

    const dx = pos.x - p.x;
    const dy = pos.y - p.y;

    p.c2 = { x: pos.x, y: pos.y };
    p.c1 = { x: p.x - dx, y: p.y - dy };

    setActivePathPoints(points);
  };

  const handlePenMouseUp = () => {
    setIsDrawing(false);
    setDragPointIdx(-1);
    setEditPointIdx(-1);
    setEditHandle(null);
  };

  const finishPath = (closed = false) => {
    if (activePathPoints.length < 2) {
      setPenMode(false);
      setActivePathPoints([]);
      return;
    }

    const xs = activePathPoints.flatMap(p => [p.x, p.c1.x, p.c2.x]);
    const ys = activePathPoints.flatMap(p => [p.y, p.c1.y, p.c2.y]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);

    const w = Math.max(20, maxX - minX);
    const h = Math.max(20, maxY - minY);

    const normalizedPoints = activePathPoints.map(p => ({
      x: p.x - minX, y: p.y - minY,
      c1: { x: p.c1.x - minX, y: p.c1.y - minY },
      c2: { x: p.c2.x - minX, y: p.c2.y - minY }
    }));

    const el = mkPath(minX, minY, normalizedPoints);
    el.w = w; el.h = h; el.closed = closed;

    const newTree = treeAdd(tree, el, null, activePageIdx);
    record(newTree);
    setPenMode(false);
    setActivePathPoints([]);
    setSel(el.id);
  };
  // 'saving', 'saved', null

  const selEl = sel ? tree.nodes[sel] : null;
  // const jinja = useMemo(() => toJinja(tree, doctype), [tree, doctype]); // This line was duplicated, removed.

  const addEl = useCallback((type, ov = {}) => {
    try {
      const f = FACS[type] || mkT;
      const el = { ...f(60, 80), ...ov };
      record(treeAdd(tree, el, null, activePageIdx));
      setSel(el.id);
    } catch (e) {
      console.error("Critical error adding element:", e);
    }
  }, [activePageIdx, tree, record]);
  const addPage = useCallback(() => {
    record({ ...tree, pages: [...(tree.pages || []), { id: uid(), name: "Page " + ((tree.pages || []).length + 1), roots: [] }] });
  }, [tree, record]);

  const delPage = useCallback((idx) => {
    const ps = (tree.pages || []);
    if (ps.length <= 1) return;
    const pages = ps.filter((_, i) => i !== idx);
    record({ ...tree, pages });
    setActivePageIdx(Math.max(0, idx - 1));
  }, [tree, record]);

  const dupPage = useCallback((idx) => {
    const ps = (tree.pages || []);
    const page = ps[idx];
    if (!page) return;
    const newRoots = [];
    const newNodes = { ...tree.nodes };
    (page.roots || []).forEach(rid => {
      const [nid, nodes] = cloneTree(tree.nodes, rid);
      newRoots.push(nid);
      Object.assign(newNodes, nodes);
    });
    const newPage = { id: uid(), name: page.name + " (Copy)", roots: newRoots };
    const pages = [...tree.pages];
    pages.splice(idx + 1, 0, newPage);
    record({ ...tree, nodes: newNodes, pages });
    setActivePageIdx(idx + 1);
  }, [tree, record]);

  const addChild = useCallback((pid, type) => {
    try {
      if (!pid) return;
      const f = FACS[type] || mkT;
      const el = { ...f(0, 0), _flow: true };
      record(treeAdd(tree, el, pid));
      setSel(el.id);
    } catch (e) {
      console.error("Critical error adding child:", e);
    }
  }, [tree, record]);
  const updatePage = useCallback((idx, ch) => {
    const pages = [...tree.pages];
    pages[idx] = { ...pages[idx], ...ch };
    record({ ...tree, pages });
  }, [tree, record]);

  const updateEl = useCallback((id, ch, noRecord = false) => {
    const newTree = treeUpd(tree, id, ch);
    if (!noRecord) record(newTree);
    else setTree(newTree);
  }, [tree, record]);
  const deleteEl = useCallback(id => { record(treeRemove(tree, id)); setSel(null); }, [tree, record]);
  const dupEl = useCallback(id => {
    const pid = findParent(tree, id);
    const [nid, newNodes] = cloneTree(tree.nodes, id);
    const m = { ...tree.nodes, ...newNodes };
    if (pid) {
      const p = m[pid];
      record({ ...tree, nodes: { ...m, [pid]: { ...p, children: [...(p.children || []), nid] } } });
    } else {
      const page = tree.pages[activePageIdx];
      const idx = page.roots.indexOf(id);
      const r = [...page.roots];
      r.splice(idx + 1, 0, nid);
      const pages = [...tree.pages];
      pages[activePageIdx] = { ...page, roots: r };
      record({ ...tree, nodes: m, pages });
    }
    setSel(nid);
  }, [tree, record, activePageIdx]);

  const zOrder = useCallback((id, dir) => {
    const pid = findParent(tree, id);
    if (pid) {
      const p = tree.nodes[pid];
      const kids = [...(p.children || [])];
      const i = kids.indexOf(id);
      if (i < 0) return;
      if (dir === "up" && i < kids.length - 1) [kids[i], kids[i + 1]] = [kids[i + 1], kids[i]];
      if (dir === "down" && i > 0) [kids[i], kids[i - 1]] = [kids[i - 1], kids[i]];
      record({ ...tree, nodes: { ...tree.nodes, [pid]: { ...p, children: kids } } });
    } else {
      const page = tree.pages[activePageIdx];
      const r = [...(page.roots || [])];
      const i = r.indexOf(id);
      if (i < 0) return;
      if (dir === "up" && i < r.length - 1) [r[i], r[i + 1]] = [r[i + 1], r[i]];
      if (dir === "down" && i > 0) [r[i], r[i - 1]] = [r[i - 1], r[i]];
      const pages = [...tree.pages];
      pages[activePageIdx] = { ...page, roots: r };
      record({ ...tree, pages });
    }
  }, [tree, record, activePageIdx]);

  const handleDrop = useCallback((dragId, targetId) => {
    if (!dragId || !targetId || dragId === targetId) return;
    if (isDesc(tree.nodes, dragId, targetId)) return;
    record(treeMove(tree, dragId, targetId));
    setSel(dragId);
  }, [tree, record]);

  useEffect(() => {
    const h = e => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key.toLowerCase() === "z") {
        if (e.shiftKey) redo(); else undo();
        e.preventDefault(); return;
      }
      if (isMod && e.key.toLowerCase() === "y") {
        redo(); e.preventDefault(); return;
      }

      if (!sel) return;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
      const el = tree.nodes[sel]; if (!el) return;
      const s = e.shiftKey ? 8 : 1;
      if (e.key === "Delete" || e.key === "Backspace") {
        if (penMode === 'editing' && selPointIdx !== -1 && sel && tree.nodes[sel]) {
          const el = tree.nodes[sel];
          if (el.points && el.points.length > 2) {
            const pts = el.points.filter((_, i) => i !== selPointIdx);
            updateEl(sel, { points: pts });
            setSelPointIdx(-1);
            return;
          }
        }
        deleteEl(sel); return;
      }
      if (e.key === "ArrowLeft") { updateEl(sel, { x: (el.x || 0) - s }); e.preventDefault(); }
      if (e.key === "ArrowRight") { updateEl(sel, { x: (el.x || 0) + s }); e.preventDefault(); }
      if (e.key === "ArrowUp") { updateEl(sel, { y: (el.y || 0) - s }); e.preventDefault(); }
      if (e.key === "ArrowDown") { updateEl(sel, { y: (el.y || 0) + s }); e.preventDefault(); }
      if (isMod && e.key === "d") { dupEl(sel); e.preventDefault(); }
      if (e.key === "Escape") { const p = findParent(tree, sel); setSel(p || null); }
    };
    const mv = e => {
      if (penMode === 'editing' && editPointIdx !== -1 && sel && tree.nodes[sel]) {
        const el = tree.nodes[sel];
        const rect = document.querySelector('.pf-print-area').getBoundingClientRect();
        const px = (e.clientX - rect.left) / zoom;
        const py = (e.clientY - rect.top) / zoom;

        const pts = [...(el.points || [])];
        const p = pts[editPointIdx];
        if (!p) return;

        const dx = px - (editHandle === 'p' ? p.x : editHandle === 'c1' ? p.c1.x : p.c2.x);
        const dy = py - (editHandle === 'p' ? p.y : editHandle === 'c1' ? p.c1.y : p.c2.y);

        if (editHandle === 'p') {
          p.x += dx; p.y += dy;
          p.c1.x += dx; p.c1.y += dy;
          p.c2.x += dx; p.c2.y += dy;
        } else if (editHandle === 'c1') {
          p.c1.x += dx; p.c1.y += dy;
        } else if (editHandle === 'c2') {
          p.c2.x += dx; p.c2.y += dy;
        }
        updateEl(sel, { points: pts }, true);
      }
    };
    const mu = () => {
      if (penMode === 'editing' && editPointIdx !== -1) {
        record(tree);
      }
      setEditPointIdx(-1);
      // We keep selPointIdx for deletion
      setEditHandle(null);
    };

    window.addEventListener("keydown", h);
    window.addEventListener("mousemove", mv);
    window.addEventListener("mouseup", mu);
    return () => {
      window.removeEventListener("keydown", h);
      window.removeEventListener("mousemove", mv);
      window.removeEventListener("mouseup", mu);
    };
  }, [sel, tree, deleteEl, updateEl, dupEl, undo, redo, penMode, editPointIdx, editHandle, zoom]);

  const copy = () => { navigator.clipboard.writeText(jinja); setCopied(true); setTimeout(() => setCopied(false), 2200); };
  const newDesign = () => setShowNewModal(true);
  const handleCreateNew = (dt, fs) => {
    setDoctype(dt);
    setDocFields(fs);
    if (dt.includes("Sample Invoice")) {
      setTree(buildSampleInvoiceTree());
    } else {
      setTree({ nodes: {}, pages: [{ id: uid(), name: "Page 1", roots: [] }] });
    }
    setSel(null);
    setActivePageIdx(0);
    setPrintFormat("");
    setShowNewModal(false);
  };

  const publish = async (name, makeDefault) => {
    const pad = tree.pages[0]?.padding ?? 40;
    const res = await frappeCall("publish", {
      print_format: name,
      doctype,
      html: toPrintFormatHtml(tree),
      design: JSON.stringify({ version: "1.1", doctype, docFields, assets, tree }),
      make_default: makeDefault ? 1 : 0,
      margin_mm: Math.round(pad * 25.4 / 96 * 10) / 10
    });
    setPrintFormat(res.name);
    return res;
  };

  const loadSiteDesign = (name, data) => {
    setTree(migrateTree(data.tree));
    setDoctype(data.doctype);
    setDocFields(data.docFields || []);
    setAssets(data.assets || []);
    setPrintFormat(name);
    setSel(null);
    setActivePageIdx(0);
    setShowHistoryModal(false);
  };

  const saveDesign = useCallback(() => {
    setSaveStatus("saving");
    const history = JSON.parse(localStorage.getItem("pf_history") || "[]");
    const existingIdx = history.findIndex(h => h.name === doctype);
    const newEntry = {
      id: existingIdx >= 0 ? history[existingIdx].id : uid(),
      name: doctype,
      tree,
      docFields,
      updatedAt: Date.now(),
      nodeCount: Object.keys(tree.nodes).length
    };

    if (existingIdx >= 0) history[existingIdx] = newEntry;
    else history.unshift(newEntry);

    localStorage.setItem("pf_history", JSON.stringify(history));
    setTimeout(() => { setSaveStatus("saved"); setTimeout(() => setSaveStatus(null), 2000); }, 600);
  }, [tree, doctype, docFields]);

  const loadDesign = (entry) => {
    setTree(entry.tree);
    setDoctype(entry.name);
    setDocFields(entry.docFields);
    setPrintFormat("");
    setSel(null);
    setShowHistoryModal(false);
  };

  const deleteSaved = (id) => {
    const history = JSON.parse(localStorage.getItem("pf_history") || "[]");
    localStorage.setItem("pf_history", JSON.stringify(history.filter(h => h.id !== id)));
  };

  const downloadJinja = () => {
    const blob = new Blob([jinja], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doctype.toLowerCase().replace(/\s+/g, "_")}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJSON = () => {
    const data = {
      version: "1.1",
      doctype,
      docFields,
      assets,
      tree,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doctype.toLowerCase().replace(/\s+/g, "_")}_design.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (re) => {
      try {
        const data = JSON.parse(re.target.result);
        if (data.tree && data.doctype) {
          setTree(migrateTree(data.tree));
          setDoctype(data.doctype);
          if (data.docFields) setDocFields(data.docFields);
          if (data.assets) setAssets(data.assets);
          setSel(null);
          setSaveStatus("saved");
          setTimeout(() => setSaveStatus(null), 2000);
        } else {
          alert("Invalid design file format.");
        }
      } catch (err) {
        console.error("Import failed:", err);
        alert("Failed to parse design file.");
      }
    };
    reader.readAsText(file);
    e.target.value = ""; // Reset for next import
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", background: "var(--b0)", color: "var(--t0)" }}>
      <div id="pf-editor-ui" style={{ height: 44, background: "var(--b1)", borderBottom: "1px solid var(--bd)", display: "flex", alignItems: "center", paddingInline: 12, flexShrink: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 14 }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>PrintForge</span>
          <span style={{ fontSize: 11, color: "var(--t2)" }}>Tagrit ERP</span>
        </div>
        <div style={{ width: 1, height: 24, background: "var(--bd)", marginRight: 10 }} />
        <button className="tb" onClick={newDesign} style={{ marginRight: 10 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
          New
        </button>
        <button className="tb" onClick={() => setShowHistoryModal(true)} style={{ marginRight: 10 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          History
        </button>
        <button className="tb" onClick={() => document.getElementById('json-import').click()} style={{ marginRight: 10 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
          Import
          <input type="file" id="json-import" accept=".json" onChange={importJSON} style={{ display: "none" }} />
        </button>
        <div style={{ display: "flex", gap: 2, marginRight: 10 }}>
          <button className="ib" onClick={undo} disabled={past.length === 0} title="Undo (Ctrl+Z)" style={{ opacity: past.length === 0 ? .3 : 1, cursor: past.length === 0 ? "default" : "pointer" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 14 4 9l5-5" /><path d="M4 9h10a5 5 0 0 1 5 5v3" /></svg>
          </button>
          <button className="ib" onClick={redo} disabled={future.length === 0} title="Redo (Ctrl+Y)" style={{ opacity: future.length === 0 ? .3 : 1, cursor: future.length === 0 ? "default" : "pointer" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 14 5-5-5-5" /><path d="M20 9H10a5 5 0 0 0-5 5v3" /></svg>
          </button>
        </div>
        <div style={{ width: 1, height: 24, background: "var(--bd)", marginRight: 10 }} />
        <div style={{ display: "flex", gap: 1 }}>
          <button className={"tb" + (!preview && !showCode ? " on" : "")} onClick={() => { setPreview(false); setShowCode(false); }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
            Edit
          </button>
          <button className={"tb" + (preview ? " on" : "")} onClick={() => { setPreview(true); setShowCode(false); }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
            Preview
          </button>
          <button className={"tb" + (showCode ? " on" : "")} onClick={() => { setShowCode(true); setPreview(false); }} style={{ position: "relative" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
            Jinja
          </button>
        </div>
        <div style={{ flex: 1 }} />
        <button className="ib" onClick={() => setTheme(t => t === "dark" ? "light" : "dark")} style={{ marginRight: 8 }}>
          {theme === "dark" ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-11.314l.707.707m11.314 11.314l.707.707M12 8a4 4 0 100 8 4 4 0 000-8z" /></svg> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /></svg>}
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", background: "var(--b3)", borderRadius: "var(--r4)", border: "1px solid var(--bd)", marginRight: 8 }}>
          <button onClick={() => setZoom(z => Math.max(.25, +(z - .1).toFixed(2)))} style={{ background: "none", border: "none", color: "var(--t2)", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "0 2px" }}>−</button>
          <span style={{ fontSize: 11, color: "var(--t1)", minWidth: 34, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(2, +(z + .1).toFixed(2)))} style={{ background: "none", border: "none", color: "var(--t2)", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "0 2px" }}>+</button>
        </div>
        <div style={{ width: 1, height: 24, background: "var(--bd)", marginRight: 8 }} />
        <button className="tb" onClick={saveDesign} style={{ border: "1px solid var(--bd)", color: saveStatus === "saved" ? "var(--gn)" : undefined }}>
          {saveStatus === "saving" ? "Saving" : saveStatus === "saved" ? "Saved" : "Save"}
        </button>
        <div style={{ position: "relative" }}>
          <button className={"tb" + (showExportMenu ? " on" : "")} onClick={() => setShowExportMenu(!showExportMenu)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            Export
          </button>

          {showExportMenu && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, width: 140, background: "var(--b1)", border: "1px solid var(--bd)", borderRadius: "var(--r6)", boxShadow: "0 4px 12px rgba(0,0,0,.18)", zIndex: 1000, padding: 4 }} onMouseLeave={() => setShowExportMenu(false)}>
              <button className="tb" style={{ width: "100%", justifyContent: "flex-start", border: "none" }} onClick={handlePrint}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8 }}><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
                As PDF
              </button>
              <button className="tb" style={{ width: "100%", justifyContent: "flex-start", border: "none" }} onClick={() => handleExportImage('png')}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8 }}><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                As PNG
              </button>
              <button className="tb" style={{ width: "100%", justifyContent: "flex-start", border: "none" }} onClick={() => handleExportImage('jpg')}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8 }}><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                As JPG
              </button>
              <div style={{ height: 1, background: "var(--bd)", margin: "4px 0" }} />
              <button className="tb" style={{ width: "100%", justifyContent: "flex-start", border: "none" }} onClick={downloadJinja}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8 }}><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
                As Jinja (HTML)
              </button>
              <button className="tb" style={{ width: "100%", justifyContent: "flex-start", border: "none" }} onClick={exportJSON}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                As Design (JSON)
              </button>
            </div>
          )}
        </div>
        <div style={{ width: 1, height: 24, background: "var(--bd)", marginInline: 8 }} />
        {FRAPPE ? <>
          <button className="tb" onClick={copy} style={{ border: "1px solid var(--bd)", marginRight: 8, minWidth: 84, justifyContent: "center" }}>
            {copied ? "Copied" : "Copy Jinja"}
          </button>
          <button onClick={() => setShowPublish(true)} title={printFormat ? "Published as " + printFormat : "Publish as a Print Format on " + FRAPPE.site} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", border: "none", borderRadius: "var(--r4)", cursor: "pointer", fontSize: 12, fontWeight: 600, background: "var(--ac)", color: "#fff" }}>
            {printFormat ? "Update Print Format" : "Publish"}
          </button>
        </> : <button onClick={copy} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", border: "none", borderRadius: "var(--r4)", cursor: "pointer", fontSize: 12, fontWeight: 600, background: "var(--ac)", color: "#fff", minWidth: 84, justifyContent: "center" }}>
          {copied ? "Copied" : "Copy Jinja"}
        </button>}
      </div>
      <Breadcrumb tree={tree} selected={sel} onSelect={setSel} />
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {!preview && !showCode && <LeftPanel assets={assets} setAssets={setAssets} onAdd={addEl} onSetTrace={(src) => {
          updatePage(activePageIdx, { backgroundImg: src, bgOpacity: 0.3 });
          setSel(null); // Show page props
        }} onAddTemplate={(fn) => {
          const comps = fn();
          const root = comps[0];
          let updatedTree = treeAdd(tree, root, null, activePageIdx);
          for (let i = 1; i < comps.length; i++) {
            updatedTree.nodes[comps[i].id] = comps[i];
          }
          record(updatedTree);
          setSel(root.id);
        }} doctype={doctype} setDoctype={setDoctype} docFields={docFields} setDocFields={setDocFields} tree={tree} selected={sel} onSelect={setSel} penMode={penMode} setPenMode={setPenMode} />}

        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
          {!preview && !showCode && showRulers && <Ruler type="h" zoom={zoom} scrollPos={scrollPos.x} mousePos={mousePos} />}
          <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
            {!preview && !showCode && showRulers && <Ruler type="v" zoom={zoom} scrollPos={scrollPos.y} mousePos={mousePos} />}

            <div className="cv" onScroll={handleScroll} style={{ flex: 1, overflow: "auto", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 40, position: "relative" }} onClick={() => setSel(null)}>
              {showCode
                ? <div style={{ width: "100%", height: "100%", overflow: "auto" }}>
                  <pre style={{ fontFamily: "var(--mono)", fontSize: 12, lineHeight: 1.7, color: "var(--t0)", whiteSpace: "pre-wrap", padding: 4 }}>
                    {jinja.split("\n").map((line, i) => (
                      <div key={i} style={{ display: "flex" }}>
                        <span style={{ minWidth: 36, color: "var(--t2)", userSelect: "none", fontSize: 10, paddingTop: 1, textAlign: "right", paddingRight: 16 }}>{i + 1}</span>
                        <span style={{ color: line.startsWith("{%") ? "var(--gn)" : line.includes("{{") ? "var(--ac)" : line.startsWith("<") ? "var(--t1)" : "var(--t0)" }}>{line}</span>
                      </div>
                    ))}
                  </pre>
                </div>
                : <div style={{
                  position: "relative",
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 60,
                  padding: "100px 0 200px 0",
                  transform: isPrinting ? "none" : "scale(" + zoom + ")",
                  transformOrigin: "top center",
                  transition: "transform .15s"
                }}>
                  {!preview && !showCode && !isPrinting && showGrid && (
                    <div className="pf-grid" style={{
                      position: "absolute",
                      inset: "-3000px",
                      "--gc": "var(--bd)",
                      "--gs": gridSize + "px",
                      backgroundPosition: "calc(50% - 397px) 100px",
                      zIndex: -1
                    }} />
                  )}
                  {penMode === 'drawing' && (
                    <div
                      onMouseDown={handlePenMouseDown}
                      onMouseMove={handlePenMouseMove}
                      onMouseUp={handlePenMouseUp}
                      style={{ position: "absolute", inset: "-2000px", zIndex: 2000, cursor: "crosshair" }}
                    >
                      <svg style={{ width: "100%", height: "100%", overflow: "visible", pointerEvents: "none" }}>
                        <g transform="translate(2000, 2000)">
                          <path d={getPathData(activePathPoints)} fill="none" stroke="var(--ac)" strokeWidth="2" strokeDasharray="4 2" />
                          {activePathPoints.map((p, i) => (
                            <g key={i}>
                              <circle cx={p.x} cy={p.y} r="4" fill="var(--b1)" stroke="var(--ac)" strokeWidth="1.5" />
                              {isDrawing && dragPointIdx === i && (
                                <>
                                  <line x1={p.c1.x} y1={p.c1.y} x2={p.c2.x} y2={p.c2.y} stroke="var(--t2)" strokeWidth="1" strokeDasharray="2" />
                                  <circle cx={p.c1.x} cy={p.c1.y} r="3" fill="var(--ac)" opacity=".5" />
                                  <circle cx={p.c2.x} cy={p.c2.y} r="3" fill="var(--ac)" />
                                </>
                              )}
                            </g>
                          ))}
                        </g>
                      </svg>
                    </div>
                  )}
                  {tree.pages.map((page, pidx) => (
                    <div key={page.id} style={{ flexShrink: 0, position: "relative" }}>
                      {!isPrinting && <div style={{ fontSize: 10, color: "var(--t2)", marginBottom: 6, display: "flex", justifyContent: "space-between", paddingInline: 2 }}>
                        <span>A4 {A4W}x{A4H}px · {page.name}</span>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={(e) => { e.stopPropagation(); dupPage(pidx); }} style={{ background: "none", border: "none", color: "var(--t2)", cursor: "pointer", fontSize: 9 }}>Duplicate</button>
                          {tree.pages.length > 1 && <button onClick={(e) => { e.stopPropagation(); delPage(pidx); }} style={{ background: "none", border: "none", color: "var(--rd)", cursor: "pointer", fontSize: 9 }}>Delete</button>}
                        </div>
                      </div>}
                      <div
                        ref={pidx === 0 ? printRef : null}
                        className="pf-print-area"
                        onMouseDown={() => setActivePageIdx(pidx)}
                        style={{ position: "relative", width: A4W, minHeight: A4H, background: "#ffffff", boxShadow: isPrinting ? "none" : "0 0 0 1px rgba(0,0,0,.1),0 2px 8px rgba(0,0,0,.12)", padding: page.padding ?? 40, display: "flex", flexDirection: "column", outline: !preview && !showCode && activePageIdx === pidx ? "1px solid var(--ac)" : "none" }}
                        onClick={e => { if (e.target === e.currentTarget) setSel(null); }}>
                        {!preview && !showCode && !isPrinting && showGrid && (
                          <div className="pf-grid" style={{ "--gc": "rgba(0,0,0,.04)", "--gs": gridSize + "px" }} />
                        )}
                        {page?.backgroundImg && !isPrinting && (
                          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0, opacity: page.bgOpacity ?? 0.3 }}>
                            <img src={page.backgroundImg} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                          </div>
                        )}
                        {page.roots.map(id => <CNode key={id} nodeId={id} tree={tree} selected={sel} onSelect={setSel} onUpdate={updateEl} onDrop={handleDrop} zoom={zoom} depth={0} flow={true} preview={preview} onActive={() => setActivePageIdx(pidx)} pageIdx={pidx} onGuides={setActiveGuides} penMode={penMode} setPenMode={setPenMode} editPointIdx={editPointIdx} setEditPointIdx={setEditPointIdx} editHandle={editHandle} setEditHandle={setEditHandle} />)}
                        {activePageIdx === pidx && <SmartGuides guides={activeGuides} />}
                      </div>
                    </div>
                  ))}
                  {!preview && !showCode && !isPrinting && (
                    <button onClick={addPage} style={{ margin: "20px 0 60px 0", padding: "8px 16px", background: "transparent", border: "1px dashed var(--bh)", color: "var(--t1)", borderRadius: "var(--r4)", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
                      Add page
                    </button>
                  )}
                </div>}
            </div>
          </div>
        </div>

        {!showCode && !preview && <div style={{ width: 258, background: "var(--b1)", borderLeft: "1px solid var(--bd)", overflowY: "auto", flexShrink: 0 }}>
          <Props
            tree={tree} selected={sel} docFields={docFields} onUpdate={updateEl} onDelete={deleteEl} onDup={dupEl} onZOrder={zOrder} onAddChild={addChild}
            showRulers={showRulers} setShowRulers={setShowRulers} showGrid={showGrid} setShowGrid={setShowGrid} gridSize={gridSize} setGridSize={setGridSize}
            activePageIdx={activePageIdx} onUpdatePage={updatePage}
            penMode={penMode} setPenMode={setPenMode}
            selPointIdx={selPointIdx} setSelPointIdx={setSelPointIdx}
          />
        </div>}
      </div>
      <div style={{ height: 22, background: "var(--b0)", borderTop: "1px solid var(--bd)", display: "flex", alignItems: "center", paddingInline: 12, gap: 16, flexShrink: 0, fontSize: 10, color: "var(--t2)" }}>
        <span>{doctype}</span>
        <span>{Object.keys(tree.nodes).length} elements</span>
        <div style={{ flex: 1 }} />
        <span>A4 · wkhtmltopdf</span>
      </div>
      {showNewModal && <NewDesignModal onCancel={() => setShowNewModal(false)} onCreate={handleCreateNew} />}
      {showHistoryModal && <DesignHistoryModal onCancel={() => setShowHistoryModal(false)} onLoad={loadDesign} onDelete={deleteSaved} onLoadSite={loadSiteDesign} />}
      {showPublish && <PublishModal doctype={doctype} initialName={printFormat} onCancel={() => setShowPublish(false)} onPublish={publish} />}
    </div>
  );
}

export default function App() {
  return (
    <ErrorGuardian>
      <MainApp />
    </ErrorGuardian>
  );
}
// ── Components ───────────────────────────────────────────────────────────────
function Ruler({ type, zoom, scrollPos, mousePos }) {
  const isH = type === 'h';
  const len = isH ? 1200 : 1600; // Large enough to cover scroll
  const step = 100;
  const subticks = 10;

  const markers = [];
  for (let i = 0; i <= len; i += step / subticks) {
    const isMajor = i % step === 0;
    const pos = i * zoom;
    markers.push(
      <div key={i} className="pf-ruler-marker" style={{
        [isH ? 'left' : 'top']: pos,
        [isH ? 'width' : 'height']: 1,
        [isH ? 'height' : 'width']: isMajor ? 8 : 4,
        [isH ? 'bottom' : 'right']: 0
      }} />
    );
    if (isMajor) {
      markers.push(
        <div key={i + 'l'} className="pf-ruler-label" style={{
          [isH ? 'left' : 'top']: pos + 3,
          [isH ? 'bottom' : 'right']: 2
        }}>{i}</div>
      );
    }
  }

  return (
    <div className={`pf-ruler pf-ruler-${type}`} style={{ overflow: 'hidden' }}>
      <div style={{ position: 'relative', [isH ? 'width' : 'height']: len * zoom, [isH ? 'height' : 'width']: '100%', transform: `translate${isH ? 'X' : 'Y'}(${-scrollPos}px)` }}>
        {markers}
      </div>
    </div>
  );
}
