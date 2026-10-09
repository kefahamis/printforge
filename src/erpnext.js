// Publishing from the standalone builder, where there is no logged-in Frappe session:
// creates or updates a custom Print Format through the site's REST API with an API key.
// Opened inside a Frappe site the builder publishes through its own app instead
// (see frappe.js), which also stores the editable design and needs no key.

const SETTINGS_KEY = 'pf_erpnext';
const EMPTY = { url: '', apiKey: '', apiSecret: '' };

export function getErpSettings() {
  try { return { ...EMPTY, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; }
  catch { return { ...EMPTY }; }
}

export function saveErpSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* storage full: not remembered */ }
}

function siteFetch(s, path, init = {}) {
  const base = s.url.replace(/\/+$/, '');
  return fetch(base + path, {
    ...init,
    headers: {
      'Authorization': `token ${s.apiKey}:${s.apiSecret}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(init.headers || {}),
    },
  });
}

export async function testConnection(s) {
  try {
    const r = await siteFetch(s, '/api/method/frappe.auth.get_logged_user');
    if (!r.ok) return { ok: false, message: `Authentication failed (HTTP ${r.status}). Check the API key and secret.` };
    const d = await r.json();
    return { ok: true, message: `Connected as ${d.message}` };
  } catch (e) {
    return { ok: false, message: `Cannot reach the site: ${e.message}. Check the URL, and that the site allows this page's origin (allow_cors in site_config.json).` };
  }
}

/**
 * `html` is the Print Format fragment. `reportName` is set for report formats, which use
 * Frappe's browser template engine rather than Jinja.
 */
export async function publishPrintFormat(s, formatName, doctype, html, { report = false, marginMm = null } = {}) {
  const body = {
    module: 'Custom',
    custom_format: 1,
    standard: 'No',
    disabled: 0,
    html,
    ...(report
      ? { print_format_for: 'Report', report: doctype, print_format_type: 'JS' }
      : { doc_type: doctype, print_format_type: 'Jinja' }),
    ...(marginMm != null ? { margin_top: marginMm, margin_bottom: marginMm, margin_left: marginMm, margin_right: marginMm } : {}),
  };
  const encoded = encodeURIComponent(formatName);
  try {
    const existing = await siteFetch(s, `/api/resource/Print Format/${encoded}`);
    let r;
    if (existing.ok) {
      r = await siteFetch(s, `/api/resource/Print Format/${encoded}`, { method: 'PUT', body: JSON.stringify(body) });
    } else if (existing.status === 404) {
      r = await siteFetch(s, '/api/resource/Print Format', { method: 'POST', body: JSON.stringify({ ...body, name: formatName }) });
    } else {
      return { ok: false, message: `The site returned HTTP ${existing.status} when checking for an existing format.` };
    }
    if (!r.ok) {
      let detail = `HTTP ${r.status}`;
      try {
        const err = await r.json();
        const srv = err._server_messages ? JSON.parse(err._server_messages).map(m => JSON.parse(m).message).join('; ') : err.exception;
        if (srv) detail = srv.replace(/<[^>]+>/g, '');
      } catch { /* keep the generic detail */ }
      return { ok: false, message: `Publish failed: ${detail}` };
    }
    const base = s.url.replace(/\/+$/, '');
    return {
      ok: true,
      created: !existing.ok,
      message: existing.ok ? `Updated "${formatName}" on ${base}` : `Created "${formatName}" on ${base}`,
      link: `${base}/app/print-format/${encoded}`,
    };
  } catch (e) {
    return { ok: false, message: `Network error: ${e.message}` };
  }
}
