import os

import frappe
from frappe import _
from frappe.www.printview import get_font

no_cache = 1


def get_context(context):
	if frappe.session.user == "Guest":
		frappe.local.flags.redirect_location = "/login?redirect-to=/printforge"
		raise frappe.Redirect
	if not frappe.has_permission("Print Format", "write"):
		frappe.throw(_("You need write access to Print Format to use PrintForge."), frappe.PermissionError)

	bundle = frappe.get_app_path("printforge", "public", "dist", "printforge.js")
	context.no_cache = 1
	context.bundle_built = os.path.exists(bundle)
	context.build_version = int(os.path.getmtime(bundle)) if context.bundle_built else 0
	context.csrf_token = frappe.sessions.get_csrf_token()
	context.pf_user = frappe.session.user
	context.pf_site = frappe.local.site
	# The builder draws the page in the font the site prints with
	context.pf_print_font = get_font(frappe.get_single("Print Settings"))
