import { useState, useEffect } from 'react';
import { PAGE_SIZES, CUSTOM_PAPERS, FONTS, getSettings, marginMm } from '../exporter.js';
import { uid, dc, findParent, getDepth, isDesc, isFree, mkT, mkC, mkI } from '../tree.js';
import { BLOCKS } from '../templates.js';
import { FRAPPE, frappeCall } from '../frappe.js';
import { Num, Txt, RichTextEditor, Sel, CRow, Sec, Sdiv } from './atoms.jsx';

const QR_ICON = (n, sw) => <svg width={n} height={n} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw}><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><path d="M14 14h3v3h-3zM20 14v1M17 20h4M20 17v1" /></svg>;
const BARCODE_ICON = (n, sw) => <svg width={n} height={n} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw}><path d="M4 5v14M8 5v14M11 5v14M15 5v14M18 5v14M21 5v14" /></svg>;

// ── Field picker ──────────────────────────────────────────────────────────────
// Values that are not a field of the document itself
const READY_MADE = [
  { l: "Amount in words", v: '{{ frappe.utils.money_in_words(doc.grand_total, doc.currency) }}' },
  { l: "Today's date", v: '{{ frappe.utils.format_date(frappe.utils.nowdate()) }}' },
  { l: "Date and time printed", v: '{{ frappe.utils.format_datetime(frappe.utils.now_datetime()) }}' },
  { l: "Printed by", v: '{{ frappe.get_fullname() }}' },
  { l: "Company tax PIN", v: '{{ frappe.db.get_value("Company", doc.company, "tax_id") or "" }}' },
  { l: "Company phone", v: '{{ frappe.db.get_value("Company", doc.company, "phone_no") or "" }}' },
  { l: "Company email", v: '{{ frappe.db.get_value("Company", doc.company, "email") or "" }}' },
  { l: "Number of item rows", v: '{{ doc.items | length }}' },
];

