import { useEffect, useMemo, useRef, useState } from 'react';
import { TEMPLATES } from '../tree.js';
import { GALLERY_TEMPLATES } from '../templates.js';
import { getErpSettings, saveErpSettings, testConnection, publishPrintFormat } from '../erpnext.js';
import { Txt } from './atoms.jsx';

const backdrop = { position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 };
const dialog = { width: "100%", background: "var(--b1)", border: "1px solid var(--bd)", borderRadius: "var(--r6)", overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "86vh", boxShadow: "0 8px 24px rgba(0,0,0,.25)" };
const dialogHead = { padding: "12px 20px", borderBottom: "1px solid var(--bd)", display: "flex", justifyContent: "space-between", alignItems: "center" };
const dialogFoot = { padding: "12px 20px", borderTop: "1px solid var(--bd)", display: "flex", justifyContent: "flex-end", gap: 8 };
const plainBtn = { padding: "7px 14px", background: "transparent", border: "1px solid var(--bm)", color: "var(--t1)", borderRadius: "var(--r4)", fontSize: 12, cursor: "pointer" };
const primaryBtn = { padding: "7px 14px", background: "var(--ac)", border: "1px solid var(--ac)", color: "#fff", borderRadius: "var(--r4)", fontSize: 12, fontWeight: 600, cursor: "pointer" };

// ── Template gallery ──────────────────────────────────────────────────────────
export function TemplateGallery({ onCancel, onSelect }) {
  return (
    <div style={backdrop}>
      <div style={{ ...dialog, maxWidth: 620 }}>
        <div style={dialogHead}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--t0)" }}>Start from a template</h2>
          <button onClick={onCancel} className="ib" aria-label="Close">×</button>
        </div>
        <div style={{ padding: 20, overflowY: "auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[...TEMPLATES, ...GALLERY_TEMPLATES].map(t => (
            <button key={t.id} onClick={() => onSelect(t)} style={{ textAlign: "left", padding: "12px 14px", background: "var(--b2)", border: "1px solid var(--bd)", borderRadius: "var(--r4)", cursor: "pointer", color: "var(--t1)" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--ac)"; }} onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--bd)"; }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--t0)" }}>{t.label}</span>
                {t.group && <span style={{ fontSize: 10, color: "var(--t2)" }}>{t.group}</span>}
              </div>
              <p style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.5, marginTop: 4 }}>{t.desc}</p>
            </button>
          ))}
        </div>
        <div style={{ padding: "10px 20px", borderTop: "1px solid var(--bd)" }}>
          <p style={{ fontSize: 11, color: "var(--t2)" }}>Choosing a template replaces the design on the canvas. Undo brings it back.</p>
        </div>
      </div>
    </div>
  );
}

