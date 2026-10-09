import json
import re
from urllib.parse import quote

import frappe
from frappe import _
from frappe.utils import cint, flt

from printforge.install import DESIGN_FIELD
from printforge.utils import (
	FILE_PREFIX,
	fields_from_meta,
	fields_from_report_columns,
	replace_data_images,
	stored_file_names,
)

MARGIN_FIELDS = ("margin_top", "margin_bottom", "margin_left", "margin_right")
VERSION_DOCTYPE = "PrintForge Version"
BLOCK_DOCTYPE = "PrintForge Block"
BRAND_KEY = "printforge_brand_colour"
FONT_EXTENSIONS = (".ttf", ".otf")
FONT_MAX_BYTES = 2 * 1024 * 1024
# Earlier designs kept per Print Format; the oldest go first
VERSIONS_KEPT = 15


def _check_permission():
	frappe.has_permission("Print Format", "write", throw=True)


def has_app_permission():
	"""Whether the launcher shows PrintForge to this user (see `add_to_apps_screen` in hooks.py)."""
	return bool(frappe.has_permission("Print Format", "write"))


def _check_doctype(doctype):
	if not doctype or not frappe.db.exists("DocType", doctype):
		frappe.throw(_("DocType {0} does not exist on this site.").format(doctype or ""), frappe.DoesNotExistError)


def _docfields(doctype):
	return [df.as_dict() for df in frappe.get_meta(doctype).fields]


@frappe.whitelist()
def list_doctypes():
	"""Doctypes a print format can be made for."""
	_check_permission()
	return frappe.get_all(
		"DocType", filters={"istable": 0, "issingle": 0}, pluck="name", order_by="name asc", limit_page_length=0
	)


@frappe.whitelist()
def get_doctype_fields(doctype):
	"""Fields of a doctype in the shape the builder's field list uses, with the columns of its child tables."""
	_check_permission()
	_check_doctype(doctype)
	return [{"name": "name", "label": "ID", "isChild": False, "fieldtype": "Data"}] + fields_from_meta(
		_docfields(doctype), child_fields=_docfields
	)


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
	return fields_from_report_columns(columns, frappe.scrub)


@frappe.whitelist()
def recent_docs(doctype):
	"""Names of recently changed documents the user can read, to pick one for a preview."""
	_check_permission()
	_check_doctype(doctype)
	return frappe.get_list(doctype, pluck="name", order_by="modified desc", limit_page_length=20)


def _render_preview(doctype, docname, html):
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


@frappe.whitelist(methods=["POST"])
def preview(doctype, docname, html):
	"""Render unsaved builder output for a real document through Frappe's own print pipeline."""
	return _render_preview(doctype, docname, html)


@frappe.whitelist(methods=["POST"])
def preview_pdf(doctype, docname, html):
	"""The same preview as a PDF, built the way the print view's "Get PDF" builds it."""
	from frappe.utils.pdf import get_pdf

	parts = _render_preview(doctype, docname, html)
	page = (
		'<!DOCTYPE html><html><head><meta charset="utf-8">'
		f'<link rel="stylesheet" href="{parts["css_url"]}">'
		f"<style>{parts['style']}</style></head><body>"
		f'<div class="print-format-gutter"><div class="print-format">{parts["html"]}</div></div>'
		"</body></html>"
	)
	frappe.local.response.filename = f"{docname}.pdf"
	frappe.local.response.filecontent = get_pdf(page)
	frappe.local.response.type = "pdf"


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
	return {"name": doc.name, "doc_type": doc.doc_type, "design": design, "modified": str(doc.modified)}


def _keep_version(print_format, design):
	"""Keep the design a format had before it is replaced, and drop the oldest beyond the limit."""
	if not design:
		return
	frappe.get_doc({"doctype": VERSION_DOCTYPE, "print_format": print_format, "design": design}).insert(
		ignore_permissions=True
	)
	old = frappe.get_all(
		VERSION_DOCTYPE,
		filters={"print_format": print_format},
		pluck="name",
		order_by="creation desc",
		limit_start=VERSIONS_KEPT,
		limit_page_length=1000,
	)
	for name in old:
		frappe.delete_doc(VERSION_DOCTYPE, name, ignore_permissions=True, force=True)


def _version_designs(print_format):
	return frappe.get_all(VERSION_DOCTYPE, filters={"print_format": print_format}, pluck="design")