export function FieldPicker({ docFields, onInsert, report }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  // Fields of linked doctypes, fetched from the site the first time one is opened
  const [linked, setLinked] = useState({});
  const needle = q.trim().toLowerCase();
  const match = (label, name) => !needle || (label || "").toLowerCase().includes(needle) || (name || "").toLowerCase().includes(needle);
  const canOpen = f => (f.isChild && (f.columns || []).length > 0) || (!!f.link && !!FRAPPE);
  const toggle = f => {
    setOpen(open === f.name ? null : f.name);
    if (f.link && FRAPPE && !linked[f.link]) {
      setLinked(l => ({ ...l, [f.link]: "loading" }));
      frappeCall("get_doctype_fields", { doctype: f.link }).then(
        fs => setLinked(l => ({ ...l, [f.link]: (fs || []).filter(x => !x.isChild) })),
        e => setLinked(l => ({ ...l, [f.link]: { error: e.message } })));
    }
  };
  const row = { display: "flex", alignItems: "center", width: "100%", padding: "4px 8px", border: "none", borderBottom: "1px solid var(--bd)", background: "transparent", color: "var(--t1)", cursor: "pointer", fontSize: 11, textAlign: "left", gap: 6 };
  const sub = { ...row, paddingLeft: 20, fontSize: 10, background: "var(--b2)" };
  const fields = docFields.filter(f => (report ? !f.isChild : true) && match(f.label, f.name));
  const ready = report ? [] : READY_MADE.filter(r => match(r.l, ""));
  return (
    <div style={{ marginBottom: 12 }}>
      <div className="sl">Insert a field</div>
      <input className="pi" value={q} onChange={e => setQ(e.target.value)} placeholder="Search fields" style={{ marginBottom: 4 }} />
      <div style={{ maxHeight: 190, overflowY: "auto", border: "1px solid var(--bd)", borderRadius: "var(--r4)", background: "var(--b0)" }}>
        {fields.map(f => (
          <div key={f.name}>
            <div style={{ display: "flex" }}>
              {f.isChild
                ? <button style={{ ...row, cursor: canOpen(f) ? "pointer" : "default" }} onClick={() => canOpen(f) && toggle(f)} title="A table: its columns go in a block repeated for each row">{f.label || f.name}<span style={{ marginLeft: "auto", fontSize: 8, color: "var(--ac)" }}>rows</span></button>
                : <button style={row} onClick={() => onInsert("{{ doc." + f.name + " }}")} title={"doc." + f.name}>{f.label || f.name}</button>}
              {canOpen(f) && !f.isChild && <button className="ib" style={{ width: 22, height: "auto", border: "none", borderBottom: "1px solid var(--bd)", borderRadius: 0 }} onClick={() => toggle(f)} title={"Fields of the linked " + f.link}>{open === f.name ? "▾" : "▸"}</button>}
            </div>
            {open === f.name && f.isChild && (f.columns || []).map(c => <button key={c.name} style={sub} onClick={() => onInsert("{{ item." + c.name + " }}")} title={"item." + c.name}>{c.label || c.name}</button>)}
            {open === f.name && f.link && (linked[f.link] === "loading" ? <div style={{ ...sub, cursor: "default" }}>Loading</div>
              : linked[f.link]?.error ? <div style={{ ...sub, cursor: "default", color: "var(--rd)" }}>{linked[f.link].error}</div>
                : (linked[f.link] || []).filter(x => x.name !== "name").map(x => <button key={x.name} style={sub} onClick={() => onInsert('{{ frappe.db.get_value("' + f.link + '", doc.' + f.name + ', "' + x.name + '") or "" }}')} title={f.link + " · " + x.name}>{x.label || x.name}</button>))}
          </div>
        ))}
        {ready.length > 0 && <div style={{ padding: "4px 8px", fontSize: 9, fontWeight: 600, color: "var(--t2)", background: "var(--b2)", borderBottom: "1px solid var(--bd)" }}>READY-MADE</div>}
        {ready.map(r => <button key={r.l} style={row} onClick={() => onInsert(r.v)} title={r.v}>{r.l}</button>)}
        {fields.length + ready.length === 0 && <div style={{ padding: 8, fontSize: 10, color: "var(--t2)" }}>Nothing matches.</div>}
      </div>
    </div>
  );
}

