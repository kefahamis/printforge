import { describe, it, expect } from 'vitest'
import { formatRefs, pageDims, marginMm, toPrintFormatHtml, toStandaloneHtml } from './exporter.js'

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
    expect(html).toContain('.pf-page { position: relative; width: 714px;')
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
