from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

DESIGN_FIELD = "printforge_design"


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
