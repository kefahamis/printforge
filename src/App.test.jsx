// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

// FRAPPE is read once when the modules load, so each test loads the app fresh
const loadApp = async () => (await import('./App.jsx')).default
const button = name => screen.getByRole('button', { name })

// Newer Node versions ship their own global localStorage, which shadows jsdom's and does
// nothing without a backing file, so the tests bring a plain in-memory one.
const memoryStorage = () => {
  const data = new Map()
  return { getItem: k => data.has(k) ? data.get(k) : null, setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k), clear: () => data.clear() }
}

beforeEach(() => {
  vi.resetModules()
  vi.stubGlobal('localStorage', memoryStorage())
  delete window.PF_FRAPPE
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('standalone', () => {
  it('opens on the starter invoice with no site actions', async () => {
    const App = await loadApp()
    render(<App />)
    expect(screen.getAllByText('INVOICE', { exact: false }).length).toBeGreaterThan(0)
    expect(button('Copy Jinja')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull()
  })

  it('shows the Print Format HTML in the Jinja view', async () => {
    const App = await loadApp()
    const { container } = render(<App />)
    fireEvent.click(button('Jinja'))
    const code = container.querySelector('pre').textContent
    expect(code).toContain('<div class="pf-doc">')
    expect(code).toContain('doc.get_formatted("grand_total")')
  })

  it('page setup changes the exported paper size', async () => {
    const App = await loadApp()
    const { container } = render(<App />)
    const paper = [...container.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === 'Letter'))
    fireEvent.change(paper, { target: { value: 'Letter' } })
    fireEvent.click(button('Jinja'))
    expect(container.querySelector('pre').textContent).toContain('page-size: Letter')
  })
})

describe('on a Frappe site', () => {
  const calls = []
  beforeEach(() => {
    calls.length = 0
    window.PF_FRAPPE = { csrf_token: 'tok', user: 'Administrator', site: 'erp.test', print_font: 'Inter, sans-serif' }
    vi.stubGlobal('fetch', vi.fn(async (url, opts) => {
      const method = url.split('.').pop()
      const args = JSON.parse(opts.body)
      calls.push({ method, args, csrf: opts.headers['X-Frappe-CSRF-Token'] })
      if (method === 'publish' && args.print_format === 'Standard') {
        return { ok: false, status: 417, statusText: 'Expectation Failed', json: async () => ({ _server_messages: JSON.stringify([JSON.stringify({ message: 'Standard is a standard Print Format.' })]) }) }
      }
      const message = method === 'publish' ? { name: args.print_format, created: true, is_default: !!args.make_default, route: '/app/print-format/x', design: null } : []
      return { ok: true, status: 200, json: async () => ({ message }) }
    }))
  })

  it('publishes the design as a Print Format for the doctype', async () => {
    const App = await loadApp()
    render(<App />)
    fireEvent.click(button('Publish'))
    fireEvent.click(screen.getAllByRole('button', { name: 'Publish' }).pop())
    await waitFor(() => expect(screen.getByText(/Created “Sales Invoice PrintForge”/)).toBeTruthy())

    const sent = calls.find(c => c.method === 'publish')
    expect(sent.csrf).toBe('tok')
    expect(sent.args).toMatchObject({ print_format: 'Sales Invoice PrintForge', doctype: 'Sales Invoice', print_for: 'DocType', make_default: 0, margin_mm: 10.6 })
    expect(sent.args.html).toContain('<div class="pf-doc">')
    expect(JSON.parse(sent.args.design).tree.pages).toHaveLength(1)

    fireEvent.click(button('Close'))
    expect(button('Update Print Format')).toBeTruthy()
  })

  it('shows the reason when the site refuses', async () => {
    const App = await loadApp()
    const { container } = render(<App />)
    fireEvent.click(button('Publish'))
    const nameInput = [...container.querySelectorAll('input.pi')].pop()
    fireEvent.change(nameInput, { target: { value: 'Standard' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Publish' }).pop())
    await waitFor(() => expect(screen.getByText('Standard is a standard Print Format.')).toBeTruthy())
    expect(screen.queryByText(/Created/)).toBeNull()
  })
})

describe('editing on the canvas', () => {
  const saved = () => JSON.parse(localStorage.getItem('pf_current')).tree
  const count = () => Number(/(\d+) elements/.exec(document.body.textContent)[1])

  it('adds an element, deletes it with the keyboard and brings it back with undo', async () => {
    const App = await loadApp()
    render(<App />)
    const before = count()
    fireEvent.click(button('Text'))
    expect(count()).toBe(before + 1)
    fireEvent.keyDown(window, { key: 'Delete' })
    expect(count()).toBe(before)
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
    expect(count()).toBe(before + 1)
  })

  it('selects an element when it is pressed and shows its properties', async () => {
    const App = await loadApp()
    const { container } = render(<App />)
    const table = Object.values(saved().nodes).find(n => n.type === 'table')
    fireEvent.mouseDown(container.querySelector(`[data-pf-node="${table.id}"]`))
    expect(screen.getByText('Columns')).toBeTruthy()
    expect(container.querySelectorAll('.rh')).toHaveLength(8)
  })

  it('resizes the selected element by dragging a handle, allowing for zoom', async () => {
    const App = await loadApp()
    const { container } = render(<App />)
    fireEvent.click(button('Text'))
    const added = () => Object.values(saved().nodes).find(n => n.content === '{{ doc.field_name }}')
    expect(added().w).toBe(240)
    fireEvent.mouseDown(container.querySelector('.rh-e'), { clientX: 0, clientY: 0 })
    fireEvent.mouseMove(window, { clientX: 76, clientY: 0 }) // 76 screen px at 76% zoom = 100 page px
    fireEvent.mouseUp(window)
    expect(added().w).toBe(340)
  })

  it('keeps working when browser storage is full, and says so', async () => {
    localStorage.setItem = () => { throw new DOMException('quota', 'QuotaExceededError') }
    const App = await loadApp()
    render(<App />)
    expect(screen.getByText(/Not being autosaved in this browser/)).toBeTruthy()
    fireEvent.click(button('Text'))
    expect(screen.getByText(/Not being autosaved in this browser/)).toBeTruthy()
  })
})

describe('publishing over a newer copy', () => {
  it('stops, explains, and only replaces it when told to', async () => {
    const sent = []
    window.PF_FRAPPE = { csrf_token: 'tok', user: 'Administrator', site: 'erp.test', print_font: 'Inter, sans-serif' }
    vi.stubGlobal('fetch', vi.fn(async (url, opts) => {
      const method = url.split('.').pop()
      const args = JSON.parse(opts.body)
      if (method !== 'publish') return { ok: true, status: 200, json: async () => ({ message: [] }) }
      sent.push(args)
      if (!args.overwrite) {
        return { ok: false, status: 417, statusText: 'Expectation Failed', json: async () => ({ exc_type: 'TimestampMismatchError', _server_messages: JSON.stringify([JSON.stringify({ message: 'Changed on the site by someone else.' })]) }) }
      }
      return { ok: true, status: 200, json: async () => ({ message: { name: args.print_format, created: false, is_default: false, modified: '2026-10-09 21:00:00', route: '/x', design: null } }) }
    }))
    const App = await loadApp()
    render(<App />)
    fireEvent.click(button('Publish'))
    fireEvent.click(screen.getAllByRole('button', { name: 'Publish' }).pop())
    await waitFor(() => expect(screen.getByText('Changed on the site by someone else.')).toBeTruthy())
    expect(sent).toHaveLength(1)

    fireEvent.click(button('Replace it'))
    await waitFor(() => expect(screen.getByText(/Updated “Sales Invoice PrintForge”/)).toBeTruthy())
    expect(sent[1].overwrite).toBe(1)
  })
})

describe('several elements and ready-made designs', () => {
  const saved = () => JSON.parse(localStorage.getItem('pf_current'))
  const count = () => Object.keys(saved().tree.nodes).length
  const roots = () => saved().tree.pages[0].roots

  it('selects more with Shift, then copies, pastes and deletes them together', async () => {
    const App = await loadApp()
    const { container } = render(<App />)
    const before = count()
    const [first, second] = roots()
    const size = id => 1 + (function inside(n) { return (n.children || []).reduce((a, c) => a + 1 + inside(saved().tree.nodes[c]), 0) })(saved().tree.nodes[id])
    fireEvent.mouseDown(container.querySelector(`[data-pf-node="${first}"]`))
    fireEvent.mouseDown(container.querySelector(`[data-pf-node="${second}"]`), { shiftKey: true })
    expect(screen.getByText('2 elements selected')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'c', ctrlKey: true })
    fireEvent.keyDown(window, { key: 'v', ctrlKey: true })
    expect(count()).toBe(before + size(first) + size(second))
    expect(roots().length).toBe(7) // beside the originals, not inside the copied container
    expect(screen.getByText('2 elements selected')).toBeTruthy() // the pasted pair
    fireEvent.keyDown(window, { key: 'Delete' })
    expect(count()).toBe(before)
  })

  it('opens a ready-made design for its doctype', async () => {
    const App = await loadApp()
    render(<App />)
    fireEvent.click(button(/^New$/))
    fireEvent.click(screen.getByText('Till receipt'))
    expect(saved().doctype).toBe('Sales Invoice')
    expect(saved().tree.settings.pageSize).toBe('Custom')
    expect(Object.values(saved().tree.nodes).some(n => n.type === 'qr')).toBe(true)
    expect(screen.getAllByText(/80 x 200 mm/).length).toBeGreaterThan(0)
  })
})

describe('templates, commands and messages', () => {
  const count = () => Number(/(\d+) elements/.exec(document.body.textContent)[1])

  it('opens the command palette with Ctrl+K and runs the chosen command', async () => {
    const App = await loadApp()
    render(<App />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const input = screen.getByLabelText('Command')
    fireEvent.change(input, { target: { value: 'template' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByText('Start from a template')).toBeTruthy()
  })

  it('a template replaces the design and brings its doctype and fields, and undo brings the old one back', async () => {
    const App = await loadApp()
    render(<App />)
    const before = count()
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    fireEvent.change(screen.getByLabelText('Command'), { target: { value: 'gallery' } })
    fireEvent.keyDown(screen.getByLabelText('Command'), { key: 'Enter' })
    fireEvent.click(screen.getByText('Purchase Order'))
    expect(screen.getByTitle('Document type and fields').textContent).toBe('/Purchase Order')
    expect(count()).toBeGreaterThan(before)
    const saved = JSON.parse(localStorage.getItem('pf_current'))
    expect(saved.version).toBe(2)
    expect(saved.docFields.some(f => f.name === 'supplier_name')).toBe(true)
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
    expect(count()).toBe(before)
  })

  it('offers an undo after deleting', async () => {
    const App = await loadApp()
    render(<App />)
    fireEvent.click(button('Text'))
    const withText = count()
    fireEvent.keyDown(window, { key: 'Delete' })
    expect(screen.getByText('Deleted a text element')).toBeTruthy()
    fireEvent.click(button('Undo'))
    expect(count()).toBe(withText)
    expect(screen.queryByText('Deleted a text element')).toBeNull()
  })

  it('says what is wrong with a file that is not a design', async () => {
    const App = await loadApp()
    const { container } = render(<App />)
    const file = new File([JSON.stringify({ tree: { nodes: {}, pages: [] } })], 'broken.json', { type: 'application/json' })
    fireEvent.change(container.querySelector('#json-import'), { target: { files: [file] } })
    await waitFor(() => expect(screen.getByText('Could not import broken.json')).toBeTruthy())
    expect(screen.getByText(/Design must have at least one page/)).toBeTruthy()
  })

  it('the V key switches the Move tool', async () => {
    const App = await loadApp()
    render(<App />)
    const tool = screen.getByTitle(/Move tool/)
    expect(tool.getAttribute('aria-pressed')).toBe('false')
    fireEvent.keyDown(window, { key: 'v' })
    expect(tool.getAttribute('aria-pressed')).toBe('true')
  })

  it('standalone publishing checks the design and needs a tested connection', async () => {
    const App = await loadApp()
    render(<App />)
    fireEvent.click(button('Export'))
    fireEvent.click(screen.getByText('To an ERPNext site…'))
    expect(screen.getByText('Publish to an ERPNext site')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Publish' }).pop().disabled).toBe(true)
  })
})

describe('checks before publishing on a site', () => {
  it('blocks publishing while the design has a problem', async () => {
    window.PF_FRAPPE = { csrf_token: 'tok', user: 'Administrator', site: 'erp.test', print_font: 'Inter, sans-serif' }
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ message: [] }) })))
    const App = await loadApp()
    const { container } = render(<App />)
    fireEvent.click(button('Publish'))
    const nameInput = [...container.querySelectorAll('input.pi')].pop()
    fireEvent.change(nameInput, { target: { value: 'a/b' } })
    expect(screen.getByText(/invalid characters/)).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Publish' }).pop().disabled).toBe(true)
  })
})
