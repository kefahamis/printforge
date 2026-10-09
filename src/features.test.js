import { describe, it, expect } from 'vitest'
import { toPrintFormatHtml, toBlockHtml } from './exporter.js'
import { validateDesign } from './validate.js'
import { mkT, groupNodes, ungroupNode, remapFields, designColours, replaceColours, accentColour, applyBrand } from './tree.js'

const text = (id, content, o = {}) => ({ id, type: "text", children: [], w: 100, h: 20, content, fontSize: 12, fontWeight: "400", color: "#111", align: "left", italic: false, lineHeight: 1.5, bg: "transparent", padding: 0, borderRadius: 0, isRich: false, _flow: true, ...o })
const box = (id, children, o = {}) => ({ id, type: "container", children, w: "100%", h: 20, fill: "transparent", stroke: "transparent", strokeWidth: 0, borderRadius: 0, opacity: 1, padding: 0, mode: "flow", layout: "flex", flexDir: "row", justifyContent: "flex-start", alignItems: "stretch", gap: 0, ...o })
const tree = (nodes, roots, extra = {}) => ({ nodes: Object.fromEntries(nodes.map(n => [n.id, n])), pages: [{ id: "p1", name: "Page 1", roots, padding: 40 }], ...extra })
const table = (o = {}) => ({ id: "t", type: "table", children: [], w: "100%", h: 100, childField: "items", columns: [{ id: "c1", label: "Item", field: "item_name", align: "left", width: "60%" }, { id: "c2", label: "Amount", field: "amount", align: "right", width: "40%" }], footerRows: [], ...o })
const errors = (t, fields = []) => validateDesign(t, "Sales Invoice", fields, toPrintFormatHtml(t), "ok").filter(i => i.severity === "error")

describe('table columns, row tests and groups', () => {
  it('prints calculations, pictures and barcodes in a column', () => {
    const html = toPrintFormatHtml(tree([table({
      columns: [
        { id: "a", label: "Line", kind: "calc", expr: "item.qty * item.rate" },
        { id: "b", label: "Ratio", kind: "calc", expr: "{{ item.qty / 2 }}", money: false },
        { id: "c", label: "Picture", kind: "image", field: "image", size: 30 },
        { id: "d", label: "Code", kind: "barcode", field: "item_code" },
      ]
    })], ["t"]))
    expect(html).toContain('{{ frappe.utils.fmt_money(item.qty * item.rate, currency=doc.currency) }}')
    expect(html).toContain('{{ item.qty / 2 }}')
    expect(html).toContain('{% if item.image %}<img src="{{ item.image }}" style="max-height:30px;')
    expect(html).toContain('{{ printforge_barcode(item.item_code, "code128", 120, 36, 1) }}')
  })
  it('leaves out rows that fail the test', () => {
    const html = toPrintFormatHtml(tree([table({ rowIf: "{{ item.qty > 0 }}" })], ["t"]))
    expect(html).toContain('{% if item.qty > 0 %}<tr')
    expect(html).toContain('</tr>{% endif %}')
  })
  it('groups rows under a heading with a subtotal', () => {
    const html = toPrintFormatHtml(tree([table({ groupBy: "item_group", groupTotal: "amount" })], ["t"]))
    expect(html).toContain('{% for pf_g in doc.items | groupby("item_group") %}')
    expect(html).toContain('<td colspan="2"')
    expect(html).toContain('{% for item in pf_g.list %}')
    expect(html).toContain('{{ frappe.utils.fmt_money(pf_g.list | sum(attribute="amount"), currency=doc.currency) }}')
    expect((html.match(/{% endfor %}/g) || []).length).toBe(2)
  })
  it('passes the checks before publishing, and a column with no calculation does not', () => {
    const good = tree([table({ rowIf: "item.qty", groupBy: "item_group", groupTotal: "amount", columns: [{ id: "a", label: "Line", kind: "calc", expr: "item.qty * item.rate" }] })], ["t"])
    expect(errors(good, [{ name: "items", isChild: true }])).toEqual([])
    const empty = tree([table({ columns: [{ id: "a", label: "Line", kind: "calc", expr: " " }] })], ["t"])
    expect(errors(empty).some(i => /no calculation/.test(i.message))).toBe(true)
  })
})

