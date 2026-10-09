import { DOC_FONT } from './exporter.js';
import { FRAPPE } from './frappe.js';

export function injectStyles(theme = "dark", page = { w: 794, h: 1123 }, density = "comfortable") {
  const compact = density === "compact";
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
    s = document.createElement("style");
    s.id = id;
    document.head.appendChild(s);
  }

  const rules = [
    "*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}",
    `:root{--b0:${s0.b0};--b1:${s0.b1};--b2:${s0.b2};--b3:${s0.b3};--b4:${s0.b4};--bd:${s0.bd};--bm:${s0.bm};--bh:${s0.bh};--t0:${s0.t0};--t1:${s0.t1};--t2:${s0.t2};--ac:${s0.ac};--ad:${s0.ad};--gn:#2f9e5b;--rd:#d9484d;--r4:4px;--r6:6px;--ctl:${compact ? "3px 8px" : "6px 10px"};--row:${compact ? "2px 8px" : "5px 8px"};--sans:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;--mono:ui-monospace,'Cascadia Mono',Consolas,Menlo,monospace}`,
    "body{background:var(--b0);font-family:var(--sans);color:var(--t0);overflow:hidden}",
    "button{font-family:inherit}",
    // The page uses the site's print font so line breaks match the printed document
    `.pf-print-area{font-family:${FRAPPE?.print_font || DOC_FONT}}`,
    "input,select,textarea{font-family:inherit}",
    "::-webkit-scrollbar{width:6px;height:6px}",
    "::-webkit-scrollbar-track{background:transparent}",
    "::-webkit-scrollbar-thumb{background:var(--b4)}",
    "::-webkit-scrollbar-thumb:hover{background:var(--bh)}",
    ".pi{width:100%;padding:var(--ctl);background:var(--b0);border:1px solid var(--bm);border-radius:var(--r4);color:var(--t0);font-size:11px;outline:none}",
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
    `.sdiv{height:1px;background:var(--bd);margin:${compact ? 8 : 12}px -12px}`,
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
    ".li{display:flex;align-items:center;gap:6px;padding:var(--row);border-radius:var(--r4);cursor:pointer;font-size:11px;font-weight:500;transition:all .1s;border:1px solid transparent}",
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
      @page { size: ${page.w}px ${page.h}px; margin: 0; }
      body * { visibility: hidden; }
      .pf-print-area, .pf-print-area * { visibility: visible; }
      .pf-print-area {
        position: fixed !important;
        left: 0 !important;
        top: 0 !important;
        width: ${page.w}px !important;
        height: ${page.h}px !important;
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
