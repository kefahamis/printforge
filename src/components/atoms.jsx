import { useEffect, useRef } from 'react';

// ── Smart Guides ─────────────────────────────────────────────────────────────
export function SmartGuides({ guides }) {
  if (!guides || (!guides.h?.length && !guides.v?.length)) return null;
  return (
    <>
      {(guides.h || []).map((y, i) => <div key={'h' + i} className="pf-guide-h" style={{ top: y }} />)}
      {(guides.v || []).map((x, i) => <div key={'v' + i} className="pf-guide-v" style={{ left: x }} />)}
    </>
  );
}

// ── Atoms ─────────────────────────────────────────────────────────────────────
export function Swatch({ value, onChange }) {
  return (
    <div style={{ width: 26, height: 26, borderRadius: 4, border: "1.5px solid var(--bm)", cursor: "pointer", position: "relative", overflow: "hidden", flexShrink: 0, backgroundImage: "linear-gradient(45deg,#bbb 25%,transparent 25%),linear-gradient(-45deg,#bbb 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#bbb 75%),linear-gradient(-45deg,transparent 75%,#bbb 75%)", backgroundSize: "7px 7px", backgroundPosition: "0 0,0 3.5px,3.5px -3.5px,-3.5px 0" }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: 3, background: value }} />
      <input type="color" value={value} onChange={e => onChange(e.target.value)} style={{ position: "absolute", inset: -4, width: "calc(100% + 8px)", height: "calc(100% + 8px)", opacity: 0, cursor: "pointer" }} />
    </div>
  );
}
export function Num({ label, value, onChange, unit, min, max }) {
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
export function Txt({ label, value, onChange, mono, ph, rows, list }) {
  const cls = "pi" + (mono ? " mono" : "");
  return (
    <div className="pf">
      {label && <label>{label}</label>}
      {rows ? <textarea className={cls} value={value} onChange={e => onChange(e.target.value)} rows={rows} placeholder={ph} style={{ resize: "vertical", lineHeight: 1.6 }} /> : <input className={cls} value={value} onChange={e => onChange(e.target.value)} placeholder={ph} list={list} />}
    </div>
  );
}
// Quill and its stylesheet are only fetched the first time a rich text element is edited
const loadQuill = () => Promise.all([import('quill'), import('quill/dist/quill.snow.css'), import('../quill-theme.css')]).then(([m]) => m.default);

export function RichTextEditor({ value, onChange }) {
  const ref = useRef(null);
  const quillRef = useRef(null);
  const skip = useRef(false);

  const latest = useRef(value);
  latest.current = value;

  useEffect(() => {
    let cancelled = false;
    loadQuill().then(Quill => {
      if (cancelled || !ref.current || quillRef.current) return;
      quillRef.current = new Quill(ref.current, {
        theme: 'snow',
        modules: {
          toolbar: [
            ['bold', 'italic', 'underline'],
            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
            ['clean']
          ]
        }
      });
      quillRef.current.root.innerHTML = latest.current || '';
      quillRef.current.on('text-change', () => {
        if (!skip.current) {
          onChange(quillRef.current.root.innerHTML);
        }
      });
    });
    return () => { cancelled = true; };
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
export function Sel({ label, value, onChange, options }) {
  return (
    <div className="pf">
      {label && <label>{label}</label>}
      <select className="ps" value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o.v ?? o} value={o.v ?? o}>{o.l ?? o}</option>)}
      </select>
    </div>
  );
}
export function CRow({ label, value, onChange }) {
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
export function Sec({ title, children, badge }) {
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
export const Sdiv = () => <div className="sdiv" />;

// ── Stand-ins for codes the site draws when printing ──────────────────────────
// The real symbol depends on the document, so the canvas shows a fixed pattern of the right shape.
const QR_N = 25;
const qrDark = (x, y) => {
  const finder = (cx, cy) => { const dx = Math.abs(x - cx), dy = Math.abs(y - cy), d = Math.max(dx, dy); return d <= 4 ? (d === 4 ? 0 : d === 3 || d <= 1 ? 1 : 0) : null; };
  for (const [cx, cy] of [[3, 3], [QR_N - 4, 3], [3, QR_N - 4]]) { const f = finder(cx, cy); if (f !== null) return f; }
  return ((x * 7 + y * 13 + ((x * y) % 5) + (x ^ y)) % 3) === 0 ? 1 : 0;
};
export function FakeQR({ size }) {
  const cells = [];
  for (let y = 0; y < QR_N; y++) for (let x = 0; x < QR_N; x++) if (qrDark(x, y)) cells.push("M" + x + " " + y + "h1v1h-1z");
  return <svg width={size} height={size} viewBox={"0 0 " + QR_N + " " + QR_N} shapeRendering="crispEdges" style={{ display: "block" }}><path d={cells.join("")} fill="#111111" /></svg>;
}
export function FakeBars({ w, h, text }) {
  const bars = [];
  let x = 0;
  for (let i = 0; x < 100; i++) { const bw = 1 + ((i * 7 + 3) % 3); if (i % 2 === 0) bars.push("M" + x + " 0h" + bw + "v10h-" + bw + "z"); x += bw; }
  const th = text ? 13 : 0;
  return (
    <div style={{ width: w, textAlign: "center" }}>
      <svg width={w} height={Math.max(4, h - th)} viewBox={"0 0 " + x + " 10"} preserveAspectRatio="none" shapeRendering="crispEdges" style={{ display: "block" }}><path d={bars.join("")} fill="#111111" /></svg>
      {text ? <div style={{ fontSize: 10, lineHeight: "13px", fontFamily: "var(--mono)", color: "#111111", overflow: "hidden", whiteSpace: "nowrap" }}>{text}</div> : null}
    </div>
  );
}