// ── Command palette (Ctrl+K) ──────────────────────────────────────────────────
export function CommandPalette({ commands, onCancel }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef(null);
  useEffect(() => { input.current?.focus(); }, []);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return commands.filter(c => !q || (c.label + " " + (c.hint || "")).toLowerCase().includes(q));
  }, [commands, query]);
  const run = c => { if (!c) return; onCancel(); c.run(); };
  const onKey = e => {
    if (e.key === "Escape") { e.preventDefault(); onCancel(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => Math.min(shown.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(a => Math.max(0, a - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); run(shown[active]); }
  };
  return (
    <div style={{ ...backdrop, alignItems: "flex-start", paddingTop: "14vh" }} onMouseDown={onCancel}>
      <div style={{ ...dialog, maxWidth: 460 }} onMouseDown={e => e.stopPropagation()}>
        <input ref={input} className="pi" value={query} onChange={e => { setQuery(e.target.value); setActive(0); }} onKeyDown={onKey} placeholder="Type a command" aria-label="Command"
          style={{ border: "none", borderBottom: "1px solid var(--bd)", borderRadius: 0, padding: "12px 16px", fontSize: 13, background: "var(--b1)" }} />
        <div style={{ overflowY: "auto", padding: 4 }}>
          {shown.length === 0 && <div style={{ padding: "12px 12px", fontSize: 12, color: "var(--t2)" }}>No command matches “{query}”.</div>}
          {shown.map((c, i) => (
            <button key={c.id} onClick={() => run(c)} onMouseEnter={() => setActive(i)}
              style={{ display: "flex", alignItems: "baseline", gap: 10, width: "100%", padding: "8px 12px", border: "none", borderRadius: "var(--r4)", background: i === active ? "var(--ad)" : "transparent", color: "var(--t0)", cursor: "pointer", fontSize: 12, textAlign: "left" }}>
              <span style={{ flex: 1 }}>{c.label}</span>
              {c.hint && <span style={{ fontSize: 10, color: "var(--t2)" }}>{c.hint}</span>}
              {c.kbd && <span className="mono" style={{ fontSize: 10, color: "var(--t2)" }}>{c.kbd}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Right-click menu ──────────────────────────────────────────────────────────
export function ContextMenu({ x, y, items, onClose }) {
  // Keep the menu inside the window
  const height = items.reduce((a, it) => a + (it === "sep" ? 9 : 28), 0) + 10;
  const left = Math.max(4, Math.min(x, window.innerWidth - 200)), top = Math.max(4, Math.min(y, window.innerHeight - height - 4));
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 3000 }} onMouseDown={onClose} onContextMenu={e => { e.preventDefault(); onClose(); }}>
      <div role="menu" onMouseDown={e => e.stopPropagation()} style={{ position: "fixed", left, top, minWidth: 184, background: "var(--b1)", border: "1px solid var(--bd)", borderRadius: "var(--r6)", boxShadow: "0 4px 12px rgba(0,0,0,.18)", padding: 4 }}>
        {items.map((it, i) => it === "sep"
          ? <div key={i} style={{ height: 1, background: "var(--bd)", margin: "4px 0" }} />
          : (
            <button key={it.id} role="menuitem" className="tb" disabled={it.disabled} style={{ width: "100%", justifyContent: "flex-start", gap: 8, opacity: it.disabled ? .4 : 1 }} onClick={() => { onClose(); it.run(); }}>
              <span>{it.label}</span>
              {it.kbd && <span className="mono" style={{ marginLeft: "auto", fontSize: 10, color: "var(--t2)" }}>{it.kbd}</span>}
            </button>
          ))}
      </div>
    </div>
  );
}

// ── Transient messages ────────────────────────────────────────────────────────
export function UndoSnackbar({ message, onUndo, onDismiss }) {
  useEffect(() => { const t = setTimeout(onDismiss, 6000); return () => clearTimeout(t); }, [message, onDismiss]);
  return (
    <div role="status" style={{ position: "fixed", bottom: 36, left: "50%", transform: "translateX(-50%)", zIndex: 1500, display: "flex", alignItems: "center", gap: 12, padding: "8px 8px 8px 14px", background: "var(--b3)", border: "1px solid var(--bm)", borderRadius: "var(--r6)", boxShadow: "0 4px 12px rgba(0,0,0,.18)", fontSize: 12, color: "var(--t0)" }}>
      <span>{message}</span>
      <button className="bcb" onClick={onUndo}>Undo</button>
      <button className="ib" onClick={onDismiss} aria-label="Dismiss" style={{ border: "none" }}>×</button>
    </div>
  );
}

export function Toast({ toast, onDismiss }) {
  const error = toast.type === "error";
  return (
    <div role={error ? "alert" : "status"} style={{ position: "fixed", bottom: 36, left: "50%", transform: "translateX(-50%)", zIndex: 2000, display: "flex", alignItems: "flex-start", gap: 12, maxWidth: 460, padding: "10px 10px 10px 14px", background: "var(--b1)", border: "1px solid " + (error ? "var(--rd)" : "var(--bm)"), borderRadius: "var(--r6)", boxShadow: "0 4px 12px rgba(0,0,0,.18)" }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 12, color: error ? "var(--rd)" : "var(--t0)" }}>{toast.title}</div>
        {toast.body && <div style={{ fontSize: 11, color: "var(--t1)", marginTop: 3, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{toast.body}</div>}
      </div>
      <button className="ib" onClick={onDismiss} aria-label="Dismiss" style={{ border: "none" }}>×</button>
    </div>
  );
}

// Shown once to someone new to the editor
export function Tips({ onDismiss }) {
  const tips = [["Ctrl+K", "Search commands and settings"], ["Right-click", "An element or the page, for quick actions"], ["V", "Move tool: drag any element to a free position"]];
  return (
    <div style={{ position: "fixed", bottom: 36, right: 16, width: 280, zIndex: 100, background: "var(--b1)", border: "1px solid var(--bd)", borderRadius: "var(--r6)", boxShadow: "0 4px 12px rgba(0,0,0,.18)", padding: "10px 12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span className="sl" style={{ margin: 0 }}>Worth knowing</span>
        <button className="ib" onClick={onDismiss} aria-label="Dismiss tips" style={{ border: "none" }}>×</button>
      </div>
      {tips.map(([k, v]) => (
        <div key={k} style={{ display: "flex", gap: 8, alignItems: "baseline", marginBottom: 4 }}>
          <span className="mono" style={{ fontSize: 10, padding: "1px 5px", background: "var(--b4)", border: "1px solid var(--bm)", borderRadius: 3, color: "var(--t1)", whiteSpace: "nowrap" }}>{k}</span>
          <span style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.4 }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

// An empty page offers somewhere to start
export function EmptyState({ onGallery }) {
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 160, textAlign: "center", color: "#555555", fontFamily: "var(--sans)" }} onMouseDown={e => e.stopPropagation()}>
      <div style={{ fontSize: 14, fontWeight: 600, color: "#111111", marginBottom: 6 }}>This page is empty</div>
      <p style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 14 }}>Add elements from the Insert panel, or start from a ready-made layout.</p>
      <button onClick={onGallery} style={{ padding: "7px 14px", background: "#1f6feb", border: "none", color: "#fff", borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Browse templates</button>
    </div>
  );
}

// ── Checks before publishing ──────────────────────────────────────────────────
export function IssueList({ issues }) {
  const errors = issues.filter(i => i.severity === "error"), warnings = issues.filter(i => i.severity === "warning");
  if (!issues.length) return <p style={{ fontSize: 11, color: "var(--gn)" }}>Checked against the field list: nothing to fix.</p>;
  const list = (items, color, title) => items.length > 0 && (
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color, marginBottom: 2 }}>{title}</div>
      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: "var(--t1)", lineHeight: 1.5 }}>{items.map((i, k) => <li key={k}>{i.message}</li>)}</ul>
    </div>
  );
  return (
    <div style={{ maxHeight: 150, overflowY: "auto" }}>
      {list(errors, "var(--rd)", errors.length === 1 ? "1 problem to fix before publishing" : errors.length + " problems to fix before publishing")}
      {list(warnings, "var(--t0)", warnings.length === 1 ? "1 thing to check" : warnings.length + " things to check")}
    </div>
  );
}

// ── Publishing without a Frappe session ───────────────────────────────────────
// Used by the standalone builder. Talks to the site's REST API with an API key.
export function StandalonePublishModal({ doctype, isReport, html, marginMm, issues, onClose }) {
  const [settings, setSettings] = useState(getErpSettings);
  const [name, setName] = useState(doctype + " PrintForge");
  const [conn, setConn] = useState({ status: "idle", message: "" });
  const [pub, setPub] = useState({ status: "idle", message: "" });
  const upd = ch => { const next = { ...settings, ...ch }; setSettings(next); saveErpSettings(next); setConn({ status: "idle", message: "" }); };
  const test = async () => { setConn({ status: "testing", message: "Connecting" }); const r = await testConnection(settings); setConn({ status: r.ok ? "ok" : "fail", message: r.message }); };
  const blocked = issues.some(i => i.severity === "error");
  const canPublish = !blocked && conn.status === "ok" && pub.status !== "publishing" && name.trim();
  const publish = async () => {
    setPub({ status: "publishing", message: "" });
    const r = await publishPrintFormat(settings, name.trim(), doctype, html, { report: isReport, marginMm });
    setPub({ status: r.ok ? "ok" : "fail", message: r.message, link: r.link });
  };
  return (
    <div style={backdrop}>
      <div style={{ ...dialog, maxWidth: 460 }}>
        <div style={dialogHead}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--t0)" }}>Publish to an ERPNext site</h2>
          <button onClick={onClose} className="ib" aria-label="Close">×</button>
        </div>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10, overflowY: "auto" }}>
          <Txt label="Site URL" value={settings.url} onChange={v => upd({ url: v })} ph="https://erp.example.com" />
          <div className="prow" style={{ margin: 0 }}>
            <Txt label="API key" value={settings.apiKey} onChange={v => upd({ apiKey: v })} mono />
            <div className="pf"><label>API secret</label><input className="pi mono" type="password" value={settings.apiSecret} onChange={e => upd({ apiSecret: e.target.value })} /></div>
          </div>
          <p style={{ fontSize: 10, color: "var(--t2)", lineHeight: 1.5 }}>The key and secret are kept in this browser. The site must allow this page's origin (allow_cors). Publishing this way stores only the printable format; to reopen the design later, keep it with Save or Export as JSON.</p>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="bcb" onClick={test} disabled={!settings.url || conn.status === "testing"}>{conn.status === "testing" ? "Connecting" : "Test connection"}</button>
            {conn.message && conn.status !== "testing" && <span style={{ fontSize: 11, color: conn.status === "ok" ? "var(--gn)" : "var(--rd)", lineHeight: 1.4 }}>{conn.message}</span>}
          </div>
          <Txt label="Print Format name" value={name} onChange={setName} />
          <p style={{ fontSize: 11, color: "var(--t2)" }}>For {isReport ? "the " + doctype + " report" : doctype}. An existing format with this name is updated.</p>
          <IssueList issues={issues} />
          {pub.message && <p style={{ fontSize: 12, color: pub.status === "ok" ? "var(--gn)" : "var(--rd)", lineHeight: 1.5 }}>{pub.message}{pub.link && <> <a href={pub.link} target="_blank" rel="noreferrer" style={{ color: "var(--ac)" }}>Open the Print Format</a></>}</p>}
        </div>
        <div style={dialogFoot}>
          <button onClick={onClose} style={plainBtn}>{pub.status === "ok" ? "Close" : "Cancel"}</button>
          <button onClick={publish} disabled={!canPublish} style={{ ...primaryBtn, opacity: canPublish ? 1 : .5 }} title={blocked ? "Fix the problems listed first" : conn.status !== "ok" ? "Test the connection first" : ""}>{pub.status === "publishing" ? "Publishing" : "Publish"}</button>
        </div>
      </div>
    </div>
  );
}