// ── Layer tree ────────────────────────────────────────────────────────────────
export function LayerTree({ tree, selected, multi = [], onSelect, onDrop, depth, ids }) {
  const [collapsed, setCollapsed] = useState({});
  const [dragOver, setDragOver] = useState(null);
  const canContain = type => ["container", "rect", "circle", "triangle"].includes(type);
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
    qr: QR_ICON(12, 2.5),
    barcode: BARCODE_ICON(12, 2.5),
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
            <LayerTree tree={tree} selected={selected} multi={multi} onSelect={onSelect} onDrop={onDrop} depth={1} ids={page.roots} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {ids.map(id => {
        const el = tree.nodes[id]; if (!el) return null;
        const isSel = selected === id || multi.includes(id);
        const hasKids = canContain(el.type) && (el.children || []).length > 0;
        const isDropTarget = dragOver === id && canContain(el.type);
        const isCollapsed = collapsed[id];
        const color = dc(depth);

        let label = el.type === "text"
          ? (el.content || "").replace(/\{\{.*?\}\}/g, "V").replace(/\n/g, " ").slice(0, 24)
          : el.type === "container" ? (el.label || "Group " + id.slice(-2))
            : el.type === "image" ? (el.label || `${el.w} × ${el.h}`)
              : el.type === "table" ? "Table (" + (el.columns || []).length + ")"
                : el.type === "qr" ? "QR code" : el.type === "barcode" ? "Barcode"
                : (el.type.charAt(0).toUpperCase() + el.type.slice(1));

        return (
          <div key={id}>
            <div className={"li" + (isSel ? " sel" : "")} onClick={e => onSelect(id, e)} style={{ paddingLeft: depth * 14 + 10, position: "relative", ...(isDropTarget ? { background: "var(--ad)", outline: "1px solid var(--ac)" } : {}) }}
              draggable={!!onDrop}
              onDragStart={e => { e.dataTransfer.setData("text/plain", id); e.dataTransfer.effectAllowed = "move"; e.stopPropagation(); }}
              onDragOver={e => { if (!onDrop || !canContain(el.type)) return; e.preventDefault(); e.stopPropagation(); setDragOver(id); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={e => {
                e.preventDefault(); e.stopPropagation(); setDragOver(null);
                if (!onDrop || !canContain(el.type)) return;
                const movedId = e.dataTransfer.getData("text/plain");
                if (movedId && movedId !== id && !isDesc(tree.nodes, movedId, id)) onDrop(movedId, id);
              }}>
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
            {hasKids && !isCollapsed && <LayerTree tree={tree} selected={selected} multi={multi} onSelect={onSelect} onDrop={onDrop} depth={depth + 1} ids={el.children} />}
          </div>
        );
      })}
    </div>
  );
}

// ── Breadcrumb ────────────────────────────────────────────────────────────────
export function Breadcrumb({ tree, selected, onSelect }) {
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
export function Props({ tree, selected, multi = [], onAlign, onDistribute, onDeleteMany, onDupMany, onCopy, docFields, onUpdate, onDelete, onDup, onZOrder, onAddChild, onUpdateSettings, showRulers, setShowRulers, showGrid, setShowGrid, gridSize, setGridSize, activePageIdx, onUpdatePage, penMode, setPenMode, selPointIdx, setSelPointIdx }) {
  const el = selected ? tree.nodes[selected] : null;
  const page = tree.pages[activePageIdx];
  const settings = getSettings(tree);
  const isRoot = selected ? (page.roots || []).includes(selected) : false;
  const u = (k, v) => onUpdate(selected, { [k]: v });
  const up = (k, v) => onUpdatePage(activePageIdx, { [k]: v });
  const pid = selected ? findParent(tree, selected) : null;
  const dep = selected ? getDepth(tree, selected) : 0;
  const TL = { text: "Text", container: "Container", image: "Image", rect: "Rectangle", circle: "Circle", triangle: "Triangle", line: "Line", table: "Table", path: "Path", qr: "QR code", barcode: "Barcode" };

  if (el && multi.length > 0) {
    const ids = [selected, ...multi];
    // Only freely placed elements in one container have positions that can be lined up
    const canAlign = ids.every(id => isFree(tree, id)) && new Set(ids.map(id => findParent(tree, id))).size === 1;
    const btn = (label, onClick, enabled = true) => <button key={label} className="bcb" disabled={!enabled} onClick={onClick} style={{ flex: 1, padding: "6px 4px", opacity: enabled ? 1 : .4 }}>{label}</button>;
    return (
      <div style={{ padding: "12px", overflowY: "auto", height: "100%" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--t0)", marginBottom: 12, paddingBottom: 10, borderBottom: "1px solid var(--bd)" }}>{ids.length} elements selected</div>
        <Sec title="Line up">
          <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>{[["Left", "left"], ["Centre", "hcenter"], ["Right", "right"]].map(([l, h]) => btn(l, () => onAlign(h), canAlign))}</div>
          <div style={{ display: "flex", gap: 4 }}>{[["Top", "top"], ["Middle", "vcenter"], ["Bottom", "bottom"]].map(([l, h]) => btn(l, () => onAlign(h), canAlign))}</div>
        </Sec>
        <Sec title="Space evenly">
          <div style={{ display: "flex", gap: 4 }}>{btn("Across", () => onDistribute("h"), canAlign && ids.length > 2)}{btn("Down", () => onDistribute("v"), canAlign && ids.length > 2)}</div>
        </Sec>
        {!canAlign && <p style={{ fontSize: 10, color: "var(--t2)", marginBottom: 12, lineHeight: 1.5 }}>Lining up needs elements placed freely inside the same container (Child Mode: Free). Elements in a flow layout are arranged by their container instead.</p>}
        <Sdiv />
        <Sec title="All selected">
          <div style={{ display: "flex", gap: 4 }}>{btn("Copy", onCopy)}{btn("Duplicate", onDupMany)}{btn("Delete", onDeleteMany)}</div>
        </Sec>
        <p style={{ fontSize: 10, color: "var(--t2)", lineHeight: 1.5 }}>Shift+click adds or removes an element. Ctrl+C and Ctrl+V copy and paste, also between designs.</p>
      </div>
    );
  }

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
          <Sel label="Paper" value={settings.pageSize} onChange={v => onUpdateSettings({ pageSize: v })} options={[...Object.keys(PAGE_SIZES), { v: "Custom", l: "Custom size" }]} />
          <Sel label="Orientation" value={settings.orientation} onChange={v => onUpdateSettings({ orientation: v })} options={["Portrait", "Landscape"]} />
        </div>
        {settings.pageSize === "Custom" && <div className="prow" style={{ marginBottom: 8 }}>
          <Num label="Width" value={settings.customW} onChange={v => onUpdateSettings({ customW: v })} unit="mm" min={10} />
          <Num label="Height" value={settings.customH} onChange={v => onUpdateSettings({ customH: v })} unit="mm" min={10} />
        </div>}
        <div className="pf" style={{ marginBottom: 12 }}>
          <label>Receipts and labels</label>
          <select className="ps" value="" onChange={e => { const c = CUSTOM_PAPERS[e.target.value]; if (c) onUpdateSettings({ pageSize: "Custom", orientation: "Portrait", customW: c.w, customH: c.h }, c.margin); }}>
            <option value="">— pick a size —</option>
            {CUSTOM_PAPERS.map((c, i) => <option key={c.label} value={i}>{c.label}</option>)}
          </select>
        </div>
        <div className="prow">
          <Num label="Margins" value={page?.padding ?? 40} onChange={v => up("padding", v)} unit="px" min={0} />
        </div>
        <p style={{ fontSize: 10, color: "var(--t2)", marginBottom: 12 }}>{marginMm(tree)} mm on every side of the printed page. The red lines on the page show roughly where each printed page ends.</p>
        <div className="prow" style={{ marginBottom: 12 }}>
          <Sel label="Font" value={settings.font || ""} onChange={v => onUpdateSettings({ font: v })} options={FONTS.map(f => ({ v: f, l: f ? f.split(",")[0].replace(/"/g, "") : "Site print font" }))} />
        </div>
        <label style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 11, color: "var(--t1)", marginBottom: 4, cursor: "pointer" }}>
          <input type="checkbox" checked={!!settings.letterHead} onChange={e => onUpdateSettings({ letterHead: e.target.checked })} style={{ accentColor: "var(--ac)", marginTop: 2 }} />Use the site's letter head and footer
        </label>
        <p style={{ fontSize: 10, color: "var(--t2)", marginBottom: 12 }}>{settings.letterHead ? "Added above and below this design when printing. Top and bottom margins then come from the site." : "Off: the design is printed exactly as drawn, and the Letter Head option in the print dialog has no effect."}</p>
        {settings.printFor !== "Report" && <label style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 11, color: "var(--t1)", marginBottom: 8, cursor: "pointer" }}>
          <input type="checkbox" checked={settings.statusHeading !== false} onChange={e => onUpdateSettings({ statusHeading: e.target.checked })} style={{ accentColor: "var(--ac)", marginTop: 2 }} />Print DRAFT / CANCELLED above unsubmitted documents
        </label>}
        {settings.printFor !== "Report" && <label style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 11, color: "var(--t1)", marginBottom: 12, cursor: "pointer" }}>
          <input type="checkbox" checked={!!settings.pageNumbers} onChange={e => onUpdateSettings({ pageNumbers: e.target.checked })} style={{ accentColor: "var(--ac)", marginTop: 2 }} />Page numbers at the bottom of every page
        </label>}
        {settings.printFor !== "Report" && <>
          <div className="prow" style={{ marginBottom: 4 }}>
            <Sel label="Watermark" value={settings.watermark || ""} onChange={v => onUpdateSettings({ watermark: v })} options={[{ v: "", l: "None" }, { v: "status", l: "DRAFT / CANCELLED by status" }, { v: "text", l: "Your own text" }]} />
          </div>
          {settings.watermark === "text" && <div className="prow" style={{ marginBottom: 4 }}><Txt value={settings.watermarkText || ""} onChange={v => onUpdateSettings({ watermarkText: v })} ph="COPY" /></div>}
          <p style={{ fontSize: 10, color: "var(--t2)", marginBottom: 12 }}>{settings.watermark === "status" ? "Printed faintly across every page of a draft or cancelled document, and not at all once it is submitted." : settings.watermark === "text" ? "Printed faintly across every page." : "Faint text across every page."}</p>
        </>}
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
          {[["Ctrl+Z", "Undo"], ["Ctrl+Y", "Redo"], ["Shift+click", "Select several"], ["Ctrl+C / X / V", "Copy, cut, paste"], ["Arrows", "Nudge 1px"], ["Shift+Arrows", "Nudge 8px"], ["Ctrl+D", "Duplicate"], ["Del", "Delete"], ["Esc", "Select parent"]].map(([k, v]) => (
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

      {isRoot && activePageIdx === 0 && settings.printFor !== "Report" && <>
        <Sel label="On every printed page" value={el.repeat || ""} onChange={v => u("repeat", v || undefined)} options={[{ v: "", l: "Print once, where it is" }, { v: "header", l: "Repeat as the page header" }, { v: "footer", l: "Repeat as the page footer" }]} />
        {el.repeat && <p style={{ fontSize: 10, color: "var(--t2)", margin: "4px 0 0" }}>Printed in the {el.repeat === "header" ? "top" : "bottom"} margin of every page, in place of the site's letter head {el.repeat}. The margin grows to fit it.</p>}
        <Sdiv />
      </>}
      <Txt label="Show only if" value={el.showIf || ""} onChange={v => u("showIf", v || undefined)} mono ph={settings.printFor === "Report" ? "filters.company" : "doc.discount_amount"} />
      <p style={{ fontSize: 10, color: "var(--t2)", margin: "4px 0 0" }}>{el.showIf ? "Printed only when this is set or true for the document." : "Leave empty to always print it."}</p>
      <Sdiv />
      {el.type === "container" && settings.printFor !== "Report" && <>
        <Txt label="Repeat for each row of" value={el.repeatFor || ""} onChange={v => u("repeatFor", v || undefined)} mono ph="items" list="pf-child-tables-rep" />
        <datalist id="pf-child-tables-rep">{docFields.filter(f => f.isChild).map(f => <option key={f.name} value={f.name}>{f.label}</option>)}</datalist>
        <p style={{ fontSize: 10, color: "var(--t2)", margin: "4px 0 0" }}>{el.repeatFor ? "Printed once per row. Inside it, use {{ item.field }} for that row's values." : "Leave empty to print it once. Used for labels and per-item blocks."}</p>
        {el.repeatFor && <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--t1)", marginTop: 6, cursor: "pointer" }}>
          <input type="checkbox" checked={!!el.breakAfter} onChange={e => u("breakAfter", e.target.checked || undefined)} style={{ accentColor: "var(--ac)" }} />Start a new page (or label) after each one
        </label>}
        <Sdiv />
      </>}
      {(el.type === "qr" || el.type === "barcode") && <>
        <Sec title="What it encodes">
          <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
            {[{ v: "expr", l: "A field" }, { v: "text", l: "Fixed text" }].map(o => (
              <button key={o.v} onClick={() => u("source", o.v)} style={{ flex: 1, padding: "6px 4px", border: "1px solid " + ((el.source || "expr") === o.v ? "var(--ac)" : "var(--bm)"), borderRadius: "var(--r4)", background: (el.source || "expr") === o.v ? "var(--ad)" : "var(--b3)", color: (el.source || "expr") === o.v ? "var(--ac)" : "var(--t1)", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>{o.l}</button>
            ))}
          </div>
          <Txt value={el.value || ""} onChange={v => u("value", v)} mono={el.source !== "text"} ph={el.source === "text" ? "https://example.com" : "doc.name"} list={el.source === "text" ? undefined : "pf-code-fields"} />
          <datalist id="pf-code-fields">{docFields.filter(f => !f.isChild).map(f => <option key={f.name} value={"doc." + f.name}>{f.label}</option>)}</datalist>
          <p style={{ fontSize: 10, color: "var(--t2)", margin: "4px 0 0", lineHeight: 1.5 }}>{el.source === "text" ? "The same on every document." : el.type === "qr" ? "A field of the document, such as the one holding its tax authority (eTIMS) link. Nothing is printed while it is empty." : "A field of the document. Inside a block repeated per row, use item.item_code. Nothing is printed while it is empty."}</p>
        </Sec>
        <Sdiv />
        {el.type === "barcode" && <Sec title="Barcode">
          <Sel label="Type" value={el.symbology || "code128"} onChange={v => u("symbology", v)} options={[{ v: "code128", l: "Code 128 (letters and numbers)" }, { v: "code39", l: "Code 39" }, { v: "ean13", l: "EAN-13 (12 or 13 digits)" }, { v: "ean8", l: "EAN-8 (7 or 8 digits)" }, { v: "upca", l: "UPC-A (11 or 12 digits)" }]} />
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--t1)", marginTop: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={el.showText !== false} onChange={e => u("showText", e.target.checked)} style={{ accentColor: "var(--ac)" }} />Print the value under the bars
          </label>
        </Sec>}
        <Sec title="Size"><div className="prow"><Num label="W" value={el.w} onChange={v => u("w", v)} unit="px" min={20} /><Num label="H" value={el.h} onChange={v => u("h", v)} unit="px" min={20} /></div>
          {el.type === "qr" && <p style={{ fontSize: 10, color: "var(--t2)", margin: "4px 0 0" }}>Printed square, at the smaller of the two. About 90 px (24 mm) or more scans reliably.</p>}
        </Sec>
      </>}
      {!el._flow && !isRoot && el.type !== "container" && el.type !== "qr" && el.type !== "barcode" && <><Sec title="Layout"><div className="prow"><Num label="X" value={el.x} onChange={v => u("x", v)} unit="px" /><Num label="Y" value={el.y} onChange={v => u("y", v)} unit="px" /></div><div className="prow"><Num label="W" value={el.w} onChange={v => u("w", v)} unit="px" /><Num label="H" value={el.h} onChange={v => u("h", v)} unit="px" /></div></Sec><Sdiv /></>}
      {isRoot && el.type !== "qr" && el.type !== "barcode" && <><Sec title="Layout"><div className="prow"><Num label="W" value={el.w} onChange={v => u("w", v)} unit="px" /><Num label="H" value={el.h} onChange={v => u("h", v)} unit="px" /></div></Sec><Sdiv /></>}

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
              {[["text", "Text"], ["container", "Container"], ["image", "Image"], ["table", "Table"], ["qr", "QR code"], ["barcode", "Barcode"], ["rect", "Rect"], ["circle", "Circle"], ["triangle", "Triangle"], ["line", "Line"]].map(([t, l]) => (
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
        <FieldPicker docFields={docFields} report={settings.printFor === "Report"} onInsert={v => u("content", (el.content || "") + (el.isRich ? " " + v + " " : v))} />
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
        {settings.printFor !== "Report" && <Sec title="Data Source">
          <Txt label="Child table" value={el.childField || ""} onChange={v => u("childField", v)} mono list="pf-child-tables" />
          <datalist id="pf-child-tables">{docFields.filter(f => f.isChild).map(f => <option key={f.name} value={f.name}>{f.label}</option>)}</datalist>
        </Sec>}
        <datalist id="pf-table-columns">{(settings.printFor === "Report" ? docFields.filter(f => !f.isChild) : (docFields.find(f => f.isChild && f.name === el.childField)?.columns || [])).map(f => <option key={f.name} value={f.name}>{f.label}</option>)}</datalist>
        <Sdiv />
        <Sec title="Columns">
          {(el.columns || []).map((col, i) => (
            <div key={col.id} style={{ marginBottom: 8, padding: 8, background: "var(--b3)", borderRadius: "var(--r6)", border: "1px solid var(--bd)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}><span style={{ fontSize: 10, color: "var(--t2)", fontWeight: 600 }}>Col {i + 1}</span><button className="ib del" onClick={() => u("columns", (el.columns || []).filter((_, j) => j !== i))} style={{ width: 20, height: 20, fontSize: 11 }}>×</button></div>
              <div className="prow"><Txt label="Label" value={col.label} onChange={v => { const c = [...(el.columns || [])]; c[i] = { ...col, label: v }; u("columns", c); }} /></div>
              <div className="prow"><Txt label="Field" value={col.field} onChange={v => { const c = [...(el.columns || [])]; c[i] = { ...col, field: v }; u("columns", c); }} mono list="pf-table-columns" /><Txt label="Width" value={col.width} onChange={v => { const c = [...(el.columns || [])]; c[i] = { ...col, width: v }; u("columns", c); }} /></div>
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
export const TOOLS = [
  { type: "text", label: "Text", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" /></svg> },
  { type: "container", label: "Container", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="18" rx="2" /><line x1="2" y1="9" x2="22" y2="9" /></svg> },
  { type: "table", label: "Table", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" /><line x1="9" y1="3" x2="9" y2="21" /></svg> },
  { type: "image", label: "Image", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg> },
  { type: "qr", label: "QR code", icon: QR_ICON(13, 2) },
  { type: "barcode", label: "Barcode", icon: BARCODE_ICON(13, 2) },
];

export const SHAPE_TOOLS = [
  { type: "rect", label: "Rect", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /></svg> },
  { type: "circle", label: "Circle", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /></svg> },
  { type: "triangle", label: "Triangle", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3L2 21H22L12 3Z" /></svg> },
  { type: "line", label: "Line", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="12" x2="20" y2="12" /></svg> },
  { type: "path", label: "Pen", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /></svg> },
];

export const COMPONENT_TEMPLATES = [
  {
    label: "Invoice Header",
    icon: "▣",
    create: (idx) => {
      const h = { ...mkC(0, 0), h: 100, flexDir: "row", justifyContent: "space-between", alignItems: "center", padding: "0 0 16px 0", mode: "flow", fill: "transparent", stroke: "transparent", strokeWidth: 0 };
      const logo = { ...mkI(0, 0), w: 100, h: 60, _flow: true };
      const info = { ...mkT(0, 0), content: "<strong>{{ doc.company }}</strong><br>{{ doc.company_address_display }}", fontSize: 11, _flow: true, align: "right" };
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
      const v2 = { ...mkT(0, 0), content: "{{ doc.grand_total }}", fontSize: 12, fontWeight: "700", _flow: true, align: "right" };
      r2.children = [l2.id, v2.id];
      c.children = [r1.id, r2.id];
      return [c, r1, l1, v1, r2, l2, v2];
    }
  }
];

// Bill-to and ship-to side by side
COMPONENT_TEMPLATES.push({
  label: "Address Row",
  icon: "⌂",
  create: () => {
    const plain = { fill: "transparent", stroke: "transparent", strokeWidth: 0, borderRadius: 0, padding: 0 };
    const text = (content, o = {}) => ({ ...mkT(0, 0), content, w: "100%", h: 16, fontSize: 11, color: "#111111", padding: 0, _flow: true, ...o });
    const side = (label, name, address) => {
      const box = { ...mkC(0, 0), ...plain, layout: "flex", flexDir: "column", flexWrap: "nowrap", gap: 2, w: "100%", h: 68, _flow: true };
      const parts = [text(label, { h: 14, fontSize: 9, color: "#666666" }), text(name, { h: 20, fontSize: 13, fontWeight: "600" }), text(address, { h: 30, color: "#333333" })];
      box.children = parts.map(p => p.id);
      return [box, ...parts];
    };
    const row = { ...mkC(0, 0), ...plain, w: "100%", h: 100, layout: "grid", gridCols: "1fr 1fr", colGap: 24, rowGap: 0, padding: "16px 0", mode: "flow" };
    const bill = side("Bill to", "{{ doc.customer_name }}", "{{ doc.address_display }}");
    const ship = side("Ship to", "{{ doc.shipping_address_name }}", "{{ doc.shipping_address }}");
    row.children = [bill[0].id, ship[0].id];
    return [row, ...bill, ...ship];
  }
});

export function LeftPanel({ onAdd, onAddTemplate, doctype, setDoctype, docFields, setDocFields, tree, selected, multi, onSelect, penMode, setPenMode, assets, setAssets, onSetTrace, onDrop, openTab }) {
  const [tab, setTab] = useState("insert");
  useEffect(() => { if (openTab?.tab) setTab(openTab.tab); }, [openTab]);
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
          <div className="sl" style={{ paddingInline: 4, marginBottom: 6 }}>Blocks</div>
          <div style={{ marginBottom: 12 }}>
            {[...COMPONENT_TEMPLATES, ...BLOCKS].map(t => (
              <button key={t.label} onClick={() => onAddTemplate(t.create)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px", marginBottom: 3, border: "1px solid var(--bd)", borderRadius: "var(--r4)", background: "var(--b2)", color: "var(--t1)", cursor: "pointer", fontSize: 11, transition: "all .12s" }} onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--ac)"; e.currentTarget.style.color = "var(--ac)"; }} onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--bd)"; e.currentTarget.style.color = "var(--t1)"; }}>
                <span style={{ fontSize: 13, color: "var(--t2)", width: 16, textAlign: "center", flexShrink: 0 }}>{t.icon}</span>{t.label}
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
          <p style={{ fontSize: 10, color: "var(--t2)", padding: "0 12px 6px" }}>Drag an element onto a container to move it inside.</p>
          <LayerTree tree={tree} selected={selected} multi={multi} onSelect={onSelect} onDrop={onDrop} depth={0} />
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
            {[{ label: "Sales Invoice", fields: [{ name: "name", label: "Invoice #" }, { name: "customer_name", label: "Customer" }, { name: "posting_date", label: "Date" }, { name: "due_date", label: "Due" }, { name: "currency", label: "Currency" }, { name: "net_total", label: "Net" }, { name: "tax_amount", label: "Tax" }, { name: "grand_total", label: "Total" }, { name: "company", label: "Company" }, { name: "company_address_display", label: "Company Address" }, { name: "items", isChild: true }, { name: "taxes", isChild: true }] }, { label: "Purchase Order", fields: [{ name: "name", label: "PO #" }, { name: "supplier_name", label: "Supplier" }, { name: "transaction_date", label: "Date" }, { name: "grand_total", label: "Total" }, { name: "company", label: "Company" }, { name: "items", isChild: true }] }].map(p => (
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
