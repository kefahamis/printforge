import { describe, it, expect } from 'vitest'
import { formatRefs, tr, pageDims, marginMm, pageContentHeight, toPrintFormatHtml, toStandaloneHtml } from './exporter.js'

const text = (id, content, o = {}) => ({ id, type: "text", children: [], w: 100, h: 20, content, fontSize: 12, fontWeight: "400", color: "#111", align: "left", italic: false, lineHeight: 1.5, bg: "transparent", padding: 0, borderRadius: 0, isRich: false, _flow: true, ...o })
const box = (id, children, o = {}) => ({ id, type: "container", children, w: "100%", h: 20, fill: "transparent", stroke: "transparent", strokeWidth: 0, borderRadius: 0, opacity: 1, padding: 0, mode: "flow", layout: "flex", flexDir: "row", justifyContent: "flex-start", alignItems: "stretch", gap: 0, ...o })
const tree = (nodes, roots, extra = {}) => ({ nodes: Object.fromEntries(nodes.map(n => [n.id, n])), pages: [{ id: "p1", name: "Page 1", roots, padding: 40 }], ...extra })
const cells = html => (html.match(/<td class="pf-c"[^>]*>/g) || [])

describe('formatRefs', () => {
  it('routes bare field references through the Frappe formatter', () => {
    expect(formatRefs('Total: {{ doc.grand_total }}')).toBe('Total: {{ doc.get_formatted("grand_total") }}')
    expect(formatRefs('{{item.amount}}', 'item')).toBe('{{ item.get_formatted("amount", doc) }}')
  })
  it('leaves names, row numbers and anything with a filter or expression alone', () => {
    expect(formatRefs('{{ doc.name }}')).toBe('{{ doc.name }}')
    expect(formatRefs('{{ item.idx }}', 'item')).toBe('{{ item.idx }}')
    expect(formatRefs('{{ doc.grand_total | round }}')).toBe('{{ doc.grand_total | round }}')
    expect(formatRefs('{{ doc.items|length }}')).toBe('{{ doc.items|length }}')
  })
})

describe('page setup', () => {
  it('defaults to A4 portrait and swaps sides for landscape', () => {
    expect(pageDims({})).toEqual({ w: 794, h: 1123 })
    expect(pageDims({ settings: { pageSize: "Letter", orientation: "Landscape" } })).toEqual({ w: 1056, h: 816 })
  })
  it('writes margins as a plain top-level .print-format rule, which is what the PDF step reads', () => {
    const t = tree([text("a", "hi")], ["a"])
    expect(marginMm(t)).toBe(10.6)
    const html = toPrintFormatHtml(t)
    expect(html).toContain('.print-format { margin-left: 10.6mm; margin-right: 10.6mm; margin-top: 10.6mm; margin-bottom: 10.6mm; }')
    // the same margins must not also apply as CSS in the page body
    expect(html).toContain('@media print { .print-format { margin: 0 !important; padding: 0 !important; } }')
    expect(html).toContain('.pf-page, .pf-rep { position: relative; width: 714px;')
  })
  it('adds paper size and orientation only when they differ from A4 portrait', () => {
    const html = toPrintFormatHtml(tree([text("a", "hi")], ["a"], { settings: { pageSize: "Letter", orientation: "Landscape" } }))
    expect(html).toContain('page-size: Letter; orientation: Landscape;')
    expect(html).toContain('width: 976px;')
  })
})

describe('letter head', () => {
  const t = on => tree([text("a", "hi")], ["a"], { settings: { letterHead: on } })
  it('is left out unless the design asks for it', () => {
    expect(toPrintFormatHtml(t(false))).not.toContain('letter_head')
  })
  it('uses the header/footer blocks Frappe repeats on every page, and leaves vertical margins to the site', () => {
    const html = toPrintFormatHtml(t(true))
    expect(html).toContain('{%- if letter_head and not no_letterhead %}')
    expect(html).toContain('id="header-html"')
    expect(html).toContain('id="footer-html"')
    expect(html).toContain('.print-format { margin-left: 10.6mm; margin-right: 10.6mm; }')
  })
})

