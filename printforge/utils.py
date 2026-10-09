"""Helpers with no Frappe dependency, so they can be tested without a site."""

import base64
import hashlib
import re

# SVG is deliberately absent: an SVG can carry script, so it stays embedded in the <img>
# (where it cannot run) instead of becoming a public file that could be opened directly.
DATA_IMAGE = re.compile(r"data:image/(png|jpe?g|gif|webp);base64,([A-Za-z0-9+/=]+)")
IMAGE_EXT = {"jpeg": "jpg"}
FILE_PREFIX = "printforge-"
STORED_FILE = re.compile(r"/files/(" + re.escape(FILE_PREFIX) + r"[0-9a-f]{12}\.[a-z]+)")

LAYOUT_FIELDTYPES = {"Section Break", "Column Break", "Tab Break", "HTML", "Button", "Fold", "Heading"}


def image_file_name(content, subtype):
	ext = IMAGE_EXT.get(subtype, subtype)
	return f"{FILE_PREFIX}{hashlib.sha1(content).hexdigest()[:12]}.{ext}"


def replace_data_images(texts, save):
	"""Swap base64 images in `texts` for URLs.

	`save(file_name, content)` stores one image and returns its URL; it is called once per
	distinct image. Returns the rewritten texts and whether anything was replaced.
	"""
	urls = {}

	def replace(match):
		data_url = match.group(0)
		if data_url not in urls:
			content = base64.b64decode(match.group(2))
			urls[data_url] = save(image_file_name(content, match.group(1)), content)
		return urls[data_url]

	return [DATA_IMAGE.sub(replace, text or "") for text in texts], bool(urls)


def stored_file_names(*texts):
	"""Names of PrintForge image files the texts still point at."""
	names = set()
	for text in texts:
		names.update(STORED_FILE.findall(text or ""))
	return names


def fields_from_meta(fields, child_fields=None):
	"""Docfields (dicts) in the shape the builder's field list uses.

	`child_fields(child_doctype)` returns the docfields of a child table, so the builder can
	offer its columns.
	"""
	out = []
	for df in fields:
		if df.get("fieldtype") in LAYOUT_FIELDTYPES or not df.get("fieldname"):
			continue
		field = {
			"name": df["fieldname"],
			"label": df.get("label") or df["fieldname"],
			"isChild": df.get("fieldtype") == "Table",
			"fieldtype": df.get("fieldtype"),
		}
		if field["isChild"] and child_fields and df.get("options"):
			field["columns"] = [
				{"name": c["name"], "label": c["label"], "fieldtype": c["fieldtype"]}
				for c in fields_from_meta(child_fields(df["options"]))
				if not c["isChild"]
			]
		out.append(field)
	return out


def fields_from_report_columns(columns, scrub):
	"""Report columns, which come as dicts or as "Label:Type/Options:Width" strings."""
	fields = []
	for col in columns or []:
		if isinstance(col, str):
			parts = col.split(":")
			col = {
				"label": parts[0],
				"fieldname": scrub(parts[0]),
				"fieldtype": parts[1].split("/")[0] if len(parts) > 1 and parts[1] else "Data",
			}
		if col.get("fieldname"):
			fields.append(
				{
					"name": col["fieldname"],
					"label": col.get("label") or col["fieldname"],
					"isChild": False,
					"fieldtype": col.get("fieldtype") or "Data",
				}
			)
	return fields
