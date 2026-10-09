

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
    throw new Error(msg);
  }
  return data?.message;
}
