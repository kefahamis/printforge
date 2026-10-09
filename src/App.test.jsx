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
