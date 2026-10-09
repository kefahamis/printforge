import base64
import hashlib
import json
import re
from urllib.parse import quote

import frappe
from frappe import _
from frappe.utils import cint, flt

from printforge.install import DESIGN_FIELD

LAYOUT_FIELDTYPES = {"Section Break", "Column Break", "Tab Break", "HTML", "Button", "Fold", "Heading"}
MARGIN_FIELDS = ("margin_top", "margin_bottom", "margin_left", "margin_right")
DATA_IMAGE = re.compile(r"data:image/(png|jpe?g|gif|webp|svg\+xml);base64,([A-Za-z0-9+/=]+)")
IMAGE_EXT = {"jpeg": "jpg", "svg+xml": "svg"}


def _check_permission():
	frappe.has_permission("Print Format", "write", throw=True)


def _check_doctype(doctype):
	if not doctype or not frappe.db.exists("DocType", doctype):
		frappe.throw(_("DocType {0} does not exist on this site.").format(doctype or ""), frappe.DoesNotExistError)


@frappe.whitelist()
def list_doctypes():
	"""Doctypes a print format can be made for."""
	_check_permission()
	return frappe.get_all(
		"DocType", filters={"istable": 0, "issingle": 0}, pluck="name", order_by="name asc", limit_page_length=0
	)


@frappe.whitelist()
def get_doctype_fields(doctype):
	"""Fields of a doctype in the shape the builder's field list uses."""
	_check_permission()
	_check_doctype(doctype)
	fields = [{"name": "name", "label": "ID", "isChild": False, "fieldtype": "Data"}]
	for df in frappe.get_meta(doctype).fields:
		if df.fieldtype in LAYOUT_FIELDTYPES:
			continue
		fields.append(
			{
				"name": df.fieldname,
				"label": df.label or df.fieldname,
				"isChild": df.fieldtype == "Table",
				"fieldtype": df.fieldtype,
			}
		)
	return fields


@frappe.whitelist()
def list_reports():
	"""Reports a print format can be made for."""
	_check_permission()
	return frappe.get_all("Report", filters={"disabled": 0}, pluck="name", order_by="name asc", limit_page_length=0)


@frappe.whitelist()
def get_report_columns(report):
	"""Columns of a report in the shape the builder's field list uses.

	Columns are only known once a report has run, so this runs it without filters. Reports
	that need filters fail that run; the list then comes back empty and columns are typed in.
	"""
	from frappe.desk.query_report import get_report_doc, run

	_check_permission()
	if not report or not frappe.db.exists("Report", report):
		frappe.throw(_("Report {0} does not exist on this site.").format(report or ""), frappe.DoesNotExistError)
	get_report_doc(report)  # enforces the report's own permissions

	try:
		columns = run(report, filters={}, ignore_prepared_report=True).get("columns") or []
	except Exception:
		frappe.clear_messages()
		columns = []

	fields = []
	for col in columns:
		if isinstance(col, str):
			label = col.split(":")[0]
			col = {"label": label, "fieldname": frappe.scrub(label), "fieldtype": (col.split(":") + ["Data"])[1].split("/")[0]}
		if col.get("fieldname"):
			fields.append(
				{
					"name": col.get("fieldname"),
					"label": col.get("label") or col.get("fieldname"),
					"isChild": False,
					"fieldtype": col.get("fieldtype") or "Data",
				}
			)
	return fields


@frappe.whitelist()
def recent_docs(doctype):
	"""Names of recently changed documents the user can read, to pick one for a preview."""
	_check_permission()
	_check_doctype(doctype)
	return frappe.get_list(doctype, pluck="name", order_by="modified desc", limit_page_length=20)


