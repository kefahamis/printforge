import React, { useState, useEffect } from 'react';
import { FRAPPE, frappeCall } from '../frappe.js';
import { PRESET_DOCTYPES } from '../doctypes.js';
import { DOC_TEMPLATES } from '../templates.js';
import { Txt, Sec } from './atoms.jsx';

// ── Error Guardian ────────────────────────────────────────────────────────────
export class ErrorGuardian extends React.Component {
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

// ── New Design Modal ──────────────────────────────────────────────────────────
export function NewDesignModal({ onCancel, onCreate }) {
  const [doctype, setDoctype] = useState("Sales Invoice");
  const [fields, setFields] = useState(PRESET_DOCTYPES.Selling[1].fields);
  const [activeCat, setActiveCat] = useState("Selling");
  const [nf, setNf] = useState({ name: "", label: "", isChild: false });
  // On a site, any doctype can be picked and its real fields loaded
  const [siteDoctypes, setSiteDoctypes] = useState([]);
  const [siteDt, setSiteDt] = useState("");
  const [siteMsg, setSiteMsg] = useState("");
  useEffect(() => { if (FRAPPE) frappeCall("list_doctypes").then(l => setSiteDoctypes(l || []), () => { }); }, []);
  const pickSiteDoctype = async () => {
    if (!siteDt.trim()) return;
    setSiteMsg("Loading");
    try {
      const f = await frappeCall("get_doctype_fields", { doctype: siteDt.trim() });
      setDoctype(siteDt.trim()); setFields(f); setPrintFor("DocType"); setSiteMsg("");
    } catch (e) {
      setSiteMsg(e.message);
    }
  };
  // ...or a report, whose print formats are laid out the same way but filled with its rows
  const [printFor, setPrintFor] = useState("DocType");
  const [siteReports, setSiteReports] = useState([]);
  const [siteRp, setSiteRp] = useState("");
  const [reportMsg, setReportMsg] = useState("");
  useEffect(() => { if (FRAPPE) frappeCall("list_reports").then(l => setSiteReports(l || []), () => { }); }, []);
  const pickSiteReport = async () => {
    if (!siteRp.trim()) return;
    setReportMsg("Loading");
    try {
      const f = await frappeCall("get_report_columns", { report: siteRp.trim() });
      setDoctype(siteRp.trim()); setFields(f); setPrintFor("Report");
      setReportMsg(f.length ? "" : "This report needs filters before it lists its columns. Add the column names below, as they appear in the report.");
    } catch (e) {
      setReportMsg(e.message);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 520, background: "var(--b1)", border: "1px solid var(--bd)", borderRadius: "var(--r6)", overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "90vh", boxShadow: "0 8px 24px rgba(0,0,0,.25)" }}>
        <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--bd)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--t0)" }}>New design</h2>
          <button onClick={onCancel} className="ib">×</button>
        </div>

        <div style={{ padding: 24, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
          <Sec title="Ready-made design">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
              {DOC_TEMPLATES.map(t => (
                <button key={t.id} onClick={() => onCreate(t.doctype, [], "DocType", t.id)} title={"For " + t.doctype} style={{ padding: "8px 8px", borderRadius: "var(--r4)", background: "var(--b2)", border: "1px solid var(--bd)", color: "var(--t0)", cursor: "pointer", textAlign: "left" }} onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--ac)"; }} onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--bd)"; }}>
                  <div style={{ fontSize: 11, fontWeight: 600 }}>{t.label}</div>
                  <div style={{ fontSize: 9, color: "var(--t2)", marginTop: 2, lineHeight: 1.4 }}>{t.note}</div>
                </button>
              ))}
            </div>
            <p style={{ fontSize: 10, color: "var(--t2)", marginTop: 6 }}>Opens straight away, ready to adjust. Or build your own below.</p>
          </Sec>
          {FRAPPE && <Sec title={"Doctype on " + FRAPPE.site}>
            <div style={{ display: "flex", gap: 6 }}>
              <input className="pi" list="pf-site-doctypes" value={siteDt} onChange={e => setSiteDt(e.target.value)} onKeyDown={e => { if (e.key === "Enter") pickSiteDoctype(); }} placeholder="e.g. Sales Invoice" style={{ fontSize: 12 }} />
              <datalist id="pf-site-doctypes">{siteDoctypes.map(n => <option key={n} value={n} />)}</datalist>
              <button className="bcb" onClick={pickSiteDoctype} disabled={!siteDt.trim()}>Load fields</button>
            </div>
            {siteMsg && <p style={{ fontSize: 11, color: siteMsg === "Loading" ? "var(--t2)" : "var(--rd)", marginTop: 4 }}>{siteMsg}</p>}
          </Sec>}
          {FRAPPE && <Sec title={"Or a report on " + FRAPPE.site}>
            <div style={{ display: "flex", gap: 6 }}>
              <input className="pi" list="pf-site-reports" value={siteRp} onChange={e => setSiteRp(e.target.value)} onKeyDown={e => { if (e.key === "Enter") pickSiteReport(); }} placeholder="e.g. General Ledger" style={{ fontSize: 12 }} />
              <datalist id="pf-site-reports">{siteReports.map(n => <option key={n} value={n} />)}</datalist>
              <button className="bcb" onClick={pickSiteReport} disabled={!siteRp.trim()}>Load columns</button>
            </div>
            {reportMsg && <p style={{ fontSize: 11, color: "var(--t2)", marginTop: 4 }}>{reportMsg}</p>}
          </Sec>}
          <Sec title={FRAPPE ? "Or start from a preset" : "Module"}>
            <div style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 8, scrollbarWidth: "none" }}>
              {Object.keys(PRESET_DOCTYPES).map(cat => (
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
                <button onClick={() => { setDoctype("Blank Document"); setFields([]); setPrintFor("DocType"); }} style={{ padding: "8px 4px", fontSize: 11, borderRadius: "var(--r4)", background: "var(--ad)", border: "1px solid var(--ac)", color: "var(--t0)", cursor: "pointer" }}>Blank document</button>
              ) : (
                PRESET_DOCTYPES[activeCat].map(p => (
                  <button key={p.label} onClick={() => { setDoctype(p.label); setFields(p.fields); setPrintFor("DocType"); }} style={{ padding: "8px 4px", fontSize: 11, borderRadius: "var(--r4)", background: doctype === p.label ? "var(--ad)" : "var(--b2)", border: "1px solid " + (doctype === p.label ? "var(--ac)" : "var(--bd)"), color: doctype === p.label ? "var(--t0)" : "var(--t1)", cursor: "pointer" }}>
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
          <button onClick={() => onCreate(doctype, fields, printFor)} style={{ padding: "7px 14px", background: "var(--ac)", border: "1px solid var(--ac)", color: "#fff", borderRadius: "var(--r4)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Create {doctype}{printFor === "Report" ? " report format" : ""}</button>
        </div>
      </div>
    </div>
  );
}

// ── Design History Modal ──────────────────────────────────────────────────────
export function DesignHistoryModal({ onCancel, onLoad, onDelete, onLoadSite }) {
  const [items, setItems] = useState([]);
  const [site, setSite] = useState(FRAPPE ? "loading" : null); // null | "loading" | { error } | { list }
  useEffect(() => {
    const history = JSON.parse(localStorage.getItem("pf_history") || "[]");
    setItems(history);
    if (FRAPPE) frappeCall("list_designs").then(list => setSite({ list: list || [] }), e => setSite({ error: e.message }));
  }, []);
  // Earlier published versions of one format: { [format]: "loading" | { error } | { modified, versions } }
  const [versions, setVersions] = useState({});
  const toggleVersions = async (name) => {
    if (versions[name]) { setVersions(v => ({ ...v, [name]: undefined })); return; }
    setVersions(v => ({ ...v, [name]: "loading" }));
    try {
      const r = await frappeCall("list_versions", { print_format: name });
      setVersions(v => ({ ...v, [name]: r }));
    } catch (e) {
      setVersions(v => ({ ...v, [name]: { error: e.message } }));
    }
  };
  // Opens the older design as the working copy of the format; publishing it is what restores it
  const openVersion = async (name, version, modified) => {
    try {
      const d = await frappeCall("get_version", { version });
      onLoadSite(name, JSON.parse(d.design), modified);
    } catch (e) {
      setSite(s => ({ ...s, error: e.message }));
    }
  };
  const openSite = async (name) => {
    try {
      const d = await frappeCall("get_design", { print_format: name });
      onLoadSite(d.name, JSON.parse(d.design), d.modified);
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
                <div key={it.name} style={{ background: "var(--b0)", border: "1px solid var(--bd)", borderRadius: "var(--r4)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px" }}>
                    <div onClick={() => openSite(it.name)} style={{ flex: 1, cursor: "pointer" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t0)" }}>{it.name}</div>
                      <div style={{ fontSize: 10, color: "var(--t2)", marginTop: 2 }}>{it.doc_type || (it.report ? it.report + " (report)" : "")} · {it.modified}</div>
                    </div>
                    <button className={"bcb" + (versions[it.name] ? " on" : "")} onClick={() => toggleVersions(it.name)}>Earlier versions</button>
                  </div>
                  {versions[it.name] && <div style={{ borderTop: "1px solid var(--bd)", padding: "6px 12px 8px" }}>
                    {versions[it.name] === "loading" && <div style={{ fontSize: 11, color: "var(--t2)" }}>Loading</div>}
                    {versions[it.name].error && <div style={{ fontSize: 11, color: "var(--rd)" }}>{versions[it.name].error}</div>}
                    {versions[it.name].versions && versions[it.name].versions.length === 0 && <div style={{ fontSize: 11, color: "var(--t2)" }}>No earlier versions yet. One is kept each time this format is published again.</div>}
                    {(versions[it.name].versions || []).map(v => (
                      <div key={v.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0", fontSize: 11, color: "var(--t1)" }}>
                        <span style={{ flex: 1 }}>{v.creation} · replaced by {v.owner}</span>
                        <button className="bcb" onClick={() => openVersion(it.name, v.name, versions[it.name].modified)}>Open</button>
                      </div>
                    ))}
                    {(versions[it.name].versions || []).length > 0 && <div style={{ fontSize: 10, color: "var(--t2)", marginTop: 4 }}>Open one, then Update Print Format to put it back.</div>}
                  </div>}
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
                  <button onClick={() => { if (!confirm("Delete this design?")) return; onDelete(it.id); setItems(items.filter(x => x.id !== it.id)); }} className="ib del" style={{ padding: 8 }} title="Delete">
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
export function PublishModal({ doctype, isReport, initialName, onCancel, onPublish }) {
  const [name, setName] = useState(initialName || doctype + " PrintForge");
  const [makeDefault, setMakeDefault] = useState(false);
  const [state, setState] = useState(null); // null | "busy" | { error, conflict } | { done }
  const submit = async (overwrite = false) => {
    if (!name.trim()) return;
    setState("busy");
    try {
      setState({ done: await onPublish(name.trim(), makeDefault, overwrite) });
    } catch (e) {
      // The site's copy is newer than the one this design started from
      setState({ error: e.message, conflict: e.excType === "TimestampMismatchError" });
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
            <p style={{ color: "var(--t0)", marginBottom: 6 }}>{done.created ? "Created" : "Updated"} “{done.name}” for {isReport ? "the " + doctype + " report" : doctype}{done.is_default ? ", and set it as the default" : ""}.</p>
            <p>It is now in the Print Format list when printing {isReport ? "the " + doctype + " report" : "a " + doctype}. <a href={done.route} target="_blank" rel="noreferrer" style={{ color: "var(--ac)" }}>Open the Print Format</a></p>
          </div>
        ) : (
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
            <Txt label="Print Format name" value={name} onChange={setName} />
            <p style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.5 }}>For {isReport ? "the " + doctype + " report" : doctype} on {FRAPPE.site}. Publishing under the name of a format made here before updates it.</p>
            {!isReport && <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--t1)", cursor: "pointer" }}>
              <input type="checkbox" checked={makeDefault} onChange={e => setMakeDefault(e.target.checked)} style={{ accentColor: "var(--ac)" }} />Make this the default print format for {doctype}
            </label>}
            {state?.error && <p style={{ fontSize: 12, color: "var(--rd)", lineHeight: 1.5 }}>{state.error}</p>}
          </div>
        )}
        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--bd)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onCancel} style={{ padding: "7px 14px", background: "transparent", border: "1px solid var(--bm)", color: "var(--t1)", borderRadius: "var(--r4)", fontSize: 12, cursor: "pointer" }}>{done ? "Close" : "Cancel"}</button>
          {!done && state?.conflict && <button onClick={() => submit(true)} style={{ padding: "7px 14px", background: "transparent", border: "1px solid var(--rd)", color: "var(--rd)", borderRadius: "var(--r4)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Replace it</button>}
          {!done && !state?.conflict && <button onClick={() => submit(false)} disabled={state === "busy" || !name.trim()} style={{ padding: "7px 14px", background: "var(--ac)", border: "1px solid var(--ac)", color: "#fff", borderRadius: "var(--r4)", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: state === "busy" || !name.trim() ? .6 : 1 }}>{state === "busy" ? "Publishing" : "Publish"}</button>}
        </div>
      </div>
    </div>
  );
}
