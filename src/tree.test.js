import { describe, it, expect } from 'vitest'
import { buildTree, buildReportTree, buildSampleInvoiceTree, treeAdd, treeRemove, treeMove, findParent, cloneTree, migrateTree, mkT, mkC, subst, copyNodes, pasteNodes, alignNodes, distributeNodes, isFree } from './tree.js'
import { DOC_TEMPLATES, BLOCKS, fieldsFromTree } from './templates.js'
import { toPrintFormatHtml } from './exporter.js'

const allIds = tree => tree.pages.flatMap(p => p.roots)
const wellFormed = tree => {
  const seen = new Set()
  const walk = id => {
    expect(tree.nodes[id], 'node ' + id + ' exists').toBeTruthy()
    expect(seen.has(id), 'node ' + id + ' appears once').toBe(false)
    seen.add(id)
    ;(tree.nodes[id].children || []).forEach(walk)
  }
  allIds(tree).forEach(walk)
  expect(seen.size).toBe(Object.keys(tree.nodes).length) // no orphans
}

describe('starter designs', () => {
  it('are well-formed trees', () => {
    wellFormed(buildTree())
    wellFormed(buildSampleInvoiceTree())
    wellFormed(buildReportTree([{ name: "account", label: "Account" }]))
  })
  it('the invoice only uses fields a Sales Invoice has', () => {
    const text = Object.values(buildTree().nodes).map(n => n.content || "").join(" ")
    expect(text).toContain('{{ doc.address_display }}')
    expect(text).toContain('{{ doc.company_address_display }}')
    expect(text).not.toMatch(/doc\.(customer_address|company_address|company_logo)\s*\}\}/)
  })
  it('the report starter builds one column per report column, right-aligning numbers', () => {
    const t = buildReportTree([{ name: "account", label: "Account", fieldtype: "Link" }, { name: "balance", label: "Balance", fieldtype: "Currency" }])
    const table = Object.values(t.nodes).find(n => n.type === "table")
    expect(table.columns.map(c => [c.field, c.align])).toEqual([["account", "left"], ["balance", "right"]])
    expect(t.settings.printFor).toBe("Report")
  })
})

describe('tree operations', () => {
  const base = () => ({ nodes: {}, pages: [{ id: "p", name: "Page 1", roots: [], padding: 40 }] })
  it('adds to the page or to a parent', () => {
    const box = mkC(), label = mkT()
    let t = treeAdd(base(), box, null)
    t = treeAdd(t, label, box.id)
    expect(t.pages[0].roots).toEqual([box.id])
    expect(t.nodes[box.id].children).toEqual([label.id])
    expect(findParent(t, label.id)).toBe(box.id)
  })
  it('removes an element together with everything inside it', () => {
    const box = mkC(), label = mkT()
    const t = treeRemove(treeAdd(treeAdd(base(), box, null), label, box.id), box.id)
    expect(t.nodes).toEqual({})
    expect(t.pages[0].roots).toEqual([])
  })
  it('moves an element between parents without duplicating it', () => {
    const a = mkC(), b = mkC(), label = mkT()
    let t = treeAdd(treeAdd(treeAdd(base(), a, null), b, null), label, a.id)
    t = treeMove(t, label.id, b.id)
    expect(t.nodes[a.id].children).toEqual([])
    expect(t.nodes[b.id].children).toEqual([label.id])
    wellFormed(t)
  })
  it('clones a subtree with fresh ids', () => {
    const box = { ...mkC(), children: [] }, label = mkT()
    const nodes = { [box.id]: { ...box, children: [label.id] }, [label.id]: label }
    const [newId, copies] = cloneTree(nodes, box.id)
    expect(Object.keys(copies)).toHaveLength(2)
    expect(newId).not.toBe(box.id)
    expect(copies[newId].children[0]).not.toBe(label.id)
  })
})

describe('migrateTree', () => {
  it('fills in defaults for designs saved by older versions', () => {
    const t = migrateTree({ nodes: { a: { id: "a", type: "text", content: "hi" } }, roots: ["a"] })
    expect(t.pages[0].roots).toEqual(["a"])
    expect(t.pages[0].padding).toBe(40)
    expect(t.nodes.a.fontSize).toBe(13)
    expect(t.settings).toMatchObject({ pageSize: "A4", orientation: "Portrait", letterHead: false, printFor: "DocType" })
  })
  it('keeps page setup that was saved with the design', () => {
    const t = migrateTree({ nodes: {}, pages: [{ id: "p", roots: [] }], settings: { pageSize: "Letter", printFor: "Report" } })
    expect(t.settings).toMatchObject({ pageSize: "Letter", printFor: "Report" })
  })
})

