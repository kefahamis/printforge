import { describe, it, expect } from 'vitest'
import { buildTree, buildReportTree, buildSampleInvoiceTree, treeAdd, treeRemove, treeMove, findParent, cloneTree, migrateTree, mkT, mkC, subst } from './tree.js'

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
