

// ── Frappe site ───────────────────────────────────────────────────────────────
// Set by the /printforge page of the Frappe app; absent when run standalone with Vite.
export const FRAPPE = typeof window !== "undefined" ? window.PF_FRAPPE || null : null;

export async function frappeCall(method, args = {}) {
  const res = await fetch("/api/method/printforge.api." + method, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "Accept": "application/json", "X-Frappe-CSRF-Token": FRAPPE?.csrf_token || "" },
    body: JSON.stringify(args)
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* non-JSON error page */ }
  if (!res.ok) {
    let msg = "";
    try { msg = JSON.parse(data._server_messages).map(m => JSON.parse(m).message).join(" "); } catch (e) { /* no server message */ }
    msg = (msg || data?.exception || res.status + " " + res.statusText).replace(/<[^>]+>/g, "");
    const err = new Error(msg);
    err.excType = data?.exc_type || "";
    throw err;
  }
  return data?.message;
}

// For endpoints that answer with a file. Returns an object URL for the PDF.
export async function frappePdf(method, args = {}) {
  const res = await fetch("/api/method/printforge.api." + method, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-Frappe-CSRF-Token": FRAPPE?.csrf_token || "" },
    body: JSON.stringify(args)
  });
  if (!res.ok) {
    let msg = "";
    try { msg = JSON.parse((await res.json())._server_messages).map(m => JSON.parse(m).message).join(" "); } catch (e) { /* no server message */ }
    throw new Error((msg || res.status + " " + res.statusText).replace(/<[^>]+>/g, ""));
  }
  return URL.createObjectURL(await res.blob());
}
