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