@frappe.whitelist(methods=["POST"])
def preview(doctype, docname, html):
	"""Render unsaved builder output for a real document through Frappe's own print pipeline."""
	from frappe.utils.jinja_globals import bundled_asset
	from frappe.www.printview import get_print_style, get_rendered_template, set_link_titles

	_check_permission()
	_check_doctype(doctype)
	if not frappe.db.exists(doctype, docname):
		frappe.throw(_("{0} {1} does not exist.").format(_(doctype), docname), frappe.DoesNotExistError)

	doc = frappe.get_doc(doctype, docname)
	doc.check_permission("print")

	# Never saved: only stands in for the Print Format the design would be published as
	print_format = frappe.new_doc("Print Format")
	print_format.update(
		{
			"name": "PrintForge Preview",
			"doc_type": doctype,
			"standard": "No",
			"custom_format": 1,
			"print_format_type": "Jinja",
			"html": html,
		}
	)

	set_link_titles(doc)
	return {
		"html": get_rendered_template(doc, print_format=print_format, meta=doc.meta),
		"style": get_print_style(print_format=print_format),
		"css_url": bundled_asset("print.bundle.css"),
	}


@frappe.whitelist()
def list_designs():
	"""Print Formats that were published from the builder."""
	_check_permission()
	fields = ["name", "doc_type", "modified"]
	if frappe.get_meta("Print Format").has_field("report"):
		fields.append("report")
	return frappe.get_all(
		"Print Format",
		filters={DESIGN_FIELD: ["is", "set"]},
		fields=fields,
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


def _store_embedded_images(*texts):
	"""Move base64 images into the site's public files and point the texts at their URLs.

	Embedded images would otherwise be stored twice (in the HTML and in the design) and
	re-sent on every print. Returns the rewritten texts and whether anything changed.
	"""
	urls = {}

	def replace(match):
		data_url = match.group(0)
		if data_url not in urls:
			content = base64.b64decode(match.group(2))
			ext = IMAGE_EXT.get(match.group(1), match.group(1))
			file_doc = frappe.get_doc(
				{
					"doctype": "File",
					"file_name": f"printforge-{hashlib.sha1(content).hexdigest()[:12]}.{ext}",
					"content": content,
					"is_private": 0,
				}
			)
			file_doc.insert(ignore_permissions=True)
			urls[data_url] = file_doc.file_url
		return urls[data_url]

	return [DATA_IMAGE.sub(replace, text) for text in texts], bool(urls)


@frappe.whitelist(methods=["POST"])
def publish(print_format, doctype, html, design, make_default=0, margin_mm=None, print_for="DocType"):
	"""Create or update a custom Print Format from a builder design.

	`doctype` is the document type the format prints or, when `print_for` is "Report", the
	name of the report.
	"""
	_check_permission()
	for_report = print_for == "Report"
	if for_report:
		if not frappe.get_meta("Print Format").has_field("print_format_for"):
			frappe.throw(_("This version of Frappe has no print formats for reports."))
		if not doctype or not frappe.db.exists("Report", doctype):
			frappe.throw(_("Report {0} does not exist on this site.").format(doctype or ""), frappe.DoesNotExistError)
	else:
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

	(html, design), images_moved = _store_embedded_images(html, design)

	doc.update(
		{
			"standard": "No",
			"custom_format": 1,
			"disabled": 0,
			"html": html,
			DESIGN_FIELD: design,
		}
	)
	if for_report:
		# Report formats are rendered in the browser by Frappe's own template engine, so
		# the HTML is not Jinja and must not be validated as such.
		doc.update({"print_format_for": "Report", "report": doctype, "doc_type": None, "print_format_type": "JS"})
	else:
		doc.update({"doc_type": doctype, "print_format_type": "Jinja"})
		if doc.meta.has_field("print_format_for"):
			doc.update({"print_format_for": "DocType", "report": None})
	# wkhtmltopdf takes its margins from the CSS in the HTML; these fields are what the
	# Print Format form shows and what newer PDF generators read.
	if margin_mm is not None:
		for fieldname in MARGIN_FIELDS:
			if doc.meta.has_field(fieldname):
				doc.set(fieldname, flt(margin_mm))

	if created:
		doc.insert()
	else:
		doc.save()

	is_default = bool(cint(make_default)) and not for_report
	if is_default:
		from frappe.printing.doctype.print_format.print_format import make_default as set_default

		set_default(doc.name)

	return {
		"name": doc.name,
		"created": created,
		"is_default": is_default,
		"route": "/app/print-format/" + quote(doc.name),
		# Only sent back when images were moved, so the builder can switch to the file URLs
		"design": design if images_moved else None,
	}