describe('layout', () => {
  it('reproduces justify-content with widthless spacer cells', () => {
    const kids = [text("a", "A"), text("b", "B")]
    const row = jc => toPrintFormatHtml(tree([box("r", ["a", "b"], { justifyContent: jc }), ...kids], ["r"]))
    const widthless = html => cells(html).filter(c => !c.includes("style")).length
    expect(widthless(row("flex-start"))).toBe(1)     // trailing
    expect(widthless(row("flex-end"))).toBe(1)       // leading
    expect(widthless(row("space-between"))).toBe(1)  // between
    expect(widthless(row("center"))).toBe(2)
  })
  it('turns a row gap into a fixed spacer cell instead of table border spacing', () => {
    const html = toPrintFormatHtml(tree([box("r", ["a", "b"], { gap: 12 }), text("a", "A"), text("b", "B")], ["r"]))
    expect(html).toContain('<td class="pf-c" style="width:12px;"></td>')
    expect(html).not.toContain('border-spacing')
  })
  it('sizes grid columns from their fr ratios', () => {
    const html = toPrintFormatHtml(tree([box("g", ["a", "b"], { layout: "grid", gridCols: "2fr 1fr", colGap: 0, rowGap: 0 }), text("a", "A"), text("b", "B")], ["g"]))
    expect(html).toContain('width:66.7%')
    expect(html).toContain('width:33.3%')
  })
  it('aligns children of a column and keeps typed line breaks', () => {
    const html = toPrintFormatHtml(tree([box("c", ["a"], { flexDir: "column", alignItems: "flex-end" }), text("a", "one\ntwo")], ["c"]))
    expect(html).toContain('margin-left:auto;')
    expect(html).toContain('white-space:pre-wrap;')
  })
})

describe('tables', () => {
  const tbl = { id: "t", type: "table", children: [], w: "100%", h: 100, childField: "items", columns: [{ id: "c1", label: "Item", field: "item_name", align: "left", width: "60%" }, { id: "c2", label: "Amount", field: "amount", align: "right", width: "40%" }], headerBg: "#eee", headerColor: "#111", headerFontSize: 11, rowBg: "#fff", rowAltBg: "#fff", rowColor: "#222", borderColor: "#ccc", fontSize: 12, footerRows: [{ label: "Total", expr: "doc.grand_total" }] }
  it('formats cells and exports footer rows', () => {
    const html = toPrintFormatHtml(tree([tbl], ["t"]))
    expect(html).toContain('{{ item.get_formatted("amount", doc) }}')
    expect(html).toContain('<td colspan="1"')
    expect(html).toContain('{{ doc.get_formatted("grand_total") }}')
  })
})

describe('standalone file', () => {
  it('wraps the same fragment in a .print-format box with the page margins as padding', () => {
    const html = toStandaloneHtml(tree([text("a", "hi")], ["a"]), "Sales Invoice")
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(html).toContain('<div class="print-format">')
    expect(html).toContain('@media print { .print-format { padding: 40px !important; } }')
  })
})

describe('repeating header and footer', () => {
  const t = (extra = {}) => tree([text("h", "Header", { h: 40, repeat: "header" }), text("b", "Body"), text("f", "Footer", { h: 20, repeat: "footer" })], ["h", "b", "f"], extra)
  it('moves marked elements into the blocks Frappe repeats on every page', () => {
    const html = toPrintFormatHtml(t())
    const header = html.slice(html.indexOf('<div id="header-html">'), html.indexOf('<div class="pf-page"'))
    expect(header).toContain('{{ _("Header") }}')
    const page = html.slice(html.indexOf('<div class="pf-page"'), html.indexOf('<div id="footer-html">'))
    expect(page).toContain('{{ _("Body") }}')
    expect(page).not.toContain('{{ _("Header") }}')
    expect(html.slice(html.indexOf('<div id="footer-html">'))).toContain('{{ _("Footer") }}')
  })
  it('grows the page margins to make room, preferring measured heights', () => {
    // top: 40px margin + 40px header = 21.2mm, plus Frappe's 5mm below the header
    expect(toPrintFormatHtml(t())).toContain('margin-top: 26.2mm; margin-bottom: 17.9mm;')
    expect(toPrintFormatHtml(t(), { heights: { h: 80 } })).toContain('margin-top: 36.8mm;')
  })
  it('replaces the site letter head rather than stacking with it', () => {
    const html = toPrintFormatHtml(t({ settings: { letterHead: true } }))
    expect(html).not.toContain('letter_head')
    expect(html).not.toContain('letter-head-footer')
  })
  it('adds page numbers on their own when asked', () => {
    const html = toPrintFormatHtml(tree([text("a", "hi")], ["a"], { settings: { pageNumbers: true } }))
    expect(html).toContain('<div id="footer-html">')
    expect(html).toContain('<span class="topage"></span>')
  })
})

