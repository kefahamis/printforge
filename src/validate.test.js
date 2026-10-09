import { describe, it, expect } from 'vitest'
import { lintJinja } from './linter.js'
import { validateDesign, referencedFields } from './validate.js'
import { serializeDesign, validateDesignFile, migrateDesign, loadDesignFile, CURRENT_VERSION } from './schema.js'
import { toPrintFormatHtml } from './exporter.js'
import { buildTree, buildSampleInvoiceTree, buildPurchaseOrderTree, buildDeliveryNoteTree, buildReportTree, TEMPLATES } from './tree.js'

describe('lintJinja', () => {
  it('accepts what the exporter generates for every starter design', () => {
    for (const build of [buildTree, buildSampleInvoiceTree, buildPurchaseOrderTree, buildDeliveryNoteTree]) {
      expect(lintJinja(toPrintFormatHtml(build()))).toEqual([])
    }
    expect(lintJinja(toPrintFormatHtml(buildReportTree([{ name: "account", label: "Account" }])))).toEqual([])
    const all = { ...buildTree(), settings: { letterHead: true, pageNumbers: true } }
    expect(lintJinja(toPrintFormatHtml(all))).toEqual([])
  })
  it('reports unbalanced braces, blocks and tags with their line', () => {
    expect(lintJinja('<div>{{ doc.name </div>')).toEqual([{ line: 1, message: "Unclosed '{{' brace." }])
    expect(lintJinja('{% if doc.x %}\n<p>a</p>').map(e => e.message)).toEqual(["Unclosed '{% if %}' block."])
    expect(lintJinja('a\n{%- endfor %}')).toEqual([{ line: 2, message: "Unexpected '{% endfor %}'." }])
    expect(lintJinja('<div><span></div>').map(e => e.message)).toEqual(["Unclosed HTML tag <span>."])
    expect(lintJinja('<br><img src="x"><hr/>')).toEqual([])
  })
})

describe('validateDesign', () => {
  const fields = [{ name: "customer_name" }, { name: "grand_total" }, { name: "items", isChild: true }]
  const check = (tree, name = "My Format", f = fields) => validateDesign(tree, "Sales Invoice", f, toPrintFormatHtml(tree), name)
  const messages = (issues, severity) => issues.filter(i => i.severity === severity).map(i => i.message)

  it('finds fields read directly or through the formatter', () => {
    expect([...referencedFields('{{ doc.get_formatted("grand_total") }} {{ doc.name }} {% if doc.meta.is_submittable %}')].sort()).toEqual(["grand_total", "meta", "name"])
  })
  it('warns about fields the doctype is not known to have, without blocking', () => {
    const issues = check(buildTree())
    expect(messages(issues, 'error')).toEqual([])
    expect(messages(issues, 'warning').some(m => m.includes('"doc.address_display"'))).toBe(true)
    expect(messages(issues, 'warning').some(m => m.includes('grand_total'))).toBe(false)
    expect(messages(issues, 'warning').some(m => m.includes('get_formatted'))).toBe(false)
  })
  it('says nothing about fields when there is no field list to check against', () => {
    expect(check(buildTree(), "My Format", [])).toEqual([])
  })
  it('blocks an empty design, a bad name, and tables that cannot work', () => {
    const empty = { nodes: {}, pages: [{ id: "p", roots: [] }] }
    expect(messages(check(empty, ""), 'error')).toEqual(['Print Format name is required.', 'The design is empty. Add at least one element.'])
    expect(messages(check(buildTree(), "a/b"), 'error')[0]).toMatch(/invalid characters/)

    const t = buildTree()
    const table = Object.values(t.nodes).find(n => n.type === "table")
    table.childField = "taxes"
    table.columns[0].field = "item name"
    const errors = messages(check(t), 'error')
    expect(errors.some(m => m.includes('"doc.taxes", which is not a child table'))).toBe(true)
    expect(errors.some(m => m.includes('not valid: "item name"'))).toBe(true)
  })
})

describe('design files', () => {
  it('round-trips the current shape', () => {
    const file = serializeDesign(buildTree(), "Sales Invoice", [{ name: "a", label: "A" }], [], { printFormat: "X" })
    expect(file.version).toBe(CURRENT_VERSION)
    const loaded = loadDesignFile(JSON.parse(JSON.stringify(file)))
    expect(loaded.doctype).toBe("Sales Invoice")
    expect(loaded.printFormat).toBe("X")
    expect(Object.keys(loaded.tree.nodes).length).toBe(Object.keys(file.tree.nodes).length)
  })
  it('upgrades files from before versioning', () => {
    const old = migrateDesign({ version: "1.1", doctype: "Sales Invoice", docFields: [{ name: "items", isChild: true }], tree: buildTree() })
    expect(old.version).toBe(2)
    expect(old.docFields[0].label).toBe("items")
    expect(old.assets).toEqual([])
  })
  it('explains what is wrong with a file that is not a design', () => {
    expect(validateDesignFile(null).errors).toEqual(['File is empty or not valid JSON.'])
    expect(() => loadDesignFile({ tree: { nodes: {}, pages: [] } })).toThrow(/at least one page[\s\S]*doctype/)
  })
})

describe('templates', () => {
  it('each builds a design and names the doctype and fields it is for', () => {
    for (const t of TEMPLATES) {
      const tree = t.build()
      expect(tree.pages.length).toBeGreaterThan(0)
      expect(t.doctype).toBeTruthy()
      if (t.id !== 'blank') {
        expect(Object.keys(tree.nodes).length).toBeGreaterThan(5)
        expect(t.docFields.some(f => f.isChild)).toBe(true)
        // every field a template reads is in its own field list
        const known = new Set(t.docFields.map(f => f.name))
        const unknown = validateDesign(tree, t.doctype, t.docFields, toPrintFormatHtml(tree), "X").filter(i => i.severity === 'warning')
        expect(unknown, t.id + ': ' + unknown.map(i => i.message).join(' ')).toEqual([])
        expect(known.size).toBeGreaterThan(3)
      }
    }
  })
})
