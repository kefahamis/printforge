import json
from urllib.parse import quote

import frappe
from frappe import _
from frappe.utils import cint, flt

from printforge.install import DESIGN_FIELD

LAYOUT_FIELDTYPES = {"Section Break", "Column Break", "Tab Break", "HTML", "Button", "Fold", "Heading"}
MARGIN_FIELDS = ("margin_top", "margin_bottom", "margin_left", "margin_right")


def _check_permission():
	frappe.has_permission("Print Format", "write", throw=True)


def _check_doctype(doctype):
	if not doctype or not frappe.db.exists("DocType", doctype):
		frappe.throw(_("DocType {0} does not exist on this site.").format(doctype or ""), frappe.DoesNotExistError)


@frappe.whitelist()
def get_doctype_fields(doctype):
	"""Fields of a doctype in the shape the builder's field list uses."""
	_check_permission()
	_check_doctype(doctype)
	fields = [{"name": "name", "label": "ID", "isChild": False}]
	for df in frappe.get_meta(doctype).fields:
		if df.fieldtype in LAYOUT_FIELDTYPES:
			continue
		fields.append(
			{
				"name": df.fieldname,
				"label": df.label or df.fieldname,
				"isChild": df.fieldtype == "Table",
			}
		)
	return fields


@frappe.whitelist()
def list_designs():
	"""Print Formats that were published from the builder."""
	_check_permission()
	return frappe.get_all(
		"Print Format",
		filters={DESIGN_FIELD: ["is", "set"]},
		fields=["name", "doc_type", "modified"],
		order_by="modified desc",
	)


@frappe.whitelist()
def get_design(print_format):
	_check_permission()
	doc = frappe.get_doc("Print Format", print_format)
	design = doc.get(DESIGN_FIELD)
	if not design:
		frappe.throw(_("{0} was not made with PrintForge, so there is no design to open.").format(print_format))
	return {"name": doc.name, "doc_type": doc.doc_type, "design": design}


@frappe.whitelist(methods=["POST"])
def publish(print_format, doctype, html, design, make_default=0, margin_mm=None):
	"""Create or update a custom Jinja Print Format from a builder design."""
	_check_permission()
	_check_doctype(doctype)

	print_format = (print_format or "").strip()
	if not print_format:
		frappe.throw(_("Give the Print Format a name."))
	if not html:
		frappe.throw(_("The design is empty."))
	if not isinstance(design, str):
		design = json.dumps(design)
	try:
		json.loads(design)
	except ValueError:
		frappe.throw(_("The design data is not valid JSON."))

	created = not frappe.db.exists("Print Format", print_format)
	if created:
		doc = frappe.new_doc("Print Format")
		doc.name = print_format
	else:
		doc = frappe.get_doc("Print Format", print_format)
		if doc.standard == "Yes":
			frappe.throw(_("{0} is a standard Print Format. Publish under a different name.").format(print_format))
		if not doc.get(DESIGN_FIELD):
			frappe.throw(
				_("A Print Format named {0} already exists and was not made with PrintForge. Publish under a different name.").format(print_format)
			)

	doc.update(
		{
			"doc_type": doctype,
			"standard": "No",
			"custom_format": 1,
			"print_format_type": "Jinja",
			"disabled": 0,
			"html": html,
			DESIGN_FIELD: design,
		}
	)
	if margin_mm is not None:
		for fieldname in MARGIN_FIELDS:
			if doc.meta.has_field(fieldname):
				doc.set(fieldname, flt(margin_mm))

	if created:
		doc.insert()
	else:
		doc.save()

	is_default = bool(cint(make_default))
	if is_default:
		from frappe.printing.doctype.print_format.print_format import make_default as set_default

		set_default(doc.name)

	return {
		"name": doc.name,
		"created": created,
		"is_default": is_default,
		"route": "/app/print-format/" + quote(doc.name),
	}