describe('report formats', () => {
  const tbl = { id: "t", type: "table", children: [], w: "100%", h: 100, columns: [{ id: "c1", label: "Account", field: "account", align: "left", width: "60%" }, { id: "c2", label: "Balance", field: "balance", align: "right", width: "40%" }], headerBg: "#eee", headerColor: "#111", rowBg: "#fff", rowAltBg: "#f7f7f7", rowColor: "#222", borderColor: "#ccc", fontSize: 12, footerRows: [] }
  const html = toPrintFormatHtml(tree([text("x", "{{ title }} {{ doc.grand_total }}", { repeat: "header" }), tbl], ["x", "t"], { settings: { printFor: "Report", letterHead: true } }))
  it('loops over the report rows with the syntax Frappe renders in the browser', () => {
    expect(html).toContain('{% for row in data %}')
    expect(html).toContain('frappe.format(row["balance"]')
    expect(html).toContain('row._index % 2 == 0 ? "#fff" : "#f7f7f7"')
    expect(html).not.toContain('loop.index0')
  })
  it('leaves text as typed and uses no server-side blocks', () => {
    expect(html).toContain('{{ title }} {{ doc.grand_total }}')
    expect(html).not.toContain('get_formatted')
    expect(html).not.toContain('id="header-html"')
    expect(html).not.toContain('letter_head')
  })
})

describe('conditions, status and wording', () => {
  it('wraps an element with a condition in a template test', () => {
    const html = toPrintFormatHtml(tree([text("a", "Discount", { showIf: "{{ doc.discount_amount }}" })], ["a"]))
    expect(html).toMatch(/\{% if doc\.discount_amount %\}\n\s*<div[^>]*>\{\{ _\("Discount"\) \}\}<\/div>\n\s*\{% endif %\}/)
  })
  it('prints the draft and cancelled headings a standard format would, unless switched off', () => {
    const on = toPrintFormatHtml(tree([text("a", "hi")], ["a"]))
    expect(on).toContain('doc.docstatus == 0 and print_settings.add_draft_heading')
    expect(on).toContain('{{ _("CANCELLED") }}')
    expect(toPrintFormatHtml(tree([text("a", "hi")], ["a"], { settings: { statusHeading: false } }))).not.toContain('document-status')
  })
  it('sends plain wording through the translator and leaves templates and markup alone', () => {
    expect(tr('Bill to')).toBe('{{ _("Bill to") }}')
    expect(tr('Account', true)).toBe('{{ __("Account") }}')
    expect(tr('{{ doc.name }}')).toBe('{{ doc.name }}')
    expect(tr('<b>Total</b>')).toBe('<b>Total</b>')
    expect(tr('He said "hi"')).toBe('He said "hi"')
    expect(tr('12.50')).toBe('12.50')
  })
  it('sets a design font only when one is chosen', () => {
    expect(toPrintFormatHtml(tree([text("a", "hi")], ["a"]))).not.toContain('font-family')
    expect(toPrintFormatHtml(tree([text("a", "hi")], ["a"], { settings: { font: "Georgia, serif" } }))).toContain('font-family: Georgia, serif;')
  })
})

describe('pageContentHeight', () => {
  it('is the page height less the margins the PDF will use', () => {
    expect(pageContentHeight(tree([text("a", "hi")], ["a"]))).toBe(1043) // 1123 - 2 x 40
    const withHeader = tree([text("h", "Header", { h: 40, repeat: "header" }), text("b", "Body")], ["h", "b"])
    expect(pageContentHeight(withHeader)).toBeLessThan(1043 - 40)
  })
})

describe('receipt and label paper', () => {
  it('prints a custom size in millimetres, already turned when landscape', () => {
    const t = tree([text("a", "hi")], ["a"], { settings: { pageSize: "Custom", customW: 80, customH: 200 } })
    expect(pageDims(t)).toEqual({ w: 302, h: 756 })
    const html = toPrintFormatHtml(t)
    expect(html).toContain('page-width: 80mm; page-height: 200mm')
    expect(html).not.toContain('page-size')
    const turned = toPrintFormatHtml({ ...t, settings: { ...t.settings, orientation: "Landscape" } })
    expect(turned).toContain('page-width: 200mm; page-height: 80mm')
    expect(turned).not.toContain('orientation:')
  })
})