@frappe.whitelist()
def list_versions(print_format):
	"""Earlier designs of a format, newest first, with the format's current timestamp."""
	_check_permission()
	if not frappe.db.exists("Print Format", print_format):
		frappe.throw(_("{0} does not exist.").format(print_format), frappe.DoesNotExistError)
	return {
		"modified": str(frappe.db.get_value("Print Format", print_format, "modified")),
		"versions": frappe.get_all(
			VERSION_DOCTYPE,
			filters={"print_format": print_format},
			fields=["name", "creation", "owner"],
			order_by="creation desc",
		),
	}


@frappe.whitelist()
def get_version(version):
	_check_permission()
	doc = frappe.get_doc(VERSION_DOCTYPE, version)
	return {"name": doc.name, "print_format": doc.print_format, "design": doc.design}


def delete_versions(doc, method=None):
	"""Print Format on_trash: its kept versions go with it."""
	for name in frappe.get_all(VERSION_DOCTYPE, filters={"print_format": doc.name}, pluck="name"):
		frappe.delete_doc(VERSION_DOCTYPE, name, ignore_permissions=True, force=True)


@frappe.whitelist()
def list_blocks():
	"""Blocks saved from the builder for reuse in other designs."""
	_check_permission()
	return frappe.get_all(BLOCK_DOCTYPE, fields=["name", "linked", "height"], order_by="name asc", limit_page_length=0)


@frappe.whitelist()
def get_block(block):
	_check_permission()
	doc = frappe.get_doc(BLOCK_DOCTYPE, block)
	return {"name": doc.name, "design": doc.design, "linked": cint(doc.linked), "height": cint(doc.height)}


@frappe.whitelist(methods=["POST"])
def save_block(block, design, html="", height=0, linked=0):
	"""Create a block, or replace the one with that name.

	`html` is what the block prints as; formats that insert the block linked render it from
	here when a document is printed, so replacing a block changes them all.
	"""
	_check_permission()
	block = (block or "").strip()
	if not block:
		frappe.throw(_("Give the block a name."))
	if not isinstance(design, str):
		design = json.dumps(design)
	try:
		json.loads(design)
	except ValueError:
		frappe.throw(_("The block data is not valid JSON."))
	if html:
		from frappe.utils.jinja import validate_template

		validate_template(html)

	if frappe.db.exists(BLOCK_DOCTYPE, block):
		doc = frappe.get_doc(BLOCK_DOCTYPE, block)
	else:
		doc = frappe.new_doc(BLOCK_DOCTYPE)
		doc.title = block
	(design, html), _moved = replace_data_images([design, html or ""], _save_block_image)
	doc.update({"design": design, "html": html, "height": cint(height), "linked": cint(linked)})
	doc.save(ignore_permissions=True)
	return {"name": doc.name, "linked": cint(doc.linked), "height": cint(doc.height)}


@frappe.whitelist(methods=["POST"])
def delete_block(block):
	_check_permission()
	frappe.delete_doc(BLOCK_DOCTYPE, block, ignore_permissions=True)


def _save_block_image(file_name, content):
	"""Images inside a block are stored once as public files, not attached to any one format."""
	existing = frappe.db.get_value("File", {"file_name": file_name, "attached_to_doctype": BLOCK_DOCTYPE}, "file_url")
	if existing:
		return existing
	file_doc = frappe.get_doc(
		{"doctype": "File", "file_name": file_name, "content": content, "is_private": 0, "attached_to_doctype": BLOCK_DOCTYPE}
	)
	file_doc.insert(ignore_permissions=True)
	return file_doc.file_url


@frappe.whitelist()
def get_brand():
	"""The brand colour designs on this site can be recoloured around."""
	_check_permission()
	return frappe.db.get_default(BRAND_KEY) or ""


@frappe.whitelist(methods=["POST"])
def save_brand(colour):
	_check_permission()
	colour = (colour or "").strip()
	if colour and not re.fullmatch(r"#[0-9a-fA-F]{6}", colour):
		frappe.throw(_("The brand colour must be a colour such as #7f2a7b."))
	frappe.db.set_default(BRAND_KEY, colour)
	return colour


