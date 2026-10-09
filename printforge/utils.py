"""Helpers with no Frappe dependency, so they can be tested without a site."""

import base64
import hashlib
import re
from html import escape

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
		# The builder offers the fields of the linked document too
		if df.get("fieldtype") == "Link" and df.get("options"):
			field["link"] = df["options"]
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


def matrix_svg(matrix, size, quiet=2):
	"""A QR code as inline SVG. `matrix` is rows of 0/1; `quiet` is the blank border in modules."""
	n = len(matrix) + quiet * 2
	path = "".join(
		f"M{x + quiet} {y + quiet}h1v1h-1z"
		for y, row in enumerate(matrix)
		for x, dark in enumerate(row)
		if dark
	)
	return (
		f'<svg xmlns="http://www.w3.org/2000/svg" width="{int(size)}" height="{int(size)}" '
		f'viewBox="0 0 {n} {n}" shape-rendering="crispEdges">'
		f'<rect width="{n}" height="{n}" fill="#ffffff"/><path d="{path}" fill="#000000"/></svg>'
	)


def bars_svg(modules, width, height, text="", quiet=10):
	"""A barcode as inline SVG, with the value under it when `text` is given.

	`modules` is a string of 1 (bar) and 0 (space), each one module wide, and `quiet` the
	blank margin scanners need on either side, in modules. The bars are
	stretched to `width`, which is what a barcode allows; the text is kept out of the SVG so
	it is not stretched with them.
	"""
	text_height = 13 if text else 0
	bar_height = max(4, int(height) - text_height)
	rects, start = [], None
	for i, bit in enumerate(modules + "0"):
		if bit == "1" and start is None:
			start = i
		elif bit != "1" and start is not None:
			rects.append(f"M{start + quiet} 0h{i - start}v1h-{i - start}z")
			start = None
	svg = (
		f'<svg xmlns="http://www.w3.org/2000/svg" width="{int(width)}" height="{bar_height}" '
		f'viewBox="0 0 {len(modules) + quiet * 2} 1" preserveAspectRatio="none" shape-rendering="crispEdges" '
		f'style="display:block;"><path d="{"".join(rects)}" fill="#000000"/></svg>'
	)
	if not text:
		return svg
	return (
		f'<div style="width:{int(width)}px;text-align:center;">{svg}'
		f'<div style="font-size:10px;line-height:{text_height}px;font-family:monospace;color:#000000;'
		f'white-space:nowrap;overflow:hidden;">{escape(str(text))}</div></div>'
	)