describe('QR codes and barcodes', () => {
  const qr = (o = {}) => ({ id: "q", type: "qr", children: [], w: 96, h: 120, source: "expr", value: "doc.name", ...o })
  const bc = (o = {}) => ({ id: "b", type: "barcode", children: [], w: 220, h: 64, source: "expr", value: "{{ doc.name }}", symbology: "ean13", showText: false, ...o })
  it('are drawn by the site from a field, and left out while it is empty', () => {
    const html = toPrintFormatHtml(tree([qr(), bc()], ["q", "b"]))
    expect(html).toContain('{% if doc.name %}')
    expect(html).toContain('{{ printforge_qr(doc.name, 96) }}')
    expect(html).toContain('{{ printforge_barcode(doc.name, "ean13", 220, 64, 0) }}')
  })
  it('quote fixed text so it cannot be read as a template expression', () => {
    const html = toPrintFormatHtml(tree([qr({ source: "text", value: 'https://x.test/?a="b"' })], ["q"]))
    expect(html).toContain('printforge_qr("https://x.test/?a=\\"b\\"", 96)')
  })
  it('are skipped in report formats, which the browser fills in', () => {
    const html = toPrintFormatHtml(tree([qr()], ["q"], { settings: { printFor: "Report" } }))
    expect(html).not.toContain('printforge_qr')
  })
})

describe('repeating a block for each row', () => {
  it('loops over the child table and formats the row fields', () => {
    const t = tree([box("c", ["a"], { repeatFor: "items", breakAfter: true }), text("a", "{{ item.item_name }} {{ item.amount }}")], ["c"])
    const html = toPrintFormatHtml(t)
    expect(html).toContain('{% for item in doc.items %}')
    expect(html).toContain('{{ item.get_formatted("amount", doc) }}')
    expect(html).toContain('{% if not loop.last %}<div style="page-break-after:always;"></div>{% endif %}')
    expect(html).toContain('{% endfor %}')
  })
  it('accepts only a field name', () => {
    const html = toPrintFormatHtml(tree([box("c", [], { repeatFor: "items %}{{ evil" })], ["c"]))
    expect(html).toContain('{% for item in doc.itemsevil %}')
  })
})

describe('watermark', () => {
  const t = tree([text("a", "hi")], ["a"])
  it('follows the document status', () => {
    const html = toPrintFormatHtml({ ...t, settings: { watermark: "status" } })
    expect(html).toContain('{%- set pf_wm = _("DRAFT") if (doc.meta.is_submittable and doc.docstatus == 0) else (_("CANCELLED") if doc.docstatus == 2 else "") %}')
    expect(html).toContain('{% if pf_wm %}<div class="pf-wms">')
    expect(html).toContain('>{{ pf_wm }}</div>')
  })
  it('lays one mark down per printed page, because the PDF step does not repeat fixed elements', () => {
    const html = toPrintFormatHtml({ ...t, settings: { watermark: "text", watermarkText: "COPY" } })
    const each = pageContentHeight(t)
    expect(html).not.toContain('position: fixed')
    expect(html).toContain(`<div class="pf-wm" style="top:${Math.round(0.3 * each)}px;">`)
    expect(html).toContain(`<div class="pf-wm" style="top:${Math.round(1.3 * each)}px;">`)
    expect(html).toContain('.pf-wms { position: absolute; top: 0; left: 0; right: 0; bottom: 0; overflow: hidden;')
  })
  it('prints your own wording, and nothing when there is none', () => {
    expect(toPrintFormatHtml({ ...t, settings: { watermark: "text", watermarkText: "COPY" } })).toContain('>{{ _("COPY") }}</div>')
    expect(toPrintFormatHtml({ ...t, settings: { watermark: "text", watermarkText: " " } })).not.toContain('pf-wm')
    expect(toPrintFormatHtml(t)).not.toContain('pf-wm')
  })
})

describe('elements pinned by the Move tool', () => {
  it('are placed from the printed page box, which starts inside the margins', () => {
    const html = toPrintFormatHtml(tree([text("a", "hi", { _free: true, x: 140, y: 240, w: 100 })], ["a"]))
    expect(html).toContain('position:absolute;left:100px;top:200px;width:100px;')
  })
})
