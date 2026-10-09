// Turns a design tree into the Jinja/HTML that Frappe's print system renders.
//
// Frappe renders a custom Print Format's HTML inside its own page (.print-format) with
// `doc`, `letter_head`, `footer`, `no_letterhead` and `print_settings` in scope, and its
// PDF step (wkhtmltopdf, smart shrinking off) reads page margins, size and orientation
// from a top-level `.print-format { ... }` CSS rule. The output here is built for that.

export const PAGE_SIZES = { A4: [794, 1123], A5: [559, 794], A3: [1123, 1587], Letter: [816, 1056], Legal: [816, 1344] };
export const DEFAULT_SETTINGS = { pageSize: "A4", orientation: "Portrait", letterHead: false };
export const getSettings = tree => ({ ...DEFAULT_SETTINGS, ...(tree?.settings || {}) });
export const pageDims = tree => {
  const s = getSettings(tree);
  const [w, h] = PAGE_SIZES[s.pageSize] || PAGE_SIZES.A4;
  return s.orientation === "Landscape" ? { w: h, h: w } : { w, h };
};

// Used for the canvas and standalone files when no site font is known.
export const DOC_FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';

export const getPathData = (pts, closed = false) => {
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

// Sizes may be numbers (px) or CSS strings such as "100%" / "16px 0"
export const cssLen = v => typeof v === "number" ? v + "px" : (v || "0");
const pxToMm = px => Math.round(px * 25.4 / 96 * 10) / 10;
export const pagePadding = tree => tree.pages[0]?.padding ?? 40;
export const marginMm = tree => pxToMm(pagePadding(tree));

// A bare `{{ doc.field }}` goes through Frappe's formatter so currency, dates and numbers
// print the way the desk shows them. Anything more than a bare field reference (a filter,
// an expression) is left exactly as written.
const RAW_FIELDS = new Set(["name", "doctype", "idx"]);
export const formatRefs = (s, obj = "doc") => (s || "").replace(
  new RegExp("\\{\\{\\s*" + obj + "\\.([A-Za-z_]\\w*)\\s*\\}\\}", "g"),
  (m, f) => RAW_FIELDS.has(f) ? m : `{{ ${obj}.get_formatted("${f}"${obj === "doc" ? "" : ", doc"}) }}`
);
const formatExpr = expr => {
  const m = /^\s*doc\.([A-Za-z_]\w*)\s*$/.exec(expr || "");
  return m && !RAW_FIELDS.has(m[1]) ? `doc.get_formatted("${m[1]}")` : (expr || "").trim();
};

const flexSpacer = '<td class="pf-c"></td>';
const fixedSpacer = w => `<td class="pf-c" style="width:${w}px;"></td>`;

function renderNode(tree, id, indent, extraStyle = "", inFlow = false) {
  const el = tree.nodes[id]; if (!el) return "";
  const p = "  ".repeat(indent);
  const isRoot = tree.pages.some(p => (p.roots || []).includes(id));
  const isFlow = isRoot || inFlow || el.mode === "flow" || el._flow;

  const isShape = ["rect", "circle", "triangle", "line", "image", "path"].includes(el.type);
  const pos = isFlow
    ? ("position:relative;" + (isRoot && !isShape ? "width:100%;" : "width:" + cssLen(el.w) + ";"))
    : "position:absolute;left:" + (el.x || 0) + "px;top:" + (el.y || 0) + "px;width:" + cssLen(el.w) + ";";

  const base = pos + (el.margin != null && isFlow ? "margin:" + cssLen(el.margin) + ";" : "") + (extraStyle || "");

  // Layout conversion for wkhtmltopdf (Tables are most robust)
  let kids = el.children || [];
  let childrenHtml = "";

  if (el.layout === "flex" && (el.flexDir === "row" || el.flexDir === "row-reverse")) {
    const actualKids = el.flexDir === "row-reverse" ? [...kids].reverse() : kids;
    const va = el.alignItems === 'center' ? 'middle' : el.alignItems === 'flex-end' ? 'bottom' : 'top';
    const jc = el.justifyContent || "flex-start";
    const spread = ["space-between", "space-around", "space-evenly"].includes(jc);
    const allFixed = actualKids.every(childId => typeof tree.nodes[childId]?.w === "number");
    const cells = [];
    // Widthless cells soak up the free space, which is how justify-content is reproduced
    if (jc === "flex-end" || jc === "center" || jc === "space-around" || jc === "space-evenly") cells.push(flexSpacer);
    actualKids.forEach((childId, i) => {
      const child = tree.nodes[childId];
      if (i > 0) { if (spread) cells.push(flexSpacer); else if (el.gap > 0) cells.push(fixedSpacer(el.gap)); }
      const wStr = child && child.w ? `width:${cssLen(child.w)};` : "";
      cells.push(`<td class="pf-c" style="${wStr}vertical-align:${va} !important;">${renderNode(tree, childId, indent + 2, "", true)}</td>`);
    });
    if (jc === "center" || jc === "space-around" || jc === "space-evenly" || (jc === "flex-start" && allFixed)) cells.push(flexSpacer);
    childrenHtml = `\n${p}<table style="width:100%;border-collapse:collapse;table-layout:fixed;"><tr>${cells.join("\n")}</tr></table>\n`;
  } else if (el.layout === "grid") {
    const gridSpec = String(el.gridCols || "1fr 1fr").trim();
    const tracks = /^\d+$/.test(gridSpec) ? Array(parseInt(gridSpec)).fill("1fr") : gridSpec.split(/\s+/);
    const colsCount = tracks.length || 2;
    const frs = tracks.map(t => /^[\d.]+px$/.test(t) ? null : (parseFloat(t) || 1));
    const frTotal = frs.reduce((a, b) => a + (b || 0), 0) || 1;
    const trackWidth = i => frs[i] === null ? tracks[i] : Math.round(frs[i] / frTotal * 1000) / 10 + "%";
    let rows = [];
    for (let i = 0; i < kids.length; i += colsCount) {
      const rowKids = kids.slice(i, i + colsCount);
      const cells = [];
      rowKids.forEach((childId, j) => {
        if (j > 0 && el.colGap > 0) cells.push(fixedSpacer(el.colGap));
        cells.push(`<td class="pf-c" style="width:${trackWidth(j)};vertical-align:top !important;">${renderNode(tree, childId, indent + 2, "", true)}</td>`);
      });
      if (i > 0 && el.rowGap > 0) rows.push(`${p}  <tr><td class="pf-c" style="height:${el.rowGap}px;"></td></tr>`);
      rows.push(`${p}  <tr>${cells.join("")}</tr>`);
    }
    childrenHtml = `\n${p}<table style="width:100%;border-collapse:collapse;table-layout:fixed;">\n${rows.join("\n")}\n${p}</table>\n`;
  } else {
    const isCol = el.layout === "flex" && (el.flexDir === "column" || el.flexDir === "column-reverse");
    const actualKids = el.flexDir === "column-reverse" ? [...kids].reverse() : kids;
    childrenHtml = actualKids.map((childId, i) => {
      let extra = "";
      if (isCol && el.gap > 0 && i < actualKids.length - 1) extra += `margin-bottom:${el.gap}px;`;
      if (isCol && el.alignItems === "center") extra += "margin-left:auto;margin-right:auto;";
      if (isCol && el.alignItems === "flex-end") extra += "margin-left:auto;";
      return renderNode(tree, childId, indent + 1, extra, el.mode === "flow" || inFlow);
    }).join("\n");
  }

  if (el.type === "text") return p + '<div style="' + base + 'min-height:' + el.h + 'px;' + (el.isRich ? '' : 'font-size:' + el.fontSize + 'px;font-weight:' + el.fontWeight + ';color:' + el.color + ';text-align:' + el.align + ';font-style:' + (el.italic ? "italic" : "normal") + ';line-height:' + el.lineHeight + ';white-space:pre-wrap;word-wrap:break-word;') + 'background:' + el.bg + ';padding:' + cssLen(el.padding) + ';border-radius:' + el.borderRadius + 'px;">' + formatRefs(el.content) + '</div>';

  if (el.type === "rect") {
    const border = (el.strokeWidth || 0) + 'px ' + (el.style || "solid") + ' ' + (el.stroke || "transparent");
    return p + `<div style="${base}height:${el.h}px;background:${el.fill};border:${border};border-radius:${el.borderRadius || 0}px;opacity:${el.opacity ?? 1};padding:${cssLen(el.padding)};overflow:hidden;">${childrenHtml}${p}</div>`;
  }

  if (el.type === "circle") {
    const svgCircle = `<svg width="${el.w}" height="${el.h}" style="position:absolute;top:0;left:0;z-index:-1;"><ellipse cx="${el.w / 2}" cy="${el.h / 2}" rx="${el.w / 2}" ry="${el.h / 2}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth || 0}" /></svg>`;
    return p + `<div style="${base}height:${el.h}px;opacity:${el.opacity ?? 1};padding:${cssLen(el.padding)};overflow:hidden;">\n${p}  ${svgCircle}\n${childrenHtml}${p}</div>`;
  }

  if (el.type === "triangle") {
    const svgTri = `<svg width="${el.w}" height="${el.h}" style="position:absolute;top:0;left:0;z-index:-1;"><polygon points="${el.w / 2},0 0,${el.h} ${el.w},${el.h}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth || 0}" /></svg>`;
    return p + `<div style="${base}height:${el.h}px;opacity:${el.opacity ?? 1};padding:${cssLen(el.padding)};overflow:hidden;">\n${p}  ${svgTri}\n${childrenHtml}${p}</div>`;
  }

  if (el.type === "path") {
    const d = getPathData(el.points, el.closed);
    return p + `<div style="${base}overflow:visible;"><svg width="${el.w}" height="${el.h}" viewBox="0 0 ${el.w} ${el.h}" style="width:100%;height:100%;overflow:visible;"><path d="${d}" fill="${el.fill || 'transparent'}" stroke="${el.stroke || '#000'}" stroke-width="${el.strokeWidth || 1}" opacity="${el.opacity ?? 1}" /></svg></div>`;
  }

  if (el.type === "line") return p + '<div style="' + base + 'height:' + el.thickness + 'px;border-top:' + el.thickness + 'px ' + el.style + ' ' + el.color + ';"></div>';

  if (el.type === "image") {
    const fit = el.objectFit || "contain";
    if (el.logoType === "custom" && el.customUrl) {
      return p + '<img src="' + el.customUrl + '" style="' + base + 'height:' + el.h + 'px;object-fit:' + fit + ';" />';
    }
    const expr = (el.jinjaExpr || "").replace(/\{\{|\}\}/g, "").trim();
    return p + '{%if ' + (expr || "True") + '%}\n' + p + '<img src="' + (el.jinjaExpr || "") + '" style="' + base + 'height:' + el.h + 'px;object-fit:' + fit + ';" />\n' + p + '{%endif%}';
  }

  if (el.type === "table") {
    const cols = (el.columns || []).filter(Boolean);
    const ths = cols.map(c => '<th style="width:' + (c.width || "auto") + ';text-align:' + (c.align || "left") + ';padding:7px 10px !important;font-size:' + (el.headerFontSize || 11) + 'px;font-weight:600;color:' + (el.headerColor || "inherit") + ';">' + (c.label || "") + '</th>').join("");
    const tdSt = 'padding:6px 10px !important;font-size:' + (el.fontSize || 12) + 'px;color:' + (el.rowColor || "inherit") + ';border-bottom:1px solid ' + (el.borderColor || "transparent") + ';';
    const tds = cols.map(c => '<td style="text-align:' + (c.align || "left") + ';' + tdSt + '">' + formatRefs('{{ item.' + (c.field || "field") + ' }}', "item") + '</td>').join("");
    const rowBg = el.rowBg || "transparent", rowAltBg = el.rowAltBg || rowBg;
    const rowBgSt = rowAltBg === rowBg ? rowBg : "{{ '" + rowBg + "' if loop.index0 % 2 == 0 else '" + rowAltBg + "' }}";
    const footSt = 'padding:6px 10px !important;font-size:' + (el.fontSize || 12) + 'px;color:' + (el.rowColor || "inherit") + ';font-weight:600;';
    const foot = (el.footerRows || []).map(fr =>
      p + '<tr style="page-break-inside:avoid;">' + (cols.length > 1 ? '<td colspan="' + (cols.length - 1) + '" style="text-align:right;' + footSt + '">' + (fr.label || "") + '</td>' : "") + '<td style="text-align:right;' + footSt + '">{{ ' + formatExpr(fr.expr) + ' }}</td></tr>\n').join("");
    let tblSt = base.replace(/position:\s*relative;?/g, "").replace(/width:\s*[^;]+;?/g, "") + "width:100%;border-collapse:collapse;table-layout:fixed;";
    return p + '<table style="' + tblSt + '">\n' + p + '<thead><tr style="background:' + (el.headerBg || "transparent") + ';color:' + (el.headerColor || "inherit") + ';">' + ths + '</tr></thead>\n' + p + '<tbody>\n' + p + '{%for item in doc.' + (el.childField || "items") + '%}\n' + p + '<tr style="page-break-inside:avoid;background:' + rowBgSt + ';">' + tds + '</tr>\n' + p + '{%endfor%}\n' + foot + p + '</tbody>\n' + p + '</table>';
  }

  if (el.type === "container") {
    if (indent > 25) return p + "<!-- max depth reached -->";
    const bg = el.fill || "transparent";
    const border = (el.strokeWidth || 0) + 'px ' + (el.style || "solid") + ' ' + (el.stroke || "transparent");
    return p + `<div style="${base}min-height:${el.h}px;background:${bg};border:${border};border-radius:${el.borderRadius || 0}px;opacity:${el.opacity ?? 1};padding:${cssLen(el.padding)};overflow:hidden;">${childrenHtml}${p}</div>`;
  }
  return "";
}

// The HTML stored in the Print Format.
export function toPrintFormatHtml(tree) {
  try {
    const pad = pagePadding(tree);
    const mm = marginMm(tree);
    const s = getSettings(tree);
    const { w } = pageDims(tree);

    // Read by Frappe's PDF step; must stay a plain top-level `.print-format` rule.
    const pdfRule = [
      `margin-left: ${mm}mm`, `margin-right: ${mm}mm`,
      // With the site letter head on, Frappe sizes the top and bottom margins for it
      ...(s.letterHead ? [] : [`margin-top: ${mm}mm`, `margin-bottom: ${mm}mm`]),
      ...(s.pageSize !== "A4" ? [`page-size: ${s.pageSize}`] : []),
      ...(s.orientation === "Landscape" ? ["orientation: Landscape"] : []),
    ].join("; ");

    const css = `
  .print-format { ${pdfRule}; }
  @media screen { .print-format { margin: 0 auto !important; padding: ${pad}px !important; max-width: ${w}px !important; } }
  @media print { .print-format { margin: 0 !important; padding: 0 !important; } }
  .pf-doc, .pf-doc * { box-sizing: border-box; }
  .pf-doc { color: #111111; -webkit-print-color-adjust: exact; }
  .pf-doc div, .pf-doc p { margin: 0; }
  .pf-doc table { width: 100%; border-collapse: collapse; table-layout: fixed; margin: 0; }
  .print-format .pf-doc td.pf-c { padding: 0 !important; border: 0 !important; }
  .pf-doc img { max-width: 100%; display: block; }
  .pf-page { position: relative; width: ${w - pad * 2}px; max-width: 100%; }
`;

    // Same structure Frappe's standard format uses, so the print dialog's Letter Head
    // option and the site's "Repeat Header and Footer" setting both apply.
    const head = s.letterHead ? `{%- if letter_head and not no_letterhead %}
<div {% if print_settings.repeat_header_footer %}id="header-html" class="hidden-pdf"{% endif %}>
  <div class="letter-head">{{ letter_head }}</div>
</div>
{%- endif %}
` : "";
    const foot = s.letterHead ? `
<div {% if print_settings.repeat_header_footer %}id="footer-html" class="visible-pdf"{% endif %}>
  {%- if footer and not no_letterhead %}
  <div class="letter-head-footer">{{ footer }}</div>
  {%- endif %}
  {%- if print_settings.repeat_header_footer %}
  <p class="text-center small page-number visible-pdf">{{ _("Page {0} of {1}").format('<span class="page"></span>', '<span class="topage"></span>') }}</p>
  {%- endif %}
</div>` : "";

    const last = tree.pages.length - 1;
    const pagesHtml = tree.pages.map((page, i) => {
      const rootsHtml = (page.roots || []).map(id => renderNode(tree, id, 1, "", true)).join("\n");
      return `<div class="pf-page"${i < last ? ' style="page-break-after:always;"' : ""}>\n${rootsHtml}\n</div>`;
    }).join("\n");
    return `<style>${css}</style>\n<div class="pf-doc">\n${head}${pagesHtml}${foot}\n</div>`;
  } catch (e) {
    console.error("Jinja generation error:", e);
    return "Error generating Jinja template. Please check console.";
  }
}

// A self-contained file for checking a design outside Frappe (see render_pdf.py). It wraps
// the same fragment in the .print-format box Frappe would provide.
export function toStandaloneHtml(tree, doctype) {
  const pad = pagePadding(tree);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${doctype}</title>
  <style>
    body { margin: 0; background: #fff; }
    .print-format { font-family: ${DOC_FONT}; font-size: 9pt; }
  </style>
</head>
<body>
<div class="print-format">
${toPrintFormatHtml(tree)}
</div>
<style>@media print { .print-format { padding: ${pad}px !important; } }</style>
</body>
</html>`;
}