@frappe.whitelist(methods=["POST"])
def upload_font(filename, data):
	"""Store a font for designs to print in. `data` is the file as a data URL or base64."""
	import base64
	import hashlib

	_check_permission()
	filename = (filename or "").strip().split("/")[-1].split("\\")[-1]
	if not filename.lower().endswith(FONT_EXTENSIONS):
		frappe.throw(_("Upload a .ttf or .otf font file."))
	try:
		content = base64.b64decode((data or "").split(",")[-1], validate=True)
	except Exception:
		frappe.throw(_("The font file could not be read."))
	if not content or len(content) > FONT_MAX_BYTES:
		frappe.throw(_("The font file is empty or larger than 2 MB."))
	# TrueType, OpenType and TrueType collections start with one of these
	if content[:4] not in (b"\x00\x01\x00\x00", b"OTTO", b"true", b"ttcf"):
		frappe.throw(_("That file is not a TrueType or OpenType font."))

	ext = filename[-4:].lower()
	stored = f"{FILE_PREFIX}font-{hashlib.sha1(content).hexdigest()[:12]}{ext}"
	url = frappe.db.get_value("File", {"file_name": stored}, "file_url")
	if not url:
		file_doc = frappe.get_doc({"doctype": "File", "file_name": stored, "content": content, "is_private": 0})
		file_doc.insert(ignore_permissions=True)
		url = file_doc.file_url
	return {"url": url, "name": filename[:-4]}


def _save_image(print_format):
	"""Store one image as a public file attached to the Print Format, reusing an existing copy."""

	def save(file_name, content):
		existing = frappe.db.get_value(
			"File",
			{"file_name": file_name, "attached_to_doctype": "Print Format", "attached_to_name": print_format},
			"file_url",
		)
		if existing:
			return existing
		file_doc = frappe.get_doc(
			{
				"doctype": "File",
				"file_name": file_name,
				"content": content,
				"is_private": 0,
				"attached_to_doctype": "Print Format",
				"attached_to_name": print_format,
			}
		)
		file_doc.insert(ignore_permissions=True)
		return file_doc.file_url

	return save


def _remove_unused_images(print_format, html, design):
	"""Delete this format's stored images that neither the design nor a kept version uses."""
	in_use = stored_file_names(html, design, *_version_designs(print_format))
	for file in frappe.get_all(
		"File",
		filters={
			"attached_to_doctype": "Print Format",
			"attached_to_name": print_format,
			"file_name": ["like", FILE_PREFIX + "%"],
		},
		fields=["name", "file_name"],
	):
		if file.file_name not in in_use:
			frappe.delete_doc("File", file.name, ignore_permissions=True)


@frappe.whitelist(methods=["POST"])
def publish(
	print_format,
	doctype,
	html,
	design,
	make_default=0,
	margin_mm=None,
	print_for="DocType",
	expected_modified=None,
	overwrite=0,
):
	"""Create or update a custom Print Format from a builder design.

	`doctype` is the document type the format prints or, when `print_for` is "Report", the
	name of the report. `expected_modified` is the format's timestamp when the builder last
	read or wrote it; a different one on the site means someone else has changed it.
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
		if not cint(overwrite) and str(doc.modified) != str(expected_modified or ""):
			frappe.throw(
				_("{0} was last changed on the site by {1}, after this design was opened. Publishing now replaces that version.").format(
					print_format, doc.modified_by
				),
				frappe.TimestampMismatchError,
			)

	previous_design = None if created else doc.get(DESIGN_FIELD)

	def apply(html, design):
		doc.update(
			{
				"standard": "No",
				"custom_format": 1,
				"disabled": 0,
				"html": html,
				DESIGN_FIELD: design,
			}
		)

	apply(html, design)
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

	# Images are attached to the format, so they need it to exist first. Embedded images
	# would otherwise be stored twice (HTML and design) and re-sent on every print.
	(html, design), images_moved = replace_data_images([html, design], _save_image(doc.name))
	if images_moved:
		apply(html, design)
		doc.save()
	if previous_design and previous_design != design:
		_keep_version(doc.name, previous_design)
	_remove_unused_images(doc.name, html, design)

	is_default = bool(cint(make_default)) and not for_report
	if is_default:
		from frappe.printing.doctype.print_format.print_format import make_default as set_default

		set_default(doc.name)

	return {
		"name": doc.name,
		"created": created,
		"is_default": is_default,
		"modified": str(doc.modified),
		"route": "/app/print-format/" + quote(doc.name),
		# Only sent back when images were moved, so the builder can switch to the file URLs
		"design": design if images_moved else None,
	}