describe('sample preview', () => {
  it('fills document and row fields, leaving unknown ones visible', () => {
    expect(subst('{{ doc.customer_name }}')).toBe('Tagrit')
    expect(subst('{{item.qty}}', { qty: 5 })).toBe('5')
    expect(subst('{{ doc.no_such_field }}')).toBe('{{ doc.no_such_field }}')
  })
})

describe('several elements at once', () => {
  const free = () => {
    const c = { ...mkC(0, 0), id: "c", mode: "free", children: ["a", "b", "d"] }
    const at = (id, x, y, w = 20, h = 10) => ({ ...mkT(x, y), id, w, h })
    return { pages: [{ id: "p", roots: ["c"] }], nodes: { c, a: at("a", 10, 10), b: at("b", 50, 40, 40), d: at("d", 200, 100) } }
  }
  it('copies whole elements once and pastes them with fresh ids', () => {
    const t = free()
    const clip = copyNodes(t, ["c", "a"]) // a is inside c, so it comes along only as part of it
    expect(clip.roots).toEqual(["c"])
    expect(Object.keys(clip.nodes).sort()).toEqual(["a", "b", "c", "d"])
    const [next, added] = pasteNodes(t, JSON.parse(JSON.stringify(clip)), null, 0)
    expect(added.length).toBe(1)
    expect(next.pages[0].roots).toEqual(["c", added[0]])
    expect(Object.keys(next.nodes).length).toBe(8)
    wellFormed(next)
  })
  it('ignores a clipboard that is not a PrintForge copy', () => {
    const t = free()
    expect(pasteNodes(t, { roots: ["x"] }, null, 0)).toEqual([t, []])
    expect(pasteNodes(t, null, null, 0)).toEqual([t, []])
  })
  it('lines elements up on a shared edge or centre', () => {
    const t = free()
    expect(alignNodes(t, ["a", "b", "d"], "left").nodes.d.x).toBe(10)
    expect(alignNodes(t, ["a", "b"], "right").nodes.a.x).toBe(70)
    expect(alignNodes(t, ["a", "b"], "vcenter").nodes.a.y).toBe(25)
  })
  it('spaces three or more evenly between the outer two', () => {
    const t = distributeNodes(free(), ["a", "b", "d"], "h")
    expect([t.nodes.a.x, t.nodes.b.x, t.nodes.d.x]).toEqual([10, 95, 200])
  })
  it('knows which elements have a position of their own', () => {
    const t = free()
    expect(isFree(t, "a")).toBe(true)
    expect(isFree(t, "c")).toBe(false)
  })
})

describe('ready-made designs', () => {
  it('are well-formed and name only one doctype each', () => {
    for (const tpl of DOC_TEMPLATES) {
      const t = migrateTree(tpl.build())
      wellFormed(t)
      expect(toPrintFormatHtml(t), tpl.id).not.toContain('Error generating')
      expect(fieldsFromTree(t).some(f => f.name === (tpl.report ? "posting_date" : "name")), tpl.id).toBe(true)
    }
  })
  it('blocks come as an element followed by what is inside it', () => {
    for (const b of BLOCKS) {
      const [root, ...rest] = b.create()
      const inside = new Set(rest.map(n => n.id))
      const walk = n => (n.children || []).forEach(id => { expect(inside.has(id), b.label).toBe(true); walk(rest.find(r => r.id === id)) })
      walk(root)
    }
  })
  it('lists the fields a design uses, with table columns', () => {
    const fields = fieldsFromTree(migrateTree(DOC_TEMPLATES.find(t => t.id === "tax-invoice").build()))
    const names = fields.map(f => f.name)
    expect(names).toEqual(expect.arrayContaining(["name", "customer_name", "grand_total", "tax_id", "items"]))
    expect(fields.find(f => f.name === "items").columns.map(c => c.name)).toContain("item_name")
  })
})