describe('copies, styles by condition and a second language', () => {
  it('prints the pages once under each copy name', () => {
    const t = tree([text("a", "hi")], ["a"], { settings: { copies: " Original , Duplicate,, " } })
    const html = toPrintFormatHtml(t)
    expect(html).toContain('{% for pf_copy in ["Original","Duplicate"] %}')
    expect(html).toContain('<div class="pf-copy">{{ _(pf_copy) }}</div>')
    expect(html).toContain('{% if not loop.last %}<div style="page-break-after:always;"></div>{% endif %}')
    expect(errors(t)).toEqual([])
    expect(toPrintFormatHtml(tree([text("a", "hi")], ["a"]))).not.toContain('{% for pf_copy')
  })
  it('adds a style only while its condition holds', () => {
    const t = tree([text("a", "{{ doc.outstanding_amount }}", { rules: [{ when: "doc.outstanding_amount > 0", color: "#c0392b", bold: true }, { when: "", color: "#000000" }] })], ["a"])
    const html = toPrintFormatHtml(t)
    expect(html).toContain('{% if doc.outstanding_amount > 0 %}color:#c0392b;font-weight:700;{% endif %}">')
    expect((html.match(/{% if doc\./g) || []).length).toBe(1)
    expect(errors(t)).toEqual([])
  })
  it('prints a second-language wording after the first', () => {
    const html = toPrintFormatHtml(tree([text("a", "Total", { content2: "Jumla <b>" })], ["a"]))
    expect(html).toContain('{{ _("Total") }} / Jumla &lt;b&gt;</div>')
  })
})

describe('hidden elements, shared blocks and an uploaded font', () => {
  it('leaves hidden elements out', () => {
    expect(toPrintFormatHtml(tree([text("a", "SECRET", { hidden: true }), text("b", "shown")], ["a", "b"]))).not.toContain('SECRET')
  })
  it('prints a shared block from the site', () => {
    const html = toPrintFormatHtml(tree([{ id: "s", type: "shared", children: [], w: "100%", h: 60, block: 'Head "A"' }], ["s"]))
    expect(html).toContain('{{ printforge_block("Head \\"A\\"", doc) }}')
  })
  it('renders a saved block on its own', () => {
    const html = toBlockHtml({ roots: ["c"], nodes: { c: box("c", ["a"]), a: text("a", "{{ doc.company }}") } })
    expect(html).toContain('{{ doc.get_formatted("company") }}')
    expect(html).not.toContain('pf-page')
  })
  it('declares an uploaded font and refuses anything that is not a plain file address', () => {
    const t = tree([text("a", "hi")], ["a"])
    const html = toPrintFormatHtml({ ...t, settings: { font: "custom", customFont: { name: "Brand Sans", url: "/files/printforge-font-abc.ttf" } } })
    expect(html).toContain('@font-face { font-family: "PF Brand Sans"; src: url(/files/printforge-font-abc.ttf); }')
    expect(html).toContain('font-family: "PF Brand Sans", ')
    const bad = toPrintFormatHtml({ ...t, settings: { font: "custom", customFont: { name: "x", url: "/files/a.ttf); } body { display:none" } } })
    expect(bad).not.toContain('@font-face')
  })
})

describe('grouping, other doctypes and colours', () => {
  const flat = () => {
    const at = (id, o = {}) => ({ ...mkT(0, 0), id, ...o })
    return { pages: [{ id: "p", roots: ["a", "b", "c"] }], nodes: { a: at("a", { content: "{{ doc.posting_date }}", color: "#7f2a7b" }), b: at("b", { content: "{{ doc.customer_name }} {{ doc.posting_date_x }}", bg: "#f3e8f2" }), c: at("c", { color: "#7F2A7B", showIf: "doc.posting_date" }) } }
  }
  it('wraps neighbours in a container where the first one was, and undoes it', () => {
    const [t, gid] = groupNodes(flat(), ["c", "a"])
    expect(t.pages[0].roots).toEqual([gid, "b"])
    expect(t.nodes[gid].children).toEqual(["a", "c"])
    const [back, kids] = ungroupNode(t, gid)
    expect(back.pages[0].roots).toEqual(["a", "c", "b"])
    expect(kids).toEqual(["a", "c"])
    expect(back.nodes[gid]).toBeUndefined()
  })
  it('refuses to group elements from different containers', () => {
    const [g, gid] = groupNodes(flat(), ["a", "b"])
    expect(groupNodes(g, [g.nodes[gid].children[0], "c"])).toEqual([g, null])
  })
  it('points a design at differently named fields without touching lookalikes', () => {
    const t = remapFields(flat(), { posting_date: "transaction_date" })
    expect(t.nodes.a.content).toBe("{{ doc.transaction_date }}")
    expect(t.nodes.b.content).toBe("{{ doc.customer_name }} {{ doc.posting_date_x }}")
    expect(t.nodes.c.showIf).toBe("doc.transaction_date")
  })
  it('lists colours however they were typed, and swaps one everywhere', () => {
    expect(designColours(flat())[0]).toEqual({ colour: "#7f2a7b", count: 2 })
    const t = replaceColours(flat(), { "#7f2a7b": "#0e8a7d" })
    expect([t.nodes.a.color, t.nodes.c.color, t.nodes.b.bg]).toEqual(["#0e8a7d", "#0e8a7d", "#f3e8f2"])
  })
  it('recolours a design around a brand colour, pale tints included', () => {
    expect(accentColour(flat())).toBe("#7f2a7b")
    const t = applyBrand(flat(), "#0e8a7d")
    expect(t.nodes.a.color).toBe("#0e8a7d")
    expect(t.nodes.b.bg).not.toBe("#f3e8f2")
    expect(designColours(t).some(c => c.colour === "#7f2a7b")).toBe(false)
    const grey = { pages: [{ id: "p", roots: ["a"] }], nodes: { a: { ...mkT(0, 0), id: "a", color: "#333333" } } }
    expect(applyBrand(grey, "#0e8a7d")).toBe(grey)
  })
})
