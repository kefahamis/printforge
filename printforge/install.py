import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

DESIGN_FIELD = "printforge_design"
# Lets someone design print formats without being a System Manager
DESIGNER_ROLE = "Print Designer"
GRANTED_KEY = "printforge_designer_role_granted"


def after_install():
	ensure_custom_fields()
	ensure_designer_role()


def after_migrate():
	ensure_custom_fields()
	ensure_designer_role()


def ensure_custom_fields():
	create_custom_fields(
		{
			"Print Format": [
				{
					"fieldname": DESIGN_FIELD,
					"label": "PrintForge Design",
					"fieldtype": "Long Text",
					"insert_after": "html",
					"hidden": 1,
					"read_only": 1,
					"no_copy": 1,
					"print_hide": 1,
				}
			]
		},
		update=True,
	)


def ensure_designer_role():
	"""Create the Print Designer role and let it make and change Print Formats.

	The permission is granted once per site, so a site that later narrows or removes it in
	the Role Permission Manager keeps its own choice. The role's existence cannot serve as
	the marker: Frappe creates roles named in an app's doctypes and pages while syncing them.
	"""
	if not frappe.db.exists("Role", DESIGNER_ROLE):
		frappe.get_doc({"doctype": "Role", "role_name": DESIGNER_ROLE, "desk_access": 1}).insert(ignore_permissions=True)
	if frappe.db.get_default(GRANTED_KEY):
		return

	from frappe.permissions import add_permission, update_permission_property

	if not frappe.db.exists("Custom DocPerm", {"parent": "Print Format", "role": DESIGNER_ROLE, "permlevel": 0}):
		add_permission("Print Format", DESIGNER_ROLE, 0)
		for ptype in ("write", "create"):
			update_permission_property("Print Format", DESIGNER_ROLE, 0, ptype, 1)
	frappe.db.set_default(GRANTED_KEY, 1)
